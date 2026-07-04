#!/usr/bin/env node
// QA · check-pr-scope
// Revisa el alcance del working tree / rama actual antes de abrir un PR,
// con perfiles por tipo de PR (docs, reservas, demo, db, qa, default).
// SOLO LECTURA: usa comandos git de consulta (branch, diff --name-only, status).
// Sin dependencias externas (node:child_process nativo).
//
// Uso:
//   node scripts/qa/check-pr-scope.mjs [opciones]
//   node scripts/qa/check-pr-scope.mjs --profile reservas
//   node scripts/qa/check-pr-scope.mjs --help
//
// Código de salida:
//   0 — sin rutas bloqueadas (puede haber avisos).
//   1 — la rama/working tree toca rutas bloqueadas para el perfil.
//   2 — no se pudo consultar git.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA check-pr-scope — revisa el alcance de la rama actual por perfil de PR (solo lectura).

Uso:
  node scripts/qa/check-pr-scope.mjs [opciones]

Opciones:
  --profile <tipo>  Perfil de PR: docs | reservas | demo | db | qa | default (def. default).
  --allow <ruta>    Autoriza explícitamente un prefijo extra (repetible). Vence al
                    bloqueo del perfil, pero NUNCA a los bloqueos universales.
  --base <ref>      Ref base para el diff (def. main; fallback origin/main).
  --soft            Sale con código 0 aunque haya rutas bloqueadas.
  --help, -h        Esta ayuda.

