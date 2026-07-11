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
  proposalNode: ProposalNode
};

 
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
      oldLabel: node.oldLabel 
    },
    position: { x: 0, y: 0 },
    style: {
      background: backgroundColor,
      color: 'var(--text-h)',
      border: isRootNode ? `4px solid ${borderColor}` : `2px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '10px',
      fontWeight: isRootNode ? '800' : 'normal',
      fontSize: isRootNode ? '16px' : '14px'
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

function ProposalNode({ id, data }) {
  const handleDecision = (accepted) => {
    window.dispatchEvent(new CustomEvent('proposalDecision', {
      detail: { nodeId: id, accepted } // Übergibt die ID des Knotens direkt
    }));
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
        background: 'none', border: 'none',
        padding: '4px', display: 'flex', gap: '6px', fontSize: '12px'
      }}>
        <button
          onClick={() => handleDecision(true)}
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
            height: '32px',
            zIndex: 100
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
          onClick={() => handleDecision(false)}
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
            height: '32px',
            zIndex: 100
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

      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div>
        {data.status === 'updated' && data.oldLabel && (
          <div style={{ fontSize: '10px', textDecoration: 'line-through', opacity: 0.5, marginBottom: '2px' }}>
            {data.oldLabel}
          </div>
        )}
        <div style={{ fontWeight: '600' }}>{data.label}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}


function MindmapBoardContent({ rawData, currentFileName, positions, setMindmapData, onNodesSelect, selectedNodeIds = [] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getViewport, setViewport, getNodes, fitView } = useReactFlow();

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

    const { nodes: flatNodes, edges: flatEdges } = convertTreeToFlow(rawData, null, { nodes: [], edges: [] });
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flatNodes, flatEdges);

    const savedPositions = positionsRef.current || {};
    const currentSelectedIds = selectedNodeIdsRef.current || [];

    const finalNodes = layoutedNodes.map(node => {
      let baseNode = { ...node };
      if (savedPositions[node.id]) {
        baseNode.position = savedPositions[node.id];
      }
      if (currentSelectedIds.includes(node.id)) {
        baseNode.selected = true;
      }
      return baseNode;
    });

    setNodes(finalNodes);
    setEdges(layoutedEdges);
  }, [rawData, setNodes, setEdges]);


  const onNodesChangeCustom = (changes) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));

    // Nur wenn ein Knoten gelöscht oder hinzugefügt wird, die übergeordnete App informieren
    const structuralChange = changes.some(c => c.type !== 'position' && c.type !== 'select');
    if (structuralChange) {
      onNodesChange(changes);
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
    if( e.button === 1) {
      e.preventDefault();
    }
    if (e.button === 2) {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
  };

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
          onNodesChange={onNodesChangeCustom}
          onNodeDragStop={(event, node) => {
           setMindmapData((prev) => {
              if (!prev) return prev;
              const newPositions = { ...(prev.positions || {}) };
              const gridSize = 15;
              
              const snappedX = Math.round(node.position.x / gridSize) * gridSize;
              const snappedY = Math.round(node.position.y / gridSize) * gridSize;
              newPositions[node.id] = { x: snappedX, y: snappedY };

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
              style={{ cursor: 'pointer', color: '#fff', border: '1px solid var(--accent)', 
                      padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className='span_BulkDecisionAkzeptierenAblehnen'>Akzeptieren </span><Check size={15} strokeWidth={2.5} style={{ transform: 'translate(0px, 0px)' }}/>
            </button>
            <button
              onClick={() => handleBulkDecision(false)}
              className='animationWelle animationWelleRechts'
              style={{ cursor: 'pointer', color: '#fff', border: '1px solid var(--accent)', 
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