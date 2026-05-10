# Fase 4a — API Specification

> Todas las mutaciones del admin se exponen como **Server Actions** de Next.js (no REST). El booking público y los webhooks usan **Route Handlers** (REST) por requerimientos de terceros (Stripe, presigned uploads) y SEO/links firmados.

## Convenciones

- Autenticación admin: cookie httpOnly `splash.session`. Server actions verifican sesión + tenant.
- Autenticación cliente en booking público: sin auth. Operaciones firmadas con `manage_token` JWT.
- Content-Type: `application/json`.
- Errores: `{ ok: false, code: "ERROR_CODE", message: "..." }`, HTTP 4xx/5xx.
- Éxito: `{ ok: true, data: {...} }`, HTTP 2xx.
- Idempotencia: endpoints de mutación aceptan header `Idempotency-Key` (UUID); persistido en `appointment.idempotency_key`.
- Rate limiting: sliding window por IP en Redis.
- Todos los montos en **integer cents**. Porcentajes en **basis points** (bps: 1500 = 15.00%).
- Todas las fechas ISO 8601 UTC (`2026-05-12T14:30:00Z`).

---

## 1. Route Handlers (REST) — `/api/*`

### Booking público

#### `POST /api/booking/availability`
Devuelve slots disponibles.

**Request**:
```json
{
  "businessId": "uuid",
  "zoneId": "uuid",
  "date": "2026-05-12",
  "packageId": "uuid",
  "vehicleTypeId": "uuid",
  "addonIds": ["uuid", "..."]
}
```

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "durationMinutes": 135,
    "slots": [
      { "startsAt": "2026-05-12T12:00:00Z", "endsAt": "2026-05-12T14:15:00Z" },
      { "startsAt": "2026-05-12T15:00:00Z", "endsAt": "2026-05-12T17:15:00Z" }
    ]
  }
}
```

#### `POST /api/booking/price-preview`
Calcula breakdown en tiempo real durante el wizard.

**Request**:
```json
{
  "businessId": "uuid",
  "packageId": "uuid",
  "vehicleTypeId": "uuid",
  "vehicleId": "uuid?",                     // si ya identificado, para loyalty preview
  "addons": [{ "addonId": "uuid", "quantity": 1 }],
  "promoCode": "SPRING20?",
  "customerEmail": "opcional para customer match"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "lineItems": [...],
    "subtotalCents": 21499,
    "discounts": [
      { "kind": "loyalty", "label": "Loyalty Tier 1 — 15% off package", "amountCents": 2400, "snapshot": {...} }
    ],
    "subtotalAfterDiscountsCents": 19099,
    "taxCents": 1337,
    "totalCents": 20436,
    "depositAmountCents": 2000,
    "balanceDueOnServiceCents": 18436,
    "loyaltyPreview": {
      "currentVisits": 5,
      "nextRewardAtVisits": 10,
      "rewardAvailable": {...}
    }
  }
}
```

#### `POST /api/booking/draft`
Crea/actualiza un draft del wizard. Bloquea el slot 15 min.

**Headers**: `Idempotency-Key: <uuid>`

**Request**: todo el state del wizard incluyendo customer, vehicle (inline si nuevo), evidence consent booleans, line items, pricing snapshot.

**Response 201**:
```json
{
  "ok": true,
  "data": {
    "appointmentId": "uuid",
    "expiresAt": "2026-05-12T14:15:00Z",
    "priceBreakdown": {...}
  }
}
```

#### `POST /api/booking/create-payment-intent`
Crea el PaymentIntent de Stripe Connect para el depósito.

**Request**: `{ "appointmentId": "uuid" }`

**Response**:
```json
{
  "ok": true,
  "data": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentIntentId": "pi_xxx",
    "amountCents": 2000
  }
}
```

#### `POST /api/booking/confirm`
Invocado tras confirmar el pago en frontend. Poll-friendly (retorna el estado actual).

**Response**: estado actual del appointment + breakdown.

#### `GET /api/booking/manage/:token`
Resuelve token firmado → datos de la cita.

#### `POST /api/booking/manage/:token/reschedule`
#### `POST /api/booking/manage/:token/cancel`

---

### Loyalty (público, para preview en wizard)

#### `POST /api/loyalty/preview`
**Request**: `{ "businessId": "uuid", "vehicleId": "uuid", "packageId": "uuid", "includeAddons": false }`

**Response**:
```json
{
  "ok": true,
  "data": {
    "currentVisits": 8,
    "nextRewardAtVisits": 10,
    "visitsUntilNext": 2,
    "rewardAvailable": {
      "tierId": "uuid",
      "visitsRequired": 5,
      "discountType": "percentage",
      "discountValue": 1500,
      "appliesToPackages": [],
      "appliesToAddons": false,
      "estimatedSavingsCents": 2400
    }
  }
}
```

---

### Photos

#### `POST /api/photos/presign`
Emite signed URL de subida a R2.

**Request**:
```json
{
  "businessId": "uuid",
  "appointmentId": "uuid",
  "phase": "pre_service_customer",
  "mimeType": "image/jpeg",
  "bytes": 1500000,
  "slotTag": "front?",
  "note": "rayón en puerta?"
}
```

**Auth**: admin o cliente con token firmado.

**Response**:
```json
{
  "ok": true,
  "data": {
    "photoId": "uuid",
    "uploadUrl": "https://r2.cloudflarestorage.com/splash-evidence?X-Amz-...",
    "uploadHeaders": { "Content-Type": "image/jpeg" },
    "expiresIn": 300
  }
}
```

#### `POST /api/photos/:id/complete`
Confirma subida (el cliente llama tras PUT a R2). Dispara scan antivirus async.

#### `GET /api/photos/:id/url`
Devuelve signed URL de lectura, 5 min TTL. Verifica ACL.

#### `DELETE /api/photos/:id`
Soft delete. Admin only (o cliente si fase `pre_service_customer` y appointment aún no `in_progress`).

---

### Webhooks

#### `POST /api/webhooks/stripe`
Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
Verifica signature con `STRIPE_WEBHOOK_SECRET`.
Idempotente por `event.id`.

#### `POST /api/webhooks/stripe-connect`
Eventos de cuentas conectadas (onboarding status, payouts).

---

### Cron (QStash)

Protegidos con header `Upstash-Signature`.

- `POST /api/cron/reminders` — busca citas con reminders pendientes en próximos 5 min, envía.
- `POST /api/cron/no-shows` — busca citas `confirmed` que debieron empezar hace 30+ min, marca `no_show`.
- `POST /api/cron/loyalty-recount` — mensual. Reconcilia `loyalty_progress` desde `appointment` real. Alerta si drift.

---

### Health & misc

- `GET /api/health` — liveness.
- `GET /api/ready` — readiness (DB, Redis, R2, Stripe API reachability).

---

## 2. Server Actions (admin) — `/actions/*`

Mutaciones internas del panel admin. Se invocan vía `"use server"`.

### Appointment
- `createAppointmentManual(input)` — admin crea cita fuera del wizard público.
- `updateAppointmentStatus(id, newStatus, reason?)` — aplica state machine; valida transiciones.
- `addManualExtra(id, { name, priceCents, quantity, durationMinutes, reason })` — recalcula total.
- `removeItem(id, itemId, reason)` — elimina item (si no es package base).
- `updateItemPrice(id, itemId, priceCents, reason)` — override manual (starting_at confirmado, etc.).
- `rescheduleAppointment(id, newStartsAt, newResourceId?, reason)` — valida conflictos, traslada depósito.
- `cancelAppointment(id, reason, issueRefund: boolean)` — opcionalmente reembolsa via Stripe.
- `assignResource(id, resourceId)`.

### Customer / Vehicle
- `upsertCustomer(input)`.
- `mergeCustomers(keepId, removeId)`.
- `blockCustomer(id, reason)` / `unblockCustomer(id)`.
- `upsertVehicle(input)`.
- `mergeVehicles(keepId, removeId)` — traslada `loyalty_progress` y appointments.
- `archiveVehicle(id)`.

### Catalog
- `upsertPackage`, `archivePackage`, `setPackagePrice(packageId, vehicleTypeId, priceCents, durationMinutes, available)`.
- `upsertAddon`, `archiveAddon`.
- `upsertVehicleType`, `archiveVehicleType`.
- `upsertZone`, `archiveZone`, `setTravelTime(fromZoneId, toZoneId, minutes)`.
- `createPromoCode`, `updatePromoCode`, `archivePromoCode`.

### Schedule
- `upsertScheduleTemplate(dayOfWeek, windowStart, windowEnd, isActive)`.
- `assignZoneToDay(dayOfWeek, zoneId)` / `unassignZoneFromDay`.
- `createScheduleException(date, kind, payload)`.
- `createScheduleBlock(startsAt, endsAt, reason, zoneId?, resourceId?)`.
- `upsertResource`, `archiveResource`.

### Payment
- `recordPayment(appointmentId, { kind, method, amountCents, externalReference?, notes? })`.
- `issueRefund(paymentId, amountCents, reason)` — Stripe refund si deposit; sino registro manual.
- `generateReceipt(appointmentId)` — emite `receipt` + PDF + email.

### Loyalty — config y override manual (requerimiento explícito del usuario)
- `updateLoyaltyProgram({ isActive, appliesToAddons, countPackagesOnly, autoApply, resetOnRedemption, name, description })`.
- `upsertLoyaltyTier({ id?, visitsRequired, discountType, discountValue, appliesToPackageIds[], maxRedemptionsPerVehicle, displayOrder, isActive })`.
- `deleteLoyaltyTier(tierId)`.
- `adjustVehicleLoyaltyCounter(vehicleId, delta, reason)` — crea `loyalty_adjustment`, actualiza `loyalty_progress` atómicamente, audit log.
- `grantManualReward(appointmentId, tierId?, { discountType, discountValue, reason })` — crea `loyalty_redemption` con `granted_manually=true`.
- `revokeLoyaltyRedemption(redemptionId, reason)` — marca `revoked_at` + ajusta breakdown de la cita.

### Evidence
- `uploadEvidenceAsAdmin(appointmentId, phase, file)` — wrapper que llama presign + PUT + complete.
- `softDeletePhoto(photoId, reason)`.
- `toggleMarketingConsentPhoto(photoId, enabled)`.

### Settings
- `updateBusiness(patch)`.
- `updateFeatureFlags(patch)` — activa/desactiva loyalty, photos, etc.
- `updateDepositPolicy(patch)`.
- `addDomain(host)` / `removeDomain(host)`.
- `inviteUser(email, role)`.
- `removeUserFromBusiness(userId)`.
- `updateUserRole(userId, role)`.

---

## 3. Códigos de error

| Código | Significado | HTTP |
|---|---|---|
| `UNAUTHORIZED` | sin sesión | 401 |
| `FORBIDDEN` | sesión sin permiso para esa acción | 403 |
| `NOT_FOUND` | entidad no existe (o no es de este tenant) | 404 |
| `VALIDATION_ERROR` | Zod error con detalle | 400 |
| `SLOT_CONFLICT` | slot reservado por otro | 409 |
| `DOUBLE_BOOKING` | EXCLUDE constraint Postgres | 409 |
| `DEPOSIT_ALREADY_PAID` | intento de re-cobrar depósito | 409 |
| `FEATURE_DISABLED` | feature flag off (ej. loyalty disabled) | 403 |
| `RATE_LIMITED` | límite excedido | 429 |
| `STRIPE_ERROR` | wrap de Stripe error | 402/4xx |
| `IDEMPOTENCY_MISMATCH` | misma key, distinto body | 422 |
| `PHOTO_VIRUS_DETECTED` | antivirus flagged | 422 |
| `INVALID_STATE_TRANSITION` | state machine | 409 |

---

## 4. Feature flags resueltos

Todo endpoint respeta `business.features`:

```ts
type BusinessFeatures = {
  loyalty: boolean;
  photos: boolean;
  promo_codes: boolean;
  multiple_resources: boolean;
  custom_domain: boolean;
  sms: boolean;
  google_calendar: boolean;
};
```

- Si `loyalty === false`: `POST /api/loyalty/preview` devuelve `{ rewardAvailable: null }` y el wizard oculta banners. Admin UI oculta panel de loyalty en detalle de cita. Config en settings queda como read-only con CTA "Enable".
- Si `photos === false`: paso 7 del wizard se omite; `POST /api/photos/*` devuelve `FEATURE_DISABLED`.
- Etc.

Los flags son **source of truth** para el comportamiento; nunca hardcode.

---

## 5. Seguridad por endpoint

| Endpoint | Auth | Rate limit |
|---|---|---|
| `/api/booking/*` | none (tenant via host) | 10/min por IP |
| `/api/booking/create-payment-intent` | none | 5/min por IP |
| `/api/loyalty/preview` | none | 30/min por IP |
| `/api/photos/presign` | admin OR signed client token | 30/min por IP |
| `/api/photos/:id/url` | admin OR signed client token | 60/min por IP |
| `/api/webhooks/stripe` | Stripe signature | no limit (idempotent) |
| `/api/cron/*` | Upstash signature | no limit |
| Server Actions admin | cookie session + tenant + role | 60/min por user |

---

Siguiente: código en `apps/web` y `packages/db`.
