// src/types/database.ts
// These types mirror the Supabase schema.
// In production, generate automatically with:
//   npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row:    Clinic
        Insert: ClinicInsert
        Update: Partial<ClinicInsert>
      }
      professionals: {
        Row:    Professional
        Insert: ProfessionalInsert
        Update: Partial<ProfessionalInsert>
      }
      patients: {
        Row:    Patient
        Insert: PatientInsert
        Update: Partial<PatientInsert>
      }
      appointments: {
        Row:    Appointment
        Insert: AppointmentInsert
        Update: Partial<AppointmentInsert>
      }
      treatments: {
        Row:    Treatment
        Insert: TreatmentInsert
        Update: Partial<TreatmentInsert>
      }
      treatment_sessions: {
        Row:    TreatmentSession
        Insert: TreatmentSessionInsert
        Update: Partial<TreatmentSessionInsert>
      }
      payments: {
        Row:    Payment
        Insert: PaymentInsert
        Update: Partial<PaymentInsert>
      }
      quotes: {
        Row:    Quote
        Insert: QuoteInsert
        Update: Partial<QuoteInsert>
      }
      odontogram: {
        Row:    OdontogramEntry
        Insert: OdontogramEntryInsert
        Update: Partial<OdontogramEntryInsert>
      }
      notifications: {
        Row:    Notification
        Insert: NotificationInsert
        Update: Partial<NotificationInsert>
      }
      consents: {
        Row:    Consent
        Insert: ConsentInsert
        Update: Partial<ConsentInsert>
      }
    }
    Views: {
      v_daily_agenda:   { Row: DailyAgendaRow }
      v_patient_balance:{ Row: PatientBalanceRow }
      v_daily_cash:     { Row: DailyCashRow }
    }
    Functions: {
      search_patients: {
        Args: { p_clinic_id: string; p_query: string; p_limit?: number; p_offset?: number }
        Returns: PatientSearchResult[]
      }
      check_professional_availability: {
        Args: { p_professional_id: string; p_starts_at: string; p_ends_at: string; p_exclude_id?: string }
        Returns: boolean
      }
      onboard_clinic: {
        Args: { p_clinic_id: string; p_professional_id: string }
        Returns: void
      }
    }
    Enums: {
      user_role:           'owner' | 'admin' | 'professional' | 'receptionist'
      plan_type:           'free' | 'basic' | 'pro' | 'clinic' | 'enterprise'
      appointment_status:  'pending' | 'confirmed' | 'in_progress' | 'completed' | 'absent' | 'cancelled'
      treatment_status:    'quoted' | 'accepted' | 'in_progress' | 'completed' | 'abandoned'
      payment_method:      'cash' | 'bank_transfer' | 'debit_card' | 'credit_card' | 'insurance' | 'qr' | 'other'
      payment_status:      'pending' | 'completed' | 'refunded' | 'failed'
      quote_status:        'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
      tooth_condition:     'healthy' | 'cavity' | 'filled' | 'root_canal' | 'crown' | 'missing' | 'implant' | 'bridge_abutment' | 'extraction_needed' | 'fracture' | 'other'
      notification_channel:'whatsapp' | 'sms' | 'email' | 'push'
      notification_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'cancelled'
      notification_type:   'appointment_reminder_24h' | 'appointment_reminder_2h' | 'appointment_confirmation' | 'appointment_cancelled' | 'payment_receipt' | 'quote_sent' | 'inactive_patient' | 'custom'
      consent_status:      'pending' | 'signed' | 'declined'
    }
  }
}

// ── Entity types ──────────────────────────────

export interface Clinic {
  id:               string
  name:             string
  slug:             string
  address:          string | null
  city:             string | null
  country:          string
  phone:            string | null
  email:            string | null
  timezone:         string
  currency:         string
  logo_url:         string | null
  plan:             Database['public']['Enums']['plan_type']
  sub_status:       Database['public']['Enums']['subscription_status']
  trial_ends_at:    string | null
  sub_ends_at:      string | null
  stripe_customer_id: string | null
  settings:         ClinicSettings
  created_at:       string
  updated_at:       string
  deleted_at:       string | null
}

