# Fase 4 (diseño) — Facturación emitida y su tratamiento fiscal

> **Estado:** Diseño / auditoría. **Cero código, cero migraciones, cero tipos nuevos.** Sujeto a validación de Guille.
> **Rama:** `docs/finanzas-facturacion-emitida-design`
> **Fecha:** 2026-06-26
> **Autor:** Claude (arquitecto técnico-fiscal) · **Validación:** Guille
> **Depende de:** [00-auditoria-base-financiera-antifragil.md](00-auditoria-base-financiera-antifragil.md) y [01-modelo-conceptual-antifragil.md](01-modelo-conceptual-antifragil.md) (marco, NO se redefinen aquí).
> **Alcance:** módulo `contabilidad` → **facturas emitidas** y la tabla `facturas_emitidas`. NO toca `financiero`, `presupuestos`, ni el módulo/spike de Clínica.
> **Marcas `⚠️ DECISIÓN`:** puntos que requieren confirmación de Guille (o de la gestoría — Asesoría MM / Ramón). Recogidas al final.

---

## 0. Resumen ejecutivo (para Guille)

Emitir facturas es el **mayor hueco y el mayor riesgo fiscal** del sistema (auditoría Fase 0, §8.1). Hoy hay un **editor muy pulido** (preview A4, PDF, IVA/IRPF, cuenta bancaria) pero **debajo no hay ninguna garantía contable ni fiscal**: el "número de factura" se inventa en el navegador, una factura "emitida" se puede volver a editar y cambiarle número, fecha e importe, no se genera el asiento de venta, no hay rastro de quién la emitió, y la exención de IVA sanitaria **no existe en el modelo de datos**. Es decir: el 35 % que falta no es UI, es **el esqueleto legal**.

La buena noticia: el módulo de facturas **recibidas** ya resolvió, con calidad, exactamente los mecanismos que faltan en emitidas (número/estado inmutable vía RPC en el servidor, log de auditoría inalterable, libro de pagos append-only, asiento contable automático). **El plan es copiar ese patrón, no inventarlo.**

La noticia que obliga a una decisión estratégica: desde 2025-2026 la **ley antifraude española (Veri\*factu / RD 1007/2023)** exige que cualquier software que emita facturas sea inalterable, encadene los registros con hash y lleve un **QR** en la factura. Eso decide si construimos un emisor propio homologado o **delegamos la emisión oficial en la gestoría / un software homologado** y aquí solo preparamos los datos. Hay que resolverlo **antes** de escribir la primera línea de la emisión real (§5 y §8).

Regla de oro de este documento (heredada de docs 00/01): **fecha de emisión ≠ fecha de cobro ≠ fecha de servicio.** Mezclarlas corrompe las tres capas (contabilidad, tesorería, rentabilidad).

---

## 1. Estado actual de facturas emitidas y gaps concretos

### 1.1 Qué hay (auditado en código)

| Pieza | Ubicación | Estado |
|---|---|---|
| Tabla `facturas_emitidas` | `migrations/20260521090100_facturas.sql` | Existe |
| + campos de pago (`metodo_pago`, `cuenta_bancaria_iban/alias/titular`) | `migrations/20260522120000_sociedades_ficha_bancaria.sql` | Existe |
| FK `asientos_borrador.factura_emitida_id` | `migrations/20260521090200_asientos.sql` | Existe (sin uso) |
| FK `presupuesto_pagos.factura_emitida_id` | `migrations/20260605000004_presupuesto_ingresos.sql` | Existe ("ciclo UI pendiente") |
| Listado + filtros por estado | `views/FacturasEmitidas.tsx` | Funcional |
| Editor completo (líneas, impuestos, vencimiento, preview, PDF) | `views/FacturaEmitidaEditor.tsx` (1.803 líneas) | Funcional (UI) |
| Tipo `FacturaEmitida` / `LineaFactura` / `EstadoFacturaEmitida` | `packages/types/src/contabilidad.ts` | Existe |

La tabla tiene los campos esperables (`sociedad_id_ref`, `numero_factura`, `serie`, datos de cliente, `fecha_factura`, `fecha_vencimiento`, `lineas` jsonb, base/IVA/retención/total, `estado` ∈ `borrador|emitida|cobrada|vencida|anulada`). El editor calcula impuestos por línea, ofrece un catálogo de IVA/retención/recargo, genera el PDF A4 con logo (aplicando ya las lecciones del repo de PDF, ver §5) y permite guardar como **borrador** o pulsar **"Aprobar"** (que internamente sólo hace `estado='emitida'`).

