# Fase 1 — Análisis de Producto y Mejoras

Este documento analiza el sistema propuesto y recomienda mejoras como Product Manager senior. No es una traducción del brief: es una capa encima que corrige problemas que aparecerán en producción real.

---

## 1. Validación del modelo de negocio

### Fortalezas del planteamiento original

- **Depósito obligatorio**: reduce no-shows drásticamente. Es la diferencia entre un negocio que sangra tiempo y uno que no.
- **Zonas por día**: refleja cómo se operan las rutas reales — un mobile detailer no puede estar hoy en Miami Beach y en Homestead el mismo día.
- **Precios por tipo de vehículo**: correcto. La alternativa (precio fijo) pierde dinero en SUVs grandes o sobrecobra sedanes.
- **Separación cliente / admin**: absolutamente necesario. No hay login del cliente en el flujo de reserva — cero fricción.

### Riesgos detectados en el planteamiento original

#### R1. No hay noción de duración del servicio

**Problema**: el brief dice "evitar doble booking" pero trata cada "slot" como atómico. Un Car Wash toma 45 min, un Full Detail 4 horas. Sin duración, vas a vender un Full Detail a las 2pm y luego otro Full Detail a las 3pm — imposible de cumplir.

**Solución**: duración almacenada por combinación `(package_id, vehicle_type_id)` + add-ons suman duración incremental. Al seleccionar paquete, el sistema calcula el bloque real y oculta slots donde no cabe.

#### R2. No hay tiempo de viaje entre zonas

**Problema**: si el dueño termina una cita en Zona A a las 11am, no puede empezar en Zona B a las 11:00am. Necesita 20–45 min de traslado.

**Solución**: tabla `zone` con `travel_time_matrix` (simplemente un JSON con minutos a cada otra zona), o mínimo un `default_travel_time_minutes` global por negocio. El motor de disponibilidad lo resta.

#### R3. Depósito fijo $20 en servicios de $500+

**Problema**: Paint Correction cuesta $519. Un cliente que cancela cuesta 4+ horas de ingresos perdidos. Un $20 de castigo es irrisorio.

**Solución**: `deposit_policy` por paquete:
- `{ type: 'fixed', amount: 2000 }` (centavos, $20)
- `{ type: 'percentage', percent: 10, min_amount: 2000 }` (10% mínimo $20)

Default para todos los paquetes: `fixed $20`. Admin puede cambiar por paquete.

#### R4. Overspray "precio variable manual" no tiene workflow

**Problema**: el cliente selecciona Overspray en el booking, pero ¿qué cobra? Si cobras $0, el cliente cree que es gratis.

**Solución**: add-ons con `pricing_mode`:
- `fixed` — precio cerrado (ej. Engine wash $85)
- `starting_at` — muestra "desde $X", el admin ajusta al llegar y ver el vehículo. En booking suma el mínimo.
- `quote_on_site` — no suma nada al total online, marca la cita como "requiere cotización presencial". Cliente acepta términos.
- `per_unit` — para "Rims detail $10 each" — multiplica por cantidad. Default qty = 4 (ruedas).

#### R5. No hay identidad del cliente persistente

**Problema**: un cliente que vuelve cada mes teclea su dirección de nuevo cada vez. Mala UX y no puedes hacer CRM/marketing.

**Solución**: `customer` table con match por email o teléfono normalizado. En el booking, si el email existe, pre-rellena. Guarda vehículos usados anteriormente.

#### R6. Reschedule no contemplado

**Problema**: "No reembolsable si cancela" es correcto, pero ¿qué pasa si llueve? ¿Si el cliente tiene emergencia médica y quiere moverla al viernes?

**Solución**: Política de re-agenda configurable:
- Permitir X re-agendas gratuitas
- Con mínimo Y horas de antelación
- El depósito se traslada a la nueva cita
- Sin reembolso, pero tampoco castigo injusto

El dueño también puede re-agendar (lluvia, equipo roto) y esto no cuenta contra el cliente.

#### R7. Capacidad = 1 asumida

**Problema**: si el dueño contrata un asistente, quiere vender 2 citas en el mismo slot en la misma zona.

**Solución**: `resource` table. Un negocio tiene N recursos (ej. "Unit 1", "Unit 2"). Cada booking ocupa 1 recurso. Slots muestran disponibilidad = Σ recursos libres.

#### R8. No hay fotos

**Problema**: en detailing, las fotos antes/después son el producto intangible. Sin fotos, no hay upsell a paquetes premium, no hay testimonial, no hay protección ante disputas ("mi carro llegó rayado").

