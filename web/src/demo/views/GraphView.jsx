// A small transfer graph: one account in the middle, who it deals with around it, and who they deal
// with beyond that. Shared by the mule, tracing and entity-link demos, so it knows nothing about any of
// them: a demo hands it `item.graph = { focus, nodes: [{ id, label, note }], edges: [{ from, to, weight, label }] }`
// and the view works out the rest. Hop distance from the focus decides what is bright and what is dim.
//
// No physics: places are fixed, so the same item draws the same picture every time it is played, which
// is what a recorded run needs. A neighbourhood sits on rings around the focus; a trace, where the money
// moves on hop after hop, is laid out left to right in lanes so that every hop is visible.

import { Record } from './fields.jsx';

const SIZE = { width: 640, height: 380 };
const RINGS = [0, 118, 176];

const FAR = 99;

/** Hop distance from the focus, following edges in either direction, as far as the graph goes. */
function hops(graph) {
  const neighbours = new Map(graph.nodes.map((node) => [node.id, new Set()]));
  for (const edge of graph.edges) {
    neighbours.get(edge.from)?.add(edge.to);
    neighbours.get(edge.to)?.add(edge.from);
  }
  const distance = new Map([[graph.focus, 0]]);
  let frontier = [graph.focus];
  for (let hop = 1; frontier.length && hop < FAR; hop++) {
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

/** One lane per hop, left to right, for a graph that runs deeper than two hops from its focus. */
function lanes(graph, distance, depth) {
  const columns = Array.from({ length: depth + 1 }, () => []);
  for (const node of graph.nodes) columns[Math.min(distance.get(node.id) ?? depth, depth)].push(node.id);
  const places = new Map();
  columns.forEach((ids, hop) => {
    ids.forEach((id, index) => {
      places.set(id, {
        x: 60 + (hop / Math.max(depth, 1)) * (SIZE.width - 120),
        y: ((index + 1) / (ids.length + 1)) * (SIZE.height - 60) + 20,
      });
    });
  });
  return places;
}

/** Fixed places on two rings, ordered so the picture is stable between runs. */
function positions(graph, distance) {
  const centre = { x: SIZE.width / 2, y: SIZE.height / 2 };
  const rings = [[], [], []];
  for (const node of graph.nodes) rings[Math.min(distance.get(node.id) ?? 2, 2)].push(node.id);
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

export function GraphView({ item, demo, compact = false }) {
  const graph = item.graph;
  if (!graph?.nodes?.length) {
    return <p className="meta">This item has no graph to draw.</p>;
  }

  const distance = hops(graph);
  const depth = Math.max(...graph.nodes.map((node) => distance.get(node.id) ?? 0));
  const places = depth > 2 ? lanes(graph, distance, depth) : positions(graph, distance);
  const { graph: _drawn, ...rest } = item;
  const most = Math.max(...graph.edges.map((edge) => edge.weight ?? 1), 1);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const label = (id) => nodeById.get(id)?.label ?? id;
  const near = graph.edges.filter((edge) => distance.get(edge.from) === 0 || distance.get(edge.to) === 0);

  return (
    <div className="stack graph-view" style={{ gap: 12 }}>

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
          // Stop the line at the rim of the target circle, so the arrowhead is not hidden under it.
          const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          const rim = (edge.to === graph.focus ? 26 : 16) + 4;
          const end = { x: to.x - ((to.x - from.x) / length) * rim, y: to.y - ((to.y - from.y) / length) * rim };
          return (
            <g key={`${edge.from}-${edge.to}-${index}`} className={touchesFocus || depth > 2 ? 'edge near' : 'edge far'}>
              <line x1={from.x} y1={from.y} x2={end.x} y2={end.y} strokeWidth={strokeFor(edge.weight ?? 1, most)} markerEnd="url(#graph-arrow)" />
              {edge.label && (touchesFocus || depth > 2) && graph.edges.length <= 14 && (
                <text className="edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 5}>
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {graph.nodes.map((node) => {
          const place = places.get(node.id);
          if (!place) return null;
          const hop = distance.get(node.id) ?? 2;
          return (
            <g key={node.id} className={`node hop-${depth > 2 ? Math.min(hop, 1) : Math.min(hop, 2)}`} transform={`translate(${place.x} ${place.y})`}>
              <circle r={hop === 0 ? 26 : 16} />
              <text y={hop === 0 ? 44 : 32}>{node.label ?? node.id}</text>
              {node.note && hop <= 1 && <text className="node-note" y={hop === 0 ? 58 : 45}>{node.note}</text>}
            </g>
          );
        })}
      </svg>

      {/* On a presenter beat the picture is the point; the fields and the table stay on the demo page. */}
      {!compact && Object.keys(rest).length > 1 && <Record record={rest} hide={['id', ...(demo?.stage?.hide ?? [])]} labels={demo?.stage?.labels} highlight={demo?.stage?.highlight} />}

      {!compact && (
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
      )}
    </div>
  );
}
