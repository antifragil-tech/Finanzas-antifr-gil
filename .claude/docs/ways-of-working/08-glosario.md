# 08 · Glosario

> Vocabulario común entre Claude y Guille.
> Mezcla términos técnicos del stack con términos de negocio de Alsari Capital.
> Si un término no está aquí, **añádelo cuando aparezca**.

---

## 💼 Términos de negocio (Alsari)

### Entidades del holding

| Término                      | Significado                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| **Alsari Capital**           | Holding central del grupo. Sociedad matriz operativa.                |
| **Pavier Legacy Group S.L.** | Sociedad de gestión patrimonial. Propiedad de Javier Alarcón Rivera. |
| **Armia Group S.L.**         | Sociedad de Iván Alarcón Rivera.                                     |
| **Alsari Inversiones**       | Sociedad de inversiones del holding.                                 |
| **Rialsa Obras S.L.**        | Empresa vinculada (tenant confirmado del activo de Campanillas).     |
| **CENS**                     | Proyecto del sector salud, entidad independiente con otros socios.   |
| **Antifrágil**               | Proyecto independiente con otros socios de capital.                  |

### Activos y proyectos inmobiliarios

| Término                          | Significado                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| **Las Mesas / Le Toit Grand 10** | Promoción residencial en Estepona.                          |
| **Laguna Park / Perisur**        | Proyecto inmobiliario.                                      |
| **Alborán Living / Capellanía**  | Proyecto residencial (vinculado a Proinco).                 |
| **Campanillas**                  | Activo logístico. Plot value ≈ 398K€. Tenant: Rialsa Obras. |
| **King's Haven**                 | Villa de lujo del holding.                                  |
| **Veracruz**                     | Embarcación gestionada por el grupo.                        |

### Términos financieros

| Término             | Definición                                                            | Fórmula                                       |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| **EBITDA**          | Beneficio antes de intereses, impuestos, depreciación y amortización. | `Ingresos − Costes operativos`                |
| **EBIT**            | Beneficio antes de intereses e impuestos.                             | `EBITDA − Depreciación − Amortización`        |
| **Margen EBITDA**   | Rentabilidad operativa.                                               | `EBITDA / Ingresos × 100`                     |
| **TIR (IRR)**       | Tasa Interna de Retorno. Rentabilidad anualizada de una inversión.    | `0 = Σ [CFt / (1+TIR)^t]`                     |
| **VAN (NPV)**       | Valor Actual Neto. Suma de flujos descontados.                        | `VAN = Σ [CFt / (1+r)^t] − Inversión inicial` |
| **ROI**             | Retorno sobre inversión.                                              | `(Ganancia − Inversión) / Inversión × 100`    |
| **ROCE**            | Retorno sobre capital empleado.                                       | `EBIT / Capital empleado`                     |
| **Cash flow**       | Flujo de caja. Entrada/salida real de dinero.                         | —                                             |
| **Earn-out**        | Pago condicionado a resultados futuros.                               | Variable según contrato                       |
| **Pignoración**     | Fondos comprometidos como garantía.                                   | —                                             |
| **Intragroup loan** | Préstamo entre sociedades del mismo grupo.                            | —                                             |

### Operativa del holding

| Término                | Significado                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| **Asset Management**   | Enfoque de gestión: optimizar el valor de los activos del holding. |
| **CIF**                | Código de Identificación Fiscal de una sociedad española.          |
| **IBAN**               | Número de cuenta bancaria internacional.                           |
| **Reporte de Semana**  | Documento ejecutivo semanal que Guille produce para los socios.    |
| **Delegado Ejecutivo** | Rol funcional de Guille en el holding.                             |

### Contactos clave

| Persona/Entidad                       | Rol                                         |
| ------------------------------------- | ------------------------------------------- |
| **Javier Alarcón Rivera**             | Socio principal (Pavier Legacy Group).      |
| **Iván Alarcón Rivera**               | Socio principal (Armia Group).              |
| **FMC Legal / Mariano de la Huerga**  | Asesoría legal del holding.                 |
| **CaixaBank / Víctor Manuel Navarro** | Relación bancaria CaixaBank.                |
| **Banco Sabadell**                    | Relación bancaria.                          |
| **Santander**                         | Banco donde hay fondos pignorados.          |
| **Asesoría MM / Ramón**               | Contabilidad externa.                       |
| **Proinco**                           | Contratista (vinculado a Alborán Living).   |
| **Evariste S.A.S.**                   | Empresa relacionada con earn-out pendiente. |

---

## 🛠️ Términos técnicos del stack

### Arquitectura

