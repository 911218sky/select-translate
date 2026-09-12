import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sizes = [16, 32, 48, 128];
const BLUE = [26, 115, 232];
const LIGHT = [76, 141, 246];
const WHITE = [255, 255, 255];

const PATHS = [
  "M24 36h46v8H56.8c2.4 7.2 6.8 13.4 12.8 18.2l-5.6 5.6C56.4 61.2 51.2 53.2 48.6 44H24V36zm70 12h20v7H104l-12 31H81l11.6-28.4L84.4 48H94z",
  "M30 76h28v7H41.2L36 96h-8.6L33 83H30V76zm16 0 16 34h-9.2L46.2 93 39.6 110H30l16-34z"
];

function pngChunk(tag, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(tag), data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crcBuf]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePath(d) {
  const commands = [];
  const re = /([MmLlHhVvCcZz])([^MmLlHhVvCcZz]*)/g;
  let match;
  while ((match = re.exec(d))) {
    const nums = match[2].trim() ? match[2].trim().split(/[\s,]+/).map(Number) : [];
    commands.push({ op: match[1], nums });
  }
  return commands;
}

function pathToPolygons(d) {
  const polygons = [];
  let current = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  for (const { op, nums } of parsePath(d)) {
    const abs = op === op.toUpperCase();
    const cmd = op.toUpperCase();
    let i = 0;
    const take = () => nums[i++];
    if (cmd === "M") {
      if (current.length) polygons.push(current);
      x = abs ? take() : x + take();
      y = abs ? take() : y + take();
      startX = x;
      startY = y;
      current = [[x, y]];
      while (i < nums.length) {
        x = abs ? take() : x + take();
        y = abs ? take() : y + take();
        current.push([x, y]);
      }
    } else if (cmd === "L") {
      while (i < nums.length) {
        x = abs ? take() : x + take();
        y = abs ? take() : y + take();
        current.push([x, y]);
      }
    } else if (cmd === "H") {
      while (i < nums.length) {
        x = abs ? take() : x + take();
        current.push([x, y]);
      }
    } else if (cmd === "V") {
      while (i < nums.length) {
        y = abs ? take() : y + take();
        current.push([x, y]);
      }
    } else if (cmd === "C") {
      while (i < nums.length) {
        const x1 = abs ? take() : x + take();
        const y1 = abs ? take() : y + take();
        const x2 = abs ? take() : x + take();
        const y2 = abs ? take() : y + take();
        const nx = abs ? take() : x + take();
        const ny = abs ? take() : y + take();
        current.push(...cubicPoints(x, y, x1, y1, x2, y2, nx, ny));
        x = nx;
        y = ny;
      }
    } else if (cmd === "Z") {
      current.push([startX, startY]);
      polygons.push(current);
      current = [];
      x = startX;
      y = startY;
    }
  }
  if (current.length) polygons.push(current);
  return polygons;
}

function cubicPoints(x0, y0, x1, y1, x2, y2, x3, y3) {
  const pts = [];
  for (let t = 1; t <= 8; t++) {
    const u = t / 8;
    const iu = 1 - u;
    pts.push([
      iu ** 3 * x0 + 3 * iu ** 2 * u * x1 + 3 * iu * u ** 2 * x2 + u ** 3 * x3,
      iu ** 3 * y0 + 3 * iu ** 2 * u * y1 + 3 * iu * u ** 2 * y2 + u ** 3 * y3
    ]);
  }
  return pts;
}

function evenOdd(px, py, polygons) {
  let inside = false;
  for (const poly of polygons) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-6) + xi;
      if (hit) inside = !inside;
    }
  }
  return inside;
}

function roundedRect(px, py, size) {
  const r = size * 0.21875;
  const x = Math.max(0, Math.min(size - 1, px));
  const y = Math.max(0, Math.min(size - 1, py));
  const dx = x < r ? r - x : x > size - 1 - r ? x - (size - 1 - r) : 0;
  const dy = y < r ? r - y : y > size - 1 - r ? y - (size - 1 - r) : 0;
  if (!dx && !dy) return 1;
  const d = Math.hypot(dx, dy) - r;
  if (d <= -0.55) return 1;
  if (d >= 0.55) return 0;
  return 0.5 - d;
}

function mix(fg, bg, a) {
  const alpha = Math.max(0, Math.min(1, a));
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
    Math.round(Math.max(bg[3], alpha * 255))
  ];
}

async function writePng(file, pixels) {
  const height = pixels.length;
  const width = pixels[0].length;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (const row of pixels) {
    raw[offset++] = 0;
    for (const [r, g, b, a] of row) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  await writeFile(
    file,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", deflateSync(raw, { level: 9 })),
      pngChunk("IEND", Buffer.alloc(0))
    ])
  );
}

const polygons = PATHS.flatMap(pathToPolygons);
const svg = await readFile(path.join(root, "icons", "icon.svg"), "utf8");
if (!svg.includes("<svg")) throw new Error("icons/icon.svg must be SVG, not JS");

await mkdir(path.join(root, "icons"), { recursive: true });
for (const size of sizes) {
  const scale = size / 128;
  const pixels = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * (size - 1 || 1));
      const bg = [
        Math.round(LIGHT[0] + (BLUE[0] - LIGHT[0]) * t),
        Math.round(LIGHT[1] + (BLUE[1] - LIGHT[1]) * t),
        Math.round(LIGHT[2] + (BLUE[2] - LIGHT[2]) * t)
      ];
      const shape = roundedRect(x, y, size);
      let pixel = [bg[0], bg[1], bg[2], Math.round(shape * 255)];
      const samples = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75]
      ];
      let cover = 0;
      for (const [sx, sy] of samples) {
        if (evenOdd((x + sx) / scale, (y + sy) / scale, polygons)) cover += 0.25;
      }
      if (cover && shape) pixel = mix(WHITE, pixel, cover * shape);
      row.push(pixel);
    }
    pixels.push(row);
  }
  await writePng(path.join(root, "icons", `icon${size}.png`), pixels);
}

console.log("wrote PNG icons from icons/icon.svg");
