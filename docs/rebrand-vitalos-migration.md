# Rebrand: DentalOS → VitalOS

Migración de marca **DentalOS / dentalos.pro** → **VitalOS / vitalos.com.ar**.

- **Marca oficial:** `VitalOS` (Vital + OS, O y S en mayúscula).
- **Dominio nuevo:** `vitalos.com.ar` (comprado). Dominio viejo: `dentalos.pro`.
- **Ramas:** `rebrand/vitalos` en ambos repos (`dentalos/` web y `dentalos-api/`).
- **Estado:** diagramación / planificación. No se tocó código de producción todavía.

> Regla de seguridad del proyecto: el cambio de marca **no debe debilitar** aislamiento por clínica, verificación de webhooks ni manejo de secretos. Ver `CLAUDE.md`.

---

## 0. Sistema de marca

### Nombre
- Oficial: **VitalOS** (una palabra, "OS" en mayúscula).
- Email soporte nuevo: `soporte@vitalos.com.ar` (reemplaza `soporte@dentalos.pro` y `soporte.dentalos@gmail.com`).

### Paleta
| Token | Hex | Uso | Contraste s/ blanco |
|---|---|---|---|
| `brand-teal` | `#00C4BC` | Logo, acentos grandes, fondos | ~1.9:1 — ❌ no usar en texto |
| `brand-teal-ui` | `#0F766E` | Texto / botones / links | ~4.8:1 — ✅ AA |
| `brand-ink` | `#0F1720` | Texto principal, wordmark "Vital" | ✅ |
| `brand-white` | `#FFFFFF` | Fondos, logo invertido | — |

> ⚠️ El teal del logo `#00C4BC` **no pasa WCAG AA como color de texto**. Hoy la landing lo usa en textos chicos (`page.tsx:638,813`) — corregir a `brand-teal-ui` durante el rebrand.

### Variantes de logo requeridas (pendientes del diseñador)
- [ ] **Wordmark** completo en **SVG** (vectorial, no PNG).
- [ ] **Isotipo** (V + hoja, sin texto) → favicon, app icon, avatar, PDF historia clínica.
- [ ] **Monocromático** negro y blanco → facturas AFIP / comprobantes B/N, fondos oscuros.
- [ ] **Sobre fondo oscuro** (el "Vital" negro desaparece en dark).

Assets actuales a reemplazar: favicon, `opengraph-image`, logo diente SVG embebido en `ClinicalHistoryPDF.tsx`.

---

## 1. Fases de ejecución

| Fase | Qué | Riesgo | Reversible |
|---|---|---|---|
| **F1** | Texto de marca visible "DentalOS" → "VitalOS" | Bajo | Sí |
| **F2** | Assets (logo, favicon, OG, PDFs) | Bajo | Sí |
| **F3** | Dominio en código (`dentalos.pro` → `vitalos.com.ar`) | Medio | Sí |
| **F4** | Identificadores internos (IndexedDB, IDs de pago) | Medio-alto | Parcial |
| **F5** | Infra externa (DNS, Supabase, MP/Nave, email, Railway) | Alto | Depende |
| **F6** | Corte + redirect 301 dominio viejo → nuevo | Alto | Difícil |

Orden recomendado: F1 → F2 → F3 en la rama; F4 con cuidado; F5 preparada en paralelo; F6 el día del corte.

---

## 2. F1 — Texto de marca visible (bajo riesgo)

### Web (`web/`)
- [ ] `app/layout.tsx` — metadata: title, OpenGraph, twitter, siteName (×5)
- [ ] `app/opengraph-image.tsx` — `alt`
- [ ] `app/(public)/page.tsx` — landing + CTA WhatsApp (~8 menciones)
- [ ] `app/(app)/layout.tsx` — paywall, logout, "se paga solo" (×3) + email soporte `:991`
- [ ] `app/(app)/settings/page.tsx` — logout + email soporte (`:591,594`)
- [ ] `app/(public)/auth/forgot-password/page.tsx` (`:61`)
- [ ] `components/ClinicalHistoryPDF.tsx` — `brandText` + footer (`:325,503`)
- [ ] `components/generateReceipt.ts` — "Generado por Dental OS" (`:294`)

