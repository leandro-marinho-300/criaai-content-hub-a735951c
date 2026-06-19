import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, ListTodo, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarFilters, type FiltersValue } from "@/components/calendar/calendar-filters";
import { CalendarMonth } from "@/components/calendar/calendar-month";
import { CalendarWeek } from "@/components/calendar/calendar-week";
import { CalendarAgenda } from "@/components/calendar/calendar-agenda";
import { UndatedPanel } from "@/components/calendar/undated-panel";
import { ScheduleDrawer } from "@/components/calendar/schedule-drawer";
import { ScheduleFormDialog } from "@/components/calendar/schedule-form-dialog";
import { RescheduleDialog } from "@/components/calendar/reschedule-dialog";
import { listScheduleItems, rescheduleItem, type ScheduleItemWithRels } from "@/lib/scheduleQueries";
import { MONTH_NAMES, addDays, startOfWeek, effectiveDate, type ScheduleStatus, type ChannelKind, type ApprovalStatus } from "@/lib/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/calendar")({
  head: () => ({ meta: [{ title: "Calendário — Cria Aí" }] }),
  component: CalendarPage,
});

type ViewKey = "month" | "week" | "agenda";

const VIEW_STORAGE_KEY = "cria-calendar-view";
const COLOR_STORAGE_KEY = "cria-calendar-colorby";

function loadViewPref(): ViewKey {
  if (typeof window === "undefined") return "month";
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "week" || v === "agenda" ? v : "month";
}
function loadColorPref(): "status" | "brand" {
  if (typeof window === "undefined") return "status";
  const v = window.localStorage.getItem(COLOR_STORAGE_KEY);
  return v === "brand" ? "brand" : "status";
}

function CalendarPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewKey>(loadViewPref);
  const [colorBy, setColorBy] = useState<"status" | "brand">(loadColorPref);
  const [cursor, setCursor] = useState(() => new Date());
  const [filters, setFilters] = useState<FiltersValue>({ brandId: "", channel: "", format: "", status: "", approval: "" });
  const [drawerItem, setDrawerItem] = useState<ScheduleItemWithRels | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newInitial, setNewInitial] = useState<{ date?: string | null; projectId?: string | null }>({});
  const [resched, setResched] = useState<{ item: ScheduleItemWithRels; date: string } | null>(null);

  useEffect(() => { try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch {} }, [view]);
  useEffect(() => { try { localStorage.setItem(COLOR_STORAGE_KEY, colorBy); } catch {} }, [colorBy]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["schedule-items", filters],
    queryFn: () => listScheduleItems({
      brandId: filters.brandId || undefined,
      channel: (filters.channel as ChannelKind) || undefined,
      format: filters.format || undefined,
      status: (filters.status as ScheduleStatus) || undefined,
      approval: (filters.approval as ApprovalStatus) || undefined,
    }),
  });

  const filteredItems = useMemo(() => items, [items]);

  const reschedMut = useMutation({
    mutationFn: async (input: { item: ScheduleItemWithRels; date: string; time: string | null }) =>
      rescheduleItem(input.item, input.date, input.time),
    onSuccess: () => {
      toast.success("Publicação reagendada.");
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
      qc.invalidateQueries({ queryKey: ["dashboard-schedule"] });
    },
    onError: (e: Error) => toast.error("Falha ao reagendar", { description: e.message }),
  });

  function handleDropOnDay(dayIso: string, payload: string) {
    const [kind, id] = payload.split(":");
    if (kind === "item") {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      const currentDate = effectiveDate(item);
      if (currentDate === dayIso) return;
      setResched({ item, date: dayIso });
    } else if (kind === "project") {
      setNewInitial({ date: dayIso, projectId: id });
      setNewOpen(true);
    }
  }

  function handleDropOnSlot(dayIso: string, hour: number, payload: string) {
    const [kind, id] = payload.split(":");
    const time = `${String(hour).padStart(2, "0")}:00`;
    if (kind === "item") {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      reschedMut.mutate({ item, date: dayIso, time });
    } else if (kind === "project") {
      setNewInitial({ date: dayIso, projectId: id });
      setNewOpen(true);
    }
  }

  function navigatePrev() {
    setCursor((c) => view === "week" ? addDays(c, -7) : new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function navigateNext() {
    setCursor((c) => view === "week" ? addDays(c, 7) : new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }
  function navigateToday() { setCursor(new Date()); }

  const headerLabel = view === "week"
    ? `Semana de ${startOfWeek(cursor).getDate()}/${startOfWeek(cursor).getMonth() + 1}`
    : `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Calendário</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigateToday}>Hoje</Button>
          <div className="flex">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-r-none" onClick={navigatePrev} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-l-none border-l-0" onClick={navigateNext} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <p className="text-sm font-medium px-2">{headerLabel}</p>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <TabsList>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={colorBy} onValueChange={(v) => setColorBy(v as "status" | "brand")}>
            <SelectTrigger className="w-[150px] h-9"><Palette className="mr-1 h-3 w-3" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Cor por status</SelectItem>
              <SelectItem value="brand">Cor por marca</SelectItem>
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1"><ListTodo className="h-4 w-4" />Conteúdos sem data</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-sm">
              <SheetHeader><SheetTitle>Conteúdos sem data</SheetTitle></SheetHeader>
              <div className="mt-4">
                <UndatedPanel onPick={(pid) => { setNewInitial({ projectId: pid }); setNewOpen(true); }} />
              </div>
            </SheetContent>
          </Sheet>
          <Button size="sm" className="gap-1" onClick={() => { setNewInitial({}); setNewOpen(true); }}>
            <Plus className="h-4 w-4" />Nova publicação
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-3">
          <CalendarFilters value={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !filteredItems.length && view !== "agenda" ? (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-3 p-10 text-center">
            <h2 className="text-lg font-semibold">Seu calendário ainda está vazio</h2>
            <p className="text-sm text-muted-foreground">Adicione conteúdos existentes ou crie uma nova publicação.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setNewInitial({}); setNewOpen(true); }}>Criar publicação</Button>
            </div>
          </CardContent>
        </Card>
      ) : view === "month" ? (
        <CalendarMonth cursor={cursor} items={filteredItems} colorBy={colorBy} onSelect={setDrawerItem} onDropOnDay={handleDropOnDay} />
      ) : view === "week" ? (
        <CalendarWeek cursor={cursor} items={filteredItems} colorBy={colorBy} onSelect={setDrawerItem} onDropOnSlot={handleDropOnSlot} />
      ) : (
        <CalendarAgenda items={filteredItems} colorBy={colorBy} onSelect={setDrawerItem} />
      )}

      <ScheduleDrawer item={drawerItem} open={!!drawerItem} onOpenChange={(v) => !v && setDrawerItem(null)} />
      <ScheduleFormDialog open={newOpen} onOpenChange={setNewOpen} initialDate={newInitial.date ?? null} initialProjectId={newInitial.projectId ?? null} />
      {resched && (
        <RescheduleDialog
          open={!!resched}
          onOpenChange={(v) => !v && setResched(null)}
          fromDate={effectiveDate(resched.item)}
          fromTime={resched.item.confirmed_time ?? resched.item.suggested_time ?? null}
          toDate={resched.date}
          defaultTime={resched.item.confirmed_time ?? resched.item.suggested_time ?? "09:00"}
          onConfirm={(time) => {
            reschedMut.mutate({ item: resched.item, date: resched.date, time });
            setResched(null);
          }}
        />
      )}
    </div>
  );
}
