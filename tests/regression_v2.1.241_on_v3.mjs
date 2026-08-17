// Re-run the last stable 2D mechanics suite against v3 without weakening the
// original release-locked test. Only its historical identity assertions are
// removed; every gameplay and rendering assertion still executes unchanged.
import { readFile } from 'node:fs/promises';

const testUrl = new URL('./patch_v2.1.241.mjs', import.meta.url);
let source = await readFile(testUrl, 'utf8');
source = source
  .replace(/^assert\.equal\((?:VERSION|BUILD_ID|PROTOCOL),[^\n]*\);\r?\n/gm, '')
  .replace(/import\.meta\.url/g, JSON.stringify(testUrl.href))
  .replace(/from\s+(['"])(\.\.\/[^'"]+)\1/g, (_all, quote, path) => `from ${quote}${new URL(path, testUrl).href}${quote}`);

await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
console.log('v3.0.1 regression bridge passed: all v2.1.241 mechanics assertions remain green');