export interface ClinicSettings {
  appointment_duration_default: number
  working_hours: Record<string, { start: string; end: string } | null>
  reminder_hours_before: number[]
  whatsapp_enabled: boolean
  sms_enabled: boolean
}

export type ClinicInsert = Omit<Clinic, 'id' | 'created_at' | 'updated_at'>

export interface Professional {
  id:                       string
  clinic_id:                string
  auth_user_id:             string | null
  first_name:               string
  last_name:                string
  email:                    string | null
  phone:                    string | null
  avatar_url:               string | null
  role:                     Database['public']['Enums']['user_role']
  specialty:                string | null
  license_number:           string | null
  schedule_config:          Record<string, unknown> | null
  default_duration_minutes: number
  color:                    string
  is_active:                boolean
  created_at:               string
  updated_at:               string
}

export type ProfessionalInsert = Omit<Professional, 'id' | 'created_at' | 'updated_at'>

export interface Patient {
  id:                  string
  clinic_id:           string
  first_name:          string
  last_name:           string
  document_type:       string
  document_number:     string | null
  date_of_birth:       string | null
  gender:              string | null
  phone:               string
  phone_alt:           string | null
  email:               string | null
  address:             string | null
  city:                string | null
  insurance_name:      string | null
  insurance_plan:      string | null
  insurance_number:    string | null
  allergies:           string | null
  current_medications: string | null
  medical_notes:       string | null
  blood_type:          string | null
  referral_source:     string | null
  is_active:           boolean
  last_appointment_at: string | null
  created_by:          string | null
  created_at:          string
  updated_at:          string
  deleted_at:          string | null
}

export type PatientInsert = Omit<Patient, 'id' | 'created_at' | 'updated_at'>

export interface Appointment {
  id:                   string
  clinic_id:            string
  patient_id:           string
  professional_id:      string
  starts_at:            string
  ends_at:              string
  duration_minutes:     number
  status:               Database['public']['Enums']['appointment_status']
  cancelled_reason:     string | null
  cancelled_at:         string | null
  cancelled_by:         string | null
  appointment_type:     string | null
  chief_complaint:      string | null
  clinical_notes:       string | null
  internal_notes:       string | null
  treatment_id:         string | null
  treatment_session:    number | null
  reminder_sent_24h:    boolean
  reminder_sent_2h:     boolean
  reminder_sent_at:     string | null
  confirmed_at:         string | null
  confirmation_channel: string | null
  created_by:           string | null
  created_at:           string
  updated_at:           string
}

export type AppointmentInsert = Omit<Appointment, 'id' | 'duration_minutes' | 'created_at' | 'updated_at'>

export interface Treatment {
  id:                 string
  clinic_id:          string
  patient_id:         string
  professional_id:    string
  name:               string
  description:        string | null
  status:             Database['public']['Enums']['treatment_status']
  tooth_numbers:      number[]
  tooth_surfaces:     Record<string, string[]> | null
  sessions_planned:   number | null
  sessions_done:      number
  started_at:         string | null
  estimated_end_date: string | null
  completed_at:       string | null
  abandoned_at:       string | null
  abandon_reason:     string | null
  quote_id:           string | null
  total_quoted:       number | null
  total_paid:         number
  created_by:         string | null
  created_at:         string
  updated_at:         string
}

export type TreatmentInsert = Omit<Treatment, 'id' | 'created_at' | 'updated_at'>

export interface TreatmentSession {
  id:             string
  clinic_id:      string
  treatment_id:   string
  appointment_id: string | null
  session_number: number
  performed_at:   string
  notes:          string | null
  next_steps:     string | null
  created_at:     string
}

export type TreatmentSessionInsert = Omit<TreatmentSession, 'id' | 'created_at'>

