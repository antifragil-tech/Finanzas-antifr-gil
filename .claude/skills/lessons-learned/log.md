# Log de Lecciones Aprendidas — Alsari Capital OS

> Crónica cronológica de errores corregidos y lecciones generalizadas.
> Cada entrada sigue el formato de `SKILL.md`. Crece sin tope.
> **No editar entradas antiguas; añadir entradas nuevas siempre al final.**

---

## 📊 Estadísticas rápidas

- **Total de lecciones:** 10
- **Última actualización:** 2026-06-11
- **Lecciones promovidas a ways-of-working:** 0

---

## 📚 Convención

Las entradas se añaden al final del archivo, separadas por `---`.
Las más recientes quedan abajo. La búsqueda se hace con `grep` por tags.

---

## 2026-05-15 — JSON no admite comentarios: eliminar todas las claves `_comment*` de settings.json

**Contexto:** Configuración inicial del repo. Se creó `.claude/settings.json` con claves `_comment` y `_comment_*` a modo de anotaciones inline dentro del JSON.

**Error:** Se incluyeron claves `_comment` dentro de los objetos `permissions`, `hooks` y `env`, y claves `_comment_*` en el nivel raíz del JSON.

**Corrección de Guille:** JSON no admite comentarios de ningún tipo. Claude Code parsea `permissions`, `hooks` y `env` como objetos con forma fija — cualquier clave inesperada (`_comment`) dentro de esos objetos rompe o contamina la configuración.

**Causa raíz:** Intento de documentar la configuración inline usando una convención propia (`_comment`), sin tener en cuenta que JSON es un formato estricto sin soporte de comentarios y que Claude Code valida la forma exacta de esos objetos.

**Lección:** `settings.json` debe ser JSON puro y válido. Sin claves `_comment`, `_comment_*` ni ninguna otra pseudoanotación. La documentación de la configuración va en `.claude/hooks/README.md` o en los `ways-of-working`, no en el propio JSON.

**Acciones tomadas:**

- [x] Eliminadas todas las claves `_comment*` de `.claude/settings.json`
- [x] Verificado que `permissions.allow` y `permissions.deny` quedan como arrays directos bajo `permissions`

**Tags:** #config #json #settings #claude-code

---

## 2026-05-15 — Formato incorrecto de hooks en settings.json: falta nivel de anidamiento `hooks`

**Contexto:** Configuración inicial de hooks en `.claude/settings.json`. Se escribió el campo `command` directamente en el objeto de cada entrada del array de eventos.

**Error:** Estructura usada (incorrecta):

```json
"PreToolUse": [{ "matcher": "Bash", "command": "script.sh" }]
```

Además, los patrones Bash usaban `:*` como sufijo (`"Bash(git status:*)"`) en vez del wildcard correcto.

**Corrección:** El schema oficial requiere un nivel extra de anidamiento: cada entrada del array de eventos debe tener un campo `hooks` que es un array de objetos `{ "type": "command", "command": "..." }`. Los patrones Bash deben usar solo el prefijo del comando sin `:*`.

**Causa raíz:** Se asumió una estructura plana sin verificar el schema. El campo `command` existe en el tipo de hook interno, no en el objeto matcher externo.

**Lección:** Antes de escribir o generar `settings.json`, consultar el schema en `https://json.schemastore.org/claude-code-settings.json`. La estructura correcta de hooks tiene **dos niveles**: matcher externo → array `hooks` interno con `type` + `command`.

**Acciones tomadas:**

- [x] Reestructurados los 4 hooks (PreToolUse, PostToolUse, SessionStart, Stop) al formato correcto
- [x] Corregidos los patrones Bash eliminando el sufijo `:*`

**Tags:** #config #hooks #settings #claude-code #schema

---

## 2026-05-17 — Tailwind del host NO escanea `apps/modules/` por defecto: el CSS de los módulos no se genera y el layout se rompe sin error visible

**Contexto:** Tras montar el módulo `financiero` (Vite + React) dentro del host (Next.js) como dependencia workspace (`@alsari/financiero`), el sidebar del módulo se renderizaba en flujo normal en vez de como overlay/fixed: el dropdown del selector de sociedad se mezclaba con la Vista Operativa y el Terminal Status, el icono de Layers caía debajo del select en vez de dentro, el sidebar no se quedaba pegado a la izquierda. Visualmente parecía un problema de JSX/estructura.

