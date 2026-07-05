#!/usr/bin/env node
// QA · smoke-routes
// Hace GET a rutas locales del host y reporta status + legacy visible + banner demo.
// NO arranca servidores: solo prueba contra uno YA levantado. SOLO LECTURA (GET).
// Sin dependencias externas (node:http / node:https).
//
// Uso:
//   QA_BASE_URL=http://localhost:3000 node scripts/qa/smoke-routes.mjs [opciones]
//   node scripts/qa/smoke-routes.mjs --base http://localhost:3000 --expect-demo
//   node scripts/qa/smoke-routes.mjs --help
//
// Opciones:
//   --base <url>     Base URL (si no, usa QA_BASE_URL o http://localhost:3000).
//   --expect-demo    Exige banner "DATOS DE DEMOSTRACIÓN" y prohíbe legacy visible.
//   --timeout <ms>   Timeout por petición (def. 5000).
//   --help           Esta ayuda.
//
// Código de salida: 0 todo PASS · 1 algún FAIL · 2 no hay servidor.

import http from 'node:http';
import https from 'node:https';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`QA smoke-routes — GET a rutas locales (no arranca servidores).

Uso:
  QA_BASE_URL=http://localhost:3000 node scripts/qa/smoke-routes.mjs [opciones]

Opciones:
  --base <url>     Base URL (o variable QA_BASE_URL; def. http://localhost:3000).
  --expect-demo    Exige banner de demo y prohíbe texto legacy visible.
  --timeout <ms>   Timeout por petición (def. 5000).
  --help, -h       Esta ayuda.

Rutas: / /reservas /financiero /rentabilidad /contabilidad /presupuestos /configuracion /facturas
Solo hace GET. No modifica nada. No levanta servidores.`);
  process.exit(0);
}

function argVal(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const BASE = (argVal('--base', process.env.QA_BASE_URL) || 'http://localhost:3000').replace(/\/$/, '');
const EXPECT_DEMO = args.includes('--expect-demo');
const TIMEOUT = parseInt(argVal('--timeout', '5000'), 10);

const ROUTES = ['/', '/reservas', '/financiero', '/rentabilidad', '/contabilidad', '/presupuestos', '/configuracion', '/facturas'];
const LEGACY_RE = /\b(Alsari|Pavier|Armia|Rialsa)\b/i;
const DEMO_RE = /DATOS DE DEMOSTRACI[ÓO]N/i;

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total <= 512 * 1024) chunks.push(c); // límite 512KB para no cargar de más
      });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(TIMEOUT, () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => resolve({ error: err.code || err.message }));
  });
}

const main = async () => {
  console.log('=== QA smoke-routes ===');
  console.log(`Base: ${BASE} · modo: ${EXPECT_DEMO ? 'expect-demo' : 'informativo'} · timeout: ${TIMEOUT}ms`);
  console.log('');

  // Sonda inicial: ¿hay servidor?
  const probe = await get(BASE + '/');
  if (probe.error && (probe.error === 'ECONNREFUSED' || probe.error === 'timeout' || probe.error === 'ENOTFOUND')) {
    console.log(`✗ No hay servidor en ${BASE} (${probe.error}).`);
    console.log('  Levanta el demo primero (ver docs/qa/runbook-smoke-tests.md). No es un fallo del código.');
    process.exit(2);
  }

  const results = [];
  for (const route of ROUTES) {
    const r = await get(BASE + route);
    if (r.error) {
      results.push({ route, status: 'ERR', legacy: false, demo: false, pass: false, note: r.error });
      continue;
    }
    const legacy = LEGACY_RE.test(r.body);
    const demo = DEMO_RE.test(r.body);
    let pass = r.status >= 200 && r.status < 400 && !legacy;
    if (EXPECT_DEMO) pass = pass && demo;
    results.push({ route, status: r.status, legacy, demo, pass });
  }

  // Reporte
  const W = Math.max(...ROUTES.map((r) => r.length));
  for (const r of results) {
    const flag = r.pass ? 'PASS' : 'FAIL';
    const bits = [
      `status=${r.status}`,
      `legacy=${r.legacy ? 'SÍ⚠' : 'no'}`,
      `demo=${r.demo ? 'sí' : 'no'}`,
    ];
    console.log(`  [${flag}] ${r.route.padEnd(W)}  ${bits.join('  ')}${r.note ? '  (' + r.note + ')' : ''}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`--- ${results.length - failed.length}/${results.length} PASS ---`);
  if (failed.length) {
    console.log('FAIL en: ' + failed.map((r) => r.route).join(', '));
    if (results.some((r) => r.legacy)) console.log('⚠ Texto legacy visible detectado: revisar la rama de host/demo.');
  }
  process.exit(failed.length ? 1 : 0);
};

main();