### API (`../dentalos-api/`)
- [ ] `email-templates/confirm-signup.html` (`:6,32,70`)
- [ ] `email-templates/password-changed.html` (`:6`)
- [ ] `email-templates/reset-password.html` (`:6`)
- [ ] `src/server.ts` — título Swagger + log (`:126,274`)
- [ ] `src/worker.ts` — log (`:17`)
- [ ] `src/lib/invoice-pdf.ts` — marca en factura AFIP (`:310,317`)
- [ ] `src/modules/mercadopago/routes.ts` — título suscripción (`:99`)
- [ ] `src/modules/nave/routes.ts` — nombre/descripción suscripción (`:315,316`)
- [ ] `src/modules/notifications/service.ts` — `WHATSAPP_SHARED_BRAND` default (`:53`) → setear env `WHATSAPP_SHARED_BRAND=VitalOS` en prod

> Nota PDFs/facturas AFIP: el nombre de marca en la factura es dato fiscal visible — coordinar con el cambio legal/fiscal si la razón social también cambia.

---

## 3. F2 — Assets

### Iconos / favicon
- [x] `app/icon.svg` — isotipo VitalOS (V ink + cruz teal), SVG vectorial
- [x] `app/apple-icon.png` — isotipo 180×180
- [x] `app/favicon.ico` — eliminado (Next sirve `icon.svg`); falta `.ico` legacy multi-res (requiere ImageMagick)

### Media de la landing (home) — parcheada con overlay ffmpeg (sin regrabar)
Técnica: parche SVG→PNG con el logo/URL nuevos, superpuesto con ffmpeg sobre la posición
fija del viejo. Backups de originales en git + `/tmp/vf/orig-backup` (sesión).
- [x] `public/hero-desktop.png` — logo sidebar → VitalOS
- [x] `public/agenda-desktop.png` — logo sidebar → VitalOS
- [x] `public/cuenta-corriente.png` — URL "dentalos.pro" → "vitalos.com.ar" (logo app está blureado, ilegible → no se toca)
- [x] `public/demo-ficha.mp4` — URL + logo header (overlay, header sticky)
- [x] `public/demo-finanzas.mp4` — URL + logo header (overlay)
- [x] `public/demo-turno.mp4` — URL + logo; **login recortado** (quitaba popup de Google con dentalos.pro); dur 22.8→17.8s
- [ ] `public/demo-presupuesto.mp4` — **REGRABAR** (tiene modales que varían el header; app ya está en VitalOS)
- [ ] `public/demo-consentimiento.mp4` — **REGRABAR** (ídem)
- `public/hero-mobile.png` — sin uso en la landing, ignorado

> Aprendizaje: cada video/screenshot fue grabado en sesión aparte → URL bar y logo
> están en posiciones (y color de pill) distintas por archivo. El overlay se calibra
> por archivo. Dentro de un archivo el header es sticky (posición fija), salvo modales.

### Otros assets (pendientes, fuera de la home)
- [ ] Regenerar `app/opengraph-image.tsx` con nuevo logo + colores (hoy usa paleta azul vieja + ícono diente)
- [ ] Reemplazar el logo diente SVG embebido en `components/ClinicalHistoryPDF.tsx` por el isotipo VitalOS
- [ ] Logo en comprobante PNG (`components/generateReceipt.ts`)
- [ ] Logo en factura AFIP (`../dentalos-api/src/lib/invoice-pdf.ts`)

---

## 4. F3 — Dominio en código (`dentalos.pro` → `vitalos.com.ar`)

- [ ] `web/app/layout.tsx:10` — `siteUrl = 'https://dentalos.pro'`
- [ ] `web/app/(public)/page.tsx:256,380` — chips de URL en mockups
- [ ] `web/components/generateReceipt.ts:319,522` — footer del PNG
- [ ] `../dentalos-api/src/modules/professionals/routes.ts:191` — default de `FRONTEND_URL`
- [ ] `../dentalos-api/email-templates/password-changed.html:57` — `soporte@dentalos.pro`
- [ ] Emails de soporte `soporte.dentalos@gmail.com` → `soporte@vitalos.com.ar` (layout, settings)

