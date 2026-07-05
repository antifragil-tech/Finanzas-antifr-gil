# Arquitectura — Módulo `[NOMBRE]`

> Documento vivo. Estado técnico actual del módulo.

**Última actualización:** [YYYY-MM-DD]
**Versión del módulo:** 0.1.0

---

## 🗺️ Visión general

[1-2 párrafos describiendo qué hace el módulo y cómo se inserta en el OS.]

---

## 🧱 Estructura interna

```
src/
├── pages/          # Rutas top-level del módulo
├── components/     # Componentes específicos
├── hooks/          # Lógica reutilizable
├── lib/            # Funciones puras
├── stores/         # Estado (Zustand)
├── api/            # Acceso a datos
└── types/          # Tipos locales
```

---

## 🔄 Flujos clave

### Flujo 1: [Nombre]

```
Usuario hace X
  → Componente Y
  → Hook Z
  → API W
  → Supabase
```

---

## 📊 Modelo de datos

### Tablas usadas

| Tabla | Propósito | RLS |
| ----- | --------- | --- |
| ...   | ...       | ... |

---

## 🔐 Permisos

- **admin:** ...
- **operator:** ...
- **viewer:** ...

---

## 🎯 Decisiones técnicas locales

[Si hay alguna decisión específica de este módulo que no aplica al global, documéntala
aquí. Si es lo bastante importante, crea un ADR local en `decisiones/`.]

---

## 🚧 Deuda técnica

(Vacío inicialmente.)
