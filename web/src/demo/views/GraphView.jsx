// A small transfer graph: one account in the middle, who it deals with around it, and who they deal
// with beyond that. Shared by the mule, tracing and entity-link demos, so it knows nothing about any of
// them: a demo hands it `item.graph = { focus, nodes: [{ id, label, note }], edges: [{ from, to, weight, label }] }`
// and the view works out the rest. Hop distance from the focus decides what is bright and what is dim.
//
// No physics: neighbours sit on a ring at fixed angles, so the same item draws the same picture every
// time it is played, which is what a recorded run needs.

const SIZE = { width: 640, height: 380 };
const RINGS = [0, 118, 176];

/** Hop distance from the focus, following edges in either direction, capped at 2. */
function hops(graph) {
  const neighbours = new Map(graph.nodes.map((node) => [node.id, new Set()]));
  for (const edge of graph.edges) {
    neighbours.get(edge.from)?.add(edge.to);
    neighbours.get(edge.to)?.add(edge.from);
  }
  const distance = new Map([[graph.focus, 0]]);
  let frontier = [graph.focus];
  for (let hop = 1; hop <= 2; hop++) {
    const next = [];
    for (const id of frontier) {
      for (const other of neighbours.get(id) ?? []) {
        if (distance.has(other)) continue;
        distance.set(other, hop);
        next.push(other);
      }
    }
    frontier = next;
  }
  return distance;
}

/** Fixed places on two rings, ordered so the picture is stable between runs. */
function positions(graph, distance) {
  const centre = { x: SIZE.width / 2, y: SIZE.height / 2 };
  const rings = [[], [], []];
  for (const node of graph.nodes) rings[distance.get(node.id) ?? 2].push(node.id);
  const places = new Map([[graph.focus, centre]]);

  rings.forEach((ids, hop) => {
    if (hop === 0) return;
    ids.forEach((id, index) => {
      const angle = (index / Math.max(ids.length, 1)) * Math.PI * 2 - Math.PI / 2 + (hop === 2 ? 0.25 : 0);
      places.set(id, { x: centre.x + Math.cos(angle) * RINGS[hop] * 1.5, y: centre.y + Math.sin(angle) * RINGS[hop] });
    });
  });
  return places;
}

const strokeFor = (weight, most) => 1 + Math.min(6, (weight / (most || 1)) * 6);

export function GraphView({ item, demo }) {
  const graph = item.graph;
  if (!graph?.nodes?.length) {
    return <p className="meta">This item has no graph to draw.</p>;
  }

  const distance = hops(graph);
  const places = positions(graph, distance);
  const most = Math.max(...graph.edges.map((edge) => edge.weight ?? 1), 1);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const label = (id) => nodeById.get(id)?.label ?? id;
  const near = graph.edges.filter((edge) => distance.get(edge.from) === 0 || distance.get(edge.to) === 0);

  return (
    <div className="stack graph-view" style={{ gap: 12 }}>
      <div className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">{item.id}</span>
        <h3>{demo?.itemLabel?.(item) ?? item.id}</h3>
      </div>

      <svg
        className="transfer-graph"
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        role="img"
        aria-label={`${label(graph.focus)} and ${graph.nodes.length - 1} accounts around it, with ${graph.edges.length} transfers. ${near.map((edge) => `${label(edge.from)} to ${label(edge.to)}${edge.label ? `, ${edge.label}` : ''}`).join('; ')}`}
      >
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        {graph.edges.map((edge, index) => {
          const from = places.get(edge.from);
          const to = places.get(edge.to);
          if (!from || !to) return null;
          const touchesFocus = edge.from === graph.focus || edge.to === graph.focus;
          return (
            <line
              key={`${edge.from}-${edge.to}-${index}`}
              className={touchesFocus ? 'edge near' : 'edge far'}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeWidth={strokeFor(edge.weight ?? 1, most)}
              markerEnd="url(#graph-arrow)"
            />
          );
        })}

        {graph.nodes.map((node) => {
          const place = places.get(node.id);
          if (!place) return null;
          const hop = distance.get(node.id) ?? 2;
          return (
            <g key={node.id} className={`node hop-${hop}`} transform={`translate(${place.x} ${place.y})`}>
              <circle r={hop === 0 ? 26 : 16} />
              <text y={hop === 0 ? 44 : 32}>{node.label ?? node.id}</text>
              {node.note && hop <= 1 && <text className="node-note" y={hop === 0 ? 58 : 45}>{node.note}</text>}
            </g>
          );
        })}
      </svg>

      <details className="graph-table">
        <summary>Transfers as a table</summary>
        <div className="table-scroll details-content">
          <table className="data-table compact">
            <thead>
              <tr><th scope="col">From</th><th scope="col">To</th><th scope="col">What</th></tr>
            </thead>
            <tbody>
              {graph.edges.map((edge, index) => (
                <tr key={`${edge.from}-${edge.to}-row-${index}`}>
                  <td>{label(edge.from)}</td>
                  <td>{label(edge.to)}</td>
                  <td>{edge.label ?? edge.weight ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
