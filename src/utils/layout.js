import dagre from 'dagre';

export function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  // Weist dagre an, von links nach rechts zu layouten ('LR')
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  // Knoten an dagre übergeben
  nodes.forEach((node) => {
    g.setNode(node.id, { width: 180, height: 40 });
  });

  // Verbindungen an dagre übergeben
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Layout berechnen
  dagre.layout(g);

  // Koordinaten an die React-Flow-Knoten zurückgeben
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90, // Zentrierung der Knoten
        y: nodeWithPosition.y - 20,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}