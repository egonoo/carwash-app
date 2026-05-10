# Executive Summary — Car Wash SaaS ("Splash")

> Nombre sugerido del producto: **Splash** — "Mobile Car Wash Operating System".
> Tagline: *Run your mobile detail business from your phone. Your customers book in 60 seconds.*

---

## Qué es

Un SaaS multi-negocio que permite a operadores de car wash móvil (un solo dueño o flotas pequeñas) aceptar reservas online, cobrar depósitos, operar rutas por día/zona, facturar, y mantener histórico de clientes y vehículos.

Dos caras del producto:

1. **Booking público (cliente final)** — mobile-first, subdominio por negocio (`{slug}.splash.app`) o dominio propio. Flujo de 7 pasos. Pago de depósito con Stripe.
2. **Panel operador (admin)** — agenda drag-and-drop, rutas por zona, gestión de citas, recibos térmicos, dashboard financiero, integración con Google Calendar.

---

## Decisiones críticas tomadas en la Fase 1 (análisis)

| Decisión | Razón |
|---|---|
| **Postgres + RLS** en vez de DB-per-tenant | Escala a miles de negocios sin crecer O(n) en infraestructura; aislamiento verificado a nivel de base de datos. |
| **Next.js 15 App Router full-stack** en vez de backend separado | Reduce superficie operativa (un solo deploy), server actions simplifican mutaciones, SSR para SEO del booking público. |
| **Stripe Payment Intents con `capture_method=automatic`** para el depósito | El depósito de $20 es no reembolsable si el cliente cancela — se cobra inmediatamente, no se autoriza. |
| **Saldo final se cobra offline** (cash/card terminal/zelle) | El dueño lo trabaja presencialmente; forzar Stripe online sería fricción. El admin marca el pago. |
| **Slots generados bajo demanda**, no materializados | Un negocio con 50 semanas × 7 zonas × 20 slots = 7,000 filas por negocio solo de slots vacíos. Mejor calcular con `schedule_template + schedule_exception + booking`. |
| **Precios por tipo de vehículo** como tabla `package_price` (PK compuesta) | Permite "N/A" por combinación (no todo paquete aplica a todo vehículo) y ofertas por vehículo. |
| **Add-ons con `pricing_mode`**: `fixed` / `starting_at` / `manual` | Cubre "Overspray: based on car condition" sin hacks. El admin puede forzar precio al facturar. |
| **Multi-idioma desde día 1** (ES/EN) con `next-intl` | El mercado hispano de detailing en USA es enorme. Un flag después cuesta 10×. |
| **Recibo térmico 80mm + A4 PDF** | El dueño imprime in-situ con Bluetooth printer; el cliente recibe PDF por email. Dos formatos desde el inicio. |

---

## Mejoras que propongo sobre tu spec original

Ver [`01-product-analysis.md`](./01-product-analysis.md) para el detalle. Resumen:

