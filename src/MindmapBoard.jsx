import React, { useEffect, useState, useRef, useMemo, memo, useCallback, startTransition } from 'react';
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

function EditableMindmapNodeComponent({ id, data, isConnectable, selected }) {
  console.log(`EditableMindmapNodeComponent Render: ${id}, Selected: ${selected}, Label: ${data.label}`);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data.label || '');
  const inputRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [textAreaContentHeight, setTextAreaContentHeight] = useState(40);

  // EINE zentrale Definition der Breite als State
  const [currentWidth, setCurrentWidth] = useState(data.width || 210); 
  // Lokaler State für die dynamisch berechnete, genormte Höhe
  const [measuredHeight, setMeasuredHeight] = useState(45);

  useEffect(() => {
    console.log(`EditableMindmapNodeComponent Effect [data.label]: ${id}, Label: ${data.label}`);
    setValue(data.label || '');
  }, [data.label]);

  useEffect(() => {
    console.log(`EditableMindmapNodeComponent Effect [isEditing]: ${id}, isEditing: ${isEditing}`);
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    console.log(`EditableMindmapNodeComponent Effect [data.isNewInstantEditing]: ${id}, isNewInstantEditing: ${data.isNewInstantEditing}`);
    if (data.isNewInstantEditing) {
      setIsEditing(true);
      console.log("setIsEditing(true)");

      window.dispatchEvent(new CustomEvent('reactflow-node-initialized', {
        detail: { nodeId: id }
      }));
    }
  }, [data.isNewInstantEditing, id]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const saveChange = () => {
    setIsEditing(false);
    if (value.trim() !== '' && value !== data.label) {
      window.dispatchEvent(new CustomEvent('reactflow-live-label', {
        detail: { nodeId: id, value: value }
      }));
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

  // Dynamische Höhenberechnung basierend auf dem realen Inhalt
  useEffect(() => {
    console.log(`EditableMindmapNodeComponent Effect [height calculation]: ${id}, Label: ${data.label}, Value: ${value}, isEditing: ${isEditing}, Width: ${currentWidth}`);
    if (!nodeRef.current) return;

    const textarea = nodeRef.current.querySelector('textarea');
    const labelDiv = nodeRef.current.querySelector('.node-label');

    let textHeight = 20;

    if (isEditing && textarea) {
      textarea.style.height = "auto";
      textHeight = textarea.scrollHeight;
      
      textarea.style.height = `${textHeight}px`;
    } else if (labelDiv) {
      textHeight = labelDiv.offsetHeight;
    }

    const totalRawHeight = textHeight + 24;

    const gridSize = 15;
    const snappedHeight = Math.max(Math.ceil(totalRawHeight / gridSize) * gridSize, 60);

    setMeasuredHeight(snappedHeight);
  }, [data.label, value, isEditing, currentWidth]);

  const calculateWidthLimits = () => {
    if (!nodeRef.current) return { min: 150, max: 600 };

    const labelDiv = nodeRef.current.querySelector(".node-label");
    if (!labelDiv) return { min: 150, max: 600 };

    const words = (data.label || '').split(/\s+/);
    const longestWord = words.reduce((max, word) => word.length > max.length ? word : max, "");

    // Mindestbreite anhand des längsten Wortes messen
    const tempSpan = document.createElement("span");
    tempSpan.style.position = "absolute";
    tempSpan.style.visibility = "hidden";
    tempSpan.style.whiteSpace = "nowrap";
    tempSpan.style.fontFamily = getComputedStyle(labelDiv).fontFamily;
    tempSpan.style.fontSize = getComputedStyle(labelDiv).fontSize;
    tempSpan.textContent = longestWord;
    document.body.appendChild(tempSpan);
    const minWidth = tempSpan.offsetWidth + 40; 
    document.body.removeChild(tempSpan);

    // Grenzen auf ein Vielfaches von 30px runden (für perfektes Handle-Snapping!)
    const snapMin = Math.max(Math.ceil(minWidth / 30) * 30, 150);
    const snapMax = 600; 

    return { min: snapMin, max: snapMax };
  };

  const resizeRef = useRef({ startX: 0, startWidth: 0, min: 150, max: 600, finalWidth: 200, lastDispatchedWidth: 0 });

  const doResize = (moveEvent) => {
    const { startX, startWidth, min, max, lastDispatchedWidth } = resizeRef.current;
    const deltaX = moveEvent.clientX - startX;
    const rawWidth = startWidth + deltaX;
    
    // EXAKT 30PX SPRÜNGE: Garantiert, dass Handles immer auf Grid-Linien bleiben!
    const snappedWidth = Math.round(rawWidth / 30) * 30;
    const finalWidth = Math.min(max, Math.max(min, snappedWidth));
    
    resizeRef.current.finalWidth = finalWidth;

    if (finalWidth !== lastDispatchedWidth) {
      resizeRef.current.finalWidth = finalWidth;
      resizeRef.current.lastDispatchedWidth = finalWidth; // Sofort aktualisieren!

      window.dispatchEvent(new CustomEvent('nodeResize', { 
        detail: { nodeId: id, width: finalWidth, isDragging: true } 
      }));
    }
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
      finalWidth: currentWidth,
      lastDispatchedWidth: currentWidth
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResizing);
  };

  useEffect(() => {
    // Falls von außen eine nicht durch 30 teilbare Breite kommt, runden wir sie direkt
    const externalWidth = data.width || 210;
    const alignedWidth = Math.round(externalWidth / 30) * 30;
    
    setCurrentWidth(alignedWidth);
    if (nodeRef.current) {
      nodeRef.current.style.width = `${alignedWidth}px`;
    }
  }, [data.width]);

  const isRootNode = data.isRootNode;
  const borderColor = selected || isHovered
    ? 'var(--accent)' 
    : (data.borderColor || 'var(--default-node-border)');
  const backgroundColor = data.backgroundColor || 'transparent';

  // ================================================= RETURN ==============================================
  const containerClasses = [
    'editable-mindmap-node',
    isRootNode ? 'node-root' : 'node-default',
    selected ? 'node-selected' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      ref={nodeRef}
      tabIndex={0}
      className={containerClasses}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if(e.key === 'F2'){
          setIsEditing(true);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: `${currentWidth}px`,
        height: `${measuredHeight}px`,
        background: backgroundColor,
        border: `2px solid ${borderColor}`,
        cursor: isEditing ? 'text' : 'grab',
      }}
    >
      {isProposal && (
        <div className="proposal-buttons-container">
          <button
            onClick={(e) => { e.stopPropagation(); handleDecision(true); }}
            className="proposal-button accept"
          >
            <Check size={15} strokeWidth={2.5}/>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDecision(false); }}
            className="proposal-button decline"
          >
            <X size={15} strokeWidth={2.5}/>
          </button>
        </div>
      )}

      {/* Symmetrische Handles direkt an den Außenkanten */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable} 
        style={{ opacity: 1, top: '-2px', background: 'var(--border)', width: '6px', height: '6px' }}
      />

      {/* Neuer Wrapper mit eindeutiger Klasse zur Höhenmessung */}
      <div className="node-content-wrapper">
        {data.status === 'updated' && data.oldLabel && (
          <div style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, marginBottom: '2px' }}>
            {data.oldLabel}
          </div>
        )}
        {isEditing ? (
          <textarea
            ref={inputRef}
            className='nodrag node-textarea'
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            rows={1}
          />
        ) : (
          <div className={`node-label ${isProposal ? 'node-is-proposal' : ''} ${data.status === 'deleted' ? 'node-deleted-label' : ''}`}>
            {data.label}
          </div>
        )}
      </div>

      <div 
        ref={resizeHandleRef}
        onMouseDown={startResizing}
        className="nodrag node-resize-handle"
      />
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable} 
        style={{ opacity: 1, bottom: '-2px', background: 'var(--border)', width: '6px', height: '6px' }}
      />
    </div>
  );
}

