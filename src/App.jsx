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
  const [userApiKey, setUserApiKey] = useState(() => {
    const savedKey = localStorage.getItem('gemini_user_api_key');
    return savedKey || '';
  });

  useEffect(() => {
    localStorage.setItem('gemini_user_api_key', userApiKey);
  }, [userApiKey]);

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

    setLoading(true);
    setUserInput('');

    try {
      // Ruf unsere neue Vercel Serverless Function auf
      const res = await fetch('/api/expandMindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rootNode: mindmapData.rootNode,
          selectedNodeIds: selectedNodeIds,
          userInput: currentPromptText,
          userApiKey: userApiKey // Optional: Falls der User im UI einen eigenen Key eingetragen hat (Weg A)
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Serverfehler beim Generieren der Mindmap.");
      }

      const data = await res.json();
      const operations = data.operations || [];
      console.log("Erhaltene Operationen vom Server:", operations);

      // Im Baum speichern
      const injectStatusIntoTree = (node) => {
        if (!node) return null;

        let updatedNode = { ...node };

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

        let currentChildren = node.children ? node.children.map(injectStatusIntoTree) : [];

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

    } catch (error) {
      console.error("Fehler beim Erweitern der Mindmap:", error);
      alert(`Fehler: ${error.message}`);
      setLoading(false);
    }
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

      <div style={{ flex: '1 1 20%', minWidth: '240px', padding: '30px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            outline: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '6px 12px',
            margin: '1rem 0 0 0',
            width: '100%',
            // maxWidth: '700px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
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
                minWidth: '0',
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
                  flexShrink: 0,
                  backgroundColor: loading || userInput.trim().length === 0 ? 'var(--border)' : 'var(--accent)',
                  color: loading || userInput.trim().length === 0 ? '#808080' : '#var(--text-h)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || userInput.trim().length === 0 ? 'not-allowed' : 'pointer',
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