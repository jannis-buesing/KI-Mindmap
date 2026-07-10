import { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MindmapBoard } from './MindmapBoard';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { 
  selectMindmapDirectory, 
  saveMindmapToFile, 
  loadMindmapsFromDirectory, 
  deleteMindmapFile,
  getStoredDirectoryHandle
} from './utils/fileSystem';
import { SendHorizontal } from 'lucide-react';

function App() {
  const [dirHandle, setDirHandle] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [mapsList, setMapsList] = useState([]);
  const [mindmapData, setMindmapData] = useState(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const isInitialLoad = useRef(true);
  const isRenamingRef = useRef(false);
  const [selectedNodes, setSelectedNodes] = useState([]); 
  const selectedNodeIds = selectedNodes.map(n => n.id);

  // 1. Beim Starten nachsehen, ob ein Ordner in IndexedDB schlummert
  useEffect(() => {
    async function initSavedDirectory() {
      const savedHandle = await getStoredDirectoryHandle();
      if (savedHandle) {
        setDirHandle(savedHandle);
        // Prüfen, ob die Erlaubnis zufällig noch aktiv ist
        const status = await savedHandle.queryPermission({ mode: 'readwrite' });
        if (status === 'granted') {
          setHasPermission(true);
          const files = await loadMindmapsFromDirectory(savedHandle);
          setMapsList(files);
        } else {
          setHasPermission(false);
        }
      }
    }
    initSavedDirectory();
  }, []);

  // 2. Ordner verbinden ODER bestehende Berechtigung reaktivieren
  async function handleSelectDirectory() {
    // FALL A: Ordner ist bekannt, wir brauchen nur den Chrome-Klick für die Erlaubnis
    if (dirHandle && !hasPermission) {
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        setHasPermission(true);
        const files = await loadMindmapsFromDirectory(dirHandle);
        setMapsList(files);
      }
      return;
    }

    // FALL B: Kein Ordner da oder Nutzer will komplett wechseln -> Windows-Picker öffnen
    const handle = await selectMindmapDirectory();
    if (handle) {
      setDirHandle(handle);
      setHasPermission(true);
      const files = await loadMindmapsFromDirectory(handle);
      setMapsList(files);
    }
  }

  // 3. Neue leere Mindmap erstellen
  async function handleCreateMap() {
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const defaultName = 'Neue Mindmap';

    const initialData = {
      id: uniqueId, 
      name: defaultName,
      _currentFileName: '', 
      lastChanged: Date.now(),
      date: Date.now(),
      rootNode: { id: "root", label: defaultName, children: [] },
      positions: {} 
    };

    await saveMindmapToFile(dirHandle, defaultName, initialData, false);
    
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);

    const fileInfo = files.find(f => f.id === uniqueId);
    setMindmapData({ ...initialData, _currentFileName: fileInfo?.name || defaultName });
    setIsSaved(true);
  }

  // 4. Bestehende Mindmap aus Datei laden
  async function handleSelectMap(id) {
    if (!dirHandle || !hasPermission) return;

    const foundMap = mapsList.find(m => m.id === id);
    if(!foundMap) return;

    const fileHandle = await dirHandle.getFileHandle(`${foundMap.name}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsedData = JSON.parse(text);

    isInitialLoad.current = true;
    setMindmapData(parsedData.rootNode ? parsedData : {
      name: foundMap.name, lastChanged: parsedData.lastChanged || file.lastModified, rootNode: parsedData, positions: {}
    });
    setIsSaved(true);
  }

  // 5. Auto-Save-Effekt
  useEffect(() => {
    if (!dirHandle || !hasPermission || !mindmapData?.id) return;

    if(isInitialLoad.current){
      isInitialLoad.current = false;
      return;
    }
    if (isRenamingRef.current) {
      isRenamingRef.current = false;
      return; 
    }
    
    setIsSaved(false);
    const delayDebounce = setTimeout(async () => {
      await saveMindmapToFile(dirHandle, mindmapData.name, mindmapData, false);
      setIsSaved(true);

      const files = await loadMindmapsFromDirectory(dirHandle);
      setMapsList(files);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [mindmapData, dirHandle, hasPermission]);

  // 6. Löschen
  async function handleDeleteMap(id) {
    const foundMap = mapsList.find(m => m.id === id);
    if (!foundMap) return;

    if (confirm(`Möchtest du "${foundMap.name}" wirklich löschen?`)) {
      await deleteMindmapFile(dirHandle, foundMap.name);
      const files = await loadMindmapsFromDirectory(dirHandle);
      setMapsList(files);
      if (mindmapData?.id === id) {
        setMindmapData(null);
      }
    }
  }

  // 7. Umbenennen
  async function handleRenameMap(id, newName) {
    if (!newName) return;
    const foundMap = mapsList.find(m => m.id === id);
    if (!foundMap) return;
    if (foundMap.name === newName) return;

    isRenamingRef.current = true;

    const fileHandle = await dirHandle.getFileHandle(`${foundMap.name}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);

    const updatedData = {
      ...data,
      name: newName
    }

    await saveMindmapToFile(dirHandle, newName, updatedData, true);
    await deleteMindmapFile(dirHandle, foundMap.name);

    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);

    if (mindmapData?.id === id) {
      const updatedFileInfo = files.find(f => f.id === id);
      setMindmapData({ ...updatedData, _currentFileName: updatedFileInfo?.name || newName });
  }
  }

  // 8. KI Generierung
  async function expandMindmap() {
    if (!mindmapData?.name) {
      alert("Bitte wähle oder erstelle zuerst eine Mindmap in der linken Leiste!");
      return;
    }

    const targetMapId = mindmapData.id; 
    const currentPromptText = userInput;

    const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

    const AVAILABLE_MODELS = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    const prompt = `
      Du bist ein meisterhafter, strukturierter Mindmap-Experte.
      Deine Aufgabe ist es, die bestehende Mindmap basierend auf einer Benutzeranweisung gezielt zu verändern.
      Du gibst AUSSCHLIESSLICH eine flache Liste von Änderungsbefehlen (Operations) als valides JSON-Objekt zurück.
      Diese werden dann von der Anwendung direkt in den Mindmap-Baum übernommen.

      Aktueller Mindmap-Baum (Kontext):
      ${JSON.stringify(mindmapData.rootNode, null, 2)}

      vom Nutzer aktuell markierte Knoten-IDs:
      ${JSON.stringify(selectedNodeIds)}

      Benutzeranweisung:
      "${currentPromptText}"

      Regeln für das JSON-Ausgabeformat:
      - WICHTIG: Der zentrale Hauptknoten mit id: "root" darf NIEMALS den Status "deleted" erhalten!
      - "type": Kann "added", "updated" oder "deleted" sein.
      - Für "added": Erzeuge eine einzigartige "temporaryId" (z.B. "new_123") und gib die "parentId" an, also, zu welchem Elternknoten der neue Knoten gehört.
      - Für "updated": Gib die "nodeId" an und liefere das neue "label" sowie das "oldLabel".
      - Für "deleted": Gib nur die "nodeId" an, die gelöscht werden soll.

      Beispiel für die exakte Struktur (Antworte NUR mit diesem JSON, kein Markdown, kein Text!):
      {
        "operations": [
          { "type": "added", "parentId": "root", "temporaryId": "child_1", "label": "Neuer Unterpunkt" },
          { "type": "updated", "nodeId": "child_2", "oldLabel": "Alter Name", "label": "Neuer Name" },
          { "type": "deleted", "nodeId": "child_3" }
        ]
      }
    `;

    setLoading(true);
    setUserInput('');

    for(const modelName of AVAILABLE_MODELS){
      try {
      console.log(`Versuche Modell: ${modelName}...`); ///////////TEST///////////
      
      const model = ai.getGenerativeModel({ 
          model: modelName, 
          generationConfig: { responseMimeType: "application/json" }
        });

      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      const operations = data.operations || [];

      console.log(`Erhaltene Operationen:`, operations); ///////////TEST///////////
      console.log(`Erfolg mit Modell: ${modelName}`); //////////////TEST////////////

      const injectStatusIntoTree = (node) => {
        if (!node) return null;

        let updatedNode = { ...node };

        // Schauen, ob eine Operation diesen bestehenden Knoten betrifft (Update oder Delete)
        const op = operations.find(o => o.nodeId === node.id);
        if (op) {
          if (op.type === 'updated') {
            updatedNode.status = 'updated';
            updatedNode.oldLabel = op.oldLabel;
            updatedNode.label = op.label;
          }
          if (op.type === 'deleted') {
            updatedNode.status = 'deleted';
          }
        }

        // Kinder verarbeiten
        let currentChildren = node.children ? node.children.map(injectStatusIntoTree) : [];

        // Schauen, ob neue Kinder an DIESEN Knoten angehängt werden müssen (Added)
        const newChildrenOps = operations.filter(o => o.type === 'added' && o.parentId === node.id);
        newChildrenOps.forEach(newOp => {
          currentChildren.push({
            id: newOp.temporaryId,
            label: newOp.label,
            status: 'added',
            children: []
          });
        });

        updatedNode.children = currentChildren;
        return updatedNode;
      };

      const newRootNode = injectStatusIntoTree(mindmapData.rootNode);

      const updateMapWithNewTree = (map) => ({
        ...map,
        rootNode: newRootNode
      });

      setMindmapData(prev => (prev && prev.id === targetMapId) ? updateMapWithNewTree(prev) : prev);
      setMapsList(prevList => prevList.map(map => map.id === targetMapId ? updateMapWithNewTree(map) : map));

      setLoading(false);
      return;
    } catch (error) {
      console.warn(`Modell ${modelName} fehlgeschlagen. Fehler: ${error.message || error}`);
      continue; 
    }
  }
  setLoading(false);
  throw new Error("Alle verfügbaren Gemini-Modelle sind derzeit ausgelastet (503).");
}


