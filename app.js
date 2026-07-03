const canvas = document.querySelector("#pageCanvas");
const ctx = canvas.getContext("2d");

const state = {
  title: "新しい漫画",
  activePage: 0,
  tool: "pen",
  color: "#111111",
  size: 6,
  fontSize: 28,
  selectedId: null,
  dragging: false,
  dragStart: null,
  assets: [],
  pages: [createPage()],
};

function createPage() {
  const drawing = document.createElement("canvas");
  drawing.width = canvas.width;
  drawing.height = canvas.height;
  return {
    id: crypto.randomUUID(),
    paper: "#ffffff",
    drawing,
    drawingData: "",
    objects: [],
  };
}

function page() {
  return state.pages[state.activePage];
}

function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * canvas.width,
    y: ((evt.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function objectAt(pos) {
  const objects = [...page().objects].reverse();
  return objects.find((obj) => {
    if (obj.kind === "bubble") {
      const rx = obj.w / 2;
      const ry = obj.h / 2;
      const cx = obj.x + rx;
      const cy = obj.y + ry;
      return ((pos.x - cx) ** 2) / rx ** 2 + ((pos.y - cy) ** 2) / ry ** 2 <= 1;
    }
    return pos.x >= obj.x && pos.x <= obj.x + obj.w && pos.y >= obj.y && pos.y <= obj.y + obj.h;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = page().paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPaperGuide();
  ctx.drawImage(page().drawing, 0, 0);
  page().objects.forEach(drawObject);
  drawSelection();
}

function drawPaperGuide() {
  ctx.save();
  ctx.strokeStyle = "rgba(199, 150, 54, 0.34)";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(56, 56, canvas.width - 112, canvas.height - 112);
  ctx.strokeRect(92, 92, canvas.width - 184, canvas.height - 184);
  ctx.restore();
}

function drawObject(obj) {
  ctx.save();
  ctx.lineWidth = obj.lineWidth || 5;
  ctx.strokeStyle = obj.stroke || "#111";
  ctx.fillStyle = obj.fill || "transparent";

  if (obj.kind === "panel") {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
    ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
  }

  if (obj.kind === "bubble") {
    ctx.beginPath();
    ctx.ellipse(obj.x + obj.w / 2, obj.y + obj.h / 2, Math.abs(obj.w / 2), Math.abs(obj.h / 2), 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(obj.x + obj.w * 0.64, obj.y + obj.h * 0.83);
    ctx.lineTo(obj.x + obj.w * 0.78, obj.y + obj.h * 1.1);
    ctx.lineTo(obj.x + obj.w * 0.52, obj.y + obj.h * 0.9);
    ctx.stroke();
  }

  if (obj.kind === "text") {
    ctx.fillStyle = obj.color || "#111";
    const fontSize = obj.fitBox ? fitTextFontSize(obj.text || "", obj.w, obj.h, obj.fontSize || 28, obj.vertical) : obj.fontSize || 28;
    ctx.font = `700 ${fontSize}px "Yu Gothic UI", Meiryo, sans-serif`;
    ctx.textBaseline = "top";
    wrapText(obj.text || "セリフ", obj.x, obj.y, obj.w, obj.h, fontSize, obj.vertical);
  }

  if (obj.kind === "image" && obj.img) {
    ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
  }
  ctx.restore();
}

function fitTextFontSize(text, maxWidth, maxHeight, baseSize, vertical = false) {
  const cleanLength = [...text.replace(/\s/g, "")].length || 1;
  for (let size = baseSize; size >= 13; size -= 1) {
    const lineHeight = size * 1.18;
    if (vertical) {
      const rows = Math.max(1, Math.floor(maxHeight / lineHeight));
      const cols = Math.max(1, Math.floor(maxWidth / lineHeight));
      if (rows * cols >= cleanLength) return size;
    } else {
      const charsPerLine = Math.max(1, Math.floor(maxWidth / (size * 0.62)));
      const lines = Math.ceil(cleanLength / charsPerLine);
      if (lines * lineHeight <= maxHeight) return size;
    }
  }
  return 13;
}

function wrapText(text, x, y, maxWidth, maxHeight, fontSize, vertical = false) {
  const chars = [...text];
  if (vertical) {
    let col = 0;
    let row = 0;
    const lineHeight = fontSize * 1.15;
    const maxRows = Math.max(1, Math.floor(maxHeight / lineHeight));
    const maxCols = Math.max(1, Math.floor(maxWidth / lineHeight));
    chars.forEach((char) => {
      if (char === "\n" || row >= maxRows) {
        col += 1;
        row = 0;
        return;
      }
      if (col >= maxCols) return;
      ctx.fillText(char, x + maxWidth - (col + 1) * lineHeight, y + row * lineHeight);
      row += 1;
    });
    return;
  }

  let line = "";
  let lineY = y;
  chars.forEach((char, index) => {
    const next = line + char;
    if (char === "\n" || (ctx.measureText(next).width > maxWidth && line)) {
      ctx.fillText(line, x, lineY);
      line = char === "\n" ? "" : char;
      lineY += fontSize * 1.35;
      if (lineY > y + maxHeight - fontSize) return;
    } else {
      line = next;
    }
    if (index === chars.length - 1 && line && lineY <= y + maxHeight - fontSize) ctx.fillText(line, x, lineY);
  });
}

function drawSelection() {
  const selected = page().objects.find((obj) => obj.id === state.selectedId);
  if (!selected) return;
  ctx.save();
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(selected.x - 6, selected.y - 6, selected.w + 12, selected.h + 12);
  ctx.restore();
}

function pointerDown(evt) {
  canvas.setPointerCapture(evt.pointerId);
  const pos = getPos(evt);
  state.dragging = true;
  state.dragStart = pos;

  if (state.tool === "select") {
    const hit = objectAt(pos);
    state.selectedId = hit?.id || null;
    state.moveOffset = hit ? { x: pos.x - hit.x, y: pos.y - hit.y } : null;
    updateSelectionPanel();
    draw();
    return;
  }

  state.selectedId = null;
  if (state.tool === "pen" || state.tool === "eraser") {
    const dctx = page().drawing.getContext("2d");
    dctx.lineCap = "round";
    dctx.lineJoin = "round";
    dctx.lineWidth = state.size;
    dctx.globalCompositeOperation = state.tool === "eraser" ? "destination-out" : "source-over";
    dctx.strokeStyle = state.color;
    dctx.beginPath();
    dctx.moveTo(pos.x, pos.y);
  }
}

function pointerMove(evt) {
  if (!state.dragging) return;
  const pos = getPos(evt);

  if (state.tool === "pen" || state.tool === "eraser") {
    const dctx = page().drawing.getContext("2d");
    dctx.lineTo(pos.x, pos.y);
    dctx.stroke();
    draw();
    return;
  }

  if (state.tool === "select" && state.selectedId && state.moveOffset) {
    const obj = page().objects.find((item) => item.id === state.selectedId);
    obj.x = pos.x - state.moveOffset.x;
    obj.y = pos.y - state.moveOffset.y;
    draw();
    return;
  }

  draw();
  const x = Math.min(state.dragStart.x, pos.x);
  const y = Math.min(state.dragStart.y, pos.y);
  const w = Math.abs(pos.x - state.dragStart.x);
  const h = Math.abs(pos.y - state.dragStart.y);
  ctx.save();
  ctx.strokeStyle = state.color;
  ctx.lineWidth = state.size;
  ctx.setLineDash([10, 8]);
  if (state.tool === "bubble") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(x, y, w, h);
  }
  ctx.restore();
}

function pointerUp(evt) {
  if (!state.dragging) return;
  const pos = getPos(evt);
  const start = state.dragStart;
  state.dragging = false;

  if (state.tool === "pen" || state.tool === "eraser") {
    page().drawing.getContext("2d").globalCompositeOperation = "source-over";
    commitDrawing();
    draw();
    return;
  }

  if (state.tool === "select") {
    updateSelectionPanel();
    return;
  }

  const x = Math.min(start.x, pos.x);
  const y = Math.min(start.y, pos.y);
  const w = Math.max(30, Math.abs(pos.x - start.x));
  const h = Math.max(30, Math.abs(pos.y - start.y));
  if (w < 35 && h < 35) return;

  if (state.tool === "panel") {
    addObject({ kind: "panel", x, y, w, h, stroke: state.color, lineWidth: state.size });
  }
  if (state.tool === "bubble") {
    addObject({ kind: "bubble", x, y, w, h, stroke: state.color, lineWidth: Math.max(3, state.size) });
  }
  if (state.tool === "text") {
    const text = prompt("セリフを入力してください", "ここにセリフ");
    if (text) addObject({ kind: "text", x, y, w, h, text, color: state.color, fontSize: state.fontSize, vertical: true, fitBox: true });
  }
}

function addObject(obj) {
  obj.id = crypto.randomUUID();
  page().objects.push(obj);
  state.selectedId = obj.id;
  setTool("select");
  updateSelectionPanel();
  draw();
}

function commitDrawing() {
  page().drawingData = page().drawing.toDataURL("image/png");
  renderPages();
}

function syncPageControls() {
  document.querySelector("#paperInput").value = page().paper;
}

function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll(".tool").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
}

function renderPages() {
  const pageList = document.querySelector("#pageList");
  pageList.innerHTML = "";
  state.pages.forEach((p, index) => {
    const button = document.createElement("button");
    button.className = `page-thumb ${index === state.activePage ? "active" : ""}`;
    button.innerHTML = `<canvas class="mini-page" width="90" height="127"></canvas><span>${index + 1}ページ</span>`;
    button.addEventListener("click", () => {
      state.activePage = index;
      state.selectedId = null;
      syncPageControls();
      renderPages();
      updateSelectionPanel();
      draw();
    });
    pageList.appendChild(button);
    drawMini(button.querySelector("canvas"), p);
  });
}

function drawMini(mini, p) {
  const mctx = mini.getContext("2d");
  mctx.fillStyle = p.paper;
  mctx.fillRect(0, 0, mini.width, mini.height);
  mctx.drawImage(p.drawing, 0, 0, mini.width, mini.height);
  mctx.strokeStyle = "#222";
  mctx.lineWidth = 1;
  p.objects.filter((obj) => obj.kind === "panel").forEach((obj) => {
    mctx.strokeRect((obj.x / canvas.width) * mini.width, (obj.y / canvas.height) * mini.height, (obj.w / canvas.width) * mini.width, (obj.h / canvas.height) * mini.height);
  });
}

function updateSelectionPanel() {
  const panel = document.querySelector("#selectionPanel");
  const selected = page().objects.find((obj) => obj.id === state.selectedId);
  if (!selected) {
    panel.innerHTML = "<p>コマ、吹き出し、文字、画像を選択すると編集できます。</p>";
    return;
  }

  const textEditor = selected.kind === "text"
    ? `<label>セリフ<textarea id="selectedText" rows="5">${escapeHtml(selected.text || "")}</textarea></label>
       <label><input id="verticalToggle" type="checkbox" ${selected.vertical ? "checked" : ""}> 縦書き</label>`
    : "";

  panel.innerHTML = `
    ${textEditor}
    <div class="field-grid">
      <label>横位置<input id="selectedX" type="number" value="${Math.round(selected.x)}"></label>
      <label>縦位置<input id="selectedY" type="number" value="${Math.round(selected.y)}"></label>
      <label>幅<input id="selectedW" type="number" value="${Math.round(selected.w)}"></label>
      <label>高さ<input id="selectedH" type="number" value="${Math.round(selected.h)}"></label>
    </div>
    <div class="selection-actions">
      <button id="frontBtn">前面</button>
      <button id="deleteBtn">削除</button>
    </div>`;

  ["selectedX", "selectedY", "selectedW", "selectedH"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", syncSelection);
  });
  document.querySelector("#deleteBtn").addEventListener("click", deleteSelection);
  document.querySelector("#frontBtn").addEventListener("click", bringToFront);
  document.querySelector("#selectedText")?.addEventListener("input", syncSelection);
  document.querySelector("#verticalToggle")?.addEventListener("change", syncSelection);
}

function syncSelection() {
  const selected = page().objects.find((obj) => obj.id === state.selectedId);
  if (!selected) return;
  selected.x = Number(document.querySelector("#selectedX").value);
  selected.y = Number(document.querySelector("#selectedY").value);
  selected.w = Number(document.querySelector("#selectedW").value);
  selected.h = Number(document.querySelector("#selectedH").value);
  if (selected.kind === "text") {
    selected.text = document.querySelector("#selectedText").value;
    selected.vertical = document.querySelector("#verticalToggle").checked;
  }
  draw();
}

function deleteSelection() {
  const current = page();
  current.objects = current.objects.filter((obj) => obj.id !== state.selectedId);
  state.selectedId = null;
  updateSelectionPanel();
  draw();
  renderPages();
}

function bringToFront() {
  const current = page();
  const index = current.objects.findIndex((obj) => obj.id === state.selectedId);
  if (index < 0) return;
  current.objects.push(current.objects.splice(index, 1)[0]);
  draw();
}

function applyLayout(layout) {
  const margin = 92;
  const gutter = 24;
  const w = canvas.width - margin * 2;
  const h = canvas.height - margin * 2;
  const panels = [];

  if (layout === "2v") {
    panels.push([margin, margin, (w - gutter) / 2, h], [margin + (w + gutter) / 2, margin, (w - gutter) / 2, h]);
  }
  if (layout === "3stack") {
    panels.push([margin, margin, w, (h - gutter * 2) / 3], [margin, margin + (h + gutter) / 3, w, (h - gutter * 2) / 3], [margin, margin + ((h + gutter) / 3) * 2, w, (h - gutter * 2) / 3]);
  }
  if (layout === "4grid") {
    panels.push([margin, margin, (w - gutter) / 2, (h - gutter) / 2], [margin + (w + gutter) / 2, margin, (w - gutter) / 2, (h - gutter) / 2], [margin, margin + (h + gutter) / 2, (w - gutter) / 2, (h - gutter) / 2], [margin + (w + gutter) / 2, margin + (h + gutter) / 2, (w - gutter) / 2, (h - gutter) / 2]);
  }
  if (layout === "cinema") {
    panels.push([margin, margin, w, h * 0.42], [margin, margin + h * 0.42 + gutter, w, h * 0.58 - gutter]);
  }

  panels.forEach(([x, y, pw, ph]) => page().objects.push({ id: crypto.randomUUID(), kind: "panel", x, y, w: pw, h: ph, stroke: "#111", lineWidth: 6 }));
  draw();
  renderPages();
}

function getLayoutRects(layout) {
  const margin = 92;
  const gutter = 24;
  const w = canvas.width - margin * 2;
  const h = canvas.height - margin * 2;

  if (layout === "2v") {
    return [
      [margin, margin, (w - gutter) / 2, h],
      [margin + (w + gutter) / 2, margin, (w - gutter) / 2, h],
    ];
  }
  if (layout === "3stack") {
    return [
      [margin, margin, w, (h - gutter * 2) / 3],
      [margin, margin + (h + gutter) / 3, w, (h - gutter * 2) / 3],
      [margin, margin + ((h + gutter) / 3) * 2, w, (h - gutter * 2) / 3],
    ];
  }
  if (layout === "cinema") {
    return [
      [margin, margin, w, h * 0.42],
      [margin, margin + h * 0.42 + gutter, w, h * 0.58 - gutter],
    ];
  }
  return [
    [margin, margin, (w - gutter) / 2, (h - gutter) / 2],
    [margin + (w + gutter) / 2, margin, (w - gutter) / 2, (h - gutter) / 2],
    [margin, margin + (h + gutter) / 2, (w - gutter) / 2, (h - gutter) / 2],
    [margin + (w + gutter) / 2, margin + (h + gutter) / 2, (w - gutter) / 2, (h - gutter) / 2],
  ];
}

function parsePromptRows(value) {
  const text = value.trim();
  if (!text) return [];
  if (text.includes(",")) return parseCsvLikeRows(text);
  return parseStoryRows(text);
}

function parseCsvLikeRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",").map((cell) => cell.trim());
      return {
        scene: cells[0] || "シーン",
        dialog: cells.slice(1).join("、") || cells[0] || "セリフ",
      };
    });
}

