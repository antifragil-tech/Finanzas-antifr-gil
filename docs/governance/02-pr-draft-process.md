# 02 — Proceso estándar de PR Draft · Antifrágil OS

> Todo cambio entra en `main` por este proceso. Sin excepciones. El proceso protege tres cosas:
> `main` siempre estable, cero datos sensibles en GitHub, y decisiones de merge siempre en
> manos de Guille.

---

## El flujo (7 pasos)

```
1. TRABAJAR LOCAL     → en el worktree de la rama (nunca en main)
2. COMMIT             → semántico: feat|fix|chore|docs|refactor|test(scope): descripción
3. PUSH DE RAMA       → git push -u origin <rama>
4. CREAR PR **DRAFT** → con la plantilla (.github/PULL_REQUEST_TEMPLATE.md)
5. REVISIÓN           → contra 03-review-checklist.md
6. QA                 → smoke routes + checklist del tipo de PR
7. MERGE              → SOLO con autorización explícita de Guille
```

### 1. Trabajar local

- Cada rama vive en su **worktree aislado** (`git worktree add ../wt-<nombre> -b <rama> main`).
- La rama nace de `main` salvo dependencia explícita documentada en el tracker.
- Nombres de rama: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `qa/*`, `demo/*`.

### 2. Commit

- Commits semánticos, en español, descripción concreta.
- Commits pequeños y temáticos: un commit no mezcla governance con código.

### 3. Push

```bash
git push -u origin <rama>
```

### 4. PR Draft

- **Todo PR nace Draft.** Draft significa "visible para revisar, prohibido mergear".
- Título: `tipo(scope): descripción` — si es intencionalmente no-mergeable, prefijo
  `DRAFT / NO MERGE —` (como PR #3).
- El body sigue la plantilla; las confirmaciones explícitas son obligatorias.

### 5. Revisión

- Contra [03-review-checklist.md](03-review-checklist.md), completa.
- El diff debe corresponder 1:1 con el alcance declarado en el body. Diff fuera de alcance
  → se recorta o se justifica, nunca se cuela.

### 6. QA

- Checks de la smoke suite (no destructivos) + checklist específica del tipo de PR
  (demo / reservas / baseline).

### 7. Merge

- **Solo Guille autoriza.** El agente/desarrollador propone; no ejecuta merge por su cuenta.
- Orden de merges: según [04-integration-order.md](04-integration-order.md).

---

## Reglas duras del proceso

| Regla                           | Detalle                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **PR Draft primero**            | Ningún PR nace "ready for review". Se marca ready tras pasar revisión + QA.                                                   |
| **Nada de `main`**              | Ni commits directos, ni push, ni "arreglitos rápidos".                                                                        |
| **Nada de rebase / force push** | La historia de las ramas compartidas no se reescribe. Si una rama se ensucia, se abre una limpia.                             |
| **Nada de SQL real**            | Ningún PR aplica SQL a ningún Supabase. El SQL viaja como archivos + runbook; la aplicación es un acto separado y autorizado. |
| **Nada de datos reales**        | Fixtures y mocks siempre sintéticos. Ni nombres reales de pacientes/clientes, ni CIFs, ni IBANs, ni emails personales.        |
| **Nada de historia clínica**    | Ver `docs/compliance/00`. Un campo clínico en un PR es motivo de rechazo inmediato.                                           |
| **Lockfile**                    | `pnpm-lock.yaml` nunca se edita ni se resuelve a mano: se regenera con `pnpm install`.                                        |
| **`packages/supabase-client`**  | Intocable hasta la fase de infraestructura del Supabase nuevo.                                                                |

---

## Estados de un PR

```
Draft ──(revisión + QA ok)──► Ready for review ──(autorización Guille)──► Merged
  │                                   │
  └──── NO MERGE (congelado a propósito, p.ej. Demo) ◄──────┘
```

- **Draft:** trabajo visible, no mergeable.
- **NO MERGE:** Draft permanente con propósito (esperando a otra línea); se indica en el título.
- **Ready:** pasó checklist + QA; espera decisión de Guille.
- **Merged:** con autorización explícita, en el orden de integración.
