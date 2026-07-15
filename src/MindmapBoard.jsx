import { useEffect, useState, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls,
  MiniMap,
  useNodesState, 
  useEdgesState,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLayoutedElements } from './utils/layout';
import { Check, X } from 'lucide-react';

const nodeTypes = {
  default: EditableMindmapNode,
  proposalNode: EditableMindmapNode
};

function EditableMindmapNode({ id, data, isConnectable, selected }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data.label || '');
  const inputRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setValue(data.label || '');
  }, [data.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const saveChange = () => {
    setIsEditing(false);
    if (value.trim() !== '' && value !== data.label) {
      if (data.onLabelChange) {
        data.onLabelChange(id, value);
      }
    } else {
      setValue(data.label || '');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveChange();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setValue(data.label || '');
    }
  };

  const handleBlur = () => {
    saveChange();
  };

  const handleDecision = (accepted) => {
    window.dispatchEvent(new CustomEvent('proposalDecision', {
      detail: { nodeId: id, accepted }
    }));
  };

  const isProposal = !!data.status;
  const nodeRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const [currentWidth, setCurrentWidth] = useState(data.width || 200);

  const calculateWidthLimits = () => {
    if (!nodeRef.current) return { min: 150, max: 600 };

    const labelDiv = nodeRef.current.querySelector(".node-label");
    if (!labelDiv) return { min: 150, max: 600 };

    const words = (data.label || '').split(/\s+/);
    const longestWord = words.reduce((max, word) => word.length > max.length ? word : max, "");

    // 1. Mindestbreite (Längstes Wort + Padding)
    const tempSpan = document.createElement("span");
    tempSpan.style.position = "absolute";
    tempSpan.style.visibility = "hidden";
    tempSpan.style.whiteSpace = "nowrap";
    tempSpan.style.fontFamily = getComputedStyle(labelDiv).fontFamily;
    tempSpan.style.fontSize = getComputedStyle(labelDiv).fontSize;
    tempSpan.textContent = longestWord;
    document.body.appendChild(tempSpan);
    const minWidth = tempSpan.offsetWidth + 40; // Genug Puffer für Padding
    document.body.removeChild(tempSpan);

    // 2. Maximale Breite (Der gesamte Text in EINER Zeile, ohne Umbruch)
    const tempSpanFull = document.createElement("span");
    tempSpanFull.style.position = "absolute";
    tempSpanFull.style.visibility = "hidden";
    tempSpanFull.style.whiteSpace = "nowrap"; // Verhindert den Umbruch beim Messen der Max-Breite!
    tempSpanFull.style.fontFamily = getComputedStyle(labelDiv).fontFamily;
    tempSpanFull.style.fontSize = getComputedStyle(labelDiv).fontSize;
    tempSpanFull.textContent = data.label || '';
    document.body.appendChild(tempSpanFull);
    const maxWidth = tempSpanFull.offsetWidth + 40;
    document.body.removeChild(tempSpanFull);

    // Grenzen auf ein Vielfaches von 15px runden für perfektes Snapping
    const snapMin = Math.max(Math.ceil(minWidth / 15) * 15, 150);
    const snapMax = Math.max(Math.ceil(maxWidth / 15) * 15, 600); // Erhöht auf 600 für mehr Spielraum

    return { min: snapMin, max: snapMax };
  };

  const resizeRef = useRef({ startX: 0, startWidth: 0, min: 150, max: 600, finalWidth: 200 });

  const doResize = (moveEvent) => {
    const { startX, startWidth, min, max } = resizeRef.current;
    const deltaX = moveEvent.clientX - startX;
    const rawWidth = startWidth + deltaX;
    const snappedWidth = Math.round(rawWidth / 15) * 15;
    const finalWidth = Math.min(max, Math.max(min, snappedWidth));
    
    resizeRef.current.finalWidth = finalWidth;

    window.dispatchEvent(new CustomEvent('nodeResize', { 
      detail: { nodeId: id, width: finalWidth, isDragging: true } 
    }));
  };

  const stopResizing = () => {
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResizing);

    const finalWidth = resizeRef.current.finalWidth;
    setCurrentWidth(finalWidth);

    window.dispatchEvent(new CustomEvent('nodeResize', { 
      detail: { nodeId: id, width: finalWidth, isDragging: false } 
    }));
  };

  const startResizing = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const { min, max } = calculateWidthLimits();
    
    resizeRef.current = {
      startX: e.clientX,
      startWidth: currentWidth,
      min,
      max,
      finalWidth: currentWidth
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResizing);
  };

  // Synchronisiert die lokale Breite, falls sie sich von außen ändert
  useEffect(() => {
    setCurrentWidth(data.width || 200);
    if (nodeRef.current) {
      nodeRef.current.style.width = `${data.width || 200}px`;
    }
  }, [data.width]);

  // Dynamische Styles basierend auf den von convertTreeToFlow übergebenen Werten
  const isRootNode = data.isRootNode;
  const borderColor = selected || isHovered
    ? 'var(--accent)' 
    : (data.borderColor || 'var(--default-node-border)');
  const backgroundColor = data.backgroundColor || 'transparent';

  return (
    <div 
      ref={nodeRef}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: '100%', // Füllt den äußeren Wrapper perfekt aus
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '10px 15px', // Padding jetzt direkt hier für sauberen Text-Abstand
        boxSizing: 'border-box',
        background: backgroundColor,
        color: 'var(--text-h)',
        border: isRootNode ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
        borderRadius: '8px',
        fontWeight: isRootNode ? '800' : 'normal',
        fontSize: isRootNode ? '16px' : '14px',
        boxShadow: selected ? '0 0 0 2px var(--accent)' : 'none',
        cursor: isEditing ? 'text' : 'grab',
        transition: 'border-color 0.1s ease, box-shadow 0.3s ease',
      }}
    >
      {isProposal && (
        <div style={{
          position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
          background: 'none', border: 'none',
          padding: '4px', display: 'flex', gap: '6px', fontSize: '12px',
          zIndex: 100
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); handleDecision(true); }}
            style={{ 
              border: '1px solid var(--accent)', 
              background: 'var(--default-node-border)',
              boxShadow: '0 8px 10px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              width: '32px',
              height: '32px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(110, 185, 139)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--default-node-border)';
            }}
          >
            <Check size={15} strokeWidth={2.5}/>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDecision(false); }}
            style={{ 
              border: '1px solid var(--accent)', 
              background: 'var(--default-node-border)',
              boxShadow: '0 8px 10px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              width: '32px',
              height: '32px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(163, 82, 82)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--default-node-border)';
            }}
          >
            <X size={15} strokeWidth={2.5}/>
          </button>
        </div>
      )}

      {/* Symmetrische Handles direkt an den Außenkanten (ohne Verschiebung durch Padding) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable} 
        style={{ opacity: 1, top: '-2px' }} 
      />

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {data.status === 'updated' && data.oldLabel && (
          <div style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, marginBottom: '2px' }}>
            {data.oldLabel}
          </div>
        )}
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: 0,
              margin: 0,
              width: '100%',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              color: 'inherit',
              textAlign: 'center',
              resize: 'none',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            rows={1}
          />
        ) : (
          <div className="node-label" style={{ 
            wordBreak: 'break-word', 
            textAlign: 'center',
            fontWeight: isProposal ? '600' : 'normal',
            textDecoration: data.status === 'deleted' ? 'line-through' : 'none',
            opacity: data.status === 'deleted' ? 0.8 : 1
          }}>
            {data.label}
          </div>
        )}
      </div>

      {/* Der Zieh-Balken liegt jetzt exakt über dem rechten Rand */}
      <div 
        ref={resizeHandleRef}
        onMouseDown={startResizing}
        className="nodrag"
        style={{
          position: 'absolute',
          right: '-2px', // Schiebt ihn minimal nach außen über den echten Rahmen
          top: 0,
          height: '100%',
          width: '10px',
          cursor: 'ew-resize',
          zIndex: 999,
        }}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable} 
        style={{ opacity: 1, bottom: '-2px' }} 
      />
    </div>
  );
}

 
// Diese Funktion verwandelt das verschachtelte KI-JSON rekursiv in flache React-Flow-Daten
function convertTreeToFlow(node, parentId = null, elements = { nodes: [], edges: [] }) {
  if (!node) return elements;

  // VERHINDERT DUBLETTEN: Falls der Knoten bereits existiert, überspringen
  if (elements.nodes.some(n => n.id === node.id)) {
    return elements;
  }

  let borderColor = node.borderColor || 'var(--default-node-border)';
  let backgroundColor = node.borderColor && node.borderColor !== 'var(--default-node-border)'
    ? `${borderColor}40`
    : `color-mix(in srgb, var(--default-node-border) 25%, transparent)`;
  let edgeStyle = { stroke: 'var(--text)' };
  let edgeAnimated = false;

  const isProposal = !!node.status;

  // Farb- und Stylingzuordnung basierend auf dem Knoten-Status
    if (node.status === 'updated') {
      borderColor = '#eedf59';
      backgroundColor = 'rgba(243, 246, 59, 0.15)';
    } else if (node.status === 'deleted') {
      borderColor = '#ef4444';
      backgroundColor = 'rgba(239, 68, 68, 0.15)';
      edgeStyle = { stroke: '#ef4444', strokeDasharray: '5,5' };
    } else if (node.status === 'added') {
      borderColor = '#22c55e';
      backgroundColor = 'rgba(34, 197, 94, 0.15)';
      edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
      edgeAnimated = true;
    }

    const isRootNode = node.id === 'root';

    elements.nodes.push({
      id: node.id,
      type: !!node.status ? 'proposalNode' : 'default',
      data: { 
        label: node.label, 
        status: node.status, 
        oldLabel: node.oldLabel,
        isRootNode: isRootNode,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        onLabelChange: (nodeId, newValue) => {
          window.dispatchEvent(new CustomEvent('reactflow-live-label', {
            detail: { nodeId, value: newValue }
          }));
        },
        width: node.width || 200, // Standardbreite von 200px
      },
      position: { x: 0, y: 0 },
      style: {
        width: node.width || 200,
        background: 'none',
        border: 'none',
        padding: 0,
        boxShadow: 'none',
      },
    });

    if (parentId) {
    const edgeId = `e-${parentId}-${node.id}`;
    if (!elements.edges.some(e => e.id === edgeId)) {
      elements.edges.push({
        id: edgeId,
        source: parentId,
        target: node.id,
        style: edgeStyle,
        animated: edgeAnimated
      });
    }
  }

  // Rekursiv die echten Kinder im Baum weiterverarbeiten
  if (node.children) {
    node.children.forEach(child => convertTreeToFlow(child, node.id, elements));
  }

  return elements;
}