function parseStoryRows(text) {
  const normalized = text
    .replace(/[「『]/g, "「")
    .replace(/[」』]/g, "」")
    .replace(/\s+/g, " ");
  const sentences = splitStorySentences(normalized);

  const rows = sentences.map((sentence, index) => {
    const quoted = [...sentence.matchAll(/「([^」]+)」/g)].map((match) => match[1].trim()).filter(Boolean);
    const dialog = quoted.length ? quoted.join(" ") : makeDialogFromNarration(sentence);
    return {
      scene: inferScene(sentence, index),
      dialog,
    };
  });

  return rows.length ? rows : [{ scene: "Scene 1", dialog: makeDialogFromNarration(normalized) }];
}

function splitStorySentences(text) {
  const sentences = [];
  let current = "";
  let inQuote = false;

  [...text].forEach((char) => {
    current += char;
    if (char === "「") inQuote = true;
    if (char === "」") inQuote = false;
    if (!inQuote && /[。！？!?]/.test(char)) {
      const trimmed = current.trim();
      if (trimmed) sentences.push(trimmed);
      current = "";
    }
  });

  const rest = current.trim();
  if (rest) sentences.push(rest);
  return sentences;
}

function makeDialogFromNarration(sentence) {
  const cleaned = sentence
    .replace(/「[^」]+」/g, "")
    .replace(/[。！？!?]+$/g, "")
    .replace(/^(そのとき|すると|そして|しかし|けれど|ところが)、?/g, "")
    .trim();
  if (!cleaned) return "いこう。";

  const compact = cleaned
    .replace(/主人公は/g, "")
    .replace(/友だちは/g, "")
    .replace(/彼は|彼女は/g, "")
    .replace(/と言う|と言った|と声をかける|と笑う|とつぶやく/g, "")
    .trim();

  if (compact.length <= 18) return compact;
  return `${compact.slice(0, 18)}…`;
}

