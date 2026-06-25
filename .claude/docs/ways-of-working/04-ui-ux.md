# 04 · UI/UX — Sistema de Diseño "Quiet Luxury"

> Identidad visual del Alsari Capital OS. Codificada a partir del branding ya existente
> en la primera herramienta construida (Neural Finance V3.0).

---

## 🎯 Principios estéticos

### 1. Quiet Luxury
Lujo sin gritar. Inspiración: Harvey Specter, ecosistema Apple, dashboards de Bloomberg
Terminal pero en versión 2026. Cero ruido visual, máxima información útil.

### 2. Dark Mode permanente
El sistema es nativamente oscuro. No hay modo claro por ahora. Los fondos son **negros
casi puros**; los textos, **crema sobre negro**.

### 3. Glassmorphism sutil
Paneles con `backdrop-blur` ligero y bordes muy tenues. Da profundidad sin recargar.

### 4. Tipografía como elemento de marca
El logo de Alsari (letras con doble línea y serifa moderna) marca el carácter.
La UI usa una sans-serif limpia (system fonts) para contrastar y dejar el protagonismo
al contenido.

### 5. Color con propósito
Los acentos de color (azul, verde, rojo) **solo aparecen cuando tienen significado**:
- Azul → información, selección, neutral
- Verde → métricas positivas (ingresos, ganancias, OK)
- Rojo → métricas negativas (pérdidas, errores, alertas)
- Crema → texto principal, branding

---

## 🎨 Paleta oficial

### Colores base

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-bg-deep` | `#09090b` (zinc-950) | Fondo principal de la app |
| `--color-bg-elevated` | `#18181b` (zinc-900) | Cards, paneles, modales |
| `--color-bg-hover` | `#27272a` (zinc-800) | Hover de elementos interactivos |
| `--color-border-subtle` | `rgba(255,255,255,0.05)` | Bordes de glass-panels |
| `--color-border-strong` | `rgba(255,255,255,0.1)` | Bordes más visibles |
| `--color-text-primary` | `#f4f4f5` (zinc-100) | Texto principal |
| `--color-text-secondary` | `#a1a1aa` (zinc-400) | Texto secundario, labels |
| `--color-text-muted` | `#71717a` (zinc-500) | Placeholders, hints |

### Color de marca

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-brand-cream` | `#F5F0E1` | Color del logo Alsari, acentos premium |
| `--color-brand-cream-soft` | `#F5F0E1` con opacity 0.7 | Hover sutil del color crema |

### Acentos funcionales

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-accent-blue` | `#3b82f6` (blue-500) | Selección, links, info |
| `--color-accent-blue-soft` | `rgba(59,130,246,0.3)` | Selección de texto, highlights |
| `--color-success` | `#10b981` (emerald-500) | Métricas positivas |
| `--color-warning` | `#f59e0b` (amber-500) | Avisos |
| `--color-danger` | `#ef4444` (red-500) | Errores, pérdidas |

### Reglas de uso del color

1. **Por defecto todo es zinc-950 / zinc-100.** El color crema y los acentos son
   excepciones con significado.
2. **Nunca dos acentos en el mismo elemento.** Un KPI no es a la vez azul y verde.
3. **Verde/rojo solo en contexto numérico/estado.** Nunca como decoración.
4. **El crema es premium:** se usa para títulos importantes, el logo, llamadas
   ejecutivas a la acción. No para botones de "Cancelar".

---

## ✍️ Tipografía

### Stack
```css
font-family:
  -apple-system, BlinkMacSystemFont,
  "SF Pro Display", "Inter",
  "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif;
```

System fonts primero (rendimiento + sensación nativa). Inter como fallback web.

### Escala (Tailwind defaults adaptados)

| Token | Tamaño | Uso |
|-------|--------|-----|
| `text-xs` | 12px | Labels pequeños, captions |
| `text-sm` | 14px | Texto secundario, hints |
| `text-base` | 16px | Texto principal |
| `text-lg` | 18px | Subtítulos |
| `text-xl` | 20px | Títulos de sección |
| `text-2xl` | 24px | Títulos de página |
| `text-3xl` | 30px | KPIs principales |
| `text-4xl` | 36px | Hero numbers |
| `text-5xl` | 48px | Boot screen, landing |

### Pesos
- `font-light` (300): números muy grandes (hero numbers)
- `font-normal` (400): texto base
- `font-medium` (500): subtítulos, labels destacadas
- `font-semibold` (600): títulos
- `font-bold` (700): solo casos excepcionales

### Tracking (letter-spacing)
- `tracking-tight` (-0.025em): números grandes
- `tracking-normal` (0): texto general
- `tracking-wide` (0.025em): labels en mayúsculas, captions de marca
- `tracking-widest` (0.1em): texto técnico/marca (ej. "NEURAL FINANCE V3.0")

---

## 🧊 Componentes visuales clave

### Glass Panel (panel con blur)

```css
.glass-panel {
  @apply bg-zinc-900/40 backdrop-blur-md border border-white/5 shadow-xl rounded-lg;
}
```

**Uso:** Cards de contenido, paneles laterales, contenedores de KPIs.

### Glass Header

```css
.glass-header {
  @apply bg-zinc-950/80 backdrop-blur-xl border-b border-white/5;
}
```

**Uso:** Header superior del Host OS, top bars de módulos.

### Botón primario

