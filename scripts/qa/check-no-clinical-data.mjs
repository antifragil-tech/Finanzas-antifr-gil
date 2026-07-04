#!/usr/bin/env node
// QA · check-no-clinical-data
// Busca señales de DATOS CLÍNICOS prohibidos en el repo. SOLO LECTURA.
// Antifrágil OS es administrativo-operativo: la historia clínica vive fuera
// (Notion/sistema clínico). Ningún término clínico debe aparecer en código,
// mocks ni producto. En documentación de compliance/QA puede aparecer como
// mención documental (se reporta como "REQUIERE REVISIÓN", no como fallo).
//
// Uso:
//   node scripts/qa/check-no-clinical-data.mjs [rutas...] [opciones]
//   node scripts/qa/check-no-clinical-data.mjs --help
//
// Código de salida:
//   0 — sin hallazgos, o solo menciones en documentación permitida.
//   1 — términos clínicos en código/mocks/producto (apps/, packages/, services/, scripts/).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA check-no-clinical-data — busca señales de datos clínicos (solo lectura).

Uso:
  node scripts/qa/check-no-clinical-data.mjs [rutas...] [opciones]

Opciones:
  --soft      Sale con código 0 aunque haya hallazgos en código.
  --help, -h  Esta ayuda.

Términos vigilados (con y sin tilde):
  diagnóstico, lesión, dolor, medicación, tratamiento, evolución,
  informe clínico, historia clínica, antecedentes, prueba médica,
  embarazo, cáncer, ansiedad, hernia, rodilla, lumbar, cervical

Clasificación:
  FAIL     — término en código/mocks/producto (apps/, packages/, services/, scripts/)
  REVISIÓN — término en documentación (docs/, .claude/, *.md raíz): permitido
             como mención documental de compliance, pero conviene revisarlo.

No modifica ningún archivo. No imprime datos de pacientes (solo archivo:línea + fragmento).`);
  process.exit(0);
}

const OPT = { soft: args.includes('--soft') };
const pathArgs = args.filter((a) => !a.startsWith('-'));

// \b no funciona bien con tildes/ñ: usamos límites propios (inicio/fin o no-letra).
const B = '(^|[^\\p{L}])';
const E = '($|[^\\p{L}])';
const term = (t) => new RegExp(B + '(' + t + ')' + E, 'iu');

const TERMS = [
  { label: 'diagnóstico', re: term('diagn[oó]stic\\w*') },
  { label: 'lesión', re: term('lesi[oó]n(es)?') },
  { label: 'dolor', re: term('dolor(es)?') },
  { label: 'medicación', re: term('medicaci[oó]n|medicamento\\w*') },
  { label: 'tratamiento', re: term('tratamiento\\w*') },
  { label: 'evolución', re: term('evoluci[oó]n') },
  { label: 'informe clínico', re: term('informes?\\s+cl[ií]nic\\w+') },
  { label: 'historia clínica', re: term('historias?\\s+cl[ií]nic\\w+') },
  { label: 'antecedentes', re: term('antecedentes?') },
  { label: 'prueba médica', re: term('pruebas?\\s+m[eé]dic\\w+') },
  { label: 'embarazo', re: term('embaraz\\w*') },
  { label: 'cáncer', re: term('c[aá]ncer') },
  { label: 'ansiedad', re: term('ansiedad') },
  { label: 'hernia', re: term('hernia\\w*') },
  { label: 'rodilla', re: term('rodilla\\w*') },
  { label: 'lumbar', re: term('lumbar(es)?') },
  { label: 'cervical', re: term('cervical(es)?') },
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build', 'coverage', '.vercel',
]);

// El propio tooling de QA menciona los términos a propósito: nunca es hallazgo.
const EXCLUDE_PATH_PARTS = ['scripts/qa/', 'docs/qa/'];

// Documentación donde la MENCIÓN (no el dato) está permitida → "REQUIERE REVISIÓN".
const DOC_ALLOWED_PREFIXES = ['docs/', '.claude/', 'documentacion/'];

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz', '.lock',
]);

function norm(rel) { return rel.replace(/\\/g, '/'); }

function isExcludedPath(rel) {
  return EXCLUDE_PATH_PARTS.some((p) => norm(rel).includes(p));
}

// true → mención documental permitida (REVISIÓN); false → código/producto (FAIL).
function isDocAllowed(rel) {
  const n = norm(rel);
  if (DOC_ALLOWED_PREFIXES.some((p) => n.startsWith(p))) return true;
  // *.md sueltos en la raíz (README, SESSION, etc.) se tratan como documentación.
  if (!n.includes('/') && n.toLowerCase().endsWith('.md')) return true;
  return false;
}

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
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

let targets;
if (pathArgs.length > 0) targets = pathArgs.map((p) => resolve(process.cwd(), p));
else targets = [ROOT];

const files = [];
for (const t of targets) {
  let st; try { st = statSync(t); } catch { console.error(`! ruta no encontrada: ${t}`); continue; }
  if (st.isDirectory()) walk(t, files);
  else files.push(t);
}

const fails = [];
const reviews = [];

for (const f of files) {
  let buf;
  try { buf = readFileSync(f); } catch { continue; }
  if (looksBinary(buf)) continue;
  const rel = norm(relative(ROOT, f));
  const lines = buf.toString('utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const t of TERMS) {
      if (t.re.test(lines[i])) {
        const hit = { file: rel, line: i + 1, term: t.label, snippet: lines[i].trim().slice(0, 120) };
        (isDocAllowed(rel) ? reviews : fails).push(hit);
      }
    }
  }
}

console.log('=== QA check-no-clinical-data ===');
console.log(`Raíz: ${ROOT} · archivos escaneados: ${files.length}`);
console.log('');

if (fails.length === 0 && reviews.length === 0) {
  console.log('OK · 0 señales de datos clínicos.');
} else {
  if (fails.length > 0) {
    console.log('!! FAIL — términos clínicos en código/mocks/producto (prohibido):');
    for (const h of fails) console.log(`  ${h.file}:${h.line}  [${h.term}]  ${h.snippet}`);
    console.log('');
  }
  if (reviews.length > 0) {
    console.log('?? REQUIERE REVISIÓN — menciones en documentación (permitidas si son documentales, no datos):');
    for (const h of reviews) console.log(`  ${h.file}:${h.line}  [${h.term}]  ${h.snippet}`);
    console.log('');
  }
}

console.log(`--- FAIL: ${fails.length} · REVISIÓN: ${reviews.length} ---`);
if (fails.length > 0) {
  console.log('Acción: eliminar el contenido clínico del código/mock. Antifrágil OS no guarda datos clínicos.');
}

process.exit(OPT.soft ? 0 : fails.length > 0 ? 1 : 0);
