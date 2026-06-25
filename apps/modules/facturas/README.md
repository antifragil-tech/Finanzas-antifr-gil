# Módulo `facturas` — @alsari/facturas

> ## 🗄️ ARCHIVADO — NO USAR
>
> Este módulo (Fase 1, CF Worker, lista básica) está **archivado y desconectado**.
> Fue **absorbido por `apps/modules/contabilidad`** (`@alsari/contabilidad`), que es
> el **módulo vivo** de facturas/contabilidad (Supabase + OCR + workflow de aprobación).
>
> - La ruta `/facturas` del host **redirige** a `/contabilidad`.
> - El host ya **no depende** de `@alsari/facturas` (eliminado de `package.json` y
>   `transpilePackages` en el PR A de saneamiento).
> - No añadas funcionalidad aquí. Todo el trabajo de facturas va en `@alsari/contabilidad`.
> - Se mantiene en el repo por historial; pendiente de eventual eliminación.

---

## (Histórico) Responsabilidades originales

> El contenido siguiente es la documentación original del módulo Fase 1 y se
> conserva solo como referencia histórica.

---

## 🎯 Responsabilidades

- Lista de todas las facturas con búsqueda por texto libre (proveedor, proyecto, ID).
- Filtro por estado: pending, en_propiedad, en_finanzas, paid, paid_archived, rejected.
- KPIs: total facturas, pendientes de revisión (con importe), pagadas, importe total.
- Panel de detalle por factura (importe, fecha, proveedor, proyecto, link a documento).
- Indicación del motivo de rechazo cuando aplica.

---

## 🛠️ Stack

- Vite 5 + React 19 + TypeScript estricto
- Tailwind CSS + `@alsari/ui`
- `@alsari/types` (`Invoice`, `InvoiceStatus`) + `@alsari/utils` (`formatCurrency`)
- CF Worker como backend de datos

---

## 🚀 Desarrollo

```bash
# Desde la raíz del monorepo
pnpm install
pnpm --filter @alsari/facturas dev      # Levanta en :5176
```

---

## 📂 Estructura

```
src/
├── App.tsx         # Todo el módulo: fetch + filtros + tabla + detalle inline
├── main.tsx
├── index.ts        # export { FacturasApp }
└── styles.css
```

---

## 📚 Documentación

- `CLAUDE.md` — Contexto para Claude Code.
- `ARQUITECTURA.md` — Decisiones técnicas de este módulo.
- `CHANGELOG.md` — Historial.
- `ways-of-working-local/` — Reglas específicas del módulo.
