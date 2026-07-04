#!/usr/bin/env node
// QA · check-no-secrets
// Busca patrones peligrosos (claves/JWT/passwords) en el repo. SOLO LECTURA.
// NUNCA imprime secretos completos: todo hallazgo se ENMASCARA.
// Sin dependencias externas (solo módulos nativos de Node).
//
// Uso:
//   node scripts/qa/check-no-secrets.mjs [rutas...] [opciones]
//   node scripts/qa/check-no-secrets.mjs --help
//
// Opciones:
//   --all       Escanea toda la raíz del repo (por defecto: raíz).
//   --soft      Sale con código 0 aunque haya hallazgos HIGH.
//   --help      Esta ayuda.
//
// Código de salida: 1 si hay hallazgos HIGH; 0 en caso contrario (o --soft).
// Notas:
//   - NO lee el contenido de archivos .env*/secret (solo reporta su existencia).
//   - .env.example está permitido y se ignora.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, extname, basename } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA check-no-secrets — busca patrones de secreto (solo lectura, enmascara).

Uso:
  node scripts/qa/check-no-secrets.mjs [rutas...] [opciones]

Opciones:
  --all                    Escanea toda la raíz (por defecto ya escanea la raíz).
  --changed-only           Escanea SOLO archivos modificados contra main/origin/main
                           más el working tree (delta del PR, no ruido heredado).
                           Si no puede resolver main ni origin/main → aviso y código 2.
  --baseline-known-issues  No oculta nada, pero clasifica como KNOWN LEGACY los HIGH
                           en rutas legacy ya conocidas (supabase-client/index.ts,
                           migrate_alsari_db.py, services/python/src/alsari/alerts/).
                           KNOWN LEGACY no afecta al código de salida.
  --soft                   Sale con código 0 aunque haya HIGH.
  --help                   Esta ayuda.

Detecta (enmascarado):
  JWT (eyJ........), service_role + token, SUPABASE_SERVICE(_ROLE)_KEY,
  DB_PASSWORD/PGPASSWORD/JWT_SECRET con valor, asignaciones SECRET/TOKEN/API_KEY/ANON_KEY con valor,
  bloques "BEGIN ... PRIVATE KEY", URLs del Supabase legacy fuera de documentación (WARN),
  y la EXISTENCIA de archivos .env reales (no lee su contenido).

Ignora: .env.example, node_modules, .git, y los propios docs/scripts de QA.
Nunca imprime el secreto completo.`);
  process.exit(0);
}

const OPT = {
  soft: args.includes('--soft'),
  changedOnly: args.includes('--changed-only'),
  baseline: args.includes('--baseline-known-issues'),
};
const pathArgs = args.filter((a) => !a.startsWith('-'));

// Rutas de legacy YA CONOCIDO (documentadas; pendientes de rotación/limpieza).
const KNOWN_LEGACY_PATHS = [
  'packages/supabase-client/src/index.ts',
  'scripts/migrate_alsari_db.py',
  'services/python/src/alsari/alerts/',
];
function isKnownLegacy(rel) {
  return KNOWN_LEGACY_PATHS.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
}

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build', 'coverage', '.vercel',
]);
// Evitar auto-match: los checks y docs de QA mencionan los términos sin valor real.
const EXCLUDE_PATH_PARTS = ['scripts/qa/', 'docs/qa/', 'docs/integration/'];

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz',
]);

// Placeholder => no es secreto real.
const PLACEHOLDER = /^(<.*>|x{3,}|y{3,}|your[-_].*|placeholder|dummy|changeme|change-me|example|sample|todo|null|undefined|\.\.\.|\$\{.*\}|process\.env.*|import\.meta.*)$/i;

function isPlaceholder(v) {
  const s = (v || '').trim().replace(/^['"`]|['"`,;]+$/g, '');
  if (s.length === 0) return true;
  return PLACEHOLDER.test(s);
}

