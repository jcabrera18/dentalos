# VitalOS — Plan de evolución multi-especialidad

> Documento de ingeniería. **Diagnóstico + arquitectura + roadmap.** No contiene código aplicado: nada se implementa hasta aprobación explícita.
> Fecha: 2026-10-20 · Rama: `rebrand/vitalos` · Autor: auditoría técnica Claude Code.
> Alcance: evolucionar DentalOS (odontología) → VitalOS (multi-especialidad) **sin romper a los odontólogos actuales en producción**.

---

## 1. Executive summary

DentalOS es un SaaS multi-tenant en producción con clínicas odontológicas reales. La arquitectura actual es **más favorable de lo esperado** para incorporar especialidades, por tres razones verificadas en código:

1. **El modelo de datos casi no está acoplado a odontología.** La única entidad realmente dental es el **odontograma** (`odontogram`, `tooth_diagnostics`) y su UI dentro de la ficha del paciente. Pacientes, turnos, pagos, finanzas, consentimientos, historia clínica (JSONB) y estadísticas son transversales a cualquier profesional de salud.
2. **La navegación es mínima y centralizada.** El sidebar (`web/app/(app)/layout.tsx`) tiene solo 5 destinos (Inicio, Agenda, Pacientes, Estadísticas, Configuración). El odontograma **no es un ítem de menú**: es una sección embebida en la ficha del paciente. Esto reduce drásticamente el trabajo de "feature gating" de navegación.
3. **La autorización ya está endurecida.** Los claims (`clinic_id`, `professional_id`, `role`) salen de `app_metadata` (solo escribible por `service_role`), verificados por JWT en cada request (`dentalos-api/src/server.ts:141`). Hay una base sólida sobre la cual separar los tres conceptos (capacidad por especialidad, autorización por rol, habilitación por plan).

**Recomendación central:** implementar la especialidad como un atributo **del profesional** (`professionals.discipline`), no de la organización, resuelto a capacidades mediante una **matriz declarativa única** compartida conceptualmente entre frontend y backend. Migrar a todos los profesionales existentes a `discipline = 'dentistry'` con una migración aditiva, idempotente y reversible. **No reutilizar la columna `professionals.specialty` existente** (ver §4.1: ya tiene otro significado y datos vivos).

**Hallazgo crítico de compatibilidad:** existe un choque de nombres. `professionals.specialty` **ya existe** como texto libre ("Ortodoncia", "Endodoncia") y se muestra al público en la página de reserva de turnos (`web/app/(public)/booking/[professionalId]/page.tsx:319`). La nueva "especialidad/disciplina" (DENTISTRY, PSYCHOLOGY…) es un concepto distinto y **debe vivir en una columna nueva**. Confundirlos rompería datos y UI en producción.

El MVP más pequeño con valor real (ver §20): columna `discipline` + migración + selector en onboarding + matriz de capacidades que oculta odontograma/presupuestos a no-odontólogos. Todo lo demás (cambio de especialidad en settings, multi-especialidad, plantillas clínicas por especialidad) es incremental y posterior.

---

## 2. Diagnóstico de arquitectura actual

Fuentes verificadas: `CLAUDE.md`, `docs/architecture/database.md`, `docs/business/modules.md`, migraciones `001`–`058`, y lectura directa de los archivos citados.

### 2.1 Topología

```
Browser ──JWT Supabase (app_metadata)──> Fastify API ──RLS(current_clinic_id)──> Postgres
   │  React Query + IndexedDB                 │
   └── Supabase Auth directo (login)          └── Redis (cache me:/dash:/prof:list:)
```

- **Tenant raíz = `clinics`.** No existe entidad "organización" separada: la clínica *es* la organización.
- **`professionals`** vincula `auth.users` (1:1 vía `auth_user_id UNIQUE`) con una clínica (`clinic_id`). Un usuario de login pertenece hoy a **exactamente una** clínica.
- **Autorización:** `server.ts:141` (`authenticate`) verifica el JWT (jose+JWKS) y setea `request.clinicId / professionalId / userRole` desde `app_metadata`. `current_clinic_id()` (migración 051) prioriza `app_metadata` sobre `user_metadata` (este último fallback transitorio).
- **Cache de identidad:** `/auth/me` y `/auth/startup` devuelven `professionals.* + clinics(id,name,slug,plan,settings)`, cacheado en Redis `me:<profId>:<clinicId>` (5 min) y en cliente `web/lib/profileCache.ts` (módulo JS, 5 min).

### 2.2 Qué es verdaderamente dental vs. transversal

| Área | Acoplamiento a odontología | Evidencia |
|---|---|---|
| Pacientes, turnos, pagos, finanzas, egresos, consentimientos, notificaciones, facturación AFIP, suscripciones | **Transversal** (ninguno) | Esquema y módulos sin campos dentales |
| Historia clínica (JSONB en `patients` + `clinical_history_signatures`) | **Bajo/semántico** — estructura genérica (alerts + notas + riesgo), no odontológica | migración 054/056, `PatientDetailClient.tsx:687` |
| **Odontograma** (`odontogram`, `tooth_diagnostics`, enum `tooth_condition`) | **Alto** — es intrínsecamente dental | migración 009, `PatientDetailClient.tsx:791-843`, `OdontogramView` (`:1805`) |
| **Presupuestos / Tratamientos** | **Medio** — el concepto es transversal, pero hoy su UX vive junto al odontograma y usa terminología dental | `/quotes`, `/treatments`, ficha del paciente |
| Terminología de UI/landing | **Medio** — textos como "Odontología García", "odontograma digital", "Dra. Odontóloga" | `register/page.tsx`, `page.tsx` |

**Conclusión:** el núcleo clínico-administrativo es reutilizable casi sin cambios. El trabajo de especialización se concentra en (a) el odontograma y (b) terminología/empty-states.

### 2.3 Señales de deuda relevantes para esta evolución

