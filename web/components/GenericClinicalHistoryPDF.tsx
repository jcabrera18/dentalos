'use client'

// PDF de historia clínica por especialidad (VitalOS Fase D). Render declarativo:
// recorre las secciones de CLINICAL_SECTIONS + vitales + evolución. Odontología
// usa su propio PDF (ClinicalHistoryPDF); este cubre el resto de disciplinas.

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  clinicalSectionsFor,
  clinicalTemplateFor,
  DISCIPLINE_LABELS,
  type ClinicalField,
  type Discipline,
  type VitalField,
} from '@/lib/capabilities'

import type { Vitals } from '@/components/VitalsInput'
import type { ClinicalEncounter } from '@/lib/clinicalEncounters'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, backgroundColor: '#fff', paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, color: '#1a1a2e' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: '#00C4BC' },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#00C4BC', letterSpacing: 0.5 },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  headerSub: { fontSize: 9, color: '#666', marginTop: 2 },
  patientBox: { backgroundColor: '#f0fdfc', borderRadius: 6, padding: 10, marginBottom: 14, flexDirection: 'row', gap: 24, flexWrap: 'wrap' },
  pField: { minWidth: 120 },
  pLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#00C4BC', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  pValue: { fontSize: 10 },
  riskBadge: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, marginTop: 4 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  row: { flexDirection: 'row', marginBottom: 2.5 },
  rowLabel: { fontSize: 9, color: '#666', width: 150 },
  rowValue: { fontSize: 9, flex: 1 },
  empty: { fontSize: 9, color: '#999' },
  encItem: { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  encHead: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#eee', paddingTop: 6 },
})

