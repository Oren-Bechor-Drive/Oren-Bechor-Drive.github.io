import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Import only supported parsers; unrelated container parsers are never loaded.
import { JPG } from 'image-size/types/jpg';
import { WEBP } from 'image-size/types/webp';
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

export function inspectImage(buffer) {
  const format = JPG.validate(buffer) ? 'jpeg' : WEBP.validate(buffer) ? 'webp' : undefined;
  if (!format) throw new Error('unsupported image format');
  let metadata;
  try {
    metadata = (format === 'jpeg' ? JPG : WEBP).calculate(buffer);
  } catch (error) {
    throw new Error('image metadata could not be read', { cause: error });
  }

  const mime = FORMAT_MIMES.get(format);
  return { format, mime, width: metadata.width, height: metadata.height };
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
      issues.push(`${source}: ${error.code === 'ENOENT' ? 'file does not exist' : error.message}`);
      continue;
    }
    const declaredFormat = EXTENSION_FORMATS.get(path.extname(source).toLowerCase());
    const declaredWidth = Number(image.getAttribute('width'));
    const declaredHeight = Number(image.getAttribute('height'));
    const alt = image.getAttribute('alt')?.trim() ?? '';
    const preload = [...document.querySelectorAll('link[rel="preload"][as="image"]')]
      .find((link) => cleanReference(link.getAttribute('href') ?? '') === source);

    if (declaredFormat !== inspected.format) {
      issues.push(`${source}: extension declares ${declaredFormat ?? 'unknown'}, bytes are ${inspected.format}`);
    }
    if (declaredWidth !== inspected.width || declaredHeight !== inspected.height) {
      issues.push(`${source}: declared ${declaredWidth}x${declaredHeight}, file is ${inspected.width}x${inspected.height}`);
    }
    if (!alt) issues.push(`${source}: alternative text is empty`);
    if (preload && preload.getAttribute('type') !== inspected.mime) {
      issues.push(`${source}: preload type is ${preload.getAttribute('type')}, expected ${inspected.mime}`);
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