- `professionals.specialty TEXT` libre (migración `001:90`) ya ocupa el nombre natural → obliga a nueva columna.
- Navegación hardcodeada en un array `NAV_ITEMS` (`layout.tsx:40`) → fácil de convertir en derivado de capacidades.
- La ficha del paciente (`PatientDetailClient.tsx`, 2.452 líneas) renderiza el odontograma **siempre** (no hay gating) → punto principal de intervención en frontend.
- No hay tests automatizados (confirmado en `docs/development/testing.md` y `CLAUDE.md`). La estrategia de QA (§16) debe asumir verificación manual + introducir los primeros tests de regresión.

---

## 3. Inventario funcional actual (verificado)

De `docs/business/modules.md` + rutas de API + páginas. Todos marcados ✅ existen en código.

| Módulo | Frontend | API | ¿Transversal a especialidades? |
|---|---|---|---|
| Pacientes | `patients/`, `patients/[id]` | `/patients` | Sí |
| Agenda / Turnos | `agenda/`, booking público | `/appointments`, `/schedule-blocks`, `/public/booking` | Sí |
| Historia clínica | `patients/[id]/clinical-history` | `/patients/:id/clinical-history` | Sí (estructura genérica) |
| **Odontograma** | embebido en `PatientDetailClient` | `/treatments/odontogram`, `/treatments/tooth-diagnostics` | **No — solo odontología** |
| Archivos clínicos | `PatientFilesSection` | `/patients/:id/files` | Sí |
| Tratamientos | ficha paciente | `/treatments` | Sí (terminología a revisar) |
| Presupuestos | `patients/[id]/quotes` | `/quotes` | Sí (terminología a revisar) |
| Pagos / Caja | dashboard, `PaymentModal` | `/payments` | Sí |
| Finanzas / Stats | `stats/financial`, `stats/clinical` | `/finance`, `/appointments/stats/*`, `/expenses` | Sí (stats clínicas pueden tener matices) |
| Facturación AFIP | `InvoiceModal` | `/invoices` | Sí |
| Recordatorios WhatsApp | config settings | `/notifications` + worker | Sí |
| Notificaciones in-app | `NotificationBell` | `/notifications/inbox` | Sí |
| Consentimientos | `patients/[id]/consents` | `/consents` | Sí (plantillas podrían variar) |
| Profesionales / Consultorios | `settings/` | `/professionals`, `/auth` | Sí |
| Suscripciones / Planes | layout (modal) | `/subscription`, `/nave`, `/mercadopago` | Sí |

---

## 4. Dependencias odontológicas encontradas (con ruta real)

### 4.1 `professionals.specialty` — colisión de nombres (crítico)
- **Estado actual:** `professionals.specialty TEXT` (texto libre, `migrations/001_core_schema.sql:90`, comentario "e.g. 'Ortodoncia', 'Endodoncia'"). Se escribe vía `CreateProfessionalSchema`/`UpdateProfessionalSchema` (`professionals/routes.ts:16,27`) y se **muestra al público** en la reserva de turnos (`booking/[professionalId]/page.tsx:68,319`).
- **Problema:** es semánticamente la *sub-especialidad/título a mostrar*, no la disciplina que define capacidades. Reutilizarla para DENTISTRY/PSYCHOLOGY pisaría datos reales y texto público.
- **Decisión:** columna nueva `discipline` (ver §6). `specialty` se mantiene como está.

### 4.2 Odontograma (el único módulo intrínsecamente dental)
- **Backend:** tablas `odontogram` + `tooth_diagnostics`, enum `tooth_condition`; rutas bajo `/treatments/odontogram*` y `/treatments/tooth-diagnostics*` (migración 009, RLS en 027).
- **Frontend:** sección embebida en `PatientDetailClient.tsx:791-843`; componente `OdontogramView` (`:1805`); hook `usePatientOdontogram` (`lib/queries.ts`); realtime sub a tabla `odontogram` (`:289`); toggle adulto/niño (`patients.odontogram_type`).
- **Problema:** se renderiza incondicionalmente. Un psicólogo lo vería.

### 4.3 Terminología dental en UI pública y privada
- `web/app/(public)/register/page.tsx` — "Odontología García", "Odontograma digital", "Dra. María García · Odontóloga" (`:27,424,158`).
- `web/app/(public)/page.tsx` — landing con copy dental.
- `web/app/(app)/layout.tsx:135` — feature de plan "Historia clínica con odontograma".
- Empty states / ayuda en la ficha del paciente.

### 4.4 Presupuestos/Tratamientos
- Transversales en concepto, pero su presentación y wording están pensados para odontología y viven junto al odontograma en la ficha.

**No hay** lógica `if (specialty === 'dentistry')` dispersa hoy — porque todo *es* dental. El objetivo es introducir el gating sin crear esa dispersión (§5).

---

## 5. Decisiones arquitectónicas propuestas

| # | Decisión | Alternativa descartada | Razón |
|---|---|---|---|
| D1 | Especialidad = atributo **del profesional** (`professionals.discipline`) | En `clinics` | Requisito explícito: un centro mezcla disciplinas (§4 del pedido). |
| D2 | **Nueva columna** `discipline`, no reutilizar `specialty` | Reusar `specialty` | `specialty` tiene datos vivos y uso público (§4.1). |
| D3 | **Una disciplina principal** por profesional ahora; multi-especialidad **solo preparada**, no implementada | Multi desde el día 1 | YAGNI. El modelo (columna única) se extiende después a array/junction sin rehacer el núcleo. |
| D4 | **Matriz de capacidades declarativa** como única fuente (`capabilities.ts`), espejada front/back | Feature flags por cliente / condicionales dispersos | Evita `if specialty===` disperso (requisito §5). |
| D5 | Separar **3 ejes**: capacidad (disciplina) · autorización (rol) · plan (comercial). El acceso efectivo = `AND` de los tres. | Mezclarlos | Requisito explícito (§5). Seguridad: cambiar de disciplina nunca otorga acceso a datos ajenos. |
| D6 | Disciplina **NO va en el JWT/app_metadata** (v1) | Meterla como claim | No es dato de autorización; meterla en el token la vuelve *stale* al cambiarla y mezcla conceptos (D5). Se lee de `professionals` (ya viaja en `/me`). |
| D7 | Catálogo de disciplinas: constante TS compartida + `CHECK`/tabla catálogo en DB | Enum PG | Un enum PG es costoso de evolucionar (agregar valor = migración + lock). TEXT+CHECK o tabla catálogo permite sumar especialidades con bajo costo (requisito: "sin modificar grandes cantidades de código"). |
| D8 | Gating de backend vía **guard reutilizable** `requireCapability(request, feature)` en los pocos endpoints específicos de disciplina | Chequear en cada handler a mano | Centraliza, audita, y usa la misma matriz que el front. |