### 1.2 Gaps concretos (lo que falta y por qué importa)

| # | Gap | Evidencia en código | Riesgo |
|---|---|---|---|
| G1 | **El número no es oficial ni inmutable.** Se calcula en el navegador (`nextNumero` cuenta los de la lista cargada y suma 1). | `FacturaEmitidaEditor.tsx:108` | Saltos, duplicados y condiciones de carrera entre dos emisiones simultáneas. Una numeración con huecos/duplicados es **infracción tributaria**. |
| G2 | **Una factura "emitida" se puede re-editar.** El editor carga la emitida y guarda con `PATCH` directo; se puede cambiar número, fecha, líneas e importe después de emitida. | `handleSave()` → `updateFacturaEmitida` (`contabilidadApi.ts:310`) | Alterar una factura ya emitida es alteración de documento fiscal. Rompe la inalterabilidad que exige la ley antifraude. |
| G3 | **No hay fecha de emisión separada.** Sólo existe `fecha_factura`. | tabla `facturas_emitidas` | No se distingue "fecha del documento" de "cuándo se emitió de verdad". Imposible auditar antedatado. |
| G4 | **RLS demasiado permisiva.** `for all to authenticated using(true) with check(true)`: cualquier usuario autenticado puede `INSERT/UPDATE/DELETE` cualquier factura. | `migrations/20260521090100_facturas.sql:67` | Sin control de rol ni de quién emite. **Lo contrario** de lo que hace recibidas (tablas SELECT-only + RPC). |
| G5 | **No hay asiento de venta.** Existe la FK `asientos_borrador.factura_emitida_id` pero **ningún código** genera el asiento 700/430/477. El generador `buildLineasAsiento` solo construye asientos de **compra**. | `FacturaReviewPanel.tsx:469` (solo compra) | La venta no entra en contabilidad. Hay que cuadrarla a mano. |
| G6 | **No hay tratamiento de exención.** `FacturaEmitida`/`LineaFactura` **no tienen `tipo_operacion`**. El editor sí muestra "Exenta" y "No sujeto", pero al guardar sólo persiste `tipo_iva` (un número %), perdiendo la distinción exenta vs no-sujeta vs 0 %. | `LineaFactura` (`contabilidad.ts:85`), `handleSave` (`:1023`) | **El riesgo fiscal nº1 de la clínica** (exención sanitaria) no es ni representable hoy. |
| G7 | **No hay auditoría de cambios.** No existe un `factura_emitida_aprobaciones` análogo al de recibidas. | — | No se sabe quién emitió/anuló/cobró ni cuándo. |
| G8 | **No hay rectificativas.** No hay vínculo factura→factura rectificada ni serie R operativa (el editor lista una serie "R" pero no hay lógica). | — | Corregir una factura emitida obliga a manipularla (ver G2). Lo correcto es emitir una **rectificativa** ligada. |
| G9 | **No hay vínculo a proyecto/cliente.** `facturas_emitidas` no tiene `proyecto_id_ref` ni `contacto_id`; el cliente se guarda como texto suelto (`cliente_nombre/nif/direccion`). | tabla + tipo | La factura de la clínica no podría "subir" a la rentabilidad del proyecto Clínica (rompe el etiquetado dimensional de doc 01 §4). |
| G10 | **Estado sin máquina de estados real.** `handleSave` acepta cualquier `estado`; no hay transiciones válidas ni quién puede hacerlas. | `handleSave(estado)` (`:1010`) | Se puede pasar de `anulada` a `cobrada` sin control. |
| G11 | **Emisor hardcodeado "Alsari Capital".** El PDF rotula "Alsari Capital" / "alsari.net" como _fallback_ y pie. | `buildInvoiceHtml` (`:589`, `:662`) | No es rebrand de `@alsari/*` (prohibido, decisión de Guille): es que **el emisor debe salir de la sociedad**, no de una constante. Hoy si falta el dato sale "Alsari Capital". |

> **Veredicto:** el editor es una **maqueta de alta fidelidad**. Sirve para borradores internos, pero **no debe usarse para emitir facturas reales de la clínica** tal cual: faltan inalterabilidad, asiento, exención y auditoría.