```tsx
<button className="
  bg-zinc-100 text-zinc-950
  hover:bg-zinc-200
  px-4 py-2 rounded-md
  text-sm font-medium
  transition-colors
">
  Acción principal
</button>
```

### Botón secundario

```tsx
<button className="
  bg-zinc-900 text-zinc-100
  hover:bg-zinc-800
  border border-white/10
  px-4 py-2 rounded-md
  text-sm font-medium
  transition-colors
">
  Acción secundaria
</button>
```

### Botón fantasma (ghost)

```tsx
<button className="
  text-zinc-400 hover:text-zinc-100
  hover:bg-white/5
  px-3 py-1.5 rounded-md
  text-sm
  transition-colors
">
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
  <p className="text-sm text-emerald-500 mt-2">
    ↑ +12.4% vs Q3
  </p>
</div>
```

---

## 🎬 Animaciones

### Filosofía
**Animaciones discretas que aportan continuidad, no que distraen.** Duraciones cortas
(150-500ms), curvas suaves (`ease-out`).

### Tokens

```javascript
// tailwind.config.js
animation: {
  'fade-in': 'fadeIn 0.5s ease-out forwards',
  'fade-up': 'fadeUp 0.4s ease-out forwards',
  'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
  'shimmer': 'shimmer 2s linear infinite',
},
keyframes: {
  fadeIn: {
    '0%': { opacity: '0', transform: 'translateY(10px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  fadeUp: {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  pulseSubtle: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.7' },
  },
  shimmer: {
    '100%': { transform: 'translateX(100%)' },
  },
}
```

### Uso

- **`animate-fade-in`** → entrada de páginas, modales.
- **`animate-fade-up`** → cards apareciendo en grids.
- **`animate-pulse-subtle`** → estados de carga (logo del boot, skeletons).
- **`animate-shimmer`** → loading states con efecto de barrido.

### Transiciones por defecto

Todo elemento interactivo debe tener `transition-colors` o `transition-all` con
`duration-150` o `duration-200`. Nunca cambios bruscos de estado.

---

## 📐 Espaciado y layout

### Sistema de 4px
Tailwind usa múltiplos de 4px (`p-1` = 4px, `p-2` = 8px, etc.). Nunca uses valores
custom; siempre tokens de Tailwind.

### Spacing recomendado

| Contexto | Padding interno | Gap entre elementos |
|----------|----------------|---------------------|
| Card densa | `p-4` (16px) | `gap-3` (12px) |
| Card estándar | `p-6` (24px) | `gap-4` (16px) |
| Card relajada | `p-8` (32px) | `gap-6` (24px) |
| Sección de página | `py-12` (48px) | `gap-8` (32px) |

### Anchos de contenido

- **Sidebar:** `w-64` (256px) en desktop.
- **Main content:** `max-w-7xl mx-auto` para evitar líneas demasiado largas.
- **Modal estándar:** `max-w-lg` (512px).
- **Formularios:** `max-w-md` (448px).

---

## 📦 Iconografía

### Librería oficial: **Lucide React**

- Stroke fino y consistente, encaja con la estética minimal.
- Importación tree-shaken: `import { Wallet, FileText, Briefcase } from 'lucide-react';`

### Tamaños
- `w-4 h-4` (16px): iconos inline en texto
- `w-5 h-5` (20px): iconos en botones
- `w-6 h-6` (24px): iconos en sidebar
- `w-8 h-8` (32px): iconos hero, vacíos

### Color de iconos
Por defecto: `text-zinc-400`. En estado activo: `text-zinc-100` o `text-brand-cream`.

---

## 🖼️ Imágenes y logos

### Logo principal
- Archivo: `public/logo.png` (versión actual del branding Alsari).
- Tamaño en sidebar: `h-8` (32px de alto).
- Tamaño en boot screen: `h-24` (96px) con `animate-pulse-subtle`.

### Favicon
- Archivo: `public/favicon.png` (la "S" doble del logo).

### Estado de carga (boot screen)

```tsx
<div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950">
  <img
    src="/logo.png"
    alt="Cargando Alsari Capital..."
    className="h-24 w-auto animate-pulse mb-4 object-contain"
  />
  <p className="text-zinc-500 text-sm font-medium tracking-wider">
    NEURAL FINANCE V3.0
  </p>
</div>
```

Este boot screen es **firma visual del OS** — se mantiene en todos los módulos al
hacer cold start.

---

## 🎯 Scrollbars

Custom y minimalistas (ya implementado en `index.css` actual):

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #09090b; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
```

---

## ✅ Checklist de UI antes de un merge

Antes de cualquier PR que toque UI, verifica:

- [ ] Funciona en Dark Mode (es el único modo).
- [ ] Usa tokens de color, no hex hardcodeados.
- [ ] Tipografía consistente con la escala definida.
- [ ] Animaciones ≤ 500ms y con `ease-out`.
- [ ] Iconos de Lucide, no de otra librería.
- [ ] Espaciados son múltiplos de Tailwind.
- [ ] Contraste accesible (texto principal sobre fondo: ratio ≥ 4.5:1).
- [ ] Estado de loading definido.
- [ ] Estado de error definido.
- [ ] Estado vacío definido.
- [ ] Responsive (al menos: mobile 375px, tablet 768px, desktop 1280px).

---

## 📚 Recursos

- **Lucide icons:** https://lucide.dev
- **Tailwind docs:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com (componentes base reutilizables)
- **Logo y assets:** `packages/ui/assets/` (cuando se monte el monorepo)
