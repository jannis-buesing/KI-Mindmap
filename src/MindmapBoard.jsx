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

  useEffect(() => {
    if (data.isNewInstantEditing) {
      setIsEditing(true);
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
        border: `2px solid ${borderColor}`,
        cursor: isEditing ? 'text' : 'grab',
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
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ opacity: 1, top: '-2px', background: 'var(--border)', width: '6px', height: '6px' }} />
      <div className="node-content-wrapper">
        {data.status === 'updated' && data.oldLabel && (
          <div style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, marginBottom: '2px' }}>{data.oldLabel}</div>
        )}
        {isEditing ? (
          <textarea ref={inputRef} className='nodrag node-textarea' value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleBlur} rows={1} />
        ) : (
          <div className={`node-label ${isProposal ? 'node-is-proposal' : ''} ${data.status === 'deleted' ? 'node-deleted-label' : ''}`}>{data.label}</div>
        )}
      </div>
      <div ref={resizeHandleRef} onMouseDown={startResizing} className="nodrag node-resize-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ opacity: 1, bottom: '-2px', background: 'var(--border)', width: '6px', height: '6px' }} />
    </div>
  );
}

export const EditableMindmapNode = React.memo(EditableMindmapNodeComponent, (prevProps, nextProps) => {
  if (prevProps.selected !== nextProps.selected) return false;
  if (prevProps.isConnectable !== nextProps.isConnectable) return false;
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

EditableMindmapNode.displayName = 'EditableMindmapNode';

export function MindmapBoardContent({ rawData, currentFileName, positions, onDeleteNodes, setMindmapData, onNodesSelect, selectedNodeIds = [] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getNodes, screenToFlowPosition } = useReactFlow();

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const onEdgesChangeCustom = useCallback((changes) => { onEdgesChange(changes); }, [onEdgesChange]);

  const nodeTypes = useMemo(() => ({
    default: EditableMindmapNode,
    proposalNode: EditableMindmapNode
  }), []);

  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);

  useEffect(() => {
    if (!rawData || !rawData.nodes) return;

    const flatNodes = (rawData.nodes || []).map(node => {
      let borderColor = node.borderColor || 'var(--default-node-border)';
      let backgroundColor = borderColor !== 'var(--default-node-border)'
        ? `${borderColor}40`
        : `color-mix(in srgb, var(--default-node-border) 25%, transparent)`;

      if (node.status === 'updated') {
        borderColor = '#eedf59';
        backgroundColor = 'rgba(243, 246, 59, 0.15)';
      } else if (node.status === 'deleted') {
        borderColor = '#ef4444';
        backgroundColor = 'rgba(239, 68, 68, 0.15)';
      } else if (node.status === 'added') {
        borderColor = '#22c55e';
        backgroundColor = 'rgba(34, 197, 94, 0.15)';
      }

      const alignedWidth = Math.round((node.width || 210) / 30) * 30;
      const nodeData = {
        label: node.label,
        isRootNode: node.isRootNode || node.id === 'root',
        width: alignedWidth,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        status: node.status,
        oldLabel: node.oldLabel,
        isNewInstantEditing: node.isNewInstantEditing
      };

      return {
        id: node.id,
        type: node.status ? 'proposalNode' : 'default',
        data: nodeData,
        position: positionsRef.current?.[node.id] || { x: 0, y: 0 },
        style: { width: alignedWidth, background: 'none', border: 'none', padding: 0, boxShadow: 'none', zIndex: node.status ? 1 : 0 }
      };
    });

    const flatEdges = (rawData.edges || []).map(edge => {
      let edgeStyle = { stroke: 'var(--text)' };
      const targetNode = rawData.nodes.find(n => n.id === edge.target);
      if (targetNode) {
        if (targetNode.status === 'deleted') edgeStyle = { stroke: '#ef4444', strokeDasharray: '5,5' };
        else if (targetNode.status === 'added') edgeStyle = { stroke: '#22c55e', strokeWidth: 2 };
      }
      return { ...edge, style: edgeStyle };
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flatNodes, flatEdges);
    const savedPositions = positionsRef.current || {};
    const currentSelectedIds = selectedNodeIdsRef.current || [];

    let hasNewPositions = false;
    const updatedPositions = { ...savedPositions };

    const finalNodes = layoutedNodes.map(node => {
      let baseNode = { ...node };
      if (savedPositions[node.id]) {
        baseNode.position = savedPositions[node.id];
      } else {
        updatedPositions[node.id] = node.position;
        hasNewPositions = true;
      }
      if (currentSelectedIds.includes(node.id)) baseNode.selected = true;
      return baseNode;
    });

    if (hasNewPositions) {
      setMindmapData(prev => {
        if (!prev) return prev;
        return { ...prev, positions: { ...(prev.positions || {}), ...updatedPositions } };
      });
    }

    setNodes(finalNodes);
    setEdges(layoutedEdges);
  }, [rawData, setNodes, setEdges, setMindmapData]);

  const onNodesChangeCustom = useCallback((changes) => {
    const filteredChanges = changes.filter(c => !(c.type === 'remove' && c.id === 'root'));
    onNodesChange(filteredChanges);
    const removeChanges = filteredChanges.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      window.dispatchEvent(new CustomEvent('reactflow-nodes-delete', { detail: { nodeIds: removeChanges.map(c => c.id) } }));
    }
  }, [onNodesChange]);

  const onNodeDragStopCustom = useCallback((event, node) => {
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
   }, [getNodes, setMindmapData]);

  const onSelectionChangeCustom = useCallback(({ nodes: selected }) => {
    const newIds = selected.map(n => n.id);
    const oldIds = selectedNodeIdsRef.current;
    if (newIds.length !== oldIds.length || newIds.some((id, index) => id !== oldIds[index])) {
      onNodesSelect(newIds);
    }
    window.dispatchEvent(new CustomEvent('reactflow-all-nodes-init', { detail: { nodes: getNodes() } }));
  }, [onNodesSelect, getNodes]);

  const handleNodeResize = useCallback((e) => {
    const { nodeId, width, isDragging } = e.detail;
    if (isDragging) {
      const currentFlowNodes = nodesRef.current;
      const activeSelection = currentFlowNodes.filter(n => n.selected).map(n => n.id);
      const targetNodeIds = activeSelection.includes(nodeId) ? activeSelection : [nodeId];
      targetNodeIds.forEach(id => {
        const nodeElement = document.querySelector(`[data-id="${id}"]`);
        if (nodeElement) {
          nodeElement.style.width = `${width}px`;
          const innerNode = nodeElement.querySelector('.node-content-wrapper')?.parentNode;
          if (innerNode) innerNode.style.width = `${width}px`;
        }
      });
      return;
    }

    const flowNodes = getNodes();
    const activeSelection = flowNodes.filter(n => n.selected).map(n => n.id);
    const targetNodeIds = activeSelection.includes(nodeId) ? activeSelection : [nodeId];

    startTransition(() => {
      setNodes((nds) => nds.map((node) => {
        if (targetNodeIds.includes(node.id)) {
          return { ...node, style: { ...node.style, width: width }, data: { ...node.data, width: width } };
        }
        return node;
      }));
    });

    setMindmapData((prev) => {
      if (!prev || !prev.nodes) return prev;
      const newNodes = prev.nodes.map(node => targetNodeIds.includes(node.id) ? { ...node, width: width } : node);
      return { ...prev, nodes: newNodes };
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
      const { nodeIds, field, value } = e.detail;
      setNodes((nds) => nds.map((node) => {
        if (nodeIds.includes(node.id)) {
          if (field === 'label') return { ...node, data: { ...node.data, label: value } };
          if (field === 'borderColor') return { ...node, style: { ...node.style, borderColor: value } };
        }
        return node;
      }));
      window.dispatchEvent(new CustomEvent('reactflow-nodes-data-update', { detail: { nodeIds, field, value } }));
    };
    window.addEventListener('reactflow-update-nodes-data', handleUpdateNodesData);
    window.addEventListener('reactflow-live-label', handleUpdateNodesData);
    return () => {
      window.removeEventListener('reactflow-update-nodes-data', handleUpdateNodesData);
      window.removeEventListener('reactflow-live-label', handleUpdateNodesData);
    };
  }, [setNodes]);

  useEffect(() => {
    const handleGetAllNodes = () => {
      window.dispatchEvent(new CustomEvent('reactflow-all-nodes-init', { detail: { nodes: getNodes() } }));
    };
    window.addEventListener('reactflow-get-all-nodes', handleGetAllNodes);
    return () => window.removeEventListener('reactflow-get-all-nodes', handleGetAllNodes);
  }, [getNodes]);

  return (
    <div onDoubleClick={(event) => {
        event.preventDefault();
        if (event.target.classList.contains('react-flow__pane')) {
          const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          window.dispatchEvent(new CustomEvent('reactflow-node-create', { detail: { position: { x: position.x - 100, y: position.y - 35 }, parentId: null } }));
        }
      }}
      style={{ width: '100%', height: '100%', outline: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', userSelect: 'none', display: 'flex' }}
    >
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
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
        {nodes.some(n => selectedNodeIds.includes(n.id) && !!n.data?.status) && (
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

export function MindmapBoard(props){
  return (
    <ReactFlowProvider>
      <MindmapBoardContent {...props} />
    </ReactFlowProvider>
  );
}