---

## 2. Flujo de EMISIÓN oficial (borrador → emitida → cobrada/vencida/anulada)

El principio es el mismo que en recibidas: **el cambio de estado y el número los pone el servidor en una transacción atómica, no el cliente.** El borrador es libre; la emisión es un punto de no retorno.

### 2.1 Máquina de estados

```
  borrador ──emitir──►  emitida ──registrar cobro──►  cobrada
     │  (libre,            │  (nº y fecha de            (≥ total cobrado;
     │   editable,         │   emisión INMUTABLES,       alimenta cashflow)
     │   sin nº fiscal)    │   ya no editable)
     │                     │
     │                     ├──vence (fecha)────────►  vencida
     │                     │
     └──descartar──►(borrado)   └──anular/rectificar──►  anulada  ──► (+ factura R)
```

- **borrador:** estado de trabajo. Editable, **sin número fiscal** (o con un identificador provisional NO fiscal). Se puede borrar. No genera asiento.
- **emitida:** acción `emitir` (RPC). Asigna **número inmutable** por `(sociedad, serie, año)` y **`fecha_emision` inmutable** (= `now()` del servidor, no editable). A partir de aquí la factura es **inmutable**: cambiar importes/líneas/cliente exige **rectificativa**, no edición. Genera el **asiento de venta borrador** (§3).
- **cobrada:** se alcanza el total a cobrar en el libro de cobros (§7). Es un estado **derivado** del cobro, no un botón arbitrario.
- **vencida:** derivado de fecha (`fecha_vencimiento < hoy` y no cobrada). No requiere acción humana; es una lectura.
- **anulada:** una factura emitida no se borra; se **anula** y, si procede, se emite una **rectificativa** (serie R) que la corrige (§3.3). La anulación conserva la fila y el número (no se reutiliza).

### 2.2 Quién puede emitir (rol) — adaptar la matriz de recibidas

Recibidas usa una matriz rol→acción dentro de la RPC `SECURITY DEFINER`, con el actor derivado de `auth.jwt()->>'email'` (no falsificable) y un "modo single-operator" cuando los 3 correos coinciden (`migrations/202606191100_factura_aprobaciones.sql:108`). **Reutilizamos el mecanismo**, pero los roles de Alsari (`guille/javi/alicia`) **no encajan** con la clínica.

Roles de Antifrágil para emitidas (alinear con `roles-pagos-clinica`, otra línea, sin acoplarse):

| Acción | Rol que la puede hacer (propuesta) |
|---|---|
| Crear / editar borrador | `admin`, `recepcion` |
| **Emitir** (asignar nº + fecha) | `admin` (y `recepcion` si Guille lo permite para la clínica) |
| Registrar cobro | `admin`, `recepcion` |
| Anular / rectificar | `admin` |
| Ver | `admin`, `recepcion`, `viewer`, `profesional` (según privacidad) |

> ⚠️ **DECISIÓN F4-A.** ¿Quién puede **emitir** facturas de la clínica? ¿Sólo `admin`, o también `recepcion`? (En recepción se cobra en mostrador; lo natural es que recepción pueda emitir el ticket/factura simple, y `admin` las anulaciones/rectificativas.)

> **Nota técnica:** la matriz rol→email actual está hardcodeada a `guille/javi/alicia` en SQL y en `FacturaReviewPanel.tsx`. Generalizarla a una matriz rol→acción configurable es deuda compartida con la adaptación de recibidas (doc 00 §3, §7.3). No la resolvemos aquí, pero la emisión debe **consumir** esa matriz, no crear una tercera copia.

### 2.3 Auditoría de cambios

Tabla **`factura_emitida_aprobaciones`** (espejo de `factura_aprobaciones`): append-only, **SELECT-only por RLS** (sin INSERT/UPDATE/DELETE del cliente), escrita sólo desde la RPC. Acciones: `crea_borrador`, `emite`, `registra_cobro`, `marca_vencida`, `anula`, `emite_rectificativa`. Cada evento guarda `actor_email/rol`, `estado_anterior/nuevo`, `comentario`, `metadata` (nº asignado, importe…), `created_at`. Es, además, la base del registro inalterable que pide Veri\*factu (§5).

---

## 3. Asiento de venta automático y rectificativas

### 3.1 El asiento de venta (imitando recibidas)

