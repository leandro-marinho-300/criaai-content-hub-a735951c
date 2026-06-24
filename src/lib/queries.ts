import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyFamily } from "@/lib/auth";

export const PERSON_COLORS = [
  "#E11D48", "#0EA5E9", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export type Person = {
  id: string;
  family_id: string;
  full_name: string;
  preferred_name: string | null;
  birth_date: string | null;
  photo_url: string | null;
  photo_path: string | null;
  color: string;
  blood_type: string | null;
  sex: string | null;
  marital_status: string | null;
  cpf: string | null;
  rg: string | null;
  sus_card: string | null;
  nationality: string | null;
  occupation: string | null;
  email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  weight_kg: number | null;
  weight_recorded_at: string | null;
  height_cm: number | null;
  height_recorded_at: string | null;
  conditions: string[];
  allergies: string[];
  drug_allergies: string[];
  restrictions: string[];
  drug_reactions: string[];
  surgeries: string[];
  prostheses: string[];
  disabilities: string[];
  family_history: string | null;
  doctor_name: string | null;
  doctor_specialty: string | null;
  emergency_contact: string | null;
  insurance: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
};

export type Medication = {
  id: string;
  family_id: string;
  name: string;
  active_ingredient: string | null;
  presentation: string | null;
  concentration: string | null;
  concentration_value: number | null;
  concentration_unit: string | null;
  form: string | null;
  form_other: string | null;
  purpose: string | null;
  manufacturer: string | null;
  storage_location: string | null;
  requires_prescription: boolean;
  notes: string | null;
  archived_at: string | null;
};


export type Prescription = {
  id: string;
  family_id: string;
  person_id: string;
  medication_id: string;
  dose_amount: number;
  dose_unit: string;
  route: string | null;
  frequency_type: "daily" | "alternate_days" | "specific_days" | "as_needed";
  specific_days: number[];
  times: string[];
  start_date: string;
  end_date: string | null;
  continuous: boolean;
  reason: string | null;
  doctor_name: string | null;
  prescription_ref: string | null;
  instructions: string | null;
  notes: string | null;
  status: "active" | "paused" | "finished";
};

export type StockLot = {
  id: string;
  family_id: string;
  medication_id: string;
  person_id: string | null;
  quantity: number;
  initial_quantity: number | null;
  unit: string;
  units_per_pack: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  purchase_date: string | null;
  price: number | null;
  location: string | null;
  min_threshold: number;
  notes: string | null;
  archived_at: string | null;
};


export type DoseAdministration = {
  id: string;
  family_id: string;
  prescription_id: string;
  person_id: string;
  medication_id: string;
  scheduled_for: string;
  taken_at: string | null;
  dose_amount: number;
  dose_unit: string;
  status: "pending" | "taken" | "skipped" | "postponed" | "refused" | "forgotten" | "cancelled";
  note: string | null;
};

export type Measurement = {
  id: string;
  family_id: string;
  person_id: string;
  type: "blood_pressure" | "glucose" | "temperature" | "oxygen" | "weight" | "heart_rate";
  measured_at: string;
  values: Record<string, unknown>;
  context: string | null;
  symptoms: string | null;
  notes: string | null;
};

export type CalendarEventType =
  | "consulta" | "exame" | "retorno" | "medicacao"
  | "medicao_pressao" | "medicao_glicemia" | "medicao_outra"
  | "renovacao_receita" | "compra_medicamento" | "retirada_medicamento"
  | "inicio_tratamento" | "fim_tratamento" | "vacina" | "procedimento" | "outro";

export type CalendarEventStatus =
  | "agendado" | "confirmado" | "concluido" | "cancelado" | "reagendado" | "nao_compareceu";

export type RecurrenceRule = {
  freq: "none" | "daily" | "weekly" | "days_of_week" | "monthly" | "yearly" | "interval_days";
  interval?: number;
  days_of_week?: number[];
  count?: number;
};

export type CalendarEvent = {
  id: string;
  family_id: string;
  person_id: string | null;
  type: CalendarEventType;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  doctor_name: string | null;
  specialty: string | null;
  phone: string | null;
  notes: string | null;
  prep_instructions: string | null;
  status: CalendarEventStatus;
  color: string | null;
  recurrence: RecurrenceRule | null;
  recurrence_until: string | null;
  parent_event_id: string | null;
  related_kind: string | null;
  related_id: string | null;
  created_by: string | null;
  archived_at: string | null;
};

export type EventReminder = {
  id: string;
  family_id: string;
  event_id: string;
  minutes_before: number;
};

export type MeasurementRoutine = {
  id: string;
  family_id: string;
  person_id: string;
  type: "blood_pressure" | "glucose" | "weight" | "temperature" | "oxygen" | "other";
  days_of_week: number[];
  times: string[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  active: boolean;
};

export type NotificationRead = {
  user_id: string;
  family_id: string;
  dedupe_key: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export type ConsultationStatus =
  | "agendada" | "confirmada" | "realizada" | "cancelada" | "reagendada" | "nao_compareceu";

export type Consultation = {
  id: string;
  family_id: string;
  person_id: string;
  calendar_event_id: string | null;
  scheduled_at: string;
  doctor_name: string | null;
  specialty: string | null;
  clinic: string | null;
  phone: string | null;
  reason: string | null;
  status: ConsultationStatus;
  prior_notes: string | null;
  questions_to_ask: string[];
  instructions_received: string | null;
  recommended_followup: boolean;
  next_followup_date: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExamStatus =
  | "solicitado" | "pedido_recebido" | "aguardando_autorizacao" | "autorizado"
  | "pendente_agendamento" | "agendado" | "preparacao_pendente" | "realizado"
  | "aguardando_resultado" | "resultado_disponivel" | "resultado_retirado"
  | "resultado_anexado" | "apresentado_medico" | "concluido" | "cancelado";

export type Exam = {
  id: string;
  family_id: string;
  person_id: string;
  calendar_event_id: string | null;
  consultation_id: string | null;
  name: string;
  category: string | null;
  request_date: string | null;
  scheduled_date: string | null;
  performed_date: string | null;
  requesting_doctor: string | null;
  lab_location: string | null;
  prep_instructions: string | null;
  status: ExamStatus;
  result_summary: string | null;
  condition_tag: string | null;
  priority: string | null;
  purpose: string | null;
  specialty: string | null;
  requires_authorization: boolean;
  protocol_required: boolean;
  result_expected_date: string | null;
  result_available_date: string | null;
  result_pickup_deadline: string | null;
  result_picked_up_at: string | null;
  result_attached_at: string | null;
  presented_at: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at?: string;
};

export type DocumentCategory =
  | "receita" | "laudo" | "resultado_exame" | "pedido_exame" | "atestado"
  | "carteira_vacinacao" | "relatorio_medico" | "convenio" | "outro";

export type MedicalDocument = {
  id: string;
  family_id: string;
  person_id: string;
  category: DocumentCategory;
  subcategory: string | null;
  document_number: string | null;
  origin: "fisico" | "digital" | "ambos" | null;
  title: string;
  document_date: string | null;
  issued_at: string | null;
  expiry_date: string | null;
  expiry_date_legacy: string | null;
  validity_meaning: string | null;
  doctor_or_institution: string | null;
  professional_name: string | null;
  professional_registry: string | null;
  specialty: string | null;
  institution: string | null;
  status: string | null;
  data: Record<string, unknown>;
  notes: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentLink = {
  id: string;
  family_id: string;
  document_id: string;
  consultation_id: string | null;
  exam_id: string | null;
};

export type DocumentReminder = {
  id: string;
  family_id: string;
  document_id: string;
  kind: "expiry" | "renewal" | "pickup" | "delivery" | "fasting" | "appointment" | "last_use" | "custom";
  offset_days: number;
  remind_at: string;
  note: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export type PrescriptionItem = {
  id: string;
  family_id: string;
  document_id: string;
  medication_id: string | null;
  name: string;
  dose: string | null;
  instructions: string | null;
  order_index: number;
};

export type ExamOrderItem = {
  id: string;
  family_id: string;
  document_id: string;
  exam_id: string | null;
  name: string;
  notes: string | null;
  order_index: number;
};

export type VaccinationDose = {
  id: string;
  family_id: string;
  document_id: string | null;
  person_id: string;
  vaccine_name: string;
  disease: string | null;
  dose_label: string | null;
  applied_at: string | null;
  scheduled_at: string | null;
  lot: string | null;
  manufacturer: string | null;
  health_unit: string | null;
  professional: string | null;
  next_dose_at: string | null;
  is_booster: boolean;
  status: "applied" | "scheduled" | "pending" | "late" | "not_needed" | "cancelled";
  notes: string | null;
  archived_at: string | null;
};

export type InsuranceAuthorization = {
  id: string;
  family_id: string;
  document_id: string | null;
  person_id: string;
  exam_id: string | null;
  insurance_name: string;
  authorization_number: string | null;
  procedure: string | null;
  quantity: number | null;
  quantity_used: number;
  authorized_at: string | null;
  valid_until: string | null;
  status: "pending" | "authorized" | "denied" | "used" | "expired" | "cancelled";
  notes: string | null;
  archived_at: string | null;
};

export const consultationsQuery = (personId?: string) =>
  queryOptions({
    queryKey: ["consultations", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("consultations").select("*").eq("family_id", fid)
        .order("scheduled_at", { ascending: false });
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Consultation[];
    },
  });

export const examsQuery = (personId?: string) =>
  queryOptions({
    queryKey: ["exams", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("exams").select("*").eq("family_id", fid)
        .order("scheduled_date", { ascending: false, nullsFirst: false });
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Exam[];
    },
  });

export const documentsQuery = (personId?: string, includeArchived = false) =>
  queryOptions({
    queryKey: ["documents", personId ?? "all", includeArchived ? "all" : "active"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("documents").select("*").eq("family_id", fid)
        .order("document_date", { ascending: false, nullsFirst: false });
      if (personId) q = q.eq("person_id", personId);
      if (!includeArchived) q = q.is("archived_at", null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MedicalDocument[];
    },
  });

export const documentLinksQuery = () =>
  queryOptions({
    queryKey: ["document_links"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase.from("document_links")
        .select("*").eq("family_id", fid);
      if (error) throw error;
      return (data ?? []) as DocumentLink[];
    },
  });

async function familyId() {
  const fam = await getMyFamily();
  if (!fam) throw new Error("Família não encontrada");
  return fam.family_id;
}

export const peopleQuery = () =>
  queryOptions({
    queryKey: ["people"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("people").select("*").eq("family_id", fid).order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

export const personQuery = (id: string) =>
  queryOptions({
    queryKey: ["person", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("people").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Person;
    },
  });

export const medicationsQuery = () =>
  queryOptions({
    queryKey: ["medications"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("medications").select("*").eq("family_id", fid).order("name");
      if (error) throw error;
      return (data ?? []) as Medication[];
    },
  });

export const prescriptionsQuery = (personId?: string) =>
  queryOptions({
    queryKey: ["prescriptions", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("prescriptions").select("*").eq("family_id", fid).order("created_at", { ascending: false });
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Prescription[];
    },
  });

export const stockQuery = () =>
  queryOptions({
    queryKey: ["stock"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("stock_lots").select("*").eq("family_id", fid)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as StockLot[];
    },
  });

export const measurementsQuery = (personId?: string, type?: Measurement["type"]) =>
  queryOptions({
    queryKey: ["measurements", personId ?? "all", type ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("measurements").select("*").eq("family_id", fid).order("measured_at", { ascending: false }).limit(200);
      if (personId) q = q.eq("person_id", personId);
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
  });

export const dosesForDateQuery = (dateISO: string) =>
  queryOptions({
    queryKey: ["doses", dateISO],
    queryFn: async () => {
      const fid = await familyId();
      const start = new Date(dateISO + "T00:00:00").toISOString();
      const end = new Date(dateISO + "T23:59:59.999").toISOString();
      const { data, error } = await supabase
        .from("dose_administrations").select("*").eq("family_id", fid)
        .gte("scheduled_for", start).lte("scheduled_for", end);
      if (error) throw error;
      return (data ?? []) as DoseAdministration[];
    },
  });

export const calendarEventsQuery = () =>
  queryOptions({
    queryKey: ["calendar_events"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("calendar_events").select("*").eq("family_id", fid)
        .is("archived_at", null).order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CalendarEvent[];
    },
  });

export const eventRemindersQuery = () =>
  queryOptions({
    queryKey: ["event_reminders"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("event_reminders").select("*").eq("family_id", fid);
      if (error) throw error;
      return (data ?? []) as EventReminder[];
    },
  });

export const measurementRoutinesQuery = () =>
  queryOptions({
    queryKey: ["measurement_routines"],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await supabase
        .from("measurement_routines").select("*").eq("family_id", fid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MeasurementRoutine[];
    },
  });

export const notificationReadsQuery = () =>
  queryOptions({
    queryKey: ["notification_reads"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as NotificationRead[];
      const { data, error } = await supabase
        .from("notification_reads").select("*").eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? []) as NotificationRead[];
    },
  });

export const documentRemindersQuery = (documentId?: string) =>
  queryOptions({
    queryKey: ["document_reminders", documentId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("document_reminders").select("*").eq("family_id", fid);
      if (documentId) q = q.eq("document_id", documentId);
      const { data, error } = await q.order("remind_at");
      if (error) throw error;
      return (data ?? []) as DocumentReminder[];
    },
  });

export const prescriptionItemsQuery = (documentId?: string) =>
  queryOptions({
    queryKey: ["prescription_items", documentId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("prescription_items").select("*").eq("family_id", fid);
      if (documentId) q = q.eq("document_id", documentId);
      const { data, error } = await q.order("order_index");
      if (error) throw error;
      return (data ?? []) as PrescriptionItem[];
    },
  });

export const examOrderItemsQuery = (documentId?: string) =>
  queryOptions({
    queryKey: ["exam_order_items", documentId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("exam_order_items").select("*").eq("family_id", fid);
      if (documentId) q = q.eq("document_id", documentId);
      const { data, error } = await q.order("order_index");
      if (error) throw error;
      return (data ?? []) as ExamOrderItem[];
    },
  });

export const vaccinationDosesQuery = (personId?: string) =>
  queryOptions({
    queryKey: ["vaccination_doses", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("vaccination_doses").select("*").eq("family_id", fid).is("archived_at", null);
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q.order("applied_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as VaccinationDose[];
    },
  });

export const insuranceAuthorizationsQuery = (personId?: string) =>
  queryOptions({
    queryKey: ["insurance_authorizations", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = supabase.from("insurance_authorizations").select("*").eq("family_id", fid).is("archived_at", null);
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q.order("valid_until", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as InsuranceAuthorization[];
    },
  });

// Extended person profile and exam dossier domain types. These are kept here
// so the UI remains strongly typed even before Supabase types are regenerated.
export type EmergencyContact = {
  id: string; family_id: string; person_id: string; name: string;
  relationship: string | null; phone: string; notes: string | null;
  created_at: string; updated_at: string;
};

export type PersonDoctor = {
  id: string; family_id: string; person_id: string; name: string;
  specialty: string | null; phone: string | null; crm: string | null;
  is_primary: boolean; notes: string | null; created_at: string; updated_at: string;
};

export type PersonInsurance = {
  id: string; family_id: string; person_id: string; name: string;
  plan: string | null; card_number: string | null; valid_until: string | null;
  reference_unit: string | null; is_primary: boolean; notes: string | null;
  created_at: string; updated_at: string;
};

export type PersonPharmacy = {
  id: string; family_id: string; person_id: string; name: string;
  phone: string | null; address: string | null; notes: string | null;
  created_at: string; updated_at: string;
};

export type ExamOrder = {
  id: string; family_id: string; exam_id: string; order_date: string | null;
  doctor_name: string | null; crm: string | null; validity_date: string | null;
  storage_path: string | null; file_name: string | null; mime_type: string | null;
  size_bytes: number | null; notes: string | null; created_at: string; updated_at: string;
};

export type ExamScheduling = {
  id: string; family_id: string; exam_id: string; scheduled_at: string | null;
  location_name: string | null; address: string | null; phone: string | null;
  booking_number: string | null; channel: string | null; price: number | null;
  payment_method: string | null; notes: string | null; created_at: string; updated_at: string;
};

export type ExamPreparation = {
  id: string; family_id: string; exam_id: string; instructions: string | null;
  fasting_required: boolean; fasting_hours: number | null; fasting_start_at: string | null;
  companion_required: boolean; arrive_minutes_before: number | null;
  documents_required: string[]; bring_previous_exams: boolean; bring_order: boolean;
  bring_authorization: boolean; bring_insurance_card: boolean; notes: string | null;
  created_at: string; updated_at: string;
};

export type ExamProtocol = {
  id: string; family_id: string; exam_id: string; protocol_number: string | null;
  access_code: string | null; password: string | null; online_url: string | null;
  qr_image_path: string | null; receipt_path: string | null; issued_at: string | null;
  pickup_location: string | null; pickup_method: string | null;
  authorized_person: string | null; document_required: string | null;
  notes: string | null; created_at: string; updated_at: string;
};

export type ExamResult = {
  id: string; family_id: string; exam_id: string; result_date: string | null;
  lab_or_institution: string | null; responsible_doctor: string | null;
  report_number: string | null; summary: string | null; notes: string | null;
  created_at: string; updated_at: string;
};

export type ExamResultFile = {
  id: string; family_id: string; exam_result_id: string; exam_id: string;
  storage_path: string; file_name: string; mime_type: string | null;
  size_bytes: number | null; uploaded_by: string | null; created_at: string;
};

export type ExamPresentation = {
  id: string; family_id: string; exam_id: string; presented_at: string;
  consultation_id: string | null; doctor_name: string | null; guidance: string | null;
  needs_followup: boolean; needs_new_exam: boolean; suggested_date: string | null;
  notes: string | null; created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
};


export type ExamPresentationPlan = {
  id: string; family_id: string; exam_id: string; consultation_id: string | null;
  planned_for: string; doctor_name: string | null; notes: string | null;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
};

export type MedicationPrescriptionRecord = {
  id: string; family_id: string; person_id: string; medication_id: string;
  prescription_id: string | null; document_id: string | null; issued_at: string | null;
  expires_at: string | null; doctor_name: string | null; crm: string | null;
  reference_number: string | null; continuous: boolean; controlled: boolean;
  authorized_quantity: number | null; quantity_per_pickup: number | null; quantity_unit: string | null;
  allowed_pickups: number | null; remaining_pickups: number | null;
  status: "valid" | "expiring" | "expired" | "used" | "partially_used" | "cancelled" | "archived";
  notes: string | null; archived_at: string | null; created_at: string; updated_at: string;
};

export type MedicationPickupPlan = {
  id: string; family_id: string; person_id: string; medication_id: string;
  prescription_id: string | null; prescription_record_id: string | null; program: string | null;
  pickup_location: string | null; frequency: "monthly" | "interval_days" | "weekly" | "custom";
  day_of_month: number | null; interval_days: number | null; next_pickup_date: string;
  last_pickup_date: string | null; usual_quantity: number; unit: string;
  units_per_package: number | null; stock_unit: string | null; required_documents: string[];
  reminder_days: number[]; notes: string | null; active: boolean; calendar_event_id: string | null;
  created_at: string; updated_at: string;
};

export type MedicationPickup = {
  id: string; family_id: string; plan_id: string; person_id: string; medication_id: string;
  prescription_record_id: string | null; picked_up_at: string; quantity: number; unit: string;
  package_quantity: number | null; package_unit: string | null; units_per_package: number | null;
  stock_quantity: number | null; stock_unit: string | null;
  lot_number: string | null; expiry_date: string | null; location: string | null; notes: string | null;
  stock_lot_id: string | null; actor: string | null; created_at: string;
};

export type ExamRealization = {
  id: string; family_id: string; exam_id: string; performed_at: string;
  location_name: string | null; professional_name: string | null;
  partially_completed: boolean; needs_repeat: boolean; repeat_reason: string | null;
  occurrences: string | null; notes: string | null; created_at: string; updated_at: string;
};

export type ExamTimelineEvent = {
  id: string; family_id: string; exam_id: string; event_type: string;
  occurred_at: string; actor: string | null; note: string | null;
  document_id: string | null; status_from: string | null; status_to: string | null;
  created_at: string;
};

const untypedSupabase = supabase as any;

export const emergencyContactsQuery = (personId: string) =>
  queryOptions({
    queryKey: ["emergency_contacts", personId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("emergency_contacts")
        .select("*").eq("family_id", fid).eq("person_id", personId).order("created_at");
      if (error) throw error;
      return (data ?? []) as EmergencyContact[];
    },
  });

export const personDoctorsQuery = (personId: string) =>
  queryOptions({
    queryKey: ["person_doctors", personId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("person_doctors")
        .select("*").eq("family_id", fid).eq("person_id", personId)
        .order("is_primary", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as PersonDoctor[];
    },
  });

export const personInsurancesQuery = (personId: string) =>
  queryOptions({
    queryKey: ["person_insurances", personId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("person_insurances")
        .select("*").eq("family_id", fid).eq("person_id", personId)
        .order("is_primary", { ascending: false }).order("name");
      if (error) throw error;
      return (data ?? []) as PersonInsurance[];
    },
  });

export const personPharmaciesQuery = (personId: string) =>
  queryOptions({
    queryKey: ["person_pharmacies", personId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("person_pharmacies")
        .select("*").eq("family_id", fid).eq("person_id", personId).order("name");
      if (error) throw error;
      return (data ?? []) as PersonPharmacy[];
    },
  });

export const examQuery = (examId: string) =>
  queryOptions({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("exams")
        .select("*").eq("id", examId).eq("family_id", fid).single();
      if (error) throw error;
      return data as Exam;
    },
  });

function dossierOneQuery<T>(table: string, examId: string, order?: string) {
  return queryOptions<T | null>({
    queryKey: [table, examId, "one"],
    queryFn: async (): Promise<T | null> => {
      const fid = await familyId();
      let q = untypedSupabase.from(table).select("*").eq("family_id", fid).eq("exam_id", examId);
      if (order) q = q.order(order, { ascending: false });
      q = q.limit(1);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as T | null;
    },
  });
}

function dossierManyQuery<T>(table: string, examId: string, order?: string) {
  return queryOptions<T[]>({
    queryKey: [table, examId, "many"],
    queryFn: async (): Promise<T[]> => {
      const fid = await familyId();
      let q = untypedSupabase.from(table).select("*").eq("family_id", fid).eq("exam_id", examId);
      if (order) q = q.order(order, { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export const examOrderQuery = (examId: string) => dossierOneQuery<ExamOrder>("exam_orders", examId, "created_at");
export const examSchedulingQuery = (examId: string) => dossierOneQuery<ExamScheduling>("exam_schedulings", examId, "created_at");
export const examPreparationQuery = (examId: string) => dossierOneQuery<ExamPreparation>("exam_preparations", examId);
export const examProtocolQuery = (examId: string) => dossierOneQuery<ExamProtocol>("exam_protocols", examId);
export const examResultQuery = (examId: string) => dossierOneQuery<ExamResult>("exam_results", examId);
export const examPresentationsQuery = (examId: string) => dossierManyQuery<ExamPresentation>("exam_presentations", examId, "presented_at");
export const examRealizationsQuery = (examId: string) => dossierManyQuery<ExamRealization>("exam_realizations", examId, "performed_at");
export const examTimelineQuery = (examId: string) => dossierManyQuery<ExamTimelineEvent>("exam_timeline", examId, "occurred_at");

export const examResultFilesQuery = (examId: string) =>
  queryOptions({
    queryKey: ["exam_result_files", examId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("exam_result_files")
        .select("*").eq("family_id", fid).eq("exam_id", examId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExamResultFile[];
    },
  });

export const examAuthorizationQuery = (examId: string) =>
  queryOptions({
    queryKey: ["exam_authorization", examId],
    queryFn: async () => {
      const fid = await familyId();
      const { data, error } = await untypedSupabase.from("insurance_authorizations")
        .select("*").eq("family_id", fid).eq("exam_id", examId)
        .is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as InsuranceAuthorization | null;
    },
  });


export const examPresentationPlanQuery = (examId: string) =>
  dossierOneQuery<ExamPresentationPlan>("exam_presentation_plans", examId);

export const medicationPrescriptionRecordsQuery = (medicationId?: string, personId?: string) =>
  queryOptions({
    queryKey: ["medication_prescription_records", medicationId ?? "all", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = untypedSupabase.from("medication_prescription_records")
        .select("*").eq("family_id", fid).order("created_at", { ascending: false });
      if (medicationId) q = q.eq("medication_id", medicationId);
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MedicationPrescriptionRecord[];
    },
  });

export const medicationPickupPlansQuery = (medicationId?: string, personId?: string) =>
  queryOptions({
    queryKey: ["medication_pickup_plans", medicationId ?? "all", personId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = untypedSupabase.from("medication_pickup_plans")
        .select("*").eq("family_id", fid).order("next_pickup_date", { ascending: true });
      if (medicationId) q = q.eq("medication_id", medicationId);
      if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MedicationPickupPlan[];
    },
  });

export const medicationPickupsQuery = (planId?: string) =>
  queryOptions({
    queryKey: ["medication_pickups", planId ?? "all"],
    queryFn: async () => {
      const fid = await familyId();
      let q = untypedSupabase.from("medication_pickups")
        .select("*").eq("family_id", fid).order("picked_up_at", { ascending: false });
      if (planId) q = q.eq("plan_id", planId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MedicationPickup[];
    },
  });
