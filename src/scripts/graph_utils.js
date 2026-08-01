// Shared data + logic for the lobbying-network graph views: the hero preview
// (nwk_view.astro) and the full explorer chart (observable_nwk_viz.js). Keeping this here
// means the two views stay in sync on node/link selection and color-coding without
// reimplementing the same logic twice.
//
// No d3 import here on purpose: observable_nwk_viz.js receives d3 injected by the Observable
// runtime rather than importing it, so anything this module needs from d3 (schemeSet2) is
// inlined as data and turned into a scale by each caller with its own local d3.

export function fetchGraphJSON(path) {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
    return r.json();
  });
}

// d3.forceLink mutates link.source/target from a plain id into the resolved node object once
// a simulation has ticked, so any code reading source/target after that must go through here.
export const idOf = (ep) => (typeof ep === "object" ? ep.id : ep);

export function topNodesByFlow(data, n) {
  return [...data.nodes].sort((a, b) => b.flow - a.flow).slice(0, n).map((d) => ({ ...d }));
}

export function linksAmongNodes(links, nodes) {
  const ids = new Set(nodes.map((d) => d.id));
  return links
    .filter((l) => ids.has(idOf(l.source)) && ids.has(idOf(l.target)))
    .map((d) => ({ ...d }));
}

// Org-type -> color. The single source of truth for node fill color, shared by the hero
// preview and the full explorer so the two views read as the same visual language.
export const orgColorMap = {
  ngo_o: "#6F54F5",
  engo: "#54F472",
  hngo: "#B34CFF",
  biz: "#EBBD18",
  trd_assn: "#B38E00",
  ind: "#592D1A",
  p_org: "#ADADAD",
  muni: "#F371A6",
  edu: "#FFe9F2",
  tribe: "#FF9400",
  union: "#FF4F29",
};

// d3.schemeSet2, inlined so this module has no d3 dependency.
export const moduleColorScheme = [
  "#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3",
];

// Standard d3-force drag: pins the dragged node (fx/fy) and reheats the simulation while
// dragging. Takes d3 as a parameter (rather than importing it) so this stays usable from
// observable_nwk_viz.js, which receives d3 injected by the Observable runtime.
export function makeDragBehavior(d3, simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = event.subject.fy = null;
  }
  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

// Hull circle per module: centered on the mean position of its nodes, radius reaching the
// farthest node plus padding. Meant to be recomputed every simulation tick.
export function moduleHullData(nodes, padding = 10) {
  const byModule = new Map();
  for (const d of nodes) {
    if (!byModule.has(d.module_id)) byModule.set(d.module_id, []);
    byModule.get(d.module_id).push(d);
  }
  return [...byModule.entries()].map(([module_id, groupNodes]) => {
    const cx = groupNodes.reduce((s, d) => s + d.x, 0) / groupNodes.length;
    const cy = groupNodes.reduce((s, d) => s + d.y, 0) / groupNodes.length;
    const r = Math.max(...groupNodes.map((d) => Math.hypot(d.x - cx, d.y - cy))) + padding;
    return { module_id, cx, cy, r };
  });
}