### 5.1 El modelo mental de capacidades

```
usuario puede usar feature F  ⇔
    capabilityMatrix[professional.discipline].includes(F)   // disponibilidad por especialidad
  ∧ roleAllows(professional.role, F)                        // autorización por rol (ya existe)
  ∧ planAllows(clinic.plan, F)                              // habilitación comercial (ya existe parcialmente)
```

Hoy el eje de **rol** existe (owner/admin/professional/receptionist) y el de **plan** existe parcialmente (límites de WhatsApp, acceso bloqueado por trial/sub). Esta evolución agrega **solo el eje de disciplina**, sin tocar los otros dos.

---

## 6. Modelo de datos: actual vs. propuesto

### 6.1 Actual (verificado)

```sql
-- migrations/001_core_schema.sql
clinics(id, name, slug, plan, sub_status, settings JSONB, ...)
professionals(
  id, clinic_id, auth_user_id UNIQUE,
  first_name, last_name, email, phone,
  role user_role,            -- owner/admin/professional/receptionist
  specialty TEXT,            -- ⚠ texto libre "Ortodoncia" (NO tocar)
  license_number, color, default_duration_minutes, is_active, ...
)
```

### 6.2 Propuesto (aditivo)

```sql
professionals(
  ...
  specialty TEXT,                       -- se mantiene igual (display/sub-especialidad)
  discipline TEXT NOT NULL DEFAULT 'dentistry'   -- NUEVO (valida contra catálogo)
      REFERENCES disciplines(code),     -- opción A: FK a tabla catálogo
  -- o bien: CHECK (discipline IN ('dentistry','psychology',...))   -- opción B
)

-- Opción A (recomendada): catálogo con integridad referencial + preparado para RLS futura
disciplines(
  code TEXT PRIMARY KEY,                -- 'dentistry','psychology','kinesiology','general_medicine','nutrition','obstetrics'
  label_es TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
)
```

**Multi-especialidad futura (no ahora):** cuando se requiera, se agrega `professionals.additional_disciplines TEXT[]` o una junction `professional_disciplines(professional_id, discipline, is_primary)`. La resolución de capacidades (§9) se diseña desde ya aceptando un *conjunto* de disciplinas, de modo que pasar de 1→N sea aditivo.

**Por qué TEXT+catálogo y no enum PG:** agregar una especialidad nueva con enum requiere `ALTER TYPE ... ADD VALUE` (no reversible fácilmente, limitaciones transaccionales). Con tabla catálogo es un simple `INSERT`.

---

## 7. Estrategia de migración de usuarios existentes

**Requisito máximo:** cero impacto negativo en odontólogos. La migración es **aditiva, idempotente y reversible**.

### 7.1 Migración (forward) — `059_professional_discipline.sql` (propuesta, no aplicar aún)

```sql
-- 1. Catálogo
CREATE TABLE IF NOT EXISTS disciplines (
  code TEXT PRIMARY KEY,
  label_es TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
INSERT INTO disciplines(code,label_es,sort_order) VALUES
  ('dentistry','Odontología',1),
  ('psychology','Psicología',2),
  ('kinesiology','Kinesiología',3),
  ('general_medicine','Medicina general',4),
  ('nutrition','Nutrición',5),
  ('obstetrics','Obstetricia',6)
ON CONFLICT (code) DO NOTHING;              -- idempotente

-- 2. Columna aditiva con default = dentistry (clientes actuales)
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS discipline TEXT NOT NULL DEFAULT 'dentistry'
      REFERENCES disciplines(code);          -- idempotente

-- 3. Backfill explícito (defensa en profundidad; el DEFAULT ya cubre filas nuevas)
UPDATE professionals SET discipline = 'dentistry' WHERE discipline IS NULL;

-- 4. Índice para listados/filtros por disciplina
CREATE INDEX IF NOT EXISTS idx_professionals_discipline ON professionals(clinic_id, discipline);

-- 5. (RLS) NINGÚN cambio de política. discipline NO participa del aislamiento por clínica.
```

**Propiedades:**
- **Idempotente:** `IF NOT EXISTS` + `ON CONFLICT` + `UPDATE` condicional → re-ejecutar no rompe nada.
- **No destructiva:** solo agrega columna y tabla; no borra ni transforma datos existentes.
- **Compatible con sesiones vivas:** no toca JWT ni `app_metadata`; las sesiones actuales siguen válidas (la disciplina se lee de la fila `professionals`, que ya viaja en `/me`).
- **RLS intacta:** la disciplina **no** entra en `current_clinic_id()` ni en ninguna policy. El aislamiento por clínica no cambia.

### 7.2 Rollback — `059_down.sql` (propuesta)

```sql
DROP INDEX IF EXISTS idx_professionals_discipline;
ALTER TABLE professionals DROP COLUMN IF EXISTS discipline;
DROP TABLE IF EXISTS disciplines;     -- solo si ninguna FK la referencia ya
```

- **Sin pérdida de datos clínicos:** `discipline` es metadato de preferencia/capacidad, no dato clínico. Dropearla no afecta pacientes, odontogramas, historias, pagos.
- **Reversibilidad real:** dado que todo lo demás (frontend/backend) debe tolerar ausencia de `discipline` tratándola como `'dentistry'` (ver §11.1), el rollback de DB deja el producto en el comportamiento DentalOS original.

### 7.3 ¿Backfill de `app_metadata`?
**No en v1** (D6). La disciplina no se guarda en el token. Si una fase futura decidiera incluirla como claim para optimizar, se haría con un script de backfill análogo a `scripts/backfill-app-metadata.mjs` ya existente. Documentar como decisión pendiente (§21).

---