function mask(s) {
  const v = String(s).replace(/^['"`]|['"`]$/g, '');
  if (v.length <= 6) return `***[${v.length}]`;
  return `${v.slice(0, 2)}…[${v.length}]…${v.slice(-2)}`;
}

function isExcludedPath(rel) {
  const norm = rel.replace(/\\/g, '/');
  return EXCLUDE_PATH_PARTS.some((p) => norm.includes(p));
}

function isEnvFile(name) {
  return /^\.env($|\.)/.test(name);
}

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = relative(ROOT, full);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      if (isExcludedPath(rel + '/')) continue;
      walk(full, acc);
    } else if (e.isFile()) {
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

// Detectores de línea -> devuelven {type, value} o null.
const JWT_RE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
// Ref del proyecto Supabase legacy: no es un secreto per se, pero fuera de docs es señal de conexión legacy.
const LEGACY_SUPABASE_RE = /swtyxysvnfcfxziclteq/i;
const ASSIGN_RE = /\b([A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY|SECRET|TOKEN|API_?KEY|ANON_KEY|DB_PASSWORD|PGPASSWORD|PASSWORD)[A-Z0-9_]*)\b\s*[:=]\s*([^\s,;]+)/i;
const SUPABASE_SERVICE_RE = /SUPABASE_SERVICE(_ROLE)?(_KEY)?/i;

const TS_TYPE_RE = /^(string|number|boolean|any|unknown|void|null|undefined|object|Record|Promise)\b/i;

// Clasifica el valor capturado tras `=` o `:`. Distingue secreto real de
// anotación de tipo TS, referencia a código (identificador/llamada) o placeholder.
function classifyValue(raw, wasColon) {
  const quoted = /^['"`]/.test(raw.trim());
  const v = raw.trim().replace(/^['"`]|['"`,;]+$/g, '');
  if (isPlaceholder(v)) return { sev: 'INFO', value: '(placeholder)' };
  if (wasColon && !quoted && TS_TYPE_RE.test(v)) return { sev: 'INFO', value: '(tipo TS)' };
  if (!quoted && /^[A-Za-z_$][\w$.]*(\(|$)/.test(v)) return { sev: 'INFO', value: '(ref. código)' };
  if (v.length < 12) return { sev: 'INFO', value: '(valor corto)' };
  return { sev: 'HIGH', value: v };
}

function scanLine(line, rel) {
  const out = [];
  const jwt = line.match(JWT_RE);
  if (jwt) out.push({ type: 'JWT', sev: 'HIGH', value: jwt[0] });

  if (PRIVATE_KEY_RE.test(line)) {
    out.push({ type: 'private-key-block', sev: 'HIGH', value: '(bloque PRIVATE KEY)' });
  }

  // URL/ref Supabase legacy: WARN fuera de documentación (en docs/ es mención documental).
  if (LEGACY_SUPABASE_RE.test(line) && !rel.startsWith('docs/')) {
    out.push({ type: 'legacy-supabase-ref', sev: 'WARN', value: '(ref legacy fuera de docs)' });
  }

  const asg = line.match(ASSIGN_RE);
  if (asg) {
    const key = asg[1];
    const sep = line.slice(asg.index, asg.index + asg[0].length).includes('=') ? '=' : ':';
    const cls = classifyValue(asg[2], sep === ':');
    if (cls.sev === 'HIGH') out.push({ type: `assign:${key}`, sev: 'HIGH', value: cls.value });
    else out.push({ type: `mention:${key}`, sev: 'INFO', value: cls.value });
  } else if (SUPABASE_SERVICE_RE.test(line) || /\bservice_role\b/.test(line)) {
    // Mención sin asignación de valor (p. ej. GRANT ... TO service_role en SQL).
    out.push({ type: 'mention:service_role', sev: 'INFO', value: '(sin valor)' });
  }
  return out;
}

// --changed-only: archivos modificados contra main/origin/main + working tree.
// Devuelve null si no puede resolver la base (no inventa).
function changedFiles() {
  const run = (a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  let base = null;
  if (run(['rev-parse', '--verify', '--quiet', 'main']).status === 0) base = 'main';
  else if (run(['rev-parse', '--verify', '--quiet', 'origin/main']).status === 0) base = 'origin/main';
  if (!base) return null;
  const set = new Set();
  const d = run(['diff', '--name-only', `${base}...HEAD`]);
  if (d.status === 0) for (const l of (d.stdout || '').split(/\r?\n/)) if (l.trim()) set.add(l.trim());
  const st = run(['status', '--porcelain']);
  if (st.status === 0) {
    for (const l of (st.stdout || '').split(/\r?\n/)) {
      if (!l) continue;
      const p = l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop();
      if (p) set.add(p);
    }
  }
  return { base, list: [...set] };
}

// Objetivos
const files = [];
let changedBase = null;

if (OPT.changedOnly) {
  const ch = changedFiles();
  if (!ch) {
    console.log('=== QA check-no-secrets ===');
    console.log('✗ --changed-only: no existe main ni origin/main en local; no se puede calcular el delta.');
    console.log('  Haz fetch de main o corre el modo normal. No se inventa una base.');
    process.exit(2);
  }
  changedBase = ch.base;
  for (const rel of ch.list) {
    const full = join(ROOT, rel);
    let st; try { st = statSync(full); } catch { continue; } // borrado → no se escanea
    if (!st.isFile()) continue;
    if (isExcludedPath(rel)) continue;
    files.push(full); // .env y binarios se filtran/reportan en el bucle principal
  }
} else {
  let targets;
  if (pathArgs.length > 0) targets = pathArgs.map((p) => resolve(process.cwd(), p));
  else targets = [ROOT];
  for (const t of targets) {
    let st; try { st = statSync(t); } catch { console.error(`! ruta no encontrada: ${t}`); continue; }
    if (st.isDirectory()) walk(t, files);
    else files.push(t);
  }
}

const findings = [];

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const name = basename(f);

  // Archivos .env: reportar EXISTENCIA (no leer contenido), salvo .env.example.
  if (isEnvFile(name)) {
    if (name === '.env.example') continue;
    findings.push({ file: rel, line: 0, type: 'env-file-present', sev: 'HIGH', masked: '(no se lee su contenido)' });
    continue;
  }

  if (BINARY_EXT.has(extname(name).toLowerCase())) continue;

  let buf;
  try { buf = readFileSync(f); } catch { continue; }
  if (looksBinary(buf)) continue;
  const lines = buf.toString('utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const hit of scanLine(lines[i], rel)) {
      findings.push({
        file: rel,
        line: i + 1,
        type: hit.type,
        sev: hit.sev,
        masked: hit.sev === 'HIGH' ? mask(hit.value) : hit.value,
      });
    }
  }
}

// --baseline-known-issues: reclasificar HIGH en rutas legacy conocidas.
if (OPT.baseline) {
  for (const f of findings) {
    if (f.sev === 'HIGH' && isKnownLegacy(f.file)) f.sev = 'KNOWN';
  }
}

const highs = findings.filter((f) => f.sev === 'HIGH');
const knowns = findings.filter((f) => f.sev === 'KNOWN');
const warns = findings.filter((f) => f.sev === 'WARN');
const infos = findings.filter((f) => f.sev === 'INFO');

console.log('=== QA check-no-secrets (valores ENMASCARADOS) ===');
console.log(`Raíz: ${ROOT} · archivos: ${files.length}`);
if (OPT.changedOnly) console.log(`Modo: changed-only (delta contra ${changedBase} + working tree)`);
if (OPT.baseline) console.log('Modo: baseline-known-issues (legacy conocido clasificado aparte, no bloquea)');
console.log('');

if (highs.length === 0) {
  console.log('OK · 0 hallazgos HIGH (sin secretos aparentes).');
} else {
  console.log('!! HALLAZGOS HIGH (revisar y, si son reales, ROTAR la clave):');
  for (const h of highs) {
    const loc = h.line ? `${h.file}:${h.line}` : h.file;
    console.log(`  ${loc}  [${h.type}]  ${h.masked}`);
  }
}
if (knowns.length > 0) {
  console.log('');
  console.log('KNOWN LEGACY (preexistente en rutas conocidas — no bloquea; pendiente de rotación/limpieza):');
  for (const k of knowns) {
    const loc = k.line ? `${k.file}:${k.line}` : k.file;
    console.log(`  ${loc}  [${k.type}]  ${k.masked}`);
  }
}
if (warns.length > 0) {
  console.log('');
  console.log('⚠ WARN (no bloquea, pero revisar — ref del Supabase legacy fuera de documentación):');
  for (const w of warns) console.log(`  ${w.file}:${w.line}  [${w.type}]`);
}
if (infos.length > 0) {
  console.log('');
  console.log(`(INFO · ${infos.length} menciones sin valor real — placeholders / nombres de rol / prosa)`);
}
console.log('');
console.log(`--- TOTAL HIGH: ${highs.length} · KNOWN LEGACY: ${knowns.length} · WARN: ${warns.length} · INFO: ${infos.length} ---`);

process.exit(OPT.soft ? 0 : highs.length > 0 ? 1 : 0);
