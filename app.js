'use strict';

/* =========================================================
   Kernel Café: convolution explorer (all client-side)
   ========================================================= */

const $ = id => document.getElementById(id);
const OVERLAY = 512; // overlay canvas resolution

/* ---------- kernel presets ---------- */
const outer = v => v.flatMap(a => v.map(b => a * b));
const embed5 = k3 => {
  const k = new Array(25).fill(0);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) k[(j + 1) * 5 + i + 1] = k3[j * 3 + i];
  return k;
};
const crop3 = k5 => {
  const k = [];
  for (let j = 1; j < 4; j++) for (let i = 1; i < 4; i++) k.push(k5[j * 5 + i]);
  return k;
};

const PRESETS = {
  identity: { name: '🪞 Identity', k: [0,0,0, 0,1,0, 0,0,0], norm: false, mode: 'clamp',
    hint: 'Copies the image exactly: the center weight is 1 and everything else is 0.' },
  box: { name: '☁️ Box Blur', k: [1,1,1, 1,1,1, 1,1,1], k5: new Array(25).fill(1), norm: true, mode: 'clamp',
    hint: 'Averages each pixel with its neighbours, so everything gets soft and fuzzy. Try it on the Noisy kitty!' },
  gauss: { name: '🍡 Gaussian', k: [1,2,1, 2,4,2, 1,2,1], k5: outer([1,4,6,4,1]), norm: true, mode: 'clamp',
    hint: 'A weighted average: close neighbours count more than far ones. A smooth, natural blur.' },
  sharpen: { name: '💎 Sharpen', k: [0,-1,0, -1,5,-1, 0,-1,0], norm: false, mode: 'clamp',
    hint: 'Boosts the center pixel and subtracts the neighbours, so details pop out.' },
  sobelX: { name: '↔️ Sobel X', k: [-1,0,1, -2,0,2, -1,0,1], norm: false, mode: 'abs',
    hint: 'Right side minus left side. It lights up where brightness changes left→right, i.e. vertical edges!' },
  sobelY: { name: '↕️ Sobel Y', k: [-1,-2,-1, 0,0,0, 1,2,1], norm: false, mode: 'abs',
    hint: 'Bottom minus top. It finds horizontal edges.' },
  laplace: { name: '🌟 Edges', k: [-1,-1,-1, -1,8,-1, -1,-1,-1], norm: false, mode: 'abs',
    hint: 'Center minus all 8 neighbours. Flat areas become 0 (black), edges in every direction glow.' },
  emboss: { name: '🍪 Emboss', k: [-2,-1,0, -1,1,1, 0,1,2], norm: false, mode: 'clamp',
    hint: 'A diagonal difference plus a bit of the original, so it looks pressed into paper.' },
};

/* ---------- sample images (drawn procedurally, in a 64×64 coordinate space) ---------- */
function tri(ctx, a, b, c) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath(); ctx.fill(); }
function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