Perfiles:
  docs      Permite docs/**, SESSION.md, .github/PULL_REQUEST_TEMPLATE.md.
            Bloquea apps/**, packages/**, services/**.
  reservas  Permite apps/modules/reservas/**; pnpm-lock.yaml con WARNING.
            Bloquea apps/host/**, packages/**, services/**.
  demo      Permite apps/host/** y módulos demo (apps/modules/**).
            Bloquea apps/modules/reservas/** (salvo --allow apps/modules/reservas/),
            packages/**, services/**.
  db        Permite services/supabase/baselines/antifragil_os/**.
            Bloquea services/supabase/migrations/**, apps/**, packages/**.
  qa        Permite docs/qa/** y scripts/qa/**. Bloquea apps/**, packages/**, services/**.
  default   Conservador: marca cualquier ruta peligrosa (.env, supabase-client,
            migraciones, lockfile, package.json raíz, apps/modules/reservas, apps/host).

Bloqueos universales (en TODOS los perfiles, --allow no los levanta):
  .env* (salvo .env.example), packages/supabase-client/**,
  services/supabase/migrations/**, package.json (raíz).

Los archivos que no encajan ni en permitido ni en bloqueado se reportan como
WARN "fuera del perfil" (no bloquean, pero se revisan).

Solo ejecuta git de consulta. No modifica nada. No hace fetch.`);
  process.exit(0);
}

const OPT = { soft: args.includes('--soft') };
function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
function argVals(flag) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) out.push(args[i + 1].replace(/\\/g, '/'));
  }
  return out;
}

const PROFILE = argVal('--profile', 'default');
const EXTRA_ALLOW = argVals('--allow');

// Bloqueos universales: ningún perfil ni --allow los levanta.
const ALWAYS_BLOCK = [
  { label: '.env (cualquier variante)', test: (f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example') },
  { label: 'packages/supabase-client', test: (f) => f.startsWith('packages/supabase-client/') },
  { label: 'services/supabase/migrations', test: (f) => f.startsWith('services/supabase/migrations/') },
  { label: 'package.json (raíz)', test: (f) => f === 'package.json' },
];

// Perfil default: lista peligrosa conservadora original.
const DEFAULT_DANGEROUS = [
  { label: 'pnpm-lock.yaml', test: (f) => f === 'pnpm-lock.yaml' },
  { label: 'apps/modules/reservas', test: (f) => f.startsWith('apps/modules/reservas/') },
  { label: 'apps/host', test: (f) => f.startsWith('apps/host/') },
];

// Perfiles: allow/block por prefijo (o nombre exacto). lock: qué hacer con pnpm-lock.yaml.
const PROFILES = {
  docs: {
    allow: ['docs/', 'SESSION.md', '.github/PULL_REQUEST_TEMPLATE.md'],
    block: ['apps/', 'packages/', 'services/'],
    lock: 'block',
  },
  reservas: {
    allow: ['apps/modules/reservas/'],
    block: ['apps/host/', 'packages/', 'services/'],
    lock: 'warn',
  },
  demo: {
    allow: ['apps/host/', 'apps/modules/'],
    block: ['apps/modules/reservas/', 'packages/', 'services/'],
    lock: 'block',
  },
  db: {
    allow: ['services/supabase/baselines/antifragil_os/'],
    block: ['services/supabase/migrations/', 'apps/', 'packages/'],
    lock: 'block',
  },
  qa: {
    allow: ['docs/qa/', 'scripts/qa/'],
    block: ['apps/', 'packages/', 'services/'],
    lock: 'block',
  },
};

if (PROFILE !== 'default' && !PROFILES[PROFILE]) {
  console.error(`✗ Perfil desconocido: ${PROFILE}. Válidos: docs, reservas, demo, db, qa, default.`);
  process.exit(2);
}

function matchPrefix(f, list) {
  return list.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p));
}

// Clasifica un archivo → { status: 'BLOCK'|'WARN'|'ALLOW', rule }
function classify(f) {
  for (const rule of ALWAYS_BLOCK) {
    if (rule.test(f)) return { status: 'BLOCK', rule: `universal: ${rule.label}` };
  }
  if (matchPrefix(f, EXTRA_ALLOW)) return { status: 'ALLOW', rule: 'autorizado con --allow' };

  if (PROFILE === 'default') {
    for (const rule of DEFAULT_DANGEROUS) {
      if (rule.test(f)) return { status: 'BLOCK', rule: rule.label };
    }
    return { status: 'ALLOW', rule: '' };
  }

  const p = PROFILES[PROFILE];
  if (f === 'pnpm-lock.yaml') {
    return p.lock === 'warn'
      ? { status: 'WARN', rule: 'pnpm-lock.yaml: revisar que se regeneró con pnpm install (no a mano)' }
      : { status: 'BLOCK', rule: 'pnpm-lock.yaml no permitido en este perfil' };
  }
  if (matchPrefix(f, p.block)) return { status: 'BLOCK', rule: `bloqueado por perfil ${PROFILE}` };
  if (matchPrefix(f, p.allow)) return { status: 'ALLOW', rule: '' };
  return { status: 'WARN', rule: `fuera del perfil ${PROFILE} (revisar si procede)` };
}

function git(...a) {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  // raw: sin trim — el formato porcelain usa el primer carácter (puede ser espacio).
  return { ok: r.status === 0, out: (r.stdout || '').trim(), raw: r.stdout || '', err: (r.stderr || '').trim() };
}

console.log('=== QA check-pr-scope ===');

const inRepo = git('rev-parse', '--is-inside-work-tree');
if (!inRepo.ok) {
  console.log('✗ No se pudo consultar git (¿estás dentro del repo?).');
  process.exit(2);
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
console.log(`Rama actual: ${branch.out || '(desconocida)'}`);
console.log(`Perfil: ${PROFILE}${EXTRA_ALLOW.length ? ` · --allow: ${EXTRA_ALLOW.join(', ')}` : ''}`);

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

// 3) Clasificación por perfil sobre la unión de ambos.
const all = [...new Set([...committed, ...working])].map((f) => f.replace(/\\/g, '/'));
const blocked = [];
const warns = [];
let allowed = 0;
for (const f of all) {
  const c = classify(f);
  if (c.status === 'BLOCK') blocked.push({ file: f, rule: c.rule });
  else if (c.status === 'WARN') warns.push({ file: f, rule: c.rule });
  else allowed++;
}

if (blocked.length > 0) {
  console.log(`!! BLOQUEADO para el perfil "${PROFILE}" (requiere PR específico autorizado):`);
  for (const b of blocked) console.log(`  ${b.file}  [${b.rule}]`);
  console.log('');
}
if (warns.length > 0) {
  console.log('⚠ WARN (no bloquea, revisar):');
  for (const w of warns) console.log(`  ${w.file}  [${w.rule}]`);
  console.log('');
}
if (blocked.length === 0) {
  console.log(`OK · sin rutas bloqueadas para el perfil "${PROFILE}".`);
}

for (const w of warnings) console.log(`⚠ Aviso: ${w}`);

console.log('');
console.log(`--- Resumen: ${all.length} archivos · ${allowed} permitidos · ${warns.length} WARN · ${blocked.length} bloqueados · ${warnings.length} avisos ---`);

process.exit(OPT.soft ? 0 : blocked.length > 0 ? 1 : 0);
