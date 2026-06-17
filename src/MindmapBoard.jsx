import { useEffect, useState } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; // Die Standard-Stile für das Board
import { getLayoutedElements } from './utils/layout';

// Diese Funktion verwandelt das verschachtelte KI-JSON rekursiv in flache React-Flow-Daten
function convertTreeToFlow(node, parentId = null, elements = { nodes: [], edges: [] }) {
  // 1. Knoten für React Flow bauen
  elements.nodes.push({
    id: node.id,
    data: { label: node.label },
    // Startposition (wird gleich von dagre überschrieben)
    position: { x: 0, y: 0 }, 
    style: {
      background: 'var(--bg)',
      color: 'var(--text-h)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '10px',
      boxShadow: 'var(--shadow)'
    }
  });

  // 2. Verbindungslinie vom Vater zum Kind bauen
  if (parentId) {
    elements.edges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      animated: true, // Macht die Verbindungslinien lebendig
      style: { stroke: 'var(--accent)' }
    });
  }

  // 3. Rekursiv durch alle Kinder gehen
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(child => convertTreeToFlow(child, node.id, elements));
  }

  return elements;
}

export function MindmapBoard({ rawData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!rawData) return;

    // 1. Konvertiere das Baum-JSON in flache Listen
    const { nodes: flatNodes, edges: flatEdges } = convertTreeToFlow(rawData);
    
    // 2. Jag die Listen durch dagre für automatische Koordinaten
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flatNodes, flatEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawData, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginTop: '0px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView // Zoomt beim Laden automatisch so, dass man alles sieht
      >
        <Background color="var(--text)" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}