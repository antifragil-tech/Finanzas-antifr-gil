# Changelog — Módulo `financiero`

Cambios relevantes del módulo. Formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [Unreleased]

### Added

- (Vacío)

---

## [0.1.0] — 2026-05-16

### Added

- Migración completa del dashboard financiero standalone al monorepo (Fase 1).
- 5 vistas: Overview (KPIs + cartera), CorporateMap (SVG interactivo),
  ProjectView (detalle + Recharts), Contabilidad (libro mayor), WorkspaceView.
- Modo privado (`isPrivateMode`) para ocultar importes reales.
- Integración con `@alsari/ui`, `@alsari/utils`, `@alsari/types`.
- `/// <reference types="vite/client" />` para compatibilidad con el host.
- `import.meta.env?.['VITE_API_URL']` con optional chaining (fix runtime en host).
- `FinancialSidebar` con `fixed left-16 top-0` para respetar el rail del OSSidebar.