useEffect(() => {
    const processDecisions = (nodeIdsArray, accepted) => {
      const applyDecisionsToTree = (map) => {
        if (!map || !map.rootNode) return map;

        const cleanTreeRecursive = (node) => {
          if (!node) return null;

          let processedChildren = node.children 
            ? node.children.flatMap(child => {
                const res = cleanTreeRecursive(child);
                return Array.isArray(res) ? res : (res ? [res] : []);
              })
            : [];

          // 2. Wenn dieser Knoten von der Entscheidung betroffen ist
          if (nodeIdsArray.includes(node.id)) {
            if (accepted) {
              // ANGENOMMEN:
              if (node.status === 'deleted') {
                return processedChildren; 
              }
              if (node.status === 'updated') {
                return {
                  ...node,
                  status: null,
                  oldLabel: undefined,
                  children: processedChildren
                };
              }
              if (node.status === 'added') {
                return {
                  ...node,
                  status: null,
                  children: processedChildren
                };
              }
            } else {
              // ABGELEHNT:
              if (node.status === 'added') {
                return null; // Neu hinzugefügter Vorschlag fliegt mitsamt seinen Kindern raus
              }
              if (node.status === 'updated') {
                return {
                  ...node,
                  label: node.oldLabel || node.label,
                  status: null,
                  oldLabel: undefined,
                  children: processedChildren
                };
              }
              if (node.status === 'deleted') {
                return {
                  ...node,
                  status: null,
                  children: processedChildren
                };
              }
            }
          }

          // 3. Wenn nicht direkt betroffen, normalen Knoten mit verarbeiteten Kindern zurückgeben
          return {
            ...node,
            children: processedChildren
          };
        };

        const safeMapChildren = (rootNode) => {
          if (!rootNode) return null;
          return {
            ...rootNode,
            children: rootNode.children 
              ? rootNode.children.flatMap(child => {
                  const res = cleanTreeRecursive(child);
                  return Array.isArray(res) ? res : (res ? [res] : []);
                })
              : []
          };
        };

        return {
          ...map,
          rootNode: safeMapChildren(map.rootNode)
        };
      };

      setMindmapData(prev => prev ? applyDecisionsToTree(prev) : prev);
      setMapsList(prevList => prevList.map(map => applyDecisionsToTree(map)));
    };

    const handleSingle = (e) => {
      const { nodeId, accepted } = e.detail;
      processDecisions([nodeId], accepted);
    };

    const handleBulk = (e) => {
      const { nodeIds, accepted } = e.detail;
      processDecisions(nodeIds, accepted);
    };

    window.addEventListener('proposalDecision', handleSingle);
    window.addEventListener('bulkProposalDecision', handleBulk);

    return () => {
      window.removeEventListener('proposalDecision', handleSingle);
      window.removeEventListener('bulkProposalDecision', handleBulk);
    };
  }, []);



  const handleUpdateSelectedNodes = (field, value) => {
    console.log("Updating nodes: ", field, value, selectedNodeIds);
    // 1. Lokalen Zustand der ausgewählten Nodes sofort im UI spiegeln
    setSelectedNodes(current => current.map(node => {
      if (field === 'label') {
        return { ...node, data: { ...node.data, label: value } };
      }
      if (field === 'borderColor') {
        return { ...node, style: { ...node.style, borderColor: value } };
      }
      return node;
    }));

    // 2. Den eigentlichen persistenten Mindmap-Baum aktualisieren
    setMindmapData((prev) => {
      if (!prev) return prev;

      const updateRecursive = (treeNode) => {
        let updatedNode = { ...treeNode };
        if (selectedNodeIds.includes(treeNode.id)) {
          if (field === 'label') updatedNode.label = value;
          if (field === 'borderColor') updatedNode.borderColor = value;
        }
        if (treeNode.children) {
          updatedNode.children = treeNode.children.map(updateRecursive);
        }
        return updatedNode;
      };

      return {
        ...prev,
        rootNode: updateRecursive(prev.rootNode)
      };
    });
  };

  function keinContextMenu(){
    event.preventDefault();
  }

  return (
    <div onContextMenu={keinContextMenu} style={{ display: 'flex', position: 'relative', flex: '1 1 auto', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {loading && (
        <style>{`
          * {
            cursor: wait !important;
          }
        `}</style>  
      )}
      
      <SidebarLeft 
        dirName={dirHandle?.name}
        onSelectDir={handleSelectDirectory}
        maps={mapsList}
        currentMap={mindmapData?.id || ''}
        onSelectMap={handleSelectMap}
        onDeleteMap={handleDeleteMap}
        onRenameMap={handleRenameMap}
        onCreateMap={handleCreateMap}
        isSaved={isSaved}
        hasPermission={hasPermission}
      />

      <div style={{ flex: '1 1 20%', minWidth: '200px', padding: '30px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!mindmapData?.name && <h1>KI Mindmap Studio</h1>}
          </div>
        </header>

        {mindmapData ? (
          <MindmapBoard 
            rawData={mindmapData.rootNode}
            currentFileName={mindmapData?.name}
            positions={mindmapData.positions} 
            setMindmapData={setMindmapData}
            onNodesSelect={setSelectedNodes}
            selectedNodeIds={selectedNodeIds}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--code-bg)', borderRadius: '12px', border: '1px dashed var(--border)', marginTop: '20px' }}>
            {dirHandle && hasPermission 
              ? 'Wähle links eine Mindmap aus oder erstelle eine neue.' 
              : !hasPermission && dirHandle 
                ? 'Klicke links auf "Berechtigung erteilen", um deine Mindmaps zu laden.'
                : 'Verbinde zuerst einen Ordner auf deinem PC, um loszulegen!'}
          </div>
        )}

      {/* Eingabeleiste Komponente Start */}
        {mindmapData?.name && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '6px 12px',
            margin: '1rem 0 0 0',
            // width: '100%',
            // maxWidth: '700px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'border-color 0.2s'
          }}>
            <input
              type="text"
              placeholder={selectedNodeIds.length > 1 
                ? `${selectedNodeIds.length} markierte Knoten bearbeiten` 
                : selectedNodeIds.length === 1 ?
                  "1 markierten Knoten bearbeiten"
                  : selectedNodeIds.length === 0
                  ? "keine Knoten ausgewählt"
                    : ""
              }
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userInput.trim().length > 0 && !loading){
                  expandMindmap();
                }
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 6px',
                fontSize: '15px',
                color: 'var(--text-h)',
                outline: 'none',
              }}
            />
            
              <button
                onClick={expandMindmap}
                disabled={loading || userInput.trim().length === 0}
                style={{
                  padding: '10px 12px',
                  backgroundColor: loading || userInput.trim().length === 0 ? 'var(--border)' : 'var(--accent)',
                  color: loading || userInput.trim().length === 0 ? '#808080' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? (
                  'Denke nach...'
                ) : (
                  <>
                    <span>Senden</span>
                    <SendHorizontal size={16} />
                  </>
                )}
              </button>
          </div>
        )}
        {/* Eingabeleiste Komponente Ende */}
      </div>
      
      <SidebarRight 
        selectedNodeIds={selectedNodeIds}
        selectedNodes={selectedNodes} 
        onUpdateNodes={handleUpdateSelectedNodes}
      />
    </div>
  );
}

export default App;