**Solución**: subir fotos desde el panel móvil del admin, link en el recibo, opción de compartir con marca de agua en social.

#### R9. Panel admin asume buena conectividad

**Problema**: el dueño está en un parqueo de un edificio, 4G inestable. Si el panel falla al marcar "Completed", pierde el check-in.

**Solución**: PWA con IndexedDB. Acciones críticas (marcar estado, agregar extras, cobrar) se encolan offline y sincronizan al volver la red. Optimistic UI siempre.

#### R10. No hay Audit Log

**Problema**: cliente dice "yo pagué $100 de depósito, no $20". Admin dice "solo cobré $20". Sin histórico inmutable, la disputa es palabra contra palabra.

**Solución**: `audit_log` con cada cambio (who/what/when/before/after) en citas, pagos y precios. Visible en el detalle de la cita, exportable.

---

## 2. Mejoras de experiencia (no rompen el spec)

### UX del booking público

- **Geolocation permission**: pedir ubicación al entrar; auto-seleccionar zona si el usuario está en el área de cobertura. Si no, mostrar zonas disponibles en lista ordenada por proximidad.
- **Calendario visual**, no dropdown — muestra el mes, días con puntos de colores (verde/amarillo/gris) según disponibilidad.
- **Persistencia de draft**: guardar el progreso del booking en `localStorage`. Si cierra la pestaña, vuelve donde lo dejó.
- **Abandonment recovery**: si usuario llega al paso de pago y no paga en 15 min, email con link al draft guardado + 1 intento.
- **Trust markers**: mostrar número de citas completadas este mes, rating de Google embebido, fotos de trabajos recientes.
- **Resumen sticky** en mobile — mientras elige add-ons, ve el precio actualizándose en una barra inferior.

### UX del panel admin

- **Vista "Hoy" como landing** — muestra directamente la ruta del día con:
  - Tarjetas ordenadas por hora
  - Botón gigante "Start Next" (llamar, navegar, marcar arrived)
  - Integración con mapas (abre en Waze/Google Maps)
  - Estado del depósito por cita
- **Modo "field mode"** — UI minimalista full-screen para usar en la calle. Solo lo esencial: cliente actual, timer, botón completar.
- **Quick-add cita** — para citas fuera del flujo online (walk-in, teléfono). Flujo de 3 pasos del admin.
- **Gestión de zonas en calendario** — drag-and-drop para asignar zonas a días. Duplicar semana anterior con un click.

### Notificaciones

- **Canal dual**: email + SMS (Twilio). SMS es más efectivo en la industria de servicios.
- **Momentos**:
  1. Confirmación inmediata (depósito cobrado)
  2. Recordatorio 24h antes
  3. Recordatorio 15 min antes ("estamos en camino")
  4. "Ya llegamos"
  5. "Completado + recibo + pide review"
- **Admin también recibe**: notificación de nueva cita, cancelación, cliente sin contestar.

---

## 3. Escalabilidad y operación

### Multi-tenancy: decisiones

| Aspecto | Decisión | Razón |
|---|---|---|
| Aislamiento | Shared DB + RLS Postgres | 1 DB escala a miles de tenants; DB-per-tenant multiplica coste de ops × N |
| Subdominios | Wildcard DNS `*.splash.app` + custom domains opcional en plan pro | Aislamiento de marca sin fricción |
| Storage de imágenes | R2/S3 con prefijo `{business_id}/` + signed URLs | No fugar recibos entre negocios |
| Billing del SaaS | Stripe Billing (suscripción mensual del dueño) separado del Stripe Connect (para cobros del cliente) | Correcto nivel de abstracción |

### Performance

- El endpoint de "slots disponibles para fecha X" es el más caliente. Solución: cache de 60s por `(business_id, date, zone_id)` con invalidación al crear/cancelar booking.
- El dashboard admin: usar server components + streaming.
- Imágenes: procesar a 3 tamaños (thumb, web, full) al subir. Servir `srcset`.

### Seguridad (checklist)

- [ ] RLS obligatorio en cada tabla con `business_id`
- [ ] Auth con session cookies `httpOnly` + `sameSite=lax` + CSRF token en mutaciones
- [ ] Rate limiting en booking público (10 req/min por IP, 3 bookings/día por teléfono)
- [ ] Webhook de Stripe con verificación de signature
- [ ] Idempotencia en creación de booking (idempotency_key en header)
- [ ] No loggear PII en Sentry (scrubbing de email/teléfono/dirección)
- [ ] Encriptar direcciones en DB con `pgcrypto` — es PII
- [ ] GDPR/LGPD: endpoint de export y delete para cliente
- [ ] 2FA opcional para admin (TOTP)
- [ ] HTTPS forzado, HSTS
- [ ] Content Security Policy estricta