## 8. Diseño del catálogo de especialidades

Fuente de verdad **doble y espejada**, con un contrato compartido:

- **DB:** tabla `disciplines` (integridad referencial, validación de `professionals.discipline`).
- **Código:** constante TypeScript única, que además mapea la matriz de capacidades (§9). Candidato a vivir en un módulo compartido; dado que no hay monorepo con paquete compartido, se replica un archivo idéntico en `web/lib/capabilities.ts` y `dentalos-api/src/lib/capabilities.ts` con un test que verifica que ambos coinciden (o se publica como mini-paquete; decisión §21).

```typescript
// capabilities.ts (forma propuesta)
export const DISCIPLINES = ['dentistry','psychology','kinesiology',
  'general_medicine','nutrition','obstetrics'] as const;
export type Discipline = typeof DISCIPLINES[number];

export const DISCIPLINE_LABELS: Record<Discipline,string> = {
  dentistry: 'Odontología', psychology: 'Psicología', kinesiology: 'Kinesiología',
  general_medicine: 'Medicina general', nutrition: 'Nutrición', obstetrics: 'Obstetricia',
};
```

**Agregar una especialidad nueva** = `INSERT` en `disciplines` + agregar entrada en la constante + fila en la matriz. Sin tocar componentes ni endpoints uno por uno (requisito cumplido).

---

## 9. Sistema de capacidades por especialidad

### 9.1 Features (derivadas del inventario real §3, no inventadas)

```typescript
export const FEATURES = [
  'appointments','patients','clinical_records','clinical_files',
  'odontogram','treatments','budgets','payments','finances',
  'analytics_financial','analytics_clinical','consents','invoicing_afip',
] as const;
export type Feature = typeof FEATURES[number];
```

### 9.2 Matriz declarativa (propuesta inicial — a validar con negocio, §21)

| Feature | dentistry | psychology | kinesiology | general_medicine | nutrition | obstetrics |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| appointments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| patients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| clinical_records | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| clinical_files | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **odontogram** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| treatments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| budgets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| payments / finances | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| analytics_financial | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| analytics_clinical | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| consents / invoicing_afip | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> En la práctica, para el MVP el **único** diferenciador es `odontogram`. Las demás features son transversales. Esto es deliberado: empezar con una matriz casi plana reduce riesgo y evita decisiones clínicas prematuras.

```typescript
export const CAPABILITIES: Record<Discipline, ReadonlySet<Feature>> = {
  dentistry: new Set([...ALL_FEATURES]),
  psychology: new Set(ALL_FEATURES.filter(f => f !== 'odontogram')),
  // ...resto derivado igual
};

// Acepta un conjunto de disciplinas desde ya (prepara multi-especialidad, D3)
export function hasCapability(
  disciplines: Discipline[], feature: Feature
): boolean {
  return disciplines.some(d => CAPABILITIES[d]?.has(feature));
}
```

### 9.3 Consumo
- **Frontend:** `NAV_ITEMS` y la ficha del paciente filtran por `hasCapability([me.discipline], f)`. Un hook `useCapabilities()` lee `/me` (ya cacheado).
- **Backend:** guard `requireCapability(request, 'odontogram')` que resuelve la disciplina del profesional (desde la fila `professionals`, cacheable con la misma clave `me:`) y responde `403` si no aplica. Se aplica solo a los endpoints específicos (hoy: `/treatments/odontogram*`, `/treatments/tooth-diagnostics*`).

---

## 10. Modificaciones necesarias en frontend

### 10.1 Navegación dinámica — `web/app/(app)/layout.tsx`
- **Estado actual:** `NAV_ITEMS` y `STATS_ITEMS` son constantes hardcodeadas (`:40,46`). El odontograma no está en el menú, así que el sidebar casi no cambia por disciplina en el MVP.
- **Problema:** aunque hoy el sidebar no expone odontograma, cualquier futura entrada específica (ej. "Odontograma" directo, o stats clínicas específicas) debe derivarse de capacidades, no agregarse hardcodeada.
- **Cambio propuesto:** envolver la fuente de ítems en un filtro `hasCapability`. El layout necesita la disciplina del usuario → leerla de `/me` (hoy el layout no consume `/me`; usa `useSubscription`). Agregar `useProfile()`/`useCapabilities()`.
- **Impacto/riesgo:** bajo. Odontólogos: sin cambios (ven todo). Riesgo: que el layout dependa de un fetch extra de `/me` antes de pintar; mitigar con el cache existente y un fallback a "todas las capacidades" si aún no cargó (evita parpadeo de menús).
- **Dependencias:** `lib/profileCache.ts`, nuevo `lib/capabilities.ts`.
- **Pruebas:** dentista ve menú completo; psicólogo idéntico menú (porque odontograma no está en el menú) — el gating real del MVP está en 10.2.
- **Aceptación:** ningún ítem de menú nuevo aparece/desaparece para odontólogos; el array de navegación se construye vía matriz.

### 10.2 Ficha del paciente — `web/app/(app)/patients/[id]/PatientDetailClient.tsx` (principal)
- **Estado actual:** renderiza el odontograma **siempre** (`:791-843`, `OdontogramView` en `:1805`), con realtime sub a tabla `odontogram` (`:289`) y toggle adulto/niño.
- **Problema:** un no-odontólogo vería y usaría el odontograma.
- **Cambio propuesto:** envolver la sección odontograma (y su suscripción realtime, y las mutaciones `/treatments/odontogram*`) en `hasCapability([discipline],'odontogram')`. Si no aplica, **no se renderiza** (no un placeholder vacío — requisito §6 del pedido). Pasar la disciplina como prop desde el server component padre (que ya hace la carga inicial) para evitar flash.
- **Impacto/riesgo:** medio. Es el archivo más grande y sensible. Riesgo de romper el render del dentista si el gating queda mal. Mitigación: default a "mostrar" cuando la disciplina es `dentistry` o desconocida.
- **Dependencias:** disciplina disponible en el árbol de la ficha (server fetch del paciente ya existe).
- **Pruebas:** dentista ve odontograma idéntico; psicólogo no ve la sección ni dispara su realtime/queries; datos de odontograma previos intactos en DB.
- **Aceptación:** para `dentistry` el DOM/flows son byte-equivalentes al actual; para otras disciplinas la sección está ausente, sin huecos ni errores de consola.