function inferScene(sentence, index) {
  const places = ["教室", "廊下", "帰り道", "公園", "部屋", "街", "駅", "屋上", "朝", "昼", "夕方", "夜"];
  const place = places.find((word) => sentence.includes(word));
  if (place) return place;
  return `Scene ${index + 1}`;
}

function chooseAutoLayout(panelCount) {
  if (panelCount <= 2) return "2v";
  if (panelCount === 3) return "3stack";
  return "4grid";
}

async function generateMangaPages() {
  const story = document.querySelector("#promptInput").value.trim();
  const rows = parsePromptRows(story);
  if (!rows.length) {
    alert("ストーリーを入力してください");
    return;
  }

  const button = document.querySelector("#generateMangaBtn");
  button.disabled = true;
  setGenerationStatus("GPTがセリフとコマ割りを設計しています...", "working");

  try {
    const storyboard = await requestGptStoryboard(story);
    buildPagesFromStoryboard(storyboard);
    setGenerationStatus("GPT設計で漫画ページを生成しました。", "");
  } catch (error) {
    buildPagesFromRows(rows);
    setGenerationStatus("GPT接続が未設定または接続できなかったため、ローカル生成で作りました。", "error");
  } finally {
    button.disabled = false;
  }
}

async function requestGptStoryboard(story) {
  const response = await fetch("/api/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      story,
      characterCount: state.assets.length,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "GPT generation failed.");
  return data;
}

