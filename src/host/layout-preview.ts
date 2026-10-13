import { deflateSync } from 'node:zlib';
import type { LayoutNode, Size } from '../shared/layout.js';

const WIDTH = 960;
const MAX_HEIGHT = 640;
const BG = [255, 255, 255, 255] as const;
const INK = [55, 65, 81, 255] as const;
const LINE = [156, 163, 175, 255] as const;
const FILL = [243, 244, 246, 255] as const;

interface Canvas { width: number; height: number; pixels: Uint8Array }
interface Rect { x: number; y: number; width: number; height: number }

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new TextEncoder().encode(type);
  const output = new Uint8Array(12 + bytes.length + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(bytes, 4);
  output.set(data, 8);
  view.setUint32(8 + data.length, crc32(output.subarray(4, 8 + data.length)));
  return output;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function putPixel(canvas: Canvas, x: number, y: number, color: readonly number[]): void {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 4;
  canvas.pixels.set(color, index);
}

function fillRect(canvas: Canvas, rect: Rect, color: readonly number[]): void {
  const left = Math.max(0, Math.floor(rect.x));
  const top = Math.max(0, Math.floor(rect.y));
  const right = Math.min(canvas.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(canvas.height, Math.ceil(rect.y + rect.height));
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) putPixel(canvas, x, y, color);
}

function strokeRect(canvas: Canvas, rect: Rect, color: readonly number[]): void {
  fillRect(canvas, { x: rect.x, y: rect.y, width: rect.width, height: 1 }, color);
  fillRect(canvas, { x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1 }, color);
  fillRect(canvas, { x: rect.x, y: rect.y, width: 1, height: rect.height }, color);
  fillRect(canvas, { x: rect.x + rect.width - 1, y: rect.y, width: 1, height: rect.height }, color);
}

function size(value: Size | undefined, available: number): number {
  return value === 'fill' || value === undefined ? available : value;
}

function intrinsicHeight(node: LayoutNode): number {
  if (node.height !== undefined && node.height !== 'fill') return node.height;
  if (!node.children?.length) return node.type === 'image' || node.type === 'chart' ? 120 : 44;
  const gap = node.gap ?? 10;
  const padding = node.padding ?? (node.type === 'box' ? 12 : 0);
  const childHeights = node.children.map(intrinsicHeight);
  return padding * 2 + (node.type === 'row' ? Math.max(...childHeights, 44) : childHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, childHeights.length - 1));
}

function drawLeaf(canvas: Canvas, node: LayoutNode, rect: Rect): void {
  if (node.type === 'image' || node.type === 'chart') fillRect(canvas, rect, FILL);
  if (node.type === 'button' || node.type === 'input' || node.type === 'select' || node.type === 'badge') fillRect(canvas, { ...rect, height: Math.min(rect.height, 34), y: rect.y + Math.max(0, (rect.height - 34) / 2) }, FILL);
  if (node.type === 'divider') fillRect(canvas, { x: rect.x, y: rect.y + rect.height / 2, width: rect.width, height: 1 }, LINE);
  if (node.type === 'spacer') return;
  if (node.type === 'text' || node.type === 'heading' || node.type === 'button' || node.type === 'input' || node.type === 'select' || node.type === 'badge') {
    const barWidth = Math.max(20, Math.min(rect.width - 12, node.label ? Math.min(rect.width - 12, 120 + node.label.length * 3) : rect.width * .58));
    fillRect(canvas, { x: rect.x + 6, y: rect.y + Math.max(6, rect.height / 2 - 3), width: barWidth, height: node.type === 'heading' ? 6 : 4 }, INK);
  }
  strokeRect(canvas, rect, LINE);
}

function drawNode(canvas: Canvas, node: LayoutNode, rect: Rect): void {
  if (!node.children?.length) { drawLeaf(canvas, node, rect); return; }
  if (node.type === 'frame' || node.type === 'box') fillRect(canvas, rect, node.variant === 'filled' ? FILL : BG);
  if (node.type === 'frame' || node.type === 'box') strokeRect(canvas, rect, INK);
  const padding = node.padding ?? (node.type === 'box' ? 12 : 0);
  const inner = { x: rect.x + padding, y: rect.y + padding, width: Math.max(1, rect.width - padding * 2), height: Math.max(1, rect.height - padding * 2) };
  const gap = node.gap ?? 10;
  const horizontal = node.type === 'row' || node.type === 'grid';
  const columns = node.type === 'grid' ? node.columns ?? 2 : node.children.length;
  const rows = node.type === 'grid' ? Math.ceil(node.children.length / columns) : 1;
  const cellWidth = horizontal ? (inner.width - gap * (columns - 1)) / columns : inner.width;
  const cellHeight = node.type === 'grid' ? (inner.height - gap * (rows - 1)) / rows : node.type === 'row' ? inner.height : (inner.height - gap * (node.children.length - 1)) / node.children.length;
  node.children.forEach((child, index) => {
    const col = node.type === 'grid' ? index % columns : horizontal ? index : 0;
    const row = node.type === 'grid' ? Math.floor(index / columns) : horizontal ? 0 : index;
    const childRect = { x: inner.x + col * (cellWidth + gap), y: inner.y + row * (cellHeight + gap), width: size(child.width, cellWidth), height: size(child.height, cellHeight) };
    drawNode(canvas, child, childRect);
  });
}

/** Render the validated wireframe as a small dependency-free PNG attachment. */
export function renderLayoutPng(root: LayoutNode): Uint8Array {
  const height = Math.max(120, Math.min(MAX_HEIGHT, Math.ceil(root.height === 'fill' || root.height === undefined ? intrinsicHeight(root) : root.height)));
  const canvas: Canvas = { width: WIDTH, height, pixels: new Uint8Array(WIDTH * height * 4) };
  for (let i = 0; i < canvas.pixels.length; i += 4) canvas.pixels.set(BG, i);
  drawNode(canvas, root, { x: 8, y: 8, width: WIDTH - 16, height: height - 16 });
  const scanlines = new Uint8Array((WIDTH * 4 + 1) * height);
  for (let y = 0; y < height; y++) { scanlines[y * (WIDTH * 4 + 1)] = 0; scanlines.set(canvas.pixels.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4), y * (WIDTH * 4 + 1) + 1); }
  const header = new Uint8Array(13); const headerView = new DataView(header.buffer); headerView.setUint32(0, WIDTH); headerView.setUint32(4, height); header[8] = 8; header[9] = 6;
  const idat = deflateSync(scanlines);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [pngChunk('IHDR', header), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array())];
  const output = new Uint8Array(signature.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let offset = 0;
  output.set(signature, offset); offset += signature.length;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
