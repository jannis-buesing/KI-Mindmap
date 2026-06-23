import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MindmapBoard } from './MindmapBoard';
import { SidebarLeft } from './SidebarLeft';
import { 
  selectMindmapDirectory, 
  saveMindmapToFile, 
  loadMindmapsFromDirectory, 
  deleteMindmapFile,
  getStoredDirectoryHandle
} from './utils/fileSystem';

function App() {
  const [dirHandle, setDirHandle] = useState(null);
  const [hasPermission, setHasPermission] = useState(false); // NEU: Status-Tracker
  const [mapsList, setMapsList] = useState([]);
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

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
    const name = `${Date.now()}`;
    const initialData = { 
      name: name, 
      lastChanged: Date.now(), 
      rootNode: { id: "root", label: "Neues Thema", children: [] },
      positions: {} 
    };
    await saveMindmapToFile(dirHandle, name, initialData);
    
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    setMindmapData(prev => ({
      ...prev,
      name: name
    }));
    setMindmapData(initialData);
    setIsSaved(true);
  }

  // 4. Bestehende Mindmap aus Datei laden
  async function handleSelectMap(name) {
    if (!dirHandle || !hasPermission) return;
    const fileHandle = await dirHandle.getFileHandle(`${name}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    
    const parsedData = JSON.parse(text);
    setMindmapData(parsedData.rootNode ? parsedData : {
      name: name, lastChanged: parsedData.lastChanged || file.lastModified, rootNode: parsedData, positions: {}
    });
    setIsSaved(true);
  }

  // 5. Auto-Save-Effekt
  useEffect(() => {
    if (!dirHandle || !hasPermission || !mindmapData?.name) return;
    
    setIsSaved(false);
    const delayDebounce = setTimeout(async () => {
      const success = await saveMindmapToFile(dirHandle, mindmapData.name, mindmapData, false);
      if (success) {
        setIsSaved(true);
        const files = await loadMindmapsFromDirectory(dirHandle);
        setMapsList(files);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [mindmapData, dirHandle, hasPermission]);

  // 6. Löschen
  async function handleDeleteMap(name) {
    if (confirm(`Möchtest du "${name}" wirklich löschen?`)) {
      await deleteMindmapFile(dirHandle, name);
      const files = await loadMindmapsFromDirectory(dirHandle);
      setMapsList(files);
      if (mindmapData?.name === name) {
        setMindmapData(null);
        setMindmapData(prev => ({
          ...prev,
          name: ''
        }));
      }
    }
  }

  // 7. Umbenennen
  async function handleRenameMap(oldName, newName) {
    if (!newName || oldName === newName) return;
    const fileHandle = await dirHandle.getFileHandle(`${oldName}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);

    await saveMindmapToFile(dirHandle, newName, data, true);
    await deleteMindmapFile(dirHandle, oldName);

    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    if (mindmapData?.name === oldName) {
      setMindmapData(prev => ({
        ...prev,
        name: newName
      }));
    }
  }

  // 8. KI Generierung
  async function generateMindmap() {
    if (!mindmapData?.name) {
      alert("Bitte wähle oder erstelle zuerst eine Mindmap in der linken Leiste!");
      return;
    }
    setLoading(true);
    try {
      const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = ai.getGenerativeModel({ 
        model: "gemini-3-flash-preview", 
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `Erstelle eine detaillierte Mindmap zum Thema '${mindmapData.rootNode?.label || 'Übersicht erstellen'}'. 
      Antworte AUSSCHLIESSLICH als valides JSON-Objekt mit folgender Struktur:
      {
        "id": "root",
        "label": "Hauptthema",
        "children": [
          { "id": "u1", "label": "Unterthema 1", "children": [] }
        ]
      }`;

      const result = await model.generateContent(prompt);
      setMindmapData(prev => ({ ...prev, rootNode: JSON.parse(result.response.text()) }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      <SidebarLeft 
        dirName={dirHandle?.name}
        onSelectDir={handleSelectDirectory}
        maps={mapsList}
        currentMap={mindmapData?.name || ''}
        onSelectMap={handleSelectMap}
        onDeleteMap={handleDeleteMap}
        onRenameMap={handleRenameMap}
        onCreateMap={handleCreateMap}
        isSaved={isSaved}
        hasPermission={hasPermission} // Übergabe an die Sidebar
      />

      <div style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!mindmapData?.name && <h1>KI Mindmap Studio</h1>}
          </div>
        </header>

        {mindmapData ? (
          <MindmapBoard 
            rawData={mindmapData.rootNode} 
            positions={mindmapData.positions} 
            setMindmapData={setMindmapData}
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

        {mindmapData?.name && (
            <button 
              onClick={generateMindmap} 
              disabled={loading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Erstelle Ast...' : 'Mit KI erweitern'}
            </button>
          )}
      </div>
    </div>
  );
}

export default App;