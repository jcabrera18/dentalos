import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as pdfRenderer from '@react-pdf/renderer'
import { loadTs } from './load-ts.mjs'

const { ClinicalHistoryReadout } = loadTs('components/clinical/ClinicalHistoryReadout.tsx')
const { EncounterReadout } = loadTs('components/clinical/EncounterReadout.tsx')
const { clinicalTemplateFor } = loadTs('lib/capabilities.ts')
const { VitalsInput, VitalsDisplay } = loadTs('components/VitalsInput.tsx')
const { todayArgDate } = loadTs('lib/dates.ts')
const { GenericClinicalHistoryPDF } = loadTs('components/GenericClinicalHistoryPDF.tsx', { '@react-pdf/renderer': pdfRenderer })

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return [tree]
  return [tree, ...nodes(tree.props?.children)]
}

const encounters = [
  { id: 'prenatal', discipline: 'obstetrics', encounter_type: 'prenatal_control', encounter_date: '2026-10-20', content: { ecografia: 'Ecografía de prueba', lcf: 140 }, vitals: { systolic_bp: 120, diastolic_bp: 80 }, signed: true, risk_flag: false },
  { id: 'nutrition', discipline: 'nutrition', encounter_type: 'nutrition_control', encounter_date: '2026-10-19', content: { ajustes: 'Ajuste alimentario de prueba' }, vitals: { weight_kg: 70, height_cm: 175, bmi: 22.9 }, signed: false, risk_flag: false },
]

test('la firma dental antigua conserva alertas, antecedentes, hábitos y resumen', () => {
  const html = renderToStaticMarkup(createElement(ClinicalHistoryReadout, { snap: {
    alerts: { anticoagulants: true, diabetes: { active: true, controlled: true }, infectious_disease: { active: true, detail: 'Detalle de prueba' } },
    medical_history: { surgeries: 'Cirugía de prueba', current_treatment: { active: true, detail: 'Medicación de prueba' } },
    family_history: { other: 'Antecedente familiar de prueba' },
    habits: { smoker: true, oral_hygiene: 'regular' }, summary: 'Resumen de prueba',
  } }))
  for (const text of ['Anticoagulantes', 'controlada', 'Detalle de prueba', 'Cirugía de prueba', 'Medicación de prueba', 'Antecedente familiar de prueba', 'Fumador', 'regular', 'Resumen de prueba']) assert(html.includes(text), text)
  assert(!html.includes('Sin datos registrados'))
})

test('la firma genérica usa su disciplina persistida, sin depender de la vista dental', () => {
  const html = renderToStaticMarkup(createElement(ClinicalHistoryReadout, { snap: {
    discipline: 'nutrition', vitals: { weight_kg: 70, height_cm: 175 }, summary: 'Plan firmado de prueba',
  } }))
  assert(html.includes('Nutrición'))
  assert(html.includes('22.9 kg/m²'))
  assert(html.includes('Plan firmado de prueba'))
  assert(!html.includes('Sin alertas'))
})

test('una clínica mixta muestra el contenido propio de cada evolución', () => {
  const prenatal = renderToStaticMarkup(createElement(EncounterReadout, { encounter: encounters[0] }))
  const nutrition = renderToStaticMarkup(createElement(EncounterReadout, { encounter: encounters[1] }))
  assert(prenatal.includes('Ecografía de prueba'))
  assert(prenatal.includes('140'))
  assert(prenatal.includes('120/80 mmHg'))
  assert(nutrition.includes('Ajuste alimentario de prueba'))
  assert(nutrition.includes('22.9 kg/m²'))
})

test('el PDF conserva evoluciones de otras disciplinas y se genera correctamente', async () => {
  const props = { patient: { first_name: 'Paciente', last_name: 'Prueba' }, discipline: 'nutrition', sections: {}, vitals: {}, encounters, generatedAt: '2026-10-20T12:00:00Z' }
  const text = nodes(GenericClinicalHistoryPDF(props)).filter(node => typeof node === 'string').join(' ')
  assert(text.includes('Ecografía de prueba'))
  assert(text.includes('Ajuste alimentario de prueba'))
  assert(text.includes('Obstetricia'))
  assert(text.includes('Nutrición'))
  const buffer = await pdfRenderer.renderToBuffer(createElement(GenericClinicalHistoryPDF, props))
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF')
})

for (const discipline of ['nutrition', 'general_medicine']) {
  test(`un control nuevo de ${discipline} permite registrar talla y persiste su IMC`, () => {
    const fields = clinicalTemplateFor(discipline).encounters.vitalsPerEncounter
    let value = {}
    function change(label, input) {
      const tree = VitalsInput({ fields, value, onChange: next => { value = next } })
      const field = nodes(tree).find(node => node?.props?.label === label)
      assert(field, `Falta el campo ${label}`)
      const numberInput = nodes(field).find(node => node?.type === 'input')
      numberInput.props.onChange({ target: { value: input } })
    }
    change('Peso', '70')
    change('Talla', '175')
    assert.equal(value.bmi, 22.9)
    assert.equal(value.height_cm, 175)
    assert(renderToStaticMarkup(createElement(VitalsDisplay, { fields, value })).includes('22.9 kg/m²'))
    change('Talla', '')
    assert.equal(value.bmi, null)
  })
}

test('la fecha clínica respeta la medianoche argentina, incluido el cambio de año', () => {
  assert.equal(todayArgDate(new Date('2026-10-20T22:30:00-03:00')), '2026-10-20')
  assert.equal(todayArgDate(new Date('2026-12-31T23:59:59-03:00')), '2026-12-31')
  assert.equal(todayArgDate(new Date('2027-01-01T00:00:00-03:00')), '2027-01-01')
})