**Error:** Asumí que el problema era de markup y reescribí el JSX del `FinancialSidebar` **cinco veces** probando `sticky top-0`, `fixed left-16`, restructurando la jerarquía DOM, moviendo el dropdown fuera del scroll, cambiando `overflow-hidden` por `overflow-visible`, etc. Nada funcionaba porque la causa real era otra: **las clases Tailwind del módulo simplemente no existían como CSS**.

**Corrección de Guille:** "porque no copias el formato de la original exacto?" — al releer el original y comparar con mi código, eran idénticos en JSX. Eso me forzó a mirar la cadena de build, donde encontré que `apps/host/tailwind.config.ts` solo escaneaba `./src/**/*` y `../../packages/ui/src/**/*`. El módulo `financiero` no estaba en el `content` array.

**Causa raíz:** Tailwind v3 genera CSS solo para las clases que detecta vía glob en `content`. Cuando Next.js (host) transpila e importa un módulo workspace cuyas fuentes están fuera de la carpeta del host, esas fuentes **no se escanean automáticamente** — pnpm las symlinkea, no las copia. Resultado: las clases que solo se usan en el módulo (`absolute`, `fixed`, `z-50`, `left-16`, `top-full`, `appearance-none`, etc.) se omiten del CSS generado, y el componente renderiza sin estilos críticos. Sin error visible: solo "se ve mal".

**Lección:**

1. Cuando un proyecto Next.js consume módulos workspace con sus propios componentes, el `content` de Tailwind del host **debe** incluir explícitamente las fuentes de esos módulos: `'../modules/*/src/**/*.{ts,tsx}'`.
2. Importante: **NO** uses `'../modules/**/*.{ts,tsx}'` sin restringir a `src/` — escaneará `node_modules/` y `dist/` de cada módulo, lo que cuelga el dev server o provoca Internal Server Error.
3. Heurística de diagnóstico: si el JSX "parece bien" pero el resultado visual es desastroso (especialmente posicionamiento y layout), **antes de tocar el JSX**, comprueba que las clases Tailwind se están generando — abre devtools y mira si el elemento tiene `position: absolute` aplicado de verdad.

**Acciones tomadas:**

- [x] Añadido `'../modules/*/src/**/*.{ts,tsx}'` al `content` de `apps/host/tailwind.config.ts`
- [x] Borrado `apps/host/.next` para forzar regeneración del CSS
- [x] Documentado en `apps/modules/_template/ways-of-working-local/README.md` para nuevos módulos
- [x] Documentado en `apps/host/tailwind.config.ts` como comentario de contexto

**Tags:** #tailwind #monorepo #pnpm #nextjs #vite #build #css #workspace

---

## 2026-05-22 — @supabase/ssr guarda sesión en cookies, no en localStorage: los módulos Vite necesitan el bridge window.alsariToken

**Contexto:** El módulo `contabilidad` (Vite) hacía llamadas a Supabase con el token leído de `localStorage`. Cuando el host (Next.js) usa `@supabase/ssr`, la sesión vive en cookies HTTP, no en `localStorage`, por lo que el módulo siempre obtenía `null` y todas las queries fallaban con 401.

**Error:** Se asumió que `localStorage` contenía el token de sesión, igual que haría un cliente estándar de `@supabase/supabase-js`. Se intentaron varios enfoques (leer distintas claves de `localStorage`, pasar el token por props) antes de identificar la causa raíz.

**Corrección de Guille:** (Identificada internamente al trazar la diferencia entre `@supabase/ssr` y `@supabase/supabase-js`.)

**Causa raíz:** `@supabase/ssr` almacena la sesión en cookies para que funcione con Server Components y SSR de Next.js. Los módulos Vite importados como paquetes workspace no pueden acceder a esas cookies directamente. Resultado: `supabase.auth.getSession()` devuelve `null` desde un módulo Vite aunque el usuario esté autenticado en el host.

**Lección:** El patrón correcto para auth en módulos Vite embebidos en un host Next.js con `@supabase/ssr`:

1. `AppShell.tsx` (host) expone `window.alsariToken` tras cada `onAuthStateChange`.
2. `getJwt()` en `@alsari/supabase-client` lee primero `window.alsariToken`, luego hace fallback a `localStorage`.
3. Todos los módulos usan `getJwt()` para construir el header `Authorization: Bearer <token>`.
4. Nunca leer `localStorage` directamente en los módulos para obtener el token de sesión.

**Acciones tomadas:**

- [x] `AppShell.tsx` expone `window.alsariToken` en `onAuthStateChange`
- [x] `getJwt()` en `supabase-client` implementa la lectura por prioridad
- [x] Documentado en `docs/ARQUITECTURA.md` sección "Auth bridge para módulos Vite"

**Tags:** #auth #supabase #ssr #nextjs #vite #jwt #window

---

## 2026-05-22 — exactOptionalPropertyTypes: string | undefined no es compatible con ?: string al pasar props explícitamente

**Contexto:** `tsconfig.json` tiene `exactOptionalPropertyTypes: true`. Al desestructurar `emisorCif?: string` de una variable de tipo `PreviewProps` y pasarlo directamente a `buildInvoiceHtml({ ..., emisorCif })`, TypeScript rechaza la asignación con error: "Type 'string | undefined' is not assignable to type 'string'".

**Error:** Se pasaron los campos opcionales desestructurados directamente como propiedades del objeto argumento. Con `exactOptionalPropertyTypes: true`, pasar `undefined` explícitamente a un campo `?: string` es un error de tipo — la propiedad opcional debe estar _ausente_, no presente con valor `undefined`.

**Corrección de Guille:** (Identificada internamente al leer el error de TypeScript.)

**Causa raíz:** `exactOptionalPropertyTypes: true` distingue entre "propiedad ausente" y "propiedad con valor `undefined`". Son semánticamente distintos para este flag. Pasar `{ emisorCif: undefined }` es diferente a no pasar `emisorCif` en absoluto.

**Lección:** Con `exactOptionalPropertyTypes: true`, para pasar campos opcionales que pueden ser `undefined`, usar conditional spread:

```ts
...(val && { key: val })
// o para strings vacíos:
...(val !== undefined && { key: val })
```

Nunca `{ key: val }` donde `val` puede ser `undefined`.

**Acciones tomadas:**

- [x] Todos los campos opcionales en `handleDownloadPdf` usan conditional spread

**Tags:** #typescript #exactOptionalPropertyTypes #types #pattern

---

## 2026-05-22 — Este proyecto no usa Supabase CLI tracking: db push es no-op, las migraciones van por Dashboard

**Contexto:** Se creó un archivo de migración en `services/supabase/migrations/` y se intentó aplicarlo con `supabase db push`. El comando devolvió "Remote database is up to date" sin aplicar nada. `supabase migration list` mostró output vacío.

**Error:** Se asumió que el workflow de migraciones era el estándar de Supabase CLI (archivos `.sql` con naming `YYYYMMDD_descripcion.sql` + `supabase db push`). Se intentó varias veces y se ofreció aplicarla directamente, generando confusión.

**Corrección de Guille:** "hazla tu que se que puedes hacer la migración" (el usuario la aplicó manualmente vía SQL Editor del Dashboard).

**Causa raíz:** El proyecto nunca inicializó `supabase init`, por lo que no existe `config.toml`. Sin ese archivo, la CLI no rastrea qué migraciones están aplicadas y considera la BD siempre "al día". El directorio `migrations/` existe como historial documental, no como tracker de CLI.

**Lección:**

1. En este proyecto, **todas las migraciones se aplican manualmente** via Supabase Dashboard → SQL Editor.
2. El directorio `migrations/` es documentación histórica del schema, no un mecanismo de aplicación automática.
3. Ante una migración nueva: proporcionar el SQL al usuario + URL directa al SQL Editor (`https://supabase.com/dashboard/project/<project-id>/sql/new`). No intentar `db push`.

**Acciones tomadas:**

- [x] Documentado en `docs/ARQUITECTURA.md` la nota "Aplicadas manualmente vía Supabase Dashboard"