Recibidas genera el asiento de **compra** con `buildLineasAsiento` (`FacturaReviewPanel.tsx:469`): `gasto (debe base)` / `472 IVA soportado (debe)` / `4751 retenciones (haber)` / `400 proveedores (haber total)`. El **espejo de venta** es directo (las cuentas 700/705/430/477 ya están en el catálogo del panel, `FacturaReviewPanel.tsx:182,361-368`, sólo que **no se usan**):

**Asiento de venta (caso normal, con IVA):**

| Cuenta | Concepto | Debe | Haber |
|---|---|---|---|
| **430** | Clientes | `total_a_cobrar` | |
| **705** | Prestación de servicios *(o 700 Ventas si es producto físico)* | | `base_imponible` |
| **477** | H.P. IVA repercutido | | `cuota_iva` |

(Si el cliente practicara **retención** —B2B de profesionales—, se añade `473 H.P. retenciones y pagos a cuenta` al **debe** por la retención, y `430` baja en ese importe. En la clínica B2C esto será raro, pero el modelo debe soportarlo, igual que recibidas soporta `4751`.)

**Asiento de venta EXENTA (clínica, art. 20 LIVA):**

| Cuenta | Concepto | Debe | Haber |
|---|---|---|---|
| **430** | Clientes | `base_imponible` (= total, sin IVA) | |
| **705** | Prestación de servicios sanitarios | | `base_imponible` |

→ **sin 477**. El asiento queda cuadrado sin cuota de IVA.

Como en recibidas, el asiento se crea **en estado `borrador`** en `asientos_borrador` (con `factura_emitida_id` ya disponible como FK) y se reconcilia después contra el oficial de la gestoría (`asientos_oficiales`). No tocamos el motor de reconciliación; sólo lo alimentamos.

> ⚠️ **DECISIÓN F4-B.** Cuenta de ingreso por defecto: **705 (Prestación de servicios)** para servicios clínicos; **700 (Ventas)** sólo si se venden productos físicos (suplementos, material). ¿Confirmamos 705 como default de la clínica? (El editor hoy ofrece `70000000` por defecto, que es **Ventas de mercaderías** — incorrecto para una clínica de servicios.)

### 3.2 ¿Quién genera el asiento?

Recibidas lo construye en el frontend y lo inserta. Para emitidas, lo **coherente y seguro** es generarlo **dentro de la RPC de emisión** (misma transacción que asigna el número): así nunca hay factura emitida sin su asiento, ni asiento sin factura. La exención decide si hay línea 477 o no.

### 3.3 Rectificativas (notas de crédito / abono)

- Serie propia **R** (ya prevista en el selector del editor) con su numeración inmutable.
- Campo **`factura_rectificada_id`** (FK a la `facturas_emitidas` original) + `motivo_rectificacion` (error, devolución, descuento, anulación…).
- Importe en **negativo** (o por diferencias), según el tipo de rectificación.
- Asiento **inverso** del original (o por la diferencia): `700/705 debe` / `477 debe` / `430 haber`.
- La original **no se modifica**: queda `anulada`/`rectificada`, enlazada a su R. Trazabilidad completa en el log de auditoría (`emite_rectificativa`).

---

## 4. IVA / exención sanitaria — la decisión por servicio, no global

### 4.1 El marco legal (art. 20.Uno LIVA)

La exención sanitaria (**art. 20.Uno.3º**) cubre *"la asistencia a personas físicas por profesionales médicos y sanitarios… que consista en diagnóstico, prevención y tratamiento de enfermedades"*. Las claves:

1. **Por finalidad terapéutica.** Exento sólo si la finalidad es **diagnóstico, prevención o tratamiento** de una enfermedad. **Estética/bienestar/rendimiento sin finalidad terapéutica → SUJETO a IVA** (criterio reiterado de la DGT y del TJUE).
2. **Por profesión sanitaria.** El prestador debe ser profesional sanitario reconocido. Esto **parte el catálogo de la clínica** (ver `docs/reservas/03-catalogo-tarifas-productos.md`):

