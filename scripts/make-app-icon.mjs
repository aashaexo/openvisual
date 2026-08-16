/**
 * Draws the source app icon (a 1024px spark mark) as a PNG, with no image
 * dependencies and nothing downloaded.
 *
 * Run `npm run tauri icon app-icon.png` afterwards to produce the platform
 * icon set that src-tauri/tauri.conf.json expects.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const BACKGROUND = [79, 70, 229]; // --ov-accent
const MARK = [255, 255, 255];

const pixels = Buffer.alloc(SIZE * SIZE * 4);

/** Signed distance to a rounded square, used to antialias the tile edge. */
function roundedSquare(x, y, half, radius) {
  const dx = Math.abs(x) - half + radius;
  const dy = Math.abs(y) - half + radius;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/**
 * A four-pointed star: the region where the normalised distance along both
 * axes, sharpened by an exponent below 1, stays inside the unit diamond.
 */
function spark(x, y, radius) {
  const nx = Math.abs(x) / radius;
  const ny = Math.abs(y) / radius;
  return Math.pow(nx, 0.42) + Math.pow(ny, 0.42) - 1;
}

for (let py = 0; py < SIZE; py += 1) {
  for (let px = 0; px < SIZE; px += 1) {
    const x = px - SIZE / 2 + 0.5;
    const y = py - SIZE / 2 + 0.5;

    const tile = roundedSquare(x, y, SIZE / 2 - 24, 220);
    const tileAlpha = clamp01(0.5 - tile);

    const big = spark(x, y, 300);
    const small = spark(x - 250, y - 250, 110);
    const markAlpha = Math.max(clamp01(0.5 - big * 120), clamp01(0.5 - small * 120));

    const offset = (py * SIZE + px) * 4;
    const [r, g, b] = mix(BACKGROUND, MARK, markAlpha);
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
    pixels[offset + 3] = Math.round(tileAlpha * 255);
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function mix(a, b, t) {
  return a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function encodePng(rgba) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

writeFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "..", "app-icon.png"),
  encodePng(pixels),
);
console.log("[make-app-icon] wrote app-icon.png (1024x1024)");
