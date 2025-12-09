// ---------- Graph State ----------
const state = {
  nodes: new Set(),
  edges: [], // {from, to, weight}
  directed: true,
  weighted: true,
  visitedNodes: new Set(),
  currentLevel: new Set(),
  positions: {}, // node -> {x, y}
};

let currentAnimation = null;
let draggingNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let hasDragged = false;

// ---------- DOM ----------
const nodeInput = document.getElementById("nodeInput");
const addNodeBtn = document.getElementById("addNodeBtn");
const nodesContainer = document.getElementById("nodesContainer");
const directedToggle = document.getElementById("directedToggle");
const weightedToggle = document.getElementById("weightedToggle");
const graphTypeLabel = document.getElementById("graphTypeLabel");
const resetGraphBtn = document.getElementById("resetGraphBtn");

const fromSelect = document.getElementById("fromSelect");
const toSelect = document.getElementById("toSelect");
const weightInput = document.getElementById("weightInput");
const edgeList = document.getElementById("edgeList");
const addEdgeBtn = document.getElementById("addEdgeBtn");

const startSelect = document.getElementById("startSelect");
const endSelect = document.getElementById("endSelect");

const bfsBtn = document.getElementById("bfsBtn");
const dfsBtn = document.getElementById("dfsBtn");
const topoBtn = document.getElementById("topoBtn");
const shortestPathBtn = document.getElementById("shortestPathBtn");
const clearHighlightsBtn = document.getElementById("clearHighlightsBtn");

const output = document.getElementById("output");
const statusLabel = document.getElementById("statusLabel");

const graphCanvas = document.getElementById("graphCanvas");
const ctx = graphCanvas.getContext("2d");

// ---------- Helpers ----------
function showStatus(text, type = "info") {
  statusLabel.textContent = text;
  if (type === "error") {
    statusLabel.style.background =
      "linear-gradient(135deg, #fb7185, #f97316)";
    statusLabel.style.color = "#0b1220";
  } else if (type === "success") {
    statusLabel.style.background =
      "linear-gradient(135deg, #22c55e, #16a34a)";
    statusLabel.style.color = "#022c22";
  } else {
    statusLabel.style.background = "rgba(15,23,42,0.9)";
    statusLabel.style.color = "#9ca3af";
  }
}

function setOutput(html) {
  output.innerHTML = html;
}

function buildAdjacency() {
  const adj = {};
  state.nodes.forEach((n) => {
    adj[n] = new Set();
  });
  state.edges.forEach(({ from, to }) => {
    adj[from]?.add(to);
    if (!state.directed) {
      adj[to]?.add(from);
    }
  });
  return adj;
}

function buildWeightedAdjacency() {
  const adj = {};
  state.nodes.forEach((n) => {
    adj[n] = [];
  });
  state.edges.forEach(({ from, to, weight }) => {
    adj[from].push({ to, weight });
    if (!state.directed) {
      adj[to].push({ to: from, weight });
    }
  });
  return adj;
}

function refreshSelectors() {
  const selects = [fromSelect, toSelect, startSelect, endSelect];
  selects.forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = "";
    state.nodes.forEach((node) => {
      const opt = document.createElement("option");
      opt.value = node;
      opt.textContent = node;
      sel.appendChild(opt);
    });
    if (state.nodes.size === 0) {
      const opt = document.createElement("option");
      opt.textContent = "—";
      sel.appendChild(opt);
      sel.disabled = true;
    } else {
      sel.disabled = false;
      if ([...state.nodes].includes(prev)) {
        sel.value = prev;
      }
    }
  });
}

function applyNodeHighlightClasses() {
  document.querySelectorAll(".node-pill").forEach((pill) => {
    const node = pill.dataset.node;
    pill.classList.toggle("visited", state.visitedNodes.has(node));
    pill.classList.toggle("current", state.currentLevel.has(node));
  });
}

