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

// The generated graph JSONs (public/data/**) are gitignored — too large to commit — and only
// actually exist in R2. Any code that wants one of these datasets, at build time or runtime,
// must go through R2 rather than assuming a local file exists.
export const R2_BASE_URL = "https://pub-88f9b6b7dae846e9b9fe6489e8c253b0.r2.dev";

export function toR2Url(datasetPath) {
  return R2_BASE_URL + datasetPath;
}

export function fetchGraphJSONFromR2(datasetPath) {
  return fetchGraphJSON(toR2Url(datasetPath));
}

// Naming convention for the R2 bucket's nwks_base_weights/*.json and
// nwks_spending_weights/*.json objects (no "data/" prefix — that only applies to the local
// public/data/ mirror used for static assets, not the R2 keys these paths are appended to):
// base weights are final_{agency}_{yr}_infomap.json (no log/nolog split); spending weights are
// final_{log|nolog}_{agency}_{yr}_infomap.json. Not every agency/year combo exists.
export const ANNUAL_WEIGHT_TYPES = ["base", "spending"];
export const ANNUAL_YEARS = Array.from({ length: 22 }, (_, i) => 2000 + i);
export const LOG_OPTIONS = ["logged", "unlogged"];

export function annualPerAgencyPath(agency, weightType, yr, log) {
  if (weightType === "base") {
    return `/nwks_base_weights/final_${agency}_${yr}_infomap.json`;
  }
  const log_str = log === "logged" ? "log" : "nolog";
  return `/nwks_spending_weights/final_${log_str}_${agency}_${yr}_infomap.json`;
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
  engo: "#54F472",
  firms_trd_assns: "#EBBD18",
  ind: "#592D1A",
  muni: "#F371A6",
  tribe: "#FF9400",
  other: "#ADADAD"
};

// export const orgColorMap = {
//   ngo_o: "#6F54F5",
//   engo: "#54F472",
//   hngo: "#B34CFF",
//   biz: "#EBBD18",
//   trd_assn: "#B38E00",
//   ind: "#592D1A",
//   p_org: "#ADADAD",
//   muni: "#F371A6",
//   edu: "#FFe9F2",
//   tribe: "#FF9400",
//   union: "#FF4F29",
// };

// Raw org_typ codes -> the collapsed categories used by orgColorMap above. Nodes fetched from
// R2 still carry the fine-grained codes, so any code coloring/grouping by org_typ must run
// values through collapseOrgType first or they'll fall through to org_color's unknown() gray.
const orgTypeGroups = {
  ngo_o: "other",
  hngo: "other",
  edu: "other",
  union: "other",
  p_org: "other",
  biz: "firms_trd_assns",
  trd_assn: "firms_trd_assns",
};

export function collapseOrgType(org_typ) {
  return orgTypeGroups[org_typ] ?? org_typ;
}

// orgColorMap keys -> human-readable legend labels.
export const orgTypeLabels = {
  engo: "Environmental NGO",
  firms_trd_assns: "Firm/Trade Assoc.",
  ind: "Independent",
  muni: "Municipal",
  tribe: "Tribe",
  other: "Other"

};

export const orgTypeLabel = (org_typ) => orgTypeLabels[org_typ] ?? org_typ;

// orgTypeLabels as an ordered {value, label} list, for controls (checkboxes, dropdowns) that
// need to render every collapsed org type rather than just look one label up.
export const ORG_TYPES = Object.entries(orgTypeLabels).map(([value, label]) => ({ value, label }));

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