1. **Buffer y tiempo de viaje entre zonas** — tu spec permite doble booking solo por slot, pero no considera que ir de zona A a zona B toma 30 min. Propongo `travel_time_minutes` entre zonas.
2. **Duración variable por paquete** — un Full Detail toma 4h, un Car Wash 45min. Sin esto los slots son falsos. Propongo `duration_minutes` por combinación `package × vehicle_type`.
3. **Capacidad por slot ≠ capacidad del dueño** — si trabaja solo, `capacity = 1`. Si tiene asistente, `capacity = 2` pero necesita equipo duplicado. Propongo `resources` por negocio (equipos disponibles).
4. **Depósito condicional por paquete** — cobrar $20 fijo en un servicio de $64 está bien, pero en un Paint Correction de $519 el dueño quiere depósito mayor. Propongo `deposit_type`: `fixed` o `percentage`.
5. **Re-scheduling** — tu spec dice "no reembolsable si cancela" pero no contempla re-agendar. Propongo `reschedule_policy`: permitir 1 re-agenda gratuita con >24h de aviso.
6. **Cliente recurrente** — el cliente que viene cada mes debería tener su vehículo guardado. Propongo entidad `Customer` + `Vehicle` persistente (link por email/teléfono en el booking).
7. **Fotos antes/después** — storage de imágenes por cita, con link en el recibo. Es diferenciador frente a competencia y justifica upsells de Paint Correction.
8. **Notas internas vs. notas del cliente** — separadas. El dueño anota "cliente llega tarde siempre" sin que el cliente lo vea.
9. **No-show automation** — si la cita pasa 15 min sin "Arrived", trigger recordatorio SMS; si pasa 45 min, auto-mark `no_show` + email de política.
10. **Referral / reviews** — al completar, email pidiendo review de Google + código de referido con $10 de descuento. Motor de crecimiento orgánico.
11. **Soporte offline del admin** — el dueño está en la calle con señal mala. Panel mobile debe funcionar con IndexedDB + sync cuando haya red (PWA).
12. **Audit log** — toda modificación de cita queda registrada con `user_id + timestamp + diff`. Para disputas con clientes.
13. **Programa de lealtad por vehículo** (requisito explícito) — el conteo de servicios es por `(customer, vehicle)`, no por cliente. Un cliente con 2 carros tiene dos contadores independientes. Tiers configurables (default: 5 y 10 visitas) con descuento % o flat, por paquete, con/sin add-ons. Descuento aplicado automáticamente al chequear disponibilidad de recompensa en el checkout. Trazabilidad completa de redención. Admin ve "visita actual", "próxima recompensa", e historial. Ver detalle en [`01-product-analysis.md`](./01-product-analysis.md#13-programa-de-lealtad-por-vehículo) y [`02-architecture.md`](./02-architecture.md#12-programa-de-lealtad-por-vehículo).
14. **Evidencia fotográfica multi-fase** (requisito explícito) — el cliente sube fotos del estado actual del vehículo al reservar (paso obligatorio con consentimiento). El admin puede sumar fotos al llegar al servicio, durante y al finalizar. Cada foto tiene fase (`pre_service_customer`, `pre_service_admin`, `in_progress`, `post_service`), uploader, nota opcional, timestamp, tamaño/mime validados. Almacenamiento en R2 con signed URLs. El recibo registra "evidence_photo_count > 0" pero no imprime las imágenes. Útil para protección ante disputas y para material de marketing con consentimiento. Ver detalle en [`01-product-analysis.md`](./01-product-analysis.md#14-evidencia-fotográfica-multi-fase) y [`02-architecture.md`](./02-architecture.md#13-evidencia-fotográfica-multi-fase).

---

## Fases del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Análisis + mejoras | ✅ [`01-product-analysis.md`](./01-product-analysis.md) |
| 2 | Arquitectura + DB + API | ✅ [`02-architecture.md`](./02-architecture.md), [`03-database-schema.sql`](./03-database-schema.sql), [`04-api-spec.md`](./04-api-spec.md) |
| 3 | UX/UI | ✅ [`05-ux-design.md`](./05-ux-design.md) |
| 4 | Código producción | ⏳ Pendiente confirmación usuario (roadmap en [`06-roadmap.md`](./06-roadmap.md)) |
| 5 | Deploy + operación | ⏳ |

---

## Números de referencia

- **MVP construible en**: 6–8 semanas a tiempo completo (1 ingeniero).
- **Coste de hosting mes 1** (1–5 negocios activos): $0–$25/mes (Vercel Hobby, Neon free, Stripe por transacción).
- **Coste mes 12** (100 negocios, 10k citas/mes): ~$180/mes infra + 2.9% + $0.30 por cobro Stripe.
- **Modelo de ingresos del SaaS**: flat $49/mes por negocio + $0.50 por cita confirmada (opcional). O takerate 2% de GMV.