function refreshNodesView() {
  nodesContainer.innerHTML = "";
  if (state.nodes.size === 0) {
    nodesContainer.textContent =
      "No nodes yet. Add a node to get started.";
    nodesContainer.classList.add("muted");
    drawGraph();
    return;
  }
  nodesContainer.classList.remove("muted");
  let index = 1;
  state.nodes.forEach((node) => {
    const pill = document.createElement("div");
    pill.className = "node-pill";
    pill.dataset.node = node;
    pill.innerHTML = `
      <span>${node}</span>
      <span class="node-index">#${index}</span>
    `;
    nodesContainer.appendChild(pill);
    index++;
  });
  applyNodeHighlightClasses();
  drawGraph();
}

function refreshEdgesView() {
  edgeList.innerHTML = "";
  if (state.edges.length === 0) {
    edgeList.innerHTML =
      '<span class="muted">No edges yet. Add edges between nodes.</span>';
    drawGraph();
    return;
  }

  state.edges.forEach((e, idx) => {
    const item = document.createElement("div");
    item.className = "edge-item";
    const arrow = state.directed ? "→" : "—";

    if (state.weighted) {
      // show weight UI
      item.innerHTML = `
        <span>
          <strong>${e.from}</strong> ${arrow} <strong>${e.to}</strong>
          <span class="muted">(w = </span>
          <input type="number" class="edge-weight-input" value="${e.weight}"
                 min="1" step="1" style="width:55px" data-index="${idx}" />
          <span class="muted">)</span>
        </span>
        <button class="danger" style="padding:3px 6px;font-size:10px;border-radius:6px;" data-index="${idx}">
          ❌
        </button>
      `;

      const weightInputEl = item.querySelector(".edge-weight-input");
      weightInputEl.disabled = !state.weighted;

      weightInputEl.addEventListener("change", () => {
        if (!state.weighted) return;
        let newW = parseInt(weightInputEl.value, 10);
        if (isNaN(newW) || newW <= 0) newW = 1;
        state.edges[idx].weight = newW;
        refreshEdgesView();
        showStatus("Edge weight updated.", "success");
      });

      item.querySelector("button").addEventListener("click", () => {
        state.edges.splice(idx, 1);
        refreshEdgesView();
        drawGraph();
        showStatus("Edge removed successfully.", "success");
      });
    } else {
      // unweighted: do not show any weight number
      item.innerHTML = `
        <span>
          <strong>${e.from}</strong> ${arrow} <strong>${e.to}</strong>
        </span>
        <button class="danger" style="padding:3px 6px;font-size:10px;border-radius:6px;" data-index="${idx}">
          ❌
        </button>
      `;
      item.querySelector("button").addEventListener("click", () => {
        state.edges.splice(idx, 1);
        refreshEdgesView();
        drawGraph();
        showStatus("Edge removed successfully.", "success");
      });
    }

    edgeList.appendChild(item);
  });

  drawGraph();
}

function clearHighlights() {
  if (currentAnimation && currentAnimation.timeouts) {
    currentAnimation.timeouts.forEach((id) => clearTimeout(id));
  }
  currentAnimation = null;
  state.visitedNodes.clear();
  state.currentLevel.clear();
  applyNodeHighlightClasses();
  drawGraph();
}

function animateLevels(levels) {
  clearHighlights();
  const timeouts = [];
  const delayPerLevel = 700;

  levels.forEach((levelNodes, levelIndex) => {
    const t = setTimeout(() => {
      state.currentLevel = new Set(levelNodes);
      levelNodes.forEach((n) => state.visitedNodes.add(n));
      applyNodeHighlightClasses();
      drawGraph();
    }, levelIndex * delayPerLevel);
    timeouts.push(t);
  });

  currentAnimation = { timeouts };
}

// ---------- Canvas & Layout ----------
function resizeCanvas() {
  const rect = graphCanvas.getBoundingClientRect();
  graphCanvas.width = rect.width * window.devicePixelRatio;
  graphCanvas.height = rect.height * window.devicePixelRatio;
  ctx.setTransform(
    window.devicePixelRatio,
    0,
    0,
    window.devicePixelRatio,
    0,
    0
  );
  drawGraph();
}

