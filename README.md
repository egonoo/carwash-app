# Splash — Car Wash SaaS

SaaS multi-negocio para car wash móvil / auto detailing. Reservas online con depósito, panel admin, programa de lealtad por vehículo, evidencia fotográfica multi-fase.

**Estado**: Fases 1–4 entregadas (análisis, arquitectura, DB completa, motor de precios, motor de disponibilidad, lealtad, reservas, webhooks, panel admin inicial, wizard scaffold). Ver `docs/` para el diseño.

## Requisitos

- Node.js ≥ 20.10
- pnpm ≥ 9
- PostgreSQL 16+ (local con Docker o cuenta en Neon/Supabase)
- Cuentas (para producción): Stripe, Cloudflare R2, Resend, Upstash Redis+QStash

## Quick start (local)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar envs
cp .env.example .env.local
# editar DATABASE_URL, STRIPE_*, R2_*, etc.

# 3. Levantar Postgres local (si no usas Neon)
docker run -d --name splash-pg \
  -e POSTGRES_USER=splash_app -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=splash -p 5432:5432 postgres:16

# 4. Migrar + aplicar SQL crudo (RLS, triggers, EXCLUDE) + seed
pnpm db:migrate        # crea tablas (Prisma)
pnpm db:apply-sql      # aplica packages/db/sql/*.sql
pnpm db:seed           # inserta business demo con catálogo

# 5. Dev server
pnpm dev
# http://localhost:3000
# Booking público: edita /etc/hosts para apuntar demo.splash.app → 127.0.0.1
#   o usa directamente http://localhost:3000/demo (Next reescribe el path)
```

## Estructura

```
/apps/web              Next.js 15 (App Router) — frontend + backend
  /app
    /(marketing)       splash.app — landing
    /(auth)            login
    /(admin)           app.splash.app — panel
    /(booking)         {slug}.splash.app — wizard público
    /api               Route handlers (webhooks, photos, availability…)
  /actions             Server Actions (mutaciones admin)
  /lib                 Core: db, rls, tenant, auth, stripe, r2,
                       pricing/, availability/, loyalty/
  /components
  /middleware.ts       Routing por host (tenant resolver)
/packages/db           Prisma + SQL raw (RLS, triggers, EXCLUDE)
  /prisma/schema.prisma
  /prisma/seed.ts
  /sql/01_rls.sql
  /sql/02_constraints.sql
  /sql/03_triggers.sql
  /scripts/apply-sql.ts
/packages/schemas      Zod schemas compartidos
/docs                  Diseño completo (Fases 1–3)
/infra                 (reservado para IaC futuro)
```

## Componentes clave implementados

- **Motor de precios centralizado** ([apps/web/lib/pricing/engine.ts](apps/web/lib/pricing/engine.ts)): line items → subtotal → descuentos (loyalty → promo → manual) → tax → total → deposit → balance. Todo integer cents, todo con snapshot.
- **Motor de disponibilidad** ([apps/web/lib/availability/engine.ts](apps/web/lib/availability/engine.ts)): respeta templates, exceptions, zones por día, travel time entre zonas, duración real del paquete, recursos múltiples, EXCLUDE constraint como red de seguridad.
- **Lealtad por vehículo** ([apps/web/lib/loyalty/*.ts](apps/web/lib/loyalty/)): elegibilidad por (vehículo, paquete), redención con snapshot, ajuste manual del contador, otorgamiento manual de recompensa, revocación. Triggers DB auto-incrementan/decrementan al cambiar `appointment.status`.
- **Evidencia multi-fase**: presign a R2 con ACL, 4 fases (`pre_service_customer`, `pre_service_admin`, `in_progress`, `post_service`), consentimiento versionado.
- **Multi-tenant con RLS**: cada query pasa por `withTenant(businessId, ...)` que setea `app.current_business_id` en la transacción. Rol de app sin `BYPASSRLS`.
- **Feature flags por negocio** (`business.features` JSONB): `loyalty`, `photos`, `promo_codes`, `sms`, `custom_domain`, etc. — todo el runtime los respeta.
- **Stripe Connect** para depósitos; saldo final manual por admin (cash/card terminal/zelle/etc.).

## Operaciones comunes

```bash
pnpm dev                    # dev server
pnpm typecheck              # TS check en todos los paquetes
pnpm lint
pnpm test                   # unit tests (Vitest)
pnpm test:e2e               # Playwright
pnpm db:studio              # Prisma Studio para inspeccionar DB
pnpm db:reset               # DESTRUCTIVO: reset + migrate + apply-sql + seed
pnpm db:apply-sql           # re-aplicar RLS/triggers/constraints tras migrate
```

### Crear un usuario admin

```bash
pnpm tsx packages/db/scripts/create-admin.ts \
  --email owner@demo.splash.app \
  --password 'ChangeMe123!' \
  --business-slug demo \
  --role owner
