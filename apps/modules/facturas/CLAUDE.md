# CLAUDE.md — Módulo `facturas`

> ## 🗄️ ARCHIVADO — NO TRABAJAR AQUÍ
>
> Este módulo está **archivado y desconectado del host**. El **módulo vivo** de
> facturas/contabilidad es **`apps/modules/contabilidad`** (`@alsari/contabilidad`):
> Supabase + Edge Function `procesar-factura` (OCR) + workflow de aprobación
> (`borrador_ocr → revision_javi → pendiente_pago → pagada`, `rechazada`).
>
> Si te piden tocar facturas, ve a `apps/modules/contabilidad`. No edites este módulo
> salvo para retirarlo. La ruta `/facturas` redirige a `/contabilidad`.

> Punto de entrada para Claude Code cuando trabaja **dentro de este módulo**.
> Las reglas globales de `../../../CLAUDE.md` y `../../../.claude/docs/ways-of-working/`
> aplican siempre y prevalecen. Aquí van solo las especificidades locales.

---

## 🎯 Qué hace este módulo

Gestión y seguimiento del ciclo de vida de facturas del holding Alsari Capital.
Permite visualizar todas las facturas, filtrarlas por estado y texto libre, consultar
el detalle de cada una (importe, proveedor, proyecto, documento adjunto) y hacer
seguimiento del flujo de aprobación interno.

---

## 📚 Orden de lectura al trabajar en este módulo

1. `CLAUDE.md` raíz del proyecto.
2. `.claude/docs/ways-of-working/00-rol-y-autoridad.md`.
3. **Este archivo.**
4. `ARQUITECTURA.md` (de este módulo).
5. `../../.claude/skills/lessons-learned/log.md` (lecciones globales — CRÍTICO).

---

## 🏗️ Arquitectura local

```
src/
├── App.tsx    # Todo en un único componente: fetch + filtros + tabla + detalle
├── main.tsx
├── index.ts   # export { FacturasApp }
└── styles.css
```

Módulo simple de una sola vista. No tiene sub-navegación ni componentes separados.
Si crece, extraer tabla y panel de detalle a `components/`.

---

## 🔐 Datos y permisos

Datos: CF Worker en `localhost:8787` (dev) / Cloudflare Workers (prod).
Endpoint: `GET /api/invoices` — devuelve `{ success: boolean, data: Invoice[] }`.
No usa Supabase para datos (Fase 2+).

---

## 🚀 Comandos del módulo

```bash
# Desde la raíz del monorepo
pnpm --filter @alsari/facturas dev     # Puerto 5176
pnpm --filter @alsari/facturas build
pnpm --filter @alsari/facturas type-check
```

---

## ⚠️ Particularidades técnicas

- `import.meta.env?.['VITE_API_URL']` — usar siempre optional chaining.
- El endpoint es `/api/invoices`, no `/api/facturas`. El CF Worker lo expone así.
- Los estados de factura (`InvoiceStatus`) están tipados en `@alsari/types`.
  Orden del flujo: `pending` → `en_propiedad` → `en_finanzas` → `paid` → `paid_archived`.
  `rejected` puede ocurrir en cualquier punto.