function layoutRegularPolygon(width, height) {
  const nodes = Array.from(state.nodes);
  const n = nodes.length;
  if (n === 0) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 50;
  const fullCircle = Math.PI * 2;

  nodes.forEach((node, i) => {
    const angle = (fullCircle * i) / n - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    state.positions[node] = { x, y };
  });
}

function ensurePositionForNode(node) {
  const rect = graphCanvas.getBoundingClientRect();
  const w = rect.width || 300;
  const h = rect.height || 200;
  if (!state.positions[node]) {
    state.positions[node] = {
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h / 2 + (Math.random() - 0.5) * 80,
    };
  }
  return state.positions[node];
}

function drawEdgeWithArrow(p1, p2, directed, weight) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  const nodeRadius = 18;
  const startX = x1 + nodeRadius * Math.cos(angle);
  const startY = y1 + nodeRadius * Math.sin(angle);
  const endX = x2 - nodeRadius * Math.cos(angle);
  const endY = y2 - nodeRadius * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (directed) {
    const arrowSize = 10;
    const arrowAngle = Math.PI / 7;

    const ax1 = endX - arrowSize * Math.cos(angle - arrowAngle);
    const ay1 = endY - arrowSize * Math.sin(angle - arrowAngle);

    const ax2 = endX - arrowSize * Math.cos(angle + arrowAngle);
    const ay2 = endY - arrowSize * Math.sin(angle + arrowAngle);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(ax1, ay1);
    ctx.lineTo(ax2, ay2);
    ctx.closePath();
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
  }

  // Draw weight text ONLY if weighted
  if (!state.weighted) return;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(weight, midX, midY - 4);
}

function drawGraph() {
  if (!ctx) return;
  ctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

  const nodes = Array.from(state.nodes);
  const n = nodes.length;

  if (n === 0) {
    ctx.save();
    ctx.fillStyle = "#4b5563";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = graphCanvas.width / window.devicePixelRatio || 300;
    const h = graphCanvas.height / window.devicePixelRatio || 150;
    ctx.fillText(
      "No nodes yet. Add nodes to see the graph diagram.",
      w / 2,
      h / 2
    );
    ctx.restore();
    return;
  }

  const width = graphCanvas.width / window.devicePixelRatio;
  const height = graphCanvas.height / window.devicePixelRatio;

  if (!hasDragged) {
    layoutRegularPolygon(width, height);
  }

  state.edges.forEach(({ from, to, weight }) => {
    const p1 = state.positions[from] || ensurePositionForNode(from);
    const p2 = state.positions[to] || ensurePositionForNode(to);
    drawEdgeWithArrow(p1, p2, state.directed, weight);
  });

  nodes.forEach((node) => {
    const p = state.positions[node] || ensurePositionForNode(node);

    const isCurrent = state.currentLevel.has(node);
    const isVisited = state.visitedNodes.has(node);

    const baseFill = "#020617";
    const visitedFill = "#15803d";
    const currentFill = "#facc15";

    const baseStroke = "#9ca3af";
    const visitedStroke = "#22c55e";
    const currentStroke = "#fbbf24";

    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    if (isCurrent) {
      ctx.fillStyle = currentFill;
      ctx.strokeStyle = currentStroke;
      ctx.lineWidth = 3;
    } else if (isVisited) {
      ctx.fillStyle = visitedFill;
      ctx.strokeStyle = visitedStroke;
      ctx.lineWidth = 2.5;
    } else {
      ctx.fillStyle = baseFill;
      ctx.strokeStyle = baseStroke;
      ctx.lineWidth = 2;
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node, p.x, p.y);
  });
}

// ---------- Dragging ----------
function getMousePos(evt) {
  const rect = graphCanvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top,
  };
}

