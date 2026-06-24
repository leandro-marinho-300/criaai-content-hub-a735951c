import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  Package,
  PackagePlus,
  Plus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyFamily } from "@/lib/auth";
import {
  documentsQuery,
  medicationPickupPlansQuery,
  medicationPickupsQuery,
  medicationPrescriptionRecordsQuery,
  peopleQuery,
  prescriptionsQuery,
  type Medication,
  type MedicationPickupPlan,
  type MedicationPrescriptionRecord,
  type Prescription,
} from "@/lib/queries";
import { fmtDate, fmtDateTime } from "@/lib/dates";

const DOCUMENT_OPTIONS = [
  "Documento com foto",
  "Receita",
  "Cartão SUS",
  "Carteirinha do convênio",
  "Comprovante de endereço",
  "Procuração",
] as const;

const PACKAGE_UNITS = [
  ["caixa", "Caixa"],
  ["cartela", "Cartela"],
  ["frasco", "Frasco"],
  ["pacote", "Pacote"],
  ["ampola", "Ampola"],
  ["caneta", "Caneta"],
  ["bisnaga", "Bisnaga"],
  ["sachê", "Sachê"],
  ["comprimido", "Comprimido"],
  ["cápsula", "Cápsula"],
  ["unidade", "Unidade"],
] as const;

const STOCK_UNITS = [
  ["comprimido", "Comprimido"],
  ["cápsula", "Cápsula"],
  ["pastilha", "Pastilha"],
  ["sachê", "Sachê"],
  ["mL", "mL"],
  ["gota", "Gota"],
  ["dose", "Dose"],
  ["ampola", "Ampola"],
  ["unidade", "Unidade"],
] as const;

const REMINDER_OPTIONS = [7, 3, 1, 0] as const;