| Servicio del catálogo | Profesión | Tratamiento IVA (criterio, **a confirmar con gestoría**) |
|---|---|---|
| **Fisioterapia / Fisioterapia deportiva** | Sanitaria (fisioterapeuta) | **Exenta** cuando hay finalidad terapéutica (lesión, rehabilitación). Discutible si es puramente preventivo-deportivo/rendimiento. |
| **Nutrición** | Dietista-nutricionista = sanitaria | **Exenta** si es terapéutica (patología). Nutrición deportiva/estética/bienestar → **sujeta**. |
| **Entrenamiento personal** | **NO sanitaria** | **Sujeto a IVA (21 %)** con carácter general. No es asistencia sanitaria. |
| **Valoraciones, informes, bonos mixtos** | Según contenido | Caso a caso. Un informe pericial no es asistencia → sujeto. |

> **Conclusión innegociable:** la exención **se decide por producto/servicio (y a veces por cita concreta)**, nunca con un interruptor global de la factura. El catálogo de la clínica ya lo anticipó: `clinica.productos` prevé `iva` / `exento` / `tipo_operacion` por producto (doc 03 §6). **La factura debe heredar esa decisión del producto, no recalcularla.**

### 4.2 Cómo se representa en el modelo (lo que falta, G6)

- **A nivel de línea** (`LineaFactura`): añadir **`tipo_operacion`** (`TipoOperacion`, el tipo **ya existe** en `contabilidad.ts:116`, sólo lo usa recibidas) y, si exenta, **`articulo_exencion`** (texto, p.ej. `art. 20.Uno.3º LIVA`). Una factura puede mezclar líneas exentas (fisio terapéutica) y sujetas (entrenamiento) → el `tipo_operacion` **debe vivir en la línea**, no sólo en la cabecera.
- **A nivel de cabecera:** un `tipo_operacion` "dominante"/derivado para listados y para decidir la mención legal global.
- **Mención legal obligatoria en el PDF:** si hay líneas exentas, la factura debe imprimir *"Operación exenta de IVA conforme al art. 20.Uno.3º de la Ley 37/1992"*. Hoy el PDF no lo hace.

### 4.3 Riesgos de exentar de más o de menos

| Error | Consecuencia |
|---|---|
| **Exentar de más** (p.ej. facturar entrenamiento o estética sin IVA) | Hacienda reclama el IVA no repercutido + intereses + sanción. Contingencia directa. |
| **Exentar de menos** (cobrar 21 % sobre fisioterapia terapéutica) | Sobreprecio al paciente, desventaja competitiva, e ingresas un IVA que luego tienes que liquidar. Difícil de devolver al paciente. |
| **Ignorar la prorrata** | Si la clínica tiene actividad **mixta** (exenta + sujeta), el IVA **soportado** (compras, alquiler, material) deja de ser 100 % deducible: se aplica **regla de prorrata**. Es un efecto de segundo orden que afecta a recibidas y a la liquidación. **A vigilar con la gestoría.** |

> ⚠️ **DECISIÓN F4-C.** Validar con **Asesoría MM / Ramón** (gestoría, `corporate-context`) el mapa exención↔servicio del catálogo **antes** de construir, y si la clínica quedará en **prorrata**. Esto es criterio fiscal, no técnico: lo fija la gestoría; nosotros lo implementamos.

---

## 5. Generación del PDF oficial

El editor ya genera un PDF A4 de buena calidad y **respeta las lecciones del repo** (verificado en `FacturaEmitidaEditor.tsx`):

- `min-height: 297mm` + flex column + `page-spacer` para llenar el A4 (lección 2026-05-22 *"Facturas A4"*, `:562-573`).
- Logo con **URL absoluta** `window.location.origin + '/logo.png'` + `onerror` fallback (lección 2026-05-22 *"Logo en document.write()"*, `:699`).

Lo que el PDF oficial **debe añadir** para ser válido:

1. **Datos del emisor desde la sociedad, no hardcodeados.** Hoy hay fallback `'Alsari Capital'` y pie `alsari.net` (`:589,662`). El emisor (nombre, CIF, domicilio) debe salir **siempre** de la sociedad emisora (`SociedadContabilidad`); si falta el dato, **no se emite** (no se pinta "Alsari Capital"). *No es rebrand de `@alsari/*` (prohibido): es parametrizar el emisor.*
2. **Número y fecha de emisión definitivos** (los inmutables del §2), no los provisionales del borrador.
3. **Desglose fiscal correcto:** base por tipo, cuota por tipo, y la **mención de exención** cuando aplique (§4.2). Hoy el resumen colapsa "IVA" en una sola línea.
4. **QR Veri\*factu + leyenda** (ver §5.1) cuando el sistema sea homologado.
5. **Inmutabilidad del documento:** el PDF de una factura emitida se **regenera idéntico** desde los datos congelados; nunca refleja ediciones posteriores (que no deben existir, G2).

