# Plan de implementación — Packs de recordatorios WhatsApp

> Estado: **propuesta aprobada, pendiente de implementar**.
> Objetivo: vender packs de recordatorios WhatsApp cobrados con NAVE (igual que los planes)
> que aumenten la cantidad de mensajes disponibles, sin perder lo pagado al resetear el mes.

---

## 1. Contexto: cómo funciona la quota hoy

- **Límite mensual por plan** — `dentalos-api/src/modules/subscription/plans.ts`:
  - `free` / `basic` (Starter): WhatsApp **apagado** (`whatsapp: false`, quota 0).
  - `pro` (Growth): 500 recordatorios/mes.
  - `clinic` (Scale): 2000 recordatorios/mes.
  - `enterprise`: ilimitado (`waMsgMonthlyQuota: null`).
- **Qué consume cuota** — solo los recordatorios `appointment_reminder_24h` y `appointment_reminder_2h`
  (`quota.ts → REMINDER_TYPES`). Confirmaciones, cancelaciones y envíos manuales NO consumen.
- **Contador** — `dentalos-api/src/modules/notifications/quota.ts`:
  - Fuente de verdad = tabla `notifications` (`countRemindersFromDb`).
  - Gate en tiempo real = contador atómico Redis `wa_rem:{clinicId}:{YYYY-MM}` (mes en hora Argentina).
  - Seed perezoso desde la DB; `incrRemindersUsed` tras cada envío exitoso; reset natural por TTL al cambiar de mes.
- **Gates en el worker** — `dentalos-api/src/modules/notifications/service.ts`:
  - **Gate A · Plan** (`service.ts:464`): si `planWhatsapp === false` → no se envía NADA.
  - **Gate B · Cuota** (`service.ts:472`): si `used >= waMsgMonthlyQuota` → recordatorio marcado `quota_exceeded`.
  - Consumo: `incrRemindersUsed` en `service.ts:553-554` solo si `countsAgainstQuota`.
- **Estado para la UI** — `dentalos-api/src/modules/subscription/routes.ts` (`GET /subscription/status`)
  expone `usage.waMsgUsedThisMonth`, `features.waMsgMonthlyQuota`, y los flags `waMsgQuotaWarning` / `waMsgQuotaExceeded`.
- **Cobro NAVE** — `dentalos-api/src/modules/nave/routes.ts`:
  - `POST /nave/preference` crea el intent y registra en `nave_payments` (`plan_key`, `billing`, `amount`, `status='pending'`).
  - Webhook (`/nave/webhook/{sandbox,prod}`) y "Ya pagué" → `verifyAndActivate` (líneas ~160-217): al estado `APPROVED`
    busca el `nave_payments` por `external_payment_id` y activa el plan. Idempotente.

---

## 2. Modelo conceptual: billetera persistente

**Decisión de producto:** el pack es un **saldo durable que NO expira**, no cuota mensual extra.
Si fuera cuota del mes, el cliente perdería al resetear lo que pagó → reclamo.

- **Cuota mensual del plan** → se resetea cada mes (igual que hoy).
- **Saldo de packs** (`wa_pack_balance`) → billetera persistente, se consume **solo como overflow**
  cuando ya se agotó la cuota mensual. Lo que sobra queda para meses siguientes.

### Orden de consumo (nuevo Gate B)

```
used = getRemindersUsed(clinic)          // contador mensual
if used < monthlyQuota:        enviar → incrRemindersUsed()        (consume cuota mensual)
elif packBalance > 0:          enviar → decrPackBalance()          (consume billetera)
else:                          quota_exceeded                       (igual que hoy)
```

- `monthlyQuota === null` (Enterprise) → ilimitado, packs irrelevantes (no se ofrecen).
- Gate A (plan sin WhatsApp) **sigue mandando**: en Free/Starter el pack no envía (ver §6).

---

## 3. Esquema de base de datos (migración nueva)

Crear migración en `dentalos-api/src/supabase/migrations/0XX_whatsapp_packs.sql`:

```sql
-- Saldo de billetera de recordatorios (no expira)
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS wa_pack_balance integer NOT NULL DEFAULT 0;

-- Diferenciar compra de plan vs pack en el pipeline de pagos existente
ALTER TABLE nave_payments
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'plan',  -- 'plan' | 'pack'
  ADD COLUMN IF NOT EXISTS pack_credits integer;                        -- créditos del pack (null para planes)

-- (Opcional, paridad futura) idem en mp_payments
-- ALTER TABLE mp_payments
--   ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'plan',
--   ADD COLUMN IF NOT EXISTS pack_credits integer;
```

