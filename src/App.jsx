import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Analytics } from "@vercel/analytics/react";
import { MindmapBoard } from './MindmapBoard';
import { Eingabeleiste } from './Eingabeleiste';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import Overlay from './Overlay';
import { 
  selectMindmapDirectory, 
  saveMindmapToFile, 
  loadMindmapsFromDirectory, 
  deleteMindmapFile,
  getStoredDirectoryHandle
} from './utils/fileSystem';

function migrateTreeToFlat(data) {
  if (!data) return null;
  if (data.nodes && data.edges) {
    return data;
  }

  const nodes = [];
  const edges = [];

  function traverse(node, parentId = null) {
    if (!node) return;

    const flatNode = {
      id: node.id,
      label: node.label,
    };
    if (node.isRootNode || node.id === 'root') {
      flatNode.isRootNode = true;
    }
    if (node.width !== undefined) flatNode.width = node.width;
    if (node.borderColor) flatNode.borderColor = node.borderColor;
    if (node.status) flatNode.status = node.status;
    if (node.oldLabel) flatNode.oldLabel = node.oldLabel;
    if (node.isNew) flatNode.isNew = node.isNew;

    nodes.push(flatNode);

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
      });
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, node.id));
    }
  }

  if (data.rootNode) {
    traverse(data.rootNode, null);
  }

  if (data.floatingNodes && Array.isArray(data.floatingNodes)) {
    data.floatingNodes.forEach(fNode => traverse(fNode, null));
  }

  const migrated = {
    ...data,
    nodes,
    edges,
  };
  delete migrated.rootNode;
  delete migrated.floatingNodes;

  return migrated;
}

function getOrientedEdge(nodeIdA, nodeIdB, positions) {
  const posA = positions[nodeIdA] || { x: 0, y: 0 };
  const posB = positions[nodeIdB] || { x: 0, y: 0 };

  // Der Knoten, der weiter links steht (kleineres X), wird immer die SOURCE (Ausgang links -> rechts)
  // Steht NodeB weiter links als NodeA, drehen wir die Richtung um.
  if (posB.x < posA.x) {
    return {
      id: `e-${nodeIdB}-${nodeIdA}`,
      source: nodeIdB,
      target: nodeIdA
    };
  }

  // Standard-Ausrichtung: NodeA ist links (Source), NodeB ist rechts (Target)
  return {
    id: `e-${nodeIdA}-${nodeIdB}`,
    source: nodeIdA,
    target: nodeIdB
  };
}

function App() {
  const [dirHandle, setDirHandle] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [mapsList, setMapsList] = useState([]);
  const [mindmapData, setMindmapData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const isInitialLoad = useRef(true);
  const isRenamingRef = useRef(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [userApiKey, setUserApiKey] = useState(() => {
    const savedKey = localStorage.getItem('gemini_user_api_key');
    return savedKey || '';
  });
  const [userPickedAccentColor, setUserPickedAccentColor] = useState(() => {
    const savedColors = localStorage.getItem('user_picked_accent_colors');
    return savedColors ? JSON.parse(savedColors) : { light: '#b385d8', dark: '#c084fc' };
  });
  const [confirmDelete, setConfirmDelete] = useState(() => {
    const confirmDelete = localStorage.getItem('confirmDelete');
    if (confirmDelete === null) return true;
    return confirmDelete === 'true';
  });
  const [showOverlay, setShowOverlay] = useState(null); // 'copy'
  const [copyMapData, setCopyMapData] = useState(null);
  const labelDebounceRef = useRef(null);
  const [isViewReady, setIsViewReady] = useState(true);
  
  // Undo/Redo Memory-only Stacks & State Tracker
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const previousStateRef = useRef(null);

  const isSwitchingMapRef = useRef(false);

  // Für das temporäre Erstellen einer Mindmap
  const [currentMapId, setCurrentMapId] = useState(() => {
    const storedId = localStorage.getItem('current_mindmap_id');
    if (!storedId) return '';

    const transitionStore = localStorage.getItem('mindmap_id_transitions');
    if (!transitionStore) return storedId;

    try {
      const transitions = JSON.parse(transitionStore);
      return transitions[storedId] || storedId;
    } catch {
      return storedId;
    }
  });

  // Effekt: Jedes Mal wenn sich die ID ändert, in localStorage schreiben
  useEffect(() => {
    if (currentMapId) {
      localStorage.setItem('current_mindmap_id', currentMapId);
    } else {
      localStorage.removeItem('current_mindmap_id');
    }
  }, [currentMapId]);

  // Helfer für tiefe Kopien des Zustands
  const cloneState = (data) => (data ? JSON.parse(JSON.stringify(data)) : null);

  const getStructuralSnapshot = (data) => {
    if (!data) return null;
    return {
      nodes: (data.nodes || []).map(n => ({ id: n.id, label: n.label, width: n.width, borderColor: n.borderColor, status: n.status })),
      edges: (data.edges || []).map(e => ({ id: e.id, source: e.source, target: e.target })),
      positions: Object.keys(data.positions || {}).reduce((acc, key) => {
        acc[key] = { x: data.positions[key].x, y: data.positions[key].y };
        return acc;
      }, {})
    };
  };

  // Akzentfarbe ändern
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme !== null) {
      return JSON.parse(savedTheme); // Macht aus dem String "false" wieder das originale false
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // 1. Suche das Meta-Tag für die Browserfarbe
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }

    // 2. Setze die Farbe passend zu deinem Dark- und Light-Mode Hintergrund
    metaThemeColor.setAttribute('content', isDark ? '#1e1e1e' : '#ffffff');
    
    // 3. Ergänzung: color-scheme direkt per JS auf das HTML-Element spiegeln, 
    // falls du keine globalen CSS-Klassen nutzt
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

  }, [isDark]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('user_picked_accent_colors', JSON.stringify(userPickedAccentColor));
  }, [userPickedAccentColor]);

  useEffect(() => {
    const currentmode = isDark ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', currentmode);

    const activeColor = userPickedAccentColor[currentmode];
    document.documentElement.style.setProperty('--accent', activeColor);
    const hexToRgb = (hex) => {
      let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      let fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
      let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const rgb = hexToRgb(activeColor);
    if (rgb) {
      const bgOpacity = isDark ? 0.15 : 0.1;
      const borderOpacity = 0.5;
      document.documentElement.style.setProperty('--accent-bg', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${bgOpacity})`);
      document.documentElement.style.setProperty('--accent-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${borderOpacity})`);
    }
  }, [userPickedAccentColor, isDark]);

  useEffect(() => {
    localStorage.setItem('gemini_user_api_key', userApiKey);
  }, [userApiKey]);

  useEffect(() => {
    localStorage.setItem('confirmDelete', confirmDelete);
  }, [confirmDelete]);

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(isDark));
  }, [isDark]);

  useEffect(() => {
    return () => {
      if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
    };
  }, []);

