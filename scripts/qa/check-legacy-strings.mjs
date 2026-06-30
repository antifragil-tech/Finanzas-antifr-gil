#!/usr/bin/env node
// QA · check-legacy-strings
// Busca strings legacy en código relevante. SOLO LECTURA: nunca modifica nada.
// Sin dependencias externas (solo módulos nativos de Node).
//
// Uso:
//   node scripts/qa/check-legacy-strings.mjs [rutas...] [opciones]
//   node scripts/qa/check-legacy-strings.mjs --help
//
// Por defecto escanea `apps/` (la superficie visible del producto).
// Opciones:
//   --all           Escanea toda la raíz del repo (excluyendo dependencias/artefactos).
//   --include-docs  No excluye docs/ (por defecto se excluyen, ahí se documenta el legacy).
//   --soft          Siempre sale con código 0 (informativo, no rompe CI).
//   --help          Muestra esta ayuda.
//
// Código de salida: 0 si no hay hallazgos; 1 si hay hallazgos (salvo --soft).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA check-legacy-strings — busca strings legacy (solo lectura).

Uso:
  node scripts/qa/check-legacy-strings.mjs [rutas...] [opciones]

Opciones:
  --all           Escanea toda la raíz del repo.
  --include-docs  Incluye docs/ en el escaneo.
  --soft          Sale con código 0 aunque haya hallazgos.
  --help, -h      Esta ayuda.

Términos detectados:
  Alsari, Pavier, Armia, Rialsa, alsari.net,
  finanzas_sociedades, proyecto_sociedades, pct_pavier, pct_armia

No modifica ningún archivo.`);
  process.exit(0);
}

const OPT = {
  all: args.includes('--all'),
  includeDocs: args.includes('--include-docs'),
  soft: args.includes('--soft'),
};
const pathArgs = args.filter((a) => !a.startsWith('-'));

// Términos: {term, regex, label}. 'i' = case-insensitive substring.
const TERMS = [
  { label: 'Alsari', re: /Alsari/i },
  { label: 'Pavier', re: /Pavier/i },
  { label: 'Armia', re: /Armia/i },
  { label: 'Rialsa', re: /Rialsa/i },
  { label: 'alsari.net', re: /alsari\.net/i },
  { label: 'finanzas_sociedades', re: /finanzas_sociedades/i },
  { label: 'proyecto_sociedades', re: /proyecto_sociedades/i },
  { label: 'pct_pavier', re: /pct_pavier/i },
  { label: 'pct_armia', re: /pct_armia/i },
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build', 'coverage', '.vercel',
]);

// Rutas auto-excluidas: documentación de QA/integración y los propios checks.
const EXCLUDE_PATH_PARTS = [
  'scripts/qa/', 'docs/qa/', 'docs/integration/', 'excluded_legacy.md',
];

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz', '.lock',
]);

function isExcludedPath(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (!OPT.includeDocs && (norm === 'docs' || norm.startsWith('docs/'))) {
    // permitir docs solo si no es la exclusión por defecto
    // (docs documenta el legacy a propósito)
    return true;
  }
  return EXCLUDE_PATH_PARTS.some((p) => norm.includes(p));
}

function walk(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = relative(ROOT, full);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      if (isExcludedPath(rel)) continue;
      walk(full, acc);
    } else if (e.isFile()) {
      if (BINARY_EXT.has(extname(e.name).toLowerCase())) continue;
      if (isExcludedPath(rel)) continue;
      acc.push(full);
    }
  }
  return acc;
}

function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

// Determinar objetivos
let targets;
if (pathArgs.length > 0) {
  targets = pathArgs.map((p) => resolve(process.cwd(), p));
} else if (OPT.all) {
  targets = [ROOT];
} else {
  targets = [join(ROOT, 'apps')];
}

const files = [];
for (const t of targets) {
  let st;
  try { st = statSync(t); } catch { console.error(`! ruta no encontrada: ${t}`); continue; }
  if (st.isDirectory()) walk(t, files);
  else files.push(t);
}

const findings = [];
const perTerm = Object.fromEntries(TERMS.map((t) => [t.label, 0]));

for (const f of files) {
  let buf;
  try { buf = readFileSync(f); } catch { continue; }
  if (looksBinary(buf)) continue;
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const t of TERMS) {
      if (t.re.test(line)) {
        findings.push({
          file: relative(ROOT, f).replace(/\\/g, '/'),
          line: i + 1,
          term: t.label,
          snippet: line.trim().slice(0, 160),
        });
        perTerm[t.label]++;
      }
    }
  }
}

// Reporte
console.log('=== QA check-legacy-strings ===');
console.log(`Raíz: ${ROOT}`);
console.log(`Objetivos: ${targets.map((t) => relative(ROOT, t) || '.').join(', ')}`);
console.log(`Archivos escaneados: ${files.length}`);
console.log('');

if (findings.length === 0) {
  console.log('OK · 0 strings legacy encontradas.');
} else {
  for (const fnd of findings) {
    console.log(`${fnd.file}:${fnd.line}  [${fnd.term}]  ${fnd.snippet}`);
  }
  console.log('');
  console.log('--- Resumen por término ---');
  for (const [term, n] of Object.entries(perTerm)) {
    if (n > 0) console.log(`  ${term.padEnd(22)} ${n}`);
  }
  console.log(`--- TOTAL: ${findings.length} hallazgos en ${new Set(findings.map((f) => f.file)).size} archivos ---`);
}

process.exit(OPT.soft ? 0 : findings.length > 0 ? 1 : 0);
