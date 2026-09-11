import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('page exposes its Hebrew semantic structure', async () => {
  const html = await read('index.html');
  assert.match(html, /<html[^>]+lang="he"[^>]+dir="rtl"/);

  for (const hook of [
    'id="topics"',
    'id="about"',
    'id="instructor"',
    'class="topic-card',
    'data-menu-toggle',
    'data-topic-panel',
  ]) {
    assert.ok(html.includes(hook), `Missing HTML hook: ${hook}`);
  }
});

test('topic controls keep their native button semantics', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /<button[^>]+role="listitem"/);
  assert.match(html, /class="topic-rail" role="group"/);
});

test('styles preserve the supplied design system and responsive contract', async () => {
  const css = (await read('styles.css')).toLowerCase();

  for (const token of [
    '#6dcdd6',
    '#f6db78',
    '#d96c6c',
    'prefers-reduced-motion',
    'max-width: 768px',
  ]) {
    assert.ok(css.includes(token), `Missing CSS contract: ${token}`);
  }
});

test('script progressively enhances navigation and topic details', async () => {
  const script = await read('script.js');

  assert.match(script, /import\s+\{\s*initTopicExplorer\s*\}\s+from\s+'\.\/topic-explorer\.js'/);
  assert.match(script, /initTopicExplorer\(topicExplorer\)/);
  assert.doesNotMatch(script, /querySelectorAll\('\.topic-card'\)/);

  const html = await read('index.html');
  assert.match(html, /<script[^>]+src="script\.js\?v=20260911"[^>]+type="module"/);
  assert.match(html, /class="topic-explorer"[^>]*data-topic-explorer/);
  assert.doesNotMatch(html, /data-topic-title/);
});

test('README records the later welcome-page concepts', async () => {
  const readme = await read('README.md');
  assert.match(readme, /Instructor-led welcome/i);
  assert.match(readme, /Course-dashboard preview/i);
});