graphCanvas.addEventListener("mousedown", (evt) => {
  const { x, y } = getMousePos(evt);
  const radius = 18;
  let foundNode = null;

  for (const node of state.nodes) {
    const pos = state.positions[node];
    if (!pos) continue;
    const dx = x - pos.x;
    const dy = y - pos.y;
    if (dx * dx + dy * dy <= radius * radius) {
      foundNode = node;
      dragOffsetX = pos.x - x;
      dragOffsetY = pos.y - y;
      break;
    }
  }

  if (foundNode) {
    draggingNode = foundNode;
    hasDragged = true;
  }
});

graphCanvas.addEventListener("mousemove", (evt) => {
  if (!draggingNode) return;
  const { x, y } = getMousePos(evt);
  const pos = state.positions[draggingNode];
  pos.x = x + dragOffsetX;
  pos.y = y + dragOffsetY;
  drawGraph();
});

graphCanvas.addEventListener("mouseup", () => {
  draggingNode = null;
});

graphCanvas.addEventListener("mouseleave", () => {
  draggingNode = null;
});

// ---------- Mutations ----------
function addNode() {
  let label = nodeInput.value.trim();
  if (!label) {
    showStatus("Enter a node label.", "error");
    return;
  }
  if (state.nodes.has(label)) {
    showStatus("Node already exists.", "error");
    return;
  }
  state.nodes.add(label);

  if (hasDragged) {
    ensurePositionForNode(label);
  }

  nodeInput.value = "";
  refreshNodesView();
  refreshSelectors();
  showStatus(`Node "${label}" added.`, "success");
}

function addEdge() {
  if (state.nodes.size < 2) {
    showStatus("Need at least 2 nodes to add an edge.", "error");
    return;
  }
  const from = fromSelect.value;
  const to = toSelect.value;
  let weight = parseInt(weightInput.value, 10);
  if (!state.weighted) {
    weight = 1;
  } else {
    if (isNaN(weight) || weight <= 0) weight = 1;
  }

  if (!from || !to || from === "—" || to === "—") {
    showStatus("Select valid nodes for the edge.", "error");
    return;
  }
  if (from === to) {
    showStatus("Self-loops are ignored here.", "error");
    return;
  }
  const exists = state.edges.some(
    (e) => e.from === from && e.to === to && e.weight === weight
  );
  if (exists) {
    showStatus("Same edge with same weight already exists.", "error");
    return;
  }
  state.edges.push({ from, to, weight });
  refreshEdgesView();
  showStatus(
    `Edge ${from} ${state.directed ? "→" : "—"} ${to}` +
      (state.weighted ? ` (w=${weight})` : "") +
      " added.",
    "success"
  );
}

function resetGraph() {
  state.nodes.clear();
  state.edges = [];
  state.positions = {};
  hasDragged = false;
  clearHighlights();
  refreshNodesView();
  refreshEdgesView();
  refreshSelectors();
  setOutput(
    '<span class="muted">Graph cleared. Add nodes and edges to start again.</span>'
  );
  showStatus("Graph reset.");
}

// ---------- Algorithms ----------
function bfsTraversal(start) {
  const adj = buildAdjacency();
  if (!adj[start]) return { levels: [], order: [] };

  const visited = new Set([start]);
  const queue = [start];
  const levels = [];
  const order = [];

  while (queue.length > 0) {
    const size = queue.length;
    const levelNodes = [];
    for (let i = 0; i < size; i++) {
      const u = queue.shift();
      order.push(u);
      levelNodes.push(u);
      adj[u].forEach((v) => {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      });
    }
    levels.push(levelNodes);
  }
  return { levels, order };
}

function dfsTraversal(start) {
  const adj = buildAdjacency();
  if (!adj[start]) return [];

  const visited = new Set();
  const stack = [start];
  const order = [];

  while (stack.length > 0) {
    const u = stack.pop();
    if (!visited.has(u)) {
      visited.add(u);
      order.push(u);
      const neighbors = Array.from(adj[u]).sort().reverse();
      neighbors.forEach((v) => {
        if (!visited.has(v)) stack.push(v);
      });
    }
  }
  return order;
}

