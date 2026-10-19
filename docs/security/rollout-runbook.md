# Runbook de despliegue — Cifrado PHI (F0 + F1 + F2)

> Orden exacto para activar en producción lo implementado (Fase 0, core F1, piloto F2),
> con verificación y rollback por paso. Cada paso es **reversible hasta el contract**.
> Piloto F2 validado el 2026-10-19 contra la base productiva usando la clínica de prueba
> `4e3d3cd0-edc7-4402-b768-c05249671dce` sin afectar clientes.

Principio: nada destruye datos hasta el **contract** (último paso). Antes de eso,
`CRYPTO_ENABLED=false` revierte a texto plano instantáneamente (dual-write + lectura resiliente).

## 0. Pre-requisitos (una vez)

- [ ] **Rotar la contraseña de Postgres** que se expuso en desarrollo (Supabase → Settings →
      Database → Reset password) y actualizar `DATABASE_URL` en `.env` local y en Railway.
- [ ] En AWS: confirmar que el IAM que usa Railway tiene **solo** `kms:GenerateDataKey` +
      `kms:Decrypt` sobre la KEK, y es **distinto** del `service_role` de Supabase.
- [ ] Borrar el CSV de credenciales AWS de Descargas.

## 1. Esquema (migraciones 051–055)

**Estado: ya aplicadas en prod** durante la validación del piloto (son aditivas/invisibles).
Confirmar:

```sql
select filename from _migrations where filename like '05%' order by filename;
-- deben estar 051..055  (si faltara alguna → aplicarla por SQL editor, son idempotentes)
```

Rollback (solo 051 y 055 tocan objetos compartidos): re-aplicar `current_clinic_id`/
`current_user_role` de la mig. 027 y `audit_trigger_fn` de la 006.

## 2. Deploy de código (CRYPTO_ENABLED aún APAGADO)

- [ ] Deploy backend (Railway) + frontend (Vercel) con el código nuevo.
- [ ] En Railway: setear `KMS_PROVIDER=aws`, `AWS_KMS_KEY_ID`, `AWS_REGION`, credenciales AWS.
      **NO** setear `CRYPTO_ENABLED` todavía. Dejar `AUTH_ALLOW_USER_METADATA` sin tocar (=on).
- [ ] Verificar operación normal: login, agenda, abrir una ficha, cobrar. Sin cambios visibles.
      (Lectura resiliente + dual-write apagado ⇒ comportamiento idéntico al actual.)

Rollback: redeploy de la versión anterior. Nada que revertir en datos.

## 3. F0.0 — Migrar autorización a app_metadata

- [ ] `node scripts/backfill-app-metadata.mjs`  (dry-run) → revisar.
- [ ] `node scripts/backfill-app-metadata.mjs --apply` → debe reportar **"sin fuente = 0"**.
- [ ] Esperar refresh de tokens (~1 h) o forzar re-login de los usuarios.
- [ ] Verificar: editar el propio `user_metadata` y renovar sesión **no** cambia clínica/rol.
- [ ] `AUTH_ALLOW_USER_METADATA=false` en Railway + migración futura que elimine la línea
      `user_metadata` del COALESCE en `current_clinic_id()`/`current_user_role()`. → cierra F0.0.

Rollback: `AUTH_ALLOW_USER_METADATA` sin setear (vuelve el fallback). El backfill es aditivo.

## 4. Activar cifrado (dual-write ON)

- [ ] `CRYPTO_ENABLED=true` en Railway.
- [ ] Verificar: crear/editar un paciente real → en DB aparece `*_enc` **y** el texto plano.
      La ficha sigue mostrando los datos. Sin warnings de fallback en logs.

Rollback inmediato: `CRYPTO_ENABLED=false`. Las lecturas vuelven al plano (sigue ahí).

## 5. Backfill de datos existentes (requiere KMS_PROVIDER=aws)

- [ ] `npx tsx src/scripts/backfill-patients-phi.ts`        (dry-run) → luego `--apply`.
- [ ] `npx tsx src/scripts/backfill-afip-encryption.ts`     (dry-run) → luego `--apply`.
- [ ] Verificar cobertura (ningún registro con PHI en claro sin su `*_enc`):

```sql
-- patients: 0 filas con PHI en claro y sin cifrar
select count(*) from patients
where deleted_at is null
  and ( (allergies is not null           and allergies_enc is null)
     or (current_medications is not null and current_medications_enc is null)
     or (medical_notes is not null       and medical_notes_enc is null) );

-- afip: 0 profesionales con secreto sin cifrar
select count(*) from professionals
where (afip_cert is not null and afip_cert_enc is null)
   or (afip_key  is not null and afip_key_enc  is null);
```

Ambas deben dar **0** antes de avanzar al contract.

## 6. Auditoría sin PHI (F0.3)

- [ ] Verificar que las escrituras nuevas ya no guardan PHI (trigger 055 activo):
      hacer un update de prueba y mirar `audit_log.new_data` (sin columnas sensibles) +
      `changed_fields` poblado.
- [ ] Limpiar histórico: `node scripts/scrub-audit-history.mjs` (dry-run) → `--apply`.
- [ ] **Documentar retención de backups**: los backups/PITR anteriores al scrub siguen
      conteniendo PHI histórico hasta que roten según la política de Supabase.

## 7. Período de observación

- [ ] Correr unos días con `CRYPTO_ENABLED=true`. Monitorear logs: **cero** warnings
      "descifrado … falló; usando texto plano". Confirmar facturación AFIP OK.

## 8. Contract — retirar el texto plano (PUNTO SIN RETORNO)

Solo cuando el paso 5 dio 0 y el paso 7 no mostró warnings. Aplicar por SQL editor
(crear como migraciones 056/057 si se prefiere versionar):

```sql
-- patients
ALTER TABLE patients
  DROP COLUMN allergies,
  DROP COLUMN current_medications,
  DROP COLUMN medical_notes;

-- professionals (secretos AFIP)
ALTER TABLE professionals
  DROP COLUMN afip_cert,
  DROP COLUMN afip_key;
```

Tras el contract: la lectura resiliente ya no tiene fallback (correcto — no debe haber).
Verificar con un marcador sintético que el **dump completo** no contiene PHI (§12.1 del plan).

Rollback tras contract: **no hay** por columna (el plano se fue). La recuperación es restore
de backup previo. Por eso 5 y 7 deben estar sólidos antes de este paso.

---

## Pendiente fuera de este runbook (Fase 3)
Resto de tablas según `data-copies-matrix.md`: `patient_clinical_histories`, campos sensibles
de turnos/tratamientos/sesiones/odontograma, `consents`, firmas, receptores de `invoices`,
notificaciones, y archivos de Storage. Mismo patrón expand→dual-write→backfill→contract.
Además: blind index de DNI/teléfono + búsqueda local (depende de F0.6, ya hecho).