useEffect(() => {
  async function initSavedDirectory() {
    const savedHandle = await getStoredDirectoryHandle();
    if (!savedHandle) return;

    const status = await savedHandle.queryPermission({ mode: 'readwrite' });
    
    if (status === 'granted') {
      const files = await loadMindmapsFromDirectory(savedHandle);
      setDirHandle(savedHandle);
      setHasPermission(true);
      setMapsList(files);

      const savedMapId = localStorage.getItem('current_mindmap_id');
      if (savedMapId) {
        
        // Fall A: Es war eine noch ungespeicherte, temporäre Map
        if (savedMapId.startsWith('temp_')) {
          const localData = localStorage.getItem(`temp_map_data_${savedMapId}`);
          if (localData) {
            undoStack.current = [];
            redoStack.current = [];
            previousStateRef.current = null;
            isInitialLoad.current = true;
            
            setMindmapData(JSON.parse(localData));
            setCurrentMapId(savedMapId);
            setIsSaved(true);
            return;
          }
        }
        
        // Fall B: Es ist eine bereits existierende, echte Map auf der Festplatte
        const foundMap = files.find(m => m.id === savedMapId);
        if (foundMap) {
          try {
            // Direktzugriff über _currentFileName
            const fileHandle = await savedHandle.getFileHandle(`${foundMap._currentFileName}.json`);
            const file = await fileHandle.getFile();
            const text = await file.text();
            let parsedData = JSON.parse(text);
            
            let dataToLoad = parsedData;
            if (parsedData.rootNode || !parsedData.nodes) {
              dataToLoad = migrateTreeToFlat(parsedData);
            }
            
            undoStack.current = [];
            redoStack.current = [];
            previousStateRef.current = null;
            isInitialLoad.current = true;

            setCurrentMapId(savedMapId);
            setMindmapData(dataToLoad);
            setIsSaved(true);
          } catch (error) {
            console.error("Fehler beim automatischen Laden der Mindmap nach Reload:", error);
            localStorage.removeItem('current_mindmap_id');
          }
        }
      }
    } else {
      setDirHandle(savedHandle);
      setHasPermission(false);
    }
  }
  initSavedDirectory();
}, []);

  const handleSelectDirectory = useCallback(async () => {
    if (dirHandle && !hasPermission) {
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        setHasPermission(true);
        const files = await loadMindmapsFromDirectory(dirHandle);
        setMapsList(files);
      }
      return;
    }
    const handle = await selectMindmapDirectory();
    if (handle) {
      setDirHandle(handle);
      setHasPermission(true);
      const files = await loadMindmapsFromDirectory(handle);
      setMapsList(files);
    }
  }, [dirHandle, hasPermission]);

const handleCreateMap = useCallback(() => {
  if (!dirHandle) return;

  setIsViewReady(false);

  const uniqueId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const defaultName = 'Meine Mindmap';
  const initialData = {
    id: uniqueId,
    _currentFileName: defaultName,
    date: Date.now(),
    nodes: [{
      id: 'root',
      label: 'Meine Mindmap...',
      isRootNode: true
    }],
    edges: [],
    positions: {
      'root': { x: 0, y: 0 }
    } 
  };
  
  // Stacks & Status-Tracker leeren
  undoStack.current = [];
  redoStack.current = [];
  previousStateRef.current = null;
  isInitialLoad.current = true;

  // Im State setzen
  setCurrentMapId(uniqueId);
  setMindmapData(initialData);
  setIsSaved(true);

  // Backup für Page-Reload im localStorage sichern
  localStorage.setItem(`temp_map_data_${uniqueId}`, JSON.stringify(initialData));
  localStorage.setItem('current_mindmap_id', uniqueId);

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('reactflow-trigger-fitview'));
  }, 100);
}, [dirHandle]);