- **Fuente de verdad del saldo** = `clinics.wa_pack_balance`.
- **Mirror Redis** `wa_pack:{clinicId}` para el descuento atómico en el hot path del worker
  (DECR con piso en 0). Seed perezoso desde la DB, reconciliación periódica como el contador mensual.

---

## 4. Backend — `dentalos-api`

### 4.1 `notifications/quota.ts`
- Agregar:
  - `getPackBalance(clinicId): Promise<number>` — lee mirror Redis `wa_pack:{clinicId}`; si falta, siembra desde `clinics.wa_pack_balance`.
  - `decrPackBalance(clinicId): Promise<boolean>` — DECR atómico con piso en 0; persiste en DB (`clinics.wa_pack_balance`).
    Devuelve `false` si no había saldo (race) para que el caller no marque el mensaje como enviado.
  - `addPackCredits(clinicId, credits)` — usado por el webhook al aprobar el pago (DB += credits + actualiza mirror).
  - `reconcilePackBalance(clinicId)` — recalcula mirror desde DB (sumar packs aprobados − consumos).
    > Nota: la reconciliación exacta del saldo de packs es más delicada que la del contador mensual
    > (no hay un COUNT directo). Mantener la DB como verdad y el Redis como cache; ante duda, releer DB.

### 4.2 `notifications/service.ts` (Gate B)
- Reemplazar el bloque `service.ts:472-484` por el orden de consumo de §2.
- En el punto de consumo (`service.ts:553-554`): si el envío salió por cuota mensual → `incrRemindersUsed`;
  si salió por pack → `decrPackBalance` (ya "reservado" en el gate, ver concurrencia §6).

### 4.3 `nave/routes.ts`
- Definir `PACK_CONFIG` (gemelo de `PLAN_CONFIG`):
  ```ts
  const PACK_CONFIG = {
    pack_250:  { name: '250 recordatorios',  credits: 250,  price: '...' },
    pack_500:  { name: '500 recordatorios',  credits: 500,  price: '...' },
    pack_1000: { name: '1000 recordatorios', credits: 1000, price: '...' },
  } as const
  ```
- `POST /nave/preference`: aceptar body discriminado. Opción recomendada:
  ```ts
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('plan'), plan: z.enum(['starter','growth','scale']), billing: z.enum(['monthly','annual']).default('monthly') }),
    z.object({ kind: z.literal('pack'), pack: z.enum(['pack_250','pack_500','pack_1000']) }),
  ])
  ```
  Para `kind: 'pack'`: precio/título desde `PACK_CONFIG`, insertar en `nave_payments` con
  `product_type='pack'`, `pack_credits`, `plan_key=null`. Reutiliza el resto del flujo QR.
  - **Mantener compat**: si llega el body viejo (solo `plan`), tratarlo como `kind: 'plan'`.
- `verifyAndActivate` (líneas ~160-217): bifurcar por `record.product_type`:
  - `'plan'` → lógica actual (activar plan, extender `sub_ends_at`).
  - `'pack'` → `addPackCredits(clinic_id, record.pack_credits)` + `clearClinicSubscriptionCache` + marcar `nave_payments.status='approved'`. Misma idempotencia por `external_payment_id`.

### 4.4 `subscription/routes.ts` (`GET /subscription/status`)
- Leer `clinics.wa_pack_balance` (ya hace `select` de la clínica).
- Agregar a la respuesta:
  - `usage.waPackBalance: number`
  - `usage.waMsgRemainingEffective: number | null` — `(monthlyQuota - used) + packBalance` (o `null` si ilimitado).
- Mantener el cache de 24h pero refrescar `waPackBalance` igual que `waMsgUsedThisMonth` (lectura fresca como en `routes.ts:38-41`).

### 4.5 (Opcional) `mercadopago/routes.ts`
- Mismo `product_type` / `pack_credits` en `mp_payments` y bifurcación en el webhook.
- Dejar para una fase 2 — NAVE es la pasarela activa.

---

## 5. Frontend — `web`

