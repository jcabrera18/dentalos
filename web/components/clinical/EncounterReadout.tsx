'use client'

import { clinicalTemplateFor } from '@/lib/capabilities'
import type { ClinicalEncounter } from '@/lib/clinicalEncounters'
import { VitalsDisplay } from '@/components/VitalsInput'
import { FieldsReadout } from './ClinicalFields'

export function EncounterVitals({ encounter }: { encounter: ClinicalEncounter }) {
  const config = clinicalTemplateFor(encounter.discipline).encounters
  return config.enabled ? <VitalsDisplay fields={config.vitalsPerEncounter} value={encounter.vitals ?? {}} /> : null
}

export function EncounterReadout({ encounter }: { encounter: ClinicalEncounter }) {
  const config = clinicalTemplateFor(encounter.discipline).encounters
  if (!config.enabled) return null

  return (
    <>
      {config.vitalsPerEncounter.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-app3 mb-1.5">Signos vitales</div>
          <EncounterVitals encounter={encounter} />
        </div>
      )}
      {config.contentFields.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-app3 mb-1.5">Nota</div>
          <FieldsReadout fields={config.contentFields} values={encounter.content ?? {}} />
        </div>
      )}
    </>
  )
}