function shortestPathBfs(start, end) {
  const adj = buildAdjacency();
  if (!adj[start] || !adj[end]) return null;
  const q = [start];
  const visited = new Set([start]);
  const parent = {};
  let found = false;

  while (q.length > 0) {
    const u = q.shift();
    if (u === end) {
      found = true;
      break;
    }
    adj[u].forEach((v) => {
      if (!visited.has(v)) {
        visited.add(v);
        parent[v] = u;
        q.push(v);
      }
    });
  }

  if (!found) return null;

  const path = [];
  let cur = end;
  while (cur !== undefined) {
    path.push(cur);
    cur = parent[cur];
  }
  path.reverse();
  return path;
}

function dijkstraShortestPath(start, end) {
  const adj = buildWeightedAdjacency();
  if (!adj[start] || !adj[end]) return null;

  const dist = {};
  const parent = {};
  const visited = new Set();

  state.nodes.forEach((n) => {
    dist[n] = Infinity;
  });
  dist[start] = 0;

  while (true) {
    let u = null;
    let best = Infinity;

    state.nodes.forEach((n) => {
      if (!visited.has(n) && dist[n] < best) {
        best = dist[n];
        u = n;
      }
    });

    if (u === null || best === Infinity) break;
    if (u === end) break;

    visited.add(u);
    adj[u].forEach(({ to, weight }) => {
      if (dist[u] + weight < dist[to]) {
        dist[to] = dist[u] + weight;
        parent[to] = u;
      }
    });
  }

  if (dist[end] === Infinity) return null;

  const path = [];
  let cur = end;
  while (cur !== undefined) {
    path.push(cur);
    cur = parent[cur];
  }
  path.reverse();
  return { path, cost: dist[end] };
}

// ---------- Event Handlers ----------
bfsBtn.addEventListener("click", () => {
  if (state.nodes.size === 0) {
    showStatus("Add nodes first.", "error");
    return;
  }
  const start = startSelect.value;
  if (!start || start === "—") {
    showStatus("Choose a valid start node.", "error");
    return;
  }

  const { levels, order } = bfsTraversal(start);
  if (order.length === 0) {
    showStatus("Start node is isolated or graph empty.", "error");
    return;
  }

  animateLevels(levels);

  let html =
    `<strong>BFS Result</strong><br>` +
    `Traversal order from <strong>${start}</strong>:<br>` +
    `<div class="pill-seq">` +
    order.map((n, i) => `<span>${i + 1}. ${n}</span>`).join("") +
    `</div><br>`;

  html += `<strong>Explanation:</strong><br>` +
    `<span class="muted">Breadth First Search (BFS) uses a queue and visits nodes level-by-level starting from the source node. Neighbors of a node are visited before going to the next level. In the simulation, nodes at the same level are highlighted at the same time.</span><br><br>`;

  html += `<span class="muted">Level-wise grouping (L0 = start node):</span><br><pre>` +
    levels
      .map(
        (lvl, i) =>
          `L${i}: ` + lvl.join(", ")
      )
      .join("\n") +
    `</pre>`;

  setOutput(html);
  showStatus(`BFS completed from ${start}.`, "success");
});

dfsBtn.addEventListener("click", () => {
  if (state.nodes.size === 0) {
    showStatus("Add nodes first.", "error");
    return;
  }
  const start = startSelect.value;
  if (!start || start === "—") {
    showStatus("Choose a valid start node.", "error");
    return;
  }
  const order = dfsTraversal(start);
  if (order.length === 0) {
    showStatus("Start node is isolated or graph empty.", "error");
    return;
  }

  const levels = order.map((n) => [n]);
  animateLevels(levels);

  let html =
    `<strong>DFS Result</strong><br>` +
    `Traversal order from <strong>${start}</strong>:<br>` +
    `<div class="pill-seq">` +
    order.map((n, i) => `<span>${i + 1}. ${n}</span>`).join("") +
    `</div><br>`;

  html += `<strong>Explanation:</strong><br>` +
    `<span class="muted">Depth First Search (DFS) explores as deep as possible along each branch before backtracking. It can be implemented using a stack or recursion. In this simulator we use an explicit stack and push neighbors in reverse-sorted order so that the traversal is deterministic.</span>`;

  setOutput(html);
  showStatus(`DFS completed from ${start}.`, "success");
});

