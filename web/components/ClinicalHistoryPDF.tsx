'use client'

import { Document, Page, Text, View, StyleSheet, Font, Svg, Path, Rect, Circle, Defs, LinearGradient, Stop } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#00C4BC',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#00C4BC',
    letterSpacing: 0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  patientBox: {
    backgroundColor: '#f0fdfc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 18,
    flexDirection: 'row',
    gap: 30,
  },
  patientField: {
    flex: 1,
  },
  patientLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#00C4BC',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  patientValue: {
    fontSize: 10,
    color: '#1a1a2e',
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#00C4BC',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#b2f0ed',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    backgroundColor: '#e6faf9',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 9,
    color: '#1a1a2e',
  },
  chipAlert: {
    backgroundColor: '#fff1f0',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: '#ffb3b0',
  },
  chipAlertText: {
    fontSize: 9,
    color: '#cc2200',
  },
  noData: {
    fontSize: 9,
    color: '#aaa',
    fontStyle: 'italic',
  },
  detail: {
    fontSize: 9,
    color: '#444',
    marginTop: 2,
    marginBottom: 4,
  },
  summaryBox: {
    backgroundColor: '#f7f7f7',
    borderRadius: 5,
    padding: 8,
    marginTop: 4,
  },
  summaryText: {
    fontSize: 9.5,
    color: '#333',
    lineHeight: 1.5,
  },
  signaturesSection: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ebebeb',
  },
  signatureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C4BC',
    marginRight: 8,
  },
  signatureDate: {
    fontSize: 9,
    color: '#333',
    flex: 1,
  },
  signatureBadge: {
    fontSize: 8,
    color: '#00C4BC',
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#e6faf9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7.5,
    color: '#999',
  },
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface ClinicalHistoryPDFProps {
  patient: {
    first_name: string
    last_name: string
    date_of_birth?: string | null
    document_number?: string | null
    phone?: string | null
    email?: string | null
    allergies?: string | null
    current_medications?: string | null
    insurance_name?: string | null
    insurance_plan?: string | null
    insurance_number?: string | null
  }
  history: {
    alerts?: {
      aspirin?: boolean
      anticoagulants?: boolean
      pregnancy?: boolean
      cardiac?: boolean
      hypertension?: boolean
      seizures?: boolean
      infectious_disease?: { active?: boolean; detail?: string }
      diabetes?: { active?: boolean; controlled?: boolean }
    }
    medical_history?: {
      renal?: boolean
      hepatic?: boolean
      respiratory?: boolean
      neurological?: boolean
      transfusions?: boolean
      surgeries?: string
      sexually_transmitted?: boolean
      current_disease?: { active?: boolean; detail?: string }
      current_treatment?: { active?: boolean; detail?: string }
    }
    family_history?: {
      cardiac?: boolean
      diabetes?: boolean
      other?: string
    }
    habits?: {
      smoker?: boolean
      alcohol?: boolean
      oral_hygiene?: string
    }
    summary?: string
    risk_level?: string
  } | null
  signatures: Array<{
    id: string
    signed_at: string
    created_at: string
  }>
  clinicName?: string
  professionalName?: string
  generatedAt: string
}

