# Estado del rollout de cifrado PHI — DentalOS

> **Fuente de verdad del estado del despliegue.** Última actualización: 2026-10-19.
> Complementa `rollout-runbook.md` (procedimiento) y `encryption-audit-and-plan.md` (diseño).

## 1. Resumen ejecutivo

El cifrado de PHI (envelope encryption con AWS KMS + DEK por clínica) está **desplegado y
activo en producción**. Todo el PHI sensible está cifrado en columnas `*_enc`, con **dual-write**
(se escribe en claro y cifrado) y **lectura desde la columna cifrada**.

**Estado: estable y reversible.** El único paso que falta —y es irreversible— es el **contract**
(dejar de escribir el texto plano y dropear esas columnas), planeado para **dentro de unos días**
tras un período de observación.

Mientras no se haga el contract: un dump de Postgres **todavía contiene el PHI en claro** (en las
columnas sin dropear). El contract es lo que finalmente lo saca del dump.

## 2. Cómo funciona HOY (post-deploy, pre-contract)

- **Escritura (dual-write)**: cada write guarda el valor en la columna en claro **y** en `*_enc`
  (cifrado AES-256-GCM, DEK por clínica envuelta por la KEK de AWS KMS). Gated por `CRYPTO_ENABLED=true`.
- **Lectura**: la API prefiere `*_enc` → la descifra y la devuelve. Si `*_enc` fuera null, cae al
  texto plano (fallback resiliente). Como todo está backfilleado + dual-write, **siempre se sirve
  desde `*_enc`**; la columna en claro es solo red de seguridad.
- **Frontend**: no lee Supabase directo; todo pasa por la API (Fastify), que descifra. El SSR de la
  ficha (`patients/[id]/page.tsx`) también va por la API.
- **Caché Redis**: la ficha y la historia se cachean **sin el PHI en claro** (solo el ciphertext,
  que se descifra al leer).
- **audit_log**: el trigger ya **no** guarda PHI en escrituras nuevas; el histórico fue limpiado (scrub).

## 3. Qué está cifrado (tablas y columnas)

| Tabla | Columnas cifradas (`*_enc`) | Backfilleados |
|---|---|---|
| `patients` | `allergies`, `current_medications`, `medical_notes` | 317 |
| `patient_clinical_histories` | `alerts`, `medical_history`, `family_history`, `habits`, `summary` | 81 |
| `clinical_history_signatures` | `history_snapshot`, `signature_data`, `signer_ip`, `signer_ua` | 49 |
| `professionals` | `afip_cert`, `afip_key` | 5 |

**En claro a propósito** (decisión de diseño): nombres, DNI, teléfono, email (pendientes F3 con blind
index); importes financieros; enums clínicos; FKs y timestamps. Ver `data-copies-matrix.md`.

## 4. Pasos completados (runbook)

- [x] **0.** Migraciones 051–058 aplicadas en prod. Vars AWS/KMS en Railway. `CRYPTO_ENABLED` creado.
- [x] **1.** Deploy de código (API Railway + web Vercel). Fix de build: `railway.toml` →
  `npm install --include=dev && npm run build` (NODE_ENV=production omitía typescript → `tsc not found`).
- [x] **2.** Verificado deploy sano.
- [x] **3.** F0.0: backfill de `app_metadata` (25/25 usuarios). `AUTH_ALLOW_USER_METADATA=false`
  seteado en Railway (fallback a `user_metadata` desactivado en la API).
- [x] **4.** `CRYPTO_ENABLED=true`. Dual-write verificado en prod.
- [x] **5.** Backfills aplicados: patients 317, AFIP 5, historias 81, firmas 49. 0 fallos.
  (Hizo falta `058` = GRANT service_role en las 2 tablas creadas fuera de migraciones.)
- [x] **6.** Scrub del `audit_log` histórico (SQL en el editor de Supabase).
- [x] **7.** Verificación: `verify-encryption.ts` → **1159/1159** descifran y coinciden con el plano
  (deep-equal; el JSONB reordena claves, es cosmético). ✅ Seguro para el contract.

## 5. Lo que FALTA (contract — irreversible)

El contract **no es solo `DROP COLUMN`**. Con el código actual (dual-write) un DROP rompería los
writes (intentan escribir columnas inexistentes). Secuencia:

1. **Cambio de código a "enc-only"**: dejar de escribir / seleccionar / hacer fallback a las columnas
   en claro (escribir y leer solo `*_enc`). *(A implementar.)*
2. Deploy + verificar que la app lee solo de `*_enc`.
3. **`DROP COLUMN`** de las columnas en claro:
   ```sql
   ALTER TABLE patients DROP COLUMN allergies, DROP COLUMN current_medications, DROP COLUMN medical_notes;
   ALTER TABLE professionals DROP COLUMN afip_cert, DROP COLUMN afip_key;
   ALTER TABLE patient_clinical_histories DROP COLUMN alerts, DROP COLUMN medical_history,
     DROP COLUMN family_history, DROP COLUMN habits, DROP COLUMN summary;
   ALTER TABLE clinical_history_signatures DROP COLUMN history_snapshot, DROP COLUMN signature_data,
     DROP COLUMN signer_ip, DROP COLUMN signer_ua;
   ```
4. Verificar con marcador sintético que el dump completo no tiene PHI (§12.1 del plan).

**Antes del contract (observación recomendada, ~1 día):** usar la app con normalidad y confirmar
que en los logs de Railway **no** aparece `descifrado … falló; usando texto plano`. Si no aparece,
está 100% seguro. Documentar retención de backups anteriores (siguen con PHI hasta que roten).

## 6. Variables de entorno (Railway, backend)

| Var | Valor | Nota |
|---|---|---|
| `KMS_PROVIDER` | `aws` | |
| `AWS_KMS_KEY_ID` | arn de la KEK | |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM con `kms:GenerateDataKey`+`Decrypt` | separar del service_role |
| `CRYPTO_ENABLED` | `true` | dual-write activo |
| `AUTH_ALLOW_USER_METADATA` | `false` | F0.0 cerrado (sin fallback a user_metadata) |

## 7. Scripts (en `dentalos-api`)

| Script | Qué hace |
|---|---|
| `src/scripts/test-kms.ts` | Smoke test de KMS (sin tocar DB) |
| `scripts/backfill-app-metadata.mjs` | Copia claims `user_metadata`→`app_metadata` (F0.0) |
| `src/scripts/backfill-patients-phi.ts` | Cifra PHI de patients existente |
| `src/scripts/backfill-afip-encryption.ts` | Cifra secretos AFIP existentes |
| `src/scripts/backfill-clinical-histories.ts` | Cifra historias existentes |
| `src/scripts/backfill-signatures.ts` | Cifra firmas existentes |
| `src/scripts/verify-encryption.ts` | Verifica descifrado == plano (pre-contract) |
| `scripts/scrub-audit-history.mjs` | Limpia PHI histórico del audit (o correr el SQL equivalente) |

Todos los backfills: dry-run por default; `--apply` exige `KMS_PROVIDER=aws`. Se corren localmente
con el `.env` apuntando a prod (REST API; el scrub necesita el SQL editor por el pooler).

## 8. Pendientes

- [ ] **Contract** (enc-only code + DROP) — en unos días, tras observación.
- [ ] Verificar que el login sigue OK tras `AUTH_ALLOW_USER_METADATA=false` (spot-check de sesiones).
- [ ] Migración futura: quitar `user_metadata` del COALESCE en `current_clinic_id()`/
  `current_user_role()` (RLS). Hoy es inocuo (app_metadata tiene precedencia), baja prioridad.
- [ ] Pushear al repo migración `058` + scripts de verificación (commiteados local, sin pushear
  para no redeployar; van con el cambio enc-only).
- [ ] **Fase 3 restante**: `consents` (HTML + firma), campos de turnos/tratamientos/odontograma,
  receptores de `invoices`, notificaciones, archivos de Storage, blind index DNI/teléfono.
- [ ] Rotar la contraseña de Postgres que se expuso en desarrollo (si no se hizo).
- [ ] Fase 4 (hardening): rewrap/rotación de DEK, revocación, restore, observabilidad de KMS.

## 9. Rollback

- **Antes del contract**: `CRYPTO_ENABLED=false` → la API vuelve a leer/escribir texto plano al
  instante (sigue ahí). Totalmente reversible.
- **F0.0**: quitar `AUTH_ALLOW_USER_METADATA` (vuelve el fallback a `user_metadata`).
- **Después del contract**: no hay rollback por columna (el plano se borró) → recuperación = restore
  de backup. Por eso la observación y la verificación (1159/1159 OK) van antes.
