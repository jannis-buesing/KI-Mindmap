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
import { Check, X } from 'lucide-react';

function EditableMindmapNodeComponent({ id, data, isConnectable, selected }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(data.label || '');
  const inputRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  const [currentWidth, setCurrentWidth] = useState(data.width || 210); 
  const [measuredHeight, setMeasuredHeight] = useState(45);

  useEffect(() => {
    setValue(data.label || '');
  }, [data.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sofortiger Edit-Modus für neu erstellte Knoten via Event
  useEffect(() => {
    const handleCreated = (e) => {
      if (e.detail.nodeId === id) {
        setIsEditing(true);
      }
    };
    window.addEventListener('reactflow-node-created', handleCreated);
    return () => window.removeEventListener('reactflow-node-created', handleCreated);
  }, [id]);

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

  useEffect(() => {
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

    const snapMin = Math.max(Math.ceil(minWidth / 30) * 30, 150);
    const snapMax = 600; 
    return { min: snapMin, max: snapMax };
  };

  const resizeRef = useRef({ startX: 0, startWidth: 0, min: 150, max: 600, finalWidth: 200, lastDispatchedWidth: 0 });

  const doResize = (moveEvent) => {
    const { startX, startWidth, min, max, lastDispatchedWidth } = resizeRef.current;
    const deltaX = moveEvent.clientX - startX;
    const rawWidth = startWidth + deltaX;
    const snappedWidth = Math.round(rawWidth / 30) * 30;
    const finalWidth = Math.min(max, Math.max(min, snappedWidth));
    
    if (finalWidth !== lastDispatchedWidth) {
      resizeRef.current.finalWidth = finalWidth;
      resizeRef.current.lastDispatchedWidth = finalWidth;
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
    if (e.button !== 0) return; // Nur Linksklick erlauben
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
    
    // Sofort beim Start des Resizens Event abfeuern, um Markierung und Höhe zu aktualisieren
    window.dispatchEvent(new CustomEvent('nodeResize', { 
      detail: { nodeId: id, width: currentWidth, isDragging: true } 
    }));
    
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResizing);
  };

  useEffect(() => {
    const externalWidth = data.width || 210;
    const alignedWidth = Math.round(externalWidth / 30) * 30;
    setCurrentWidth(alignedWidth);
  }, [data.width]);

  const isRootNode = data.isRootNode;
  const borderColor = selected || isHovered
    ? 'var(--accent)' 
    : (data.borderColor || 'var(--default-node-border)');
  const backgroundColor = data.backgroundColor || 'transparent';

  const containerClasses = [
    'editable-mindmap-node',
    isRootNode ? 'node-root' : 'node-default',
    selected ? 'node-selected' : ''
  ].filter(Boolean).join(' ');

  // ================================================= RETURN ==============================================

  return (
    <div 
      ref={nodeRef}
      tabIndex={0}
      className={containerClasses}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => { if(e.key === 'F2') setIsEditing(true); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: `${currentWidth}px`,
        height: `${measuredHeight}px`,
        background: backgroundColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: borderColor,
        cursor: isEditing ? 'text' : 'grab',
        '--node-default-border': data.borderColor || 'var(--default-node-border)'
      }}
    >
      {isProposal && (
        <div className="proposal-buttons-container">
          <button onClick={(e) => { e.stopPropagation(); handleDecision(true); }} className="proposal-button accept">
            <Check size={15} strokeWidth={2.5}/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDecision(false); }} className="proposal-button decline">
            <X size={15} strokeWidth={2.5}/>
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ opacity: 1, top: '-2px', background: 'var(--border)', border: '1px solid var(--text-h)', width: '6px', height: '6px' }} />
      <div className="node-content-wrapper">
        {data.status === 'updated' && data.oldLabel && (
          <div style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, marginBottom: '2px' }}>{data.oldLabel}</div>
        )}
        {isEditing ? (
          <textarea ref={inputRef} className='nodrag node-textarea' value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} rows={1} />
        ) : (
          <div className={`node-label ${data.status === 'deleted' ? 'node-deleted-label' : ''}`}>{data.label}</div>
        )}
      </div>
      <div ref={resizeHandleRef} onMouseDown={startResizing} className="nodrag node-resize-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ opacity: 1, bottom: '-2px', background: 'var(--border)', border: '1px solid var(--text-h)', width: '6px', height: '6px' }} />
    </div>
  );
}

