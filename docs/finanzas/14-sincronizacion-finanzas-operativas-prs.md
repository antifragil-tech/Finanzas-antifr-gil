# Sincronización — Finanzas operativas: mapa maestro de PRs (2026-07-05)

> **Estado:** Documental. **Sin código, sin SQL aplicado, sin Supabase real, sin datos reales ni clínicos.**
> **Rama:** `docs/finanzas-sync-prs-operativos`
> **Propósito:** mapa maestro de todos los PRs financieros vivos y cómo encajan. Actualiza y amplía el `07-sincronizacion-prs-y-modelo-operativo.md` (PR #11, foto de 2026-07-04): el 07 sincronizaba los docs 00-06 con los PRs #1 y #4; este 14 añade toda la serie FOP nacida el 2026-07-05 (#13, #15, #19, #20, #21, #22). Cuando el PR #11 se mergee, el 07 debe apuntar a este doc como continuación (no se edita aquí para no tocar su rama).

---

## 1. Tabla de PRs financieros vivos

| PR | Rama | Doc | Qué resuelve | Estado |
|---|---|---|---|---|
| **#1** Facturación emitida | `docs/finanzas-facturacion-emitida-design` | 02 | Diseño de factura operativa/precontable; decisiones D1 (OS no emite factura legal) y D2 (Clínica sin IVA provisional) | Draft |
| **#4** Tesorería/Caja A1 | `chore/db-baseline-antifragil-os` | 06 + SQL baseline | Cuentas caja/banco, ledger de efectivo, arqueo | Draft / **NO APPLY** |
| **#11** Modelo financiero | `docs/finanzas-modelo-operativo` | 00-01, 03-07 | Marco: tres lentes, backlog F-Op A/B/C/D, decisiones D-op-1..7 | Draft |
| **#13** FOP-B1 Liquidaciones | `docs/finanzas-liquidaciones-equipo` | 08 | Coste de personas: nóminas, compartidas, autónomos por sesión, ciclo de liquidación | Draft |
| **#15** FOP-B2 Rentabilidad | `docs/finanzas-rentabilidad-operativa` | 09 | Escalera M1-M4, dimensiones centro/canal, vistas devengo/caja | Draft |
| **#19** FOP-B3 Bonos/devengo | `docs/finanzas-bonos-programas-devengo` | 10 | Ciclo de bonos/programas, devengo sesión a sesión, caducidades, devoluciones. Resuelve B2-P1 | Draft |
| **#20** FOP-A2 CxC/CxP | `docs/finanzas-fop-a2-cxc-cxp` | 11 | Pendientes de cobro/pago con seguimiento, reclamaciones, parciales, aging | Draft |
| **#21** FOP-C1 Imputación | `docs/finanzas-fop-c1-imputacion-costes` | 12 | Reglas de imputación versionadas, costes compartidos, cascada de prioridad, no-inventar | Draft |
| **#22** FOP-D1 Forecast | `docs/finanzas-fop-d1-ingreso-real-presupuesto` | 13 | Previsto vs devengado/cobrado, desviaciones, forecast con banda | Draft |

Todos son **archivos nuevos e independientes** (un doc por PR, sin archivos compartidos): no hay conflictos de merge entre ellos ni con #11. Se pueden mergear en cualquier orden técnico; el orden conceptual (§2) es para leerlos, no para Git.

## 2. Orden conceptual (cómo se leen)

```text
#11 MARCO (tres lentes, backlog, decisiones)
 ├─ #1  INGRESO documental (factura operativa; el papel)
 ├─ #4  TESORERÍA (caja/banco/arqueo; el dinero) ── NO APPLY
 ├─ #13 COSTE de personas (FOP-B1; qué nos cuesta el equipo)
 ├─ #19 DEVENGO de ingreso (FOP-B3; cuándo el cobro se convierte en ingreso)
 ├─ #15 RENTABILIDAD (FOP-B2; margen = devengo #19 − coste #13, dimensiones)
 ├─ #20 PENDIENTES (FOP-A2; lo que falta por cobrar/pagar)
 ├─ #21 IMPUTACIÓN (FOP-C1; cómo llegan los costes no directos a M3)
 └─ #22 FORECAST (FOP-D1; previsto vs real, encima de todo lo anterior)
```

El triángulo central es **#13 + #19 → #15** (coste + ingreso devengado → margen). #20/#21/#22 completan el sistema: pendientes, repartos y control presupuestario.

## 3. Dependencias de implementación futura (nada de esto bloquea el merge de docs)

- **Reservas (PR #5, versión canónica D7):** fuente de sesiones/citas para B1/B3/B2/D1. Sin agenda no hay margen por sesión ni forecast fino.
- **Backend/Supabase:** baseline del PR #4 y A2 clínica del PR #12, ambos **NO APPLY**; ninguna implementación FOP abre SQL sin autorización expresa.
- **Roles/permisos:** las matrices por rol de los docs 08-13 necesitan el sistema de roles real (hoy heredado y hardcodeado — deuda conocida del doc 02 §2.2).
- **Gestoría/fiscalidad externa:** exención sanitaria (F4-C), caducidad de bonos (B3-P1), retenciones — criterio externo, no técnico.
- **Datos reales fuera del repo:** saldos legacy, acuerdos con partners e importes reales entran por la app cuando exista, jamás por Git.

## 4. Decisiones ya cerradas (ningún doc nuevo las reabre)

1. **OS precontable** — no emite factura legal oficial; Veri\*factu delegado (D1/F4-D, doc 02).
2. **Factura operativa ≠ factura legal** (doc 02).
3. **Caja ≠ rentabilidad** — tres lentes separadas (D-op-1).
4. **Ingreso cobrado ≠ devengado** — el devengo manda en cumplimiento y margen (D-op-2, docs 10/13).
5. **Coste pagado ≠ devengado** — coste al mes de la sesión (D-op-2, doc 08).
6. **Banco ≠ medio de pago** — caja/banco son cuentas; el medio es otra dimensión (A1-D6).
7. **Sin datos clínicos** en capas financieras — cliente como id/seudónimo (D-op-5).
8. **Sin Supabase real / sin SQL aplicado** — todo NO APPLY hasta autorización.
9. **Contribución antes de prorrateo** (D-op-7; confirmación formal pendiente en C1-P8).

## 5. Huecos pendientes (consolidado de todas las series)

| Bloque | Pendientes |
|---|---|
| Roles/permisos detallados | Matrices diseñadas en 08-13; falta el modelo real de roles y su implementación |
| Acuerdos de partners | Lidomare, Vivofácil, Oasis (B2-P3 = C1-P1..P3): sin documento no hay regla de imputación ni vencimientos de partner |
| Reglas de no-show | ¿Consume/devenga? ¿cobra el profesional? (B3-P2, B3-P6, B2-P4) |
| Caducidad de bonos | Criterio fiscal de la gestoría (B3-P1) |
| Devolución parcial | Penalización sí/no (B3-P3) |
| Branch protection / CI | PR #14 (quitar auto-merge) y PR #18 (quality gates + doc de protección) — fuera de finanzas, pero condicionan cualquier merge |
| Implementación | Toda la serie FOP es diseño; ninguna fase abre código sin validación |

## 6. Roadmap de implementación futura (propuesta, no calendario)

| Fase | Qué | Se apoya en |
|---|---|---|
| 0 | Docs mergeados + decisiones pendientes resueltas | este mapa, §7 |
| 1 | Host shell y navegación | PR #16 y split plan #17 |
| 2 | Reservas/citas (agenda operativa) | PR #5 canónico |
| 3 | Cobros y facturación operativa | doc 02 (F4.x por sub-fases) |
| 4 | Bonos/devengo | doc 10 |
| 5 | Liquidaciones | doc 08 |
| 6 | CxC/CxP | doc 11 |
| 7 | Rentabilidad | doc 09 (necesita 4+5) |
| 8 | Forecast | doc 13 (necesita 6+7) |
| 9 | Backend/Supabase real controlado | baseline #4 aprobado y aplicado con autorización expresa |

Cada fase con código exige su propio diseño de implementación validado (regla del backlog); este roadmap ordena, no autoriza.

## 7. Checklist para pasar de docs a implementación

- [ ] PRs de docs financieros mergeados (tras la tanda de governance/QA).
- [ ] CI **sin auto-merge** (PR #14 mergeado) y quality gates saneados (PR #18).
- [ ] Branch protection activa en `main` (doc `governance/05`, configuración manual en GitHub).
- [ ] Roles y permisos definidos (quién es CEO/coordinación/recepción/profesional en el sistema real).
- [ ] Frontera clínica verificada: ningún dato clínico en capas financieras (docs/compliance).
- [ ] Baseline Supabase aprobado; **ningún SQL se aplica sin autorización expresa** por fase.
- [ ] Decisiones de negocio pendientes resueltas o explícitamente aplazadas (§5).
- [ ] Implementación **pantalla por pantalla**, cada una con su diseño validado.

---

*Documento de sincronización. No modifica código productivo, SQL, tipos ni UI. Refleja el estado de los PRs a 2026-07-05. Sucesor operativo del doc 07 para la serie FOP.*
