import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['src', 'scripts', 'server'];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full);
      continue;
    }
    if (/\.(js|mjs)$/.test(entry)) files.push(full);
  }
}

for (const rel of roots) walk(path.join(root, rel));
assert.ok(files.length > 0, 'no JavaScript files found for syntax verification');

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout || '');
    console.error(result.stderr || '');
    throw new Error(`node --check failed for ${path.relative(root, file)}`);
  }
}

console.log(`syntax verification passed (${files.length} JS/MJS files)`);
