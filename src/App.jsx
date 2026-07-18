import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Analytics } from "@vercel/analytics/react";
import { MindmapBoard } from './MindmapBoard';
import { Eingabeleiste } from './Eingabeleiste';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
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

function App() {
  console.log("App Component Render");
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
    return savedColors ? JSON.parse(savedColors) : { light: '#aa3bff', dark: '#c084fc' };
  });
  const [confirmDelete, setConfirmDelete] = useState(true);
  const [isEdgeSelectMode, setIsEdgeSelectMode] = useState(false);
  const labelDebounceRef = useRef(null);
  

  // Akzentfarbe ändern
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

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
    const currentMode = isDark ? 'dark' : 'light';
    const activeColor = userPickedAccentColor[currentMode];
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
    return () => {
      if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    async function initSavedDirectory() {
      // 1. Alle asynchronen Daten im Hintergrund sammeln
      const savedHandle = await getStoredDirectoryHandle();
      if (!savedHandle) return;

      const status = await savedHandle.queryPermission({ mode: 'readwrite' });
      
      if (status === 'granted') {
        const files = await loadMindmapsFromDirectory(savedHandle);
        
        setDirHandle(savedHandle);
        setHasPermission(true);
        setMapsList(files);
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

  const handleCreateMap = useCallback(async () => {
    if (!dirHandle) return;
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const defaultName = 'Neue Mindmap';
    const initialData = {
      id: uniqueId,
      name: defaultName,
      _currentFileName: '',
      lastChanged: Date.now(),
      date: Date.now(),
      nodes: [{
        id: 'root',
        label: defaultName,
        isRootNode: true
      }],
      edges: [],
      positions: {
        'root': { x: 0, y: 0 }
      } 
    };
    await saveMindmapToFile(dirHandle, defaultName, initialData, false);
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    const fileInfo = files.find(f => f.id === uniqueId);
    setMindmapData({ ...initialData, _currentFileName: fileInfo?.name || defaultName });
    setIsSaved(true);
  }, [dirHandle]);

  const handleSelectMap = useCallback(async (id) => {
    if (!dirHandle || !hasPermission) return;
    const foundMap = mapsList.find(m => m.id === id);
    if(!foundMap) return;
    const fileHandle = await dirHandle.getFileHandle(`${foundMap.name}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsedData = JSON.parse(text);
    let dataToLoad = parsedData;
    if (dataToLoad.rootNode || !dataToLoad.nodes) {
      dataToLoad = migrateTreeToFlat(dataToLoad);
    }
    isInitialLoad.current = true;
    setMindmapData(dataToLoad);
    setIsSaved(true);
  }, [dirHandle, hasPermission, mapsList]);

const [justCreatedNodeId, setJustCreatedNodeId] = useState(null);

// 5. Auto-Save-Effekt
  useEffect(() => {
    if (!dirHandle || !hasPermission || !mindmapData?.id) return;
    if(isInitialLoad.current){ isInitialLoad.current = false; return; }
    if (isRenamingRef.current) { isRenamingRef.current = false; return; }
    
    setIsSaved(false);
    const delayDebounce = setTimeout(async () => {
      await saveMindmapToFile(dirHandle, mindmapData.name, mindmapData, false);
      setIsSaved(true);
      // Maps-Liste aktualisieren, damit die Sortierung in der Sidebar (nach Datum) aktuell bleibt
      const files = await loadMindmapsFromDirectory(dirHandle);
      setMapsList(files);
    }, 800);
    return () => clearTimeout(delayDebounce);
  }, [mindmapData, dirHandle, hasPermission]);

const handleDeleteMap = useCallback(async (id) => {
  const foundMap = mapsList.find(m => m.id === id);
  if (!foundMap) return;
  
  const shouldDelete = confirmDelete 
    ? confirm(`Möchtest du '${foundMap.name}' wirklich löschen?`)
    : true;

  if (shouldDelete) {
    await deleteMindmapFile(dirHandle, foundMap.name);
    const files = await loadMindmapsFromDirectory(dirHandle);
    setMapsList(files);
    if (mindmapData?.id === id) setMindmapData(null);
  }
}, [dirHandle, mapsList, mindmapData, confirmDelete]);

  const handleRenameMap = useCallback(async (id, newName) => {
    if (!newName) return;
    const foundMap = mapsList.find(m => m.id === id);
    if (!foundMap || foundMap.name === newName) return;
    try {
      isRenamingRef.current = true;
      const fileHandle = await dirHandle.getFileHandle(`${foundMap.name}.json`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      const updatedData = { ...data, name: newName };
      await saveMindmapToFile(dirHandle, newName, updatedData, true);
      await deleteMindmapFile(dirHandle, foundMap.name);
      const files = await loadMindmapsFromDirectory(dirHandle);
      setMapsList(files);
      if (mindmapData?.id === id) {
        const updatedFileInfo = files.find(f => f.id === id);
        setMindmapData({ ...updatedData, _currentFileName: updatedFileInfo?.name || newName });
      }
    } catch (error) { console.error("Fehler beim Umbenennen der Mindmap:", error); } 
    finally { isRenamingRef.current = false; }
  }, [dirHandle, mapsList, mindmapData]);

  async function expandMindmap(userInput, onFailure) {
    if (!mindmapData?.name) { alert("Bitte wähle oder erstelle zuerst eine Mindmap in der linken Leiste!"); return; }
    const targetMapId = mindmapData.id;
    setLoading(true);
    try {
      const res = await fetch('/api/expandMindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: mindmapData.nodes, edges: mindmapData.edges, selectedNodeIds: selectedNodeIds,
          userInput: userInput, userApiKey: userApiKey.trim()
        })
      });
      const responseText = await res.text();
      let data;
      try { data = responseText ? JSON.parse(responseText) : {}; } catch (e) { throw new Error(`Ungültige Serverantwort (kein JSON): ${responseText.substring(0, 100)}...`); }
      if (!res.ok) throw new Error(data.error || `Serverfehler (${res.status}): ${res.statusText}`);
      const operations = data.operations || [];
      setMindmapData(prev => {
        if (!prev || prev.id !== targetMapId) return prev;
        let newNodes = [...(prev.nodes || [])];
        let newEdges = [...(prev.edges || [])];
        const newPositions = { ...(prev.positions || {}) };
        
        operations.forEach(op => {
          if (op.type === 'added') {
            const parentPos = newPositions[op.parentId] || { x: 0, y: 0 };
            const gridSize = 15;
            
            // Zufälliger Versatz in der Nähe des Elternknotens
            const offsetX = 240; // Rechts vom Elternteil
            const offsetY = (Math.random() - 0.5) * 200; // Leicht versetzt nach oben/unten
            
            const newPos = {
              x: Math.round((parentPos.x + offsetX) / gridSize) * gridSize,
              y: Math.round((parentPos.y + offsetY) / gridSize) * gridSize
            };
            
            newNodes.push({ id: op.temporaryId, label: op.label, status: 'added' });
            newEdges.push({ id: `e-${op.parentId}-${op.temporaryId}`, source: op.parentId, target: op.temporaryId });
            newPositions[op.temporaryId] = newPos;
            
            // Sofort-Edit auch für KI-Knoten (optional, hier aktiviert)
            setTimeout(() => { 
              window.dispatchEvent(new CustomEvent('reactflow-node-created', { detail: { nodeId: op.temporaryId } })); 
            }, 100);
          } else if (op.type === 'updated') {
            newNodes = newNodes.map(node => node.id === op.nodeId ? { ...node, status: 'updated', oldLabel: node.label, label: op.label } : node);
          } else if (op.type === 'deleted') {
            newNodes = newNodes.map(node => (node.id === op.nodeId && node.id !== 'root') ? { ...node, status: 'deleted' } : node);
          }
        });
        return { ...prev, nodes: newNodes, edges: newEdges, positions: newPositions };
      });
      setMapsList(prevList => prevList.map(map => map.id === targetMapId ? { ...map, date: Date.now() } : map));
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
    handleNodeInitialized: (e) => {
      setMindmapData((prev) => {
        if (!prev) return prev;
        const newNodes = (prev.nodes || []).map(node => node.id === e.detail.nodeId ? { ...node, isNew: false } : node);
        return { ...prev, nodes: newNodes };
      });
    }
  };

  useEffect(() => {
    const trigger = (name) => (e) => {
      if (name === 'handleNodeInitialized') {
        setJustCreatedNodeId(prev => prev === e.detail.nodeId ? null : prev);
      }
      return eventHandlersRef.current[name]?.(e);
    };
    const onLiveLabel = trigger('handleLiveLabel');
    const onNodeDelete = trigger('handleNodeDelete');
    const onEdgeDelete = trigger('handleEdgeDelete');
    const onNodeCreate = trigger('handleNodeCreate');
    const onNodeInit = trigger('handleNodeInitialized');
    window.addEventListener('reactflow-live-label', onLiveLabel);
    window.addEventListener('reactflow-nodes-delete', onNodeDelete);
    window.addEventListener('reactflow-edges-delete', onEdgeDelete);
    window.addEventListener('reactflow-node-create', onNodeCreate);
    window.addEventListener('reactflow-node-initialized', onNodeInit);
    return () => {
      window.removeEventListener('reactflow-live-label', onLiveLabel);
      window.removeEventListener('reactflow-nodes-delete', onNodeDelete);
      window.removeEventListener('reactflow-edges-delete', onEdgeDelete);
      window.removeEventListener('reactflow-node-create', onNodeCreate);
      window.removeEventListener('reactflow-node-initialized', onNodeInit);
    };
  }, []);

  const handleCreateNode = useCallback((position, parentId) => {
    const newNodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newNode = { id: newNodeId, label: 'Neuer Knoten' };
    setJustCreatedNodeId(newNodeId);
    setMindmapData((prev) => {
      if (!prev) return prev;
      const newNodes = [...(prev.nodes || []), newNode];
      const newEdges = [...(prev.edges || [])];
      if (parentId) newEdges.push({ id: `e-${parentId}-${newNodeId}`, source: parentId, target: newNodeId });
      const newPositions = { ...prev.positions };
      newPositions[newNodeId] = position;
      return { ...prev, nodes: newNodes, edges: newEdges, positions: newPositions };
    });
    setTimeout(() => { window.dispatchEvent(new CustomEvent('reactflow-node-created', { detail: { nodeId: newNodeId } })); }, 50);
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
    window.dispatchEvent(new CustomEvent('reactflow-update-nodes-data', {
      detail: { nodeIds: targetNodeId ? [targetNodeId] : selectedNodeIds, field, value }
    }));

    if (field === 'label') {
      // Bestehenden Timer löschen, falls der Nutzer weitertippt
      if (labelDebounceRef.current) clearTimeout(labelDebounceRef.current);

      // Erst nach 300ms Inaktivität wird der globale Zustand aktualisiert
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
      // Andere UI-Änderungen (wie z.B. borderColor) direkt ohne Verzögerung durchreichen
      setMindmapData((prev) => {
        if (!prev) return prev;
        const newNodes = (prev.nodes || []).map(node => {
          const match = targetNodeId ? node.id === targetNodeId : selectedNodeIds.includes(node.id);
          if (match) {
            const updatedNode = { ...node };
            if (field === 'borderColor') updatedNode.borderColor = value;
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

      // Nur die Kanten herausfiltern, deren ID in der Löschliste steht
      const newEdges = (prev.edges || []).filter(edge => !edgeIds.includes(edge.id));

      return { 
        ...prev, 
        edges: newEdges 
      };
    });
  }, []);

  // =================================== RETURN =======================================
  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ display: 'flex', position: 'relative', flex: '1 1 auto', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Analytics/>
      {loading && <style>{`* { cursor: wait !important; }`}</style>}
      <SidebarLeft 
        dirName={dirHandle?.name}
        onSelectDir={handleSelectDirectory}
        maps={mapsList}
        currentMap={mindmapData?.id || ''}
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
        currentMode={isDark ? 'dark' : 'light'}
      />
      <div style={{ flex: '1 1 20%', minWidth: '240px', padding: '30px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>{!mindmapData?.name && <h1>KI Mindmap Studio</h1>}</div>
        </header>
        {mindmapData ? (
          <MindmapBoard 
            rawData={mindmapData}
            setMindmapData={setMindmapData}
            currentFileName={mindmapData?.name}
            positions={mindmapData.positions} 
            onNodesSelect={setSelectedNodeIds}
            selectedNodeIds={selectedNodeIds}
            justCreatedNodeId={justCreatedNodeId}
            isEdgeSelectMode={isEdgeSelectMode}
            setIsEdgeSelectMode={setIsEdgeSelectMode}
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
        <Eingabeleiste
          loading={loading}
          expandMindmap={expandMindmap}
          selectedNodeIds={selectedNodeIds}
          mindmapData={mindmapData}
          isEdgeSelectMode={isEdgeSelectMode}
        />
      </div>
      <SidebarRight
        selectedNodeIds={selectedNodeIds}
        onUpdateNodes={handleUpdateSelectedNodes}
        isEdgeSelectMode={isEdgeSelectMode}
        setIsEdgeSelectMode={setIsEdgeSelectMode}
      />
    </div>
  );
}

export default App;