### 5.1 ⚠️ Cumplimiento antifraude (Veri\*factu) — decisión estructural

España exige (Ley 11/2021 antifraude + **RD 1007/2023 / Reglamento Veri\*factu**, con despliegue 2025-2026) que el software que emite facturas:

- **Garantice la inalterabilidad** de los registros de facturación.
- **Encadene** cada registro con el anterior mediante **hash** (huella), de forma que alterar uno rompa la cadena.
- Imprima un **código QR** en la factura y la leyenda correspondiente.
- Permita (modo Veri\*factu) el **envío de los registros a la AEAT**.

La clínica está en **Playamar (Málaga) → territorio común**, así que aplica **Veri\*factu / SII**, **no** TicketBAI (eso es País Vasco). El diseño de §2-§3 (número inmutable + log append-only) **ya va en la buena dirección** (hash-chaining encaja con el log de auditoría), pero esto obliga a una decisión de fondo:

> ⚠️ **DECISIÓN F4-D (la más importante). ¿Construir un emisor propio homologado, o delegar la emisión oficial?**
> - **Opción A — Delegar:** Antifrágil OS **prepara** la factura (datos, líneas, exención, asiento borrador) y la **emisión fiscal oficial** la hace un software homologado / la gestoría. Aquí guardamos referencia y PDF. **Menor riesgo, más rápido, recomendado para arrancar la clínica.**
> - **Opción B — Construir homologado:** implementar hash-chaining + QR + (opcional) envío a AEAT en el propio OS. Mayor control y coste; asume responsabilidad de cumplimiento.
>
> Esta decisión condiciona todo lo demás y debe tomarse **con la gestoría** antes de la Fase F4.5. Mi recomendación: **arrancar por A** (la clínica necesita facturar ya y bien, no necesita que reinventemos el SIF), y dejar B como evolución si el volumen lo justifica.

---

## 6. Vínculo a proyecto / cliente / (futuro) cita o bono — el "gancho"

Para que la facturación de la clínica **suba** a la rentabilidad por proyecto (doc 01 §4, regla de agregación por `proyecto_id_ref`) **sin acoplarnos al schema `clinica`** (que aún no existe):

Añadir a `facturas_emitidas` (cuando llegue la fase de código):

| Campo | Tipo | Para qué |
|---|---|---|
| `proyecto_id_ref` | text, **nullable** | Dimensión proyecto (Clínica Playamar, Lido Pro…). Es el enganche que ya usan facturas/presupuestos/flujos (doc 00 §2). |
| `contacto_id` | text/uuid, nullable (FK a `contactos`) | Cliente como entidad, no como texto suelto (resuelve G9). |
| `origen_tipo` | text, nullable | `'manual' | 'cita' | 'bono' | 'cliente_producto'` — **gancho genérico**. |
| `origen_id` | text, nullable | Id del origen en su sistema, **sin FK a `clinica.*`** (aún no existe). Cuando exista, se valida; hoy es sólo traza. |

**Regla anti-acoplamiento:** nada de FK a `clinica.citas`/`clinica.bonos` todavía (lección de paridad: no se referencia lo que no está creado). `origen_tipo/origen_id` son **campos sueltos** que la futura Clínica rellenará. La contabilidad global **no necesita conocer al paciente**: sólo recibe el agregado por `proyecto_id_ref` (doc 01 §4). El catálogo de la clínica ya dejó el espejo de este gancho: `cliente_producto` guarda un futuro `factura_emitida_id` (doc 03 §6).

> ⚠️ **DECISIÓN F4-E.** ¿La clínica usa **serie propia** (p.ej. `C` → `C-2026-0001`) para separar su numeración de la del resto de Antifrágil? Recomendado **sí**: una serie por línea/sociedad facilita el control y la lectura por proyecto.

---

## 7. Relación con las otras capas (conectar, no redefinir)

No se redefinen las capas (son de docs 00/01 y del chat de finanzas). Sólo se fijan los **puntos de conexión** de la factura emitida:

