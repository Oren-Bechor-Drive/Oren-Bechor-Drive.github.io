import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { auditRoadMedia } from '../scripts/road-media-integrity.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expectedHashes = new Map([
  ['assets/learning-road.jpg', 'bcb8095abd13e0f730ee6bc7977c8422d405d9367836dabd8d1d6095d43bb73f'],
  ['assets/source-road-000.jpg', '692d892f7ac25af2a99ce24cd083bad11c8daad4092ef6a35888e3197d863cfb'],
  ['assets/source-road-001.jpg', '804377c8a085a12e70a93b8523725bc6dbe43b3be92a2d67036ae7508e6e3e91'],
]);

test('road-media declarations match their files', async () => {
  const audit = await auditRoadMedia({ rootDir, htmlPath: 'index.html' });
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.assets.length, 3);
});

test('replacement photo bytes remain unchanged', async () => {
  for (const [relativePath, expectedHash] of expectedHashes) {
    const bytes = await readFile(path.join(rootDir, relativePath));
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, relativePath);
  }
});

test('missing road media is reported while remaining images are audited', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'road-media-integrity-'));
  try {
    await writeFile(
      path.join(temporaryRoot, 'index.html'),
      '<img data-road-media src="missing.jpg" width="1" height="1" alt="missing"><img data-road-media src="existing.jpg" width="843" height="692" alt="existing">',
    );
    await writeFile(path.join(temporaryRoot, 'existing.jpg'), await readFile(path.join(rootDir, 'assets/source-road-000.jpg')));

    const audit = await auditRoadMedia({ rootDir: temporaryRoot });
    assert.equal(audit.assets.length, 1);
    assert.equal(audit.assets[0].source, 'existing.jpg');
    assert.deepEqual(audit.issues, ['missing.jpg: file does not exist']);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