```

(Script de creación pendiente — por ahora crear manualmente vía Prisma Studio o seed.)

## Despliegue (Vercel + Neon + R2)

### 1. Base de datos (Neon)

1. Crear proyecto en [Neon](https://neon.tech).
2. Crear dos roles: `splash_app` (sin BYPASSRLS) y `splash_migrator` (con `CREATE` en el schema).
3. Copiar ambas connection strings a Vercel env vars.
4. Ejecutar migraciones:
   ```bash
   DATABASE_URL_MIGRATIONS=... pnpm db:deploy
   ```
   Esto corre `prisma migrate deploy` + aplica los SQL crudos (RLS, triggers, EXCLUDE).

### 2. Stripe

1. Crear cuenta Stripe, activar **Stripe Connect Standard**.
2. Configurar endpoints de webhook:
   - `https://app.splash.app/api/webhooks/stripe` → events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
   - Copiar `STRIPE_WEBHOOK_SECRET` a env.
3. Cada negocio hace onboarding via el panel → `stripe.accounts.create({ type: 'standard' })` + `accountLinks.create`.

### 3. Cloudflare R2

1. Crear bucket `splash-evidence` (y `splash-receipts`).
2. Crear API token con lectura/escritura sobre esos buckets.
3. Configurar CORS si se consume desde el browser directo al R2.

### 4. Resend

1. Verificar dominio de envío (`splash.app`).
2. Crear API key.

### 5. Vercel

1. Import del repo.
2. Configurar env vars (ver `.env.example`).
3. Dominio principal: `splash.app`.
4. Agregar wildcard: `*.splash.app` → misma app.
5. Configurar `DATABASE_URL` apuntando al pool de Neon y `DATABASE_URL_MIGRATIONS` al endpoint directo.

### 6. QStash (cron)

1. Crear "Schedule" en Upstash:
   - Cada 5 min → `POST https://app.splash.app/api/cron/no-shows`
2. Copiar signing keys a env.

### 7. DNS de un cliente con custom domain

1. Cliente agrega su dominio en `business_domain` table (UI en Settings → Integrations).
2. Cliente apunta su DNS (`CNAME` → `cname.vercel-dns.com`).
3. Vercel provisiona certificado automático.
4. Middleware detecta el host en `x-tenant-host` y resuelve el tenant.

## Checklist pre-producción

- [ ] Rotar `SESSION_SECRET` y `MANAGE_TOKEN_SECRET` (32 bytes hex).
- [ ] Rol DB `splash_app` sin `BYPASSRLS`, verificado.
- [ ] `pnpm db:apply-sql` aplicado tras cada deploy.
- [ ] Stripe webhook secret válido.
- [ ] CSP estricta revisada.
- [ ] Sentry DSN configurado.
- [ ] Rate limits verificados contra Upstash.
- [ ] E2E pasa: flujo completo booking + depósito + admin completa + recibo.
- [ ] Backups point-in-time activados en Neon.
- [ ] Tests de triggers de lealtad (inc/dec al cambiar status).

## Qué falta para 1.0 (roadmap corto)

- Integración completa de Stripe Elements en `StepReviewPay` (scaffolded).
- Google Calendar OAuth por tenant.
- Email templates (Resend + React Email).
- Onboarding wizard del negocio (post-signup, configurar zonas/horarios).
- UI de Schedule con drag-and-drop.
- PWA (manifest + service worker) para modo offline del admin en campo.
- Recibo térmico (printer 80mm) + PDF A4 (jsPDF o Puppeteer en worker).
- SMS (cuando el usuario active Twilio).
- Tests E2E con Playwright cubriendo el golden path.

Ver [docs/00-executive-summary.md](docs/00-executive-summary.md) para la visión completa.

## Licencia

Propietaria. Todos los derechos reservados.
