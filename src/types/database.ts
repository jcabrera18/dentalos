export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          chief_complaint: string | null
          clinic_id: string
          clinical_notes: string | null
          confirmation_channel: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          ends_at: string
          id: string
          internal_notes: string | null
          patient_id: string
          professional_id: string
          reminder_sent_24h: boolean
          reminder_sent_2h: boolean
          reminder_sent_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          treatment_id: string | null
          treatment_session: number | null
          updated_at: string
        }
        Insert: {
          appointment_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          chief_complaint?: string | null
          clinic_id: string
          clinical_notes?: string | null
          confirmation_channel?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          ends_at: string
          id?: string
          internal_notes?: string | null
          patient_id: string
          professional_id: string
          reminder_sent_24h?: boolean
          reminder_sent_2h?: boolean
          reminder_sent_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_id?: string | null
          treatment_session?: number | null
          updated_at?: string
        }
        Update: {
          appointment_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          clinical_notes?: string | null
          confirmation_channel?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          ends_at?: string
          id?: string
          internal_notes?: string | null
          patient_id?: string
          professional_id?: string
          reminder_sent_24h?: boolean
          reminder_sent_2h?: boolean
          reminder_sent_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          treatment_id?: string | null
          treatment_session?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_appt_treatment"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          auth_user_id: string | null
          clinic_id: string | null
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          auth_user_id?: string | null
          clinic_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          auth_user_id?: string | null
          clinic_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: number
          ip_address?: unknown
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          currency: string
          deleted_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          settings: Json
          slug: string
          stripe_customer_id: string | null
          sub_ends_at: string | null
          sub_status: Database["public"]["Enums"]["subscription_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          settings?: Json
          slug: string
          stripe_customer_id?: string | null
          sub_ends_at?: string | null
          sub_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          settings?: Json
          slug?: string
          stripe_customer_id?: string | null
          sub_ends_at?: string | null
          sub_status?: Database["public"]["Enums"]["subscription_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consent_templates: {
        Row: {
          clinic_id: string
          content_html: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          content_html: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          content_html?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          content_html: string
          created_at: string
          created_by: string | null
          decline_reason: string | null
          declined_at: string | null
          id: string
          patient_id: string
          signature_data: string | null
          signed_at: string | null
          signer_ip: string | null
          signer_ua: string | null
          status: Database["public"]["Enums"]["consent_status"]
          template_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          content_html: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          patient_id: string
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_ua?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          template_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          content_html?: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          patient_id?: string
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          signer_ua?: string | null
          status?: Database["public"]["Enums"]["consent_status"]
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_daily_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "consents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      global_consent_templates: {
        Row: {
          content_html: string
          created_at: string
          id: string
          language: string
          name: string
          specialty: string | null
        }
        Insert: {
          content_html: string
          created_at?: string
          id?: string
          language?: string
          name: string
          specialty?: string | null
        }
        Update: {
          content_html?: string
          created_at?: string
          id?: string
          language?: string
          name?: string
          specialty?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          max_retries: number
          patient_id: string | null
          provider: string | null
          provider_msg_id: string | null
          rendered_body: string | null
          retry_count: number
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_key: string | null
          template_vars: Json
          to_email: string | null
          to_phone: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          appointment_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number
          patient_id?: string | null
          provider?: string | null
          provider_msg_id?: string | null
          rendered_body?: string | null
          retry_count?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_key?: string | null
          template_vars?: Json
          to_email?: string | null
          to_phone?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          appointment_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id?: string
          created_at?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          max_retries?: number
          patient_id?: string | null
          provider?: string | null
          provider_msg_id?: string | null
          rendered_body?: string | null
          retry_count?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_key?: string | null
          template_vars?: Json
          to_email?: string | null
          to_phone?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_daily_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      odontogram: {
        Row: {
          clinic_id: string
          condition: Database["public"]["Enums"]["tooth_condition"]
          id: string
          notes: string | null
          patient_id: string
          recorded_at: string
          recorded_by: string | null
          surfaces: string[] | null
          tooth_number: number
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          condition?: Database["public"]["Enums"]["tooth_condition"]
          id?: string
          notes?: string | null
          patient_id: string
          recorded_at?: string
          recorded_by?: string | null
          surfaces?: string[] | null
          tooth_number: number
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          condition?: Database["public"]["Enums"]["tooth_condition"]
          id?: string
          notes?: string | null
          patient_id?: string
          recorded_at?: string
          recorded_by?: string | null
          surfaces?: string[] | null
          tooth_number?: number
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odontogram_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "odontogram_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odontogram_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          blood_type: string | null
          city: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          current_medications: string | null
          date_of_birth: string | null
          deleted_at: string | null
          document_number: string | null
          document_type: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          insurance_name: string | null
          insurance_number: string | null
          insurance_plan: string | null
          is_active: boolean
          last_appointment_at: string | null
          last_name: string
          medical_notes: string | null
          phone: string
          phone_alt: string | null
          referral_source: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          blood_type?: string | null
          city?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          insurance_name?: string | null
          insurance_number?: string | null
          insurance_plan?: string | null
          is_active?: boolean
          last_appointment_at?: string | null
          last_name: string
          medical_notes?: string | null
          phone: string
          phone_alt?: string | null
          referral_source?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          blood_type?: string | null
          city?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          current_medications?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          insurance_name?: string | null
          insurance_number?: string | null
          insurance_plan?: string | null
          is_active?: boolean
          last_appointment_at?: string | null
          last_name?: string
          medical_notes?: string | null
          phone?: string
          phone_alt?: string | null
          referral_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          installment_amount: number | null
          installments: number
          insurance_coverage: number | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          original_payment_id: string | null
          paid_at: string
          patient_copay: number | null
          patient_id: string
          professional_id: string
          quote_id: string | null
          receipt_number: string | null
          reference_number: string | null
          refund_reason: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          installment_amount?: number | null
          installments?: number
          insurance_coverage?: number | null
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          patient_copay?: number | null
          patient_id: string
          professional_id: string
          quote_id?: string | null
          receipt_number?: string | null
          reference_number?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          installment_amount?: number | null
          installments?: number
          insurance_coverage?: number | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          original_payment_id?: string | null
          paid_at?: string
          patient_copay?: number | null
          patient_id?: string
          professional_id?: string
          quote_id?: string | null
          receipt_number?: string | null
          reference_number?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_daily_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          clinic_id: string
          color: string
          created_at: string
          default_duration_minutes: number
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          license_number: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          schedule_config: Json | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          clinic_id: string
          color?: string
          created_at?: string
          default_duration_minutes?: number
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          license_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          schedule_config?: Json | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          clinic_id?: string
          color?: string
          created_at?: string
          default_duration_minutes?: number
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          license_number?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          schedule_config?: Json | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          installment_amount: number | null
          installments: number
          items: Json
          notes: string | null
          patient_id: string
          professional_id: string
          quote_number: string | null
          rejected_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          total: number
          treatment_id: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          installment_amount?: number | null
          installments?: number
          items?: Json
          notes?: string | null
          patient_id: string
          professional_id: string
          quote_number?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          treatment_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          installment_amount?: number | null
          installments?: number
          items?: Json
          notes?: string | null
          patient_id?: string
          professional_id?: string
          quote_number?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          treatment_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "quotes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_sessions: {
        Row: {
          appointment_id: string | null
          clinic_id: string
          created_at: string
          id: string
          next_steps: string | null
          notes: string | null
          performed_at: string
          session_number: number
          treatment_id: string
        }
        Insert: {
          appointment_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          next_steps?: string | null
          notes?: string | null
          performed_at?: string
          session_number: number
          treatment_id: string
        }
        Update: {
          appointment_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          next_steps?: string | null
          notes?: string | null
          performed_at?: string
          session_number?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "v_daily_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_sessions_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          abandon_reason: string | null
          abandoned_at: string | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_end_date: string | null
          id: string
          name: string
          patient_id: string
          professional_id: string
          quote_id: string | null
          sessions_done: number
          sessions_planned: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["treatment_status"]
          tooth_numbers: number[] | null
          tooth_surfaces: Json | null
          total_paid: number
          total_quoted: number | null
          updated_at: string
        }
        Insert: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_end_date?: string | null
          id?: string
          name: string
          patient_id: string
          professional_id: string
          quote_id?: string | null
          sessions_done?: number
          sessions_planned?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          tooth_numbers?: number[] | null
          tooth_surfaces?: Json | null
          total_paid?: number
          total_quoted?: number | null
          updated_at?: string
        }
        Update: {
          abandon_reason?: string | null
          abandoned_at?: string | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_end_date?: string | null
          id?: string
          name?: string
          patient_id?: string
          professional_id?: string
          quote_id?: string | null
          sessions_done?: number
          sessions_planned?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          tooth_numbers?: number[] | null
          tooth_surfaces?: Json | null
          total_paid?: number
          total_quoted?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_treatment_quote"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_daily_agenda: {
        Row: {
          appointment_type: string | null
          chief_complaint: string | null
          clinic_id: string | null
          confirmed_at: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string | null
          insurance_name: string | null
          patient_id: string | null
          patient_name: string | null
          patient_phone: string | null
          professional_color: string | null
          professional_id: string | null
          professional_name: string | null
          reminder_sent_24h: boolean | null
          reminder_sent_2h: boolean | null
          starts_at: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patient_balance"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      v_daily_cash: {
        Row: {
          clinic_id: string | null
          credit_total: number | null
          day: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          total: number | null
          transactions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      v_patient_balance: {
        Row: {
          balance_due: number | null
          clinic_id: string | null
          patient_id: string | null
          patient_name: string | null
          phone: string | null
          total_paid: number | null
          total_quoted: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_professional_availability: {
        Args: {
          p_ends_at: string
          p_exclude_id?: string
          p_professional_id: string
          p_starts_at: string
        }
        Returns: boolean
      }
      current_clinic_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      onboard_clinic: {
        Args: { p_clinic_id: string; p_professional_id: string }
        Returns: undefined
      }
      search_patients: {
        Args: {
          p_clinic_id: string
          p_limit?: number
          p_offset?: number
          p_query: string
        }
        Returns: {
          email: string
          first_name: string
          id: string
          insurance_name: string
          last_appointment_at: string
          last_name: string
          phone: string
          rank: number
        }[]
      }
    }
    Enums: {
      appointment_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "absent"
        | "cancelled"
      consent_status: "pending" | "signed" | "declined"
      notification_channel: "whatsapp" | "sms" | "email" | "push"
      notification_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      notification_type:
        | "appointment_reminder_24h"
        | "appointment_reminder_2h"
        | "appointment_confirmation"
        | "appointment_cancelled"
        | "payment_receipt"
        | "quote_sent"
        | "inactive_patient"
        | "custom"
      payment_method:
        | "cash"
        | "bank_transfer"
        | "debit_card"
        | "credit_card"
        | "insurance"
        | "qr"
        | "other"
      payment_status: "pending" | "completed" | "refunded" | "failed"
      plan_type: "free" | "basic" | "pro" | "clinic" | "enterprise"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
      tooth_condition:
        | "healthy"
        | "cavity"
        | "filled"
        | "root_canal"
        | "crown"
        | "missing"
        | "implant"
        | "bridge_abutment"
        | "extraction_needed"
        | "fracture"
        | "other"
      treatment_status:
        | "quoted"
        | "accepted"
        | "in_progress"
        | "completed"
        | "abandoned"
      user_role: "owner" | "admin" | "professional" | "receptionist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "absent",
        "cancelled",
      ],
      consent_status: ["pending", "signed", "declined"],
      notification_channel: ["whatsapp", "sms", "email", "push"],
      notification_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      notification_type: [
        "appointment_reminder_24h",
        "appointment_reminder_2h",
        "appointment_confirmation",
        "appointment_cancelled",
        "payment_receipt",
        "quote_sent",
        "inactive_patient",
        "custom",
      ],
      payment_method: [
        "cash",
        "bank_transfer",
        "debit_card",
        "credit_card",
        "insurance",
        "qr",
        "other",
      ],
      payment_status: ["pending", "completed", "refunded", "failed"],
      plan_type: ["free", "basic", "pro", "clinic", "enterprise"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
      tooth_condition: [
        "healthy",
        "cavity",
        "filled",
        "root_canal",
        "crown",
        "missing",
        "implant",
        "bridge_abutment",
        "extraction_needed",
        "fracture",
        "other",
      ],
      treatment_status: [
        "quoted",
        "accepted",
        "in_progress",
        "completed",
        "abandoned",
      ],
      user_role: ["owner", "admin", "professional", "receptionist"],
    },
  },
} as const
