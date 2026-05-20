import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function resolveModule(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const file = base.endsWith('.js') ? base : `${base}.js`;
  return fs.existsSync(file) ? file : file;
}

function parseNamedList(list) {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/\s+/g, ' ');
      const alias = cleaned.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) return { imported: alias[1], local: alias[2], exported: alias[2] };
      return { imported: cleaned, local: cleaned, exported: cleaned };
    });
}

const files = walk(srcRoot).sort();
const moduleCache = new Map();
const exportCache = new Map();

function parseModule(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  const raw = read(file);
  const src = stripComments(raw);
  const mod = {
    file,
    src,
    directExports: new Set(),
    namedReexports: [],
    starReexports: [],
    namedImports: []
  };

  // export const A / export let A / export var A / export function A / export class A
  for (const m of src.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    mod.directExports.add(m[1]);
  }

  // export default ...
  if (/\bexport\s+default\b/.test(src)) mod.directExports.add('default');

  // export { a, b as c } [from "..."];
  for (const m of src.matchAll(/\bexport\s*\{([\s\S]*?)\}\s*(?:from\s*["']([^"']+)["'])?\s*;/g)) {
    const names = parseNamedList(m[1]);
    const spec = m[2] || null;
    if (spec) {
      mod.namedReexports.push({ spec, source: resolveModule(file, spec), names });
      for (const n of names) mod.directExports.add(n.exported);
    } else {
      for (const n of names) mod.directExports.add(n.exported);
    }
  }

  // export * from "...";
  for (const m of src.matchAll(/\bexport\s*\*\s*from\s*["']([^"']+)["']\s*;/g)) {
    mod.starReexports.push({ spec: m[1], source: resolveModule(file, m[1]) });
  }

  // import { a, b as c } from "...";
  for (const m of src.matchAll(/\bimport\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']\s*;/g)) {
    mod.namedImports.push({ spec: m[2], source: resolveModule(file, m[2]), names: parseNamedList(m[1]) });
  }

  moduleCache.set(file, mod);
  return mod;
}

function collectExports(file, stack = []) {
  if (exportCache.has(file)) return exportCache.get(file);
  if (stack.includes(file)) return new Set();
  if (!fs.existsSync(file)) return new Set();
  const mod = parseModule(file);
  const names = new Set(mod.directExports);
  exportCache.set(file, names);

  for (const reexport of mod.starReexports) {
    if (!reexport.source || !fs.existsSync(reexport.source)) continue;
    for (const name of collectExports(reexport.source, [...stack, file])) {
      if (name !== 'default') names.add(name);
    }
  }
  return names;
}

const failures = [];

for (const file of files) parseModule(file);

for (const file of files) {
  const mod = parseModule(file);
  for (const namedImport of mod.namedImports) {
    if (!namedImport.spec.startsWith('.')) continue;
    if (!fs.existsSync(namedImport.source)) {
      failures.push(`${path.relative(root, file)} imports missing module ${namedImport.spec}`);
      continue;
    }
    const exported = collectExports(namedImport.source);
    for (const name of namedImport.names) {
      if (!exported.has(name.imported)) {
        failures.push(`${path.relative(root, file)} imports { ${name.imported} } from ${namedImport.spec}, but ${path.relative(root, namedImport.source)} does not export it`);
      }
    }
  }

  for (const reexport of mod.namedReexports) {
    if (!reexport.spec.startsWith('.')) continue;
    if (!fs.existsSync(reexport.source)) {
      failures.push(`${path.relative(root, file)} re-exports from missing module ${reexport.spec}`);
      continue;
    }
    const exported = collectExports(reexport.source);
    for (const name of reexport.names) {
      if (!exported.has(name.imported)) {
        failures.push(`${path.relative(root, file)} re-exports { ${name.imported} } from ${reexport.spec}, but ${path.relative(root, reexport.source)} does not export it`);
      }
    }
  }

  for (const reexport of mod.starReexports) {
    if (reexport.spec.startsWith('.') && !fs.existsSync(reexport.source)) {
      failures.push(`${path.relative(root, file)} star re-exports from missing module ${reexport.spec}`);
    }
  }
}

if (failures.length) {
  console.error('Module export verification failed:');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log(`module export verification passed (${files.length} src modules)`);