---

## 5. F4 — Identificadores internos (⚠️ cuidado)

No hacer find-replace a ciegas; cada uno tiene efecto colateral.

- [ ] `web/lib/patientsLocalDb.ts:25` — store IndexedDB `dentalos-patients`
- [ ] `web/lib/queryClient.tsx:13,44,58` — keys `dentalos-last-uid`, `dentalos-cache`, `dentalos-rq`
  - **Efecto:** cambiar el nombre huérfana el cache local de los usuarios actuales. Es auto-reparable (se repuebla al reconectar), pero genera un flush en prod. Decidir: migrar o dejar como identificadores internos históricos.
- [ ] `../dentalos-api/src/modules/mercadopago/routes.ts:98` — `id: dentalos-${plan}-${billing}`
  - **Verificar antes:** que ningún webhook / conciliación matchee por ese `id`. Si matchea, mantener el prefijo o migrar con cuidado.
- [ ] `../dentalos-api/package.json` — `name: dentalos-api` (cosmético; afecta scripts/logs)

---

## 6. F5 — Infra externa (fuera del repo, lo más pesado)

- [ ] **DNS / Vercel**: apuntar `vitalos.com.ar`, certificado TLS, dominio primario.
- [ ] **Supabase Auth**: Site URL + Redirect URLs → nuevo dominio (afecta login, reset password, confirm signup).
- [ ] **Env vars** (web y API, en Vercel/Railway): `FRONTEND_URL`, `NEXT_PUBLIC_*`, `WHATSAPP_SHARED_BRAND=VitalOS`, cualquier URL de API.
- [ ] **Railway API**: evaluar rename del servicio `dentalos-api-production.up.railway.app` (rompe URL; preferible dominio propio tipo `api.vitalos.com.ar`).
- [ ] **MercadoPago / Nave**: `back_urls`, `notification_url` (webhooks) → nuevo dominio.
- [ ] **Twilio / WhatsApp**: nombre de remitente / plantillas con "VitalOS".
- [ ] **Email**: casilla `soporte@vitalos.com.ar`, SPF / DKIM / DMARC del nuevo dominio.
- [ ] **AFIP**: si cambia razón social/CUIT de facturación, coordinar aparte (no es solo branding).
- [ ] **PostHog / analytics**: revisar nombre de proyecto / dominios permitidos.

---

## 7. F6 — Corte

- [ ] Deploy coordinado web + API con el nuevo dominio activo.
- [ ] **Redirect 301** `dentalos.pro` → `vitalos.com.ar` (mantener dominio viejo vivo un tiempo).
- [ ] Mantener `dentalos.pro` redirigiendo ≥ 6-12 meses (links en emails viejos, WhatsApp, buscadores).
- [ ] Verificar: login, reset password, signup, webhooks de pago, generación de PDF/factura, recordatorios WhatsApp.
- [ ] Comunicar el cambio de marca a clínicas activas.

---

## 8. Verificación post-migración

- [ ] `grep -rniI "dentalos" web ../dentalos-api --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist` → solo deberían quedar identificadores internos documentados en F4 (si se decide no migrarlos).
- [ ] Login + sesión end-to-end en el nuevo dominio.
- [ ] Email de confirmación / reset con links al nuevo dominio.
- [ ] Webhook de pago (MP/Nave) impacta correctamente.
- [ ] PDF de factura AFIP y comprobante PNG con marca/logo VitalOS.
- [ ] Recordatorio WhatsApp sale con marca "VitalOS".
- [ ] OG image / favicon correctos al compartir link.

---

## 9. Documentación a actualizar al cerrar

- [ ] `CLAUDE.md` (web y `../dentalos-api/CLAUDE.md`) — nombre, dominio, URLs.
- [ ] `docs/architecture/*`, `docs/architecture/integrations.md` — URLs e integraciones.
- [ ] `docs/reference/api-map.md` — base URL si cambió.
