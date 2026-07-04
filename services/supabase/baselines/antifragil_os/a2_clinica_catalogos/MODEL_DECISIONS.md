# A2 Clínica Catálogos — Decisiones de modelo

Decisiones cerradas que rigen el SQL de A2. Si algo del `.sql` contradice esto, manda este documento.

## 1. `public` + prefijo `clinica_`, no esquema aparte
Coherente con todo el repo (`factura_*`, `presupuesto_*`) y sin fricción PostgREST
(exposed schemas / Accept-Profile). Justificación completa en
`docs/reservas/05-decision-esquema-datos-clinica.md`. Reversible mientras no haya datos.

## 2. Español snake_case; enums por CHECK; PK uuid; dinero numeric(14,2)
Mismas convenciones que baseline y A1. Resuelve D1 (doc 00 de reservas): español.

## 3. Fisioterapia incluye lo deportivo
Una sola categoría `fisioterapia` en `clinica_servicios.categoria` (decisión firme
2026-07-04, doc de finanzas). No hay subtipo "fisioterapia deportiva".

## 4. Cliente = ficha ADMINISTRATIVA (línea roja de compliance)
`clinica_clientes` guarda contacto, condición tarifaria, procedencia (canal) y
consentimiento RGPD. **Nada clínico**: la historia clínica vive fuera de Antifrágil OS.
`notas_admin` es explícitamente administrativa. Un futuro enlace externo controlado al
sistema clínico se decidiría aparte (no en A2).

## 5. FKs reales a `sociedades(id_ref)`
El borrador original usaba `sociedad_id_ref text` suelto. Curado: FK con
`on delete set null` en los 5 maestros. Coste cero hoy (base vacía) y evita huérfanos.
`proyecto_id_ref` no se usa en A2 (los catálogos cuelgan de sociedad; el proyecto
entrará con la cita si hace falta).

## 6. Multi-sede y multi-profesional preparados, hoy mínimos
`clinica_ubicaciones` (hoy 1), `clinica_recursos` con capacidad, `prioridad` para
asignación automática, `modo_agenda` por profesional con override por servicio.

## 7. Catálogo público vs interno
`clinica_productos` gobierna la reserva online con flags
(`visible_en_reserva_publica`, `solo_uso_interno`, `requiere_asignacion_manual`,
`requiere_confirmacion`). Founder/VIP/UG no se ofrecen online (`condicion_especial`).
`exento_iva` default `true` (decisión provisional "Clínica sin IVA" — sanitario exento;
ver docs de finanzas; pendiente de confirmación fiscal).

## 8. RLS v1 permisiva interna; endurecimiento en Fase 2
Todas las tablas con RLS ON; políticas `FOR ALL TO authenticated`; `anon` sin ninguna
política. Cuando llegue el rol `cliente` y la reserva pública (Fase 2), el acceso irá
por RPC `SECURITY DEFINER` y estas políticas se endurecerán por rol usando
`clinica_usuarios` (por eso existe ya el mapa auth→rol).

## 9. Sin RPC ni vistas en A2
A2 es solo catálogo/maestros. Las escrituras operativas con reglas (crear cita,
registrar pago) llegan con sus RPC en Fase 2, siguiendo el patrón append-only del
baseline y de A1 donde aplique.

## 10. Tabla puente sin `updated_at`
`clinica_profesional_servicios` no tiene estado propio: sin `updated_at` ni trigger.

---

### Invariantes verificables (las comprueba `post_a2_checks.sql`)
- 11 tablas `clinica_*`; RLS ON en todas; `anon` sin acceso.
- 10 triggers `touch_updated_at` (todas menos la tabla puente).
- 5 FKs a `sociedades(id_ref)` en los maestros.
- Seed = exactamente 1 ubicación (`Clínica Antifrágil Playamar`/`ANT`); resto vacío.
- Sin rastro clínico ni legacy en nombres de tabla/columna.
