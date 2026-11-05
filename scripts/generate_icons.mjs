#!/usr/bin/env node
/**
 * Generate the complete 9-file G11 icon suite in web/public/icons/
 * Theme: CUBS YELLOW (#ffd23f -> #f2b705 -> #dca700) on warm charcoal (#14100a -> #3a2c18)
 * + ivory page edge (#f8f3e8) + deep ink (#1a1206) emblem. Yellow is the Cub Scout identity;
 * green is deliberately NOT used here (reserved for SCOUTBOOK). Never white on yellow.
 * Zero external npm dependencies (uses node:zlib + pure PNG/ICO encoder).
 */
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * (stride + 1);
    raw[rowOff] = 1; // Sub filter for smooth gradients
    for (let x = 0; x < stride; x++) {
      const cur = rgba[y * stride + x];
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      raw[rowOff + 1 + x] = (cur - left) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
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
    dir[2] = 0;
    dir[3] = 0;
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirs.push(dir);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)]);
}

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

/** Signed distance to a stylized Cub Scout fleur-de-lis + record-book motif in normalized [-1, 1] coords */
function emblemAlpha(nx, ny, aa) {
  // Center spear petal (graceful pointed teardrop)
  const py = ny + 0.05;
  const t = clamp((py + 0.48) / 0.76);
  const halfW = 0.165 * Math.sin(Math.pow(t, 0.78) * Math.PI);
  const dCenter = Math.hypot(Math.max(Math.abs(nx) - halfW, 0), py < -0.48 ? -0.48 - py : py > 0.28 ? py - 0.28 : 0)
    - (Math.abs(nx) < halfW && py >= -0.48 && py <= 0.28 ? Math.min(halfW - Math.abs(nx), py + 0.48, 0.28 - py) : 0);

  // Left & right curved side petals
  const ax = Math.abs(nx);
  const dx = ax - 0.23;
  const dy = py + 0.02 - 0.35 * dx * dx;
  const rot1 = dx * 0.82 + dy * 0.57;
  const rot2 = -dx * 0.57 + dy * 0.82;
  const dSide = Math.hypot(rot1 / 0.13, rot2 / 0.27) - 1;
  const dSidePx = dSide * 0.16;

  // Tie band across petals
  const dBand = sdRoundBox(nx, py, 0, 0.20, 0.25, 0.045, 0.02);

  // Base tail trifoil
  const dBaseCenter = sdSegment(nx, py, 0, 0.22, 0, 0.40) - 0.048;
  const dBaseSide = sdSegment(ax, py, 0.05, 0.23, 0.18, 0.37) - 0.042;

  const dFleur = Math.min(dCenter, dSidePx, dBand, dBaseCenter, dBaseSide);
  return 1 - smooth(-aa, aa, dFleur);
}

