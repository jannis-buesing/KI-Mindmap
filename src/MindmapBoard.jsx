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
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLayoutedElements } from './utils/layout';


 
// Diese Funktion verwandelt das verschachtelte KI-JSON rekursiv in flache React-Flow-Daten
function convertTreeToFlow(node, parentId = null, elements = { nodes: [], edges: [] }) {
  const borderColor = node.borderColor || 'var(--default-node-border)';
  const hasCustomColor = node.borderColor && node.borderColor !== 'var(--default-node-border)';

  const backgroundColor = hasCustomColor 
    ? `${borderColor}40`
    : `color-mix(in srgb, var(--default-node-border) 25%, transparent)`;

  elements.nodes.push({
    id: node.id,
    data: { label: node.label },
    position: { x: 0, y: 0 }, 
    style: {
      background: backgroundColor,
      color: 'var(--text-h)',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '10px',
      boxShadow: 'var(--shadow)',
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    }
  });

  // 2. Verbindungslinie vom Vater zum Kind bauen
  if (parentId) {
    elements.edges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      animated: true,
      style: { stroke: 'var(--accent)' }
    });
  }

  // 3. Rekursiv durch alle Kinder gehen
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => convertTreeToFlow(child, node.id, elements));
  }

  return elements;
}

function MindmapBoardContent({ rawData, currentFileName, positions, setMindmapData, onNodesSelect, selectedNodeIds = [] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { getViewport, setViewport, getNodes, fitView } = useReactFlow();

  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
  if (!currentFileName) return;

  const timer = setTimeout(() => {
    if (typeof fitView === 'function') {
      fitView({ padding: 0.2, duration: 0 });
    }
  }, 50);

    return () => clearTimeout(timer);
  }, [currentFileName, fitView]);

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    if (!rawData) return;

    console.log("neu Update");

    // 1. Konvertiere das Baum-JSON in flache Listen
    const { nodes: flatNodes, edges: flatEdges } = convertTreeToFlow(rawData);
    
    // 2. Jag die Listen durch dagre für automatische Koordinaten
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flatNodes, flatEdges);

    // 3. Vorhandene gespeicherte Positionen anwenden
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

  useEffect(() => {
    if (!rawData) return;
    
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        // Wir durchsuchen rekursiv den aktuellen rawData-Baum nach diesem Knoten
        const findNodeInTree = (treeNode) => {
          if (treeNode.id === node.id) return treeNode;
          if (treeNode.children) {
            for (const child of treeNode.children) {
              const found = findNodeInTree(child);
              if (found) return found;
            }
          }
          return null;
        };

        const updatedData = findNodeInTree(rawData);
        if (updatedData) {
        // Gleiche Logik wie oben für konsistente Updates
        const borderColor = updatedData.borderColor || 'var(--default-node-border)';
        const hasCustomColor = updatedData.borderColor && updatedData.borderColor !== 'var(--default-node-border)';
        const backgroundColor = hasCustomColor 
          ? `${borderColor}40`
          : `color-mix(in srgb, var(--default-node-border) 25%, transparent)`;

        return {
          ...node,
          data: { ...node.data, label: updatedData.label },
          style: { 
            ...node.style, 
            border: `1px solid ${borderColor}`,
            background: backgroundColor
          }
        };
      }
      return node;
    })
    );
  }, [rawData, setNodes]);

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
        height: '80vh', 
        border: '1px solid var(--border)', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        marginTop: '0px', 
        userSelect: 'none',
        display: 'flex' // NEU: Aktiviert Flexbox, damit Sidebar rechts daneben steht
      }}
    >
      {/* ReactFlow in ein eigenes Flex-Container-Div packen */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <ReactFlow
          proOptions={proOptions}
          nodes={nodes}
          edges={edges}
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
          fitView={true}
          nodesDraggable={true}
          panOnDrag={false}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          zoomOnScroll={true}
          selectionOnDrag={true}
          selectionKeyCode={null}
          selectionMode='partial'
          translateExtent={[[-1000, -1000], [2000, 2000]]}
          nodeExtent={[[-1000, -1000], [2000, 2000]]}
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