export function ClinicalHistoryPDF({
  patient,
  history,
  signatures,
  clinicName,
  professionalName,
  generatedAt,
}: ClinicalHistoryPDFProps) {
  const h = history ?? {}
  const alerts = h.alerts ?? {}
  const med = h.medical_history ?? {}
  const fam = h.family_history ?? {}
  const hab = h.habits ?? {}

  const activeAlerts: string[] = []
  if (alerts.aspirin) activeAlerts.push('Aspirina')
  if (alerts.anticoagulants) activeAlerts.push('Anticoagulantes')
  if (alerts.pregnancy) activeAlerts.push('Embarazo')
  if (alerts.cardiac) activeAlerts.push('Cardíaco')
  if (alerts.hypertension) activeAlerts.push('Hipertensión')
  if (alerts.seizures) activeAlerts.push('Convulsiones')
  if (alerts.diabetes?.active) activeAlerts.push(`Diabetes${alerts.diabetes.controlled ? ' (controlada)' : ' (no controlada)'}`)
  if (alerts.infectious_disease?.active) activeAlerts.push(`Enfermedad infecciosa${alerts.infectious_disease.detail ? `: ${alerts.infectious_disease.detail}` : ''}`)

  const activeMedHistory: string[] = []
  if (med.renal) activeMedHistory.push('Renal')
  if (med.hepatic) activeMedHistory.push('Hepático')
  if (med.respiratory) activeMedHistory.push('Respiratorio')
  if (med.neurological) activeMedHistory.push('Neurológico')
  if (med.transfusions) activeMedHistory.push('Transfusiones')
  if (med.sexually_transmitted) activeMedHistory.push('ETS')

  const riskColors: Record<string, string> = {
    high: '#cc2200',
    medium: '#b86000',
    low: '#008060',
  }
  const riskLabels: Record<string, string> = {
    high: 'Alto riesgo',
    medium: 'Riesgo medio',
    low: 'Sin riesgo especial',
  }
  const riskLevel = h.risk_level ?? 'low'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* DentalOS logo (simplified tooth icon via SVG) */}
            <Svg width="28" height="28" viewBox="0 0 32 32">
              <Rect width="32" height="32" rx="7" fill="#1e1e1e" />
              <Path
                d="M10,8 C10,7 11,6 12.5,6 C13.5,6 14.5,6.8 16,6.8 C17.5,6.8 18.5,6 19.5,6 C21,6 22,7 22,8 C22,10 21.5,12 21,14 C20.5,16.5 20,19 19.5,21 C19.2,22.5 18.5,23 18,23 C17.5,23 17,22 16.8,21 C16.5,19.5 16,18 16,18 C16,18 15.5,19.5 15.2,21 C15,22 14.5,23 14,23 C13.5,23 12.8,22.5 12.5,21 C12,19 11.5,16.5 11,14 C10.5,12 10,10 10,8 Z"
                fill="#ffffff"
              />
              <Rect x="10" y="13" width="12" height="2" rx="1" fill="#4da8f0" />
              <Circle cx="23.5" cy="8.5" r="3" fill="#4da8f0" />
            </Svg>
            <Text style={styles.brandText}>DentalOS</Text>
            {clinicName && (
              <Text style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>— {clinicName}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>Historia Clínica</Text>
            <Text style={styles.headerSubtitle}>Generado el {formatDateTime(generatedAt)}</Text>
            {professionalName && (
              <Text style={styles.headerSubtitle}>Dr/a. {professionalName}</Text>
            )}
          </View>
        </View>

        {/* Patient info */}
        <View style={styles.patientBox}>
          <View style={styles.patientField}>
            <Text style={styles.patientLabel}>Paciente</Text>
            <Text style={[styles.patientValue, { fontFamily: 'Helvetica-Bold', fontSize: 12 }]}>
              {patient.first_name} {patient.last_name}
            </Text>
          </View>
          {patient.date_of_birth && (
            <View style={styles.patientField}>
              <Text style={styles.patientLabel}>Fecha de nacimiento</Text>
              <Text style={styles.patientValue}>{formatDate(patient.date_of_birth)}</Text>
            </View>
          )}
          {patient.document_number && (
            <View style={styles.patientField}>
              <Text style={styles.patientLabel}>DNI / Documento</Text>
              <Text style={styles.patientValue}>{patient.document_number}</Text>
            </View>
          )}
          <View style={styles.patientField}>
            <Text style={styles.patientLabel}>Riesgo</Text>
            <Text style={[styles.patientValue, { color: riskColors[riskLevel], fontFamily: 'Helvetica-Bold' }]}>
              {riskLabels[riskLevel] ?? 'Sin datos'}
            </Text>
          </View>
        </View>

        {/* Alertas clínicas */}
        <Text style={styles.sectionTitle}>⚠ Alertas clínicas</Text>
        {activeAlerts.length > 0 ? (
          <View style={styles.grid}>
            {activeAlerts.map((a) => (
              <View key={a} style={styles.chipAlert}>
                <Text style={styles.chipAlertText}>{a}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noData}>Sin alertas registradas</Text>
        )}

        {/* Alergias y medicación del perfil */}
        {(patient.allergies || patient.current_medications) && (
          <>
            <Text style={styles.sectionTitle}>Alergias y medicación</Text>
            {patient.allergies && (
              <>
                <Text style={[styles.patientLabel, { marginBottom: 2 }]}>Alergias</Text>
                <Text style={styles.detail}>{patient.allergies}</Text>
              </>
            )}
            {patient.current_medications && (
              <>
                <Text style={[styles.patientLabel, { marginBottom: 2, marginTop: 4 }]}>Medicación actual</Text>
                <Text style={styles.detail}>{patient.current_medications}</Text>
              </>
            )}
          </>
        )}

        {/* Antecedentes médicos */}
        <Text style={styles.sectionTitle}>Antecedentes médicos</Text>
        {activeMedHistory.length > 0 ? (
          <View style={styles.grid}>
            {activeMedHistory.map((m) => (
              <View key={m} style={styles.chip}>
                <Text style={styles.chipText}>{m}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noData}>Sin antecedentes registrados</Text>
        )}
        {med.surgeries && (
          <>
            <Text style={[styles.patientLabel, { marginTop: 5, marginBottom: 2 }]}>Cirugías</Text>
            <Text style={styles.detail}>{med.surgeries}</Text>
          </>
        )}
        {med.current_disease?.active && (
          <Text style={styles.detail}>Enfermedad actual: {med.current_disease.detail || 'Sí'}</Text>
        )}
        {med.current_treatment?.active && (
          <Text style={styles.detail}>Tratamiento actual: {med.current_treatment.detail || 'Sí'}</Text>
        )}

        {/* Historia familiar */}
        <Text style={styles.sectionTitle}>Historia familiar</Text>
        {fam.cardiac || fam.diabetes || fam.other ? (
          <View style={styles.grid}>
            {fam.cardiac && <View style={styles.chip}><Text style={styles.chipText}>Cardíaco</Text></View>}
            {fam.diabetes && <View style={styles.chip}><Text style={styles.chipText}>Diabetes</Text></View>}
            {fam.other && <View style={styles.chip}><Text style={styles.chipText}>{fam.other}</Text></View>}
          </View>
        ) : (
          <Text style={styles.noData}>Sin antecedentes familiares registrados</Text>
        )}

        {/* Hábitos */}
        <Text style={styles.sectionTitle}>Hábitos</Text>
        <View style={styles.grid}>
          {hab.smoker && <View style={styles.chip}><Text style={styles.chipText}>Fumador</Text></View>}
          {hab.alcohol && <View style={styles.chip}><Text style={styles.chipText}>Alcohol</Text></View>}
          {hab.oral_hygiene && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                Higiene bucal: {hab.oral_hygiene === 'buena' ? 'Buena' : hab.oral_hygiene === 'regular' ? 'Regular' : 'Mala'}
              </Text>
            </View>
          )}
          {!hab.smoker && !hab.alcohol && !hab.oral_hygiene && (
            <Text style={styles.noData}>Sin hábitos registrados</Text>
          )}
        </View>

        {/* Resumen / notas */}
        {h.summary && (
          <>
            <Text style={styles.sectionTitle}>Notas / Resumen</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{h.summary}</Text>
            </View>
          </>
        )}

        {/* Seguro médico */}
        {(patient.insurance_name || patient.insurance_plan || patient.insurance_number) && (
          <>
            <Text style={styles.sectionTitle}>Obra social / Seguro</Text>
            <View style={styles.grid}>
              {patient.insurance_name && (
                <View style={styles.chip}><Text style={styles.chipText}>{patient.insurance_name}</Text></View>
              )}
              {patient.insurance_plan && (
                <View style={styles.chip}><Text style={styles.chipText}>Plan: {patient.insurance_plan}</Text></View>
              )}
              {patient.insurance_number && (
                <View style={styles.chip}><Text style={styles.chipText}>N°: {patient.insurance_number}</Text></View>
              )}
            </View>
          </>
        )}

        {/* Firmas */}
        {signatures.length > 0 && (
          <View style={styles.signaturesSection}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>
              Firmas del paciente ({signatures.length})
            </Text>
            {signatures.map((sig, i) => (
              <View key={sig.id} style={styles.signatureRow}>
                <View style={styles.signatureDot} />
                <Text style={styles.signatureDate}>
                  Firma #{i + 1} — {formatDateTime(sig.signed_at ?? sig.created_at)}
                </Text>
                <Text style={styles.signatureBadge}>✓ Firmada</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>DentalOS — Historia Clínica Confidencial</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
