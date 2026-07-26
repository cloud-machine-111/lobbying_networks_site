function _1(md){return(
md`# Lobbying Networks

Using [Plot](/@observablehq/plot). Other [database clients](https://observablehq.com/@observablehq/databases) are available.`
)}

function _data(DATASET_PATH){
  return fetch(DATASET_PATH).then(r => r.json());
}

function _NODES_SHOWN(Inputs){return(
Inputs.range([1, 400], {value: 80, step: 1, label: "Nodes shown"})
)}

function _chart(d3,data,NODES_SHOWN,invalidation)
{
  // ---------------------------------------------------------------------------
  // 1. CONFIGURATION & STATE MANAGEMENT
  // ---------------------------------------------------------------------------
  const width = 828, height = 628;
  const NEON_COLOR = "#ccff00";
  const FONT_FAMILY = "'Helvetica', Sans-serif";

  let PRIMARY_NODE = null;
  let SECONDARY_NODE = null;
  let SELECTED_EDGE = null;
  let SELECTED_BILL_ID = null;   // set by clicking a "top bills by frequency" row
  let HOVERED_MODULE = null;     // module_id currently hovered, for hull glow

  let FORCE_XY = .4;
  let FORCE_MANY_BODY = -200;

  // 1. Define your exact type-to-color mapping
  const orgColorMap = {
    "ngo_o":  "#6F54F5",
    "engo":    "#54F472",
    "hngo":    "#B34CFF",
    //
    "biz": "#EBBD18",
    "trd_assn":  "#B38E00",
    "ind":    "#592D1A",
    //
    "p_org":   "#ADADAD",
    "muni":    "#F371A6",
    "edu":    "#FFe9F2",
    "tribe":    "#FF9400",
    "union":    "#FF4F29",
  };

  // 2. Pass keys and values into scaleOrdinal
  const org_color = d3.scaleOrdinal()
    .domain(Object.keys(orgColorMap))
    .range(Object.values(orgColorMap))
    .unknown("#cccccc"); // Fallback color for unexpected org_types

  // Helper for tracking node/edge IDs across potential object mutations
  const idOf = ep => typeof ep === "object" ? ep.id : ep;

  // Filter top nodes by flow
  const topNodes = [...data.nodes].sort((a, b) => b.flow - a.flow).slice(0, NODES_SHOWN);

  // 1. Calculate aggregate flow per module across top nodes
  const moduleFlowTotals = d3.rollup(topNodes, v => d3.sum(v, d => d.flow), d => d.module_id);

  // 2. Filter out modules where total flow === 0, then sort remaining by flow (descending)
  const activeModules = [...moduleFlowTotals.entries()]
    .filter(([, totalFlow]) => totalFlow > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([module_id]) => module_id);
  const activeModuleSet = new Set(activeModules);

  // 3. Stable, full-dataset labels: every module that ever appears in data.nodes gets a
  // permanent letter, ranked by its total flow across the WHOLE dataset (not just the
  // current NODES_SHOWN cut). This keeps a module's letter from shifting as the slider moves,
  // and lets the sidebar list modules that aren't visible in the graph yet.
  const allModuleFlowTotals = d3.rollup(data.nodes, v => d3.sum(v, d => d.flow), d => d.module_id);
  const allModuleIds = [...allModuleFlowTotals.keys()]
    .sort((a, b) => allModuleFlowTotals.get(b) - allModuleFlowTotals.get(a));
  const moduleLabelMap = new Map(allModuleIds.map((id, i) => [id, String.fromCharCode(65 + i)]));

  // 4. Filter nodes/links to only keep those in active, non-zero modules
  const nodes = topNodes
    .filter(d => activeModuleSet.has(d.module_id))
    .map(d => ({ ...d }));

  const activeNodeIds = new Set(nodes.map(d => d.id));
  const links = data.links
    .filter(l => activeNodeIds.has(idOf(l.source)) && activeNodeIds.has(idOf(l.target)))
    .map(d => ({ ...d }));

  // Color & Radius Scales
  const radius = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.flow)]).range([1, 18]);
  const module_color = d3.scaleOrdinal(d3.schemeSet2).domain([...new Set(data.nodes.map(d => d.module_id))]);

  // 5. Build module centers using activeModules
  const moduleCenters = new Map(
    activeModules.map((m, i) => {
      const angle = (i / activeModules.length) * 2 * Math.PI;
      return [m, { x: 250 * Math.cos(angle) - width / 4, y: 250 * Math.sin(angle) }];
    })
  );

  // ---------------------------------------------------------------------------
  // 2. DOM CONTAINERS & TOOLTIP CREATION
  // ---------------------------------------------------------------------------
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [-width / 2, -height / 2, width, height])
    .attr("style", "max-width: 100%; height: auto;")
    .style("background", "#1c1c1c");

  const panel = d3.create("div")
    .attr("class", "info-panel")
    .style("width", "330px")
    .style("padding", "8px")
    // .style("font-family", "sans-serif")
    .style("font-family", FONT_FAMILY)
    .style("font-size", "13px")
    .style("border-left", "1px solid #333")
    .style("overflow-y", "auto")
    .style("max-height", `${height}px`)
    .style("background", "#232323")
    .style("color", "#fff");

  const tooltip = d3.select("body").append("div")
    .attr("class", "node-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("padding", "4px 8px")
    .style("font-family", FONT_FAMILY)
    // .style("font-family", "sans-serif")
    .style("font-size", "12px")
    .style("box-shadow", "0 1px 4px rgba(0,0,0,0.2)")
    .style("opacity", 0);

  const findEdge = (idA, idB) => links.find(l => {
    const s = idOf(l.source), t = idOf(l.target);
    return (s === idA && t === idB) || (s === idB && t === idA);
  });

  // Top 10 flow node IDs for stroke highlight styling
  const top10FlowIds = new Set(
    d3.rollups(nodes, g => [...g].sort((a, b) => b.flow - a.flow).slice(0, 10).map(d => d.id), d => d.module_id)
      .flatMap(([, ids]) => ids)
  );
  const baseStroke = d => top10FlowIds.has(d.id) ? NEON_COLOR : "#000";
  const baseStrokeWidth = d => top10FlowIds.has(d.id) ? 1.8 : 0.3;

  // ---------------------------------------------------------------------------
  // 3. GRAPH ELEMENTS (LINKS, NODES, HULLS, LEGEND)
  // ---------------------------------------------------------------------------
  // All pannable graph layers live inside panGroup so a single transform moves them together.
  const panGroup = svg.append("g").attr("class", "pan-group");
  const hullGroup = panGroup.append("g").attr("class", "hulls").lower();
  const linkGroup = panGroup.append("g").attr("class", "links");
  const nodeGroup = panGroup.append("g").attr("class", "nodes");
  const topLayer  = panGroup.append("g").attr("class", "top-layer");

  const link = linkGroup
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.2)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.sqrt(d.value));

  const node = nodeGroup
    .attr("stroke-width", 0.5)
    .selectAll("circle") // select all <circle> elts in NodeGroup
    .data(nodes) // bind each circle to a datum within nodes[]
    .join("circle") // shorthand that (1) creates new circles for new datum (2) updates circles for existing datums (3) removes DOM elt if delete.
    .attr("stroke", baseStroke) // customizes ea. node
    .attr("stroke-width", baseStrokeWidth)
    .attr("r", d => radius(d.flow))
    .attr("fill", d => org_color(d.org_typ));

  // Node Hover and Click Events
  node
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`<b> ${d.name} </b> <br> Flow: ${d.flow}`);
      legend.select("rect")
        .attr("stroke", ld => ld === d.org_typ ? NEON_COLOR : null)
        .attr("stroke-width", ld => ld === d.org_typ ? 2 : null);
      HOVERED_MODULE = d.module_id;
      updateHullStyles();
    })
    .on("mousemove", event => tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 20}px`))
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
      legend.select("rect").attr("stroke", null).attr("stroke-width", null);
      HOVERED_MODULE = null;
      updateHullStyles();
    })
    .on("click", (event, d) => { event.stopPropagation(); handleNodeClick(d); })
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

  svg.on("click", deselectAll);

  // Drag-to-pan: only engages when the gesture starts on empty canvas (not on a node),
  // so it never fights with node dragging or the deselect-click handler.
  let panOffset = { x: 0, y: 0 };
  let panStart = null;

  svg.call(
    d3.drag()
      .filter(event => event.target.tagName !== "circle")
      .on("start", event => {
        panStart = { x: panOffset.x, y: panOffset.y, px: event.x, py: event.y };
      })
      .on("drag", event => {
        panOffset.x = panStart.x + (event.x - panStart.px);
        panOffset.y = panStart.y + (event.y - panStart.py);
        panGroup.attr("transform", `translate(${panOffset.x},${panOffset.y})`);
      })
  );

  // ---------------------------------------------------------------------------
  // 4. CHART DECORATIONS (TITLES & LEGEND)
  // ---------------------------------------------------------------------------
  const yearText = data.metadata.yr ? `in ${data.metadata.yr}` : "across all time";
  
  const title = svg.append("text")
      .attr("x", 0)
      .attr("y", -height / 2 + 20)
      .attr("text-anchor", "middle")
      // .attr("font-family", "Monospace")
      .style("font-family", FONT_FAMILY)  
      .attr("font-size", 18)
      .attr("font-weight", "bold")
      .attr("fill", "#fff");
  
  // title - Line 1
  title.append("tspan")
    .text(`${data.metadata.agency} - lobbying ties ${yearText} `);
  
  // title - Line 2 (shifted down by 1.2em)
  title.append("tspan")
      .attr("x", 0)         // Re-align to center horizontally
      .attr("dy", "1.3em")   // Shift down vertically relative to line 1
      .style("font-style", "italic")
      .style("font-weight", "normal")
      .attr("font-size", 13)
      .text(`${data.metadata.log} on spending`);
  
  svg.append("text")
    .attr("x", -width / 2 + 20).attr("y", -height / 2 + 40)
    .attr("font-family", FONT_FAMILY).attr("font-size", 12).attr("font-weight", "bold")
    .attr("fill", "#fff")
    .text("Key");

  const legend = svg.append("g")
    .attr("font-family", FONT_FAMILY).attr("font-size", 10).attr("text-anchor", "start")
    .selectAll("g")
    .data(org_color.domain())
    .join("g")
    .attr("transform", (_, i) => `translate(${-width / 2 + 20}, ${-height / 2 + 50 + i * 20})`);

  legend.append("rect").attr("width", 12).attr("height", 12).attr("fill", d => org_color(d));
  legend.append("text").attr("x", 18).attr("y", 10).attr("fill", "#fff").text(d => d);

  // ---------------------------------------------------------------------------
  // 5. SIDE PANEL & DATA VISUALIZATION FUNCTIONS
  // ---------------------------------------------------------------------------

  // Keeps a reference to every bill-frequency row across all modules, so a click on one of
  // them can be reflected (background highlight) without re-rendering the whole panel.
  let allBillRows = [];

  // Tally top bill frequencies for edges within a given module
  function getModuleBillFrequency(module_id) {
    const idsInModule = new Set(nodes.filter(n => n.module_id === module_id).map(n => n.id));
    const freq = new Map();
    links.forEach(l => {
      const s = idOf(l.source), t = idOf(l.target);
      if (idsInModule.has(s) && idsInModule.has(t) && Array.isArray(l.bills)) {
        l.bills.forEach(b => {
          if (!freq.has(b.B_ID)) freq.set(b.B_ID, { title: b.bill_title, count: 0 });
          freq.get(b.B_ID).count++;
        });
      }
    });
    return [...freq.entries()]
      .map(([B_ID, v]) => ({ B_ID, title: v.title, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // Render text list for bill frequency rankings. Clicking a row selects that bill: matching
  // edges go neon @ 0.8 opacity, and stays selected until the background is clicked.
  function drawBillFreqList(container, billData, chartTitle) {
    container.append("div").style("font-weight", "bold").style("margin-top", "10px").text(chartTitle);
    if (!billData.length) {
      container.append("div").style("font-style", "italic").style("font-size", "10px").text("No bills found.");
      return;
    }
    const rows = container.selectAll(null)
      .data(billData)
      .join("div")
      .style("display", "flex").style("justify-content", "space-between").style("font-size", "10px")
      .style("padding", "2px 0").style("border-bottom", "1px solid #333")
      .style("cursor", "pointer")
      .html(d => `<span>${d.title.length > 45 ? d.title.slice(0, 44) + "…" : d.title}</span><span style="margin-left:6px;">${d.count}</span>`)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1).html(`${d.title} (${d.B_ID}): ${d.count} edge(s)`);
        // Turn every visible edge carrying this bill neon yellow, without touching opacity.
        link.attr("stroke", ld => (Array.isArray(ld.bills) && ld.bills.some(b => b.B_ID === d.B_ID))
          ? NEON_COLOR
          : (ld === SELECTED_EDGE || (Array.isArray(ld.bills) && ld.bills.some(b => b.B_ID === SELECTED_BILL_ID)) ? NEON_COLOR : "white"));
      })
      .on("mousemove", event => tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 20}px`))
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        updateStyles();
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        handleBillClick(d.B_ID);
      });

    allBillRows.push(rows);
  }

  // Render comparative horizontal bar charts inside side panel.
  // `active` = false renders a "ghost" style for modules the current node cutoff hasn't
  // revealed yet: gray label text, and hollow (stroke-only, no fill) bars.
  function drawBarChart(container, barData, chartTitle, active = true) {
    const labelWidth = 150, valueWidth = 36, barWidth = 100, barHeight = 8, barGap = 4;
    const xScale = d3.scaleLinear().domain([0, d3.max(barData, d => d.value) || 1]).range([0, barWidth]);
    const textColor = active ? "#fff" : "#777";

    container.append("div").style("font-weight", "bold").style("margin-top", "10px").style("color", textColor).text(chartTitle);

    const rows = container.append("svg")
      .attr("width", labelWidth + barWidth + valueWidth)
      .attr("height", barData.length * (barHeight + barGap))
      .append("g")
      .selectAll("g")
      .data(barData)
      .join("g")
      .attr("transform", (_, i) => `translate(0, ${i * (barHeight + barGap)})`);

    rows.append("text")
      .attr("x", labelWidth - 6).attr("y", barHeight / 2).attr("dy", "0.35em")
      .attr("text-anchor", "end").attr("font-family", FONT_FAMILY).attr("font-size", 10)
      .attr("fill", textColor)
      .text(d => d.label.length > 28 ? d.label.slice(0, 27) + "…" : d.label)
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1).html(`${d.label}: ${d.value.toLocaleString()}`);
        // Outline the matching org_typ key in the legend (same convention as node hover).
        legend.select("rect")
          .attr("stroke", ld => ld === d.org_typ ? NEON_COLOR : null)
          .attr("stroke-width", ld => ld === d.org_typ ? 2 : null);
      })
      .on("mousemove", event => tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 20}px`))
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        legend.select("rect").attr("stroke", null).attr("stroke-width", null);
      });

    rows.append("rect")
      .attr("x", labelWidth).attr("width", d => xScale(d.value))
      .attr("height", barHeight)
      .attr("fill", d => active ? org_color(d.org_typ) : "none")
      .attr("stroke", d => active ? "none" : org_color(d.org_typ))
      .attr("stroke-width", d => active ? 0 : 1);

    rows.append("text")
      .attr("x", d => labelWidth + xScale(d.value) + 4).attr("y", barHeight / 2).attr("dy", "0.35em")
      .attr("font-family", FONT_FAMILY).attr("font-size", 10)
      .attr("fill", textColor)
      .text(d => d.value.toLocaleString());
  }

  // Populate side panel analytics for EVERY module in the dataset — active modules get full,
  // live analytics; modules the current node cutoff hasn't revealed yet get a grayed-out,
  // hollow-bar preview computed from the full dataset, plus a hint to raise the node count.
  function updatePanelAll() {
    panel.html("");
    allBillRows = [];

    allModuleIds.forEach(module_id => {
      const isActive = activeModuleSet.has(module_id);
      const moduleLabel = moduleLabelMap.get(module_id);
      const hullColor = module_color(module_id);

      const heading = panel.append("h3")
        .style("margin-top", "16px")
        .style("border-top", "1px solid #333")
        .style("padding-top", "10px")
        .style("color", isActive ? "#fff" : "#777")
        .text(`Module ${moduleLabel}`);

      // (4) Flow sum badge, colored to match this module's hull.
      const flowSum = allModuleFlowTotals.get(module_id);
      heading.append("span")
        .style("margin-left", "8px")
        .style("font-weight", "normal")
        .style("font-size", "11px")
        .style("color", hullColor)
        .text(`Σ flow: ${flowSum.toLocaleString()}`);

      if (!isActive) {
        panel.append("div")
          .style("font-style", "italic")
          .style("font-size", "10px")
          .style("color", "#777")
          .style("margin-bottom", "6px")
          .text("increase node count to show.");
      }

      if (isActive) {
        const moduleNodes = nodes.filter(d => d.module_id === module_id);
        const nodeBarData = [...moduleNodes]
          .sort((a, b) => b.flow - a.flow)
          .slice(0, 10)
          .map(d => ({ label: d.name, value: d.flow, org_typ: d.org_typ }));

        const orgFlow = d3.rollup(moduleNodes, v => d3.sum(v, d => d.flow), d => d.org_typ);
        const orgBarData = [...orgFlow.entries()].map(([org, flow]) => ({ label: org, value: flow, org_typ: org }));

        drawBarChart(panel, nodeBarData, "Top nodes by flow", true);
        drawBarChart(panel, orgBarData, "Organizations by flow", true);
        drawBillFreqList(panel, getModuleBillFrequency(module_id), "Top bills by frequency");
      } else {
        // Ghost preview built from the full dataset (the graph itself has no nodes for this
        // module yet, so there's no live selection/edge data to draw bills from).
        const allModuleNodes = data.nodes.filter(d => d.module_id === module_id);
        const nodeBarData = [...allModuleNodes]
          .sort((a, b) => b.flow - a.flow)
          .slice(0, 10)
          .map(d => ({ label: d.name, value: d.flow, org_typ: d.org_typ }));

        const orgFlow = d3.rollup(allModuleNodes, v => d3.sum(v, d => d.flow), d => d.org_typ);
        const orgBarData = [...orgFlow.entries()].map(([org, flow]) => ({ label: org, value: flow, org_typ: org }));

        drawBarChart(panel, nodeBarData, "Top nodes by flow", false);
        drawBarChart(panel, orgBarData, "Organizations by flow", false);

        panel.append("div").style("font-weight", "bold").style("margin-top", "10px").style("color", "#777").text("Top bills by frequency");
        panel.append("div").style("font-style", "italic").style("font-size", "10px").style("color", "#777").text("No bills found.");
      }
    });
  }
  updatePanelAll();

  // ---------------------------------------------------------------------------
  // 6. INTERACTION SELECTION & HIGHLIGHTING
  // ---------------------------------------------------------------------------
  function handleNodeClick(d) {
    SELECTED_BILL_ID = null; // node-selection and bill-selection are mutually exclusive modes
    if (!PRIMARY_NODE) {
      PRIMARY_NODE = d;
      SECONDARY_NODE = SELECTED_EDGE = null;
    } else if (PRIMARY_NODE === d && !SECONDARY_NODE) {
      return;
    } else {
      const edge = findEdge(PRIMARY_NODE.id, d.id);
      if (edge) {
        SELECTED_EDGE = edge;
        SECONDARY_NODE = d;
      } else {
        PRIMARY_NODE = d;
        SECONDARY_NODE = SELECTED_EDGE = null;
      }
    }
    updateStyles();
  }

  // (1) Selecting a bill from "top bills by frequency": its edges go neon @ 0.8 opacity,
  // nodes not touched by any of those edges dim to 0.8 opacity, and it stays selected until
  // the background is clicked (deselectAll).
  function handleBillClick(B_ID) {
    PRIMARY_NODE = SECONDARY_NODE = SELECTED_EDGE = null;
    SELECTED_BILL_ID = SELECTED_BILL_ID === B_ID ? null : B_ID;
    updateStyles();
  }

  function deselectAll() {
    PRIMARY_NODE = SECONDARY_NODE = SELECTED_EDGE = SELECTED_BILL_ID = null;
    updateStyles();
  }

  // (2) Hull opacity: bumped up when its module is hovered, or when a selected node belongs to it.
  function hullOpacity(module_id) {
    const highlighted = module_id === HOVERED_MODULE
      || (PRIMARY_NODE && PRIMARY_NODE.module_id === module_id)
      || (SECONDARY_NODE && SECONDARY_NODE.module_id === module_id);
    return highlighted ? 0.35 : 0.3;
  }
  function updateHullStyles() {
    hullGroup.selectAll("circle").attr("fill-opacity", d => hullOpacity(d.module_id));
  }

  // Tracks which elements are currently sitting in topLayer, so updateStyles only has to
  // demote/promote that small set instead of touching every node/link in the graph.
  let promotedLinks = [];
  let promotedNodes = [];

  // Apply visual styling across graph based on primary/secondary node selection, or bill selection
  function updateStyles() {
    const adjacentNodeIds = new Set();
    const adjacentEdges = new Set();

    if (PRIMARY_NODE) {
      links.forEach(l => {
        const s = idOf(l.source), t = idOf(l.target);
        if (s === PRIMARY_NODE.id || t === PRIMARY_NODE.id) {
          adjacentEdges.add(l);
          adjacentNodeIds.add(s === PRIMARY_NODE.id ? t : s);
        }
      });
    }

    // Bill-selection mode: which edges carry the selected bill, and which nodes they touch.
    const billEdges = new Set();
    const billNodeIds = new Set();
    if (SELECTED_BILL_ID) {
      links.forEach(l => {
        if (Array.isArray(l.bills) && l.bills.some(b => b.B_ID === SELECTED_BILL_ID)) {
          billEdges.add(l);
          billNodeIds.add(idOf(l.source));
          billNodeIds.add(idOf(l.target));
        }
      });
    }

    // 1. Demote only what was promoted last time (cheap) instead of touching the whole graph
    promotedLinks.forEach(el => linkGroup.node().appendChild(el));
    promotedNodes.forEach(el => nodeGroup.node().appendChild(el));

    // 2. Apply styling attributes
    node
      .attr("stroke", d => (d === PRIMARY_NODE || d === SECONDARY_NODE || adjacentNodeIds.has(d.id)) ? NEON_COLOR : baseStroke(d))
      .attr("stroke-width", d => (d === PRIMARY_NODE || d === SECONDARY_NODE) ? baseStrokeWidth(d) + 4 : baseStrokeWidth(d))
      .style("opacity", d => SELECTED_BILL_ID ? (billNodeIds.has(d.id) ? 1 : 0.8) : 1);

    link
      .attr("stroke", d => (d === SELECTED_EDGE || billEdges.has(d)) ? NEON_COLOR : "white")
      .attr("stroke-width", d => (d === SELECTED_EDGE) ? 5 : 1)
      .attr("stroke-opacity", d => {
        if (d === SELECTED_EDGE) return 1;
        if (billEdges.has(d)) return 0.8;
        if (SELECTED_BILL_ID) return 0.05;
        return adjacentEdges.has(d) ? 0.5 : 0.05;
      });

    // Reflect the selected bill row (if any) with a subtle highlight.
    allBillRows.forEach(sel => {
      sel.style("background", d => d.B_ID === SELECTED_BILL_ID ? "rgba(204,255,0,0.15)" : null);
    });

    // 3. Promote active selection to top layer. Edges go up first, then their nodes — later
    // in document order paints on top, so nodes stay visible over neon bill-selected edges.
    const toPromoteLinks = link.filter(d => d === SELECTED_EDGE || billEdges.has(d));
    const toPromoteNodes = node.filter(d => d === PRIMARY_NODE || d === SECONDARY_NODE || billNodeIds.has(d.id));

    toPromoteLinks.each(function() { topLayer.node().appendChild(this); });
    toPromoteNodes.each(function() { topLayer.node().appendChild(this); });

    promotedLinks = toPromoteLinks.nodes();
    promotedNodes = toPromoteNodes.nodes();

    updateBillBox();
    updateHullStyles();
  }

  // ---------------------------------------------------------------------------
  // 7. DRAGGABLE & RESIZABLE FLOATING BILL BOX
  // ---------------------------------------------------------------------------
  let billBoxPos = { x: 20, y: height - 220 };
  let billBoxMinimized = false;
  let billBoxPrevSize = null;

  const billBox = d3.create("div")
    .attr("class", "bill-box")
    .style("position", "absolute").style("left", `${billBoxPos.x}px`).style("top", `${billBoxPos.y}px`)
    .style("width", "180px").style("height", "200px").style("min-width", "160px").style("min-height", "60px")
    .style("display", "none").style("flex-direction", "column").style("background", NEON_COLOR)
    .style("border", "1px solid #333").style("border-radius", "4px").style("box-shadow", "0 2px 6px rgba(0,0,0,0.3)")
    .style("font-family", FONT_FAMILY).style("font-size", "11px").style("z-index", 10)
    .style("resize", "both").style("overflow", "hidden");

  const billBoxHeader = billBox.append("div")
    .style("display", "flex").style("justify-content", "space-between").style("align-items", "center")
    .style("padding", "3px 6px").style("cursor", "grab").style("font-weight", "bold")
    .style("user-select", "none").style("flex-shrink", "0");

  const billBoxTitle = billBoxHeader.append("span").style("flex", "1").style("padding-right", "6px");

  const billBoxMinimizeBtn = billBoxHeader.append("span")
    .style("cursor", "pointer")
    .style("width", "14px").style("height", "14px").style("line-height", "12px").style("text-align", "center")
    .style("flex-shrink", "0").style("background", "rgba(0,0,0,0.1)").text("–");

  const billBoxBody = billBox.append("div")
    .style("flex", "1").style("min-height", "0").style("overflow-y", "auto")
    .style("padding", "4px 6px").style("scrollbar-color", "black transparent");

  billBoxMinimizeBtn.on("click", event => {
    event.stopPropagation();
    billBoxMinimized = !billBoxMinimized;
    if (billBoxMinimized) {
      billBoxPrevSize = { width: billBox.style("width"), height: billBox.style("height") };
      billBoxBody.style("display", "none");
      billBox.style("height", null).style("resize", "none");
      billBoxMinimizeBtn.text("+");
    } else {
      billBoxBody.style("display", null);
      billBox.style("resize", "both");
      if (billBoxPrevSize) billBox.style("width", billBoxPrevSize.width).style("height", billBoxPrevSize.height);
      billBoxMinimizeBtn.text("–");
    }
  });

  let dragOffset = null;
  billBoxHeader.on("mousedown", event => {
    dragOffset = { x: event.clientX - billBoxPos.x, y: event.clientY - billBoxPos.y };
    billBoxHeader.style("cursor", "grabbing");
    event.stopPropagation();
  });

  d3.select(window)
    .on("mousemove.billbox", event => {
      if (!dragOffset) return;
      billBoxPos = { x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y };
      billBox.style("left", `${billBoxPos.x}px`).style("top", `${billBoxPos.y}px`);
    })
    .on("mouseup.billbox", () => {
      dragOffset = null;
      billBoxHeader.style("cursor", "grab");
    });

  function updateBillBox() {
    if (!SELECTED_EDGE) {
      billBox.style("display", "none");
      return;
    }
    billBox.style("display", "flex");
    billBoxTitle.html(`<i style = "color: "#1d2b20""> ${PRIMARY_NODE.name} • ${SECONDARY_NODE.name} </i>
                    · <i style="font-weight: normal;">bills in common</i>
                   `);
    billBoxBody.html("");

    const bills = SELECTED_EDGE.bills || [];
    if (!bills.length) {
      billBoxBody.append("div").style("font-style", "italic").text("No bills found.");
    } else {
      billBoxBody.selectAll("div.bill-row")
        .data(bills)
        .join("div")
        .style("padding", "2px 0")
        .style("border-bottom", "1px solid rgba(0,0,0,0.15)")
        .text(d => `${d.B_ID}: ${d.bill_title}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. SIMULATION & DRAG BEHAVIORS
  // ---------------------------------------------------------------------------
  const simulation = d3.forceSimulation(nodes)
    // .alphaDecay(0.05)
    .velocityDecay(0.6) // default 0.4; higher = more friction, nodes stop moving sooner
    .force("link", d3.forceLink(links).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(FORCE_MANY_BODY))
    .force("x", d3.forceX(d => moduleCenters.get(d.module_id).x).strength(FORCE_XY))
    .force("y", d3.forceY(d => moduleCenters.get(d.module_id).y).strength(FORCE_XY));

  simulation.on("tick", () => {
    link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    node.attr("cx", d => d.x).attr("cy", d => d.y);

    const circleData = [...d3.group(nodes, d => d.module_id)].map(([module_id, groupNodes]) => {
      const cx = d3.mean(groupNodes, d => d.x);
      const cy = d3.mean(groupNodes, d => d.y);
      const r = d3.max(groupNodes, d => Math.hypot(d.x - cx, d.y - cy)) + 10;
      return { module_id, cx, cy, r };
    });

    hullGroup.selectAll("circle")
      .data(circleData, d => d.module_id)
      .join("circle")
      .attr("cx", d => d.cx).attr("cy", d => d.cy).attr("r", d => d.r)
      .attr("fill", d => module_color(d.module_id))
      .attr("fill-opacity", d => hullOpacity(d.module_id));
  });

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

  invalidation.then(() => {
    simulation.stop();
    d3.select(window).on(".billbox", null);
  });

  // ---------------------------------------------------------------------------
  // 9. FINAL ASSEMBLY & RETURN
  // ---------------------------------------------------------------------------
  const container = d3.create("div")
    .style("display", "flex")
    .style("flex-direction", "row")
    .style("position", "relative")
    .style("background", "#000");

  container.node().appendChild(svg.node());
  container.node().appendChild(panel.node());
  container.node().appendChild(billBox.node());

  return container.node();
}


function _selectedModule(){return(
null
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  // const fileAttachments = new Map([
  //   ["titled_bills_assoc_sample.json", {url: new URL("./files/1bf0babc9ae9c4d384d6c59df987d4c51f83a774f8d0d3865e84bc804ed97a821395148f06c252e0b9495640c644d6c1ac5ccbb0b8bac73b66d09dc5eb30c70f.json", import.meta.url), mimeType: "application/json", toString}]
  // ]);
  // main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("data")).define("data", ["DATASET_PATH"], _data);
  main.variable(observer("viewof NODES_SHOWN")).define("viewof NODES_SHOWN", ["Inputs"], _NODES_SHOWN);
  main.variable(observer("NODES_SHOWN")).define("NODES_SHOWN", ["Generators", "viewof NODES_SHOWN"], (G, _) => G.input(_));
  main.variable(observer("chart")).define("chart", ["d3","data","NODES_SHOWN","invalidation"], _chart);
  main.define("initial selectedModule", _selectedModule);
  main.variable(observer("mutable selectedModule")).define("mutable selectedModule", ["Mutable", "initial selectedModule"], (M, _) => new M(_));
  main.variable(observer("selectedModule")).define("selectedModule", ["mutable selectedModule"], _ => _.generator);
  return main;
}
