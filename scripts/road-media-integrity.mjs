import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { JSDOM } from 'jsdom';

const EXTENSION_FORMATS = new Map([
  ['.jpg', 'jpeg'],
  ['.jpeg', 'jpeg'],
  ['.webp', 'webp'],
]);

const FORMAT_MIMES = new Map([
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);

const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (JPEG_START_OF_FRAME.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error('JPEG dimensions could not be read');
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readWebpDimensions(buffer) {
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: readUint24LE(buffer, 24) + 1,
      height: readUint24LE(buffer, 27) + 1,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

export function inspectImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { format: 'jpeg', mime: 'image/jpeg', ...readJpegDimensions(buffer) };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { format: 'webp', mime: 'image/webp', ...readWebpDimensions(buffer) };
  }
  throw new Error('Unsupported image format');
}

function cleanReference(reference) {
  return reference.split(/[?#]/, 1)[0];
}

export async function auditRoadMedia({ rootDir, htmlPath = 'index.html' }) {
  const absoluteHtmlPath = path.resolve(rootDir, htmlPath);
  const html = await readFile(absoluteHtmlPath, 'utf8');
  const document = new JSDOM(html).window.document;
  const issues = [];
  const assets = [];

  for (const image of document.querySelectorAll('img[data-road-media]')) {
    const source = cleanReference(image.getAttribute('src') ?? '');
    const absoluteImagePath = path.resolve(path.dirname(absoluteHtmlPath), source);
    let inspected;
    try {
      inspected = inspectImage(await readFile(absoluteImagePath));
    } catch (error) {
      if (error.code === 'ENOENT') {
        issues.push(`${source}: file does not exist`);
        continue;
      }
      throw error;
    }
    const declaredFormat = EXTENSION_FORMATS.get(path.extname(source).toLowerCase());
    const declaredWidth = Number(image.getAttribute('width'));
    const declaredHeight = Number(image.getAttribute('height'));
    const alt = image.getAttribute('alt')?.trim() ?? '';
    const preload = document.querySelector(`link[rel="preload"][as="image"][href="${source}"]`);

    if (declaredFormat !== inspected.format) {
      issues.push(`${source}: extension declares ${declaredFormat ?? 'unknown'}, bytes are ${inspected.format}`);
    }
    if (declaredWidth !== inspected.width || declaredHeight !== inspected.height) {
      issues.push(`${source}: declared ${declaredWidth}x${declaredHeight}, file is ${inspected.width}x${inspected.height}`);
    }
    if (!alt) issues.push(`${source}: alternative text is empty`);
    if (preload && preload.getAttribute('type') !== FORMAT_MIMES.get(inspected.format)) {
      issues.push(`${source}: preload type is ${preload.getAttribute('type')}, expected ${FORMAT_MIMES.get(inspected.format)}`);
    }

    assets.push({ source, alt, ...inspected });
  }

  return { assets, issues };
}

async function runCli() {
  const audit = await auditRoadMedia({ rootDir: process.cwd(), htmlPath: 'index.html' });
  if (audit.issues.length === 0) {
    console.log(`Road media OK: ${audit.assets.length} images`);
    return;
  }
  for (const issue of audit.issues) console.error(`- ${issue}`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
