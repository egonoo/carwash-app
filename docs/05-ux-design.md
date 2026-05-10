# Fase 3 — Flujos UX: Cliente + Admin

Este documento cubre los dos flujos completos del sistema, integrando los 5 pilares (reservas, pagos, admin, lealtad, evidencia). Incluye pantallas, estados, validaciones, mensajes de error, y casos límite.

---

## Índice

1. [Principios de diseño](#1-principios-de-diseño)
2. [Design tokens](#2-design-tokens)
3. [Flujo del cliente — booking público](#3-flujo-del-cliente--booking-público)
4. [Flujo del cliente — gestión post-reserva](#4-flujo-del-cliente--gestión-post-reserva)
5. [Flujo del admin — operación diaria](#5-flujo-del-admin--operación-diaria)
6. [Flujo del admin — configuración del negocio](#6-flujo-del-admin--configuración-del-negocio)
7. [Flujo del admin — día del servicio](#7-flujo-del-admin--día-del-servicio)
8. [Edge cases y mensajes de error](#8-edge-cases-y-mensajes-de-error)

---

## 1. Principios de diseño

1. **Mobile-first absoluto**. El 85% del tráfico del booking será celular. El admin también opera desde celular en campo. Desktop es secundario.
2. **1 decisión por pantalla en el wizard**. Cada paso pide una cosa. Cognitive load bajo.
3. **Feedback inmediato**. Precio se actualiza en vivo; disponibilidad, descuentos, duración — todo se ve antes de continuar.
4. **Nunca bloquear al usuario con spinner infinito**. Timeouts claros, fallbacks, retry explícito.
5. **Confianza visible**: fotos del trabajo, rating de Google embed, número de servicios completados este mes.
6. **Field mode para admin**: UI grande, pocos clics, funciona offline, trabajable con una mano.
7. **No enseñar data innecesaria**. El cliente no ve `appointment.id` ni `resource_id`; el admin no ve `customer.address_line1_enc`.
8. **Accesibilidad WCAG AA**: contraste 4.5:1, focus visible, teclado navegable, screen-reader friendly.

---

## 2. Design tokens

```
Colors (brand-configurable per tenant)
  primary:       #0A84FF  (azul Splash default; configurable por negocio)
  primary-ink:   #0057D9
  accent:        #00C48C  (verde éxito / lealtad)
  warning:       #FFB020
  danger:        #E03131
  neutral-0:     #FFFFFF
  neutral-50:    #F5F7FA
  neutral-100:   #ECEFF4
  neutral-400:   #9AA4B2
  neutral-700:   #3B4354
  neutral-900:   #0F1724

Typography
  display:       Inter 32px/40px bold
  heading:       Inter 24px/32px semibold
  body:          Inter 16px/24px regular
  small:         Inter 14px/20px regular
  caption:       Inter 12px/16px medium uppercase

Spacing (4pt scale)
  xs: 4   sm: 8   md: 16   lg: 24   xl: 32   2xl: 48   3xl: 64

Radius
  sm: 6   md: 10   lg: 16   xl: 24   pill: 999

Elevation
  card:    0 1px 2px rgba(15,23,36,0.04), 0 4px 12px rgba(15,23,36,0.06)
  popover: 0 8px 24px rgba(15,23,36,0.12)
  modal:   0 24px 48px rgba(15,23,36,0.18)

Motion
  snap:    120ms ease-out
  glide:   240ms cubic-bezier(0.2,0.8,0.2,1)
  page:    320ms cubic-bezier(0.2,0.8,0.2,1)

Touch target
  minimum 44×44 px (WCAG)
```

Componentes base: shadcn/ui (Radix + Tailwind). Custom a nivel de tema.

---

## 3. Flujo del cliente — booking público

URL: `{slug}.splash.app/book` (mobile-first, responsive).

### 3.1 Landing del negocio (`{slug}.splash.app`)

Contenido:

- Hero con nombre del negocio, logo, tagline, rating de Google embed, botón `Book now`.
- Gallery de trabajos recientes (fotos post-service con marketing consent).
- "How it works": 3 pasos ilustrados.
- Precios (tabla resumen por vehicle type, link "ver todos los paquetes").
- Trust markers: "340 services this month · 4.9★ rating · $20 deposit, never surprise fees".
- Footer: teléfono (tap-to-call), WhatsApp link, Instagram, dirección.

### 3.2 Wizard de reserva — 8 pasos

Layout común:

- Header fijo: logo pequeño + progress bar (`Step 3 of 8`) + back button.
- Contenido: 1 pregunta por pantalla.
- Footer fijo: resumen sticky (`$129.99 · approx 2h15m · next: Add-ons →`). En mobile es full-width con tap para expandir breakdown.
- El estado se guarda en `localStorage` key `splash:draft:{businessSlug}` — si cierra, vuelve al paso exacto.

---

#### Paso 1 — Zona

Pregunta: **"Where should we come?"**

- Permiso de geolocation opcional. Si concede y está en área cubierta: zona preseleccionada.
- Lista de zonas activas (en cualquier día futuro) con:
  - Nombre, foto/ícono, código postal o barrios ejemplo.
  - Badge "Available today" / "Next: Thu".
- Si no hay zonas activas en próximos 14 días: mensaje "Currently not taking bookings. Join waitlist →" (captura email).

Validación:
- Debe seleccionar exactamente 1.

#### Paso 2 — Fecha y hora

Pregunta: **"When works best?"**

- Calendario mes-view mobile-optimizado:
  - Días con puntos: verde (varios slots), amarillo (últimos slots), gris (sin disponibilidad / zona no activa ese día).
  - Días pasados: disabled.
  - Por defecto: mes actual. Swipe para siguiente mes.
- Al seleccionar día → aparece panel inferior con slots agrupados por franja:
  - Morning (8–12)
  - Afternoon (12–17)
  - Evening (17+)
- Cada slot: `9:00 AM` + `approx 2h15m duration`.
- Si no hay slots del día escogido: CTA "Try next available: Thursday 10:00 AM".

Validación:
- Slot seleccionado.
- El motor de disponibilidad (§8 de architecture) pre-filtra por duración del paquete (conocida una vez se elija en paso 5). **Decisión crítica**: este paso usa duración media; tras elegir paquete se re-valida y si el slot ya no cabe, se retrocede amablemente a esta pantalla con mensaje claro.

*Alternativa simplificada (aceptable si queremos reducir re-backtrack)*: ejecutar paso 2 *después* del paso 5. Decisión tomada: **mantener 2→5 para flujo mental natural, y re-validar antes del pago**.

#### Paso 3 — Tipo de vehículo

Pregunta: **"What kind of vehicle?"**

- 4 tarjetas grandes (Sedan / Small SUV / Medium SUV / XL SUV) con ilustración y ejemplos.
- Chip con el ejemplo textual del negocio (`e.g. Civic, Camry, CLA250`).

Validación:
- Una selección.

#### Paso 4 — Identidad del vehículo (nuevo, requisito lealtad)

Pregunta: **"Tell us about your car"**

- Si el usuario ya ingresó email/teléfono en sesiones anteriores (localStorage) y el backend tiene customer con esos datos:
  - Mostrar "Is this one of your vehicles?" con cards de los vehículos existentes del customer. Cada card: `Honda Civic 2019 · Blue · ABC-123` y badge de lealtad si aplica (`Service #4 — 1 to go for reward`).
  - CTA: "Add new vehicle" al final.
- Si es nuevo:
  - Campos: `Make` (autocomplete), `Model` (autocomplete dependiente), `Year` (selector 1990–2026), `Color` (opcional con color picker simplificado), `Plate` (opcional, config. si se requiere), `Plate state` (US states), `VIN` (colapsado, opcional).
- Texto de ayuda: "We save this so you don't have to re-enter it next time."

Validación:
- Si plate+state ingresados, validar formato por estado.
- VIN si presente debe tener 17 caracteres alfanuméricos excepto I, O, Q.
- Detectar duplicados contra vehicle existente del mismo customer → "Looks like you already have this vehicle saved as X. Use it?"

Nota: aquí el backend **no** crea aún el vehicle en DB — solo se guarda en state del wizard. La creación ocurre al confirmar reserva (paso 8).

#### Paso 5 — Paquete

Pregunta: **"Choose a package"**

- Lista vertical de paquetes activos con:
  - Nombre, descripción corta, foto, duración estimada (`~2h15m`), precio para ESE tipo de vehículo (paso 3).
  - Badge "Most popular" (configurable por admin).
  - Expandir → lista de beneficios.
- Si hay **reward de lealtad disponible** para este vehículo y este paquete:
  - Banner verde sticky arriba: 🎉 **"You have a loyalty reward! Tier 1: 15% off package."**
  - La tarjeta del paquete aplicable muestra el precio tachado y el descuento calculado.
  - Nota: "Applied automatically at checkout." con toggle para desmarcar (opt-out; el reward queda disponible para otra cita).

Validación:
- Un paquete seleccionado.
- Si paquete tiene `is_available=false` para el vehicle_type → no se muestra.

#### Paso 6 — Add-ons

Pregunta: **"Add extras (optional)"**

- Lista con checkbox + qty stepper (para per_unit).
- Cada add-on muestra:
  - Precio según `pricing_mode`:
    - `fixed`: `$85`
    - `starting_at`: `from $15` con tooltip "Final price confirmed on arrival"
    - `per_unit`: `$10 each` con stepper
    - `quote_on_site`: `Quote on arrival` (suma $0 online pero tag visible)
  - Duración extra (`+30m`).
- Sticky total abajo con duración re-calculada.
- Después de cambiar add-ons: si la duración nueva no cabe en el slot del paso 2, mostrar inline banner "Your slot may no longer fit this combination. We'll re-check on the next step." (la verificación dura ocurre al presionar Next).

Validación:
- Ninguna obligatoria.
- Si hay `quote_on_site` seleccionado, banner: "Final price will be confirmed at your location; deposit only covers other items."

#### Paso 7 — Datos del cliente y dirección

Pregunta: **"Who are we visiting?"**

- Email (required). Si match con customer existente → autocompleta resto y muestra "Welcome back, Juan! Your details are loaded."
- First name, last name (required)
- Phone (required, E.164 con selector país)
- Street address con Mapbox autocomplete (required)
- Apt/suite (opcional)
- City, state, ZIP (auto-populated del autocomplete)
- Special instructions (opcional, 500 chars): "Gate code, park in driveway, please don't ring doorbell..."
- Checkboxes:
  - [ ] **Non-refundable deposit acknowledgment** (required): "I understand the $20 deposit is non-refundable."
  - [ ] Marketing opt-in (optional): "Send me updates and promotions."

Validación:
- Email válido, phone E.164 válido, address geocoded.
- Zona del address debe estar dentro de la zona del paso 1 (si el negocio tiene geojson). Si no coincide: "This address is outside the zone you chose. [Change zone] [Keep as special request]."

#### Paso 8 — Fotos de evidencia (pre-service, NUEVO)

Pregunta: **"Show us the current state of your vehicle"**

- Explicación amable: "This protects you and us. We'll document any existing scratches, dents, or damage before we start."
- Slots guiados recomendados (tarjetas con ícono, tap to add):
  - Front ← required if `min_photos_required >= 1` (se marca el primero como obligatorio)
  - Rear
  - Driver side
  - Passenger side
  - Interior
  - "Any existing damage you want us to note" (chip verde)
- Cada foto agregada muestra thumbnail + botón remove + input de nota opcional ("scratch on driver door").
- Barra de progreso: `2/1 minimum · up to 12 photos`.
- Upload: al seleccionar foto → compresión client-side → presigned URL → upload a R2 → status per-foto (uploading / done / failed retry).
- Checkbox **required**: "I confirm these photos represent the current condition of my vehicle before service."
- Checkbox optional: "I agree the business may use before/after photos for marketing (plates/faces blurred)."

Validación:
- Cantidad mínima configurada cumplida.
- Todos los uploads completados (bloquea Next mientras hay uploads en vuelo).
- Consent obligatorio marcado.

#### Paso 9 — Resumen y pago del depósito

Pregunta: **"Review and pay deposit"**

- Resumen completo:
  - Fecha, hora, zona, dirección (truncada)
  - Vehículo (con código interno si aplica)
  - Paquete, duración, precio
  - Add-ons listados con precio y notas (`starting at`, `quote on arrival`)
  - Subtotal
  - **Loyalty reward** (si aplica): `−$X.XX Loyalty Tier 1 (−15%)`
  - Tax
  - **Total estimated**: `$Y.YY`
  - **Deposit today**: `$20.00` (en grande, subrayado como el único cargo de ahora)
  - Balance due on service: `$Y.YY − $20 = $Z.ZZ`
  - Nota: "Final total may change if admin adjusts *starting at* add-ons or adds manual extras."
- Stripe Elements inline (card).
- Botón grande: **Pay $20 deposit and confirm**.
- Stripe errors inline (decline, 3DS challenge, etc.).

Validación:
- Al confirmar: server action crea `appointment(status=pending_deposit)`, crea `PaymentIntent`, cliente lo confirma. Webhook cambia a `confirmed`.

### 3.3 Pantalla de confirmación

- Headline: "Booking confirmed ✓"
- Resumen de la cita en card.
- Lista de "What happens next":
  - Confirmation email + SMS sent
  - Reminder 24h before
  - Driver sends SMS when on the way
- Botón "Add to Google Calendar" (archivo .ics).
- Botón "Manage your booking" (link a `/manage/{token}`).
- Botón WhatsApp del negocio.

---

## 4. Flujo del cliente — gestión post-reserva

URL firmada: `{slug}.splash.app/manage/{token}`. El token se envía por email/SMS, expira en 30 días.

### Pantalla "Manage"

- Detalles de la cita.
- Acciones:
  - **Reschedule** → wizard simplificado (solo paso 2, verifica política: min 24h antes, max 1 reagenda gratis).
  - **Cancel** → confirm dialog con recordatorio: "Your $20 deposit is non-refundable."
  - **Download receipt** (si ya completado).
  - **View photo gallery** → `/gallery/{token}` con fotos antes/después.
- "Add loyalty status": muestra progreso de lealtad del vehículo (`Service #4 for this car — 1 more to earn 15% off`).

---

## 5. Flujo del admin — operación diaria

URL: `app.splash.app`. Requiere auth (email + password + TOTP opcional).

### 5.1 Login

- Email + password + TOTP (si habilitado).
- Magic link como alternativa.
- Si usuario pertenece a múltiples negocios → selector de tenant tras login.

### 5.2 Vista "Today" (default landing)

La vista más importante. Diseñada para uso en celular en la calle.

Layout:

```
┌───────────────────────────────────────┐
│  Tuesday, May 5                  ≡   │ ← header
├───────────────────────────────────────┤
│  Today's route · 4 appointments       │
│  $564 revenue · $80 deposits paid     │
├───────────────────────────────────────┤
│                                       │
│  ┌───────────────────────────────┐   │
│  │ 09:00 · Kendall                │   │
│  │ Juan Perez · Honda Civic (Blue)│   │ ← card
│  │ Car Wash + Interior Detail     │   │
│  │ ■ confirmed · ●●●●○ loyalty   │   │
│  │ [ Call ] [ Navigate ] [ Start ]│   │
│  └───────────────────────────────┘   │
│                                       │
│  ┌───────────────────────────────┐   │
│  │ 12:30 · Coral Gables           │   │
│  │ Maria Lopez · F-150 XL         │   │
│  │ Full Detail · 5 photos attached│   │
│  │ ■ confirmed · ●●●●● 🎁 REWARD │   │  ← loyalty tier 1 available
│  │ [ Call ] [ Navigate ] [ Start ]│   │
│  └───────────────────────────────┘   │
│                                       │
│  ...                                  │
│                                       │
│  + Quick add appointment              │
└───────────────────────────────────────┘
```

Cada card tiene 3 acciones primarias tap-able:

- **Call**: `tel:` link.
- **Navigate**: abre Apple Maps / Google Maps / Waze con la dirección.
- **Start next step**: botón contextual según estado:
  - `confirmed` → "On the way"
  - `on_the_way` → "Arrived"
  - `arrived` → "Start service"
  - `in_progress` → "Complete"
  - `completed` → "View receipt"

Swipe left en card → panel de acciones secundarias: agregar nota, reagendar, marcar no-show, ver fotos.

Offline: cambios de estado se encolan en IndexedDB y sincronizan al volver red. Indicador de sync status en header.

### 5.3 Dashboard (desktop-friendly)

Métricas principales (cards):

- Revenue today / this week / this month
- Bookings today / this week / this month
- No-show rate (últimas 30 citas)
- Deposit collected vs. pending
- Loyalty redemptions this month
- Top 5 customers by lifetime value

Gráficas:
- Revenue últimos 30 días
- Bookings por zona (pie)
- Bookings por paquete (bar)
- Funnel del booking público (viewed → started → completed → paid)

Alertas en banner superior:
- "3 appointments pending deposit > 30 min — [resolve]"
- "Stripe payout paused — action required"

### 5.4 Schedule

Vista de calendario con drag-and-drop.

- **Week view** (default desktop): columnas = días; filas = horas; cards = citas coloreadas por zona.
- **Day view** (default mobile): timeline vertical.
- **Month view**: overview, click día para expandir.

Filtros: resource, zone, status.

Acciones:
- Drag card a otra hora → reschedule (confirma con usuario + notifica cliente).
- Right-click → quick actions.
- Click en slot vacío → "Block this slot" o "Create appointment here".

Panel lateral con asignación de zonas por día:
```
Monday:    ☑ Kendall  ☑ Coral Gables  ☐ Homestead
Tuesday:   ☐ Kendall  ☑ Coral Gables  ☑ Homestead
...
[Apply to all next 4 weeks] [Override for specific date]
```

Duplicar semana → botón que copia el template.

### 5.5 Appointments (lista + detalle)

Lista con filtros: estado, fecha, zona, cliente, vehículo, paquete, monto. Exportable a CSV.

#### Detalle de la cita (pantalla más densa del admin)

Tabs:

1. **Overview**
   - Cliente: nombre, teléfono (call), email, dirección (navigate)
   - Vehículo: marca modelo año color plate + código interno + link al histórico
   - Paquete y add-ons (editable si no está completed)
   - Precio breakdown (subtotal, descuentos, tax, total, deposit paid, balance due)
   - Timeline de estados (desde `appointment_status_history`)
   - Notas internas (solo admin)

2. **Photos** (evidencia multi-fase)
   - Tabs internas: `Pre-service (customer)` | `Pre-service (admin)` | `In progress` | `Post-service`
   - Grid de thumbnails con timestamp y nota
   - Click → lightbox full-screen con zoom, swipe, delete, add note
   - Botón **"Take photo"** (activa cámara en PWA) — asigna fase según estado actual de la cita:
     - Si `arrived` → `pre_service_admin`
     - Si `in_progress` → `in_progress`
     - Si `completed` → `post_service`
   - Botón **"Compare pre / post"** → split screen.
   - Botón "Share to marketing" (si consent marcado) → descarga con plate/face blur automática (posterior).

3. **Payments**
   - Lista de todos los payments (deposit + finales + refunds).
   - Botón **"Record payment"** → dialog:
     - Amount (pre-fill con balance_due)
     - Method (card_online, card_terminal, cash, zelle...)
     - Tip amount (opcional, separado)
     - External reference (e.g. Zelle tx ID)
     - Notes
   - Si balance = 0 → botón "Generate receipt" (crea receipt + email al cliente).
   - Botón "Issue refund" (solo depósito, con confirm + motivo).

4. **Loyalty**
   - Panel: vehículo #3 de lealtad para este customer
   - Progreso del vehículo: `4 completed · 1 to go for Tier 1`
   - Si redención aplicada en esta cita: detalle + botón "Revoke" (con motivo).
   - Si no redimió pero había disponible: tooltip "Reward available but not applied. [Apply now]".
   - Botón "Grant manual reward" (abre dialog).

5. **Extras** (solo cuando `in_progress` o `completed`)
   - Agregar manual line item: nombre, precio, cantidad, duración extra.
   - Cada extra queda en `appointment_item(kind=manual_extra)` + recalcula total.
   - Motivo obligatorio (va a audit_log).

6. **Audit**
   - Historial completo de cambios sobre la cita (desde `audit_log`).
   - Quién hizo qué, cuándo, diff visible.

### 5.6 Customers

Lista searchable (email, phone, name).

Detalle:
- Info del cliente.
- Lista de vehículos (cards con thumbnail + código + progreso de lealtad).
- Lista de appointments (table).
- Lifetime revenue.
- Marketing consent status.
- Botón "Merge with another customer" (en caso de duplicados).
- Botón "Block customer" (con motivo — no puede reservar).

### 5.7 Vehicles

Para cada vehículo:
- Header: `Honda Civic 2019 · Blue · ABC-123 · VH-3F7A`
- Loyalty card: `8 completed services · 2 to go for Tier 2 (25% off)` + progress bar.
- Histórico de appointments (fecha, paquete, total, status, loyalty applied).
- Galería consolidada de todas las fotos (todas las citas) con filtro por fase.
- Botón "Archive vehicle" / "Merge with another vehicle" (por si se duplicó).

### 5.8 Packages

- Lista de paquetes con: activo, precio mínimo y máximo (por rango de vehicle types).
- Click → edit:
  - Nombre, descripción, beneficios, imagen.
  - Grid editable de precios: filas = vehicle types, columnas = `Price`, `Duration`, `Available?`.
  - Deposit policy override.

### 5.9 Add-ons

Lista con: nombre, pricing_mode badge, precio, duración, active.
Edit: todos los campos + preview de cómo se verá en el wizard.

### 5.10 Zones

Lista con mapa visual (si geojson).
Edit: nombre, color, zip codes, polygon (dibujado en mapa con Mapbox), schedule assignment.

### 5.11 Loyalty (Settings → Loyalty)

```
┌────────────────────────────────────────────┐
│ Loyalty Program                   [ Active ]│
│                                             │
│ Name:        Loyalty Rewards               │
│ Description: ...                           │
│                                             │
│ ☑ Count only packages (not add-ons) as visit│
│ ☐ Apply discount to add-ons too            │
│ ☑ Auto-apply at checkout                   │
│ ☐ Reset counter on redemption              │
├────────────────────────────────────────────┤
│ Tiers                                       │
│                                             │
│  Tier 1: 5 services completed               │
│    Discount: [15]% on [All packages ▾]     │
│    Max redemptions per vehicle: 1           │
│    [edit] [delete]                          │
│                                             │
│  Tier 2: 10 services completed              │
│    Discount: [25]% on [All packages ▾]     │
│    Max redemptions per vehicle: 1           │
│    [edit] [delete]                          │
│                                             │
│  [+ Add tier]                               │
├────────────────────────────────────────────┤
│ Redemptions this month: 12 · $385 off      │
│ [View all redemptions]                      │
└────────────────────────────────────────────┘
```

Lista de redenciones: tabla filtrable por vehículo, customer, tier, fecha.

### 5.12 Payments (finance tab)

- Tabla de payments.
- Filtros: method, kind, date range.
- Totales: collected today / week / month por método.
- Export CSV para contabilidad.
- Sección "Pending Stripe payouts" (info desde Connect).

### 5.13 Settings

- General: nombre, timezone, currency, locale, tax rate, brand color, logo.
- Billing: plan de SaaS, próxima factura, método de pago.
- Team: invitar usuarios, roles.
- Integrations:
  - Google Calendar (connect/disconnect por usuario)
  - Stripe Connect (onboarding)
  - Twilio number (para SMS)
  - Custom domain
- Loyalty (puede estar aquí o standalone)
- Deposit policy
- Evidence policy: min photos, max, consent text version, retention days
- Cancellation policy: reschedule min hours, max free reagendas
- Notification templates (editable con preview)

---

## 6. Flujo del admin — configuración del negocio (onboarding)

Primera vez que un negocio se registra:

1. **Signup** — nombre del negocio, email, password, nombre slug (`miwash.splash.app`).
2. **Onboarding wizard** (8 pasos):
   1. Business info (nombre, teléfono, timezone, tax rate)
   2. Service area (zonas — dibuja en mapa o ingresa ZIPs)
   3. Vehicle types (default pre-llenados: Sedan, Small SUV, Medium SUV, XL SUV — editable)
   4. Packages (6 defaults pre-llenados con precios de la spec — editable en grid)
   5. Add-ons (14 defaults pre-llenados — editable)
   6. Schedule (días activos y ventanas, zonas por día)
   7. Loyalty program (activar, tiers default 5/10 editables)
   8. Integrations:
      - Stripe Connect onboarding (obligatorio)
      - Google Calendar (opcional)
      - Custom domain (opcional, plan pro)
3. **Go live**: confirma checklist, activa booking público.

---

## 7. Flujo del admin — día del servicio

Secuencia real del dueño en la calle, narrada:

1. **Morning**: abre la app. Vista Today carga la ruta. Lee las 4 citas del día. Nota la segunda tiene recompensa de lealtad (ícono). Nota que la cuarta es nuevo cliente.
2. **9:00 cita 1 (Juan)**:
   - Presiona "Navigate" → Waze abre con la dirección.
   - Al llegar al vecindario, presiona "On the way" → SMS automático a Juan "We're 5 min away".
   - Llega, presiona "Arrived" → SMS "We're here!".
   - Abre la app en modo field (botón grande en la card).
   - Tab Photos → pre_service_admin → toma 6 fotos con la cámara (PWA).
   - Revisa las fotos pre-customer que Juan subió → ve la nota "rayón en puerta del conductor".
   - Agrega foto adicional del rayón con nota "confirmed — existing scratch, not caused by service".
   - Presiona "Start service" → status `in_progress`.
3. **Durante el servicio**: toma fotos de progreso (opcional).
4. **Al terminar**:
   - Presiona "Complete" → status `completed` → trigger de lealtad incrementa contador.
   - Toma fotos post-service.
   - Si cliente quiere agregar extras ("me cobras también engine wash?"):
     - Tab Extras → + Add → "Engine wash $85" → save.
     - Total se recalcula.
   - Tab Payments → Record payment → $164.99 cash → generate receipt.
   - Imprime recibo térmico (via Bluetooth printer).
   - Sistema envía email al cliente con recibo PDF + galería de fotos + CTA "review us on Google".
5. Vuelve a Today, la card 1 ahora está verde (completed). Avanza a la cita 2.

Toda esta secuencia funciona offline — cambios se sincronizan al volver la señal.

---

## 8. Edge cases y mensajes de error

| Caso | Comportamiento esperado |
|---|---|
| Cliente cierra pestaña en paso 5 | Draft se guarda en localStorage + server-side como `appointment(status=draft)`; al volver dentro de 1h el link retoma; tras 1h draft se limpia |
| Cliente paga depósito pero webhook Stripe falla | Pantalla de confirmación muestra "Pago en procesamiento", polling cada 3s; si tras 60s no `confirmed`, mostrar "Reintentaremos. Revisa tu email."; cron recupera eventos via `stripe.events.list` |
| Cliente intenta reservar slot que otro acaba de reservar | Error visible: "This time slot was just taken. Please choose another." + retroceso al paso 2 con slots refrescados |
| Cliente sube foto de 15MB | Client-side comprime antes de subir; si aún > 10MB, error claro: "Photo too large. Please take a new photo." |
| Cliente no tiene señal al final del wizard | Payment falla claro; draft queda guardado; CTA "Try again" o "Email me this booking to complete later" |
| Admin marca `completed` por error → cliente llama quejándose | Admin detalle cita → cambiar status a `in_progress` → trigger decrementa lealtad automáticamente; audit log registra el cambio con motivo |
| Admin quiere dar reward manual | Panel Loyalty → "Grant reward" → selecciona tier → motivo (obligatorio) → applied_discount + loyalty_redemption se insertan con `granted_manually=true`, `granted_by_user_id` |
| Cliente tiene mismo vehículo registrado 2 veces por un typo en plate | Admin → Vehicles → seleccionar ambos → "Merge": transfiere appointments y loyalty_progress al vehículo "canónico"; audit log |
| Stripe webhook retrasado 5 min tras pago | El endpoint confirmación muestra spinner con polling; al recibir webhook, UI se actualiza via SSE/revalidate |
| Cliente cancela < 24h antes | Reagenda bloqueada con mensaje "Less than 24h — please call us"; cancel sí permitido pero con recordatorio "deposit non-refundable" |
| Dos clientes cargan wizard simultáneo para el último slot | El primero que confirme el pago gana (idempotency + DB EXCLUSION constraint). El segundo recibe error en el paso 9 y se retrocede al paso 2 |
| Cliente ingresa dirección fuera de la zona seleccionada | Warning: "This address is outside [Kendall]. You can still book, but confirm it's correct."; admin ve badge de advertencia en la cita |
| Fotos del cliente con virus (detectado async) | Photo queda en `scan_status=infected`, no se muestra en galería; admin alertado; customer recibe email "Please upload again, the file had issues"; la cita no se bloquea por esto |
| No-show job se ejecuta pero el admin ya está con el cliente | Job es idempotent + chequea `status` actual antes de cambiar a no_show; si ya está `in_progress` o `completed`, no hace nada |
| Red cae mientras admin actualiza estado | Mutation se encola en IndexedDB; banner "Offline — changes will sync"; al volver red, se envía y se muestra confirmación |

---

## Pendiente de validación

- ¿Paso 2 (fecha/hora) antes o después de paquete/vehículo/addons? Propuesto: 2→ajuste si no cabe. Alternativa: mover a paso 7. **Decisión final queda a usuario**.
- ¿Mínimo de fotos obligatorio por defecto: 1 o 0? Propuesto: 1.
- ¿Consentimiento marketing: default opt-in o opt-out? Propuesto: opt-out (más conservador GDPR).
- ¿El banner de loyalty aparece en paso 5 (paquete) o paso 9 (resumen)? Propuesto: ambos — en 5 para influir elección, en 9 para confirmar.
- ¿Admin puede editar fotos que subió el cliente? Propuesto: sólo soft-delete con motivo, no edit.

**Esperando validación de Fases 1–3 antes de comenzar código (Fase 4).**