export const EditableMindmapNode = React.memo(EditableMindmapNodeComponent, (prevProps, nextProps) => {
  // Optimierte Vergleichslogik: 
  // 1. Primitive Props zuerst (selected, isConnectable)
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.isConnectable !== nextProps.isConnectable) return false;

  // 2. Data-Objekt Inhalte vergleichen (Shallow Check der relevanten Keys)
  const p = prevProps.data;
  const n = nextProps.data;

  return (
    p.label === n.label &&
    p.width === n.width &&
    p.status === n.status &&
    p.borderColor === n.borderColor &&
    p.backgroundColor === n.backgroundColor &&
    p.isNewInstantEditing === n.isNewInstantEditing &&
    p.isRootNode === n.isRootNode &&
    p.oldLabel === n.oldLabel
  );
});

// Wichtig für React Flow DevTools
EditableMindmapNode.displayName = 'EditableMindmapNode';

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
      // edgeAnimated = false;
    }

    const isRootNode = node.id === 'root';

    const rawWidth = node.width || 210;
    const alignedWidth = Math.round(rawWidth / 30) * 30;

    // Nur definierte Felder in data aufnehmen, um Objekt-Keys stabil zu halten
    const nodeData = {
      label: node.label,
      isRootNode: isRootNode,
      width: alignedWidth,
    };
    if (node.status) nodeData.status = node.status;
    if (node.oldLabel) nodeData.oldLabel = node.oldLabel;
    if (node.isNewInstantEditing) nodeData.isNewInstantEditing = node.isNewInstantEditing;
    if (borderColor) nodeData.borderColor = borderColor;
    if (backgroundColor) nodeData.backgroundColor = backgroundColor;

    elements.nodes.push({
      id: node.id,
      type: isProposal ? 'proposalNode' : 'default',
      data: nodeData,
      position: { x: 0, y: 0 },
      style: {
        width: alignedWidth,
        background: 'none',
        border: 'none',
        padding: 0,
        boxShadow: 'none',
        zIndex: isProposal ? 1 : 0
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
        animated: edgeAnimated,
      });
    }
  }

  // Rekursiv die echten Kinder im Baum weiterverarbeiten
  if (node.children) {
    node.children.forEach(child => convertTreeToFlow(child, node.id, elements));
  }

  return elements;
}