### 10.3 Terminología / landing / onboarding
- `web/app/(public)/register/page.tsx`, `web/app/(public)/page.tsx`: copy dental ("odontograma digital", "Odontología García"). Para VitalOS, neutralizar o condicionar el copy. (Parte se solapa con el rebrand `rebrand-vitalos-migration.md`.)
- Empty states y textos de ayuda en pacientes/ficha: revisar wording dental.
- **Riesgo:** bajo; cosmético. No bloquea el MVP funcional.

### 10.4 Página pública de reserva — `booking/[professionalId]/page.tsx`
- Usa `professional.specialty` (texto libre) como subtítulo (`:319`). **No cambia** (es el display). Opcional: mostrar `DISCIPLINE_LABELS[discipline]` si `specialty` está vacío.

---

## 11. Modificaciones necesarias en backend

### 11.1 Catálogo + lectura de disciplina
- **`dentalos-api/src/lib/capabilities.ts`** (nuevo): espejo de la matriz del front.
- **`/auth/me` y `/auth/startup`** (`auth/routes.ts:296,348`): ya hacen `select('*, clinics(...)')` → `discipline` viaja automáticamente al agregarse la columna. **Verificar** que el `select('*')` no se vuelva `select` explícito sin la columna. Compat: si `discipline` es `null`/ausente, el backend la trata como `'dentistry'`.

### 11.2 Registro y alta de profesionales (persistir + validar disciplina server-side)
- **`auth/routes.ts` `POST /auth/register`** (Mode B, clínica nueva `:167` y Mode A, invite `:87`):
  - **Estado:** no captura disciplina.
  - **Cambio:** aceptar `discipline` en `RegisterClinicSchema` (`:20`), **validar contra el catálogo** (`z.enum(DISCIPLINES)`), default `'dentistry'`, e insertarla en `professionals`. Nunca confiar en que el cliente la mande "bien": validación zod + FK en DB.
- **`professionals/routes.ts` `POST /professionals`** (`:105`) y **`POST /professionals/invite`** (`:170`):
  - Alta directa por owner/admin y flujo de invitación. Agregar `discipline` a `CreateProfessionalSchema` (`:10`) y, para invites, decidir si la disciplina la fija quien invita o la elige el invitado al completar el perfil (recomendado: el invitado la elige en onboarding; el invite puede pre-sugerir). Persistir server-side.
- **`PATCH /professionals/:id`** (`:288`): agregar `discipline` a `UpdateProfessionalSchema` (`:23`) con la misma validación (habilita el cambio desde Settings, §14).
- **Impacto/riesgo:** medio. Son los puntos donde "no debe poder omitirse por API": la defensa es zod (`enum`) + `NOT NULL DEFAULT` + FK. Aun si el cliente omite el campo, queda `'dentistry'` (seguro para el negocio actual).

### 11.3 Guard de capacidad en endpoints específicos de disciplina
- **Nuevo** `requireCapability(feature)` (helper en `src/lib/`), aplicado como hook en:
  - `/treatments/odontogram*`, `/treatments/tooth-diagnostics*` (los únicos hoy específicos).
- **Estado actual:** esos endpoints solo chequean `authenticate` (clínica/rol), no disciplina.
- **Problema:** un profesional de otra disciplina, manipulando el frontend o llamando directo, podría crear/leer odontogramas.
- **Cambio:** el guard resuelve la disciplina del `professionalId` (cache `me:`), y responde `403` si la feature no está habilitada. **Importante:** esto es defensa adicional; **no** reemplaza RLS ni el aislamiento por clínica. Un odontograma sigue siendo de la clínica del profesional.
- **Matiz de compatibilidad:** si un dentista cambió a otra disciplina pero su clínica tiene odontogramas históricos, el guard bloquearía la *escritura/entrada* nueva pero **la lectura histórica debe seguir permitida** según la política de §14 (no se pierde acceso a datos propios de la clínica). Definir el guard a nivel de *entrada de datos/UI*, y mantener lectura por clínica. (Decisión fina en §21.)

### 11.4 Invalidación de cache al cambiar disciplina
- Cambiar `discipline` (PATCH) debe `redisDel('me:<profId>:<clinicId>')` y `prof:list:<clinicId>` (patrón ya usado en `professionals/routes.ts:322`), y el cliente debe `invalidateProfileCache()` (`lib/profileCache.ts:26`).

---

## 12. Modificaciones en Supabase/PostgreSQL/RLS

- **Migración `059`** (§7.1): tabla `disciplines` + columna `professionals.discipline` + índice. Aditiva e idempotente.
- **RLS: sin cambios.** `discipline` no participa del aislamiento. Las policies siguen filtrando por `current_clinic_id()`. **No** agregar la disciplina a `current_clinic_id()`/`current_user_role()` ni a ninguna policy — mezclaría capacidad con autorización (D5) y es un riesgo de seguridad innecesario.
- **Verificar** que agregar la columna no rompa vistas con `security_invoker` (no las toca; `SELECT *` de las vistas no incluye `professionals.discipline` salvo que una vista la seleccione — ninguna lo hace hoy).
- **Odontograma histórico:** sin cambios de esquema. Los datos permanecen; solo cambia su visibilidad en UI/entrada (§14).

---

## 13. Flujo de registro (propuesto)

**Recomendación UX/arquitectura:** incluir el selector **durante el registro** (no en una etapa posterior), porque:
1. La disciplina determina qué ve el usuario desde el primer login → pedirla después implica un estado intermedio "sin disciplina" que hay que manejar.
2. Es una sola pregunta, mobile-friendly, de bajo rozamiento.
3. Evita migraciones de estado (usuarios a medio onboardear).