| Capa | Conexión desde la factura emitida | Fecha que manda |
|---|---|---|
| **Contabilidad** | El **asiento de venta** (§3) entra en `asientos_borrador` y se reconcilia. | `fecha_emision` |
| **Tesorería / cashflow** | El **cobro** de la factura (libro de cobros, abajo) es lo que alimenta la caja. La emisión **no** es caja. | `fecha_cobro` |
| **Rentabilidad** | El **devengo** (servicio prestado / sesión consumida) imputa ingreso. La factura **no** es devengo. | `fecha_servicio` |

**Libro de cobros (espejo de `factura_pagos`):** crear un `factura_emitida_cobros` append-only + RPC `registrar_cobro_factura` (SECURITY DEFINER), idéntico en filosofía al de recibidas (`migrations/202606192100_factura_pagos.sql`): cobros parciales, método (efectivo/tarjeta/bizum/transferencia — los de la clínica, doc 03 §4), transición a `cobrada` dentro de tolerancia, incidencias de sobre/infra-cobro. Ese cobro es la **4ª fuente del `cashflow_consolidado`** que doc 00 §4 reserva para la clínica — pero **el cableado al cashflow es territorio del chat de finanzas/tesorería**; aquí sólo dejamos el libro de cobros listo y la FK `presupuesto_pagos.factura_emitida_id` (que ya existe) para enganchar.

**Ejemplo canónico (bono de fisio 225 €, regla de Guille, doc 01 §3):**
- **Factura:** 1 factura de 225 € (posible exención), con su `fecha_emision`. Una sola vez.
- **Cobro/cashflow:** +225 € el día que se cobra. Una sola vez.
- **Rentabilidad:** ~45 €/sesión a medida que se consumen 5 sesiones (devengo). No es esta capa.
- **No doble contar:** la factura documenta; el cobro mueve caja; el devengo mide margen. Tres lecturas, un hecho.

---

## 8. Riesgos fiscales y técnicos

### Fiscales
1. **Exención mal aplicada** (§4.3): exentar de más (entrenamiento/estética) o de menos (fisio terapéutica). Contingencia directa. Mitigación: mapa exención↔servicio validado por la gestoría + decisión **por producto**.
2. **Prorrata de IVA soportado** por actividad mixta exenta/sujeta. Afecta a la deducibilidad de las recibidas. A vigilar con la gestoría.
3. **Numeración no correlativa / con huecos o duplicados** (G1): infracción tributaria. Mitigación: número server-side atómico por (sociedad, serie, año).
4. **Alteración de factura emitida** (G2): incompatible con la ley antifraude. Mitigación: inmutabilidad + rectificativas.
5. **Cumplimiento Veri\*factu** (§5.1): si emitimos con software propio no homologado, incumplimiento. Mitigación: **DECISIÓN F4-D** (delegar vs construir).
6. **Efectivo en la clínica:** cobros en efectivo/datáfono/bizum sin control de caja diaria (auditoría §8.3) y límites legales de efectivo. Lo gestiona el libro de cobros + la capa de tesorería; mencionado para no perderlo de vista.

### Técnicos
7. **Drift migraciones ↔ BD real (riesgo nº1 del repo, lección 2026-06-11).** Las migraciones **se aplican a mano por el Dashboard de Supabase**; el repo **no garantiza** que la BD lo refleje. **Antes de construir cualquier cosa de emisión hay que auditar la paridad real** de `facturas_emitidas` (¿están aplicados los `ALTER` de `metodo_pago`, `cuenta_bancaria_*`?, ¿existe la FK de `presupuesto_pagos`?). No asumir que una columna existe porque hay un `.sql`.
8. **RLS permisiva** (G4): hay que **endurecerla** (SELECT-only + escritura sólo por RPC), igual que recibidas. Cambiar RLS sobre una tabla con datos exige cuidado (no romper el editor de borradores).
9. **Numeración concurrente:** dos emisiones a la vez pueden chocar. La RPC debe bloquear (`FOR UPDATE` sobre un contador por serie) como hace recibidas con la fila de factura.
10. **Doble lógica:** NO duplicar el cálculo de impuestos del editor en el servidor de forma divergente. La RPC debe ser la **fuente de verdad** del total/cuota en el momento de emitir (el editor calcula para previsualizar; el servidor congela).
11. **Migración de tipos** (`exactOptionalPropertyTypes`, lección 2026-05-22): al añadir campos opcionales (`tipo_operacion`, `proyecto_id_ref`…) usar conditional spread, no `{ campo: undefined }`.
12. **Tailwind del host** (lección 2026-05-17) y **auth bridge `getJwt()`** (lección 2026-05-22): aplican a cualquier UI nueva del módulo. No reintroducir `localStorage`.