export function MindmapBoardContent({ rawData, currentFileName, positions, onDeleteNodes, setMindmapData, onNodesSelect, selectedNodeIds = [] }) {
  console.log(`MindmapBoardContent Render`);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getNodes, screenToFlowPosition } = useReactFlow();

  // Ref, um die aktuellsten nodes zu halten, ohne Re-Render-Ketten zu triggern
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const onEdgesChangeCustom = useCallback((changes) => {
    console.log("onEdgesChangeCustom called", changes);
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const nodeTypes = useMemo(() => ({
    default: EditableMindmapNode,
    proposalNode: EditableMindmapNode
  }), []);

  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

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


  const onNodesChangeCustom = useCallback((changes) => {
    console.log("onNodesChangeCustom called", changes);
    // 1. Root-Knoten darf nicht gelöscht werden
    const filteredChanges = changes.filter(c => !(c.type === 'remove' && c.id === 'root'));

    onNodesChange(filteredChanges);

    // 3. Lösch-Event feuern
    const removeChanges = filteredChanges.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      console.log("Dispatching reactflow-nodes-delete", removeChanges.map(c => c.id));
      window.dispatchEvent(new CustomEvent('reactflow-nodes-delete', { 
        detail: { nodeIds: removeChanges.map(c => c.id) } 
      }));
    }
  }, [onNodesChange]);

  const onNodeDragStopCustom = useCallback((event, node) => {
    console.log("onNodeDragStopCustom called", node.id, node.position);
    setMindmapData((prev) => {
       if (!prev) return prev;
       
       const nodesToUpdate = getNodes().filter(n => n.selected);
       if (nodesToUpdate.length === 0) {
         nodesToUpdate.push(node);
       }

       const gridSize = 15;
       let hasChanged = false;
       const newPositions = { ...(prev.positions || {}) };

       nodesToUpdate.forEach(n => {
         const snappedX = Math.round(n.position.x / gridSize) * gridSize;
         const snappedY = Math.round(n.position.y / gridSize) * gridSize;
         
         const oldPos = prev.positions?.[n.id];
         if (!oldPos || oldPos.x !== snappedX || oldPos.y !== snappedY) {
           newPositions[n.id] = { x: snappedX, y: snappedY };
           hasChanged = true;
         }
       });

       if (!hasChanged) return prev;
       return { ...prev, positions: newPositions };
     });
   }, [getNodes, setMindmapData]);

  const onSelectionChangeCustom = useCallback(({ nodes: selected }) => {
    // Nur updaten, wenn sich die IDs wirklich geändert haben, um unnötige App-Rerenders zu vermeiden
    const newIds = selected.map(n => n.id).sort().join(',');
    const oldIds = selectedNodeIdsRef.current.map(id => id).sort().join(',');
    
    if (newIds !== oldIds) {
      onNodesSelect(selected);
    }
  }, [onNodesSelect]);

  // =========== WIRD ERSETZT? ============
  // const dragStartRef = useRef(null);

  // const handlePointerMove = (e) => {
  //     if (!dragStartRef.current) return;

  //     // 1. Differenz zur letzten Mausposition berechnen
  //     const deltaX = e.clientX - dragStartRef.current.x;
  //     const deltaY = e.clientY - dragStartRef.current.y;
      
  //     // 2. Mausposition sofort aktualisieren
  //     dragStartRef.current = { x: e.clientX, y: e.clientY };

  //     // 3. Den bestehenden Viewport nehmen und die Differenz addieren
  //     const { x, y, zoom } = getViewport();
  //     setViewport({ x: x + deltaX, y: y + deltaY, zoom });
  // };

  // const handlePointerUp = () => {
  //   dragStartRef.current = null;
  //   window.removeEventListener('pointermove', handlePointerMove);
  //   window.removeEventListener('pointerup', handlePointerUp);
  // };

  // const handlePointerDown = (e) => {
  //   if (e.button === 1) {
  //     e.preventDefault();
  //   }
  //   if (e.button === 2) {
  //     dragStartRef.current = { x: e.clientX, y: e.clientY };
  //     window.addEventListener('pointermove', handlePointerMove);
  //     window.addEventListener('pointerup', handlePointerUp);
  //   }
  // };

// Verarbeitet das Live-Event aus dem Custom-Zieh-Balken deines Knotens
const handleNodeResize = useCallback((e) => {
  const { nodeId, width, isDragging } = e.detail;
  
  // 1. Während des Ziehens: React-State komplett umgehen und direkt das DOM manipulieren!
    if (isDragging) {
      // Hol dir alle aktuell selektierten Knoten-IDs aus dem React Flow State via Ref
      const currentFlowNodes = nodesRef.current;
      const activeSelection = currentFlowNodes.filter(n => n.selected).map(n => n.id);
      
      // Bestimme, welche Knoten visuell mitskaliert werden sollen
      const targetNodeIds = activeSelection.includes(nodeId) 
        ? activeSelection 
        : [nodeId];

    // Manipuliere die Breite direkt im DOM
    targetNodeIds.forEach(id => {
      // Wir suchen das DOM-Element anhand des data-id-Attributs, das React Flow vergibt
      const nodeElement = document.querySelector(`[data-id="${id}"]`);
      if (nodeElement) {
        // 1. Ändere die Breite des äußeren React-Flow-Wrappers
        nodeElement.style.width = `${width}px`;
        
        // 2. Ändere die Breite deines inneren Custom-Node-Inhalts (EditableMindmapNode)
        const innerNode = nodeElement.querySelector('.node-content-wrapper')?.parentNode;
        if (innerNode) {
          innerNode.style.width = `${width}px`;
        }
      }
    });
    return;
  }

  // 2. Erst beim Loslassen (isDragging === false): Einmaliges Update für React
  const flowNodes = getNodes();
  const activeSelection = flowNodes.filter(n => n.selected).map(n => n.id);
  
  const targetNodeIds = activeSelection.includes(nodeId) 
    ? activeSelection 
    : [nodeId];

  // Einmaliges Update des flachen React Flow UI-States mit startTransition
  startTransition(() => {
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
  });

  // Persistent im Baum abspeichern
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
}, [getNodes, setNodes, setMindmapData]);

  // Der Event-Listener darf nur EINMAL beim Mounten gebunden werden
  useEffect(() => {
    window.addEventListener("nodeResize", handleNodeResize);
    return () => window.removeEventListener("nodeResize", handleNodeResize);
  }, [handleNodeResize]);

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
      // onPointerDown={handlePointerDown} ================= Wird ersetzt? =============
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
          onNodesDelete={onDeleteNodes}
          onNodesChange={onNodesChangeCustom}
          onNodeDragStop={onNodeDragStopCustom}
          onEdgesChange={onEdgesChangeCustom}
          onSelectionChange={onSelectionChangeCustom}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView={false}
          nodesDraggable={true}
          // --- NATIVE RECHTSKLICK-BEWEGUNG AKTIVIEREN ---
          panOnDrag={[2]} // [2] steht exakt für Rechtsklick!
          onPaneContextMenu={(e) => e.preventDefault()} // Verhindert das Standard-Menü auf dem Hintergrund
          onNodeContextMenu={(e) => e.preventDefault()} // Verhindert das Standard-Menü auf Knoten
          onEdgeContextMenu={(e) => e.preventDefault()} // Verhindert das Standard-Menü auf Edges
          // ----------------------------------------------
          zoomOnDoubleClick={false}
          panOnScroll={false}
          zoomOnScroll={true}
          selectionOnDrag={true}
          selectionKeyCode={null}
          selectionMode='partial'
          translateExtent={[[-10000, -10000], [10000, 10000]]}
          nodeExtent={[[-10000, -10000], [1000, 10000]]}
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