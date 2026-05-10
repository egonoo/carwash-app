# Fase 1 — Arquitectura Consolidada (Splash SaaS)

> Este documento reemplaza cualquier versión anterior. Integra, en una sola arquitectura coherente, los 5 pilares acumulados:
>
> 1. Sistema de reservas por zonas y agenda dinámica
> 2. Pagos con depósito de $20 (config.)
> 3. Panel admin completo
> 4. Programa de lealtad por vehículo (tiers 5 y 10)
> 5. Evidencia fotográfica multi-fase (pre-service, in-progress, post-service)
>
> No hay parches. Todo se modela desde la base.

---

## Índice

1. [Visión de sistema en una página](#1-visión-de-sistema-en-una-página)
2. [Dominios de negocio](#2-dominios-de-negocio)
3. [Stack técnico](#3-stack-técnico)
4. [Topología y routing](#4-topología-y-routing)
5. [Estructura del proyecto](#5-estructura-del-proyecto)
6. [Multi-tenancy (RLS)](#6-multi-tenancy-rls)
7. [Modelo de datos de alto nivel (ERD)](#7-modelo-de-datos-de-alto-nivel-erd)
8. [Motor de disponibilidad](#8-motor-de-disponibilidad)
9. [Lógica de precios centralizada](#9-lógica-de-precios-centralizada)
10. [Programa de lealtad por vehículo](#10-programa-de-lealtad-por-vehículo)
11. [Evidencia fotográfica](#11-evidencia-fotográfica)
12. [Flujo de estados de la cita (state machine)](#12-flujo-de-estados-de-la-cita-state-machine)
13. [Flujo de pago (depósito + saldo)](#13-flujo-de-pago-depósito--saldo)
14. [Notificaciones y jobs](#14-notificaciones-y-jobs)
15. [Seguridad y cumplimiento](#15-seguridad-y-cumplimiento)
16. [Observabilidad](#16-observabilidad)
17. [Despliegue y entornos](#17-despliegue-y-entornos)
18. [Costes estimados](#18-costes-estimados)

---

## 1. Visión de sistema en una página

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                SPLASH SaaS                                │
│                                                                           │
│  ┌──────────── Tenant (business) ─────────────────────────────────────┐  │
│  │                                                                     │  │
│  │   IDENTITY           CATALOG            SCHEDULING                  │  │
│  │   ─────────          ────────           ──────────                  │  │
│  │   business           vehicle_type       schedule_template           │  │
│  │   user               package            schedule_exception          │  │
│  │   customer           package_price      zone                        │  │
│  │   vehicle            addon              zone_travel_time            │  │
│  │                      promo_code         resource                    │  │
│  │                                                                     │  │
│  │   OPERATIONS                         FINANCIAL                      │  │
│  │   ──────────                         ─────────                      │  │
│  │   appointment                        payment                        │  │
│  │   appointment_item                   applied_discount               │  │
│  │   appointment_status_history         loyalty_program                │  │
│  │   evidence_photo                     loyalty_tier                   │  │
│  │   evidence_consent                   loyalty_progress               │  │
│  │   notification                       loyalty_redemption             │  │
│  │   audit_log                          receipt                        │  │
│  │                                                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  RLS por business_id en cada tabla — un tenant no ve datos de otro       │
└───────────────────────────────────────────────────────────────────────────┘
          ▲                                         ▲                 ▲
          │                                         │                 │
 ┌────────┴────────┐              ┌────────────────┴───────┐   ┌─────┴──────┐
 │ Booking público  │              │ Panel Admin (PWA)     │   │ Webhooks   │
 │ {slug}.splash.app│              │ app.splash.app        │   │ Cron jobs  │
 │ no auth          │              │ auth required         │   │            │
 │ 7 pasos +        │              │ agenda, órdenes,      │   │ Stripe,    │
 │ fotos + pago     │              │ lealtad, pagos,       │   │ Twilio,    │
 │                  │              │ reportes, fotos       │   │ QStash     │
 └──────────────────┘              └───────────────────────┘   └────────────┘
```

---

## 2. Dominios de negocio

El sistema se descompone en **6 dominios** con fronteras claras. Cada dominio tiene un módulo en código (`lib/<domain>/`) y un conjunto de tablas.

| Dominio | Responsabilidad | Entidades principales |
|---|---|---|
| **Identity** | Quién es quién: negocio (tenant), usuarios internos, clientes finales, sus vehículos. | `business`, `user`, `customer`, `vehicle` |
| **Catalog** | Qué se vende y dónde: paquetes, precios por vehículo, add-ons, zonas geográficas, promo codes. | `vehicle_type`, `package`, `package_price`, `addon`, `zone`, `zone_travel_time`, `promo_code` |
| **Scheduling** | Cuándo y con qué capacidad: horarios, excepciones, recursos (unidades de servicio). | `schedule_template`, `schedule_exception`, `resource` |
| **Operations** | Qué está ocurriendo: citas, sus ítems, evidencia, notificaciones, auditoría. | `appointment`, `appointment_item`, `appointment_status_history`, `evidence_photo`, `evidence_consent`, `notification`, `audit_log` |
| **Financial** | Dinero y descuentos: pagos, descuentos aplicados, recibos. | `payment`, `applied_discount`, `receipt` |
| **Loyalty** | Fidelización por vehículo: programa, tiers, progreso, redenciones. | `loyalty_program`, `loyalty_tier`, `loyalty_progress`, `loyalty_redemption` |

### Relaciones cardinales críticas

```
business  1──*  user
business  1──*  customer
business  1──*  vehicle
customer  1──*  vehicle                  ← cliente puede tener varios vehículos
business  1──*  appointment
customer  1──*  appointment
vehicle   1──*  appointment              ← el vehículo es anchor de lealtad
appointment 1──*  appointment_item
appointment 1──*  payment
appointment 1──*  evidence_photo
appointment 1──1  evidence_consent
appointment 1──*  applied_discount
appointment 1──*  appointment_status_history
appointment 0──1  loyalty_redemption     ← una cita puede redimir un tier
appointment 0──1  receipt
vehicle   1──1  loyalty_progress         ← contador atado al vehículo
vehicle   1──*  loyalty_redemption
loyalty_program 1──*  loyalty_tier
```

---

## 3. Stack técnico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend + Backend | **Next.js 15 App Router** + TypeScript + React 19 | Un solo deploy, RSC, Server Actions, SSR en booking público para SEO. |
| DB | **PostgreSQL 16** (Neon serverless) | RLS, JSONB, `btree_gist` para no-overlap, branching por PR. |
| ORM | **Prisma 5** | Type-safe, migraciones versionadas. RLS en DB, no en ORM. |
| Auth | **Auth.js v5** (admins con password+TOTP, clientes con magic link opcional) | Cookies httpOnly, rotación al login. |
| Pagos | **Stripe Connect Standard** (cobros del negocio) + **Stripe Billing** (suscripción del SaaS) | Cuentas separadas para no mezclar flujos. |
| Storage | **Cloudflare R2** | Signed URLs, cero egress, organizado por `{business_id}/...`. |
| Email | **Resend** + **React Email** | Templates en JSX, alta entregabilidad. |
| SMS | **Twilio** | Recordatorios, "en camino", confirmación. |
| Calendar | **Google Calendar API** (OAuth por tenant) | Eventos auto en el calendario del dueño. |
| Jobs programados | **Upstash QStash** | Recordatorios, check-no-show, sin servidor. |
| Rate limit / cache | **Upstash Redis** | Cache de slots disponibles, rate limiting. |
| UI | **Tailwind v4** + **shadcn/ui** + **Radix** | Mobile-first, accesible. |
| Forms | **React Hook Form** + **Zod** | Mismo schema cliente y servidor. |
| Maps | **Mapbox GL** | Autocomplete de dirección, rutas del día. |
| i18n | **next-intl** (ES/EN desde día 1) | El mercado hispano de detailing es enorme. |
| PWA | next-pwa + IndexedDB | Admin offline en campo. |
| Observability | **Sentry** + **Vercel Analytics** + **Axiom** | Errores, web vitals, logs estructurados. |
| Testing | **Vitest** + **Playwright** | Unit + E2E del flujo de booking. |
| Hosting | **Vercel** (app) + **Neon** (DB) + **R2** (storage) | Serverless, bajo costo inicial. |

---

## 4. Topología y routing

```
Edge / CDN (Vercel)
  │
  ▼ host-based routing en middleware.ts
  │
  ├── splash.app / www.splash.app          → (marketing) pública
  ├── app.splash.app                       → (admin) auth required
  ├── api.splash.app                       → API / webhooks
  └── {slug}.splash.app                    → (booking) público del tenant
     ├── {custom-domain}.com               → lookup en `business_domain`, mismo renderer
```

### Mapa de dominios del DNS

- Wildcard CNAME `*.splash.app → vercel`
- Custom domains (plan pro): el negocio apunta su DNS a Vercel; Splash provisiona cert automáticamente; lookup en `business_domain` resuelve al tenant.

---

## 5. Estructura del proyecto

```
/apps/web
  /app
    /(marketing)/                    # splash.app
    /(booking)/[slug]/               # subdominio: {slug}.splash.app
      /page.tsx                      # landing del negocio (SEO)
      /book/page.tsx                 # wizard 8 pasos (con evidencia fotográfica)
      /confirm/[id]/page.tsx
      /manage/[token]/page.tsx       # reagenda/cancela vía signed token
      /gallery/[token]/page.tsx      # galería privada del cliente (fotos after)
    /(admin)/                        # app.splash.app
      /layout.tsx                    # guard: requiere session + tenant
      /today/page.tsx                # vista "Hoy" con ruta
      /dashboard/page.tsx
      /schedule/page.tsx             # calendario drag-and-drop
      /appointments/
        /page.tsx
        /[id]/page.tsx               # detalle — incluye fotos + pagos + lealtad
      /customers/
        /page.tsx
        /[id]/page.tsx               # detalle + sus vehículos
      /vehicles/[id]/page.tsx        # historial de servicios + progreso de lealtad
      /packages/page.tsx
      /addons/page.tsx
      /zones/page.tsx
      /payments/page.tsx
      /loyalty/page.tsx              # config programa + redenciones
      /reports/page.tsx
      /settings/
        /page.tsx
        /billing/page.tsx
        /team/page.tsx
        /integrations/page.tsx
        /loyalty/page.tsx            # alt path
    /api
      /webhooks/
        /stripe/route.ts
        /stripe-connect/route.ts
        /twilio/route.ts
      /cron/
        /reminders/route.ts
        /no-shows/route.ts
        /loyalty-recount/route.ts    # job de reconciliación mensual
      /photos/
        /presign/route.ts            # POST → signed upload URL
        /[id]/url/route.ts           # GET → signed view URL
        /[id]/route.ts               # DELETE (soft)
      /loyalty/preview/route.ts      # GET progreso + reward disponible
      /health/route.ts
  /actions                           # Server Actions
    /booking.ts                      # createDraft, confirmDeposit, reschedule, cancel
    /appointment.ts                  # updateStatus, addExtra, assignResource
    /customer.ts                     # upsertCustomer, mergeCustomers
    /vehicle.ts                      # upsertVehicle, mergeVehicles
    /package.ts
    /addon.ts
    /zone.ts
    /schedule.ts
    /payment.ts                      # registerFinalPayment
    /evidence.ts                     # presignUpload, attach, consent
    /loyalty.ts                      # configure, previewForBooking, redeem
    /promo.ts
  /lib
    /db.ts                           # Prisma + RLS wrapper
    /tenant.ts
    /rls.ts
    /auth.ts
    /stripe.ts
    /resend.ts
    /twilio.ts
    /calendar.ts
    /storage/r2.ts                   # upload presign, signed URL, scan
    /availability/
      /engine.ts                     # motor de slots
      /travel.ts
      /conflicts.ts
    /pricing/
      /engine.ts                     # cálculo centralizado del total
      /rules.ts                      # orden de aplicación de descuentos
    /loyalty/
      /progress.ts                   # recomputar contador
      /eligibility.ts                # ¿tiene reward este vehículo?
      /redeem.ts                     # materializar redención en la cita
    /evidence/
      /upload.ts                     # validación de mime/size
      /exif.ts                       # scrub de EXIF GPS
      /consent.ts
    /notifications/
      /email.ts
      /sms.ts
      /schedule.ts                   # enqueue a QStash
    /audit.ts
    /pricing.ts
    /rate-limit.ts
    /i18n.ts
  /components
    /booking/                        # wizard público
      /StepZone.tsx
      /StepDateTime.tsx
      /StepVehicleType.tsx
      /StepVehicleIdentity.tsx       # vehículo específico (VIN/plate/make/model)
      /StepPackage.tsx
      /StepAddons.tsx
      /StepCustomer.tsx
      /StepPhotos.tsx                # evidencia pre-service
      /StepReview.tsx
      /StepPayment.tsx
      /LoyaltyBanner.tsx
    /admin/
      /TodayRoute.tsx                # vista "Hoy" con ruta y botones grandes
      /ScheduleBoard.tsx
      /AppointmentDetail/
        /index.tsx
        /PhotoGallery.tsx            # tabs: pre-customer / pre-admin / in-progress / post
        /PaymentsPanel.tsx
        /LoyaltyPanel.tsx
        /ExtrasPanel.tsx
      /VehicleCard.tsx
      /LoyaltyConfig.tsx
      /ReceiptPrint.tsx              # 80mm + A4
    /ui/                             # shadcn primitives
    /email/                          # React Email templates
  /messages                          # i18n
  /middleware.ts
/packages
  /db/prisma/
    /schema.prisma
    /migrations/
    /seed.ts
  /schemas                           # Zod compartidos
  /ui
/infra
  /sql
    /rls-policies.sql
    /exclusion-constraints.sql       # no_resource_overlap via btree_gist
    /functions.sql
/tests
  /e2e
  /unit
/docs (este directorio)
```

---

## 6. Multi-tenancy (RLS)

Todas las tablas de negocio llevan `business_id UUID NOT NULL`. RLS en Postgres bloquea lecturas y escrituras cross-tenant:

```sql
-- Para cada tabla con business_id:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_select ON <table> FOR SELECT
  USING (business_id = current_setting('app.current_business_id', true)::uuid);
CREATE POLICY tenant_isolation_mod ON <table> FOR ALL
  USING (business_id = current_setting('app.current_business_id', true)::uuid)
  WITH CHECK (business_id = current_setting('app.current_business_id', true)::uuid);
```

En la capa de app:

```ts
// lib/rls.ts
export function withTenant<T>(businessId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_business_id', ${businessId}::text, true)`;
    return fn(tx);
  });
}
```

Toda Server Action y route handler envuelve sus queries en `withTenant(businessId, ...)`. El `businessId` viene de:

- Booking público: del slug resuelto por middleware (confiable, chequeado contra tabla `business`).
- Admin: de `session.activeBusinessId` (el usuario puede pertenecer a varios negocios con rol distinto).

El rol de DB de la app (`splash_app`) **NO** tiene `BYPASSRLS`. Un bug en el código no puede escapar el aislamiento.

---

## 7. Modelo de datos de alto nivel (ERD)

```
┌────────────┐      ┌───────────────┐     ┌────────────────┐
│ business   │──1:*─│ user_business │──*:1│ user           │
│            │      └───────────────┘     └────────────────┘
│            │
│            │──1:*─ vehicle_type
│            │──1:*─ package ──1:*─ package_price ──*:1── vehicle_type
│            │──1:*─ addon
│            │──1:*─ zone ──*:*── (zone_travel_time)
│            │──1:*─ resource
│            │──1:*─ schedule_template
│            │──1:*─ schedule_exception
│            │──1:*─ promo_code
│            │
│            │──1:*─ customer ──1:*─ vehicle ──1:1─ loyalty_progress
│            │                            │
│            │                            └────*:1── vehicle_type
│            │
│            │──1:1─ loyalty_program ──1:*─ loyalty_tier
│            │
│            │──1:*─ appointment
│                         │
│                         ├──*:1── customer
│                         ├──*:1── vehicle
│                         ├──*:1── zone
│                         ├──*:1── resource
│                         │
│                         ├──1:*── appointment_item
│                         ├──1:*── applied_discount
│                         ├──1:*── appointment_status_history
│                         ├──1:*── payment
│                         ├──1:*── evidence_photo
│                         ├──1:1── evidence_consent
│                         ├──1:1── receipt
│                         └──0:1── loyalty_redemption
└────────────┘
```

Detalle completo de columnas, constraints, índices y RLS: ver [`03-database-schema.sql`](./03-database-schema.sql).

---

## 8. Motor de disponibilidad

Se invoca desde el wizard ("¿qué slots tengo el jueves en la zona Kendall para un Full Detail en SUV grande con 2 add-ons?").

### Entradas

```ts
type AvailabilityQuery = {
  businessId: string;
  zoneId: string;
  date: Date;              // en TZ del negocio
  packageId: string;
  vehicleTypeId: string;
  addonIds: string[];      // cada add-on puede sumar duración
};
```

### Algoritmo (resumen)

1. Resolver la configuración efectiva del día:
   - Buscar `schedule_exception` para esa `date` → si override, usar.
   - Si no, usar `schedule_template` del `day_of_week`.
2. Verificar que la zona esté incluida en el día (`schedule_zone_assignment`).
3. Calcular `duration = package_price.duration + Σ addon.duration_minutes`.
4. Para cada ventana de trabajo del día y cada `resource`:
   - Generar slots cada 15 min.
   - Descartar los que se solapen con citas existentes (`status not in (cancelled, no_show)`).
   - Descartar los que no dejen tiempo de viaje desde/hacia cita adyacente (`zone_travel_time`).
5. Deduplicar por `start_time` (basta que 1 recurso esté libre).
6. Cachear 60s en Redis por `(businessId, date, zoneId, packageId, vehicleTypeId, addonIds hash)`.

### Anti-double-booking (DB-level)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointment
  ADD CONSTRAINT appointment_no_resource_overlap
  EXCLUDE USING gist (
    business_id WITH =,
    resource_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show', 'draft', 'rescheduled'));
```

La DB rechaza a nivel de integridad cualquier solape. Es la red de seguridad final si el motor de disponibilidad tiene un bug.

---

## 9. Lógica de precios centralizada

**Un solo punto de cálculo**: `lib/pricing/engine.ts`. Se invoca en:

- Wizard (vista previa en tiempo real).
- Creación de cita (snapshot definitivo a DB).
- Recalculación cuando admin agrega extras.
- Emisión de recibo.

### Orden de aplicación (determinístico)

```
1. LINE ITEMS (base, con snapshot de precio al momento)
   + package_line (package × vehicle_type → price_cents, duration)
   + cada add-on (fixed | starting_at → min | per_unit × qty | quote_on_site → $0)
   + cada manual_extra (admin lo agrega; precio libre)

2. SUBTOTAL = Σ line_items.line_total_cents

3. DESCUENTOS (se aplican en este orden)
   a. Loyalty (si reward available y admin no lo bloqueó)
      → applies_to_packages: solo descuenta la porción del subtotal que sea de package
      → applies_to_addons: incluye addons si el config lo permite
      → snapshot del tier al applied_discount
   b. Promo code (si el cliente ingresó uno válido)
      → idem, respeta applies_to_*
   c. Manual discount del admin (con motivo obligatorio — queda en audit_log)

4. SUBTOTAL_AFTER_DISCOUNTS = SUBTOTAL - Σ discounts

5. TAX = SUBTOTAL_AFTER_DISCOUNTS × tax_rate (config. por zona/negocio)

6. TOTAL = SUBTOTAL_AFTER_DISCOUNTS + TAX

7. DEPOSIT (ya cobrado cuando se confirmó la cita)
   → deposit_policy del paquete o global (fixed | percentage)

8. BALANCE_DUE = TOTAL - deposit_paid_cents - Σ payments_before_final
```

### Reglas del engine

- **Todo en `integer cents`** (nunca floats).
- **Todo con snapshot**: el precio que el cliente vio al reservar es el que queda en la cita, incluso si el admin sube precios después.
- **Idempotente**: invocar el engine dos veces con los mismos inputs da el mismo output (excepto cuando el admin agrega extras — eso cambia inputs).
- **Trazable**: devuelve no sólo `total`, sino `breakdown` con cada línea y cada descuento nombrado. La UI y el recibo usan ese breakdown.

### Ejemplo de breakdown

```json
{
  "line_items": [
    { "kind": "package", "name": "Car Wash + Interior Detail", "vehicle_type": "XL SUV", "unit_price_cents": 15999, "quantity": 1, "line_total_cents": 15999 },
    { "kind": "addon", "name": "Pet hair removal", "pricing_mode": "starting_at", "unit_price_cents": 1500, "quantity": 1, "line_total_cents": 1500, "note": "starting at — admin to confirm" },
    { "kind": "addon", "name": "Rims detail", "pricing_mode": "per_unit", "unit_price_cents": 1000, "quantity": 4, "line_total_cents": 4000 }
  ],
  "subtotal_cents": 21499,
  "discounts": [
    { "kind": "loyalty", "tier_visits_required": 5, "discount_type": "percentage", "discount_value": 15, "applies_to_addons": false, "amount_cents": 2400, "description": "Loyalty tier 1 — 15% off package" }
  ],
  "subtotal_after_discounts_cents": 19099,
  "tax_rate": 0.07,
  "tax_cents": 1337,
  "total_cents": 20436,
  "deposit_policy": { "type": "fixed", "amount_cents": 2000 },
  "deposit_paid_cents": 2000,
  "balance_due_cents": 18436
}
```

---

## 10. Programa de lealtad por vehículo

### Principios

1. **Contador atado al `vehicle_id`**, no al `customer_id`. Un cliente con 3 carros tiene 3 contadores.
2. **Solo citas `completed`** incrementan. `cancelled`, `no_show`, `rescheduled` no suman ni restan. Si admin corrige `completed → cancelled`, trigger decrementa.
3. **Tiers configurables** por negocio (default: tier 1 a 5 visitas, tier 2 a 10 visitas). Se pueden agregar más tiers.
4. **Aplicación automática** con opt-out visible en el wizard.
5. **Snapshot** del tier al momento de redimir: el cliente no pierde la recompensa si admin cambia el programa mañana.

### Datos

```
loyalty_program (1:1 con business)
  ├── is_active
  ├── applies_to_addons (bool)
  ├── count_packages_only (bool — ¿sólo paquetes cuentan como "visita"?)
  ├── reset_on_redemption (bool)
  └── tiers: loyalty_tier[]
      ├── visits_required (int)
      ├── discount_type ('percentage' | 'fixed')
      ├── discount_value (int — % o cents)
      ├── applies_to_packages (uuid[] — lista de paquetes)
      ├── max_redemptions_per_vehicle (int — ej. 1 para tier 10)
      └── display_order

loyalty_progress (1:1 con vehicle)
  ├── completed_visits (int)
  └── last_completed_appointment_id

loyalty_redemption (N por vehicle)
  ├── appointment_id
  ├── tier_id, tier_snapshot_json (copia del tier al redimir)
  ├── discount_applied_cents
  └── visit_count_at_redemption
```

### Integridad

- Trigger `AFTER UPDATE ON appointment`: si `status` cambió a `completed`, incrementa `loyalty_progress.completed_visits` y graba `last_completed_appointment_id`.
- Trigger también maneja el caso inverso (undo): si pasa de `completed` a otro estado, decrementa (clamp a 0).
- Job mensual de reconciliación: recuenta todos los `loyalty_progress` desde cero y loggea diferencias. Alerta si hay drift.

### Eligibilidad

```ts
function getEligibleReward(vehicleId, packageId): Reward | null {
  const program = getProgram(businessId);
  if (!program.is_active) return null;
  const progress = getProgress(vehicleId);
  
  // Buscar el tier cuyos visits_required ≤ completed_visits
  // y que aún no haya alcanzado max_redemptions_per_vehicle
  // y que aplique a packageId
  const eligibleTiers = program.tiers
    .filter(t => progress.completed_visits >= t.visits_required)
    .filter(t => t.applies_to_packages.includes(packageId))
    .filter(t => getRedemptionCount(vehicleId, t.id) < t.max_redemptions_per_vehicle);

  // Devolver el de mayor descuento (el tier más alto elegible)
  return pickBestReward(eligibleTiers);
}
```

### Aplicación

En el checkout, `lib/pricing/engine.ts` recibe `vehicleId` y `packageId`, invoca `getEligibleReward`, y si hay, agrega un `applied_discount` con `kind='loyalty'` y un snapshot del tier.

### Redención

Al confirmar el pago del depósito (cita pasa a `confirmed`), si el breakdown tiene descuento de lealtad, se inserta `loyalty_redemption` enlazada a la cita. Esto es atómico — parte de la misma transacción que crea la cita.

Si la cita luego se cancela, la redención se marca como `revoked_at`, y el tier deja de contar contra `max_redemptions_per_vehicle`.

### Admin — UI del programa

- Settings → Loyalty:
  - Toggle activo
  - Lista de tiers editables (visits_required, discount_type, discount_value, packages, max_redemptions)
  - Toggle aplicar a addons
  - Botón "Agregar tier"
  
- Vista del vehículo (`/vehicles/[id]`):
  - Badge: "Loyalty: 8 completed · 2 to go for Tier 2 (25% off)"
  - Progress bar
  - Histórico: cada cita con el descuento aplicado en su momento.

- Vista de la cita (`/appointments/[id]`):
  - Panel "Loyalty": si se usó, muestra el tier redimido y la fecha; admin puede revocar manualmente con motivo.

- Acción manual: admin puede otorgar una redención fuera de programa ("Grant reward") — queda en audit_log.

---

## 11. Evidencia fotográfica

### Fases

| Fase | Quién sube | Cuándo | Default |
|---|---|---|---|
| `pre_service_customer` | cliente | en el wizard (paso 7) | mínimo 1 foto requerida, config. por negocio |
| `pre_service_admin` | admin | al llegar al lugar | opcional |
| `in_progress` | admin | durante | opcional |
| `post_service` | admin | al finalizar | recomendado; dispara email con galería al cliente |

### Almacenamiento

- **R2 bucket**: `splash-evidence`
- **Key structure**: `{business_id}/appointments/{appointment_id}/{phase}/{uuid}.{ext}`
- **Metadata en S3**: `x-amz-meta-uploaded-by`, `x-amz-meta-phase`, `x-amz-meta-appointment-id`
- **Signed upload URL**: 5 min TTL, restringido a mime permitido, content-length max
- **Signed view URL**: 5 min TTL, emitido tras verificar ACL en backend

### Validación al subir

| Regla | Valor default | Configurable por negocio |
|---|---|---|
| Mime | JPEG, PNG, HEIC, WebP | No |
| Tamaño máx. | 10 MB | Sí |
| Min fotos cliente | 1 | Sí (0 si opcional) |
| Max fotos cliente | 12 | Sí |
| Max fotos admin por fase | 30 | Sí |
| Total máx. por cita | 50 | Hardcoded |
| Compresión | 2048px max edge, JPEG q=80 | En cliente via canvas/sharp, fallback server |
| EXIF | Scrub GPS antes de guardar | Sí (admin puede conservar) |
| Antivirus | ClamAV async worker | Sí |

### Consentimiento

Tabla `evidence_consent` (1:1 con appointment):

```
appointment_id,
customer_signed_current_state (bool, obligatorio al reservar),
marketing_use_consent (bool, opcional),
signed_at, signed_ip, signed_user_agent,
text_version (string, ej. "v1.0" — el texto legal queda versionado)
```

El cliente marca en el wizard. Si marca marketing, las fotos post-service pueden usarse para promoción; si no, solo para operación.

Cliente puede revocar consentimiento marketing via link firmado en el email. Soft-delete de `marketing_consent_revoked_at` en las fotos.

### Galería del cliente

- URL firmada `/{slug}/gallery/{token}` — `token` es un JWT firmado con expiración opcional.
- Muestra solo fotos de esa cita.
- Cliente puede descargar.

### En el recibo

- No imprime las fotos.
- Línea: `Evidence: 4 pre-service photos · 6 post-service photos · splash.app/r/{token}` + QR.

### Panel admin — galería

- Componente `PhotoGallery` con tabs por fase.
- Grid responsive con thumbnails (Next.js Image + R2 signed URLs).
- Lightbox con zoom, swipe, delete (soft), agregar nota.
- Comparación side-by-side pre/post.
- Bulk upload (drag multiple).
- Botón "Take photo" → `<input type="file" accept="image/*" capture="environment">` (PWA en celular).

---

## 12. Flujo de estados de la cita (state machine)

```
                  ┌─────────┐  (wizard incompleto, expira en 1h)
                  │  draft  │
                  └────┬────┘
                       │ cliente completa wizard + deposit_intent creado
                       ▼
              ┌───────────────────┐
              │ pending_deposit   │
              └────────┬──────────┘
                       │ webhook Stripe: payment_intent.succeeded
                       │ (trigger: evidence_consent insertado, loyalty_redemption si aplica)
                       ▼
                  ┌───────────┐
                  │ confirmed │ ────────────────────────────┐
                  └─────┬─────┘                             │
                        │ admin marca "on the way"          │
                        ▼                                    │
                  ┌──────────────┐                          │
                  │ on_the_way   │                          │
                  └──────┬───────┘                          │
                         │ admin marca "arrived"            │
                         ▼                                   │
                   ┌─────────┐                              │
                   │ arrived │                              │ (desde cualquier
                   └────┬────┘                              │  estado pre-service)
                        │ admin marca "start"               │
                        ▼                                   │
                  ┌──────────────┐                          │
                  │ in_progress  │                          │
                  └──────┬───────┘                          │
                         │ admin marca "complete"           │
                         │ (trigger loyalty_progress++)     │
                         ▼                                   │
                    ┌──────────┐                            │
                    │completed │                            │
                    └──────────┘                            │
                                                            │
      ┌─────────────────┐                                   │
      │   cancelled     │ ◄─────────────────────────────────┤
      └─────────────────┘                                   │
                                                            │
      ┌─────────────────┐                                   │
      │   no_show       │ ◄─ job check_no_show (30 min past)│
      └─────────────────┘                                   │
                                                            │
      ┌─────────────────┐                                   │
      │  rescheduled    │ ◄─ admin o cliente re-agendan     │
      │  → new appt     │    (previous_appointment_id link) │
      └─────────────────┘ ──────────────────────────────────┘
```

### Reglas

- Todo cambio de estado escribe en `appointment_status_history`.
- `completed` incrementa `loyalty_progress.completed_visits` via trigger.
- `cancelled` o `no_show` tras `completed` decrementan (undo del trigger).
- `rescheduled` crea una NUEVA cita con `previous_appointment_id` = la vieja. La vieja queda en `rescheduled` (no `cancelled`), el depósito se traslada.
- Solo ciertos roles pueden saltar estados (`super_admin` bypassea el workflow para corregir errores).

---

## 13. Flujo de pago (depósito + saldo)

### Depósito

1. Cliente presiona "Pay deposit".
2. Server action `createDraftAppointment`:
   - Inserta `appointment` con `status='pending_deposit'`.
   - Computa `deposit_amount_cents` via `deposit_policy` del paquete o global (fixed $20 o %).
   - Crea Stripe `PaymentIntent` con:
     - `amount = deposit_amount_cents`
     - `currency = business.currency`
     - `transfer_data.destination = business.stripe_connect_account_id`
     - `application_fee_amount = 0` (o configurable si Splash hace takerate)
     - `metadata = { appointment_id, business_id }`
     - `idempotency_key = deposit_${appointment_id}`
   - Devuelve `clientSecret`.
3. Frontend: Stripe Elements confirma el cargo.
4. Webhook `payment_intent.succeeded`:
   - Verifica signature.
   - Busca appointment por `metadata.appointment_id`.
   - UPDATE status='confirmed', `deposit_paid_at=NOW()`.
   - INSERT `payment` kind='deposit'.
   - Si breakdown tiene loyalty → INSERT `loyalty_redemption`.
   - Enqueue: emails, SMS, Google Calendar event, reminder jobs.
   - Emite `audit_log`.
5. Frontend redirect a `/confirm/{id}`.

### Saldo final

- Admin al terminar marca `completed`.
- En el detalle de la cita, panel "Payments":
  - Ve `total`, `deposit_paid`, `balance_due`.
  - Puede agregar `manual_extra` (ej. Overspray $50).
  - Selecciona método: `cash`, `card_terminal`, `zelle`, `other`.
  - Presiona "Record payment" → INSERT `payment` kind='final' (o múltiples).
  - Si `balance_due` llega a $0, genera recibo.

### Política de no-reembolso

- Checkbox obligatorio en el wizard (`I understand the deposit is non-refundable`).
- Timestamp, IP, user-agent, versión del texto guardados en `evidence_consent.deposit_policy_accepted_at`.

### Reembolso (excepcional)

- Admin puede emitir refund del depósito en casos especiales (ej. negocio canceló por clima).
- UI en el panel → Stripe refund → INSERT `payment` kind='refund' con `amount` negativo y `stripe_refund_id`.

---

## 14. Notificaciones y jobs

### Eventos que disparan notificaciones

| Evento | Cliente recibe | Admin recibe |
|---|---|---|
| Booking confirmed (depósito cobrado) | email + SMS confirmación | push en panel |
| 24h antes | email + SMS recordatorio | — |
| 15 min antes | SMS "estamos en camino" | — |
| Admin marca arrived | SMS "we're here" | — |
| Admin marca completed | email con recibo + galería post | — |
| Cliente cancela | email a admin | email |
| Admin cancela | email al cliente | — |
| No-show detectado | email al cliente con política | email a admin |
| Loyalty tier alcanzado | email "you earned a reward!" | notif in-panel |

### Arquitectura de jobs

- Al confirmar una cita, se encolan en QStash:
  - `send_confirmation` (delay: 0)
  - `reminder_24h` (delay: starts_at - 24h)
  - `reminder_15min` (delay: starts_at - 15min)
  - `check_no_show` (delay: starts_at + 30min)
- Cada job es un POST a `/api/cron/<name>?id=<appointment_id>`, con header HMAC firmado por QStash.
- Idempotentes: si se ejecuta dos veces, no duplica.
- Al cancelar cita: se eliminan los jobs pendientes (QStash delete by schedule_id almacenado en DB).

### Tabla `notification`

Registra cada envío (éxito/fallo) para auditoría y re-envío manual.

---

## 15. Seguridad y cumplimiento

| Control | Implementación |
|---|---|
| Aislamiento tenant | RLS en cada tabla + rol `splash_app` sin `BYPASSRLS` |
| Session | Cookie `httpOnly`+`secure`+`sameSite=lax`, rotación al login, 7d expiry |
| CSRF | Token por sesión, validado en Server Actions |
| PII encryption at rest | `pgcrypto` para columnas de dirección; TLS 1.3 en tránsito |
| Secrets | Vercel env vars; rotación 90 días |
| Stripe webhook | Verificación de signature en cada POST |
| Upload de fotos | Signed URL con mime+size restrictivo; EXIF GPS scrubbed; ClamAV async |
| Access a foto | Siempre pasa por backend, verifica `business_id + user | signed_token` |
| Rate limit | Redis sliding window — booking 10/min, login 5/10min, photo upload 30/min/IP |
| Idempotencia | header `Idempotency-Key` en mutaciones críticas, UNIQUE en tabla |
| Audit log | Toda mutación de appointment/payment/price/loyalty/evidence escribe `audit_log` |
| PCI | SAQ-A (Stripe Elements, tokenización) — cero storage de tarjeta |
| GDPR/CCPA | Endpoint export + delete de customer; retention config. de fotos |
| 2FA | TOTP opcional para admins, obligatorio para owner |
| CSP | Strict CSP con nonces para scripts Stripe |
| Antivirus fotos | ClamAV worker, fotos marcadas `pending_scan` hasta limpio |

---

## 16. Observabilidad

- **Sentry**: errores de app, scrub de PII (email, phone, address, notes).
- **Vercel Analytics**: Core Web Vitals del booking público.
- **Axiom**: logs estructurados (`structured_log(event, metadata)`).
- **Dashboard interno** (Grafana embed o custom):
  - KPIs por tenant: citas/día, tasa de no-show, conversion del booking, revenue, rating.
  - Alertas: jobs stuck, deposit failures, DB connections alto.

---

## 17. Despliegue y entornos

- **local**: pnpm dev + Docker Compose (Postgres + Redis).
- **preview**: cada PR abre preview en Vercel + branch de Neon.
- **staging**: `staging.splash.app`.
- **production**: `splash.app`.

Migraciones con Prisma Migrate. Review obligatorio en PR. Aplicación en staging antes de prod. Forward-only; rollback via Neon point-in-time recovery.

---

## 18. Costes estimados

| Servicio | Mes 1 (1–5 tenants) | Mes 12 (100 tenants, 10k citas) |
|---|---|---|
| Vercel | $0–$20 | $20 |
| Neon | $0–$19 | $19 |
| Upstash (Redis + QStash) | $0 | $20 |
| R2 (fotos) | $0 (<10GB) | $15 |
| Resend | $0 | $20 |
| Twilio SMS | $10 | $100 |
| Sentry | $0 | $26 |
| Stripe | — passthrough — | — passthrough — |
| **Total fijo** | **~$10/mes** | **~$220/mes** |

---

## Siguientes pasos (espera validación del usuario)

- ✅ Fase 1 entregada en este documento.
- ⏳ Fase 2: SQL schema completo en [`03-database-schema.sql`](./03-database-schema.sql).
- ⏳ Fase 3: flujos cliente + admin en [`05-ux-design.md`](./05-ux-design.md).
- ⛔ **No se genera código hasta que el usuario valide Fases 1–3.**
