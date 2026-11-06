#!/usr/bin/env node
/**
 * CUBBOOK 圖標產生器（G11 標準 · BOOK 家族版式）
 *
 * 對齊 VSBOOK / ROVERBOOK / SCOUTBOOK 實際出街圖標的設計基因：
 *   圓角布色方塊（radius 0.192）＋ 內嵌金線（inset 0.04 / stroke 0.017）
 *   ＋ 單色金浮雕：上方「水滴環」（家族共用記號）＋ 下方支部圖案。
 *   CUBBOOK 的支部圖案＝「C」（VSBOOK 用 V、ROVERBOOK 用缽＋橫桿、SCOUTBOOK 用打開的紀錄冊）。
 *
 * 配色：幼童軍黃 #ead040（#f0d85e → #ead040 → #c0a21c）作金浮雕，
 * 深金布面 #664c0e → #3a2a08 → #14100a 作底；不用森林綠、酒紅或海軍藍。
 * 黃底不配白字；金色只配深布面。零外部 npm 依賴（node:zlib + 自寫 PNG/ICO 編碼器）。
 *
 * 輸出：web/public/icons/ 九件套、根目錄 favicon.ico / favicon-32.png /
 * favicon-48.png，以及由同一組座標產生的 favicon.svg。
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'web', 'public');
const outDir = path.join(publicDir, 'icons');
mkdirSync(outDir, { recursive: true });

/* ---------------------------------------------------------------- PNG／ICO */

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function quantize(rgba, step) {
  for (let i = 0; i < rgba.length; i += 4) {
    for (let k = 0; k < 3; k++) rgba[i + k] = Math.round(rgba[i + k] / step) * step;
  }
  return rgba;
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const off = y * (stride + 1);
    raw[off] = 1; // Sub filter
    for (let x = 0; x < stride; x++) {
      raw[off + 1 + x] = (rgba[y * stride + x] - (x >= 4 ? rgba[y * stride + x - 4] : 0)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dirs = [];
  let offset = 6 + entries.length * 16;
  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = size >= 256 ? 0 : size;
    dir[1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)]);
}

/* ------------------------------------------------------------------- 繪圖 */

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay || 1));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function sdTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  const d = Math.min(sdSegment(px, py, ax, ay, bx, by), sdSegment(px, py, bx, by, cx, cy), sdSegment(px, py, cx, cy, ax, ay));
  return hasNeg && hasPos ? d : -d;
}

/* 家族共用記號：水滴環（外尖上、內孔同形） */
const RING = { cx: 0.5, cy: 0.4, r: 0.15, stroke: 0.072 };

function sdTeardrop(px, py, cx, cy, r) {
  const d = Math.hypot(px - cx, py - cy) - r;
  const apex = cy - r * 1.95;
  const t = sdTriangle(px, py, cx - r * 0.54, cy - r * 0.86, cx + r * 0.54, cy - r * 0.86, cx, apex);
  return Math.min(d, t);
}

function dropletRing(x, y) {
  const outer = sdTeardrop(x, y, RING.cx, RING.cy, RING.r);
  const inner = sdTeardrop(x, y, RING.cx, RING.cy + 0.004, RING.r - RING.stroke);
  return Math.max(outer, -inner);
}

/* CUBBOOK 支部圖案：粗金「C」，右側開口，與 VSBOOK 的「V」同一層級 */
function cubLetter(x, y) {
  const ring = Math.abs(Math.hypot(x - 0.5, y - 0.72) - 0.12) - 0.04;
  const opening = sdRoundBox(x, y, 0.70, 0.72, 0.17, 0.070, 0.025);
  return Math.max(ring, -opening);
}

function glyph(x, y) {
  return Math.min(dropletRing(x, y), cubLetter(x, y));
}

/** 布面／金箔色票（6 色以上；深布面配金，不用其他支部的綠／紅／藍） */
const C = {
  clothLight: [102, 76, 14],
  clothMid: [58, 42, 8],
  clothDeep: [20, 16, 10],
  goldLight: [240, 216, 94],
  gold: [234, 208, 64],
  goldDeep: [192, 162, 28],
  ink: [26, 18, 6],
  ivory: [247, 242, 231],
};

