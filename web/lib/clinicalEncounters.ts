import type { Discipline } from './capabilities'
import type { Vitals } from '@/components/VitalsInput'

export interface ClinicalEncounter {
  id: string
  discipline: Discipline
  encounter_date: string
  encounter_type: string | null
  risk_flag: boolean
  vitals: Vitals | null
  content: Record<string, unknown> | null
  signed: boolean
  signed_at: string | null
}
