-- ============================================================
-- DentalOS · Migration 007 · Seed Data
-- Default templates + demo clinic (dev only)
-- ============================================================

-- ──────────────────────────────────────────
-- DEFAULT CONSENT TEMPLATES
-- Inserted as clinic_id = NULL (global templates)
-- Each clinic can copy and customize
-- ──────────────────────────────────────────

-- NOTE: In a real multi-tenant setup, global templates have clinic_id = NULL
-- and RLS is adapted. For simplicity in MVP, each clinic gets copies on signup.

-- We store them in a separate table for global templates:
CREATE TABLE global_consent_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  specialty       TEXT,
  content_html    TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'es',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO global_consent_templates (name, specialty, content_html) VALUES
(
  'Extracción dental simple',
  'Cirugía',
  '<h2>Consentimiento Informado para Extracción Dental</h2>
  <p>Yo, <strong>{{patient_name}}</strong>, DNI {{patient_document}}, autorizo al profesional <strong>{{professional_name}}</strong> a realizar la extracción del/los diente/s indicado/s.</p>
  <h3>Riesgos informados:</h3>
  <ul>
    <li>Dolor e inflamación postoperatoria</li>
    <li>Sangrado</li>
    <li>Alveolitis seca (complicación poco frecuente)</li>
    <li>Parestesia transitoria (muy poco frecuente)</li>
  </ul>
  <h3>Cuidados postoperatorios:</h3>
  <ul>
    <li>Morder la gasa durante 30 minutos</li>
    <li>No enjuagarse las primeras 24 horas</li>
    <li>Dieta blanda y fría las primeras horas</li>
    <li>Tomar la medicación indicada</li>
  </ul>
  <p>Declaro haber recibido explicación del procedimiento y sus alternativas, y que mis preguntas fueron respondidas satisfactoriamente.</p>'
),
(
  'Tratamiento de conducto (Endodoncia)',
  'Endodoncia',
  '<h2>Consentimiento Informado — Tratamiento Endodóntico</h2>
  <p>Yo, <strong>{{patient_name}}</strong>, DNI {{patient_document}}, autorizo al profesional <strong>{{professional_name}}</strong> a realizar el tratamiento de conducto (endodoncia) en la/s pieza/s dental/es indicada/s.</p>
  <h3>Descripción del procedimiento:</h3>
  <p>El tratamiento de conducto consiste en la eliminación del tejido pulpar (nervio) del interior del diente, limpieza y conformación de los conductos radiculares, y su posterior obturación con materiales biocompatibles.</p>
  <h3>Riesgos informados:</h3>
  <ul>
    <li>Dolor post-operatorio (controlable con medicación)</li>
    <li>Fractura del instrumento en conducto (muy poco frecuente)</li>
    <li>Perforación radicular (muy poco frecuente)</li>
    <li>Posible necesidad de retreatamiento</li>
    <li>Fractura del diente tratado a largo plazo (se recomienda coronar)</li>
  </ul>
  <p>Comprendo que el éxito del tratamiento depende también del cumplimiento de los controles y de la colocación oportuna de la restauración definitiva.</p>'
),
(
  'Implante oseointegrado',
  'Implantología',
  '<h2>Consentimiento Informado — Implante Dental</h2>
  <p>Yo, <strong>{{patient_name}}</strong>, DNI {{patient_document}}, autorizo al profesional <strong>{{professional_name}}</strong> a la colocación de implante/s oseointegrado/s.</p>
  <h3>El procedimiento incluye:</h3>
  <ul>
    <li>Cirugía de colocación del implante</li>
    <li>Período de osteointegración (3-6 meses)</li>
    <li>Colocación del pilar y la corona</li>
  </ul>
  <h3>Factores de riesgo y contraindicaciones relativas:</h3>
  <ul>
    <li>Tabaquismo (disminuye la tasa de éxito)</li>
    <li>Diabetes no controlada</li>
    <li>Osteoporosis severa</li>
    <li>Medicación con bifosfonatos (informar al profesional)</li>
  </ul>
  <h3>Posibles complicaciones:</h3>
  <ul>
    <li>Fracaso de la osteointegración</li>
    <li>Periimplantitis (infección alrededor del implante)</li>
    <li>Parestesia (muy poco frecuente)</li>
  </ul>'
),
(
  'Blanqueamiento dental',
  'Estética',
  '<h2>Consentimiento Informado — Blanqueamiento Dental</h2>
  <p>Yo, <strong>{{patient_name}}</strong>, DNI {{patient_document}}, autorizo al profesional <strong>{{professional_name}}</strong> a realizar el tratamiento de blanqueamiento dental.</p>
  <h3>Efectos esperados y limitaciones:</h3>
  <ul>
    <li>Los resultados varían según el tipo y origen de la pigmentación</li>
    <li>Las restauraciones existentes (coronas, carillas, obturaciones) no blanquean</li>
    <li>El resultado no es permanente: depende de hábitos alimentarios</li>
  </ul>
  <h3>Efectos adversos posibles:</h3>
  <ul>
    <li>Sensibilidad dental transitoria (muy frecuente, cede en 24-48hs)</li>
    <li>Irritación gingival leve</li>
    <li>No se recomienda durante el embarazo o lactancia</li>
  </ul>'
);

-- ──────────────────────────────────────────
-- FUNCTION: onboard new clinic
-- Called after signup to set up default data
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION onboard_clinic(
  p_clinic_id     UUID,
  p_professional_id UUID
) RETURNS VOID AS $$
DECLARE
  v_template RECORD;
BEGIN
  -- Copy global consent templates to clinic
  FOR v_template IN SELECT * FROM global_consent_templates LOOP
    INSERT INTO consent_templates (clinic_id, name, content_html)
    VALUES (p_clinic_id, v_template.name, v_template.content_html);
  END LOOP;

  -- Initialize odontogram for demo (empty — populated as patient is examined)
  -- Nothing to do here; rows created on first examination

  RAISE NOTICE 'Clinic % onboarded successfully', p_clinic_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