**Diseño:**
- Agregar al form (`register/page.tsx`) un paso/selector **"¿Cuál es tu especialidad?"** (chips grandes, 1 tap, mobile-first) poblado desde el catálogo. Default visual sugerido: Odontología (no preseleccionado obligatoriamente — a validar).
- Enviar `discipline` en el body a `POST /auth/register`; backend valida contra catálogo (nunca confía en el cliente) y persiste.
- **Flujo por invitación:** el invitado elige su disciplina al completar el perfil (la invitación no la impone). Si el que invita quiere pre-fijarla, se almacena como sugerencia en el invite (decisión §21).
- **Alta por owner/admin** (`POST /professionals`): el formulario de settings incluye el selector; backend valida.
- **Otros flujos:** no hay OAuth/terceros hoy (solo email+password vía Supabase). Si se agrega, aplicar la misma regla: disciplina obligatoria validada server-side, default `dentistry` solo para compat.

**Criterio de aceptación:** ningún profesional nuevo queda sin `discipline`; la validación falla en backend si se manda un valor fuera del catálogo; el flujo odontológico actual (sin elegir, si se omitiera) sigue aterrizando en `dentistry`.

---

## 14. Flujo de configuración y cambio de especialidad

**Ubicación:** nueva sección **"Mi especialidad profesional"** en `web/app/(app)/settings/page.tsx` (junto a perfil/AFIP/cuenta; la página ya tiene secciones modulares: `PlanCard`, `AfipConfigSection`, `AccountActionsSection`).

**Comportamiento propuesto** (y evaluación del caso crítico odontólogo→psicólogo):

| Expectativa del pedido | Veredicto arquitectónico |
|---|---|
| Se oculta el odontograma | ✅ Correcto vía matriz (§9/§10.2). |
| No se elimina ningún odontograma / historia / tratamiento | ✅ **Obligatorio.** Cambio de disciplina = cambio de *preferencia/capacidad*, nunca `DELETE`. |
| Volver a odontología restaura visibilidad | ✅ Los datos nunca se tocaron; al volver, la matriz re-habilita. |
| Cambios auditados | ✅ Usar `audit_log` (ya existe `audit_trigger_fn`); registrar `discipline` old→new. |
| Respetar permisos en registros históricos | ✅ El acceso sigue gobernado por clínica (RLS) + rol, no por disciplina. |

**Salvaguardas recomendadas (sin sobrecomplicar):**
- **Confirmación explícita** al cambiar, explicando qué módulos aparecen/desaparecen y que **no se borra nada**.
- **Diferenciar "preferencia de interfaz" de "declaración profesional":** el cambio es real (afecta capacidades), así que se audita y se confirma. No es un toggle trivial.
- **Sesiones simultáneas / multi-dispositivo:** como la disciplina se lee de `/me` (no del JWT), al refrescar `/me` (invalidación de cache Redis + cliente) las otras sesiones convergen en ≤5 min (TTL) o al navegar. Aceptable; documentar. (Si se exigiera inmediatez, forzar refetch vía realtime sobre `professionals` — ya hay patrón de realtime.)
- **Cache:** invalidar `me:` (Redis) y `profileCache` (cliente) en el PATCH (§11.4). React Query: invalidar queries que dependen de capacidades.
- **Cambios accidentales:** confirmación + auditoría cubren el riesgo. No se requiere "papelera" porque no hay destrucción de datos.
- **Permisos de otros profesionales:** cambiar *mi* disciplina no afecta la de otros ni su experiencia (atributo por fila). ✅ cumple requisito §4.5 del pedido.

**Riesgo:** bajo-medio. El principal es la coherencia de cache entre sesiones; mitigado arriba.

---

## 15. Riesgos de seguridad

Alineado con `CLAUDE.md` (aislamiento por clínica = requisito) y la auditoría de cifrado en curso (`project_encryption_audit`).

1. **No confundir capacidad con autorización (D5).** Cambiar de disciplina **no debe** otorgar acceso a datos de otra clínica ni elevar rol. La disciplina no entra en RLS ni en `app_metadata`. ✅ por diseño.
2. **Gating de backend obligatorio, no solo UI.** Ocultar el odontograma en el front no alcanza: `requireCapability` en los endpoints de odontograma evita el bypass por URL/API directa (requisito §5 "seguridad"). Pero **es defensa en profundidad**, subordinada a RLS por clínica.
3. **Lectura de datos históricos.** El gating por disciplina debe aplicarse a *entrada/edición*, no a *lectura de datos propios de la clínica*, para no romper compatibilidad (un dentista que migró no debe perder acceso de lectura a sus odontogramas). Definir esto explícitamente (§21).
4. **Caché compartida.** `me:`/`prof:list:` y `profileCache` cliente: invalidar en cada cambio de disciplina para no servir capacidades viejas (§11.4). El cierre de sesión ya limpia IndexedDB (`queryClient.tsx`).
5. **Validación server-side del catálogo.** `z.enum(DISCIPLINES)` + FK a `disciplines` → imposible setear un valor arbitrario por API.
6. **Cifrado PHI (auditoría en curso).** La disciplina **no es PHI** y no requiere cifrado. No interferir con el trabajo F0.x de `dentalos-api` (tenant keys, `patients_phi_enc`, `clinical_histories_enc`). El plan es ortogonal.
7. **Migraciones de producción.** Aditivas, idempotentes, con rollback probado (§7). Aplicar fuera de pico; no bloquean escrituras significativas (ADD COLUMN con DEFAULT en PG ≥11 es rápido, no reescribe la tabla).

### 15.1 Protección de datos de salud (Argentina) — distinguir verificado vs. recomendación
- **Recomendación técnica (no asesoría legal):** la Ley 25.326 (Protección de Datos Personales) y la Ley 26.529 (Derechos del Paciente / historia clínica) encuadran datos sensibles de salud. Ampliar a nuevas especialidades **no cambia** las obligaciones ya asumidas, pero **sí amplía el universo de datos sensibles** (ahora psicológicos, etc.), potencialmente con mayor sensibilidad.
- **Requiere validación legal (no verificable en código):** si las historias clínicas de salud mental u otras disciplinas tienen requisitos específicos de confidencialidad/retención. **Marcar como pendiente legal** antes de la Fase 2 (plantillas clínicas por especialidad). No es bloqueante para el MVP (que no crea campos clínicos nuevos).

---

## 16. Estrategia de testing