function buildPagesFromRows(rows) {
  const layout = chooseAutoLayout(Math.min(rows.length, 4));
  const mode = "story";
  const rects = getLayoutRects(layout);
  const pages = [];

  for (let offset = 0; offset < rows.length; offset += rects.length) {
    const p = createPage();
    p.paper = "#ffffff";
    rects.forEach(([x, y, w, h], index) => {
      const row = rows[offset + index];
      if (!row) return;
      p.objects.push({ id: crypto.randomUUID(), kind: "panel", x, y, w, h, stroke: "#111", lineWidth: 6 });
      addGeneratedPanelArt(p, { x, y, w, h }, row, index, mode);
      p.objects.push({
        id: crypto.randomUUID(),
        kind: "bubble",
        x: x + w * 0.08,
        y: y + h * 0.07,
        w: Math.min(330, w * 0.68),
        h: Math.min(210, h * 0.36),
        stroke: "#111",
        lineWidth: 4,
      });
      p.objects.push({
        id: crypto.randomUUID(),
        kind: "text",
        x: x + w * 0.14,
        y: y + h * 0.11,
        w: Math.min(245, w * 0.5),
        h: Math.min(165, h * 0.29),
        text: row.dialog,
        color: "#111",
        fontSize: 25,
        vertical: true,
        fitBox: true,
      });
    });
    pages.push(p);
  }

  state.pages = pages;
  state.title = document.querySelector("#titleInput").value || state.title;
  finishGeneratedPages();
}