function MindmapBoardContent({ rawData, currentFileName, positions, setMindmapData, onNodesSelect, selectedNodeIds = [] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getViewport, setViewport, getNodes, fitView, screenToFlowPosition } = useReactFlow();

  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // useEffect(() => {
  // if (!currentFileName) return;

  // const timer = setTimeout(() => {
  //   if (typeof fitView === 'function') {
  //     fitView({ padding: 0.2, duration: 0 });
  //   }
  // }, 50);

  //   return () => clearTimeout(timer);
  // }, [currentFileName, fitView]);

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

useEffect(() => {
    if (!rawData) return;

    const elements = { nodes: [], edges: [] };

    convertTreeToFlow(rawData.rootNode, null, elements);

    if (rawData.floatingNodes) {
      rawData.floatingNodes.forEach(floatingNode => {
        convertTreeToFlow(floatingNode, null, elements);
      });
    }

    const { nodes: flatNodes, edges: flatEdges } = elements;

    // Berechnet das allererste Layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flatNodes, flatEdges);

    const savedPositions = positionsRef.current || {};
    const currentSelectedIds = selectedNodeIdsRef.current || [];

    let hasNewPositions = false;
    const updatedPositions = { ...savedPositions };

    const finalNodes = layoutedNodes.map(node => {
      let baseNode = { ...node };
      if (savedPositions[node.id]) {
        // Falls bereits eine Position manuell oder durch Einfrieren existiert: Nutzen!
        baseNode.position = savedPositions[node.id];
      } else {
        // NEU: Keine Position gespeichert? Berechnete Position nehmen und SOFORT einfrieren!
        updatedPositions[node.id] = node.position;
        hasNewPositions = true;
      }
      if (currentSelectedIds.includes(node.id)) {
        baseNode.selected = true;
      }
      return baseNode;
    });

    // NEU: Speicher die einmal berechneten Positionen sofort persistent ab, 
    // damit sie bei zukünftigen Löschungen oder Updates starr an Ort und Stelle bleiben!
    if (hasNewPositions) {
      setMindmapData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          positions: {
            ...(prev.positions || {}),
            ...updatedPositions
          }
        };
      });
    }

    setNodes(finalNodes);
    setEdges(layoutedEdges);
  }, [rawData, setNodes, setEdges, setMindmapData]);