function paintCloth(u, v) {
  const glow = clamp(1 - Math.hypot((u - 0.3) * 1.15, (v - 0.2) * 1.15));
  const diag = clamp(u * 0.45 + v * 0.55);
  return [
    mix(mix(C.clothMid[0], C.clothDeep[0], diag * 0.85), C.clothLight[0], glow * 0.6),
    mix(mix(C.clothMid[1], C.clothDeep[1], diag * 0.85), C.clothLight[1], glow * 0.6),
    mix(mix(C.clothMid[2], C.clothDeep[2], diag * 0.85), C.clothLight[2], glow * 0.6),
  ];
}

function paintGold(gy) {
  const t = clamp((gy - 0.18) / 0.64);
  return [
    mix(C.goldLight[0], C.goldDeep[0], t * 0.55),
    mix(C.goldLight[1], C.goldDeep[1], t * 0.55),
    mix(C.goldLight[2], C.goldDeep[2], t * 0.55),
  ];
}

/** 方形圖標（maskable：圖案收在中央 66% 安全區，布面照樣滿版） */
function renderSquare(size, { maskable = false, rounded = true } = {}) {
  const rgba = new Uint8Array(size * size * 4);
  const scale = maskable ? 0.665 / 0.82 : 1;
  const px = 1.15 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const gx = (u - 0.5) / scale + 0.5;
      const gy = (v - 0.5) / scale + 0.5;

      let [r, g, b] = paintCloth(u, v);
      const aTile = rounded ? 1 - smooth(-px, px, sdRoundBox(u, v, 0.5, 0.5, 0.5, 0.5, 0.192)) : 1;

      // 內嵌金線
      let aGold = 0;
      if (rounded) {
        const inset = sdRoundBox(u, v, 0.5, 0.5, 0.5 - 0.04, 0.5 - 0.04, 0.165);
        aGold = (1 - smooth(-0.007, 0.007, Math.abs(inset) - 0.0085)) * 0.95;
      }

      // 金浮雕：家族水滴環 ＋ CUBBOOK「C」
      const aG = 1 - smooth(-1.3 / size, 1.3 / size, glyph(gx, gy));
      const [gr, gg, gb] = paintGold(gy);
      aGold = Math.max(aGold, aG);
      r = mix(r, gr, aGold);
      g = mix(g, gg, aGold);
      b = mix(b, gb, aGold);

      const i = (y * size + x) * 4;
      rgba[i] = clamp(Math.round(r), 0, 255);
      rgba[i + 1] = clamp(Math.round(g), 0, 255);
      rgba[i + 2] = clamp(Math.round(b), 0, 255);
      rgba[i + 3] = clamp(Math.round(aTile * 255), 0, 255);
    }
  }
  if (size >= 512) quantize(rgba, 3);
  return encodePng(size, size, rgba);
}

/* ---------------------------------------------------------- 16×16 手繪（不縮圖） */

const PAL16 = {
  d: [20, 16, 10, 255],
  m: [58, 42, 8, 255],
  l: [102, 76, 14, 255],
  G: [240, 216, 94, 255],
  g: [234, 208, 64, 255],
  D: [192, 162, 28, 255],
};

function renderHandcrafted16() {
  // 手繪 16×16：沿用家族水滴環的像素節奏，下層改為幼童軍「C」
  const GRID = [
    'ddmmmmGGGGmmmmdd',
    'dmmmmmmGGmmmmmmd',
    'mllmmmGGGGmmmmmm',
    'mllmmggggggmmmmm',
    'mllmmggmmggmmmmm',
    'mllmmggmmggmmmmm',
    'lmmmmggggggmmmmm',
    'mmmmmmggggmmmmmm',
    'mmmmmmmmmmmmmmmm',
    'mmmmmmGGGddddddd',
    'mmmmmggddddddddd',
    'mmmmmggddddddddd',
    'mmmmmggddddddddd',
    'mmmmddDDDddddddd',
    'dmdddddddddddddd',
    'dddddddddddddddd',
  ];
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    const row = GRID[y];
    if (row.length !== 16) throw new Error(`16px 第 ${y} 行長度 ${row.length}，必須 16`);
    for (let x = 0; x < 16; x++) {
      const c = PAL16[row[x]] || PAL16.m;
      const i = (y * 16 + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = c[3];
    }
  }
  return encodePng(16, 16, rgba);
}

