import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('upgrade card text has explicit grid slots', () => {
  assert.match(style, /\.upgrade-key\s*\{[\s\S]*grid-column:\s*1;[\s\S]*grid-row:\s*1\s*\/\s*4;/, 'upgrade key grid slot is not explicit');
  assert.match(style, /\.upgrade-name\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*1;/, 'upgrade name grid slot is not explicit');
  assert.match(style, /\.upgrade-desc\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*2;/, 'upgrade desc grid slot is not explicit');
  assert.match(style, /\.upgrade-meta\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-row:\s*3;/, 'upgrade meta grid slot is not explicit');
});

test('upgrade card text cannot push layout sideways', () => {
  assert.match(style, /\.upgrade-choice\s*\{[\s\S]*min-width:\s*0;/, 'upgrade card missing min-width guard');
  assert.match(style, /\.upgrade-choice\s*>\s*span\s*\{[\s\S]*min-width:\s*0;/, 'upgrade text spans missing min-width guard');
  assert.match(style, /\.upgrade-name\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/, 'upgrade name can overflow');
  assert.match(style, /\.upgrade-meta\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/, 'upgrade meta can overflow');
});

test('upgrade ui html order stays compatible with the grid', () => {
  assert.match(ui, /upgrade-key[\s\S]*upgrade-name[\s\S]*upgrade-desc[\s\S]*upgrade-meta/, 'upgrade innerHTML order changed unexpectedly');
  assert.doesNotMatch(ui, /upgrade-name-row/, 'old name-row wrapper should not return');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} upgrade UI layout checks passed`);