**Tags:** #supabase #migrations #cli #workflow

---

## 2026-05-22 — Facturas A4: min-height 297mm + flex column + spacer div para llenar la página completa

**Contexto:** La plantilla HTML de factura emitida generaba un PDF mucho más corto que una página A4, dejando espacio en blanco al final. La factura no llenaba la página aunque el CSS tenía `@page { size: A4 }`.

**Error:** Se usó solo `width: 210mm` sin establecer `min-height: 297mm`. El contenido dictaba la altura del elemento en lugar de la página dictar el espacio disponible.

**Causa raíz:** Un elemento HTML por defecto tiene la altura de su contenido. Para que una factura con pocas líneas ocupe una página A4 completa, se necesita forzar la altura mínima y empujar el footer al fondo.

**Lección:** Patrón definitivo para generar documentos A4 como HTML:

```css
.page {
  min-height: 297mm;
  display: flex;
  flex-direction: column;
}
.page-spacer {
  flex: 1;
  min-height: 40px;
}
@media print {
  @page {
    size: A4;
    margin: 0;
  }
  .page {
    min-height: 297mm;
  }
}
```

Colocar `<div class="page-spacer"></div>` entre el contenido central y el footer. El spacer absorbe el espacio sobrante y el footer queda siempre al pie de la página.

**Acciones tomadas:**

- [x] Implementado en `FacturaEmitidaEditor.tsx` tanto en el HTML generado como en el preview React

**Tags:** #pdf #html #a4 #css #facturas #print

---

## 2026-05-22 — Logo en document.write() requiere URL absoluta: window.location.origin + '/logo.png'

**Contexto:** La factura generada con `document.write()` en una ventana popup en blanco no mostraba el logo de Alsari Capital. La imagen cargaba correctamente en el preview React pero no en el PDF.

**Error:** Se usó `src="/logo.png"` (ruta relativa) en el HTML generado. Las ventanas popup en blanco (`window.open()` sin URL) tienen `about:blank` como origen, por lo que las rutas relativas no resuelven al servidor del host.

**Causa raíz:** `about:blank` no tiene base URL de red. Una imagen con `src="/logo.png"` en ese contexto intenta cargar `about:///logo.png`, que no existe.

**Lección:** En HTML generado para `document.write()` en ventanas popup:

- Siempre construir URLs absolutas: `window.location.origin + '/logo.png'`
- Añadir `onerror="this.style.display='none'"` como fallback silencioso
- Este patrón aplica a cualquier asset (imágenes, fuentes, CSS externo) dentro de `document.write()`

**Acciones tomadas:**

- [x] `handleDownloadPdf` pasa `logoUrl: \`\${window.location.origin}/logo.png\``a`buildInvoiceHtml`

**Tags:** #pdf #html #logo #url #document-write #popup

---

## 2026-05-22 — Datos de configuración de empresa van en sección "CONFIGURACIÓN" separada en el sidebar

**Contexto:** Se necesitaba un lugar lógico en la UI para gestionar los datos legales de las sociedades (CIF, domicilio, cuentas bancarias). Opciones consideradas: tab dentro de otra vista, modal desde la factura emisora, nueva vista en la sección principal del sidebar.

**Error:** (No hubo error de implementación — fue una decisión de diseño consultada explícitamente.)

**Corrección de Guille:** "perfecto" al proponer una sección "CONFIGURACIÓN" separada en el sidebar.

**Causa raíz:** Los datos de configuración de empresa tienen un ciclo de vida distinto al trabajo operativo diario: se configuran una vez y rara vez se tocan. Mezclarlos en la navegación operativa crea ruido y confusión.

**Lección:** Para datos de configuración que son prerequisito del módulo pero no parte del workflow diario (empresa, cuentas bancarias, plantillas), usar una **sección "CONFIGURACIÓN" separada al fondo del sidebar**. Es el mismo patrón de Holded, Sage y Xero. Esta separación comunica al usuario que son ajustes del sistema, no acciones recurrentes.

**Acciones tomadas:**

- [x] Sección "CONFIGURACIÓN" añadida al sidebar de Contabilidad con `Mis Empresas` como primer item