export const EditableMindmapNode = React.memo(EditableMindmapNodeComponent, (prevProps, nextProps) => {
  // Strikter Vergleich der Props zur Reduzierung von Reconciliation-Overhead
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.isConnectable !== nextProps.isConnectable) return false;
  
  const p = prevProps.data;
  const n = nextProps.data;
  
  // Tiefer Vergleich der Datenfelder, um unnötige Re-Renders der Knoten-Komponente zu verhindern
  return (
    p.label === n.label &&
    p.width === n.width &&
    p.status === n.status &&
    p.borderColor === n.borderColor &&
    p.backgroundColor === n.backgroundColor &&
    p.isRootNode === n.isRootNode &&
    p.oldLabel === n.oldLabel
  );
});

EditableMindmapNode.displayName = 'EditableMindmapNode';

export function MindmapBoardContent({ rawData, setMindmapData, currentFileName, positions, onNodesSelect, selectedNodeIds = [], isEdgeSelectMode, setIsEdgeSelectMode, isViewReady, setIsViewReady }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getNodes, screenToFlowPosition, fitView } = useReactFlow();

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const onEdgesChangeCustom = useCallback((changes) => { onEdgesChange(changes); }, [onEdgesChange]);

  const nodeTypes = useMemo(() => ({
    default: EditableMindmapNode,
    proposalNode: EditableMindmapNode
  }), []);

  useEffect(() => {
    if (isEdgeSelectMode) {
      setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    }
  }, [isEdgeSelectMode, setNodes]);

  useEffect(() => {
    const triggerFit = () => {
      
        console.log("triggerfit");


      const ausführenTriggerFit = async () => {
        
        
        console.log("vorm await fitview");

        await fitView({ padding: 5, duration: 0 });

        console.log("vorm setisviewready");

        setIsViewReady(true);

        fitView({ 
          padding: 1,
          duration: 2000
        });
      };
      requestAnimationFrame(() => {
        ausführenTriggerFit();
      });
    };

    window.addEventListener('reactflow-trigger-fitview', triggerFit);
    return () => window.removeEventListener('reactflow-trigger-fitview', triggerFit);
  }, [fitView, setIsViewReady]);

  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);

  useEffect(() => {
    if (!rawData || !rawData.nodes) return;

    const flatNodes = (rawData.nodes || []).map(node => {
      let borderColor = node.borderColor;
      let backgroundColor = node.backgroundColor;

      // Fallback: Wenn keine benutzerdefinierte Farbe gesetzt ist, nutzen wir die Status-Farbe
      if (!borderColor) {
        if (node.status === 'updated') {
          borderColor = '#eedf59';
          backgroundColor = 'rgba(243, 246, 59, 0.15)';
        } else if (node.status === 'deleted') {
          borderColor = '#ef4444';
          backgroundColor = 'rgba(239, 68, 68, 0.15)';
        } else if (node.status === 'added') {
          borderColor = '#22c55e';
          backgroundColor = 'rgba(34, 197, 94, 0.15)';
        } else {
          borderColor = 'var(--default-node-border)';
        }
      }

      if (!backgroundColor) {
        backgroundColor = borderColor !== 'var(--default-node-border)'
          ? `${borderColor}40`
          : `color-mix(in srgb, var(--default-node-border) 25%, transparent)`;
      }

      const alignedWidth = Math.round((node.width || 210) / 30) * 30;
      const nodeData = {
        label: node.label,
        isRootNode: node.isRootNode || node.id === 'root',
        width: alignedWidth,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        status: node.status,
        oldLabel: node.oldLabel
      };

      return {
        id: node.id,
        type: node.status ? 'proposalNode' : 'default',
        data: nodeData,
        position: positionsRef.current?.[node.id] || { x: 0, y: 0 },
        style: { width: alignedWidth, background: 'none', borderWidth: 0, borderStyle: 'none', padding: 0, boxShadow: 'none', zIndex: node.status ? 1 : 0 }
      };
    });

    const savedPositions = positionsRef.current || {};
    const currentSelectedIds = selectedNodeIdsRef.current;
    
    const finalNodes = flatNodes.map(node => {
      let baseNode = { ...node };
      
      if (savedPositions[node.id]) {
        baseNode.position = savedPositions[node.id];
      } else {
        // Fallback, falls doch mal eine Position fehlt (z.B. frisch aus der API ohne Positions-Update)
        baseNode.position = { x: 0, y: 0 };
      }
      
      const isSelected = currentSelectedIds instanceof Set
        ? currentSelectedIds.has(node.id)
        : Array.isArray(currentSelectedIds) && currentSelectedIds.includes(node.id);

      if (isSelected) baseNode.selected = true;
      return baseNode;
    });

    const finalEdges = (rawData.edges || []).map(edge => {
      let edgeStyle = { stroke: 'var(--text)' };
      const targetNode = rawData.nodes.find(n => n.id === edge.target);
      if (targetNode) {
        if (targetNode.status === 'deleted') edgeStyle = { stroke: '#ef4444', strokeDasharray: '5,5' };
        else if (targetNode.status === 'added') edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
      }
      return { ...edge, style: edgeStyle };
    });

    startTransition(() => {
      // ================ setNodes ==================================
      setNodes((currentNodes) => {
        let hasChanged = false;
        const updatedNodes = finalNodes.map((newNode) => {
          const currentNode = currentNodes.find((n) => n.id === newNode.id);
          if (!currentNode) {
            hasChanged = true;
            return newNode;
          }

          // 1. Koordinaten abgleichen
          const posChanged =
            currentNode.position.x !== newNode.position.x ||
            currentNode.position.y !== newNode.position.y;

          // 2. Relevante Datenfelder tiefenprüfen
          const dataChanged =
            currentNode.data.label !== newNode.data.label ||
            currentNode.data.width !== newNode.data.width ||
            currentNode.data.borderColor !== newNode.data.borderColor ||
            currentNode.data.backgroundColor !== newNode.data.backgroundColor ||
            currentNode.data.status !== newNode.data.status ||
            currentNode.data.oldLabel !== newNode.data.oldLabel ||
            currentNode.data.isRootNode !== newNode.data.isRootNode;

          const selectedChanged = currentNode.selected !== newNode.selected;
          const typeChanged = currentNode.type !== newNode.type;

          // Nur wenn sich wirklich etwas verändert hat, erzeugen wir ein neues Objekt
          if (posChanged || dataChanged || selectedChanged || typeChanged) {
            hasChanged = true;
            return newNode;
          }
          return currentNode; // WICHTIG: Alte Speicher-Referenz bleibt bestehen!
        });

        if (hasChanged || currentNodes.length !== finalNodes.length) {
          return updatedNodes;
        }
        return currentNodes;
      });

      // ================ setEdges ==================================
      setEdges((currentEdges) => {
        let hasChanged = false;
        const updatedEdges = finalEdges.map((newEdge) => {
          const currentEdge = currentEdges.find((e) => e.id === newEdge.id);
          if (!currentEdge) {
            hasChanged = true;
            return newEdge;
          }

          const basicChanged =
            currentEdge.source !== newEdge.source ||
            currentEdge.target !== newEdge.target ||
            currentEdge.selected !== newEdge.selected ||
            currentEdge.selectable !== newEdge.selectable;

          const styleChanged =
            currentEdge.style?.stroke !== newEdge.style?.stroke ||
            currentEdge.style?.strokeDasharray !== newEdge.style?.strokeDasharray ||
            currentEdge.style?.strokeWidth !== newEdge.style?.strokeWidth;

          if (basicChanged || styleChanged) {
            hasChanged = true;
            return newEdge;
          }
          return currentEdge; // Referenz bleibt bestehen!
        });

        if (hasChanged || currentEdges.length !== finalEdges.length) {
          return updatedEdges;
        }
        return currentEdges;
      });
    });
  }, [rawData, setNodes, setEdges]);

  // Edges manuell erstellen
  const onConnect = useCallback((connection) => {
    setMindmapData((prev) => {
      if (!prev) return prev;

      // Generiere die ID passend zu deinem bestehenden Schema (e-source-target)
      const edgeId = `e-${connection.source}-${connection.target}`;

      // Verhindern, dass dieselbe Verbindung doppelt erstellt wird
      const edgeExists = (prev.edges || []).some(edge => edge.id === edgeId);
      if (edgeExists) return prev;

      const newEdge = {
        id: edgeId,
        source: connection.source,
        target: connection.target,
      };

      return {
        ...prev,
        edges: [...(prev.edges || []), newEdge]
      };
    });
  }, [setMindmapData]);

  // Edges markieren mit Box
  const handleSelectionEnd = useCallback(() => {
    if (!isEdgeSelectMode) return;

    const selectedNodeIds = getNodes()
      .filter((node) => node.selected)
      .map((node) => node.id);

    if (selectedNodeIds.length > 0) {
      setEdges((eds) =>
        eds.map((edge) => {
          if (selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)) {
            return { ...edge, selected: true };
          }
          return edge;
        })
      );
      
      // Knoten sofort wieder abwählen
      setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    }

    // 2. Modus nach einmaligem Ziehen sofort wieder beenden
    setIsEdgeSelectMode(false);
  }, [isEdgeSelectMode, getNodes, setNodes, setEdges, setIsEdgeSelectMode]);

  const handleEdgesDelete = useCallback((deletedEdges) => {
    const edgeIds = deletedEdges.map(edge => edge.id);
    
    // Das Event abfeuern, auf das App.jsx jetzt lauscht
    window.dispatchEvent(new CustomEvent('reactflow-edges-delete', {
      detail: { edgeIds }
    }));
  }, []);

  const onNodesChangeCustom = useCallback((changes) => {
    const filteredChanges = changes.filter(c => !(c.type === 'remove' && c.id === 'root'));
    onNodesChange(filteredChanges);
    const removeChanges = filteredChanges.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      window.dispatchEvent(new CustomEvent('reactflow-nodes-delete', { detail: { nodeIds: removeChanges.map(c => c.id) } }));
    }
  }, [onNodesChange]);

  const onNodeDragStopCustom = useCallback((event, node) => {
    startTransition(() => {
      setMindmapData((prev) => {
        if (!prev) return prev;
        const nodesToUpdate = getNodes().filter(n => n.selected);
        if (nodesToUpdate.length === 0) nodesToUpdate.push(node);
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
    });
   }, [getNodes, setMindmapData]);

  const onSelectionChangeCustom = useCallback(({ nodes: selected }) => {
    const newIds = selected.map(n => n.id);
    const oldIds = selectedNodeIdsRef.current || [];
    
    const hasChanged = newIds.length !== oldIds.length || newIds.some(id => !oldIds.includes(id));
    
    if (hasChanged) {
      startTransition(() => {
        onNodesSelect(newIds);
        window.dispatchEvent(new CustomEvent('reactflow-all-nodes-init', { detail: { nodes: getNodes() } }));
      });
    }
  }, [onNodesSelect, getNodes]);

  const handleNodeResize = useCallback((e) => {
    const { nodeId, width, isDragging } = e.detail;
    if (isDragging) {
      const currentFlowNodes = nodesRef.current;
      
      // Falls der aktuelle Knoten noch nicht markiert ist, markieren wir ihn sofort
      const targetNode = currentFlowNodes.find(n => n.id === nodeId);
      if (targetNode && !targetNode.selected) {
        setNodes((nds) => nds.map((n) => {
          if (n.id === nodeId) {
            return { ...n, selected: true };
          }
          return n;
        }));
      }

      const activeSelection = currentFlowNodes.filter(n => n.selected).map(n => n.id);
      const targetNodeIds = activeSelection.includes(nodeId) ? activeSelection : [nodeId];
      targetNodeIds.forEach(id => {
        const nodeElement = document.querySelector(`[data-id="${id}"]`);
        if (nodeElement) {
          nodeElement.style.width = `${width}px`;
          const innerNode = nodeElement.querySelector('.node-content-wrapper')?.parentNode;
          if (innerNode) {
            innerNode.style.width = `${width}px`;
            
            // Sofortige Höhenaktualisierung beim Resizen (Höhe neu berechnen)
            const textarea = innerNode.querySelector('textarea');
            const labelDiv = innerNode.querySelector('.node-label');
            
            let textHeight = 20;
            if (textarea) {
              textarea.style.height = "auto";
              textHeight = textarea.scrollHeight;
              textarea.style.height = `${textHeight}px`;
            } else if (labelDiv) {
              textHeight = labelDiv.offsetHeight;
            }
            
            const totalRawHeight = textHeight + 24;
            const gridSize = 15;
            const snappedHeight = Math.max(Math.ceil(totalRawHeight / gridSize) * gridSize, 60);
            
            nodeElement.style.height = `${snappedHeight}px`;
            innerNode.style.height = `${snappedHeight}px`;
          }
        }
      });
      return;
    }

    const flowNodes = getNodes();
    const activeSelection = flowNodes.filter(n => n.selected).map(n => n.id);
    const targetNodeIds = activeSelection.includes(nodeId) ? activeSelection : [nodeId];

    // BEIDE Zustands-Updates müssen in denselben startTransition-Block,
    // damit sie gesammelt asynchron im Hintergrund verarbeitet werden!
    startTransition(() => {
      setNodes((nds) => nds.map((node) => {
        if (targetNodeIds.includes(node.id)) {
          return { ...node, style: { ...node.style, width: width }, data: { ...node.data, width: width } };
        }
        return node;
      }));

      setMindmapData((prev) => {
        if (!prev || !prev.nodes) return prev;
        const newNodes = prev.nodes.map(node => targetNodeIds.includes(node.id) ? { ...node, width: width } : node);
        return { ...prev, nodes: newNodes };
      });
    });
  }, [getNodes, setNodes, setMindmapData]);

  useEffect(() => {
    window.addEventListener("nodeResize", handleNodeResize);
    return () => window.removeEventListener("nodeResize", handleNodeResize);
  }, [handleNodeResize]);

  const handleBulkDecision = (accepted) => {
    const targetIds = nodes.filter(node => selectedNodeIds.includes(node.id) && !!node.data?.status).map(node => node.id);
    if (targetIds.length === 0) return;
    window.dispatchEvent(new CustomEvent('bulkProposalDecision', { detail: { nodeIds: targetIds, accepted } }));
  };

  useEffect(() => {
    const handleUpdateNodesData = (e) => {
      if (!e.detail) return;

      const { nodeIds, field, value } = e.detail;
      
      setNodes((nds) => nds.map((node) => {
        if (nodeIds && nodeIds.includes(node.id)) {
          if (field === 'label') return { ...node, data: { ...node.data, label: value } };
          if (field === 'borderColor') return { ...node, style: { ...node.style, borderColor: value } };
        }
        return node;
      }));
    };
    window.addEventListener('reactflow-update-nodes-data', handleUpdateNodesData);
    return () => {
      window.removeEventListener('reactflow-update-nodes-data', handleUpdateNodesData);
    };
  }, [setNodes]);

  useEffect(() => {
    const handleGetAllNodes = () => {
      window.dispatchEvent(new CustomEvent('reactflow-all-nodes-init', { detail: { nodes: getNodes() } }));
    };
    window.addEventListener('reactflow-get-all-nodes', handleGetAllNodes);
    return () => window.removeEventListener('reactflow-get-all-nodes', handleGetAllNodes);
  }, [getNodes]);


  // ============================================
  const displayEdges = useMemo(() => edges.map((e) => ({
    ...e,
    selectable: isEdgeSelectMode, 
  })), [edges, isEdgeSelectMode]);
  // ==================================================== RETURN =========================================================

  return (
    <div
      onDoubleClick={(event) => {
        event.preventDefault();
        if (event.target.classList.contains('react-flow__pane')) {
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          // Zentrierung und Grid-Snapping (15px)
          const gridSize = 15;
          const centeredX = position.x - 110;
          const centeredY = position.y - 35;
          const snappedPos = {
            x: Math.round(centeredX / gridSize) * gridSize,
            y: Math.round(centeredY / gridSize) * gridSize
          };
          window.dispatchEvent(new CustomEvent('reactflow-node-create', { detail: { position: snappedPos, parentId: null } }));
        }
      }}
      style={{ 
        width: '100%', 
        height: '100%', 
        outline: isEdgeSelectMode ? '1px solid var(--edgeDelete)' : '1px solid var(--border)', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        userSelect: 'none', 
        display: 'flex',
        opacity: isViewReady ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          className={isEdgeSelectMode ? 'hide-node-selection' : ''}
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={displayEdges}
          onEdgeClick={(event, edge) => {
            if (!isEdgeSelectMode) {
              setEdges((eds) =>
                eds.map((e) =>
                  e.id === edge.id ? { ...e, selected: !e.selected } : e
                )
              );
            }
          }}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          deleteKeyCode={['Backspace', 'Delete']}
          onEdgesDelete={handleEdgesDelete}
          onNodesChange={onNodesChangeCustom}
          onNodeDragStop={onNodeDragStopCustom}
          onEdgesChange={onEdgesChangeCustom} 
          onSelectionChange={onSelectionChangeCustom}
          onSelectionEnd={handleSelectionEnd}
          snapToGrid={true} 
          snapGrid={[15, 15]}
          fitView={false}
          selectNodesOnDrag={true}
          nodesDraggable={!isEdgeSelectMode}
          panOnDrag={[2]}
          onPaneContextMenu={(e) => e.preventDefault()} 
          onNodeContextMenu={(e) => e.preventDefault()} 
          onEdgeContextMenu={(e) => e.preventDefault()} 
          zoomOnDoubleClick={false} 
          panOnScroll={false} 
          zoomOnScroll={true}
          selectionOnDrag={true}
          selectionKeyCode={null} 
          selectionMode='partial'
          translateExtent={[[-10000, -10000], [10000, 10000]]}
          nodeExtent={[[-10000, -10000], [10000, 10000]]}
        >
          <Background color="var(--text)" gap={15} size={1.5} />
          <MiniMap position="bottom-left" nodeColor="var(--accent)" maskColor="rgba(0, 0, 0, 0.15)" style={{ background: 'color-mix(in srgb, var(--code-bg) 25%, transparent)', border: '1px solid var(--border)', borderRadius: '8px', width: 200, height: 150, pointerEvents: 'none', cursor: 'default' }} />
        </ReactFlow>
        {nodes.some(n => selectedNodeIds.includes(n.id) && !!n.data?.status) && !isEdgeSelectMode && (
          <div id='div_BulkDecisionParent' style={{ position: 'absolute', top: '0', left: '50%', transform: 'translate(-50%)', zIndex: 1000, background: 'var(--code-bg)', outline: '1px solid var(--border)', borderRadius: '12px', padding: '10px 24px', display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
              {nodes.filter(n => selectedNodeIds.includes(n.id) && !!n.data?.status).length === 1 ? 'Einen Vorschlag:' : `Alle ${nodes.filter(n => selectedNodeIds.includes(n.id) && !!n.data?.status).length} Vorschläge:`}
            </span>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '10px', width: '100%' }}>
              <button onClick={() => handleBulkDecision(true)} className='animationWelle animationWelleLinks' style={{ cursor: 'pointer', color: 'var(--text-h)', border: '1px solid var(--accent)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className='span_BulkDecisionAkzeptierenAblehnen'>Akzeptieren </span><Check size={15} strokeWidth={2.5}/>
              </button>
              <button onClick={() => handleBulkDecision(false)} className='animationWelle animationWelleRechts' style={{ cursor: 'pointer', color: 'var(--text-h)', border: '1px solid var(--accent)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className='span_BulkDecisionAkzeptierenAblehnen'>Ablehnen</span><X size={15} strokeWidth={2.5}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const MindmapBoard = React.memo(function MindmapBoard(props){
  return (
    <ReactFlowProvider>
      <MindmapBoardContent {...props} />
    </ReactFlowProvider>
  );
}, (prevProps, nextProps) => {
  if (prevProps.rawData !== nextProps.rawData) return false;
  if (prevProps.setMindmapData !== nextProps.setMindmapData) return false;
  if (prevProps.currentFileName !== nextProps.currentFileName) return false;
  if (prevProps.positions !== nextProps.positions) return false;
  if (prevProps.justCreatedNodeId !== nextProps.justCreatedNodeId) return false;
  if (prevProps.onNodesSelect !== nextProps.onNodesSelect) return false;
  if (prevProps.isEdgeSelectMode !== nextProps.isEdgeSelectMode) return false;
  if (prevProps.setIsEdgeSelectMode !== nextProps.setIsEdgeSelectMode) return false;
  if (prevProps.isViewReady !== nextProps.isViewReady) return false;
  if (prevProps.rawData !== nextProps.rawData) return false;
  
  const pSel = prevProps.selectedNodeIds || [];
  const nSel = nextProps.selectedNodeIds || [];
  if (pSel.length !== nSel.length) return false;
  
  const pSet = new Set(pSel);
  for (let i = 0; i < nSel.length; i++) {
    if (!pSet.has(nSel[i])) return false;
  }
  
  return true;
});