function drawKitty(ctx) {
  ctx.fillStyle = '#dcdcdc'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#8a8a8a'; tri(ctx, [10, 30], [15, 5], [29, 19]); tri(ctx, [54, 30], [49, 5], [35, 19]);
  ctx.fillStyle = '#bdbdbd'; tri(ctx, [15, 24], [16.5, 11], [25, 19]); tri(ctx, [49, 24], [47.5, 11], [39, 19]);
  ctx.fillStyle = '#8a8a8a'; dot(ctx, 32, 37, 22);
  ctx.fillStyle = '#a8a8a8'; dot(ctx, 17, 44, 3.5); dot(ctx, 47, 44, 3.5);
  ctx.fillStyle = '#1c1c1c'; dot(ctx, 23, 34, 4.5); dot(ctx, 41, 34, 4.5);
  ctx.fillStyle = '#ffffff'; dot(ctx, 24.5, 32.5, 1.6); dot(ctx, 42.5, 32.5, 1.6);
  ctx.fillStyle = '#3e3e3e'; tri(ctx, [29, 41], [35, 41], [32, 44]);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(32, 44); ctx.quadraticCurveTo(30, 48, 27, 46);
  ctx.moveTo(32, 44); ctx.quadraticCurveTo(34, 48, 37, 46); ctx.stroke();
  ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, 38); ctx.lineTo(18, 40); ctx.moveTo(4, 45); ctx.lineTo(18, 43);
  ctx.moveTo(60, 38); ctx.lineTo(46, 40); ctx.moveTo(60, 45); ctx.lineTo(46, 43);
  ctx.stroke();
}
function drawCheckers(ctx) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#2b2b2b' : '#e8e8e8';
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
}
function drawShapes(ctx) {
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#3a3a3a'); g.addColorStop(1, '#cfcfcf');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff'; dot(ctx, 19, 19, 11);
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(36, 8, 20, 20);
  ctx.fillStyle = '#f4f4f4'; tri(ctx, [32, 36], [50, 58], [14, 58]);
}
function drawLetters(ctx) {
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CV', 32, 24);
  ctx.fillStyle = '#7a7a7a'; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4 : 10, a = -Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(32 + r * Math.cos(a), 49 + r * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}

const SAMPLES = [
  { id: 'kitty', name: 'Kitty', draw: drawKitty },
  { id: 'noisy', name: 'Noisy', draw: drawKitty, noise: 45 },
  { id: 'checkers', name: 'Checkers', draw: drawCheckers },
  { id: 'shapes', name: 'Shapes', draw: drawShapes },
  { id: 'letters', name: 'Letters', draw: drawLetters },
];

/* ---------- state ---------- */
const S = {
  N: 64,
  img: null,           // Float32Array N×N grayscale input (integers 0–255)
  source: { type: 'sample', sample: SAMPLES[0] },
  k: 3,
  kernel: PRESETS.identity.k.slice(),
  preset: 'identity',
  norm: false,
  padding: 'zero',
  stride: 1,
  mode: 'clamp',
  outN: 0, total: 0,
  out: null,           // raw (unclamped) output values
  done: null,          // 1 = pixel computed
  cursor: 0,           // next output index to compute
  playing: false,
  speed: 3,
  frame: 0,
  hover: null,         // output index being inspected
};

// speed levels: `every` = frames between steps, `n` = steps per tick
const SPEEDS = [
  { every: 40, n: 1 }, { every: 15, n: 1 }, { every: 6, n: 1 }, { every: 2, n: 1 }, { every: 1, n: 1 },
  { every: 1, n: 3 }, { every: 1, n: 8 }, { every: 1, n: 20 }, { every: 1, n: 60 }, { every: 1, n: 200 },
];

/* ---------- image loading ---------- */
function grayFromCanvas(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const g = new Float32Array(c.width * c.height);
  for (let i = 0; i < g.length; i++) {
    g[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }
  return g;
}

function renderSample(sample, n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const ctx = c.getContext('2d');
  ctx.scale(n / 64, n / 64);
  sample.draw(ctx);
  const g = grayFromCanvas(c);
  if (sample.noise) {
    let seed = 1234567;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < g.length; i++) {
      const v = g[i] + (rnd() + rnd() + rnd() - 1.5) * sample.noise;
      g[i] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return g;
}

function loadSource() {
  const n = S.N;
  if (S.source.type === 'sample') {
    S.img = renderSample(S.source.sample, n);
  } else {
    const im = S.source.image;
    const side = Math.min(im.naturalWidth, im.naturalHeight); // center-crop to a square
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, n, n);
    S.img = grayFromCanvas(c);
  }
  renderInput();
  refresh(false);
}

function renderInput() {
  const c = $('inCanvas');
  c.width = c.height = S.N;
  const id = c.getContext('2d').createImageData(S.N, S.N);
  for (let i = 0; i < S.img.length; i++) {
    const v = S.img[i];
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  c.getContext('2d').putImageData(id, 0, 0);
}

/* ---------- convolution core ---------- */
const pad = () => (S.padding === 'none' ? 0 : Math.floor(S.k / 2));
const outSize = () => Math.floor((S.N + 2 * pad() - S.k) / S.stride) + 1;
const kernelSum = () => S.kernel.reduce((a, b) => a + b, 0);
const divisor = () => { const s = kernelSum(); return S.norm && s !== 0 ? s : 1; };

function getPixel(x, y) {
  const N = S.N;
  if (x >= 0 && y >= 0 && x < N && y < N) return S.img[y * N + x];
  if (S.padding === 'replicate') {
    x = Math.max(0, Math.min(N - 1, x));
    y = Math.max(0, Math.min(N - 1, y));
    return S.img[y * N + x];
  }
  return 0;
}

function convolveAt(ox, oy) {
  const k = S.k, p = pad();
  const x0 = ox * S.stride - p, y0 = oy * S.stride - p;
  const patch = [], prods = [], isPad = [];
  let sum = 0;
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < k; i++) {
      const x = x0 + i, y = y0 + j;
      const v = getPixel(x, y);
      const w = S.kernel[j * k + i];
      patch.push(v);
      isPad.push(x < 0 || y < 0 || x >= S.N || y >= S.N);
      prods.push(v * w);
      sum += v * w;
    }
  }
  const div = divisor();
  return { ox, oy, x0, y0, patch, isPad, prods, sum, div, value: sum / div };
}

function computeIdx(i) {
  const r = convolveAt(i % S.outN, Math.floor(i / S.outN));
  S.out[i] = r.value;
  S.done[i] = 1;
  return r;
}

function reset() {
  S.outN = Math.max(1, outSize());
  S.total = S.outN * S.outN;
  S.out = new Float32Array(S.total);
  S.done = new Uint8Array(S.total);
  S.cursor = 0;
  S.hover = null;
  const c = $('outCanvas');
  c.width = c.height = S.outN;
}

/* Rebuild the output. Kernel tweaks keep progress; geometry changes keep only "finished". */
function refresh(keepProgress = true) {
  const prevCursor = S.cursor, prevTotal = S.total, prevN = S.outN;
  const wasDone = prevTotal > 0 && prevCursor === prevTotal;
  reset();
  if (wasDone) {
    runAll(false);
  } else if (keepProgress && S.outN === prevN) {
    for (let i = 0; i < prevCursor; i++) computeIdx(i);
    S.cursor = prevCursor;
  }
  draw();
}

function step() {
  if (S.cursor >= S.total) return;
  computeIdx(S.cursor++);
}

function stepBack() {
  if (S.cursor <= 0) return;
  S.cursor--;
  S.done[S.cursor] = 0;
}

function runAll(celebrate = true) {
  for (let i = S.cursor; i < S.total; i++) computeIdx(i);
  S.cursor = S.total;
  if (celebrate) yay();
}

/* ---------- display ---------- */
function computedRange() {
  let mn = Infinity, mx = -Infinity, neg = false, over = false;
  for (let i = 0; i < S.total; i++) {
    if (!S.done[i]) continue;
    const v = S.out[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    if (v < -0.5) neg = true;
    if (v > 255.5) over = true;
  }
  return { mn, mx, neg, over };
}

function toDisplay(v, range) {
  let d;
  if (S.mode === 'abs') d = Math.abs(v);
  else if (S.mode === 'rescale') d = range.mx > range.mn ? (v - range.mn) / (range.mx - range.mn) * 255 : 128;
  else d = v;
  return Math.round(Math.max(0, Math.min(255, d)));
}

function renderOutput(range) {
  const c = $('outCanvas'), ctx = c.getContext('2d');
  const id = ctx.createImageData(S.outN, S.outN), d = id.data;
  for (let i = 0; i < S.total; i++) {
    if (S.done[i]) {
      const v = toDisplay(S.out[i], range);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    } else {
      d[i * 4] = 255; d[i * 4 + 1] = 227; d[i * 4 + 2] = 238;
    }
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function drawOverlays(r) {
  const inCtx = $('inOverlay').getContext('2d');
  const outCtx = $('outOverlay').getContext('2d');
  inCtx.clearRect(0, 0, OVERLAY, OVERLAY);
  outCtx.clearRect(0, 0, OVERLAY, OVERLAY);
  if (!r) return;

  // sliding window on input
  const s = OVERLAY / S.N;
  const x = r.x0 * s, y = r.y0 * s, w = S.k * s;
  inCtx.fillStyle = 'rgba(255,143,177,0.28)';
  roundRect(inCtx, x, y, w, w, Math.min(10, w / 4)); inCtx.fill();
  inCtx.lineWidth = 6; inCtx.strokeStyle = '#ffffff'; inCtx.setLineDash([]); inCtx.stroke();
  inCtx.lineWidth = 3; inCtx.strokeStyle = '#F2678F'; inCtx.setLineDash([8, 5]); inCtx.stroke();
  // center pixel
  const cx = (r.x0 + Math.floor(S.k / 2)) * s;
  const cy = (r.y0 + Math.floor(S.k / 2)) * s;
  inCtx.setLineDash([]); inCtx.lineWidth = 2; inCtx.strokeStyle = '#ffffff';
  inCtx.strokeRect(cx + 1, cy + 1, Math.max(2, s - 2), Math.max(2, s - 2));

  // target pixel on output
  const so = OVERLAY / S.outN;
  const pad2 = Math.max(3, so * 0.25);
  roundRect(outCtx, r.ox * so - pad2, r.oy * so - pad2, so + pad2 * 2, so + pad2 * 2, 6);
  outCtx.lineWidth = 5; outCtx.strokeStyle = '#ffffff'; outCtx.stroke();
  outCtx.lineWidth = 2.5; outCtx.strokeStyle = '#F2678F'; outCtx.stroke();
}

const fmt = v => {
  const s = Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
  return s.replace('-', '−');
};
const signCls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

function renderMath(r, label, range) {
  const k = S.k, cls = k === 5 ? 'mgrid k5' : 'mgrid';
  const cols = `repeat(${k}, auto)`;
  for (const id of ['mPatch', 'mKernel', 'mProd']) {
    $(id).className = cls;
    $(id).style.gridTemplateColumns = cols;
  }
  if (!r) return;

  $('mPatch').innerHTML = r.patch.map((v, i) => {
    const txt = v > 135 ? '#5A3E4B' : '#ffffff';
    return `<div class="${r.isPad[i] ? 'pad' : ''}" style="background:rgb(${v},${v},${v});color:${txt}"
      title="${r.isPad[i] ? 'padding pixel' : 'image pixel'}">${fmt(v)}</div>`;
  }).join('');
  $('mKernel').innerHTML = S.kernel.map(w => `<div class="${signCls(w)}">${fmt(w)}</div>`).join('');
  $('mProd').innerHTML = r.prods.map(v => `<div class="${signCls(v)}">${fmt(v)}</div>`).join('');

  const shown = toDisplay(r.value, range);
  const modeTxt = { clamp: 'clamped', abs: 'absolute', rescale: 'rescaled' }[S.mode];
  $('mResult').innerHTML = `
    <small>add them all up</small>
    <span class="big">Σ = ${fmt(r.sum)}</span>
    ${r.div !== 1 ? `<span>÷ ${fmt(r.div)} = ${fmt(Math.round(r.value * 100) / 100)}</span>` : ''}
    <small>${modeTxt} → pixel value <b>${shown}</b></small>
    <div class="swatch" style="background:rgb(${shown},${shown},${shown})"></div>`;

  const half = Math.floor(k / 2);
  const tag = { hover: '<span class="tag hover">👀 inspecting</span>',
                last: '<span class="tag">✅ just computed</span>',
                next: '<span class="tag next">⏳ next up</span>' }[label];
  $('mathWhere').innerHTML = `${tag} output pixel <b>(${r.ox}, ${r.oy})</b> ← ${k}×${k} patch centered on input pixel <b>(${r.x0 + half}, ${r.y0 + half})</b>`;

  if (k === 3) {
    const terms = r.patch.map((v, i) => `(${fmt(v)}×${fmt(S.kernel[i])})`).join(' + ');
    $('mEq').textContent = `${terms} = ${fmt(r.sum)}${r.div !== 1 ? ` → ÷ ${fmt(r.div)} = ${fmt(Math.round(r.value * 100) / 100)}` : ''}`;
  } else {
    $('mEq').textContent = `25 products added together = ${fmt(r.sum)}${r.div !== 1 ? ` → ÷ ${fmt(r.div)} = ${fmt(Math.round(r.value * 100) / 100)}` : ''}`;
  }
}

function focusPixel() {
  if (S.hover !== null && S.hover < S.total) return { idx: S.hover, label: 'hover' };
  if (S.cursor > 0) return { idx: S.cursor - 1, label: 'last' };
  return { idx: 0, label: 'next' };
}

function draw() {
  const range = computedRange();
  renderOutput(range);
  const f = focusPixel();
  const r = convolveAt(f.idx % S.outN, Math.floor(f.idx / S.outN));
  drawOverlays(r);
  renderMath(r, f.label, range);

  const pct = S.total ? S.cursor / S.total : 0;
  $('progressBar').style.width = `${pct * 100}%`;
  const doneTxt = S.cursor === S.total ? ' · ✨ all done! ✨' : '';
  $('stats').innerHTML = `Input ${S.N}×${S.N} → output <b>${S.outN}×${S.outN}</b> · ${S.cursor}/${S.total} pixels${doneTxt}` +
    (S.cursor ? `<br>raw values range from ${fmt(Math.round(range.mn * 10) / 10)} to ${fmt(Math.round(range.mx * 10) / 10)}` : '');

  const warn = $('warn');
  if (S.mode === 'clamp' && range.neg) {
    warn.hidden = false;
    warn.textContent = '💧 Some results are negative, so “clamp” turns them black. Try “Absolute value” to see them!';
  } else if (S.mode === 'clamp' && range.over) {
    warn.hidden = false;
    warn.textContent = '☀️ Some results are above 255 and got clipped to white. Try “Normalize” or “Rescale”!';
  } else {
    warn.hidden = true;
  }
}

function yay() {
  const card = $('outCard');
  card.classList.remove('yay');
  void card.offsetWidth;
  card.classList.add('yay');
}

/* ---------- playback ---------- */
function setPlaying(on) {
  S.playing = on;
  $('playBtn').textContent = on ? '⏸' : '▶';
  if (on) {
    if (S.cursor >= S.total) { reset(); }
    S.hover = null;
    S.frame = 0;
    requestAnimationFrame(tick);
  }
}

function tick() {
  if (!S.playing) return;
  const sp = SPEEDS[S.speed];
  if (S.frame++ % sp.every === 0) {
    for (let i = 0; i < sp.n; i++) step();
    draw();
  }
  if (S.cursor >= S.total) {
    setPlaying(false);
    draw();
    yay();
    return;
  }
  requestAnimationFrame(tick);
}

function updateSpeedLabel() {
  const sp = SPEEDS[S.speed];
  const perSec = Math.round(60 / sp.every * sp.n);
  $('speedLabel').textContent = `≈ ${perSec} pixel${perSec === 1 ? '' : 's'} per second`;
}

/* ---------- kernel UI ---------- */
function buildKernelGrid() {
  const g = $('kernelGrid');
  g.className = S.k === 5 ? 'kgrid k5' : 'kgrid';
  g.style.gridTemplateColumns = `repeat(${S.k}, 1fr)`;
  g.innerHTML = '';
  S.kernel.forEach((w, i) => {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = 'any';
    inp.value = w;
    inp.className = signCls(w);
    inp.setAttribute('aria-label', `kernel row ${Math.floor(i / S.k) + 1}, column ${i % S.k + 1}`);
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      S.kernel[i] = Number.isFinite(v) ? v : 0;
      inp.className = signCls(S.kernel[i]);
      setPreset(null);
      updateKSum();
      refresh();
    });
    inp.addEventListener('blur', () => { inp.value = S.kernel[i]; });
    inp.addEventListener('focus', () => inp.select());
    g.appendChild(inp);
  });
  updateKSum();
}

function updateKSum() {
  const s = kernelSum();
  let txt = `sum = <b>${fmt(Math.round(s * 1000) / 1000)}</b>`;
  if (S.norm) txt += s !== 0 ? ` → every result ÷ ${fmt(s)}` : ' (sum is 0, so no dividing)';
  $('kSum').innerHTML = txt;
}

function setPreset(key) {
  S.preset = key;
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  $('presetHint').textContent = key ? PRESETS[key].hint : '✏️ Custom kernel! Watch how each number changes the math below.';
}

function applyPreset(key) {
  const p = PRESETS[key];
  S.kernel = S.k === 5 ? (p.k5 ? p.k5.slice() : embed5(p.k)) : p.k.slice();
  S.norm = p.norm;
  S.mode = p.mode;
  $('normalize').checked = S.norm;
  $('displayMode').value = S.mode;
  setPreset(key);
  buildKernelGrid();
  refresh();
}

function setKernelSize(k) {
  if (k === S.k) return;
  const p = S.preset && PRESETS[S.preset];
  if (k === 5) S.kernel = p ? (p.k5 ? p.k5.slice() : embed5(p.k)) : embed5(S.kernel);
  else S.kernel = p ? p.k.slice() : crop3(S.kernel);
  S.k = k;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', +b.dataset.k === k));
  buildKernelGrid();
  refresh(false);
}

/* ---------- hover / touch inspection ---------- */
function pointerToFrac(e, el) {
  const r = el.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
}
const clampI = (v, n) => Math.max(0, Math.min(n - 1, v));

function inspectOutput(e) {
  const [fx, fy] = pointerToFrac(e, $('outStage'));
  const ox = clampI(Math.floor(fx * S.outN), S.outN), oy = clampI(Math.floor(fy * S.outN), S.outN);
  S.hover = oy * S.outN + ox;
  draw();
}

function inspectInput(e) {
  const [fx, fy] = pointerToFrac(e, $('inStage'));
  const px = Math.floor(fx * S.N), py = Math.floor(fy * S.N);
  const off = pad() - Math.floor(S.k / 2);
  const ox = clampI(Math.round((px + off) / S.stride), S.outN);
  const oy = clampI(Math.round((py + off) / S.stride), S.outN);
  S.hover = oy * S.outN + ox;
  draw();
}

function clearHover(e) {
  if (e.pointerType === 'mouse') { S.hover = null; draw(); }
}

/* ---------- wiring ---------- */
function init() {
  // sample thumbnails
  const thumbs = $('thumbs');
  SAMPLES.forEach((sm, i) => {
    const b = document.createElement('button');
    b.className = 'thumb' + (i === 0 ? ' active' : '');
    b.title = sm.name;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = renderSample(sm, 64), ctx = c.getContext('2d'), id = ctx.createImageData(64, 64);
    g.forEach((v, j) => { id.data[j * 4] = id.data[j * 4 + 1] = id.data[j * 4 + 2] = v; id.data[j * 4 + 3] = 255; });
    ctx.putImageData(id, 0, 0);
    b.append(c, sm.name);
    b.addEventListener('click', () => {
      document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      b.classList.add('active');
      S.source = { type: 'sample', sample: sm };
      loadSource();
    });
    thumbs.appendChild(b);
  });

  $('upload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        S.source = { type: 'file', image: im };
        loadSource();
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('bigImg').addEventListener('change', e => {
    S.N = e.target.checked ? 256 : 64;
    if (S.N === 256 && S.speed < 8) { S.speed = 8; $('speed').value = 8; updateSpeedLabel(); }
    loadSource();
  });

  // presets
  const pr = $('presets');
  Object.entries(PRESETS).forEach(([key, p]) => {
    const b = document.createElement('button');
    b.className = 'preset';
    b.dataset.key = key;
    b.textContent = p.name;
    b.addEventListener('click', () => applyPreset(key));
    pr.appendChild(b);
  });

  document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => setKernelSize(+b.dataset.k)));
  $('normalize').addEventListener('change', e => { S.norm = e.target.checked; updateKSum(); refresh(); });
  $('displayMode').addEventListener('change', e => { S.mode = e.target.value; draw(); });
  $('padding').addEventListener('change', e => { S.padding = e.target.value; refresh(false); });
  $('stride').addEventListener('change', e => { S.stride = +e.target.value; refresh(false); });
  $('speed').addEventListener('input', e => { S.speed = +e.target.value; updateSpeedLabel(); });

  $('playBtn').addEventListener('click', () => setPlaying(!S.playing));
  $('stepBtn').addEventListener('click', () => { setPlaying(false); S.hover = null; step(); draw(); if (S.cursor === S.total) yay(); });
  $('backBtn').addEventListener('click', () => { setPlaying(false); S.hover = null; stepBack(); draw(); });
  $('resetBtn').addEventListener('click', () => { setPlaying(false); reset(); draw(); });
  $('instantBtn').addEventListener('click', () => { setPlaying(false); S.hover = null; runAll(); draw(); });

  $('outStage').addEventListener('pointermove', inspectOutput);
  $('outStage').addEventListener('pointerdown', inspectOutput);
  $('outStage').addEventListener('pointerleave', clearHover);
  $('inStage').addEventListener('pointermove', inspectInput);
  $('inStage').addEventListener('pointerdown', inspectInput);
  $('inStage').addEventListener('pointerleave', clearHover);

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!S.playing); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); $('stepBtn').click(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); $('backBtn').click(); }
  });

  updateSpeedLabel();
  setPreset('identity');
  buildKernelGrid();
  loadSource();
}

init();