const handleSelectMap = useCallback(async (id) => {
  if (!dirHandle || !hasPermission) return;
  const foundMap = mapsList.find(m => m.id === id);
  if (!foundMap) return;
  
  if (currentMapId && currentMapId.startsWith('temp_') && loading) {
    const confirmLeave = window.confirm(
      "Deine KI-Generierung läuft noch. Wenn du diese temporäre Mindmap jetzt verlässt, wird sie unwiderruflich gelöscht. Möchtest du trotzdem fortfahren?"
    );
    if (!confirmLeave) return;
  }

  if (currentMapId && currentMapId.startsWith('temp_')) {
    localStorage.removeItem(`temp_map_data_${currentMapId}`);
  }

  // Direktzugriff über _currentFileName
  const fileHandle = await dirHandle.getFileHandle(`${foundMap._currentFileName}.json`);
  const file = await fileHandle.getFile();
  const text = await file.text();
  let parsedData = JSON.parse(text);
  
  let dataToLoad = parsedData;
  if (parsedData.rootNode || !parsedData.nodes) {
    dataToLoad = migrateTreeToFlat(parsedData);
  }
  
  undoStack.current = [];
  redoStack.current = [];
  previousStateRef.current = cloneState(dataToLoad);

  isSwitchingMapRef.current = true;
  isInitialLoad.current = false;

  localStorage.setItem('current_mindmap_id', id);

  setCurrentMapId(id);
  setMindmapData(dataToLoad);
  setIsSaved(true);
}, [dirHandle, hasPermission, mapsList, currentMapId, loading]);

  // Auto-Save & Zentraler Checkpoint-Effekt
  useEffect(() => {
  if (!dirHandle || !hasPermission || !mindmapData?.id) return;
  
  const isDifferentMap = previousStateRef.current && previousStateRef.current.id !== mindmapData.id;

  if (isSwitchingMapRef.current || isDifferentMap) {
    isSwitchingMapRef.current = false;
    previousStateRef.current = cloneState(mindmapData);
    setIsSaved(true);
    return;
  }

  // 2. Fallback für den allerersten Start der App
  if (isInitialLoad.current) { 
    isInitialLoad.current = false; 
    previousStateRef.current = cloneState(mindmapData);
    setIsSaved(true);
    return; 
  }

  if (isRenamingRef.current) { 
    isRenamingRef.current = false; 
    previousStateRef.current = cloneState(mindmapData);
    return; 
  }
  
  // Erkennung von strukturellen Änderungen
  let structureChanged = false;
  if (previousStateRef.current && previousStateRef.current.id === mindmapData.id) {
    const oldStructure = getStructuralSnapshot(previousStateRef.current);
    const newStructure = getStructuralSnapshot(mindmapData);

    if (JSON.stringify(oldStructure) !== JSON.stringify(newStructure)) {
      undoStack.current.push(cloneState(previousStateRef.current));
      redoStack.current = [];
      structureChanged = true;
    }
  }

  previousStateRef.current = cloneState(mindmapData);

  // Wenn es eine temporäre Map ist, sichern wir sie bei jeder Änderung im LocalStorage für Reloads
  if (mindmapData.id.startsWith('temp_')) {
    localStorage.setItem(`temp_map_data_${mindmapData.id}`, JSON.stringify(mindmapData));
  }

  // Auto-Save-Verzögerung
  setIsSaved(false);
  const delayDebounce = setTimeout(async () => {
  let currentDataToSave = { ...mindmapData };
  let transitioned = false;
  let realUniqueId = currentDataToSave.id;

  // 1. Aus temporär wird permanent bei einer Strukturänderung
  if (mindmapData.id.startsWith('temp_') && structureChanged) {
    realUniqueId = `map_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    currentDataToSave.id = realUniqueId;
    transitioned = true;
    
    // LocalStorage Reste aufräumen
    localStorage.removeItem(`temp_map_data_${mindmapData.id}`);
    const transitionStore = localStorage.getItem('mindmap_id_transitions');
    const transitions = transitionStore ? JSON.parse(transitionStore) : {};
    transitions[mindmapData.id] = realUniqueId;
    localStorage.setItem('mindmap_id_transitions', JSON.stringify(transitions));
    localStorage.setItem('current_mindmap_id', realUniqueId);
  }

  // Wenn noch temporär und keine Änderung vorliegt: Nicht auf die Festplatte schreiben
  if (currentDataToSave.id.startsWith('temp_')) {
    setIsSaved(true);
    return;
  }

  const dataToSave = {
    ...currentDataToSave,
    nodes: currentDataToSave.nodes.map(({ isNew, ...node }) => node)
  };
  if (dataToSave.name) delete dataToSave.name;

  // HIER: Übergabe der mapsList für deinen ID-Check
  const savedFileName = await saveMindmapToFile(
    dirHandle, 
    currentDataToSave._currentFileName, 
    dataToSave, 
    false, 
    mapsList
  );

  if (savedFileName) {
    setIsSaved(true);
    
    // WICHTIG: React-State sofort atomar mit neuer ID und neuem Dateinamen synchronisieren
    setMindmapData(prev => {
      if (!prev) return null;
      if (prev.id !== realUniqueId || prev._currentFileName !== savedFileName) {
        return { ...prev, id: realUniqueId, _currentFileName: savedFileName };
      }
      return prev;
    });

    if (transitioned || currentMapId !== realUniqueId) {
      setCurrentMapId(realUniqueId);
    }
    
    // Dateiliste in der Sidebar auffrischen
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
  }
}, 800);

  return () => clearTimeout(delayDebounce);
}, [mindmapData, dirHandle, hasPermission]);

  // Undo / Redo Ausführungs-Logik
const executeUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    
    const previousState = undoStack.current.pop();

    previousStateRef.current = cloneState(previousState);
    
    setMindmapData((currentLiveState) => {
      if (!currentLiveState) return currentLiveState;
      
      //isNew nicht mitspeichern
      const cleanedCurrentState = cloneState(currentLiveState);
      if (cleanedCurrentState.nodes) {
        cleanedCurrentState.nodes = cleanedCurrentState.nodes.map(({ isNew, ...node }) => node);
      }
      redoStack.current.push(cleanedCurrentState);
      
      return previousState;
    });
  }, []);

  const executeRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;

    const nextState = redoStack.current.pop();

    previousStateRef.current = cloneState(nextState);

    setMindmapData((currentLiveState) => {
      if (!currentLiveState) return currentLiveState;

      //isNew nicht mitspeichern
      const cleanedCurrentState = cloneState(currentLiveState);
      if (cleanedCurrentState.nodes) {
        cleanedCurrentState.nodes = cleanedCurrentState.nodes.map(({ isNew, ...node }) => node);
      }
      undoStack.current.push(cleanedCurrentState);

      return nextState;
    });
  }, []);

  // Event Listener für globale Shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDownShortcuts = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Aggressiver Schreibmodus-Schutz
      const targetTag = e.target.tagName.toLowerCase();
      if (
        targetTag === 'input' || 
        targetTag === 'textarea' || 
        e.target.isContentEditable ||
        e.target.classList.contains('node-textarea') ||
        e.target.closest('.nodrag') // Schützt Textareas in den Nodes direkt
      ) {
        return; 
      }

      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        executeUndo();
      } else if ((key === 'y' && !e.shiftKey) || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        executeRedo();
      }
    };

    // Aktiv im Bubble-Modus abfangen
    window.addEventListener('keydown', handleKeyDownShortcuts, true);
    return () => window.removeEventListener('keydown', handleKeyDownShortcuts, true);
  }, [executeUndo, executeRedo]);

const handleDeleteMap = useCallback(async (id) => {
  const foundMap = mapsList.find(m => m.id === id);
  if (!foundMap) return;
  
  const shouldDelete = confirmDelete 
    ? confirm(`Möchtest du '${foundMap._currentFileName}' wirklich löschen?`)
    : true;

  if (shouldDelete) {
    // Übergabe direkt über _currentFileName
    await deleteMindmapFile(dirHandle, foundMap._currentFileName);
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    if (mindmapData?.id === id) setMindmapData(null);
  }
}, [dirHandle, mapsList, mindmapData, confirmDelete]);

const handleRenameMap = useCallback(async (id, newName) => {
  if (!newName) return;
  const sanitizedNewName = newName.replace(/[\/?<>\\:*|"]/g, '').trim();
  if (!sanitizedNewName) return;

  const foundMap = mapsList.find(m => m.id === id);
  if (!foundMap || foundMap._currentFileName === sanitizedNewName) return;

  try {
    isRenamingRef.current = true;
    // Laden über den alten Dateinamen
    const fileHandle = await dirHandle.getFileHandle(`${foundMap._currentFileName}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    
    const updatedData = { ...data, _currentFileName: sanitizedNewName };
    if (updatedData.name) delete updatedData.name;
    
    // Unter neuem (eindeutigen) Namen speichern und alten Dateinamen entfernen
    await saveMindmapToFile(dirHandle, sanitizedNewName, updatedData, true);
    await deleteMindmapFile(dirHandle, foundMap._currentFileName);
    
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    
    if (mindmapData?.id === id) {
      const updatedFileInfo = files.find(f => f.id === id);
      setMindmapData({ ...updatedData, _currentFileName: updatedFileInfo?._currentFileName || sanitizedNewName });
    }
  } catch (error) { 
    console.error("Fehler beim Umbenennen der Mindmap:", error); 
  }
}, [dirHandle, mapsList, mindmapData]);

const handleCopyMap = useCallback(async (id) => {
  if (!dirHandle || !hasPermission) return;
  
  if (mindmapData && mindmapData.id === id) {
    setCopyMapData(mindmapData);
    setShowOverlay('copy');
    return;
  }
  
  const foundMap = mapsList.find(m => m.id === id);
  if (!foundMap) return;
  
  try {
    // Direktzugriff über _currentFileName
    const fileHandle = await dirHandle.getFileHandle(`${foundMap._currentFileName}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    let parsedData = JSON.parse(text);
    
    if (parsedData.rootNode || !parsedData.nodes) {
      parsedData = migrateTreeToFlat(parsedData);
    }
    
    setCopyMapData(parsedData);
    setShowOverlay('copy');
  } catch (error) {
    console.error("Fehler beim Laden der Mindmap-Daten für das Clipboard:", error);
    alert("Die Daten dieser Mindmap konnten nicht geladen werden.");
  }
}, [dirHandle, hasPermission, mapsList, mindmapData]);

  const handleToggleMode = () => setIsDark(prev => !prev);

  const setOverlayAPIKeyTutorial = useCallback(async (id) => {
    setShowOverlay('apiKeyTutorial');
  }, []);

async function expandMindmap(userInput, onFailure) {
  if (!mindmapData?._currentFileName) { 
    alert("Bitte wähle oder erstelle zuerst eine Mindmap in der linken Leiste!"); 
    return; 
  }

  // 1. Kontext zum Zeitpunkt des Abschickens einfrieren
  const targetMapId = mindmapData.id;
  const targetMapName = mindmapData._currentFileName;
  const currentNodesAtStart = [...mindmapData.nodes];
  const currentEdgesAtStart = [...mindmapData.edges];
  const currentPositionsAtStart = { ...mindmapData.positions };

  undoStack.current.push(cloneState(mindmapData));
  redoStack.current = [];

  setLoading(true);
  try {
    const currentToken = localStorage.getItem('mindmap_cooldown_token');

    const res = await fetch('/api/expandMindmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: currentNodesAtStart,
        edges: currentEdgesAtStart,
        positions: currentPositionsAtStart,
        selectedNodeIds: selectedNodeIds,
        userInput: userInput,
        userApiKey: userApiKey.trim(),
        cooldownToken: currentToken
      })
    });

    const responseText = await res.text();
    let data;
    try { 
      data = responseText ? JSON.parse(responseText) : {}; 
    } catch (e) { 
      throw new Error(`Ungültige Serverantwort (kein JSON): ${responseText.substring(0, 100)}...`); 
    }

    if (data.newToken || data._newToken) {
      localStorage.setItem('mindmap_cooldown_token', data.newToken || data._newToken);
    }
    
    if (!res.ok) throw new Error(data.error || `Serverfehler (${res.status}): ${res.statusText}`);
    
    const operations = data.operations || [];

    // 2. Reine Berechnungsfunktion, entkoppelt vom Live-State
    const calculateNewState = (oldNodes, oldEdges, oldPositions) => {
      let newNodes = [...oldNodes];
      let newEdges = [...oldEdges];
      const newPositions = { ...oldPositions };

      const addedOps = operations.filter(op => op.type === 'added');
      const addedCountsPerParent = {};
      const uniqueParents = [];

      addedOps.forEach(op => {
        if (!addedCountsPerParent[op.parentId]) {
          addedCountsPerParent[op.parentId] = 0;
          uniqueParents.push(op.parentId);
        }
        addedCountsPerParent[op.parentId]++;
      });

      uniqueParents.sort((a, b) => {
        const posXA = (newPositions[a] || { x: 0 }).x;
        const posXB = (newPositions[b] || { x: 0 }).x;
        return posXA - posXB;
      });

      const currentSiblingIndexPerParent = {};

      operations.forEach(op => {
        if (op.type === 'added') {
          const parentPos = newPositions[op.parentId] || { x: 0, y: 0 };
          const rootPos = newPositions['root'] || { x: 0, y: 0 };
          const gridSize = 15;
          
          if (currentSiblingIndexPerParent[op.parentId] === undefined) {
            currentSiblingIndexPerParent[op.parentId] = 0;
          }
          const currentIdx = currentSiblingIndexPerParent[op.parentId];
          currentSiblingIndexPerParent[op.parentId]++;

          const totalNodesForThisParent = addedCountsPerParent[op.parentId];
          const indexOffset = currentIdx - (totalNodesForThisParent - 1) / 2;
          
          const goLeft = parentPos.x < rootPos.x || (op.parentId === 'root' && currentIdx % 2 === 0);
          
          let newPos;
          if (op.x !== undefined && op.y !== undefined) {
            newPos = {
              x: Math.round(op.x / gridSize) * gridSize,
              y: Math.round(op.y / gridSize) * gridSize
            };
          } else {
            const siblingSpacingX = 240;
            let offsetX = goLeft ? -siblingSpacingX : siblingSpacingX;
            const offsetY = indexOffset * 80;

            newPos = {
              x: Math.round((parentPos.x + offsetX) / gridSize) * gridSize,
              y: Math.round((parentPos.y + offsetY) / gridSize) * gridSize
            };
          }

          newNodes.push({ id: op.temporaryId, label: op.label, status: 'added' });
          newPositions[op.temporaryId] = newPos;
          
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('reactflow-node-created', { detail: { nodeId: op.temporaryId } }));
            });
          });

        } else if (op.type === 'updated') {
          if (op.x !== undefined && op.y !== undefined) {
            const gridSize = 15;
            newPositions[op.nodeId] = {
              x: Math.round(op.x / gridSize) * gridSize,
              y: Math.round(op.y / gridSize) * gridSize
            };
          }
          
          const existingNode = oldNodes.find(n => n.id === op.nodeId);
          const isTextChange = existingNode && op.label && op.label !== existingNode.label;

          if (isTextChange) {
            newNodes = newNodes.map(node => 
              node.id === op.nodeId 
                ? { ...node, status: 'updated', oldLabel: node.label, label: op.label } 
                : node
            );
          } else {
            newNodes = newNodes.map(node => 
              node.id === op.nodeId && op.label 
                ? { ...node, status: 'updated', label: op.label } 
                : node
            );
          }
        } else if (op.type === 'deleted') {
          newNodes = newNodes.map(node => (node.id === op.nodeId && node.id !== 'root') ? { ...node, status: 'deleted' } : node);
        }
      });

      if (data.edgesToDelete && Array.isArray(data.edgesToDelete)) {
        newEdges = newEdges.filter(edge => 
          !data.edgesToDelete.some(delEdge =>
            (delEdge.source === edge.source && delEdge.target === edge.target) ||
            (delEdge.source === edge.target && delEdge.target === edge.source)
          )
        );
      }

      operations.forEach(op => {
        if (op.type === 'added') {
          const oriented = getOrientedEdge(op.parentId, op.temporaryId, newPositions);
          const exists = newEdges.some(e => 
            e.id === oriented.id || 
            (e.source === oriented.source && e.target === oriented.target) ||
            (e.source === oriented.target && e.target === oriented.source)
          );
          if (!exists) {
            newEdges.push(oriented);
          }
        }
      });

      if (data.edgesToAdd && Array.isArray(data.edgesToAdd)) {
        data.edgesToAdd.forEach(edgeOp => {
          const oriented = getOrientedEdge(edgeOp.source, edgeOp.target, newPositions);
          const exists = newEdges.some(e => 
            e.id === oriented.id || 
            (e.source === oriented.source && e.target === oriented.target) ||
            (e.source === oriented.target && e.target === oriented.source)
          );
          if (!exists) {
            newEdges.push(oriented);
          }
        });
      }

      newEdges = newEdges.map(edge => {
        const oriented = getOrientedEdge(edge.source, edge.target, newPositions);
        if (edge.id !== oriented.id) {
          return {
            ...edge,
            id: oriented.id,
            source: oriented.source,
            target: oriented.target
          };
        }
        return edge;
      });

      return { nodes: newNodes, edges: newEdges, positions: newPositions };
    };

    // 3. Neue Struktur berechnen
    const updatedStructures = calculateNewState(currentNodesAtStart, currentEdgesAtStart, currentPositionsAtStart);

    // 4. Prüfen, ob der Nutzer in der Zwischenzeit die Map gewechselt hat
    let mapWasChanged = false;
    let finalId = targetMapId;
    let transitioned = false;

    // Falls es eine temporäre Map war, wird sie JETZT permanent!
    if (targetMapId.startsWith('temp_')) {
      finalId = `map_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      transitioned = true;
      localStorage.removeItem(`temp_map_data_${targetMapId}`);
      localStorage.setItem('current_mindmap_id', finalId);
    }

    setMindmapData(prev => {
      if (!prev) return prev;
      if (prev.id === targetMapId) {
        return {
          ...prev,
          id: finalId,
          ...updatedStructures
        };
      } else {
        mapWasChanged = true; 
        return prev; 
      }
    });

    if (transitioned && !mapWasChanged) {
      setCurrentMapId(finalId);
    }

    // 5. AUSWERTUNG & FESTPLATTEN-SYNCHRONISATION
    if (!mapWasChanged) {
      // FALL A: Nutzer ist auf der Map geblieben
      const dataToSave = {
        id: finalId,
        _currentFileName: targetMapName,
        ...updatedStructures,
        nodes: updatedStructures.nodes.map(({ isNew, ...node }) => node)
      };

      // HIER: mapsList übergeben und geänderten Dateinamen abfangen
      const savedFileName = await saveMindmapToFile(dirHandle, targetMapName, dataToSave, false, mapsList);
      
      if (savedFileName) {
        setIsSaved(true);
        setMindmapData(prev => {
          if (!prev || prev.id !== finalId) return prev;
          return { ...prev, _currentFileName: savedFileName };
        });
        
        const files = await loadMindmapsFromDirectory(dirHandle);
        setMapsList(files);
      }

    } else {
      // FALL B: Nutzer hat die Map im Hintergrund gewechselt
      if (dirHandle && hasPermission) {
        try {
          const actualOldMap = mapsList.find(map => map.id === targetMapId);
          let correctName = targetMapName;

          if (actualOldMap) {
            correctName = actualOldMap._currentFileName;
          }

          let originalMapData = {
            id: finalId,
            _currentFileName: correctName,
            nodes: currentNodesAtStart,
            edges: currentEdgesAtStart,
            positions: currentPositionsAtStart
          };

          // Wenn es keine temporäre Map war, lesen wir den letzten Stand der Datei aus dem Ordner
          if (!targetMapId.startsWith('temp_')) {
            try {
              const fileHandle = await dirHandle.getFileHandle(`${correctName}.json`);
              const file = await fileHandle.getFile();
              const text = await file.text();
              originalMapData = JSON.parse(text);
            } catch (e) {
              console.warn("Konnte alte Datei im Hintergrund nicht lesen, nutze Startzustand", e);
            }
          }

          const dataToSave = {
            ...originalMapData,
            id: finalId,
            ...updatedStructures,
            nodes: updatedStructures.nodes.map(({ isNew, ...node }) => node)
          };

          // Sauberer Direktzugriff über korrekten Namen und mapsList
          await saveMindmapToFile(dirHandle, correctName, dataToSave, false, mapsList);
          
          const files = await loadMindmapsFromDirectory(dirHandle);
          setMapsList(files);
        } catch (fileError) {
          console.error("Fehler beim nachträglichen Speichern der Hintergrund-Map:", fileError);
        }
      }
    }

    setLoading(false);
  } catch (error) {
    console.error("Fehler beim Erweitern der Mindmap:", error);
    alert(`Fehler: ${error.message}`);
    if (onFailure) onFailure();
    setLoading(false);
  }
}

  useEffect(() => {
    const processDecisions = (nodeIdsArray, accepted) => {
      const applyDecisionsToFlat = (map) => {
        if (!map || !map.nodes) return map;
        let newNodes = [...map.nodes];
        let newEdges = [...(map.edges || [])];
        const newPositions = { ...(map.positions || {}) };
        const nodesToRemove = [];
        newNodes = newNodes.map(node => {
          if (nodeIdsArray.includes(node.id)) {
            if (accepted) {
              if (node.status === 'deleted') {
                if (node.id !== 'root') { nodesToRemove.push(node.id); return null; }
                return { ...node, status: null };
              }
              return { ...node, status: null, oldLabel: undefined };
            } else {
              if (node.status === 'added') {
                if (node.id !== 'root') { nodesToRemove.push(node.id); return null; }
                return node;
              }
              if (node.status === 'updated') return { ...node, label: node.oldLabel || node.label, status: null, oldLabel: undefined };
              return { ...node, status: null };
            }
          }
          return node;
        }).filter(Boolean);
        if (nodesToRemove.length > 0) {
          newEdges = newEdges.filter(edge => !nodesToRemove.includes(edge.source) && !nodesToRemove.includes(edge.target));
          nodesToRemove.forEach(id => delete newPositions[id]);
        }
        return { ...map, nodes: newNodes, edges: newEdges, positions: newPositions };
      };
      setMindmapData(prev => prev ? applyDecisionsToFlat(prev) : prev);
      setMapsList(prevList => prevList.map(map => applyDecisionsToFlat(map)));
    };
    const handleSingle = (e) => processDecisions([e.detail.nodeId], e.detail.accepted);
    const handleBulk = (e) => processDecisions(e.detail.nodeIds, e.detail.accepted);
    window.addEventListener('proposalDecision', handleSingle);
    window.addEventListener('bulkProposalDecision', handleBulk);
    return () => {
      window.removeEventListener('proposalDecision', handleSingle);
      window.removeEventListener('bulkProposalDecision', handleBulk);
    };
  }, []);

  const eventHandlersRef = useRef({});
  eventHandlersRef.current = {
    handleLiveLabel: (e) => handleUpdateSelectedNodes('label', e.detail.value, e.detail.nodeId),
    handleNodeDelete: (e) => handleDeleteNodes(e.detail.nodeIds),
    handleEdgeDelete: (e) => handleDeleteEdges(e.detail.edgeIds),
    handleNodeCreate: (e) => handleCreateNode(e.detail.position, e.detail.parentId),
  };

  useEffect(() => {
    const trigger = (name) => (e) => {
      return eventHandlersRef.current[name]?.(e);
    };
    const onLiveLabel = trigger('handleLiveLabel');
    const onNodeDelete = trigger('handleNodeDelete');
    const onEdgeDelete = trigger('handleEdgeDelete');
    const onNodeCreate = trigger('handleNodeCreate');
    window.addEventListener('reactflow-live-label', onLiveLabel);
    window.addEventListener('reactflow-nodes-delete', onNodeDelete);
    window.addEventListener('reactflow-edges-delete', onEdgeDelete);
    window.addEventListener('reactflow-node-create', onNodeCreate);
    return () => {
      window.removeEventListener('reactflow-live-label', onLiveLabel);
      window.removeEventListener('reactflow-nodes-delete', onNodeDelete);
      window.removeEventListener('reactflow-edges-delete', onEdgeDelete);
      window.removeEventListener('reactflow-node-create', onNodeCreate);
    };
  }, []);

  const handleCreateNode = useCallback((position, parentId) => {
    const newNodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newNode = { id: newNodeId, label: 'Meine Idee...', isNew: true };
    setMindmapData((prev) => {
      if (!prev) return prev;
      const newNodes = [...(prev.nodes || []), newNode];
      const newEdges = [...(prev.edges || [])];
      if (parentId) newEdges.push({ id: `e-${parentId}-${newNodeId}`, source: parentId, target: newNodeId });
      const newPositions = { ...prev.positions };
      newPositions[newNodeId] = position;
      return { ...prev, nodes: newNodes, edges: newEdges, positions: newPositions };
    });
  }, []);

  const handleDeleteNodes = useCallback((nodeIds) => {
    const filteredIds = nodeIds.filter(id => id !== 'root');
    if (filteredIds.length === 0) return;
    setMindmapData((prev) => {
      if (!prev) return prev;
      const newNodes = (prev.nodes || []).filter(node => !filteredIds.includes(node.id));
      const newEdges = (prev.edges || []).filter(edge => !filteredIds.includes(edge.source) && !filteredIds.includes(edge.target));
      const newPositions = { ...prev.positions };
      filteredIds.forEach(id => delete newPositions[id]);
      return { ...prev, nodes: newNodes, edges: newEdges, positions: newPositions };
    });
  }, []);

const handleUpdateSelectedNodes = useCallback((field, value, targetNodeId = null) => {
    // 1. Custom Event für die Live-Anzeige / React Flow UI feuern
    window.dispatchEvent(new CustomEvent('reactflow-update-nodes-data', {
      detail: { nodeIds: targetNodeId ? [targetNodeId] : selectedNodeIds, field, value }
    }));

    // 2. Persistenten Mindmap-State aktualisieren
    if (field === 'label') {
      if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);

      labelDebounceRef.current = setTimeout(() => {
        setMindmapData((prev) => {
          if (!prev) return prev;
          const newNodes = (prev.nodes || []).map(node => {
            const match = targetNodeId ? node.id === targetNodeId : selectedNodeIds.includes(node.id);
            if (match) return { ...node, label: value };
            return node;
          });
          return { ...prev, nodes: newNodes };
        });
      }, 300);
    } else {
      // Behandelt borderColor, height und andere Node-Eigenschaften direkt
      setMindmapData((prev) => {
        if (!prev) return prev;
        const newNodes = (prev.nodes || []).map(node => {
          const match = targetNodeId ? node.id === targetNodeId : selectedNodeIds.includes(node.id);
          if (match) {
            const updatedNode = { ...node };
            
            if (field === 'borderColor') updatedNode.borderColor = value;
            
            // NEU: Zuweisung der dynamischen Höhe an das persistente Node-Objekt
            if (field === 'height') updatedNode.height = value; 
            
            return updatedNode;
          }
          return node;
        });
        return { ...prev, nodes: newNodes };
      });
    }
  }, [selectedNodeIds]);

  const handleDeleteEdges = useCallback((edgeIds) => {
    if (!edgeIds || edgeIds.length === 0) return;

    setMindmapData((prev) => {
      if (!prev) return prev;
      const newEdges = (prev.edges || []).filter(edge => !edgeIds.includes(edge.id));
      return { ...prev, edges: newEdges };
    });
  }, []);

const deleteSelectedNodes = useCallback(() => {
  const includesRoot = selectedNodeIds.includes('root');

  const filteredIds = selectedNodeIds.filter(id => id !== 'root');
  
  if (includesRoot) {
    alert('Der Hauptknoten kann nicht gelöscht werden!');
  }

  if (filteredIds.length === 0) return;

  handleDeleteNodes(filteredIds);

  window.dispatchEvent(
    new CustomEvent('reactflow-nodes-delete', { 
      detail: { nodeIds: filteredIds } 
    })
  );
}, [selectedNodeIds, handleDeleteNodes]);

return (
    <div
      className='app-container'
      onContextMenu={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        position: 'relative',
        flex: '1 1 auto',
        width: '100vw',
        /* KORREKTUR: dvh sorgt dafür, dass die Leiste über den Handytasten schwebt */
        height: '100dvh',
        overflow: 'hidden'
      }}
    >
      <Analytics/>
      {loading && <style>{`* { cursor: wait !important; }`}</style>}
      <SidebarLeft
        dirName={dirHandle?.name}
        onSelectDir={handleSelectDirectory}
        maps={mapsList}
        currentMap={currentMapId}
        onSelectMap={handleSelectMap}
        onDeleteMap={handleDeleteMap}
        onRenameMap={handleRenameMap}
        onCreateMap={handleCreateMap}
        confirmDelete={confirmDelete}
        onConfirmDeleteChange={setConfirmDelete}
        isSaved={isSaved}
        hasPermission={hasPermission}
        userApiKey={userApiKey}
        onUserApiKeyChange={setUserApiKey}
        userPickedAccentColor={userPickedAccentColor}
        setUserPickedAccentColor={setUserPickedAccentColor}
        currentmode={isDark ? 'dark' : 'light'}
        onToggleMode={handleToggleMode}
        onCopyMap={handleCopyMap}
        setOverlayAPIKeyTutorial={setOverlayAPIKeyTutorial}
        isOverlayOpen={!!showOverlay}
      />
      <div
        className='middle-content-container'
        style={{
          flex: '1 1 auto', /* Erlaubt dynamisches Mitwachsen */
          minWidth: 'var(--mid-min-width, 240px)',
          padding: 'var(--container-padding, 30px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <header
          id='header_KI_Mindmap' 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            padding: 'var(--header-padding, 0px)' /* Hält Text auf Handys auf Abstand */
          }}>
          <div>{!mindmapData?._currentFileName && <h1>KI Mindmap</h1>}</div>
        </header>
        {mindmapData ? (
          <MindmapBoard
            rawData={mindmapData}
            setMindmapData={setMindmapData}
            currentFileName={mindmapData?._currentFileName}
            currentMapId={currentMapId}
            positions={mindmapData.positions}
            onNodesSelect={setSelectedNodeIds}
            selectedNodeIds={selectedNodeIds}
            isViewReady={isViewReady}
            setIsViewReady={setIsViewReady}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--code-bg)', borderRadius: '12px', border: '1px dashed var(--border)', marginTop: '16px' }}>
            {dirHandle && hasPermission
              ? 'Wähle links eine Mindmap aus oder erstelle eine neue.'
              : !hasPermission && dirHandle
                ? 'Erteile die Berechtigung, um deine Mindmaps zu laden.'
                : 'Wähle einen Ordner zum Speichern der Mindmaps aus.'}
          </div>
        )}
        <Eingabeleiste
          loading={loading}
          expandMindmap={expandMindmap}
          selectedNodeIds={selectedNodeIds}
          mindmapData={mindmapData}
        />
      </div>
      <SidebarRight
        mindmapData={mindmapData}
        selectedNodeIds={selectedNodeIds}
        onUpdateNodes={handleUpdateSelectedNodes}
        onDeleteSelected={deleteSelectedNodes}
      />
      <Overlay
        type={showOverlay}
        onClose={() => {
          setShowOverlay(null);
          setCopyMapData(null);
        }}
        nodes={copyMapData?.nodes || []}
        mindmapData={copyMapData}
      />
    </div>
  );
}

export default App;