// Topological sort with indegree detail
topoBtn.addEventListener("click", () => {
  if (!state.directed) {
    showStatus(
      "Topological Sort only works for Directed Acyclic Graphs!",
      "error"
    );
    setOutput(
      `<strong>Topological Sort</strong><br>` +
        `<span class="muted">Not allowed for undirected graphs.</span>`
    );
    clearHighlights();
    return;
  }

  if (state.nodes.size === 0) {
    showStatus("Add nodes first.", "error");
    return;
  }

  const adj = {};
  const indegree = {};
  state.nodes.forEach((n) => {
    adj[n] = [];
    indegree[n] = 0;
  });
  state.edges.forEach(({ from, to }) => {
    adj[from].push(to);
    indegree[to]++;
  });

  const initialIndegreeSnapshot = { ...indegree };

  const queue = [];
  Object.keys(indegree).forEach((n) => {
    if (indegree[n] === 0) queue.push(n);
  });

  const removalSteps = [];
  const order = [];

  while (queue.length > 0) {
    const u = queue.shift();
    order.push(u);

    adj[u].forEach((v) => {
      indegree[v]--;
      if (indegree[v] === 0) {
        queue.push(v);
      }
    });

    removalSteps.push({
      removedNode: u,
      indegreeSnapshot: { ...indegree },
      queueSnapshot: [...queue],
    });
  }

  if (order.length !== state.nodes.size) {
    setOutput(
      `<strong>Topological Sort (Kahn's Algorithm)</strong><br>` +
        `<span class="muted">Graph contains a cycle. Topological ordering is not possible.</span>`
    );
    showStatus("Graph has cycle. No topo order.", "error");
    clearHighlights();
    return;
  }

  animateLevels(order.map((n) => [n]));

  let html = `<strong>Topological Sort Result</strong><br>` +
    `A valid topological order of the directed acyclic graph is:<br>` +
    `<div class="pill-seq">` +
    order.map((n, i) => `<span>${i + 1}. ${n}</span>`).join("") +
    `</div><br>`;

  html += `<strong>Explanation (Kahn's Algorithm with indegree table):</strong><br>`;
  html += `<span class="muted">We repeatedly remove nodes with indegree 0 and decrease the indegree of their neighbors. If we can remove all nodes, the graph is a DAG and the removal order is a valid topological ordering.</span><br><br>`;

  html += `<strong>Initial Indegree Table:</strong><br><pre>` +
    Object.entries(initialIndegreeSnapshot)
      .map(([k, v]) => `${k}:${v}`)
      .join("  ") +
    `</pre><br>`;

  removalSteps.forEach((step, i) => {
    html += `<strong>Step ${i + 1}:</strong> Remove node <strong>${step.removedNode}</strong><br>`;
    html += `Updated indegrees:<br><pre>` +
      Object.entries(step.indegreeSnapshot)
        .map(([k, v]) => `${k}:${Math.max(0, v)}`)
        .join("  ") +
      `</pre>`;
    html += `Queue now: [${step.queueSnapshot.join(", ")}]<br><br>`;
  });

  setOutput(html);
  showStatus("Topological sort completed.", "success");
});