### 5.1 Tipos — `web/lib/useSubscription.ts`
- Extender `SubscriptionStatus.usage` con `waPackBalance` y `waMsgRemainingEffective`.

### 5.2 Modal de pago — `web/app/(app)/layout.tsx`
- Generalizar el flujo QR de NAVE (hoy `selectedPlan` → `/nave/preference`) para soportar packs:
  - Nuevo estado `selectedPack` o un `purchaseTarget = { kind: 'plan' | 'pack', key }`.
  - El `useEffect` de `generateQr` manda `{ kind: 'pack', pack }` cuando corresponde.
  - Reutilizar polling de confirmación, QR, "Ya pagué" y pantalla de éxito tal cual.
- Convertir el texto **"Mensajes WhatsApp adicionales disponibles en packs"** (paso 1 del modal de planes)
  en un botón → abre la selección de packs.
- Cards de packs: tamaño, precio, "Comprar pack". Solo visibles si el plan tiene WhatsApp.

### 5.3 Puntos de venta
- `web/app/(app)/settings/page.tsx` → `PlanCard`: al lado de "WhatsApp este mes" mostrar saldo de packs
  y un botón "Comprar más mensajes".
- Banners de cuota (`waMsgQuotaWarning` / `waMsgQuotaExceeded`) → CTA directo a comprar pack.
- Mostrar saldo combinado, p.ej.: `480 / 500 este mes · +320 en packs`.

---

## 6. Bordes a cubrir

- **Concurrencia (sobreventa de packs):** el descuento de pack debe ser atómico (DECR Redis con piso en 0).
  Patrón sugerido: en el Gate B "reservar" el crédito haciendo el DECR ANTES de enviar; si el envío falla,
  devolver el crédito (INCR). Alternativa más simple: DECR justo después de `sent` exitoso aceptando
  subconteo de a 1 en el peor caso (consistente con cómo `incrRemindersUsed` ya tolera drift).
- **Reset mensual:** el contador `wa_rem` se resetea por TTL; `wa_pack_balance` NO se toca → la billetera persiste.
- **Downgrade a plan sin WhatsApp:** el saldo queda guardado pero inactivo (Gate A lo frena). Se reactiva al
  volver a un plan con WhatsApp. Decidir si avisar al usuario en el flujo de downgrade.
- **Enterprise (ilimitado):** no ofrecer packs.
- **Idempotencia de la acreditación:** apoyarse en `nave_payments` (un `external_payment_id` aprobado acredita una sola vez),
  igual que la activación de planes hoy.
- **Reconciliación:** definir job (o lazy) que recalcule el mirror `wa_pack:{clinic}` desde
  `clinics.wa_pack_balance`; ante divergencia, la DB manda.

---

## 7. Pendientes de definición (antes de codear)

- **Tamaños y precios de los packs** (placeholders en §4.3: 250 / 500 / 1000).
- Confirmar **saldo persistente** (recomendado) vs cuota extra del mes.
- ¿Vender packs también a planes sin WhatsApp como gancho de upsell, o solo Growth/Scale?
- ¿Paridad MercadoPago en esta fase o fase 2?

---

## 8. Checklist de implementación

- [ ] Migración `0XX_whatsapp_packs.sql` (`clinics.wa_pack_balance`, `nave_payments.product_type` + `pack_credits`).
- [ ] `quota.ts`: `getPackBalance`, `decrPackBalance`, `addPackCredits`, `reconcilePackBalance`.
- [ ] `service.ts`: nuevo Gate B con orden de consumo mensual → pack.
- [ ] `nave/routes.ts`: `PACK_CONFIG`, `/nave/preference` discriminado, bifurcación en `verifyAndActivate`.
- [ ] `subscription/routes.ts`: exponer `waPackBalance` + `waMsgRemainingEffective`.
- [ ] `useSubscription.ts`: tipos nuevos.
- [ ] `layout.tsx`: modal de pago generalizado para packs + CTA en el texto de packs.
- [ ] `settings/page.tsx` (`PlanCard`): saldo de packs + "Comprar más mensajes".
- [ ] Banners de cuota: CTA a packs.
- [ ] (Opcional) Paridad MercadoPago.
- [ ] Pruebas: compra pack sandbox NAVE → acreditación → consumo overflow → reset mensual conserva saldo.