No hay tests hoy (`docs/development/testing.md`). Esta evolución es buena oportunidad para introducir los primeros tests de regresión *acotados*.

**Niveles:**
- **DB/migración:** script que aplica `059` dos veces (idempotencia), verifica backfill `= 'dentistry'`, y aplica `059_down` sin pérdida (contar filas de `patients`/`odontogram` antes/después).
- **Backend (vitest, ya configurado):** unit de `capabilities.ts` (matriz) + `requireCapability` (403 para psicólogo en `/treatments/odontogram`, 200 para dentista); validación zod de `discipline` en registro.
- **Frontend:** render test de la ficha: dentista muestra odontograma; psicólogo no lo monta.
- **Contrato front↔back:** test que verifica que las dos copias de `capabilities.ts` son idénticas (o unificarlas en paquete).

**Escenarios obligatorios (del pedido §11) + agregados:**

| # | Escenario | Tipo |
|---|---|---|
| 1 | Odontólogo existente conserva funcionalidades | regresión manual + render |
| 2 | Odontólogo existente recibe `discipline='dentistry'` por migración | DB |
| 3 | Nuevo odontólogo se registra con disciplina | e2e/manual |
| 4 | Psicólogo se registra, no ve odontograma | render + guard |
| 5 | Kinesiólogo ve solo módulos aplicables | render |
| 6 | Cambiar disciplina actualiza capacidades | integración |
| 7 | Volver a odontología restaura módulos y datos | integración |
| 8 | Ningún cambio de disciplina borra registros clínicos | DB/integración |
| 9 | No se puede evadir por URL/API directa | guard backend (403) |
| 10 | Profesional no accede a datos de otra clínica | RLS (regresión) |
| 11 | Sesiones viejas siguen funcionando durante el rollout | compat (disciplina ausente → dentistry) |
| 12 | Migraciones idempotentes | DB |
| 13 | Rollback sin pérdida de datos | DB |
| 14 | Flujos críticos de odontología intactos | regresión manual |
| **+15** | **Sesión multi-dispositivo converge tras cambio** (cache) | integración |
| **+16** | **Invite: el invitado puede fijar su propia disciplina** | e2e |
| **+17** | **Lectura histórica de odontograma tras migrar de disciplina** (política §15.3) | integración |
| **+18** | **`select('*')` de `/me` sigue devolviendo `discipline`** | contrato |

---

## 17. Estrategia de rollout y rollback

**Rollout incremental con feature flag de producto** (no por cliente; la disciplina ya segmenta):
1. **DB primero:** aplicar `059` (aditiva). En este punto nada en la app usa `discipline` aún → cero efecto visible. Odontólogos quedan en `dentistry`.
2. **Backend:** desplegar lectura + validación + guard, con la matriz "casi plana" (solo odontograma gated). Como todos son `dentistry`, nadie pierde acceso.
3. **Frontend:** desplegar navegación/ficha derivadas de capacidades, con **fallback a "todas las capacidades" cuando la disciplina no cargó o es `dentistry`**. Odontólogos: sin cambios.
4. **Onboarding:** habilitar el selector en registro (permite dar de alta no-odontólogos).
5. **Settings:** habilitar cambio de disciplina.
6. **Activación progresiva:** la capacidad de registrar otras disciplinas puede gatearse con una env flag (`VITALOS_MULTI_SPECIALTY_SIGNUP`) para abrir el registro multi-especialidad solo cuando QA lo valide.

**Monitoreo:** log de `discipline` en altas; contar profesionales por disciplina; alertas si aparece `discipline` fuera del catálogo (no debería, por FK).

**Rollback por capa:**
- Frontend/Backend: revertir deploy (el fallback-a-dentistry hace que revertir sea seguro).
- DB: `059_down` (§7.2) solo si es imprescindible; normalmente **no se revierte la columna** (es inocua) aunque se reviertan las capas de app.

---

## 18. Roadmap por fases y tareas

> Ajuste respecto al roadmap del pedido: fusiono "modelo de datos + catálogo + migración" en una sola fase base, y separo el gating de frontend del de backend por nivel de riesgo.

### Fase 0 — Auditoría ✅ (este documento)
Completada: diagnóstico, inventario, dependencias, riesgos.

### Fase 1 — Base multi-especialidad (datos + contrato)
- F1.1 Migración `059` (catálogo + columna + índice + backfill). **Idempotente/reversible.**
- F1.2 `capabilities.ts` (catálogo + features + matriz + `hasCapability`) front y back.
- F1.3 `/me` y `/auth/startup` exponen `discipline` (verificar `select`).
- F1.4 Tests de migración (idempotencia, backfill, rollback) + unit de matriz.

### Fase 2 — Onboarding
- F2.1 `discipline` en `RegisterClinicSchema` + persistencia + validación catálogo.
- F2.2 Selector de especialidad en `register/page.tsx` (mobile-first).
- F2.3 Alta por owner/admin (`POST /professionals`) e invite con disciplina.
- F2.4 Pruebas de registro (dentista/psicólogo/kinesiólogo).

### Fase 3 — Feature gating
- F3.1 Guard backend `requireCapability` en endpoints de odontograma.
- F3.2 Ficha del paciente: gating del odontograma (render + realtime + mutaciones).
- F3.3 Navegación derivada de capacidades (con fallback).
- F3.4 Terminología/empty-states neutralizados o condicionados.

### Fase 4 — Configuración / cambio de especialidad
- F4.1 Sección "Mi especialidad profesional" en settings.
- F4.2 `PATCH /professionals/:id` con `discipline` + invalidación de cache (Redis + cliente).
- F4.3 Confirmación + auditoría (`audit_log`).
- F4.4 Refresco de capacidades en sesión.

### Fase 5 — QA y rollout
- F5.1 Regresión odontología (flujos críticos byte-equivalentes).
- F5.2 Aislamiento de datos (RLS) + bypass por URL/API.
- F5.3 Feature flag de registro multi-especialidad + activación progresiva + monitoreo.
- F5.4 Plan de rollback ensayado.

---

## 19. Estimación de complejidad por tarea