**Tags:** #ux #sidebar #navigation #design-patterns #contabilidad

---

## 2026-06-11 — El repo de migraciones y la BD remota divergen en silencio: auditar paridad antes de asumir que una feature funciona en producción

**Contexto:** Auditoría técnica del proyecto. Al intentar aplicar una migración de RLS sobre `proyecto_escenarios_financieros`, la tabla no existía en el remoto. Investigando, 5 migraciones de mayo/junio (`20260531000001`–`20260601000000`) nunca se habían aplicado: presupuesto maestro y escenarios financieros estaban rotos en producción sin que nadie lo notara. Además, `alsari_knowledge` (creada fuera del flujo de migraciones por el servicio Python) estaba sin RLS, exponiendo documentos confidenciales a la anon key pública.

**Error:** Asumir que un archivo en `services/supabase/migrations/` implica que el schema remoto lo refleja. Como las migraciones se aplican a mano (sin tracking de CLI), no hay nada que garantice la paridad ni avise del desfase.

**Corrección de Guille:** (Detectada internamente durante la auditoría aprobada por Guille.)

**Causa raíz:** El flujo manual de migraciones no tiene verificación. Un archivo commiteado y olvidado produce features que funcionan en dev contra suposiciones falsas y fallan en producción con errores opacos (42P01, 42703, PGRST204). Las tablas creadas por servicios externos (Python) ni siquiera pasan por el directorio de migraciones.

**Lección:**

1. Ante cualquier error 42P01/42703/PGRST204/23514 en producción, lo primero es comparar el schema remoto contra `services/supabase/migrations/` — ya van 3 incidentes con esta causa (préstamo 06-10, campos fondo 06-11, lote escenarios 06-11).
2. Auditoría rápida de paridad: `npx supabase db query "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'" --linked` y probes de `information_schema.columns` para columnas críticas.
3. El comando que funciona en este entorno es `npx supabase db query --linked --file <ruta>` (el pipe de PowerShell corrompe el SQL con BOM; el redirect `<` no existe en PowerShell).
4. Toda tabla creada fuera del flujo (servicios Python, dashboard) necesita su migración de RLS retroactiva en el repo como documentación + aplicación.

**Acciones tomadas:**

- [x] Aplicadas las 5 migraciones pendientes + 2 de RLS al remoto
- [x] Verificado: 0 tablas sin RLS en `public`
- [x] Documentado en `docs/CHANGELOG.md`

**Tags:** #supabase #migrations #rls #produccion #drift #workflow

<!--

Plantilla para copiar:

## YYYY-MM-DD HH:MM — [Título corto]

**Contexto:** ...

**Error:** ...

**Corrección de Guille:** ...

**Causa raíz:** ...

**Lección:** ...

**Acciones tomadas:**
- [ ] ...
- [ ] ...

**Tags:** #tag1 #tag2

---

-->

---

## 2026-06-12 — Afirmar cómo funciona el sistema sin verificarlo en el código

**Contexto:** Guille preguntó de dónde se nutren los datos de sociedades en el módulo financiero y cómo se actualizan.

**Error:** Afirmé que los KPIs de `kpis_sociedades` eran "foto manual" que nadie actualiza automáticamente, sin haber comprobado el código de los importadores.

**Corrección de Guille:** "en principio creo que se actualizaba a partir de insertar un balance de sumas y saldos de esa sociedad" — y tenía razón: `uploadSumasSaldos` deriva los KPIs del balance y los upserta en `kpis_sociedades` automáticamente.

**Causa raíz:** Respondí desde el modelo mental construido en la sesión (acababa de revisar el CRUD manual de maestroImport) en vez de verificar el flujo completo. Generalicé "lo que vi" a "lo que hay".

**Lección:** Antes de afirmar cómo funciona un flujo de datos del sistema, grep/leer el código que lo implementa — especialmente cuando la respuesta es para Guille, que toma decisiones operativas con ella. Si no se ha verificado, decir "creo que" y comprobarlo en el momento.

**Acciones tomadas:**

- [x] Verificado el flujo real en `sumasSaldosImport.ts` y corregida la respuesta
- [x] Lección registrada

**Tags:** #verificacion #flujo-datos #kpis #sumas-saldos