/* ------------------------------------------------------------- favicon.svg */

/** 與 PNG 同一組 64×64 座標；SVG 只作瀏覽器分頁／manifest 的向量後備 */
function renderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="CUBBOOK">
  <title>CUBBOOK</title>
  <defs>
    <linearGradient id="cloth" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#664c0e"/>
      <stop offset="0.55" stop-color="#3a2a08"/>
      <stop offset="1" stop-color="#14100a"/>
    </linearGradient>
    <linearGradient id="foil" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#f0d85e"/>
      <stop offset="0.5" stop-color="#ead040"/>
      <stop offset="1" stop-color="#c0a21c"/>
    </linearGradient>
    <mask id="drop-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="black"/>
      <circle cx="32" cy="25.6" r="9.6" fill="white"/>
      <path d="M26.816 17.344 L37.184 17.344 L32 6.88 Z" fill="white"/>
      <circle cx="32" cy="25.856" r="4.992" fill="black"/>
      <path d="M29.304 21.563 L34.696 21.563 L32 16.122 Z" fill="black"/>
    </mask>
    <mask id="c-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="black"/>
      <circle cx="32" cy="46.08" r="10.24" fill="white"/>
      <circle cx="32" cy="46.08" r="5.12" fill="black"/>
      <rect x="33.92" y="41.6" width="21.76" height="8.96" rx="1.6" fill="black"/>
    </mask>
  </defs>
  <rect width="64" height="64" rx="12.288" fill="url(#cloth)"/>
  <rect x="2.56" y="2.56" width="58.88" height="58.88" rx="10.56" fill="none" stroke="url(#foil)" stroke-opacity="0.95" stroke-width="1.088"/>
  <!-- 家族共用：水滴環（圓＋尖頂三角聯集，挖去同形內孔，露出布面） -->
  <rect width="64" height="64" fill="url(#foil)" mask="url(#drop-mask)"/>
  <!-- CUBBOOK 支部圖案：粗金 C -->
  <rect width="64" height="64" fill="url(#foil)" mask="url(#c-cut)"/>