function buildPagesFromStoryboard(storyboard) {
  const pages = (storyboard.pages || []).map((storyPage) => {
    const p = createPage();
    p.paper = "#ffffff";
    const layout = storyPage.layout || chooseAutoLayout((storyPage.panels || []).length);
    const rects = getLayoutRects(layout);
    (storyPage.panels || []).slice(0, rects.length).forEach((panel, index) => {
      const [x, y, w, h] = rects[index];
      const row = {
        scene: panel.scene || `Scene ${index + 1}`,
        dialog: panel.dialogue || panel.narration || "",
        narration: panel.narration || "",
        visual: panel.visual || "",
        emotion: panel.emotion || "",
        camera: panel.camera || "",
        assetIndex: Number.isFinite(panel.assetIndex) ? panel.assetIndex : index,
      };
      p.objects.push({ id: crypto.randomUUID(), kind: "panel", x, y, w, h, stroke: "#111", lineWidth: 6 });
      addGeneratedPanelArt(p, { x, y, w, h }, row, row.assetIndex, "story");
      addGeneratedBubbleAndText(p, { x, y, w, h }, row);
    });
    return p;
  });

  state.pages = pages.length ? pages : [createPage()];
  if (storyboard.title) {
    state.title = storyboard.title;
    document.querySelector("#titleInput").value = storyboard.title;
  }
  finishGeneratedPages();
}

