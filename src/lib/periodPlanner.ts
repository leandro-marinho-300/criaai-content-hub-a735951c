// Distribuição determinística de publicações em um período.
// Sem IA, sem promessas de "melhor horário" — apenas espalha pelos dias/horários
// preferidos respeitando frequência máxima.
import { addDays, isoDay } from "./calendar";

export interface PlanInput {
  start: Date;
  end: Date;
  itemCount: number;
  allowedWeekdays: number[]; // 0..6
  preferredTimes: string[];  // "HH:mm"
  maxPerDay: number;
  minIntervalHours: number;
}

export interface PlannedSlot {
  date: string;  // yyyy-mm-dd
  time: string;  // HH:mm
}

export function planPeriod(input: PlanInput): PlannedSlot[] {
  const slots: PlannedSlot[] = [];
  if (input.itemCount <= 0) return slots;
  if (!input.allowedWeekdays.length || !input.preferredTimes.length) return slots;

  const totalDays = Math.max(1, Math.round((input.end.getTime() - input.start.getTime()) / 86400000));
  const sortedTimes = [...input.preferredTimes].sort();
  const lastUsed: { date: string; minutes: number } | null = null;
  let lastDate: string | null = null;
  let lastMinutes = -Infinity;

  let dayOffset = 0;
  let timeIndex = 0;
  let perDayCount = 0;

  while (slots.length < input.itemCount && dayOffset <= totalDays + 365) {
    const day = addDays(input.start, dayOffset);
    const wd = day.getDay();
    if (!input.allowedWeekdays.includes(wd)) {
      dayOffset++;
      timeIndex = 0;
      perDayCount = 0;
      continue;
    }
    if (perDayCount >= input.maxPerDay) {
      dayOffset++;
      timeIndex = 0;
      perDayCount = 0;
      continue;
    }
    if (timeIndex >= sortedTimes.length) {
      dayOffset++;
      timeIndex = 0;
      perDayCount = 0;
      continue;
    }
    const time = sortedTimes[timeIndex];
    const date = isoDay(day);
    const minutes = toMinutes(time);
    const intervalOk =
      lastDate !== date ||
      input.minIntervalHours <= 0 ||
      minutes - lastMinutes >= input.minIntervalHours * 60;
    if (!intervalOk) {
      timeIndex++;
      continue;
    }
    slots.push({ date, time });
    lastDate = date;
    lastMinutes = minutes;
    perDayCount++;
    timeIndex++;
  }
  return slots;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