---

## 9. Propuesta de fases para construir facturación emitida

Encaja dentro de la **Fase 4** del plan maestro (doc 00 §9). Ninguna sub-fase con código se abre sin validación de Guille de este diseño. Orden pensado para **reducir riesgo fiscal cuanto antes**.

| Sub-fase | Objetivo | Entregable | Depende de |
|---|---|---|---|
| **F4.0 — Paridad + criterio fiscal** | Auditar paridad real de `facturas_emitidas` en la BD; validar con la gestoría el mapa exención↔servicio y la prorrata; resolver **DECISIÓN F4-D** (delegar vs construir Veri\*factu) | Informe de paridad + acta de decisiones fiscales | Este doc |
| **F4.1 — Modelo de datos** | Migración: `tipo_operacion`+`articulo_exencion` en línea y cabecera, `fecha_emision`, `proyecto_id_ref`, `contacto_id`, `origen_tipo/id`, `factura_rectificada_id`; tipos nuevos | Migración + tipos (`contabilidad.ts`) | F4.0 |
| **F4.2 — Emisión oficial** | RPC `emitir_factura` (SECURITY DEFINER): nº inmutable atómico por (sociedad, serie, año) + `fecha_emision` + bloqueo de edición post-emisión; `factura_emitida_aprobaciones` (log) + endurecer RLS | RPC + tabla auditoría + máquina de estados | F4.1 |
| **F4.3 — Asiento de venta + rectificativas** | Generar asiento 430/705/477 (o exento) en la emisión; serie R ligada a la original; asiento inverso | Asiento automático + flujo rectificativa | F4.2 |
| **F4.4 — Exención en UI y PDF** | Selector de `tipo_operacion` por línea (heredado del producto cuando venga de clínica); mención legal en PDF; desglose fiscal correcto; emisor desde sociedad | Editor + PDF actualizados | F4.1, F4.3 |
| **F4.5 — Cumplimiento (según F4-D)** | Si Opción B: hash-chaining + QR + envío AEAT. Si Opción A: integración/export a software homologado / gestoría | Cumplimiento Veri\*factu o integración | F4.2, decisión F4-D |
| **F4.6 — Cobro → cashflow** | Libro `factura_emitida_cobros` append-only + RPC `registrar_cobro_factura`; enganche con `presupuesto_pagos.factura_emitida_id` | Libro de cobros + RPC | F4.2 |
| **F4.7 — Gancho clínica** | Cuando exista el schema `clinica`: emitir/preparar factura desde cita/bono/`cliente_producto` vía `origen_tipo/id` | Puente clínica→factura | Clínica (otra línea) + F4.1 |

> **Regla de proceso (doc 00 §9):** no se abre F4.1 (primer código/migración) hasta que Guille valide este diseño **y** estén cerradas F4-C (criterio de exención) y F4-D (delegar vs construir).

---

## 10. Decisiones pendientes (recapitulación para Guille)

1. **⚠️ F4-A — ¿Quién puede emitir** facturas de la clínica? (`admin` sólo, o también `recepcion`).
2. **⚠️ F4-B — Cuenta de ingreso por defecto:** ¿**705** Prestación de servicios para la clínica (recomendado), reservando 700 para productos físicos?
3. **⚠️ F4-C — Criterio de exención sanitaria** (con la gestoría): mapa exención↔servicio del catálogo y si la clínica queda en **prorrata**.
4. **⚠️ F4-D — (la grande) ¿Emisor propio homologado (Veri\*factu) o delegar** la emisión oficial en software homologado / gestoría? Recomendado: **delegar para arrancar**.
5. **⚠️ F4-E — ¿Serie propia para la clínica** (p.ej. `C-2026-0001`)? Recomendado: **sí**.

*(Estas se suman a las DECISIONES 1-5 del doc 01, que no se reabren aquí: bajo qué sociedad cuelga la clínica, nº de sociedades, etc.)*

---

*Documento de diseño/auditoría. No modifica código productivo, no crea migraciones ni tipos. Imita el patrón maduro de facturas recibidas allí donde aplica. Sujeto a validación de Guille (y de la gestoría en lo fiscal) antes de abrir la sub-fase F4.1.*
