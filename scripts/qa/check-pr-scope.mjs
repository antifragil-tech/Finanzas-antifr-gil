#!/usr/bin/env node
// QA · check-pr-scope
// Revisa el alcance del working tree / rama actual antes de abrir un PR.
// SOLO LECTURA: usa comandos git de consulta (branch, diff --name-only, status).
// Sin dependencias externas (node:child_process nativo).
//
// Uso:
//   node scripts/qa/check-pr-scope.mjs [opciones]
//   node scripts/qa/check-pr-scope.mjs --help
//
// Código de salida:
//   0 — sin rutas peligrosas tocadas (o solo avisos).
//   1 — la rama/working tree toca rutas peligrosas.
//   2 — no se pudo consultar git.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA check-pr-scope — revisa el alcance de la rama actual (solo lectura).

Uso:
  node scripts/qa/check-pr-scope.mjs [opciones]

Opciones:
  --base <ref>  Ref base para el diff (def. main; fallback origin/main).
  --soft        Sale con código 0 aunque toque rutas peligrosas.
  --help, -h    Esta ayuda.

Muestra:
  - rama actual;
  - archivos modificados contra la base (committed) y en el working tree;
  - si toca rutas peligrosas: .env*, packages/supabase-client,
    services/supabase/migrations, pnpm-lock.yaml, package.json (raíz),
    apps/modules/reservas, apps/host.

Solo ejecuta git de consulta. No modifica nada. No hace fetch.`);
  process.exit(0);
}

const OPT = { soft: args.includes('--soft') };
function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

function git(...a) {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  // raw: sin trim — el formato porcelain usa el primer carácter (puede ser espacio).
  return { ok: r.status === 0, out: (r.stdout || '').trim(), raw: r.stdout || '', err: (r.stderr || '').trim() };
}

// Rutas peligrosas: prefijo (o nombre exacto para archivos de raíz).
const DANGEROUS = [
  { label: '.env (cualquier variante)', test: (f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example') },
  { label: 'packages/supabase-client', test: (f) => f.startsWith('packages/supabase-client/') },
  { label: 'services/supabase/migrations', test: (f) => f.startsWith('services/supabase/migrations/') },
  { label: 'pnpm-lock.yaml', test: (f) => f === 'pnpm-lock.yaml' },
  { label: 'package.json (raíz)', test: (f) => f === 'package.json' },
  { label: 'apps/modules/reservas', test: (f) => f.startsWith('apps/modules/reservas/') },
  { label: 'apps/host', test: (f) => f.startsWith('apps/host/') },
];

console.log('=== QA check-pr-scope ===');

const inRepo = git('rev-parse', '--is-inside-work-tree');
if (!inRepo.ok) {
  console.log('✗ No se pudo consultar git (¿estás dentro del repo?).');
  process.exit(2);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`Rama actual: ${branch.out || '(desconocida)'}`);

// Resolver base: main local → origin/main → aviso.
let base = argVal('--base', null);
const warnings = [];
if (!base) {
  if (git('rev-parse', '--verify', '--quiet', 'main').ok) base = 'main';
  else if (git('rev-parse', '--verify', '--quiet', 'origin/main').ok) base = 'origin/main';
}
console.log(`Base de comparación: ${base || '(no disponible)'}`);
console.log('');

// 1) Archivos committed en la rama respecto a la base (merge-base con ...).
let committed = [];
if (base) {
  const d = git('diff', '--name-only', `${base}...HEAD`);
  if (d.ok) committed = d.out ? d.out.split('\n') : [];
  else warnings.push(`no se pudo diffear contra ${base} (${d.err.split('\n')[0] || 'error'}); la base puede no estar actualizada.`);
} else {
  warnings.push('no existe main ni origin/main en local: no se puede comparar la rama. Haz fetch manualmente si lo necesitas.');
}

// 2) Cambios del working tree (staged + unstaged + untracked).
const st = git('status', '--porcelain');
const working = st.ok
  ? st.raw.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
  : [];
if (!st.ok) warnings.push('no se pudo leer git status.');

function report(title, files) {
  console.log(`${title} (${files.length}):`);
  if (files.length === 0) console.log('  (ninguno)');
  for (const f of files) console.log(`  ${f}`);
  console.log('');
}

report(`Archivos committed vs ${base || '?'}`, committed);
report('Archivos con cambios en el working tree', working);

// 3) Rutas peligrosas sobre la unión de ambos.
const all = [...new Set([...committed, ...working])].map((f) => f.replace(/\\/g, '/'));
const hits = [];
for (const f of all) {
  for (const d of DANGEROUS) {
    if (d.test(f)) hits.push({ file: f, rule: d.label });
  }
}

if (hits.length > 0) {
  console.log('!! RUTAS PELIGROSAS TOCADAS (requieren PR específico autorizado):');
  for (const h of hits) console.log(`  ${h.file}  [${h.rule}]`);
} else {
  console.log('OK · no se tocan rutas peligrosas.');
}

for (const w of warnings) console.log(`⚠ Aviso: ${w}`);

console.log('');
console.log(`--- Resumen: ${all.length} archivos · ${hits.length} en rutas peligrosas · ${warnings.length} avisos ---`);

process.exit(OPT.soft ? 0 : hits.length > 0 ? 1 : 0);