const VITAL_META: Record<Exclude<VitalField, 'bp'>, { key: keyof Vitals; label: string; unit: string }> = {
  weight: { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  height: { key: 'height_cm', label: 'Talla', unit: 'cm' },
  bmi: { key: 'bmi', label: 'IMC', unit: 'kg/m²' },
  heart_rate: { key: 'heart_rate', label: 'FC', unit: 'lpm' },
  resp_rate: { key: 'resp_rate', label: 'FR', unit: 'rpm' },
  temperature: { key: 'temperature_c', label: 'Temp.', unit: '°C' },
  spo2: { key: 'spo2', label: 'SatO₂', unit: '%' },
  waist: { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  hip: { key: 'hip_cm', label: 'Cadera', unit: 'cm' },
  body_fat: { key: 'body_fat_pct', label: 'Grasa', unit: '%' },
  muscle_mass: { key: 'muscle_mass_kg', label: 'Masa musc.', unit: 'kg' },
}

function vitalsToPairs(fields: readonly VitalField[], v: Vitals | null | undefined): string[] {
  const out: string[] = []
  const val = v ?? {}
  for (const f of fields) {
    if (f === 'bp') {
      if (val.systolic_bp != null || val.diastolic_bp != null) out.push(`TA ${val.systolic_bp ?? '—'}/${val.diastolic_bp ?? '—'} mmHg`)
      continue
    }
    const m = VITAL_META[f]
    const x = m ? val[m.key] : null
    if (m && x != null) out.push(`${m.label} ${x} ${m.unit}`)
  }
  return out
}

function fmtField(field: ClinicalField, value: unknown): string | null {
  if (value === undefined || value === null || value === '' || value === false) return null
  if (field.type === 'bool') return 'Sí'
  if (field.type === 'select') return field.options?.find((o) => o.value === value)?.label ?? String(value)
  return String(value)
}

const fmtDate = (d: string) => {
  const dt = new Date(d + 'T00:00:00')
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export interface GenericClinicalHistoryPDFProps {
  patient: { first_name: string; last_name: string; document_number?: string | null; date_of_birth?: string | null }
  discipline: Discipline
  sections: Record<string, Record<string, unknown>>
  vitals: Vitals | null
  summary?: string | null
  riskLevel?: string | null
  encounters?: ClinicalEncounter[]
  professionalName?: string
  generatedAt: string
}

export function GenericClinicalHistoryPDF({
  patient, discipline, sections, vitals, summary, riskLevel, encounters = [], professionalName, generatedAt,
}: GenericClinicalHistoryPDFProps) {
  const template = clinicalTemplateFor(discipline)
  const sectionDefs = clinicalSectionsFor(discipline)
  const baseVitalPairs = template.vitals.length ? vitalsToPairs(template.vitals, vitals) : []

  const riskColor = riskLevel === 'high' ? '#cc2200' : riskLevel === 'medium' ? '#b86000' : '#008060'
  const riskLabel = riskLevel === 'high' ? 'Alto riesgo' : riskLevel === 'medium' ? 'Riesgo medio' : 'Sin riesgo especial'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>VitalOS</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Historia clínica</Text>
            <Text style={styles.headerSub}>{DISCIPLINE_LABELS[discipline]}</Text>
          </View>
        </View>

        <View style={styles.patientBox}>
          <View style={styles.pField}>
            <Text style={styles.pLabel}>Paciente</Text>
            <Text style={styles.pValue}>{patient.first_name} {patient.last_name}</Text>
          </View>
          {patient.document_number && (
            <View style={styles.pField}><Text style={styles.pLabel}>Documento</Text><Text style={styles.pValue}>{patient.document_number}</Text></View>
          )}
          {patient.date_of_birth && (
            <View style={styles.pField}><Text style={styles.pLabel}>Nacimiento</Text><Text style={styles.pValue}>{fmtDate(patient.date_of_birth)}</Text></View>
          )}
          <View style={styles.pField}>
            <Text style={styles.pLabel}>Riesgo</Text>
            <Text style={{ ...styles.riskBadge, color: riskColor }}>{riskLabel}</Text>
          </View>
        </View>

        {baseVitalPairs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signos vitales</Text>
            <Text style={styles.rowValue}>{baseVitalPairs.join('  ·  ')}</Text>
          </View>
        )}

        {sectionDefs.map((section) => {
          const vals = sections?.[section.id] ?? {}
          const rows = section.fields
            .map((f) => ({ label: f.label, text: fmtField(f, vals[f.key]) }))
            .filter((r) => r.text !== null)
          return (
            <View key={section.id} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {rows.length === 0 ? (
                <Text style={styles.empty}>Sin datos</Text>
              ) : rows.map((r, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowValue}>{r.text}</Text>
                </View>
              ))}
            </View>
          )
        })}

        {summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumen clínico</Text>
            <Text style={styles.rowValue}>{summary}</Text>
          </View>
        ) : null}

        {encounters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Evoluciones ({encounters.length})</Text>
            {encounters.map((e) => {
              const config = clinicalTemplateFor(e.discipline).encounters
              const contentFields = config.enabled ? config.contentFields : []
              const perVitals = config.enabled ? config.vitalsPerEncounter : []
              const vp = vitalsToPairs(perVitals, e.vitals)
              const cp = contentFields
                .map((f) => ({ label: f.label, text: fmtField(f, (e.content ?? {})[f.key]) }))
                .filter((r) => r.text !== null)
              return (
                <View key={e.id} style={styles.encItem} wrap={false}>
                  <Text style={styles.encHead}>{fmtDate(e.encounter_date)} · {DISCIPLINE_LABELS[e.discipline]}{e.risk_flag ? '  ⚠ alarma' : ''}{e.signed ? '  ✓ firmado' : ''}</Text>
                  {vp.length > 0 && <Text style={styles.rowValue}>{vp.join('  ·  ')}</Text>}
                  {cp.map((r, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.rowLabel}>{r.label}</Text>
                      <Text style={styles.rowValue}>{r.text}</Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generado por VitalOS{professionalName ? ` · ${professionalName}` : ''} · {new Date(generatedAt).toLocaleString('es-AR')}
        </Text>
      </Page>
    </Document>
  )
}