---

## 2026-06-15 — Fórmula de "deuda de socios" incompleta (faltaba largo plazo)

**Contexto:** Guille subió el sumas y saldos de Perisur y el KPI "Deuda de socios" daba 31 € cuando debía dar ~1,71 M.

**Error:** El cálculo (`deriveKpis` en `sumasSaldosParser.ts`) sumaba solo 550-553 + 555 (cuentas de socios a CORTO plazo). El grueso de la deuda de socios de Alsari está a LARGO plazo en la 171 (préstamos de socios: Iván, Javier, Maygar) y en el subgrupo 16 (partes vinculadas), que no se miraban. Además colaba la 555 (partidas pendientes de aplicación), que no es deuda de socios y metía 31 € de ruido de un apunte de CaixaBank.

**Causa raíz:** La fórmula se diseñó pensando solo en cuentas corrientes con socios (CP) y no en préstamos de socios capitalizados a LP, que es la práctica real del holding. En Alsari las "partes vinculadas" (p.ej. Construcciones Maygar) también son socios.

**Lección:** Los KPIs derivados del PGC hay que validarlos contra los datos reales de varias sociedades, no solo contra la teoría del plan contable. Antes de definir/corregir una fórmula de KPalfa, censar qué cuentas usa de verdad el holding (`SELECT substring(cuenta,1,4), sum(...) GROUP BY`) para no dejar fuera las cuentas donde está el dinero. La 171 en Alsari = préstamos de socios, no deuda genérica.

**Acciones tomadas:**

- [x] `deriveKpis`: deuda_socios = 550-553 + subgrupo 16 + 171; quitada la 555
- [x] Migración `202606151600` recalcula el caché `kpis_sociedades.deuda_socios` desde el último balance de cada sociedad
- [x] Verificado: Perisur 31 € → 1.708.934,60 €
- [x] Detectado aparte: Rialsa (S-006) tiene un valor negativo heredado del Excel antiguo (no tiene S&S subido)

**Tags:** #kpis #contabilidad #pgc #deuda-socios #sumas-saldos

---

## 2026-07-04 — Escribir governance desde el traspaso sin estudiar el contenido real de las ramas