export interface Payment {
  id:                  string
  clinic_id:           string
  patient_id:          string
  professional_id:     string
  appointment_id:      string | null
  quote_id:            string | null
  treatment_id:        string | null
  amount:              number
  currency:            string
  method:              Database['public']['Enums']['payment_method']
  status:              Database['public']['Enums']['payment_status']
  installments:        number
  installment_amount:  number | null
  reference_number:    string | null
  receipt_number:      string | null
  insurance_coverage:  number | null
  patient_copay:       number | null
  notes:               string | null
  paid_at:             string
  refunded_at:         string | null
  refund_reason:       string | null
  original_payment_id: string | null
  created_by:          string | null
  created_at:          string
  updated_at:          string
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at'>

export interface Quote {
  id:                 string
  clinic_id:          string
  patient_id:         string
  professional_id:    string
  status:             Database['public']['Enums']['quote_status']
  quote_number:       string | null
  items:              QuoteItem[]
  subtotal:           number
  discount_amount:    number
  total:              number
  installments:       number
  installment_amount: number | null
  notes:              string | null
  valid_until:        string | null
  sent_at:            string | null
  accepted_at:        string | null
  rejected_at:        string | null
  treatment_id:       string | null
  created_by:         string | null
  created_at:         string
  updated_at:         string
}

export interface QuoteItem {
  description:  string
  quantity:     number
  unit_price:   number
  discount_pct: number
  subtotal:     number
}

export type QuoteInsert = Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'>

export interface OdontogramEntry {
  id:           string
  clinic_id:    string
  patient_id:   string
  tooth_number: number
  condition:    Database['public']['Enums']['tooth_condition']
  surfaces:     string[] | null
  notes:        string | null
  treatment_id: string | null
  recorded_by:  string | null
  recorded_at:  string
  updated_at:   string
}

export type OdontogramEntryInsert = Omit<OdontogramEntry, 'id'>

export interface Notification {
  id:              string
  clinic_id:       string
  patient_id:      string | null
  appointment_id:  string | null
  type:            Database['public']['Enums']['notification_type']
  channel:         Database['public']['Enums']['notification_channel']
  status:          Database['public']['Enums']['notification_status']
  to_phone:        string | null
  to_email:        string | null
  template_key:    string | null
  template_vars:   Record<string, string>
  rendered_body:   string | null
  scheduled_for:   string
  sent_at:         string | null
  delivered_at:    string | null
  failed_at:       string | null
  failure_reason:  string | null
  retry_count:     number
  max_retries:     number
  provider:        string | null
  provider_msg_id: string | null
  created_at:      string
}

export type NotificationInsert = Omit<Notification, 'id' | 'created_at'>

export interface Consent {
  id:             string
  clinic_id:      string
  patient_id:     string
  appointment_id: string | null
  template_id:    string | null
  content_html:   string
  status:         Database['public']['Enums']['consent_status']
  signature_data: string | null
  signed_at:      string | null
  signer_ip:      string | null
  signer_ua:      string | null
  declined_at:    string | null
  decline_reason: string | null
  created_by:     string | null
  created_at:     string
}

export type ConsentInsert = Omit<Consent, 'id' | 'created_at'>

// ── View types ────────────────────────────────

export interface DailyAgendaRow {
  id:                   string
  clinic_id:            string
  starts_at:            string
  ends_at:              string
  duration_minutes:     number
  status:               string
  appointment_type:     string | null
  chief_complaint:      string | null
  patient_id:           string
  patient_name:         string
  patient_phone:        string
  insurance_name:       string | null
  professional_id:      string
  professional_name:    string
  professional_color:   string
  reminder_sent_24h:    boolean
  reminder_sent_2h:     boolean
  confirmed_at:         string | null
}

export interface PatientBalanceRow {
  patient_id:    string
  clinic_id:     string
  patient_name:  string
  phone:         string
  total_quoted:  number
  total_paid:    number
  balance_due:   number
}

export interface DailyCashRow {
  clinic_id:    string
  day:          string
  method:       string
  transactions: number
  total:        number
  credit_total: number
}

export interface PatientSearchResult {
  id:                  string
  first_name:          string
  last_name:           string
  phone:               string
  email:               string | null
  insurance_name:      string | null
  last_appointment_at: string | null
  rank:                number
}