function addGeneratedBubbleAndText(targetPage, rect, row) {
  const x = rect.x;
  const y = rect.y;
  const w = rect.w;
  const h = rect.h;
  targetPage.objects.push({
    id: crypto.randomUUID(),
    kind: "bubble",
    x: x + w * 0.08,
    y: y + h * 0.07,
    w: Math.min(330, w * 0.68),
    h: Math.min(210, h * 0.36),
    stroke: "#111",
    lineWidth: 4,
  });
  targetPage.objects.push({
    id: crypto.randomUUID(),
    kind: "text",
    x: x + w * 0.14,
    y: y + h * 0.11,
    w: Math.min(245, w * 0.5),
    h: Math.min(165, h * 0.29),
    text: row.dialog || row.narration || "",
    color: "#111",
    fontSize: 25,
    vertical: true,
    fitBox: true,
  });
}

function finishGeneratedPages() {
  state.activePage = 0;
  state.selectedId = null;
  syncPageControls();
  renderPages();
  updateSelectionPanel();
  draw();
}

function addGeneratedPanelArt(targetPage, rect, row, index, mode) {
  const safeIndex = state.assets.length ? Math.max(0, Math.min(index, state.assets.length - 1)) : 0;
  const asset = state.assets[safeIndex];
  if (asset?.img) {
    const imageW = rect.w * 0.42;
    const imageH = Math.min(rect.h * 0.72, imageW * (asset.img.height / asset.img.width || 1.4));
    targetPage.objects.push({
      id: crypto.randomUUID(),
      kind: "image",
      x: rect.x + rect.w - imageW - 22,
      y: rect.y + rect.h - imageH - 18,
      w: imageW,
      h: imageH,
      src: asset.src,
      img: asset.img,
    });
  }

  targetPage.objects.push({
    id: crypto.randomUUID(),
    kind: "text",
    x: rect.x + 24,
    y: rect.y + rect.h - 44,
    w: rect.w - 48,
    h: 26,
    text: row.visual ? `${row.scene} / ${row.camera || ""}`.trim() : `${modeLabel(mode)}: ${row.scene}`,
    color: "#343a37",
    fontSize: 18,
    vertical: false,
  });
}

function modeLabel(mode) {
  return { story: "Story", character: "Character", scene: "Scene" }[mode] || "Story";
}

function setGenerationStatus(message, type = "") {
  const status = document.querySelector("#generationStatus");
  status.textContent = message;
  status.className = `generation-status ${type}`.trim();
}

function renderAssets() {
  const list = document.querySelector("#assetList");
  list.innerHTML = "";
  state.assets.forEach((asset) => {
    const item = document.createElement("div");
    item.className = "asset-item";
    item.innerHTML = `<img src="${asset.src}" alt="">`;
    list.appendChild(item);
  });
}

