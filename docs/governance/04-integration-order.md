# 04 — Orden de integración · Antifrágil OS

> En qué orden convergen las líneas de trabajo a `main` y **por qué**. Este orden existe para
> que ningún merge rompa a otro y para no hacer dos veces el mismo trabajo de integración.
> Formaliza la matriz de integración del "Chat 4" (`docs/integration-master-plan`).

---

## El orden

```
1. Docs / Governance          (este PR — contexto, proceso, compliance)
2. Reservas canónico          (el módulo real de agenda, F1)
3. Demo sobre Reservas        (el cascarón se re-monta sobre el módulo real)
4. Baseline / A1              (PR técnico de DB, separado — sin aplicar SQL)
5. QA                         (smoke suite + checklists como red transversal)
6. Infraestructura Supabase   (futuro: crear proyecto nuevo + cliente nuevo)
7. Rebranding                 (futuro: @alsari/* → namespace propio, al final)
```

Regla general: **primero lo que define cómo trabajamos (1), luego el producto real (2-3),
luego la base técnica (4-5), y al final lo transversal-cosmético (6-7).**

---

## Justificaciones

### Por qué Reservas va ANTES que Demo

- **Reservas es el módulo canónico** (producto real); Demo es un cascarón de presentación con
  rutas y datos mock.
- Si Demo se integra primero, **fija contratos falsos** (rutas, shape del contexto global,
  supuestos de datos) a los que Reservas tendría que amoldarse después → doble trabajo de
  integración y throwaway code.
- Integrando Reservas primero, Demo se **re-monta encima del módulo real**: donde exista módulo
  canónico, el mock se sustituye; donde no, el mock se mantiene como preview honesto.
- Evita además duplicar dependencias (DayPilot y demás entran una sola vez, desde el módulo real,
  con un solo cambio de lockfile).

### Por qué Demo NO se mergea tal cual

- Contiene **Demo Mode, datos ficticios y rutas mock** pensados para enseñar la visión, no para
  producción. Mergearlo tal cual metería un "producto falso" en `main`.
- Su PR (#3) está marcado **DRAFT / NO MERGE** a propósito.
- Lo aprovechable (DemoShell → shell del OS, contexto global Sociedad/Proyecto/Rol/Periodo) se
  extraerá en **PRs quirúrgicos** después de que Reservas esté integrado, comparando contra el
  módulo real.

### Cómo tratar `pnpm-lock.yaml`

- El lockfile **nunca se resuelve a mano** en un conflicto: se toma el `package.json` resultante
  del merge y se **regenera** con `pnpm install`.
- Un PR cuyo lockfile cambia **sin** cambio en algún `package.json` es sospechoso: regenerar y
  justificar, o revertir el lockfile.
- Motivo: el lockfile es un artefacto derivado con hashes; una resolución manual "que compila"
  puede fijar versiones fantasma o corromper el grafo de dependencias del monorepo entero,
  y el error aparece semanas después en el peor momento.

### Por qué NO tocar `packages/supabase-client`

- Hoy ese paquete **apunta al Supabase legacy de Alsari** y lo consumen los módulos heredados
  (financiero, contabilidad, presupuestos). Tocarlo ahora puede **romper todo lo heredado a la vez**
  (es el punto único de acceso a datos).
- La decisión firme es crear un **Supabase nuevo** para Antifrágil OS. El cliente para ese
  proyecto nuevo se diseñará en la fase de infraestructura (paso 6) — probablemente como paquete
  nuevo, no como mutación del actual — y la transición será **un PR técnico dedicado**, con QA.
- Mientras tanto: los módulos nuevos (Reservas, Demo) trabajan **sin backend** precisamente para
  no depender de este paquete.

### Por qué el Baseline va como PR técnico separado (paso 4)

- Mezclar SQL fundacional con PRs de producto hace ambos irrevisables.
- El baseline se revisa con otros ojos (modelo de datos, RLS, hardening, runbook) y con la
  lección aprendida del legacy: **el drift repo↔BD es el riesgo técnico nº1** — por eso el
  runbook de aplicación es parte del entregable, y la aplicación real del SQL es un acto
  posterior, autorizado y verificado.

### Por qué el Rebranding va AL FINAL (paso 7)

- El rebrand global (`@alsari/*` → namespace propio, `window.alsariToken`, nombres de paquete,
  lockfile) toca **cientos de archivos transversalmente** (355 ocurrencias medidas en 122 archivos).
- Hacerlo con ramas grandes abiertas (Reservas, Demo, Baseline) generaría **conflictos masivos**
  en todas ellas.
- La **marca visible** (strings "Alsari Capital" en UI/PDF) sí puede ir antes, como rama pequeña
  (`chore/financiero-copy-antifragil`), integrada tras Reservas/Demo para no chocar con ellas.

---

## Matriz de dependencias

| PR / Línea | Depende de | Bloquea a |
|---|---|---|
| Governance (este) | — | Es prerequisito de proceso para todos |
| Reservas F1 | Governance (proceso) | Demo, Reservas F2, Rebrand visible |
| Demo | Reservas integrado | Extracción del shell del OS |
| Baseline/A1 | Governance | Infraestructura Supabase, todo backend real |
| QA | Governance | Marca el "Ready" de los demás |
| Infra Supabase (futuro) | Baseline mergeado + decisión de Guille | Backend real de todos los módulos |
| Rebrand global (futuro) | Todo lo anterior integrado | — |