### Cumplimiento

- **PCI**: cero almacenamiento de tarjeta. Stripe Elements tokenizado. Somos SAQ-A.
- **GDPR/CCPA**: customer puede pedir sus datos / borrarlos. Implementar `customer_data_request` table.
- **Sales tax**: cada negocio configura su tax rate por zona. No asumir 0%.

---

## 4. Qué NO construir en MVP (scope discipline)

Para no diluir el valor del MVP, explícitamente dejamos fuera:

- Apps nativas iOS/Android (PWA cubre el 95%)
- Chat en vivo cliente-dueño (usar SMS/WhatsApp link directo)
- Loyalty points avanzados (solo código de referido simple)
- Inventario de productos (cera, microfiber, etc.)
- Contabilidad completa (exportar CSV a QuickBooks es suficiente)
- Multi-idioma avanzado (solo ES y EN, nada de i18n completo)
- Marketplace de clientes (Splash no hace matchmaking, es SaaS operativo)

---

---

## 13. Programa de lealtad por vehículo

### Por qué importa como requisito de producto

La lealtad por cliente (típica en retail) fracasa en detailing porque un cliente puede tener 2–3 vehículos y sólo uno lavarse regularmente. Atar la recompensa al **vehículo específico** hace tres cosas:

1. Recompensa el comportamiento real (este carro vuelve cada mes).
2. Crea un incentivo para que el cliente traiga siempre el mismo carro.
3. Convierte al carro en un activo CRM — el dueño puede ver "este Civic del cliente Juan ha venido 8 veces, próxima visita es recompensa".

### Modelo lógico

```
BusinessLoyaltyProgram (config del negocio, 1:1)
    ├── tiers: LoyaltyTier[]       # [{visits: 5, discount: 15%}, {visits: 10, discount: 25%}]
    ├── applies_to_packages[]      # IDs de paquetes que cuentan y aplican
    ├── applies_to_addons: bool    # descuento aplica o no a add-ons
    ├── count_rule: 'completed_only'   # siempre — cita cancelada o no-show no cuenta
    ├── reset_on_redemption: bool  # ¿reinicia el contador al redimir tier 1?
    └── max_redemptions_per_tier: int?  # ¿puede redimir tier 5 múltiples veces?

Customer ────< Vehicle >──── LoyaltyProgress
                                ├── vehicle_id (anchor)
                                ├── completed_visits (int)
                                ├── next_tier_at_visits (int)
                                ├── available_reward: LoyaltyTier | null
                                └── history of redemptions
```

### Identidad del vehículo (clave)

Un vehículo debe ser identificable de manera estable entre reservas. Orden de prioridad:

1. **VIN** (opcional, 17 chars, unico globalmente) — si el admin o cliente lo ingresa, es la verdad absoluta.
2. **plate + plate_state** — por defecto. El sistema valida el formato por estado (USA). Dos vehículos no pueden tener misma plate en mismo estado dentro del mismo negocio.
3. **make + model + year + color** — fallback solo si cliente no tiene ni VIN ni placa. Genera advertencia al admin: "este vehículo podría confundirse con otro del cliente". Admin puede mergear.

Todos los vehículos tienen además un **internal_code** UUID corto legible (`VH-3F7A`) para referencia rápida en tickets y mensajes.

### Cuándo se registra el vehículo

- Paso 3 del booking (Tipo de vehículo) → Paso 3.5 (Datos del vehículo específico). Si el cliente ya existe por email/teléfono, muestra sus vehículos guardados para elegir o "Add new vehicle".
- Admin puede pre-registrar vehículos al crear customer manualmente.

### Reglas de conteo

- Solo `appointment.status = 'completed'` incrementa el contador.
- Cita re-agendada no cuenta hasta que la nueva se complete.
- Cita en `no_show` o `cancelled` no cuenta (ni resta).
- Si el admin corrige una cita de `completed` a `cancelled`, el contador decrementa automáticamente (triggerable).
- Solo cuenta si el paquete de la cita está en `applies_to_packages` de la config. Paquete fuera del programa no suma.

### Aplicación del descuento

El **checkout público** consulta loyalty al momento de seleccionar paquete:

```
GET /api/loyalty/preview?vehicleId=X&packageId=Y
  → { 
      current_visits: 4, 
      visits_until_next_reward: 1,
      reward_available: null
    }

GET /api/loyalty/preview?vehicleId=X&packageId=Y (cliente con 5 completadas)
  → { 
      current_visits: 5, 
      visits_until_next_reward: 5,
      reward_available: { 
        tier: 1, 
        discount_type: 'percentage', 
        discount_value: 15, 
        applies_to_addons: false,
        expires_at: null
      }
    }
```

Si hay `reward_available`, el wizard muestra banner: *"You've earned a loyalty reward! 15% off your wash package applied."* El descuento va en `applied_discounts[]` del booking.

**Redención explícita vs automática**: decisión → **automática** con opt-out. El cliente ve una fila "Loyalty reward −$9.75" en el resumen. Si desmarca, se guarda para usar después (no se "quema").

### Trazabilidad

Tabla `loyalty_redemption`:

| campo | |
|---|---|
| id | |
| appointment_id | la cita donde se usó |
| vehicle_id | |
| customer_id | |
| tier | 1, 2, ... |
| discount_type | `percentage` \| `fixed` |
| discount_value_cents | valor configurado en ese momento (snapshot) |
| discount_applied_cents | monto real aplicado (puede diferir si backend recalcula) |
| visit_count_at_redemption | 5, 10, 15... |
| created_at | |

El admin ve estas redenciones en el detalle del vehículo, detalle de la cita y reporte global.

### Configuración admin

UI en Settings → Loyalty:

- [x] Activar programa de lealtad
- Tiers:
  - [+] Tier 1: Después de `[5]` servicios completados — descuento `[percentage|fixed]` de `[15]` `[%|$]`
  - [+] Tier 2: Después de `[10]` servicios completados — descuento `[percentage|fixed]` de `[25]` `[%|$]`
  - [+ Add tier]
- Aplica a paquetes: `[multi-select de paquetes]`
- ☑ Aplicar descuento también a add-ons
- ☐ Reiniciar contador al redimir (por defecto: no, el contador crece acumulativo)
- Máx redenciones por tier: `[1]` (ej. tier 5 solo una vez por vehículo)

### Vista admin: vehículo

- Header: `Honda Civic 2019 · Blue · ABC-123 (FL)` — código `VH-3F7A`
- Contador: `8 completed services · 2 to go for next reward (Tier 2 — 25% off)`
- Progress bar visual
- Histórico: lista de todas las citas de ese vehículo con fecha, paquete, total, estado, descuento aplicado.
- Botón "Grant reward manually" (override del admin).

---

## 14. Evidencia fotográfica multi-fase

### Por qué importa como requisito de producto

Tres razones de negocio:

1. **Protección legal**: el cliente firma que el vehículo ya tenía un rayón X → el negocio queda protegido ante reclamaciones "tú me rayaste el carro".
2. **Control interno de calidad**: el dueño puede ver después qué trabajo hizo qué técnico, comparar antes/después, identificar dónde mejorar.
3. **Material de marketing**: con consentimiento explícito, fotos antes/después son oro para Instagram/TikTok (lo más viral en detailing).

### Fases de evidencia

Toda foto vive en una de estas fases:

| Fase | Uploader | Momento | Propósito |
|---|---|---|---|
| `pre_service_customer` | cliente | al reservar (paso del wizard) | documentar estado declarado por el cliente |
| `pre_service_admin` | admin | al llegar a la ubicación, antes de empezar | verificar/ampliar lo declarado |
| `in_progress` | admin | durante el servicio (opcional) | evidencia de trabajo en curso |
| `post_service` | admin | al terminar | comparación con `pre_service_*`, marketing |

Cada foto se etiqueta por fase y permite filtrar. La UI admin muestra **comparación side-by-side** pre/post.

### Flujo en el booking (cliente)

Nuevo paso después del "Datos del cliente" (paso 6) y antes del "Resumen" (paso 7 renumerado a 8):

**Paso 7 — Vehicle condition photos**

- Título: "Upload photos of your vehicle's current condition"
- Subtítulo: "This protects you and us. We want to document any existing dents, scratches, or damage before we start."
- Slots guiados recomendados (no obligatorios):
  - Front
  - Rear
  - Driver side
  - Passenger side
  - Interior
  - "Any existing damage you want us to note"
- Botón "+ Add photo" genérico además
- Cada foto: opción de agregar **nota corta** ("rayón en puerta del conductor")
- Por defecto: configurable si es obligatorio u opcional. Default sugerido: **mínimo 1 foto obligatoria**, máximo 12. Config `min_photos_required` en el negocio.
- Checkbox obligatorio al final: *"I confirm these photos represent the current condition of my vehicle before service."*