function loadAssets(files) {
  [...files].forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.assets.push({ id: crypto.randomUUID(), name: file.name, src: reader.result, img });
        renderAssets();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadAllPages() {
  const originalPage = state.activePage;
  const originalSelection = state.selectedId;
  state.selectedId = null;
  state.pages.forEach((_, index) => {
    state.activePage = index;
    draw();
    const link = document.createElement("a");
    link.download = `${state.title || "manga"}-page-${index + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  state.activePage = originalPage;
  state.selectedId = originalSelection;
  renderPages();
  draw();
}

function saveProject() {
  const data = {
    title: state.title,
    activePage: state.activePage,
    pages: state.pages.map((p) => ({
      id: p.id,
      paper: p.paper,
      drawingData: p.drawing.toDataURL("image/png"),
      objects: p.objects.map((obj) => {
        const copy = { ...obj };
        delete copy.img;
        return copy;
      }),
    })),
  };
  localStorage.setItem("manga-page-studio", JSON.stringify(data));
  alert("保存しました");
}

async function loadProject() {
  const raw = localStorage.getItem("manga-page-studio");
  if (!raw) {
    alert("保存データがありません");
    return;
  }
  const data = JSON.parse(raw);
  state.title = data.title || "新しい漫画";
  state.activePage = data.activePage || 0;
  state.pages = await Promise.all(data.pages.map(hydratePage));
  document.querySelector("#titleInput").value = state.title;
  syncPageControls();
  state.selectedId = null;
  renderPages();
  updateSelectionPanel();
  draw();
}

async function hydratePage(data) {
  const p = createPage();
  p.id = data.id || crypto.randomUUID();
  p.paper = data.paper || "#fff";
  p.objects = await Promise.all((data.objects || []).map(hydrateObject));
  if (data.drawingData) {
    await drawImageDataToCanvas(data.drawingData, p.drawing);
    p.drawingData = data.drawingData;
  }
  return p;
}

function hydrateObject(obj) {
  return new Promise((resolve) => {
    const copy = { ...obj };
    if (copy.kind !== "image" || !copy.src) {
      resolve(copy);
      return;
    }
    const img = new Image();
    img.onload = () => {
      copy.img = img;
      resolve(copy);
    };
    img.onerror = () => resolve(copy);
    img.src = copy.src;
  });
}

function drawImageDataToCanvas(src, targetCanvas) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      targetCanvas.getContext("2d").drawImage(img, 0, 0);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function exportPng() {
  const oldSelected = state.selectedId;
  state.selectedId = null;
  draw();
  const link = document.createElement("a");
  link.download = `${state.title || "manga"}-page-${state.activePage + 1}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  state.selectedId = oldSelected;
  draw();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

document.querySelectorAll(".tool").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
document.querySelector("#colorInput").addEventListener("input", (evt) => (state.color = evt.target.value));
document.querySelector("#sizeInput").addEventListener("input", (evt) => (state.size = Number(evt.target.value)));
document.querySelector("#fontInput").addEventListener("input", (evt) => (state.fontSize = Number(evt.target.value)));
document.querySelector("#titleInput").addEventListener("input", (evt) => (state.title = evt.target.value));
document.querySelector("#paperInput").addEventListener("input", (evt) => {
  page().paper = evt.target.value;
  draw();
});
document.querySelector("#addPageBtn").addEventListener("click", () => {
  state.pages.push(createPage());
  state.activePage = state.pages.length - 1;
  syncPageControls();
  renderPages();
  draw();
});
document.querySelector("#duplicatePageBtn").addEventListener("click", async () => {
  const copy = await hydratePage({
    id: crypto.randomUUID(),
    paper: page().paper,
    drawingData: page().drawing.toDataURL("image/png"),
    objects: JSON.parse(JSON.stringify(page().objects.map(({ img, ...obj }) => obj))),
  });
  state.pages.splice(state.activePage + 1, 0, copy);
  state.activePage += 1;
  syncPageControls();
  renderPages();
  draw();
});
document.querySelector("#imageInput").addEventListener("change", (evt) => {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const w = 360;
      const h = (img.height / img.width) * w;
      addObject({ kind: "image", x: 120, y: 120, w, h, src: reader.result, img });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
document.querySelector("#assetInput").addEventListener("change", (evt) => loadAssets(evt.target.files));
document.querySelector("#generateMangaBtn").addEventListener("click", generateMangaPages);
document.querySelector("#downloadAllBtn").addEventListener("click", downloadAllPages);
document.querySelector("#saveBtn").addEventListener("click", saveProject);
document.querySelector("#loadBtn").addEventListener("click", loadProject);
document.querySelector("#exportBtn").addEventListener("click", exportPng);
document.querySelectorAll("[data-layout]").forEach((button) => button.addEventListener("click", () => applyLayout(button.dataset.layout)));
canvas.addEventListener("pointerdown", pointerDown);
canvas.addEventListener("pointermove", pointerMove);
canvas.addEventListener("pointerup", pointerUp);
window.addEventListener("keydown", (evt) => {
  if (evt.key === "Delete" || evt.key === "Backspace") {
    if (state.selectedId && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") deleteSelection();
  }
});

renderPages();
syncPageControls();
draw();