| Término            | Significado                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| **Monorepo**       | Un único repositorio que contiene varios proyectos relacionados.            |
| **Workspace**      | Sub-proyecto dentro de un monorepo (cada módulo, cada package).             |
| **Host OS**        | La aplicación principal que carga y orquesta los módulos.                   |
| **Módulo**         | Mini-aplicación independiente dentro del OS (financiero, facturas, etc.).   |
| **Micro-frontend** | Patrón donde cada parte de la UI es una app independiente.                  |
| **Error Boundary** | Componente React que captura errores de sus hijos y muestra fallback.       |
| **ADR**            | Architecture Decision Record. Documento que justifica una decisión técnica. |
| **Schema**         | En BD: agrupación lógica de tablas. En Zod: descripción de un tipo.         |

### Stack

| Término           | Significado                                                          |
| ----------------- | -------------------------------------------------------------------- |
| **pnpm**          | Gestor de paquetes de Node.js. Eficiente en espacio y rápido.        |
| **Turborepo**     | Sistema de build para monorepos. Cachea tareas para acelerar builds. |
| **Next.js**       | Framework de React con SSR/SSG. Usado en el Host OS.                 |
| **Vite**          | Bundler ultrarrápido. Usado en cada módulo.                          |
| **React**         | Librería de UI. v19 en este proyecto.                                |
| **TypeScript**    | JavaScript con tipos estáticos. Estricto en todo el OS.              |
| **Tailwind CSS**  | Framework de estilos utility-first.                                  |
| **shadcn/ui**     | Set de componentes copy-paste basados en Radix + Tailwind.           |
| **Zustand**       | Librería ligera de estado global.                                    |
| **Zod**           | Validación de schemas con tipos derivados.                           |
| **Supabase**      | Backend-as-a-Service: Postgres + Auth + Storage + Edge Functions.    |
| **RLS**           | Row Level Security. Políticas de acceso a nivel de fila en Postgres. |
| **Edge Function** | Función serverless en Supabase, similar a AWS Lambda.                |
| **Vitest**        | Test runner moderno, compatible con Vite.                            |
| **Playwright**    | Framework de tests E2E (controla navegadores).                       |

### Patrones y conceptos

| Término                 | Significado                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| **Lazy loading**        | Cargar código solo cuando se necesita. Acelera arranque.                 |
| **Code splitting**      | Dividir el bundle en chunks descargables por separado.                   |
| **SSR**                 | Server-Side Rendering. La página se renderiza en el servidor.            |
| **CSR**                 | Client-Side Rendering. La página se renderiza en el navegador.           |
| **HMR**                 | Hot Module Replacement. Recarga código sin perder estado en dev.         |
| **JWT**                 | JSON Web Token. Token firmado para autenticación.                        |
| **httpOnly cookie**     | Cookie que no es accesible desde JavaScript. Más segura.                 |
| **CORS**                | Cross-Origin Resource Sharing. Política de qué dominios pueden llamarse. |
| **Type guard**          | Función que estrecha el tipo de una variable en TypeScript.              |
| **Discriminated union** | Tipo que combina varios casos identificados por una propiedad.           |
| **Barrel export**       | `index.ts` que reexporta el contenido de una carpeta.                    |
| **Tree shaking**        | Eliminación automática de código no usado en el build final.             |
| **Glassmorphism**       | Estilo visual con paneles translúcidos y blur.                           |

### DevOps / Git

| Término          | Significado                                                      |
| ---------------- | ---------------------------------------------------------------- |
| **CI/CD**        | Continuous Integration / Continuous Deployment.                  |
| **PR / MR**      | Pull Request / Merge Request. Propuesta de cambio para revisión. |
| **Squash merge** | Combinar todos los commits de una rama en uno solo al mergear.   |
| **Rebase**       | Reescribir el historial de una rama sobre otra base.             |
| **Semver**       | Versionado semántico: MAJOR.MINOR.PATCH.                         |
| **Tag**          | Marca permanente sobre un commit (ej. `v1.0.0`).                 |

---

## 🤖 Términos de Claude / IA

| Término            | Significado                                                           |
| ------------------ | --------------------------------------------------------------------- |
| **Claude Code**    | Extensión de Antigravity que carga `CLAUDE.md` y `.claude/skills/`.   |
| **Skill**          | Bloque de conocimiento estructurado que Claude carga automáticamente. |
| **MCP**            | Model Context Protocol. Forma de exponer herramientas a Claude.       |
| **RAG**            | Retrieval-Augmented Generation. Búsqueda semántica + IA.              |
| **Embedding**      | Representación numérica de texto para búsqueda semántica.             |
| **Context window** | Cantidad máxima de tokens que Claude puede procesar a la vez.         |
| **Antigravity**    | IDE donde Guille programa, con extensión de Claude Code.              |

---

## ➕ Cómo añadir términos

Si en una sesión aparece un término nuevo que no está aquí:

1. **Si es de negocio** → añádelo en la sección correspondiente con definición clara.
2. **Si es técnico** → añádelo en la sección de stack/patrones.
3. **Commit:** `docs(glosario): añadir término X`.

El objetivo es que en 6 meses, este archivo sea la **enciclopedia operativa**
de Alsari OS.
