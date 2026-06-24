import { differenceInDays, parseISO, isWithinInterval, addDays } from "date-fns";
import type {
  StockLot, Prescription, Medication, Person, CalendarEvent, NotificationRead, Exam, MedicationPickupPlan, MedicationPrescriptionRecord,
} from "@/lib/queries";

export type DerivedNotification = {
  key: string;
  category: "stock_low" | "expiry" | "prescription_renewal" | "appointment" | "event" | "exam_result" | "medication_pickup";
  title: string;
  description: string;
  personId: string | null;
  route: { to: string; search?: Record<string, unknown>; params?: Record<string, string> };
  when: Date;
  severity: "info" | "warning" | "danger";
};

export function deriveNotifications(input: {
  people: Person[];
  meds: Medication[];
  lots: StockLot[];
  prescriptions: Prescription[];
  events: CalendarEvent[];
  exams: Exam[];
  pickupPlans: MedicationPickupPlan[];
  prescriptionRecords: MedicationPrescriptionRecord[];
}): DerivedNotification[] {
  const out: DerivedNotification[] = [];
  const now = new Date();
  const personById = new Map(input.people.map((p) => [p.id, p]));
  const medById = new Map(input.meds.map((m) => [m.id, m]));

  // Stock low (one alert per lot, ignore archived)
  for (const lot of input.lots) {
    if (lot.archived_at) continue;
    if (lot.quantity <= lot.min_threshold && lot.quantity >= 0) {
      const med = medById.get(lot.medication_id);
      out.push({
        key: `stock_low:${lot.id}:${lot.quantity}`,
        category: "stock_low",
        title: `Estoque baixo: ${med?.name ?? "medicamento"}`,
        description: `Restam ${lot.quantity} ${lot.unit} (mínimo ${lot.min_threshold}).`,
        personId: lot.person_id,
        route: { to: "/app/estoque", search: { filter: "low" } },
        when: now,
        severity: "warning",
      });
    }
  }

  // Expiry alerts
  for (const lot of input.lots) {
    if (lot.archived_at || !lot.expiry_date || lot.quantity <= 0) continue;
    const days = differenceInDays(parseISO(lot.expiry_date), now);
    const med = medById.get(lot.medication_id);
    if (days < 0) {
      out.push({
        key: `expired:${lot.id}`,
        category: "expiry",
        title: `Vencido: ${med?.name ?? "medicamento"}`,
        description: `Vencimento em ${lot.expiry_date}.`,
        personId: lot.person_id,
        route: { to: "/app/estoque", search: { filter: "expired" } },
        when: now,
        severity: "danger",
      });
    } else if (days <= 30) {
      out.push({
        key: `expiring:${lot.id}:${days}`,
        category: "expiry",
        title: `Vence em ${days} ${days === 1 ? "dia" : "dias"}: ${med?.name ?? "medicamento"}`,
        description: `Lote vence em ${lot.expiry_date}.`,
        personId: lot.person_id,
        route: { to: "/app/estoque", search: { filter: "expiring" } },
        when: now,
        severity: "warning",
      });
    }
  }

  // Prescription ending soon
  for (const rx of input.prescriptions) {
    if (rx.status !== "active" || !rx.end_date) continue;
    const days = differenceInDays(parseISO(rx.end_date), now);
    if (days >= 0 && days <= 7) {
      const med = medById.get(rx.medication_id);
      const person = personById.get(rx.person_id);
      out.push({
        key: `rx_ending:${rx.id}:${days}`,
        category: "prescription_renewal",
        title: `Receita termina em ${days} ${days === 1 ? "dia" : "dias"}`,
        description: `${person?.full_name ?? ""} — ${med?.name ?? ""}. Agendar renovação?`,
        personId: rx.person_id,
        route: { to: "/app/familia/$personId", params: { personId: rx.person_id } },
        when: now,
        severity: "info",
      });
    }
  }

  // Prescription document expiry linked to a person and medication.
  for (const record of input.prescriptionRecords) {
    if (record.archived_at || !record.expires_at || ["cancelled", "archived"].includes(record.status)) continue;
    const days = differenceInDays(parseISO(record.expires_at), now);
    if (days > 30) continue;
    const med = medById.get(record.medication_id);
    const person = personById.get(record.person_id);
    out.push({
      key: `medication_recipe_expiry:${record.id}:${record.expires_at}`,
      category: "prescription_renewal",
      title: days < 0
        ? `Receita vencida: ${med?.name ?? "medicamento"}`
        : days === 0
          ? `Receita vence hoje: ${med?.name ?? "medicamento"}`
          : `Receita vence em ${days} ${days === 1 ? "dia" : "dias"}`,
      description: `${person?.preferred_name || person?.full_name || "Pessoa"} • confira a renovação da receita.`,
      personId: record.person_id,
      route: { to: "/app/medicamentos" },
      when: parseISO(record.expires_at),
      severity: days < 0 ? "danger" : days <= 7 ? "warning" : "info",
    });
  }

  // Recurring medication pickups.
  for (const plan of input.pickupPlans) {
    if (!plan.active || !plan.next_pickup_date) continue;
    const days = differenceInDays(parseISO(plan.next_pickup_date), now);
    const configured = plan.reminder_days?.length ? plan.reminder_days : [7, 3, 1, 0];
    if (days > 7 || (days >= 0 && !configured.includes(days))) continue;
    const med = medById.get(plan.medication_id);
    const person = personById.get(plan.person_id);
    const overdue = days < 0;
    out.push({
      key: `medication_pickup:${plan.id}:${plan.next_pickup_date}`,
      category: "medication_pickup",
      title: overdue
        ? `Retirada atrasada: ${med?.name ?? "medicamento"}`
        : days === 0
          ? `Retirar hoje: ${med?.name ?? "medicamento"}`
          : `Retirada em ${days} ${days === 1 ? "dia" : "dias"}: ${med?.name ?? "medicamento"}`,
      description: `${person?.preferred_name || person?.full_name || "Pessoa"}${plan.pickup_location ? ` • ${plan.pickup_location}` : ""}${plan.usual_quantity ? ` • ${plan.usual_quantity} ${plan.unit}${plan.units_per_package && plan.stock_unit ? ` de ${plan.units_per_package} ${plan.stock_unit}` : ""}` : ""}`,
      personId: plan.person_id,
      route: { to: "/app/medicamentos" },
      when: parseISO(plan.next_pickup_date),
      severity: overdue ? "danger" : days <= 1 ? "warning" : "info",
    });
  }

  // Exam dossier pendencies. These are derived from persisted dates/statuses,
  // so they work in the internal notification center without creating duplicates.
  for (const exam of input.exams) {
    if (exam.archived_at || ["cancelado", "concluido"].includes(exam.status)) continue;
    const person = personById.get(exam.person_id);
    const personName = person?.preferred_name || person?.full_name || "Pessoa";
    const route = { to: "/app/exames/$examId", params: { examId: exam.id } };

    if (["realizado", "aguardando_resultado"].includes(exam.status) && exam.result_expected_date) {
      const days = differenceInDays(parseISO(exam.result_expected_date), now);
      if (days < 0) {
        out.push({
          key: `exam_result_overdue:${exam.id}:${exam.result_expected_date}`,
          category: "exam_result",
          title: `Resultado pendente: ${exam.name}`,
          description: `${personName} • a previsão era ${exam.result_expected_date}.`,
          personId: exam.person_id,
          route,
          when: now,
          severity: "warning",
        });
      } else if (days <= 3) {
        out.push({
          key: `exam_result_expected:${exam.id}:${exam.result_expected_date}`,
          category: "exam_result",
          title: days === 0 ? `Resultado previsto para hoje: ${exam.name}` : `Resultado previsto em ${days} ${days === 1 ? "dia" : "dias"}`,
          description: `${personName} • acompanhe a disponibilização do resultado.`,
          personId: exam.person_id,
          route,
          when: parseISO(exam.result_expected_date),
          severity: "info",
        });
      }
    }

    if (exam.status === "resultado_disponivel" && !exam.result_picked_up_at) {
      out.push({
        key: `exam_result_available:${exam.id}:${exam.result_available_date ?? exam.updated_at}`,
        category: "exam_result",
        title: `Resultado disponível: ${exam.name}`,
        description: `${personName} • retire ou baixe o resultado e registre no dossiê.`,
        personId: exam.person_id,
        route,
        when: exam.result_available_date ? parseISO(exam.result_available_date) : now,
        severity: "warning",
      });
    }

    if (!exam.result_picked_up_at && exam.result_pickup_deadline) {
      const days = differenceInDays(parseISO(exam.result_pickup_deadline), now);
      if (days >= 0 && days <= 7) {
        out.push({
          key: `exam_pickup_deadline:${exam.id}:${exam.result_pickup_deadline}`,
          category: "exam_result",
          title: days === 0 ? `Último dia para retirar: ${exam.name}` : `Prazo de retirada em ${days} ${days === 1 ? "dia" : "dias"}`,
          description: `${personName} • confira protocolo e local de retirada.`,
          personId: exam.person_id,
          route,
          when: parseISO(exam.result_pickup_deadline),
          severity: days <= 1 ? "danger" : "warning",
        });
      }
    }

    if (exam.status === "resultado_retirado" && !exam.result_attached_at) {
      out.push({
        key: `exam_result_not_attached:${exam.id}:${exam.result_picked_up_at ?? exam.updated_at}`,
        category: "exam_result",
        title: `Resultado ainda não anexado: ${exam.name}`,
        description: `${personName} • adicione o PDF ou a imagem ao dossiê.`,
        personId: exam.person_id,
        route,
        when: exam.result_picked_up_at ? parseISO(exam.result_picked_up_at) : now,
        severity: "info",
      });
    }

    if (exam.status === "resultado_anexado" && !exam.presented_at) {
      out.push({
        key: `exam_result_not_presented:${exam.id}:${exam.result_attached_at ?? exam.updated_at}`,
        category: "exam_result",
        title: `Levar resultado ao médico: ${exam.name}`,
        description: `${personName} • o arquivo já está no dossiê.`,
        personId: exam.person_id,
        route,
        when: exam.result_attached_at ? parseISO(exam.result_attached_at) : now,
        severity: "info",
      });
    }
  }

  // Upcoming events in next 24h (non cancelados/concluídos)
  const horizon = addDays(now, 1);
  for (const ev of input.events) {
    if (ev.archived_at) continue;
    if (["cancelado", "concluido", "nao_compareceu"].includes(ev.status)) continue;
    const start = parseISO(ev.starts_at);
    if (isWithinInterval(start, { start: now, end: horizon })) {
      out.push({
        key: `event:${ev.id}`,
        category: ev.type === "consulta" || ev.type === "retorno" ? "appointment" : "event",
        title: ev.title,
        description: `${ev.type.replace("_", " ")} • ${start.toLocaleString("pt-BR")}`,
        personId: ev.person_id,
        route: { to: "/app/agenda" },
        when: start,
        severity: "info",
      });
    }
  }

  return out.sort((a, b) => (a.when < b.when ? -1 : 1));
}

export function mergeReadState(notes: DerivedNotification[], reads: NotificationRead[]) {
  const readSet = new Map(reads.map((r) => [r.dedupe_key, r]));
  return notes
    .filter((n) => !readSet.get(n.key)?.dismissed_at)
    .map((n) => ({ ...n, readAt: readSet.get(n.key)?.read_at ?? null }));
}