export function MedicationCareDialog({ medication, open, onOpenChange }: {
  medication: Medication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const people = useQuery(peopleQuery());
  const [personId, setPersonId] = useState("");
  const availablePeople = (people.data ?? []).filter((person) => !person.archived_at);
  const resolvedPersonId = personId || availablePeople[0]?.id || "";
  const selectedPerson = availablePeople.find((person) => person.id === resolvedPersonId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receita e retirada — {medication?.name ?? "Medicamento"}</DialogTitle>
          <DialogDescription>
            Controle a validade da receita e a retirada recorrente sem misturar dados de pessoas diferentes.
          </DialogDescription>
        </DialogHeader>

        {!medication || availablePeople.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Cadastre uma pessoa antes de configurar receitas e retiradas.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Label>Pessoa</Label>
              <Select value={resolvedPersonId} onValueChange={setPersonId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availablePeople.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.preferred_name || person.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {resolvedPersonId && (
              <MedicationCareForPerson
                key={`${medication.id}:${resolvedPersonId}`}
                medication={medication}
                personId={resolvedPersonId}
                personName={selectedPerson?.preferred_name || selectedPerson?.full_name || "Pessoa"}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MedicationCareForPerson({ medication, personId, personName }: {
  medication: Medication;
  personId: string;
  personName: string;
}) {
  const qc = useQueryClient();
  const prescriptions = useQuery(prescriptionsQuery(personId));
  const documents = useQuery(documentsQuery(personId, true));
  const records = useQuery(medicationPrescriptionRecordsQuery(medication.id, personId));
  const plans = useQuery(medicationPickupPlansQuery(medication.id, personId));
  const record = (records.data ?? []).find((item) => !item.archived_at) ?? null;
  const plan = (plans.data ?? []).find((item) => item.active) ?? null;
  const pickups = useQuery({ ...medicationPickupsQuery(plan?.id), enabled: Boolean(plan?.id) });
  const activePrescriptions = (prescriptions.data ?? []).filter(
    (item) => item.medication_id === medication.id && item.status === "active",
  );
  const recipeDocuments = (documents.data ?? []).filter(
    (item) => item.category === "receita" && !item.archived_at,
  );
  const [confirming, setConfirming] = useState(false);

  const recordMutation = useMutation({
    mutationFn: async (values: RecordForm) => {
      const family = await getMyFamily();
      const { data: auth } = await supabase.auth.getUser();
      if (!family || !auth.user) throw new Error("Sessão inválida");
      const payload = {
        family_id: family.family_id,
        person_id: personId,
        medication_id: medication.id,
        prescription_id: values.prescription_id || null,
        document_id: values.document_id || null,
        issued_at: values.issued_at || null,
        expires_at: values.expires_at || null,
        doctor_name: values.doctor_name || null,
        crm: values.crm || null,
        reference_number: values.reference_number || null,
        continuous: values.continuous,
        controlled: values.controlled,
        quantity_per_pickup: decimalOrNull(values.quantity_per_pickup),
        quantity_unit: values.quantity_unit || null,
        allowed_pickups: integerOrNull(values.allowed_pickups),
        notes: values.notes || null,
        updated_by: auth.user.id,
      };
      const db = supabase as any;
      const query = record
        ? db.from("medication_prescription_records").update(payload).eq("id", record.id)
        : db.from("medication_prescription_records").insert({ ...payload, created_by: auth.user.id });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Receita atualizada");
      qc.invalidateQueries({ queryKey: ["medication_prescription_records"] });
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  const planMutation = useMutation({
    mutationFn: async (values: PlanForm) => {
      const family = await getMyFamily();
      const { data: auth } = await supabase.auth.getUser();
      if (!family || !auth.user) throw new Error("Sessão inválida");
      const db = supabase as any;
      const payload = {
        family_id: family.family_id,
        person_id: personId,
        medication_id: medication.id,
        prescription_id: values.prescription_id || null,
        prescription_record_id: record?.id ?? null,
        program: values.program || null,
        pickup_location: values.pickup_location || null,
        frequency: values.frequency,
        day_of_month: values.frequency === "monthly" ? integerOrNull(values.day_of_month) : null,
        interval_days: values.frequency === "interval_days" ? integerOrNull(values.interval_days) : null,
        next_pickup_date: values.next_pickup_date,
        usual_quantity: decimalOrNull(values.package_quantity),
        unit: values.package_unit,
        units_per_package: decimalOrNull(values.units_per_package),
        stock_unit: values.stock_unit,
        required_documents: values.required_documents,
        reminder_days: values.reminder_days,
        notes: values.notes || null,
        active: values.active,
        updated_by: auth.user.id,
      };

      if (!payload.next_pickup_date) throw new Error("Informe a próxima retirada");
      if (!payload.usual_quantity || payload.usual_quantity <= 0) {
        throw new Error("Informe uma quantidade de embalagens válida");
      }
      if (!payload.units_per_package || payload.units_per_package <= 0) {
        throw new Error("Informe quantas unidades existem em cada embalagem");
      }
      if (!payload.package_unit || !payload.stock_unit) throw new Error("Informe as unidades da retirada e do estoque");

      let planId = plan?.id ?? null;
      if (plan) {
        const { error } = await db.from("medication_pickup_plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { data, error } = await db
          .from("medication_pickup_plans")
          .insert({ ...payload, created_by: auth.user.id })
          .select("id")
          .single();
        if (error) throw error;
        planId = data.id;
      }

      if (planId) {
        await syncPickupCalendar({
          planId,
          existingEventId: plan?.calendar_event_id ?? null,
          values,
          medication,
          personId,
          familyId: family.family_id,
          userId: auth.user.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Plano de retirada salvo");
      qc.invalidateQueries({ queryKey: ["medication_pickup_plans"] });
      qc.invalidateQueries({ queryKey: ["calendar_events"] });
    },
    onError: (error) => toast.error(messageOf(error)),
  });

  return (
    <Tabs defaultValue="recipe" className="mt-2">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="recipe"><FileText className="mr-1 h-4 w-4" /> Receita</TabsTrigger>
        <TabsTrigger value="pickup"><CalendarClock className="mr-1 h-4 w-4" /> Retirada</TabsTrigger>
        <TabsTrigger value="history"><History className="mr-1 h-4 w-4" /> Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="recipe" className="mt-4">
        <RecordFormView
          key={record?.id ?? "new-record"}
          record={record}
          activePrescriptions={activePrescriptions}
          recipeDocuments={recipeDocuments}
          medication={medication}
          saving={recordMutation.isPending}
          onSave={(values) => recordMutation.mutate(values)}
        />
      </TabsContent>

      <TabsContent value="pickup" className="mt-4 space-y-4">
        <PlanFormView
          key={plan?.id ?? "new-plan"}
          plan={plan}
          record={record}
          activePrescriptions={activePrescriptions}
          medication={medication}
          personName={personName}
          saving={planMutation.isPending}
          onSave={(values) => planMutation.mutate(values)}
        />

        {plan && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/5 p-3">
            <div>
              <p className="font-medium">Próxima retirada: {fmtDate(plan.next_pickup_date)}</p>
              <p className="text-xs text-muted-foreground">
                {packagingSummary(plan.usual_quantity, plan.unit, plan.units_per_package, plan.stock_unit)}
                {plan.pickup_location ? ` · ${plan.pickup_location}` : ""}
              </p>
            </div>
            <Button onClick={() => setConfirming(true)}>
              <PackagePlus className="mr-1 h-4 w-4" /> Confirmar retirada
            </Button>
          </div>
        )}

        {plan && (
          <ConfirmPickupDialog
            open={confirming}
            onOpenChange={setConfirming}
            plan={plan}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["medication_pickups"] });
              qc.invalidateQueries({ queryKey: ["medication_pickup_plans"] });
              qc.invalidateQueries({ queryKey: ["medication_prescription_records"] });
              qc.invalidateQueries({ queryKey: ["stock"] });
              qc.invalidateQueries({ queryKey: ["calendar_events"] });
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        {!plan ? (
          <EmptyHistory text="Crie o plano de retirada para começar o histórico." />
        ) : pickups.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (pickups.data ?? []).length === 0 ? (
          <EmptyHistory text="Nenhuma retirada confirmada." />
        ) : (
          <div className="space-y-2">
            {(pickups.data ?? []).map((item) => {
              const packageQuantity = item.package_quantity ?? item.quantity;
              const packageUnit = item.package_unit ?? item.unit;
              const stockQuantity = item.stock_quantity ?? item.quantity;
              const stockUnit = item.stock_unit ?? item.unit;
              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {pluralizedQuantity(packageQuantity, packageUnit)}
                    </p>
                    <Badge variant="outline">{fmtDateTime(item.picked_up_at)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pluralizedQuantity(stockQuantity, stockUnit)} adicionados ao estoque
                    {item.location ? ` · ${item.location}` : ""}
                    {item.lot_number ? ` · lote ${item.lot_number}` : ""}
                    {item.expiry_date ? ` · validade ${fmtDate(item.expiry_date)}` : ""}
                  </p>
                  {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

type RecordForm = {
  prescription_id: string;
  document_id: string;
  issued_at: string;
  expires_at: string;
  doctor_name: string;
  crm: string;
  reference_number: string;
  continuous: boolean;
  controlled: boolean;
  quantity_per_pickup: string;
  quantity_unit: string;
  allowed_pickups: string;
  notes: string;
};

function RecordFormView({ record, activePrescriptions, recipeDocuments, medication, saving, onSave }: {
  record: MedicationPrescriptionRecord | null;
  activePrescriptions: Prescription[];
  recipeDocuments: any[];
  medication: Medication;
  saving: boolean;
  onSave: (values: RecordForm) => void;
}) {
  const [continuous, setContinuous] = useState(record?.continuous ?? true);
  const [controlled, setControlled] = useState(record?.controlled ?? false);
  const [prescriptionId, setPrescriptionId] = useState(record?.prescription_id ?? "none");
  const [documentId, setDocumentId] = useState(record?.document_id ?? "none");
  const status = prescriptionStatus(record);
  const allowed = record?.allowed_pickups ?? null;
  const remaining = record?.remaining_pickups ?? allowed;

  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      onSave({
        prescription_id: prescriptionId === "none" ? "" : prescriptionId,
        document_id: documentId === "none" ? "" : documentId,
        issued_at: text(form, "issued_at"),
        expires_at: text(form, "expires_at"),
        doctor_name: text(form, "doctor_name"),
        crm: text(form, "crm"),
        reference_number: text(form, "reference_number"),
        continuous,
        controlled,
        quantity_per_pickup: text(form, "quantity_per_pickup"),
        quantity_unit: text(form, "quantity_unit"),
        allowed_pickups: text(form, "allowed_pickups"),
        notes: text(form, "notes"),
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prescrição ativa relacionada">
          <Select value={prescriptionId} onValueChange={setPrescriptionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {activePrescriptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {prescriptionLabel(item, medication)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Arquivo de receita já cadastrado">
          <Select value={documentId} onValueChange={setDocumentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {recipeDocuments.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Emissão"><Input name="issued_at" type="date" defaultValue={record?.issued_at ?? ""} /></Field>
        <Field label="Validade da receita"><Input name="expires_at" type="date" defaultValue={record?.expires_at ?? ""} /></Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Médico"><Input name="doctor_name" defaultValue={record?.doctor_name ?? ""} /></Field>
        <Field label="CRM"><Input name="crm" defaultValue={record?.crm ?? ""} /></Field>
        <Field label="Número / referência"><Input name="reference_number" defaultValue={record?.reference_number ?? ""} /></Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleLine label="Uso contínuo" checked={continuous} onChange={setContinuous} />
        <ToggleLine label="Receita controlada" checked={controlled} onChange={setControlled} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Quantidade por retirada">
          <Input name="quantity_per_pickup" inputMode="decimal" min="0" defaultValue={record?.quantity_per_pickup ?? record?.authorized_quantity ?? ""} placeholder="Ex.: 1" />
        </Field>
        <Field label="Unidade">
          <Select name="quantity_unit" defaultValue={record?.quantity_unit ?? "caixa"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PACKAGE_UNITS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Retiradas autorizadas">
          <Input name="allowed_pickups" type="number" min="0" defaultValue={record?.allowed_pickups ?? ""} placeholder="Ex.: 6" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Status calculado</p>
          <Badge className="mt-1" variant={status.tone}>{status.label}</Badge>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Retiradas restantes</p>
          <p className="mt-1 font-semibold">
            {allowed === null ? "Sem limite informado" : `${remaining ?? allowed} de ${allowed}`}
          </p>
          <p className="text-xs text-muted-foreground">Calculado pelo histórico de retiradas.</p>
        </div>
      </div>

      <Field label="Observações"><Textarea name="notes" defaultValue={record?.notes ?? ""} /></Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar receita"}</Button>
      </div>
    </form>
  );
}

function prescriptionStatus(record: MedicationPrescriptionRecord | null): {
  label: string;
  tone: "default" | "secondary" | "destructive" | "outline";
} {
  if (!record) return { label: "Ainda não cadastrada", tone: "outline" };
  let status = record.status;
  if (status !== "cancelled" && status !== "archived") {
    if (record.allowed_pickups !== null && (record.remaining_pickups ?? record.allowed_pickups) <= 0) {
      status = "used";
    } else if (record.expires_at) {
      const expiration = new Date(`${record.expires_at}T23:59:59`);
      const days = Math.ceil((expiration.getTime() - Date.now()) / 86400000);
      if (days < 0) status = "expired";
      else if (days <= 30) status = "expiring";
      else if (record.allowed_pickups !== null && record.remaining_pickups !== null && record.remaining_pickups < record.allowed_pickups) status = "partially_used";
      else status = "valid";
    }
  }
  const labels: Record<MedicationPrescriptionRecord["status"], string> = {
    valid: "Válida",
    expiring: "Próxima do vencimento",
    expired: "Vencida",
    used: "Utilizada",
    partially_used: "Parcialmente utilizada",
    cancelled: "Cancelada",
    archived: "Arquivada",
  };
  return {
    label: labels[status],
    tone: status === "expired" || status === "cancelled"
      ? "destructive"
      : status === "expiring"
        ? "secondary"
        : "default",
  };
}

type PlanForm = {
  prescription_id: string;
  program: string;
  pickup_location: string;
  frequency: MedicationPickupPlan["frequency"];
  day_of_month: string;
  interval_days: string;
  next_pickup_date: string;
  package_quantity: string;
  package_unit: string;
  units_per_package: string;
  stock_unit: string;
  required_documents: string[];
  reminder_days: number[];
  notes: string;
  active: boolean;
};

function PlanFormView({ plan, record, activePrescriptions, medication, personName, saving, onSave }: {
  plan: MedicationPickupPlan | null;
  record: MedicationPrescriptionRecord | null;
  activePrescriptions: Prescription[];
  medication: Medication;
  personName: string;
  saving: boolean;
  onSave: (values: PlanForm) => void;
}) {
  const [frequency, setFrequency] = useState<MedicationPickupPlan["frequency"]>(plan?.frequency ?? "monthly");
  const [active, setActive] = useState(plan?.active ?? true);
  const [prescriptionId, setPrescriptionId] = useState(plan?.prescription_id ?? record?.prescription_id ?? "none");
  const [program, setProgram] = useState(plan?.program ?? "Farmácia municipal");
  const [pickupLocation, setPickupLocation] = useState(plan?.pickup_location ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(String(plan?.day_of_month ?? 22));
  const [intervalDays, setIntervalDays] = useState(String(plan?.interval_days ?? 30));
  const [manualDate, setManualDate] = useState(frequency === "custom");
  const [nextPickupDate, setNextPickupDate] = useState(
    plan?.next_pickup_date || calculateNextPickupDate(frequency, Number(plan?.day_of_month ?? 22), Number(plan?.interval_days ?? 30)),
  );
  const [packageQuantity, setPackageQuantity] = useState(String(plan?.usual_quantity ?? record?.quantity_per_pickup ?? 1));
  const [packageUnit, setPackageUnit] = useState(plan?.unit || record?.quantity_unit || "caixa");
  const [unitsPerPackage, setUnitsPerPackage] = useState(String(plan?.units_per_package ?? inferUnitsPerPackage(medication.presentation) ?? 1));
  const [stockUnit, setStockUnit] = useState(plan?.stock_unit || stockUnitForMedication(medication));
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>(
    plan?.required_documents?.length
      ? plan.required_documents
      : ["Documento com foto", "Receita", "Cartão SUS"],
  );
  const [customDocument, setCustomDocument] = useState("");
  const [reminderDays, setReminderDays] = useState<number[]>(plan?.reminder_days?.length ? plan.reminder_days : [7, 3, 1, 0]);
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const firstScheduleEffect = useRef(true);

  useEffect(() => {
    if (firstScheduleEffect.current) {
      firstScheduleEffect.current = false;
      return;
    }
    if (!manualDate && frequency !== "custom") {
      setNextPickupDate(calculateNextPickupDate(frequency, Number(dayOfMonth), Number(intervalDays)));
    }
  }, [frequency, dayOfMonth, intervalDays, manualDate]);

  useEffect(() => {
    if (packageUnit === "comprimido" || packageUnit === "cápsula" || packageUnit === "ampola" || packageUnit === "sachê") {
      if (Number(unitsPerPackage) <= 0) setUnitsPerPackage("1");
    }
  }, [packageUnit, unitsPerPackage]);

  const selectedPrescription = activePrescriptions.find((item) => item.id === prescriptionId) ?? null;
  const recordState = prescriptionStatus(record);
  const totalStock = positiveNumber(packageQuantity) * positiveNumber(unitsPerPackage);
  const customDocuments = requiredDocuments.filter((item) => !DOCUMENT_OPTIONS.includes(item as any));

  function addCustomDocument() {
    const value = customDocument.trim();
    if (!value || requiredDocuments.includes(value)) return;
    setRequiredDocuments((current) => [...current, value]);
    setCustomDocument("");
  }

  function toggleDocument(value: string, checked: boolean) {
    setRequiredDocuments((current) => checked
      ? Array.from(new Set([...current, value]))
      : current.filter((item) => item !== value));
  }

  function toggleReminder(day: number) {
    setReminderDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day].sort((a, b) => b - a));
  }

  const recurrenceText = frequency === "monthly"
    ? `todo dia ${dayOfMonth || "?"} de cada mês`
    : frequency === "interval_days"
      ? `a cada ${intervalDays || "?"} dias`
      : frequency === "weekly"
        ? "semanalmente"
        : "em data personalizada";

  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      onSave({
        prescription_id: prescriptionId === "none" ? "" : prescriptionId,
        program,
        pickup_location: pickupLocation,
        frequency,
        day_of_month: dayOfMonth,
        interval_days: intervalDays,
        next_pickup_date: nextPickupDate,
        package_quantity: packageQuantity,
        package_unit: packageUnit,
        units_per_package: unitsPerPackage,
        stock_unit: stockUnit,
        required_documents: requiredDocuments,
        reminder_days: reminderDays,
        notes,
        active,
      });
    }}>
      <PrescriptionSummary record={record} status={recordState} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prescrição relacionada">
          <Select value={prescriptionId} onValueChange={setPrescriptionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {activePrescriptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>{prescriptionLabel(item, medication)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPrescription && (
            <p className="text-xs text-muted-foreground">
              {selectedPrescription.continuous ? "Uso contínuo" : "Tratamento temporário"}
              {selectedPrescription.reason ? ` · ${selectedPrescription.reason}` : ""}
            </p>
          )}
        </Field>

        <Field label="Programa">
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Farmácia Popular">Farmácia Popular</SelectItem>
              <SelectItem value="Farmácia municipal">Farmácia municipal</SelectItem>
              <SelectItem value="Unidade de saúde">Unidade de saúde</SelectItem>
              <SelectItem value="Convênio">Convênio</SelectItem>
              <SelectItem value="Farmácia particular">Farmácia particular</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Local da retirada">
        <Input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} placeholder="Ex.: UBS Jardim Central" />
        {plan?.pickup_location && pickupLocation !== plan.pickup_location && (
          <button type="button" className="text-xs text-primary underline" onClick={() => setPickupLocation(plan.pickup_location ?? "")}>
            Usar o último local salvo
          </button>
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Frequência">
          <Select value={frequency} onValueChange={(value) => {
            const nextFrequency = value as MedicationPickupPlan["frequency"];
            setFrequency(nextFrequency);
            setManualDate(nextFrequency === "custom");
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="interval_days">A cada X dias</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="custom">Personalizada</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {frequency === "monthly" && (
          <Field label="Dia habitual">
            <Input type="number" min="1" max="31" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
          </Field>
        )}
        {frequency === "interval_days" && (
          <Field label="Intervalo em dias">
            <Input type="number" min="1" value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} />
          </Field>
        )}

        <Field label="Próxima retirada">
          <Input
            type="date"
            required
            value={nextPickupDate}
            readOnly={!manualDate && frequency !== "custom"}
            onChange={(event) => setNextPickupDate(event.target.value)}
            className={!manualDate && frequency !== "custom" ? "bg-muted/40" : ""}
          />
        </Field>
      </div>

      {frequency !== "custom" && (
        <ToggleLine
          label="Alterar somente esta próxima data"
          checked={manualDate}
          onChange={(checked) => {
            setManualDate(checked);
            if (!checked) setNextPickupDate(calculateNextPickupDate(frequency, Number(dayOfMonth), Number(intervalDays)));
          }}
        />
      )}

      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">Quantidade recebida</p>
            <p className="text-xs text-muted-foreground">Separe as embalagens do total que entrará no estoque.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Quantidade de embalagens">
            <Input inputMode="decimal" required value={packageQuantity} onChange={(event) => setPackageQuantity(event.target.value)} />
          </Field>
          <Field label="Tipo de embalagem">
            <Select value={packageUnit} onValueChange={setPackageUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PACKAGE_UNITS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Unidades por embalagem">
            <Input inputMode="decimal" required value={unitsPerPackage} onChange={(event) => setUnitsPerPackage(event.target.value)} />
          </Field>
          <Field label="Unidade no estoque">
            <Select value={stockUnit} onValueChange={setStockUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STOCK_UNITS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
          Entrarão no estoque: <strong>{pluralizedQuantity(totalStock, stockUnit)}</strong>.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Documentos necessários</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOCUMENT_OPTIONS.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={requiredDocuments.includes(option)}
                onCheckedChange={(checked) => toggleDocument(option, checked === true)}
              />
              {option}
            </label>
          ))}
        </div>
        {customDocuments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customDocuments.map((item) => (
              <Badge key={item} variant="secondary" className="gap-1 py-1.5">
                {item}
                <button type="button" aria-label={`Remover ${item}`} onClick={() => toggleDocument(item, false)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={customDocument}
            onChange={(event) => setCustomDocument(event.target.value)}
            placeholder="Outro documento necessário"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomDocument();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustomDocument}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Lembretes</Label>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={reminderDays.includes(day) ? "default" : "outline"}
              onClick={() => toggleReminder(day)}
            >
              {reminderLabel(day)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Você pode selecionar mais de um lembrete.</p>
      </div>

      <Field label="Observações">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <ToggleLine label="Plano ativo" checked={active} onChange={setActive} />

      <div className="rounded-xl border bg-primary/5 p-4">
        <p className="mb-1 text-sm font-semibold">Resumo do plano</p>
        <p className="text-sm">
          <strong>{personName}</strong> retira <strong>{medicationDisplayName(medication)}</strong> {recurrenceText}.
        </p>
        <p className="text-sm">
          Quantidade habitual: <strong>{packagingSummary(positiveNumber(packageQuantity), packageUnit, positiveNumber(unitsPerPackage), stockUnit)}</strong>.
        </p>
        <p className="text-sm">Próxima retirada: <strong>{nextPickupDate ? fmtDate(nextPickupDate) : "não definida"}</strong>.</p>
        <p className="text-sm">Lembretes: <strong>{reminderDays.length ? reminderDays.map(reminderLabel).join(", ") : "nenhum"}</strong>.</p>
        {recordState.label === "Vencida" && (
          <div className="mt-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            A receita está vencida. O plano pode ser salvo, mas renove a receita antes da retirada.
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar plano"}</Button>
      </div>
    </form>
  );
}

function PrescriptionSummary({ record, status }: {
  record: MedicationPrescriptionRecord | null;
  status: ReturnType<typeof prescriptionStatus>;
}) {
  if (!record) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Nenhuma receita foi relacionada. Cadastre a receita na aba anterior para acompanhar validade e retiradas restantes.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Receita relacionada</p>
        <p className="text-xs text-muted-foreground">
          {record.expires_at ? `Válida até ${fmtDate(record.expires_at)}` : "Sem validade informada"}
          {record.allowed_pickups !== null ? ` · ${record.remaining_pickups ?? record.allowed_pickups} de ${record.allowed_pickups} retiradas restantes` : ""}
        </p>
      </div>
      <Badge variant={status.tone}>{status.label}</Badge>
    </div>
  );
}

function ConfirmPickupDialog({ open, onOpenChange, plan, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MedicationPickupPlan;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [packageQuantity, setPackageQuantity] = useState(String(plan.usual_quantity));
  const [packageUnit, setPackageUnit] = useState(plan.unit);
  const [unitsPerPackage, setUnitsPerPackage] = useState(String(plan.units_per_package ?? 1));
  const [stockUnit, setStockUnit] = useState(plan.stock_unit || plan.unit);

  useEffect(() => {
    if (!open) return;
    setPackageQuantity(String(plan.usual_quantity));
    setPackageUnit(plan.unit);
    setUnitsPerPackage(String(plan.units_per_package ?? 1));
    setStockUnit(plan.stock_unit || plan.unit);
  }, [open, plan]);

  const totalStock = positiveNumber(packageQuantity) * positiveNumber(unitsPerPackage);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const { error } = await (supabase as any).rpc("confirm_medication_pickup_v2", {
        _plan_id: plan.id,
        _picked_up_at: new Date(text(form, "picked_up_at") || new Date().toISOString()).toISOString(),
        _package_quantity: decimalOrNull(packageQuantity),
        _package_unit: packageUnit,
        _units_per_package: decimalOrNull(unitsPerPackage),
        _stock_unit: stockUnit,
        _lot_number: text(form, "lot_number") || null,
        _expiry_date: text(form, "expiry_date") || null,
        _location: text(form, "location") || null,
        _notes: text(form, "notes") || null,
      });
      if (error) throw error;
      toast.success("Retirada confirmada e estoque atualizado");
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Confirmar retirada</DialogTitle>
            <DialogDescription>A quantidade só entra no estoque depois desta confirmação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Field label="Data e horário"><Input name="picked_up_at" type="datetime-local" defaultValue={localDateTimeNow()} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade recebida">
                <Input inputMode="decimal" required value={packageQuantity} onChange={(event) => setPackageQuantity(event.target.value)} />
              </Field>
              <Field label="Tipo de embalagem">
                <Select value={packageUnit} onValueChange={setPackageUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PACKAGE_UNITS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidades por embalagem">
                <Input inputMode="decimal" required value={unitsPerPackage} onChange={(event) => setUnitsPerPackage(event.target.value)} />
              </Field>
              <Field label="Unidade no estoque">
                <Select value={stockUnit} onValueChange={setStockUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STOCK_UNITS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <p className="rounded-lg bg-muted/40 p-3 text-sm">
              Total que entrará no estoque: <strong>{pluralizedQuantity(totalStock, stockUnit)}</strong>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lote"><Input name="lot_number" /></Field>
              <Field label="Validade"><Input name="expiry_date" type="date" /></Field>
            </div>
            <Field label="Local"><Input name="location" defaultValue={plan.pickup_location ?? ""} /></Field>
            <Field label="Observações"><Textarea name="notes" /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Confirmando..." : "Confirmar e adicionar ao estoque"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function syncPickupCalendar({ planId, existingEventId, values, medication, personId, familyId, userId }: {
  planId: string;
  existingEventId: string | null;
  values: PlanForm;
  medication: Medication;
  personId: string;
  familyId: string;
  userId: string;
}) {
  const db = supabase as any;
  const startsAt = new Date(`${values.next_pickup_date}T09:00:00`).toISOString();
  const payload = {
    person_id: personId,
    type: "retirada_medicamento",
    title: `Retirar ${medication.name}`,
    starts_at: startsAt,
    all_day: true,
    location: values.pickup_location || null,
    status: "agendado",
    related_kind: "medication_pickup_plan",
    related_id: planId,
    archived_at: values.active ? null : new Date().toISOString(),
  };
  if (existingEventId) {
    const { error } = await db.from("calendar_events").update(payload).eq("id", existingEventId);
    if (error) throw error;
  } else {
    const { data, error } = await db
      .from("calendar_events")
      .insert({ ...payload, family_id: familyId, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    const { error: linkError } = await db
      .from("medication_pickup_plans")
      .update({ calendar_event_id: data.id })
      .eq("id", planId);
    if (linkError) throw linkError;
  }
}

function calculateNextPickupDate(
  frequency: MedicationPickupPlan["frequency"],
  dayOfMonth: number,
  intervalDays: number,
  from = new Date(),
) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (frequency === "monthly") {
    const safeDay = Number.isFinite(dayOfMonth) && dayOfMonth > 0 ? Math.min(dayOfMonth, 31) : 1;
    let year = today.getFullYear();
    let month = today.getMonth();
    let target = dateForMonthDay(year, month, safeDay);
    if (target < today) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      target = dateForMonthDay(year, month, safeDay);
    }
    return toDateInput(target);
  }
  if (frequency === "interval_days") {
    const target = new Date(today);
    target.setDate(target.getDate() + (Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : 30));
    return toDateInput(target);
  }
  if (frequency === "weekly") {
    const target = new Date(today);
    target.setDate(target.getDate() + 7);
    return toDateInput(target);
  }
  return "";
}

function dateForMonthDay(year: number, month: number, desiredDay: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(desiredDay, lastDay));
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inferUnitsPerPackage(presentation: string | null) {
  if (!presentation) return null;
  const match = presentation.match(/(?:com|c\/|caixa de|cartela de)\s*(\d+(?:[.,]\d+)?)/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function stockUnitForMedication(medication: Medication) {
  const form = (medication.form_other || medication.form || "").toLowerCase();
  if (form.includes("comprim")) return "comprimido";
  if (form.includes("cáps") || form.includes("caps")) return "cápsula";
  if (form.includes("pastilha")) return "pastilha";
  if (form.includes("sach")) return "sachê";
  if (form.includes("gota")) return "gota";
  if (form.includes("ampola") || form.includes("inje")) return "ampola";
  if (form.includes("solução") || form.includes("xarope") || form.includes("líqu")) return "mL";
  return "unidade";
}

function prescriptionLabel(item: Prescription, medication: Medication) {
  return `${medicationDisplayName(medication)} · ${item.dose_amount} ${item.dose_unit} ${formatTimes(item.times)}`;
}

function formatTimes(times: string[]) {
  if (!times?.length) return "· sem horário";
  const labels = times.map((time) => time.slice(0, 5));
  return `às ${labels.join(" e ")}`;
}

function medicationDisplayName(medication: Medication) {
  const concentration = medication.concentration_value
    ? ` ${medication.concentration_value}${medication.concentration_unit ? ` ${medication.concentration_unit}` : ""}`
    : medication.concentration
      ? ` ${medication.concentration}`
      : "";
  return `${medication.name}${concentration}`;
}

function packagingSummary(
  packageQuantity: number,
  packageUnit: string,
  unitsPerPackage?: number | null,
  stockUnit?: string | null,
) {
  const packages = pluralizedQuantity(packageQuantity, packageUnit);
  if (!unitsPerPackage || !stockUnit) return packages;
  return `${packages} de ${pluralizedQuantity(unitsPerPackage, stockUnit)}`;
}

function pluralizedQuantity(quantity: number, unit: string) {
  const normalized = unit || "unidade";
  return `${formatNumber(quantity)} ${pluralizeUnit(normalized, quantity)}`;
}

function pluralizeUnit(unit: string, quantity: number) {
  if (quantity === 1) return unit;
  const irregular: Record<string, string> = {
    cápsula: "cápsulas",
    caixa: "caixas",
    cartela: "cartelas",
    frasco: "frascos",
    pacote: "pacotes",
    ampola: "ampolas",
    caneta: "canetas",
    bisnaga: "bisnagas",
    sachê: "sachês",
    comprimido: "comprimidos",
    pastilha: "pastilhas",
    gota: "gotas",
    dose: "doses",
    unidade: "unidades",
    mL: "mL",
  };
  return irregular[unit] ?? (unit.endsWith("s") ? unit : `${unit}s`);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value || 0);
}

function reminderLabel(day: number) {
  if (day === 0) return "No dia";
  return `${day} ${day === 1 ? "dia" : "dias"} antes`;
}

function positiveNumber(value: string | number | null | undefined) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function ToggleLine({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function EmptyHistory({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
      {text}
    </div>
  );
}

function text(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function decimalOrNull(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value: string) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : null;
}

function localDateTimeNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as any).message);
  return "Erro ao salvar";
}
