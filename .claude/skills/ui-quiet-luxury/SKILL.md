---
name: ui-quiet-luxury
description: Sistema de diseño "Quiet Luxury" de Alsari Capital OS. Cárgalo antes de cualquier trabajo visual o de UI. Define paleta, tipografía, componentes, animaciones y patrones del Dark Mode ejecutivo del OS.
---

# UI Quiet Luxury — Alsari Capital OS

> Identidad visual operativa del OS. Detalle completo en
> `.claude/docs/ways-of-working/04-ui-ux.md`. Esto es la guía rápida.

---

## 🎯 Principios en 5 líneas

1. **Dark Mode permanente.** Negro casi puro (`zinc-950`) + crema (`#F5F0E1`) +
   acentos azul/verde/rojo solo con significado.
2. **Glassmorphism sutil.** `backdrop-blur` ligero + bordes `white/5`.
3. **Tipografía system fonts.** Limpia, contraste, sin recargo. El logo lleva el carácter.
4. **Animaciones ≤ 500ms con `ease-out`.** Discretas, no distractoras.
5. **Cero ruido visual.** Máxima información útil, mínima decoración.

---

## 🎨 Paleta (tokens)

> ⚙️ **Fuente única de verdad: `packages/config/tailwind-preset.js`.**
> Todos los tailwind.config del host y módulos consumen ese preset vía
> `presets: [alsariPreset]`. Nunca redefinir tokens en un config local.

La escala "zinc" del OS es **custom con tinte azul marino sutil** (decisión de
marca, más cálida que el zinc puro de Tailwind):

| Token | Valor real | Uso |
|-------|-----------|-----|
| `bg-zinc-950` | `#14141e` | Fondo principal |
| `bg-zinc-900` | `#1e1f2a` | Cards y paneles |
| `bg-zinc-800` | `#2a2b38` | Hovers |
| `text-zinc-100` | `#f4f4f5` | Texto principal |
| `text-zinc-400` | `#a1a1aa` | Texto secundario |
| `text-zinc-500` | `#71717a` | Hints, placeholders (mínimo para texto legible) |
| `border-white/5` | rgba blanco | Bordes glass-panel |
| `text-brand` / `bg-brand` | `#F5F0E1` | Crema marfil de marca (logo, CTA primario). Nunca hardcodear el hex |
| `bg-blue-500/30` | azul tenue | Selección de texto, info, acción |
| `text-emerald-500` | verde | Métricas positivas |
| `text-rose-500` | rosa/rojo | Métricas negativas / errores (en módulos se usa `rose`, no `red`) |
| `text-amber-500` | ámbar | Warnings |
| `text-violet-400` | violeta | Previsto / simulado / escenarios (único uso permitido) |

**Reglas:**
- Verde y rosa SOLO con significado numérico/estado. Nunca decorativos.
- `zinc-600` y más oscuros NUNCA como color de texto (contraste < 3:1) — solo decorativo.
- Máximo 2 acentos de color por componente.

---

## 📦 Componentes en `@alsari/ui`

Antes de escribir un panel/botón/modal a mano, comprobar si ya existe:
`KPICard`, `Button` (primary/secondary/ghost/danger), `Modal` (backdrop
`bg-black/60` + z-50 canónicos), `EmptyState`, `Skeleton`/`SkeletonCard`
(shimmer — preferirlos a spinners en cards y tablas), `Badge` (semántica de
color del OS).

---

## 🧊 Componentes esenciales

### Glass Panel
```css
.glass-panel {
  @apply bg-zinc-900/40 backdrop-blur-md border border-white/5 shadow-xl rounded-lg;
}
```

### Glass Header
```css
.glass-header {
  @apply bg-zinc-950/80 backdrop-blur-xl border-b border-white/5;
}
```

### Botones (3 niveles)

```tsx
// Primario (acción principal de la pantalla)
<button className="bg-zinc-100 text-zinc-950 hover:bg-zinc-200
                   px-4 py-2 rounded-md text-sm font-medium transition-colors">
  Acción principal
</button>

// Secundario
<button className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-white/10
                   px-4 py-2 rounded-md text-sm font-medium transition-colors">
  Acción secundaria
</button>

// Ghost (terciario)
<button className="text-zinc-400 hover:text-zinc-100 hover:bg-white/5
                   px-3 py-1.5 rounded-md text-sm transition-colors">
  Acción terciaria
</button>
```

### KPI Card
```tsx
<div className="glass-panel p-6">
  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
    Ingresos Q4
  </p>
  <p className="text-4xl font-light tracking-tight text-zinc-100">
    1.247.500 €
  </p>
  <p className="text-sm text-emerald-500 mt-2">↑ +12.4% vs Q3</p>
</div>
```

### Boot Screen (firma visual)
```tsx
<div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950">
  <img src="/logo.png" alt="Alsari Capital"
       className="h-24 w-auto animate-pulse mb-4 object-contain" />
  <p className="text-zinc-500 text-sm font-medium tracking-wider">
    NEURAL FINANCE V3.0
  </p>
</div>
```