/** Render square icon (maskable = true shrinks book/emblem inside central 60% <= 66% safe zone) */
function renderSquareIcon(size, { maskable = false } = {}) {
  const rgba = new Uint8Array(size * size * 4);
  const scale = maskable ? 0.58 : 0.78;
  const aa = 2.2 / (size * scale);

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      // Full-bleed deep forest green radial + diagonal gradient (Cub Scout cloth)
      const rad = Math.hypot(u - 0.35, v - 0.22);
      const glow = clamp(1 - rad * 1.15);

      // Warm charcoal backdrop — keeps yellow dominant and frees green for SCOUTBOOK.
      let r = mix(18, 58, glow);
      let g = mix(14, 44, glow);
      let b = mix(9, 24, glow);

      // Normalized [-1, 1] coords scaled by safe-zone factor
      const nx = (u * 2 - 1) / scale;
      const ny = (v * 2 - 1) / scale;

      // Book silhouette card inside safe zone
      const dBook = sdRoundBox(nx, ny, 0, 0, 0.74, 0.86, 0.11);
      const bookShadow = 1 - smooth(0.0, 0.12, sdRoundBox(nx, ny - 0.04, 0.02, 0, 0.75, 0.87, 0.12));
      r = mix(r, 10, bookShadow * 0.5);
      g = mix(g, 7, bookShadow * 0.5);
      b = mix(b, 3, bookShadow * 0.5);

      // Ivory page fore-edge peeking on right
      const dPages = sdRoundBox(nx, ny, 0.05, 0.02, 0.73, 0.84, 0.09);
      const aPages = 1 - smooth(-aa, aa, dPages);
      r = mix(r, 244, aPages);
      g = mix(g, 236, aPages);
      b = mix(b, 218, aPages);

      // Maroon hardbound cover plate
      const aBook = 1 - smooth(-aa, aa, dBook);
      const coverTone = clamp(1 - Math.hypot(nx + 0.25, ny + 0.35) * 0.55);
      r = mix(r, mix(216, 255, coverTone), aBook);
      g = mix(g, mix(154, 214, coverTone), aBook);
      b = mix(b, mix(0, 70, coverTone), aBook);

      // Darker stitched spine on left of book
      const dSpine = Math.max(dBook, nx + 0.50);
      const aSpine = 1 - smooth(-aa, aa, dSpine);
      r = mix(r, 132, aSpine * 0.72);
      g = mix(g, 96, aSpine * 0.72);
      b = mix(b, 0, aSpine * 0.72);

      // Gold foil border rule + spine groove
      const dInnerFrame = Math.abs(sdRoundBox(nx, ny, 0.08, 0, 0.52, 0.70, 0.05)) - 0.018;
      const aFrame = (1 - smooth(-aa, aa, dInnerFrame)) * aBook;

      // Gold foil fleur-de-lis centered on the front cover
      const aFleur = emblemAlpha((nx - 0.08) * 1.08, (ny + 0.03) * 1.08, aa * 1.1) * aBook;
      // Gold horizontal title bar beneath emblem (symbolic, no tiny text)
      const dRule = sdRoundBox(nx - 0.08, ny - 0.50, 0, 0, 0.30, 0.026, 0.013);
      const aRule = (1 - smooth(-aa, aa, dRule)) * aBook;

      // Deep ink foil on the yellow cover (dark green reserved for SCOUTBOOK).
      const goldAmt = clamp(Math.max(aFrame * 0.85, aFleur, aRule));
      const goldGrad = clamp(1 - (ny + 0.6) * 0.75);
      const gr = mix(26, 10, goldGrad);
      const gg = mix(20, 8, goldGrad);
      const gb = mix(8, 4, goldGrad);

      r = mix(r, gr, goldAmt);
      g = mix(g, gg, goldAmt);
      b = mix(b, gb, goldAmt);

      const idx = (y * size + x) * 4;
      rgba[idx] = clamp(Math.round(r), 0, 255);
      rgba[idx + 1] = clamp(Math.round(g), 0, 255);
      rgba[idx + 2] = clamp(Math.round(b), 0, 255);
      rgba[idx + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

/**
 * Hand-crafted 16x16 pixel-art icon (G11 rule: NEVER downscale 512->16; draw crisp pixel grid!)
 * Palette (CUBS YELLOW):
 *   M = Cub Yellow (#f2b705), B = Bright Yellow (#ffd23f), S = Spine (#8a6a00),
 *   G = Deep Ink emblem (#1a1206), D = Dark Gold frame (#a07a00), P = Ivory Page (#f6efe0)
 */
function renderHandcrafted16() {
  const PAL = {
    S: [138, 106, 0, 255],
    M: [242, 183, 5, 255],
    B: [255, 210, 63, 255],
    D: [160, 122, 0, 255],
    G: [26, 18, 6, 255],
    P: [246, 239, 224, 255],
  };
  const GRID = [
    'SSSSSSSSBBBBBBBB',
    'SSBBBBBBBBBBBBMP',
    'SSBBDDDDDDBBBBMP',
    'SSBBDBGGGDBBBBMP',
    'SSBBDBGGGDBBBBMP',
    'SSBBDGGGGGBBBBMP',
    'SSBBGGGGGGGBBBMP',
    'SSBBGGBGGGBBBBMP',
    'SSBBBBDDDDDBBBMP',
    'SSBBBBBGGBBBBBMP',
    'SSBBBBGDBGGBBBMP',
    'SSBBBBBBBBBBBBMP',
    'SSBBDDDDDDDDBBMP',
    'SSBBBBBBBBBBBBMP',
    'SSMMMMMMMMMMMMMP',
    'SSSSSSSSPPPPPPPP',
  ];
  const rgba = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const c = PAL[GRID[y][x]] || PAL.M;
      const i = (y * 16 + x) * 4;
      rgba[i] = c[0];
      rgba[i + 1] = c[1];
      rgba[i + 2] = c[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(16, 16, rgba);
}

/**
 * Render 1200x630 Open Graph preview card:
 * Left side: forest-green hardbound book icon; right side: clean ivory specimen card & Cub gold progress bars
 * (Quantized slightly so PNG stays < 65 KB while maintaining rich >=6 color palette).
 */
function renderOgImage() {
  const W = 1200;
  const H = 630;
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const glow = clamp(1 - Math.hypot((u - 0.28) * 1.2, v - 0.35));
      // Warm charcoal backdrop — keeps yellow dominant and frees green for SCOUTBOOK.
      let r = mix(18, 58, glow);
      let g = mix(14, 44, glow);
      let b = mix(9, 24, glow);

      // Gold outer hairline frame
      const dOuter = Math.abs(sdRoundBox(x, y, W / 2, H / 2, W / 2 - 28, H / 2 - 28, 14)) - 1.5;
      const aOuter = 1 - smooth(-1, 1, dOuter);
      r = mix(r, 242, aOuter * 0.6);
      g = mix(g, 183, aOuter * 0.6);
      b = mix(b, 5, aOuter * 0.6);

      // Left hardbound book emblem centered at (300, 315)
      const bx = (x - 300) / 195;
      const by = (y - 315) / 195;
      if (Math.abs(bx) < 1.05 && Math.abs(by) < 1.05) {
        const aa = 1.6 / 195;
        const dPages = sdRoundBox(bx, by, 0.05, 0.02, 0.72, 0.86, 0.08);
        const aPages = 1 - smooth(-aa, aa, dPages);
        r = mix(r, 245, aPages);
        g = mix(g, 237, aPages);
        b = mix(b, 220, aPages);

        const dBook = sdRoundBox(bx, by, 0, 0, 0.72, 0.86, 0.09);
        const aBook = 1 - smooth(-aa, aa, dBook);
        r = mix(r, 242, aBook);
        g = mix(g, 183, aBook);
        b = mix(b, 5, aBook);

        const aSpine = 1 - smooth(-aa, aa, Math.max(dBook, bx + 0.48));
        r = mix(r, 138, aSpine * 0.8);
        g = mix(g, 106, aSpine * 0.8);
        b = mix(b, 0, aSpine * 0.8);

        const aFrame = (1 - smooth(-aa, aa, Math.abs(sdRoundBox(bx, by, 0.08, 0, 0.50, 0.70, 0.04)) - 0.015)) * aBook;
        const aFleur = emblemAlpha((bx - 0.08) * 1.1, (by + 0.04) * 1.1, aa * 1.2) * aBook;
        const aRule = (1 - smooth(-aa, aa, sdRoundBox(bx - 0.08, by - 0.48, 0, 0, 0.28, 0.024, 0.012))) * aBook;
        const gold = clamp(Math.max(aFrame * 0.85, aFleur, aRule));
        r = mix(r, 26, gold);
        g = mix(g, 18, gold);
        b = mix(b, 6, gold);
      }

      // Right ivory record sheet preview card (x: 540..1110, y: 115..515)
      const dCard = sdRoundBox(x, y, 825, 315, 285, 195, 12);
      const aCard = 1 - smooth(-1.2, 1.2, dCard);
      if (aCard > 0) {
        let cr = 248;
        let cg = 243;
        let cb = 232;
        // Maroon header band inside card
        const dHead = sdRoundBox(x, y, 825, 178, 245, 24, 4);
        const aHead = 1 - smooth(-1, 1, dHead);
        cr = mix(cr, 26, aHead);
        cg = mix(cg, 18, aHead);
        cb = mix(cb, 6, aHead);

        // Gold accent pill inside header
        const dPill = sdRoundBox(x, y, 645, 178, 46, 10, 4);
        const aPill = 1 - smooth(-1, 1, dPill);
        cr = mix(cr, 242, aPill);
        cg = mix(cg, 183, aPill);
        cb = mix(cb, 5, aPill);

        // Five progress bars: Membership, Bronze Arrow, Silver Arrow, Gold Arrow, Golden Bauhinia
        const rows = [248, 298, 348, 398];
        const fills = [210, 175, 140, 95];
        for (let ri = 0; ri < 4; ri++) {
          const ry = rows[ri];
          const aTrack = 1 - smooth(-1, 1, sdRoundBox(x, y, 825, ry, 245, 10, 5));
          cr = mix(cr, 226, aTrack);
          cg = mix(cg, 216, aTrack);
          cb = mix(cb, 196, aTrack);

          const fw = fills[ri];
          const aFill = 1 - smooth(-1, 1, sdRoundBox(x, y, 580 + fw, ry, fw, 10, 5));
          cr = mix(cr, ri === 3 ? 242 : 26, aFill);
          cg = mix(cg, ri === 3 ? 183 : 18, aFill);
          cb = mix(cb, ri === 3 ? 5 : 6, aFill);
        }

        // Gold foil chop circle bottom-right of card
        const dSeal = Math.abs(Math.hypot(x - 1025, y - 455) - 26) - 2.2;
        const aSeal = 1 - smooth(-1, 1, dSeal);
        cr = mix(cr, 242, aSeal * 0.85);
        cg = mix(cg, 183, aSeal * 0.85);
        cb = mix(cb, 5, aSeal * 0.85);

        r = mix(r, cr, aCard);
        g = mix(g, cg, aCard);
        b = mix(b, cb, aCard);
      }

      // Quantize subtle gradient bands slightly (step 4) so DEFLATE keeps 1200x630 PNG compact (<55KB)
      const i = (y * W + x) * 4;
      rgba[i] = clamp(Math.round(r / 4) * 4, 0, 255);
      rgba[i + 1] = clamp(Math.round(g / 4) * 4, 0, 255);
      rgba[i + 2] = clamp(Math.round(b / 4) * 4, 0, 255);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(W, H, rgba);
}

const png16 = renderHandcrafted16();
const png32 = renderSquareIcon(32);
const png48 = renderSquareIcon(48);
const png180 = renderSquareIcon(180);
const png192 = renderSquareIcon(192);
const png512 = renderSquareIcon(512);
const pngMask192 = renderSquareIcon(192, { maskable: true });
const pngMask512 = renderSquareIcon(512, { maskable: true });
const pngOg = renderOgImage();
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
// Root-level favicons referenced directly from index.html (G11 requirement)
const rootOutputs = [
  ['favicon.ico', ico],
  ['favicon-32.png', png32],
  ['favicon-48.png', png48],
];
for (const [name, buf] of rootOutputs) {
  writeFileSync(path.join(root, 'web', 'public', name), buf);
}
console.log(`Total 9-icon bundle: ${(totalBytes / 1024).toFixed(1)} KB (G11 limit <= 260 KB)`);
if (totalBytes > 260 * 1024) {
  console.error('ERROR: Icons exceed 260 KB budget!');
  process.exit(1);
}
