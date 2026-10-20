# VitalOS multi-especialidad — Runbook de QA y rollout (Fase 5)

> Operativo. Acompaña a `VITALOS_MULTI_SPECIALTY_PLAN.md`. Asume que el código de Fases 1–4 está mergeado. **Nada se activa visiblemente hasta encender el flag.**

## 1. Feature flag de activación progresiva

| Dónde | Variable | Default | Efecto |
|---|---|---|---|
| API (Railway) | `VITALOS_MULTI_SPECIALTY_SIGNUP` | *(no seteada = off)* | **Barrera real.** Con off, la única disciplina asignable es `dentistry` en registro, alta por owner/admin y cambio en settings (403 ante cualquier otra). |
| Web (Vercel) | `NEXT_PUBLIC_VITALOS_MULTI_SPECIALTY_SIGNUP` | *(no seteada = off)* | **Solo UI.** Con off, no se muestra el selector en el registro ni la sección "Mi especialidad" en settings. |

- La barrera de verdad es la de la API (el cliente no es confiable). La web solo oculta UI.
- **Fase A (ambos off):** todo el código está vivo pero el producto se comporta **igual a DentalOS**. Todo nuevo profesional queda en `dentistry`.
- **Fase B (ambos on):** se abre el registro/cambio multi-especialidad.
- Encender la web sin la API daría 403 al intentar registrar no-odontología; encender la API sin la web no abre la UI. **Encender ambos a la vez.**

## 2. Orden de despliegue (crítico)

1. **DB primero — migración 059** (`cd dentalos-api && npm run migrate`). Aditiva, idempotente. Backfill a `dentistry`.
   > ⚠ El backend de Fase 2 **inserta** `discipline`. Si 059 no corrió, todo registro/alta rompe. 059 va **antes** que el deploy del backend.
2. **Backend** (API) con el flag **off**. Como todos son `dentistry`, nada cambia.
3. **Frontend** (web) con el flag **off**. Nav y fichas sin cambios (fallback a dentistry).
4. **Verificación en Fase A** (sección 3) — confirmar cero regresión en odontología.
5. **Encender Fase B** (ambos flags `true`) cuando QA valida la sección 4.

## 3. QA — Fase A (flag off): regresión odontología (debe pasar ANTES de abrir)

- [ ] Login de un odontólogo existente: ve Inicio/Agenda/Pacientes/Estadísticas/Config igual que antes.
- [ ] Ficha de paciente: el **odontograma se renderiza y es editable** como siempre (toggle adulto/niño incluido).
- [ ] Cargar/editar un diente (PUT) y bulk → guardan OK (200).
- [ ] Registro de un nuevo consultorio: **no aparece** el selector de especialidad; la cuenta queda en `dentistry` (verificar `professionals.discipline` en DB).
- [ ] Settings: **no aparece** "Mi especialidad profesional".
- [ ] `POST /auth/register` por API con `discipline:"psychology"` → **403**.
- [ ] Sesión vieja (token previo a la migración, sin `discipline` en la fila ya resuelto por backfill) sigue operando normal.

## 4. QA — Fase B (flag on): multi-especialidad

Mapea los escenarios del plan (§16). Marcar en staging antes de prod.

- [ ] (3) Nuevo **odontólogo** se registra eligiendo "Odontología" → ve odontograma.
- [ ] (4) Nuevo **psicólogo** se registra → **no ve** odontograma; ve agenda/pacientes/historia/finanzas.
- [ ] (5) **Kinesiólogo** idem psicólogo (matriz casi plana: solo odontograma difiere).
- [ ] (16) **Invite:** el invitado elige su propia disciplina (no la del que invita).
- [ ] (6) Cambiar especialidad en settings (odonto→psico): confirmación clara, odontograma desaparece **sin recargar** relogin (invalida `me`).
- [ ] (7) Volver a Odontología: odontograma y datos **reaparecen** intactos.
- [ ] (8) Tras los cambios, en DB siguen **todos** los odontogramas/tratamientos/historias (no se borró nada).
- [ ] (17) Odontólogo→psicólogo con odontograma previo: lo ve en **solo lectura** (badge), sin poder editar.
- [ ] (9) Psicólogo llama directo `PUT /treatments/odontogram/:id` → **403**; `GET` del odontograma → **200** (lectura permitida).
- [ ] (10) Profesional de clínica A no accede a datos de clínica B (RLS — regresión, no debe cambiar).
- [ ] Auditoría: cada cambio de especialidad deja fila en `audit_log` (`action='professional.discipline_change'`, old/new).

## 5. Monitoreo (post Fase B)

- Conteo de `professionals` por `discipline` (debería crecer solo en las disciplinas esperadas).
- Logs de la API: `discipline audit failed` (no debería aparecer), 403 de capacidad (esperables ante bypass).
- Alertar si aparece algún `discipline` fuera del catálogo (no debería: lo bloquean `z.enum` + CHECK).

## 6. Rollback

Por capa, de menor a mayor:

1. **Apagar el flag** (`VITALOS_MULTI_SPECIALTY_SIGNUP` y su `NEXT_PUBLIC_`): instantáneo. Vuelve a Fase A (solo odontología en altas/cambios). Los no-odontólogos ya creados **conservan** su disciplina y su experiencia; simplemente no se crean nuevos. Es el rollback preferido.
2. **Revertir deploys** (web/API): seguro gracias al fallback-a-dentistry (sin `discipline` legible, todo se comporta como DentalOS).
3. **Revertir la columna** (último recurso, normalmente **no** hace falta — es inocua):
   ```sql
   DROP INDEX IF EXISTS idx_professionals_discipline;
   ALTER TABLE professionals DROP CONSTRAINT IF EXISTS professionals_discipline_chk;
   ALTER TABLE professionals DROP COLUMN IF EXISTS discipline;
   ```
   Sin pérdida de datos clínicos (`discipline` no es dato clínico). Correr a mano; **no** dejar el `.sql` en `migrations/` (el runner lo ejecutaría).

> Regla transversal que hace seguro todo rollback: **ausencia/duda de `discipline` ⇒ comportamiento DentalOS (`dentistry`)**, implementado en `normalizeDiscipline` (web/API) y en el fail-open del guard de backend.
</content>