---

## ✍️ Tipografía

**Fuente:** Geist Sans + Geist Mono (inyectadas por el host vía `next/font`,
variables `--font-geist-sans`/`--font-geist-mono` en el preset). El body lleva
`font-variant-numeric: tabular-nums` — todas las cifras alinean en columna.

**Escala:**
- `text-2xs` (10px) → micro-labels de sidebar/badges. **Mínimo absoluto** — prohibido `text-[8px]`/`text-[9px]` y cualquier tamaño arbitrario
- `text-xs` (12px) → labels, captions
- `text-sm` (14px) → texto secundario
- `text-base` (16px) → texto principal
- `text-xl` / `text-2xl` → títulos
- `text-3xl` / `text-4xl` → KPIs principales

**Pesos** (máximo `semibold` — `font-bold` y `font-black` están PROHIBIDOS):
- `font-light` (300) → números hero (la firma visual del OS: cifra grande y fina)
- `font-normal` (400) → texto base
- `font-medium` (500) → labels destacadas, botones, micro-caps
- `font-semibold` (600) → títulos

**Tracking:**
- `tracking-tight` → números grandes
- `tracking-wider` o `tracking-widest` → captions de marca en MAYÚSCULAS
  (ej. `"NEURAL FINANCE V3.0"`)

---

## 🎬 Animaciones (en `tailwind.config.js`)

```javascript
animation: {
  'fade-in': 'fadeIn 0.5s ease-out forwards',
  'fade-up': 'fadeUp 0.4s ease-out forwards',
  'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
  'shimmer': 'shimmer 2s linear infinite',
}
```

**Uso:**
- `animate-fade-in` → entrada de páginas, modales.
- `animate-fade-up` → cards en grids.
- `animate-pulse-subtle` → loading states (logo boot, skeletons).
- `animate-shimmer` → loading bars.

**Transiciones por defecto:** `transition-colors` o `transition-all` con `duration-200`.

---

## 📐 Espaciado

Sistema de 4px (Tailwind). Nunca valores custom.

| Contexto | Padding | Gap |
|----------|---------|-----|
| Card densa | `p-4` | `gap-3` |
| Card estándar | `p-6` | `gap-4` |
| Card relajada | `p-8` | `gap-6` |
| Sección | `py-12` | `gap-8` |

**Anchos:**
- Sidebar: `w-64` (256px)
- Main content: `max-w-7xl mx-auto`
- Modal: `max-w-lg`
- Forms: `max-w-md`

---

## 📦 Iconografía

**Librería única: Lucide React.** Stroke fino, consistente.

```tsx
import { Wallet, FileText, Briefcase } from 'lucide-react';
```

El trazo es **1.5 global** (regla `.lucide { stroke-width: 1.5; }` en los CSS
base) — no pasar `strokeWidth` por icono salvo excepción justificada.

**Tamaños:**
- `w-4 h-4` → inline en texto
- `w-5 h-5` → botones
- `w-6 h-6` → sidebar
- `w-8 h-8` → hero / estados vacíos

**Color base:** `text-zinc-400`. Activo: `text-zinc-100`.

---

## 🎯 Scrollbars custom

Ya en `index.css` (Webkit):

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #09090b; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
```

---

## ✅ Checklist antes de mergear UI

- [ ] Sin colores hex hardcodeados (usa tokens Tailwind).
- [ ] Tipografía dentro de la escala definida.
- [ ] Animaciones ≤ 500ms con `ease-out`.
- [ ] Iconos de Lucide.
- [ ] Espaciados múltiplos de Tailwind.
- [ ] Contraste accesible (≥ 4.5:1 texto/fondo).
- [ ] Estados definidos: loading, error, vacío.
- [ ] Responsive: 375px / 768px / 1280px.
- [ ] Dark Mode (es el único modo).

---

## 🚫 Anti-patrones

1. ❌ `bg-[#hex]` salvo casos justificados y documentados.
2. ❌ Tamaños de texto custom (`text-[17px]`, `text-[10px]`…) — usar la escala (`text-2xs` es el mínimo).
3. ❌ Animaciones > 500ms.
4. ❌ Box shadows pesadas (los `shadow-xl` ya están en glass-panel).
5. ❌ Más de 2 acentos de color en el mismo componente.
6. ❌ Iconos de otra librería que no sea Lucide.
7. ❌ `font-bold` / `font-black` — el máximo es `font-semibold`.
8. ❌ Redefinir tokens (colores, animaciones, fuentes) en un tailwind.config local — todo vive en `@alsari/config/tailwind-preset`.
9. ❌ `text-red-*` en módulos — el negativo/error es `rose`.
10. ❌ Backdrops de modal distintos de `bg-black/60 backdrop-blur-sm` — usar `Modal` de `@alsari/ui`.
