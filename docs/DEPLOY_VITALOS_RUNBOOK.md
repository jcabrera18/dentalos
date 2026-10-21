# Runbook de deploy — upgrade a VitalOS

Estado al 2026-10-21: **`main` listo en ambos repos** (merge FF local hecho, **sin push**).
Este doc es la secuencia para cuando decidas lanzar. El rebrand de marca y el corte de
dominio son independientes: podés desplegar el código VitalOS sobre `dentalos.pro` y
hacer el corte de dominio (F5/F6 de `rebrand-vitalos-migration.md`) como paso aparte.

## 0. Estado de las ramas (ya preparado)

| Repo | `main` vs `origin/main` | Contenido |
|---|---|---|
| `dentalos/` (web) | +5 commits, sin push | rebrand + capabilities + multi-especialidad + HC genérica + consents por disciplina + páginas legales |
| `dentalos-api/` | +6 commits, sin push | capabilities + endpoints nuevos + migraciones 059–063 |

Validado local: web `build` ✓ / `test:clinical` 7/7 ✓ · API `build` (tsc) ✓ / `vitest` 26/26 ✓
(incl. `capabilities.test.ts` → `lib/capabilities.ts` web↔API idénticos).
Lint no es gate (ya roto en `main` desde antes).

## 1. Orden de deploy (CRÍTICO)

Los endpoints nuevos (capabilities, clinical_encounters, consents por disciplina,
discipline en professionals) fallan contra una DB sin las tablas/columnas. Por eso:

```
1) MIGRAR DB   → 2) DEPLOY API   → 3) DEPLOY WEB
```

Si Railway auto-deploya la API al pushear `main`, **correr las migraciones ANTES del push**
o pausar el auto-deploy hasta migrar.

## 2. Migraciones (059 → 063)

Desde `../dentalos-api/`:

```bash
npm run migrate        # aplica pendientes en orden
```

Las 5 son **aditivas y reversibles** (ninguna borra/transforma datos existentes):

| Mig | Qué hace | Nota |
|---|---|---|
| 059 | `professionals.discipline` (default `dentistry` + backfill) | Odontólogos actuales quedan igual |
| 060 | `patient_clinical_histories.discipline_sections_enc` (cifrada) | NULL para odontología ⇒ cero efecto |
| 061 | Tablas `clinical_encounters` + `clinical_encounter_signatures` (cifradas, RLS, soft-delete) | Complementa, no reemplaza la HC base |
| 062 | `discipline` en plantillas de consentimiento + **seed** por especialidad | **No aplicada a prod todavía**; filtrado vive en `GET /consents/templates` |
| 063 | `CREATE OR REPLACE clinical_stats` | Cambia semántica del gráfico "pacientes por mes" (no toca datos) |

Rollback: cada `.sql` documenta su rollback manual en el header (no están como archivos
en la carpeta a propósito). 062 al revertir borra plantillas globales no-dentistry sembradas.

## 3. Env vars al lanzar

- **API (Railway):** `WHATSAPP_SHARED_BRAND=VitalOS`. `FRONTEND_URL` → dominio real
  servido (si todavía es `dentalos.pro`, dejar ahí; cuando se corte, a `vitalos.com.ar`).
- **Web (Vercel):** revisar `NEXT_PUBLIC_*` / URL de API si cambia.

El código ya tiene como default `https://vitalos.com.ar` (`web/app/layout.tsx`,
`professionals/routes.ts`), pero **en prod mandan las env vars** — alinearlas con el
dominio que realmente estés sirviendo para no romper OG/links/redirects de auth.

## 4. Corte de dominio (F5/F6) — fase aparte, tuya

Ver `docs/rebrand-vitalos-migration.md` §6–§7. Resumen de lo externo pendiente:
DNS/Vercel, Supabase Auth (Site URL + Redirect URLs), webhooks MP/Nave (`back_urls`,
`notification_url`), email `soporte@vitalos.com.ar` (hoy se usa WhatsApp +54 9 3438 55-8913
en su lugar), Twilio/WhatsApp sender, redirect 301 `dentalos.pro` → `vitalos.com.ar`.

**No tocar** (decidido): prefijo `id: dentalos-${plan}` de MercadoPago (matchea webhooks)
y las keys de IndexedDB `dentalos-*` (identificadores internos históricos).

## 5. Verificación post-deploy

- [ ] Login / reset password / confirm signup end-to-end
- [ ] Alta de paciente + historia clínica (odontología sin cambios) y una disciplina nueva
- [ ] `GET /consents/templates` devuelve solo plantillas de la disciplina del profesional
- [ ] Webhook de pago MP/Nave impacta OK
- [ ] PDF factura AFIP + comprobante PNG + imagen de presupuesto/consentimiento con marca VitalOS
- [ ] Recordatorio WhatsApp sale con marca "VitalOS"
- [ ] Dashboard/stats: gráfico "pacientes por mes" con `total` + `new_patients`

## 6. Pendientes de assets (no bloquean el merge)

Regrabar `public/demo-presupuesto.mp4` y `demo-consentimiento.mp4`; regenerar
`opengraph-image.tsx`; logo VitalOS en `ClinicalHistoryPDF.tsx`, `generateReceipt.ts`
y factura AFIP (`invoice-pdf.ts`). Detalle en `rebrand-vitalos-migration.md` §3.