### Flujo en el admin

En el detalle de la cita, sección "Evidence":

- Tabs: `Pre-service (customer)` | `Pre-service (admin)` | `In progress` | `Post-service`
- Grid de fotos con timestamp, uploader, nota
- Click → lightbox con zoom, swipe, y botón download
- Botón de bulk upload (arrastrar varias)
- Captura directa desde cámara (PWA → `<input capture="environment">`)
- Check "Client consent for marketing use" por foto individual — si el cliente lo firmó al reservar, aparece marcado

### Validaciones

| Regla | Valor |
|---|---|
| Formatos permitidos | JPEG, PNG, HEIC, WebP |
| Tamaño máximo por archivo | 10 MB antes de compresión |
| Compresión cliente | 2048px max edge, JPEG quality 80 (sharp en server si cliente no puede) |
| Max fotos por cita, fase `pre_service_customer` | 12 (configurable) |
| Max fotos por cita, fase admin | 30 (configurable) |
| Total por cita | 50 hard cap |
| Retention | 2 años default, configurable por negocio por política local |

### Storage y seguridad

- Cloudflare R2, prefijo `{business_id}/appointments/{appointment_id}/{phase}/{uuid}.jpg`
- Upload: presigned URL firmada, válida 5 min, content-type restringido
- Acceso: nunca URL pública. Frontend siempre pide `/api/photos/{id}/url` → el backend verifica acceso (RLS + session) → retorna signed URL de 5 min
- Si cliente no autenticado accede a su cita via `manage/{token}`, el token firmado autoriza ver SUS fotos (no de otros)
- Scrub de metadata EXIF por defecto (elimina GPS de la foto si el cliente la sube desde celular — protege su ubicación residencial)
  - Excepción: admin puede subir con EXIF intacto para evidencia forense si configura `keep_exif=true`
- Escaneo antivirus async via Cloudflare Workers o ClamAV en worker

### Consentimiento y privacidad

- Dos checkboxes en el booking:
  1. Obligatorio: "Estas fotos representan el estado actual del vehículo antes del servicio."
  2. Opcional: "Autorizo al negocio a usar las fotos post-servicio (sin mi rostro, matrícula borrosa) en material de marketing."
- Admin puede ver en UI qué fotos tienen consentimiento marketing
- Cliente puede revocar consentimiento marketing via link en email (un-click): hace soft-delete de `marketing_consent_at` en las fotos.

### En el recibo

- No se imprimen las fotos (papel térmico no lo soportaría bien).
- Se imprime línea: `Evidence attached: 4 photos (pre-service) · 6 photos (post-service) · View online: splash.app/r/{token}`
- El código QR en el recibo lleva a la galería privada para el cliente.

### Base de datos (esbozo — detalle en schema.sql)

```
evidence_photo (
  id uuid pk,
  business_id uuid not null,
  appointment_id uuid not null,
  customer_id uuid not null,
  vehicle_id uuid not null,
  phase enum('pre_service_customer','pre_service_admin','in_progress','post_service'),
  slot_tag text?,        -- 'front', 'rear', 'damage_driver_door', etc.
  note text?,            -- nota del uploader
  storage_key text,      -- R2 key
  mime_type text,
  bytes int,
  width int, height int,
  uploaded_by_user_id uuid?, -- null si lo subió el cliente (no autenticado)
  uploaded_by_customer_id uuid?,
  uploaded_at timestamptz,
  marketing_consent bool default false,
  marketing_consent_revoked_at timestamptz?,
  soft_deleted_at timestamptz?
)
```

---

## 5. Resumen: spec v2 (ajustada)

Lo que construimos es esto:

1. Booking público mobile-first, 7 pasos, depósito en Stripe, confirmación multi-canal.
2. Panel admin con vista "Hoy" en modo field, gestión de agenda drag-and-drop, recibos térmicos.
3. Multi-tenant con RLS, subdominios.
4. Customer + Vehicle persistente con histórico.
5. Zonas con tiempo de viaje, slots calculados dinámicamente con duración real.
6. Add-ons con 4 modos de precio (fixed / starting_at / quote_on_site / per_unit).
7. Depósito configurable (fixed o %).
8. Reschedule con política.
9. Recursos (capacidad) configurable.
10. Fotos antes/después.
11. Notificaciones email + SMS.
12. PWA con modo offline para admin en campo.
13. Audit log completo.
14. Dashboard financiero (MRR del SaaS + revenue del negocio).

Este es el producto. El resto son features post-MVP.