shortestPathBtn.addEventListener("click", () => {
  if (state.nodes.size === 0) {
    showStatus("Add nodes first.", "error");
    return;
  }
  const start = startSelect.value;
  const end = endSelect.value;
  if (
    !start ||
    !end ||
    start === "—" ||
    end === "—" ||
    !state.nodes.has(start) ||
    !state.nodes.has(end)
  ) {
    showStatus("Choose valid start and end nodes.", "error");
    return;
  }
  if (start === end) {
    setOutput(
      `<strong>Shortest Path Result</strong><br>` +
        `Start and end are the same node: <strong>${start}</strong><br>` +
        `<span class="muted">Distance / weight = 0</span>`
    );
    clearHighlights();
    showStatus("Trivial path (same node).", "success");
    return;
  }

  const allWeightsOne =
    state.edges.length > 0 &&
    state.edges.every((e) => e.weight === 1);

  let path, cost, usedAlgo;

  if (allWeightsOne) {
    const p = shortestPathBfs(start, end);
    if (!p) {
      setOutput(
        `<strong>Shortest Path Result</strong><br>` +
          `<span class="muted">No path exists from ${start} to ${end}.</span>`
      );
      clearHighlights();
      showStatus("No path found.", "error");
      return;
    }
    path = p;
    cost = path.length - 1;
    usedAlgo = "BFS (unweighted, all weights = 1)";
  } else {
    const result = dijkstraShortestPath(start, end);
    if (!result) {
      setOutput(
        `<strong>Shortest Path Result</strong><br>` +
          `<span class="muted">No path exists from ${start} to ${end}.</span>`
      );
      clearHighlights();
      showStatus("No path found.", "error");
      return;
    }
    path = result.path;
    cost = result.cost;
    usedAlgo = "Dijkstra (weighted graph)";
  }

  const levels = path.map((n) => [n]);
  animateLevels(levels);

  let html =
    `<strong>Shortest Path Result</strong><br>` +
    `From <strong>${start}</strong> to <strong>${end}</strong>:<br>` +
    `<div class="pill-seq">` +
    path.map((n, i) => `<span>${i + 1}. ${n}</span>`).join("") +
    `</div><br>` +
    `<span class="muted">Total cost / distance = ${cost}</span><br><br>`;

  html += `<strong>Explanation:</strong><br>`;
  if (allWeightsOne) {
    html += `<span class="muted">All edge weights are 1, so the shortest path in terms of number of edges is found using BFS. BFS guarantees the first time we reach the destination node is via the minimum number of edges.</span>`;
  } else {
    html += `<span class="muted">Since the graph is weighted, we use Dijkstra's algorithm. It maintains a distance array and repeatedly picks the unvisited node with the minimum tentative distance, relaxing edges until the shortest distances are fixed.</span>`;
  }

  setOutput(html);
  showStatus("Shortest path found.", "success");
});

clearHighlightsBtn.addEventListener("click", () => {
  clearHighlights();
  showStatus("Highlights cleared.");
});

// ---------- General Listeners ----------
addNodeBtn.addEventListener("click", addNode);
nodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addNode();
});

addEdgeBtn.addEventListener("click", addEdge);
resetGraphBtn.addEventListener("click", resetGraph);

directedToggle.addEventListener("change", () => {
  state.directed = directedToggle.checked;
  graphTypeLabel.textContent = state.directed ? "Directed" : "Undirected";
  refreshEdgesView();
  showStatus(
    `Graph is now treated as ${
      state.directed ? "directed" : "undirected"
    }.`,
    "info"
  );
  topoBtn.disabled = !state.directed;
  topoBtn.style.opacity = state.directed ? "1" : "0.5";
});

weightedToggle.addEventListener("change", () => {
  state.weighted = weightedToggle.checked;
  if (!state.weighted) {
    state.edges.forEach((e) => (e.weight = 1));
    weightInput.value = 1;
    weightInput.disabled = true;
    showStatus("Weighted mode OFF: all edges treated as unweighted.", "info");
  } else {
    weightInput.disabled = false;
    showStatus("Weighted mode ON: you can set custom edge weights.", "info");
  }
  refreshEdgesView();
});

window.addEventListener("resize", resizeCanvas);

// ---------- Initial ----------
resizeCanvas();
refreshNodesView();
refreshEdgesView();
refreshSelectors();
topoBtn.disabled = !state.directed;
topoBtn.style.opacity = state.directed ? "1" : "0.5";
weightInput.disabled = !state.weighted;