</svg>
`;
}

/* ------------------------------------------------------------- OG 分享卡 1200×630 */

function renderOg() {
  const W = 1200;
  const H = 630;
  const rgba = new Uint8Array(W * H * 4);
  const tile = 340;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      let [r, g, b] = paintCloth(u * 0.8, v);

      // 外金線
      const dOuter = Math.abs(sdRoundBox(x, y, W / 2, H / 2, W / 2 - 26, H / 2 - 26, 16)) - 1.6;
      const aOuter = (1 - smooth(-1, 1, dOuter)) * 0.5;
      r = mix(r, C.gold[0], aOuter);
      g = mix(g, C.gold[1], aOuter);
      b = mix(b, C.gold[2], aOuter);

      // 左：縮小版家族圖標
      const cx = 300;
      const cy = H / 2;
      const half = tile / 2;
      if (Math.abs(x - cx) < half + 2 && Math.abs(y - cy) < half + 2) {
        const lu = (x - (cx - half)) / tile;
        const lv = (y - (cy - half)) / tile;
        const aTile = 1 - smooth(-1.4, 1.4, sdRoundBox(lu, lv, 0.5, 0.5, 0.5, 0.5, 0.192) * tile);
        let [tr, tg, tb] = paintCloth(lu, lv);
        const inset = sdRoundBox(lu, lv, 0.5, 0.5, 0.46, 0.46, 0.165);
        let aGold = (1 - smooth(-0.7, 0.7, Math.abs(inset) * tile - 3)) * 0.95;
        const aG = 1 - smooth(-0.8, 0.8, glyph(lu, lv) * tile);
        const [gr, gg, gb] = paintGold(lv);
        aGold = Math.max(aGold, aG);
        tr = mix(tr, gr, aGold);
        tg = mix(tg, gg, aGold);
        tb = mix(tb, gb, aGold);
        r = mix(r, tr, aTile);
        g = mix(g, tg, aTile);
        b = mix(b, tb, aTile);
      }

      // 右：象牙紀錄頁（深墨標題帶 + 金線 + 幼童軍黃進度條）
      const cardX = 880;
      const cardY = H / 2;
      const dCard = sdRoundBox(x, y, cardX, cardY, 268, 196, 10);
      const aCard = 1 - smooth(-1.2, 1.2, dCard);
      if (aCard > 0) {
        let cr = C.ivory[0];
        let cg = C.ivory[1];
        let cb = C.ivory[2];
        const aHead = 1 - smooth(-1, 1, sdRoundBox(x, y, cardX, cardY - 150, 236, 26, 4));
        cr = mix(cr, C.ink[0], aHead);
        cg = mix(cg, C.ink[1], aHead);
        cb = mix(cb, C.ink[2], aHead);
        const aDot = 1 - smooth(-1, 1, Math.hypot(x - (cardX - 214), y - (cardY - 150)) - 6);
        cr = mix(cr, C.gold[0], aDot);
        cg = mix(cg, C.gold[1], aDot);
        cb = mix(cb, C.gold[2], aDot);
        for (let k = 0; k < 3; k++) {
          const yy = cardY - 78 + k * 62;
          const aRule = 1 - smooth(-1, 1, sdRoundBox(x, y, cardX - 40, yy, 170, 3, 1.5));
          cr = mix(cr, C.goldDeep[0], aRule * 0.85);
          cg = mix(cg, C.goldDeep[1], aRule * 0.85);
          cb = mix(cb, C.goldDeep[2], aRule * 0.85);
          const aLine = 1 - smooth(-1, 1, sdRoundBox(x, y, cardX + 20, yy + 22, 190, 1.6, 1));
          cr = mix(cr, C.clothMid[0], aLine * 0.5);
          cg = mix(cg, C.clothMid[1], aLine * 0.5);
          cb = mix(cb, C.clothMid[2], aLine * 0.5);
        }
        r = mix(r, cr, aCard);
        g = mix(g, cg, aCard);
        b = mix(b, cb, aCard);
      }

      const i = (y * W + x) * 4;
      rgba[i] = clamp(Math.round(r), 0, 255);
      rgba[i + 1] = clamp(Math.round(g), 0, 255);
      rgba[i + 2] = clamp(Math.round(b), 0, 255);
      rgba[i + 3] = 255;
    }
  }
  quantize(rgba, 3);
  return encodePng(W, H, rgba);
}

/* ------------------------------------------------------------------ 輸出 */

const png16 = renderHandcrafted16();
const png32 = renderSquare(32);
const png48 = renderSquare(48);
const png180 = renderSquare(180, { rounded: false });
const png192 = renderSquare(192);
const png512 = renderSquare(512);
const pngMask192 = renderSquare(192, { maskable: true });
const pngMask512 = renderSquare(512, { maskable: true });
const pngOg = renderOg();
const ico = encodeIco([
  { size: 16, png: png16 },
  { size: 32, png: png32 },
  { size: 48, png: png48 },
]);

const outputs = [
  ['favicon.ico', ico],
  ['favicon-16.png', png16],
  ['favicon-32.png', png32],
  ['apple-touch-icon.png', png180],
  ['icon-192.png', png192],
  ['icon-512.png', png512],
  ['icon-maskable-192.png', pngMask192],
  ['icon-maskable-512.png', pngMask512],
  ['og-image.png', pngOg],
];

let totalBytes = 0;
for (const [name, buf] of outputs) {
  const full = path.join(outDir, name);
  writeFileSync(full, buf);
  const sz = statSync(full).size;
  totalBytes += sz;
  console.log(`  ✓ ${name.padEnd(22)} ${(sz / 1024).toFixed(1).padStart(6)} KB`);
}

// 根目錄 favicon（index.html 直接引用）
for (const [name, buf] of [
  ['favicon.ico', ico],
  ['favicon-32.png', png32],
  ['favicon-48.png', png48],
]) {
  writeFileSync(path.join(publicDir, name), buf);
}
const svgPath = path.join(publicDir, 'favicon.svg');
writeFileSync(svgPath, renderSvg(), 'utf8');
console.log(`  ✓ ${'favicon.svg'.padEnd(22)} ${(statSync(svgPath).size / 1024).toFixed(1).padStart(6)} KB`);

console.log(`Total 9-icon bundle: ${(totalBytes / 1024).toFixed(1)} KB (G11 limit <= 260 KB)`);
if (totalBytes > 260 * 1024) {
  console.error('ERROR: Icons exceed 260 KB budget!');
  process.exit(1);
}