**Contexto:** Macro-tarea de governance de Antifrágil OS (PR #7): crear tracker maestro, workstreams y orden de integración. El repo tenía 12+ ramas activas en worktrees, incluida `docs/integration-master-plan` (plan completo del "Chat 4" con orden de PRs, matriz de conflictos, riesgos R1-R11 y decision log D1-D11).

**Error:** Redacté el tracker, los workstreams y el orden de integración basándome en el traspaso del chat y en los MENSAJES de commit de las ramas, sin leer su CONTENIDO. Resultado: el tracker decía "fusionar o descartar" el spike de reservas (en realidad es ancestro común de reservas y demo → se archiva), proponía "push + PR" para la rama de auditoría (en realidad está subsumida byte a byte → se archiva sin merge), describía la integración de Demo como "re-montar sobre Reservas" (el plan real la parte en 4 PRs concretos 5a-5d), colocaba el rebrand visible "después de Reservas/Demo" (el plan lo pone antes, por aislado), e ignoraba el riesgo de seguridad R5 (anon key legacy hardcodeada, rotación pendiente).

**Corrección de Guille:** "deberias tener muy bien estudiado lo que ya hay".

**Causa raíz:** Misma familia que la lección 2026-06-12 (afirmar sin verificar), a escala de proyecto: tratar los títulos de commit y el traspaso como si fueran el contenido. En un repo multi-agente (varios "chats" trabajando en paralelo), cada rama contiene decisiones y planes que NO están en ninguna conversación individual: el repo es la memoria compartida, y hay que leerlo.

**Lección:** Antes de escribir documentación de governance/estado (tracker, workstreams, órdenes de integración) sobre un repo con trabajo de otros agentes/sesiones: (1) listar TODAS las ramas y sus diffs (`git diff --stat main..rama`), (2) LEER los documentos que esas ramas aportan (`git show rama:ruta`), especialmente cualquier plan/decision-log previo, y (3) citar la fuente (rama y doc) en lo que se escriba. Si ya existe un plan (como el del Chat 4), el documento nuevo lo RESUME y REFERENCIA; no lo reinventa de memoria. Corolario demostrado en la misma sesión: los estados caducan en horas (los PRs #4-#6 nacieron en paralelo mientras escribía el tracker) — verificar contra `origin`/`gh` justo antes de publicar, no al principio de la sesión.

**Acciones tomadas:**

- [x] Estudiadas las 9 ramas de trabajo (integration plan completo, baseline + A1, QA, finanzas 00-06, clínica, rebrand, demo, reservas)
- [x] Corregidos tracker, workstreams, integration-order y SESSION.md con el contenido real (spike=archivar, audit=subsumida, demo partido 5a-5d, clínica solo-tipos, rebrand visible temprano)
- [x] Elevado a Guille el riesgo R5 (rotación de anon key legacy pendiente)
- [x] Re-sincronizado el tracker tras la revisión de PR #7 con los HEADs exactos (#4 `27f6392`, #5 `b9860bb`, #6 `2ebe938`)

**Tags:** #verificacion #governance #integracion #worktrees #multi-agente

---

## 2026-07-05 — Descartar un diff real como "ruido CRLF" y mergear un doc sin formatear

**Contexto:** Integración masiva de PRs (sesión Claude Master). Tras formatear `docs/host/02-reservas-canonical-integration.md` con Prettier en el worktree del PR #28, `git status` mostraba el archivo como modificado. En Windows con `core.autocrlf=true` casi todos los "modified" tras Prettier son ruido de finales de línea, así que asumí que este también lo era y pusheé sin commitear el cambio.

**Error:** El diff era REAL (re-alineado de tablas markdown, no finales de línea). El PR #28 se mergeó con el doc sin formatear y el gate `format:check` de main pasó a fallar para TODOS los PRs siguientes (5 ramas de finanzas en rojo de golpe).

**Causa raíz:** Generalizar un patrón ("en esta máquina los M tras prettier son CRLF") sin verificar el caso concreto. La verificación costaba 2 segundos: `git diff <archivo>` distingue ruido eol (diff vacío o solo ^M) de cambios de contenido.

**Lección:** En Windows con `autocrlf=true`, antes de descartar un archivo "modified" tras una pasada de formateo: `git diff -- <archivo>`. Si el diff muestra contenido (tablas, espacios, texto), se commitea; solo se descarta si el diff real es vacío. Regla complementaria: el veredicto de formato lo da `git add` + `git diff --cached` (git normaliza eol al indexar), nunca el working tree.

**Acciones tomadas:**

- [x] PR de fix inmediato con el doc formateado (`fix/format-doc-host-reservas`)
- [x] Verificado que el resto de docs mergeados hoy pasan `format:check` en CI
- [x] Lección registrada antes de continuar la integración

**Tags:** #windows #crlf #prettier #format-gate #verificacion

## 2026-07-18 — Orden y diseño pensado ANTES de acumular features

**Contexto:** sprint de conexión a datos reales (Salonized + histórico). Se
encadenaron mejoras sueltas a buen ritmo (filtros, cobros, clientes) y Guille
tuvo que señalar dos veces problemas de coherencia: un aviso que listaba 277
nombres, un filtro con 29 botones, y "Añadir datos" perdido dentro de Tesorería.

**Corrección de Guille:** "te he pedido orden y que cada cosa esté bien pensada
y organizada para facilitar su uso" — y antes: "las cuentas tienen que tener
sentido" y "revisa todo antes de decirme que está".

**Causa raíz:** entregar función a función sin re-evaluar el CONJUNTO cada vez
que cambia la escala de los datos (3 servicios mock → 29 reales; 12 citas demo
→ 5.700 reales) ni la arquitectura de información (dónde vive cada tarea).

**Regla a aplicar:** (1) tras cada cambio de escala de datos, pasar revista a
TODAS las vistas afectadas antes de dar nada por hecho; (2) los cambios de
estructura (navegación, qué página hace qué) se proponen organizados y se
validan con Guille antes de codificar; (3) ningún aviso/lista sin límite;
(4) todo KPI debe poder explicarse con una frase que cuadre con la realidad
del negocio.