const onNodesChangeCustom = (changes) => {
    // 1. Root-Knoten darf nicht gelöscht werden
    const filteredChanges = changes.filter(c => {
      if (c.type === 'remove' && c.id === 'root') return false;
      return true;
    });

    // 2. Änderungen anwenden (inklusive 'dimensions' für das Resizing!)
    setNodes((currentNodes) => applyNodeChanges(filteredChanges, currentNodes));

    // 3. Struktur-Änderungen an übergeordnetes System weitergeben
    // Wir lassen 'dimensions' hier bewusst durch, damit React Flow die neuen Box-Größen registriert
    const structuralChange = filteredChanges.some(
      c => c.type !== 'position' && c.type !== 'select' && c.type !== 'dimensions'
    );
    
    if (structuralChange) {
      onNodesChange(filteredChanges);
      
      // Wenn es ein Löschvorgang war, informieren wir die Haupt-App
      const removeChanges = filteredChanges.filter(c => c.type === 'remove');
      if (removeChanges.length > 0) {
        window.dispatchEvent(new CustomEvent('reactflow-nodes-delete', { 
          detail: { nodeIds: removeChanges.map(c => c.id) } 
        }));
      }
    }
  };

  const dragStartRef = useRef(null);

  const handlePointerMove = (e) => {
      if (!dragStartRef.current) return;

      // 1. Differenz zur letzten Mausposition berechnen
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      // 2. Mausposition sofort aktualisieren
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // 3. Den bestehenden Viewport nehmen und die Differenz addieren
      const { x, y, zoom } = getViewport();
      setViewport({ x: x + deltaX, y: y + deltaY, zoom });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const handlePointerDown = (e) => {
    if (e.button === 1) {
      e.preventDefault();
    }
    if (e.button === 2) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
  };

  // Verarbeitet das Live-Event aus dem Custom-Zieh-Balken deines Knotens
// Verarbeitet das Live-Event aus dem Custom-Zieh-Balken deines Knotens
const handleNodeResize = (e) => {
    const { nodeId, width, isDragging } = e.detail;
    
    // Ermittle alle aktuell selektierten Knoten direkt aus dem Zustand
    const flowNodes = getNodes();
    const activeSelection = flowNodes.filter(n => n.selected).map(n => n.id);
    
    const targetNodeIds = activeSelection.includes(nodeId) 
      ? activeSelection 
      : [nodeId];

    // 1. Live-Vorschau im React Flow State
    setNodes((nds) =>
      nds.map((node) => {
        if (targetNodeIds.includes(node.id)) {
          return {
            ...node,
            style: { 
              ...node.style, 
              width: width,
            },
            data: { ...node.data, width: width },
          };
        }
        return node;
      })
    );

    // 2. Erst beim Loslassen der Maus (isDragging === false) im Baum speichern
    if (!isDragging) {
      setMindmapData((prev) => {
        if (!prev) return prev;

        const updateWidthRecursive = (node) => {
          if (!node) return null;
          let updatedNode = { ...node };
          if (targetNodeIds.includes(node.id)) {
            updatedNode.width = width;
          }
          if (node.children) {
            updatedNode.children = node.children.map(updateWidthRecursive);
          }
          return updatedNode;
        };

        return {
          ...prev,
          rootNode: updateWidthRecursive(prev.rootNode),
          floatingNodes: prev.floatingNodes 
            ? prev.floatingNodes.map(updateWidthRecursive) 
            : []
        };
      });
    }
  };

  // Der Event-Listener darf nur EINMAL beim Mounten gebunden werden
  useEffect(() => {
    window.addEventListener("nodeResize", handleNodeResize);
    return () => window.removeEventListener("nodeResize", handleNodeResize);
  }, [getNodes, setNodes, setMindmapData]);

  const handleBulkDecision = (accepted) => {
    // Finde alle ausgewählten Knoten, die ein aktives Status-Flag besitzen
    const targetIds = nodes
      .filter(node => selectedNodeIds.includes(node.id) && !!node.data?.status)
      .map(node => node.id);

    if (targetIds.length === 0) return;

    // Feuert das Event mit dem Array aus IDs
    window.dispatchEvent(new CustomEvent('bulkProposalDecision', {
      detail: { nodeIds: targetIds, accepted }
    }));
  };

  useEffect(() => {
    const handleLiveUpdate = (e) => {
      const { nodeId, value } = e.detail;
      
      // Wir updaten die flachen React-Flow-Nodes DIREKT im UI-State,
      // ohne dass die Haupt-App (App.jsx) davon weiß oder neu rendert.
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, label: value }
            };
          }
          return node;
        })
      );
    };

    window.addEventListener('reactflow-live-label', handleLiveUpdate);
    return () => window.removeEventListener('reactflow-live-label', handleLiveUpdate);
  }, [setNodes]);
  
  const proOptions = { hideAttribution: true };

  return (
      <div
      onPointerDown={handlePointerDown}
      onDoubleClick={(event) => {
        event.preventDefault();

        const isPane = event.target.classList.contains('react-flow__pane');
        
        if (isPane) {
          const position = screenToFlowPosition({ 
            x: event.clientX, 
            y: event.clientY 
          });

          const centeredPosition = {
            x: position.x - 100,
            y: position.y - 35
          };

          window.dispatchEvent(new CustomEvent('reactflow-node-create', {
            detail: { position: centeredPosition, parentId: null }
          }));
        }
      }}
      style={{ 
        width: '100%', 
        height: '100%', 
        outline: '1px solid var(--border)', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        marginTop: '0px', 
        userSelect: 'none',
        display: 'flex'
      }}
    >
      
      {/* ReactFlow in ein eigenes Flex-Container-Div packen */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          proOptions={proOptions}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          onNodesChange={onNodesChangeCustom}
          onNodeDragStop={(event, node) => {
           setMindmapData((prev) => {
              if (!prev) return prev;
              const newPositions = { ...(prev.positions || {}) };
              const gridSize = 15;
              
              const nodesToUpdate = getNodes().filter(n => n.selected);

              nodesToUpdate.forEach(n => {
                const snappedX = Math.round(n.position.x / gridSize) * gridSize;
                const snappedY = Math.round(n.position.y / gridSize) * gridSize;
                newPositions[n.id] = { x: snappedX, y: snappedY };
              });

              return { ...prev, positions: newPositions };
            });
          }}
          onEdgesChange={onEdgesChange}
          onSelectionChange={({ nodes: selected }) => {
            onNodesSelect(selected); 
          }}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView={false}
          nodesDraggable={true}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          zoomOnScroll={true}
          selectionOnDrag={true}
          selectionKeyCode={null}
          selectionMode='partial'
          translateExtent={[[-5000, -5000], [5000, 5000]]}
          nodeExtent={[[-5000, -5000], [5000, 5000]]}
        >
          <Background color="var(--text)" gap={15} size={1.5} />

          <MiniMap
            position="bottom-left"
            nodeColor="var(--accent)" 
            maskColor="rgba(0, 0, 0, 0.15)"
            style={{
              background: 'color-mix(in srgb, var(--code-bg) 25%, transparent)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              width: 200,
              height: 150,
              pointerEvents: 'none', 
              cursor: 'default'
            }}
          />
        </ReactFlow>

        {/* BulkDecision */}
      {nodes.some(n => selectedNodeIds.includes(n.id) && !!n.data?.status) && (
        <div
          id='div_BulkDecisionParent' 
          style={{
            position: 'absolute', top: '0', left: '50%', transform: 'translate(-50%)', zIndex: 1000, 
            background: 'var(--code-bg)', outline: '1px solid var(--border)',
            borderRadius: '12px', padding: '10px 24px', display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center',
            alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          <span style={{ fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
            {
              nodes.filter(n => selectedNodeIds.includes(n.id) && !!n.data?.status).length === 1 ? 'Einen Vorschlag:'
                : `Alle ${nodes.filter(n => selectedNodeIds.includes(n.id) && !!n.data?.status).length} Vorschläge:`
            }
          </span>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: '10px',
            width: '100%'
          }}>
            <button
              onClick={() => handleBulkDecision(true)}
              className='animationWelle animationWelleLinks'
              style={{ cursor: 'pointer', color: 'var(--text-h)', border: '1px solid var(--accent)', 
                      padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className='span_BulkDecisionAkzeptierenAblehnen'>Akzeptieren </span><Check size={15} strokeWidth={2.5} style={{ transform: 'translate(0px, 0px)' }}/>
            </button>
            <button
              onClick={() => handleBulkDecision(false)}
              className='animationWelle animationWelleRechts'
              style={{ cursor: 'pointer', color: 'var(--text-h)', border: '1px solid var(--accent)', 
                      padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className='span_BulkDecisionAkzeptierenAblehnen'>Ablehnen</span><X size={15} strokeWidth={2.5} style={{ transform: 'translate(0px, 0px)' }}/>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export function MindmapBoard(props){
  return (
    <ReactFlowProvider>
      <MindmapBoardContent {...props} />
    </ReactFlowProvider>
  );
}