Escala: **S** (≤0.5 día), **M** (0.5–2 días), **L** (2–5 días). Asume 1 dev familiarizado con el repo.

| Tarea | Complejidad | Riesgo | Notas |
|---|:--:|:--:|---|
| F1.1 Migración 059 | S | Bajo | Aditiva; probar idempotencia/rollback |
| F1.2 capabilities.ts (x2) | S | Bajo | Mantener en sync (test) |
| F1.3 /me expone discipline | S | Bajo | Solo verificar `select('*')` |
| F1.4 Tests base | M | Bajo | Primeros tests del repo |
| F2.1 discipline en register backend | S | Medio | Validación server-side |
| F2.2 Selector en UI registro | M | Bajo | Mobile-first |
| F2.3 Alta owner/admin + invite | M | Medio | 2 flujos + decisión invite |
| F3.1 Guard backend odontograma | M | Medio | Definir lectura vs escritura (§15.3) |
| F3.2 Gating ficha paciente | **L** | **Medio-alto** | Archivo 2.4k líneas, sensible |
| F3.3 Nav por capacidades | S | Bajo | Sidebar mínimo |
| F3.4 Terminología | M | Bajo | Cosmético; solapa con rebrand |
| F4.1–F4.4 Cambio de especialidad | M | Medio | Cache multi-sesión + auditoría |
| F5.x QA/rollout | L | Medio | Sin tests previos; mayormente manual |

**Total orientativo:** ~2–3 semanas de un dev para MVP + gating + cambio de especialidad, sin plantillas clínicas por especialidad (fuera de alcance).

---

## 20. MVP multi-especialidad más pequeño

**El menor incremento que permite probar con profesionales reales no-odontólogos:**
1. Migración `059` (todos → `dentistry`).
2. `capabilities.ts` con **una sola regla real**: odontograma solo para `dentistry`.
3. Selector de disciplina en registro + persistencia validada.
4. Gating del odontograma en ficha (frontend) + guard backend.

Con eso, un psicólogo puede registrarse y usar agenda/pacientes/historia/finanzas **sin ver odontograma**, y los odontólogos no notan ningún cambio. Todo lo demás (settings de cambio, multi-especialidad, plantillas clínicas, stats clínicas específicas) es posterior.

---

## 21. Evaluación crítica final, decisiones y preguntas abiertas

**1. ¿Es la mejor forma de incorporar especialidades?** Sí para este producto: columna por profesional + matriz declarativa es lo más simple que cumple el requisito de centros mixtos, sin duplicar apps ni backends, y es reversible. Un sistema de plugins sería sobre-ingeniería hoy (el pedido lo desaconseja explícitamente).

**2. Supuestos del pedido que son incorrectos o peligrosos:**
- *"Reutilizar la nomenclatura specialty"*: **peligroso** — `professionals.specialty` ya existe con otro significado y uso público. Usar `discipline` (D2).
- *"Especialidad por organización"*: el pedido ya lo intuye; confirmado que debe ser **por profesional** (no hay entidad organización separada; el centro mixto lo exige).
- *"El psicólogo nunca ve un enlace al odontograma"*: correcto, pero hoy el odontograma **no es un enlace de menú** sino una sección de la ficha — el gating va ahí, no en el sidebar.

**3. Partes de la arquitectura que dificultan la evolución:**
- `PatientDetailClient.tsx` (2.4k líneas, odontograma incrustado) — el punto más delicado.
- Dos copias de la matriz (front/back) sin paquete compartido — riesgo de divergencia (mitigar con test o mini-paquete).
- Ausencia de tests — obliga a QA manual intensivo en la regresión odontológica.

**4. Refactorizaciones realmente necesarias:** mínimas. Solo (a) extraer la sección odontograma de la ficha a un componente gateado, y (b) derivar `NAV_ITEMS` de capacidades. No hace falta rediseñar historia clínica ni el modelo.

**5. Qué postergar:** multi-especialidad por profesional; plantillas clínicas por especialidad; stats clínicas específicas por disciplina; incluir disciplina en el JWT.

**6. Qué podría afectar a odontólogos (y cómo se evita):** render roto de la ficha (mitigado con default-a-mostrar), capacidades servidas de cache viejo (invalidación), o un `select` de `/me` que deje de traer `discipline` (test de contrato). La regla transversal: **ausencia/duda de disciplina ⇒ comportamiento DentalOS actual (`dentistry`)**.

**7. Alternativa más simple (menor tiempo/riesgo):** matriz con **una sola feature gateada** (odontograma), todo lo demás transversal. Es el MVP de §20 y ya es casi lo mínimo. Más simple aún sería gatear solo en frontend — **rechazado** por seguridad (bypass por API).

**8. MVP mínimo:** ver §20.

**9. Decisiones a tomar antes de programar:**
- D-a: ¿Columna `discipline` con **FK a tabla catálogo** (recomendado) o **CHECK**? (impacta migración).
- D-b: ¿Matriz de capacidades **compartida como paquete** o **archivo duplicado + test de sync**?
- D-c: En invites, ¿la disciplina la **fija quien invita** o la **elige el invitado**? (recomendado: la elige el invitado).
- D-d: ¿El selector de especialidad va en el **registro** (recomendado) o en un **onboarding posterior**?
- D-e: Política de **lectura histórica** tras cambiar de disciplina: gating solo a entrada/edición, lectura permitida por clínica (recomendado) — confirmar con negocio/legal.
- D-f: Confirmar la **matriz de capacidades** por especialidad con criterio clínico/comercial (hoy es casi plana; ¿kinesiología sin AFIP?, ¿nutrición sin consentimientos?, etc.).
- D-g: ¿La disciplina debe reflejarse en **stats clínicas** y en **plantillas de consentimiento** desde ya, o después?
- D-h (legal): validar requisitos argentinos de confidencialidad/retención para historias de salud mental u otras disciplinas antes de la Fase 2 de plantillas.

---

> **Siguiente paso sugerido:** resolver D-a…D-h (sobre todo la matriz D-f y la política de lectura D-e), y recién entonces ejecutar la Fase 1. No se implementa nada hasta aprobación explícita.
</content>
</invoke>
