import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Briefcase,
  FileText,
  CheckCircle2,
  Send,
  Heart,
  Image as ImageIcon,
  Layers,
  Smartphone,
  Film,
  MessageCircle,
  Info,
  ClipboardList,
  Wand2,
  Copy,
  Lightbulb,
  Sparkles,
  RefreshCw,
  ArrowRight,
  CalendarCheck,
  ShieldCheck,
  Clock3,
  Rocket,
  CheckCircle,
  PenLine,
  Eye,
  Compass,
  Star,
  FolderOpen,
} from "lucide-react";
import { listScheduleItems, getScheduleItemTitle } from "@/lib/scheduleQueries";
import { effectiveDate, effectiveTime, formatDateBR, STATUS_LABELS, computeIsOverdue, CHANNEL_LABELS, type ScheduleStatus, type ChannelKind } from "@/lib/calendar";
import { supabase } from "@/integrations/supabase/client";
import { getProjectDisplayTitle } from "@/lib/displayTitle";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/help-dialog";
import { ChooseIdeaFormatsDialog } from "@/components/choose-idea-formats-dialog";
import { quickIdea, type Idea } from "@/lib/ideaGenerator";
import type { Tables } from "@/integrations/supabase/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Início — Cria Aí" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [brandsRes, draftsRes, approvedRes, publishedRes, favRes, recentRes] = await Promise.all([
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("is_favorite", true),
        supabase.from("content_projects").select("id, internal_title, display_title, theme, main_message, status, updated_at, brand_id, brands(name)").order("updated_at", { ascending: false }).limit(6),
      ]);
      return {
        brands: brandsRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        published: publishedRes.count ?? 0,
        favorites: favRes.count ?? 0,
        recent: (recentRes.data ?? []) as Array<{
          id: string;
          internal_title: string | null;
          display_title: string | null;
          theme: string | null;
          main_message: string | null;
          status: string;
          updated_at: string;
          brand_id: string | null;
          brands: { name: string } | null;
        }>,
      };
    },
  });

  const recent = stats?.recent ?? [];
  const activeProjects = (stats?.drafts ?? 0) + (stats?.approved ?? 0);

  const headlineSignals = [
    { label: "Em produção", value: activeProjects, helper: "conteúdos para continuar", icon: Clock3, tone: "yellow" as const },
    { label: "Aprovados", value: stats?.approved ?? 0, helper: "prontos para organizar", icon: CheckCircle2, tone: "orange" as const },
    { label: "Publicados", value: stats?.published ?? 0, helper: "histórico reaproveitável", icon: Send, tone: "violet" as const },
  ];

  const flow = [
    {
      title: "Criar",
      desc: "Escolha marca, caminho e formato sem preencher tudo de uma vez.",
      action: "Começar pelo formato certo",
      icon: Sparkles,
      tone: "orange" as const,
    },
    {
      title: "Desenvolver",
      desc: "Monte roteiro, legenda, prompts visuais ou pacote multiformato.",
      action: "Produzir com método",
      icon: Wand2,
      tone: "violet" as const,
    },
    {
      title: "Revisar",
      desc: "Separe fala, texto na tela, CTA, hashtags e materiais de apoio.",
      action: "Conferir antes de enviar",
      icon: Eye,
      tone: "yellow" as const,
    },
    {
      title: "Aprovar",
      desc: "Envie um link claro para o cliente validar o pacote.",
      action: "Coletar decisão",
      icon: ShieldCheck,
      tone: "orange" as const,
    },
    {
      title: "Agendar",
      desc: "Defina data, canal e status de publicação no calendário.",
      action: "Organizar calendário",
      icon: CalendarCheck,
      tone: "violet" as const,
    },
    {
      title: "Publicar",
      desc: "Marque como publicado, arquive e reaproveite o que funcionou.",
      action: "Registrar conclusão",
      icon: Rocket,
      tone: "orange" as const,
    },
  ];

  const creationScenarios = [
    {
      title: "Criar Reel 2.0",
      desc: "Fluxo completo para promessa, gancho, roteiro, capa/frame e aprovação.",
      to: "/app/create/reel",
      icon: Film,
      badge: "Carro-chefe",
      tone: "orange" as const,
    },
    {
      title: "Criar conteúdo",
      desc: "Post, carrossel, story, status ou pacote multiformato com briefing guiado.",
      to: "/app/create",
      icon: PenLine,
      badge: "Guiado",
      tone: "violet" as const,
    },
    {
      title: "Estou sem ideias",
      desc: "Use contexto da marca para receber caminhos editoriais e temas.",
      to: "/app/ideas",
      icon: Lightbulb,
      badge: "Ideias",
      tone: "yellow" as const,
    },
    {
      title: "Seguir tendência",
      desc: "Pesquise sinais externos e transforme em briefing sem IA interna.",
      to: "/app/trends",
      icon: Compass,
      badge: "Pesquisa",
      tone: "violet" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="bg-studio-glow absolute inset-0 opacity-95" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-creative-violet bg-creative-violet-soft px-3 py-1 text-xs font-medium text-creative-violet">
              <Sparkles className="h-3.5 w-3.5" />
              Cria Aí 2.0 · Estúdio criativo guiado
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                Da ideia à publicação, com um fluxo claro.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                O Cria Aí guia a criação, revisão, aprovação e organização do conteúdo. Ele não finge ser editor visual
                nem publicador automático: você cria o pacote, aprova com clareza e marca a publicação no calendário.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" className="gap-2 rounded-full">
                <Link to="/app/create/reel">
                  <Film className="h-4 w-4" />
                  Criar Reel 2.0
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2 rounded-full bg-background/70">
                <Link to="/app/create">
                  <Plus className="h-4 w-4" />
                  Criar outro conteúdo
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="gap-2 rounded-full">
                <a href="#continuar-producao">
                  <FolderOpen className="h-4 w-4" />
                  Continuar produção
                </a>
              </Button>
            </div>
          </div>

          <Card className="border-creative-yellow bg-creative-yellow-soft shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--creative-yellow)] text-creative-yellow shadow-sm">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Promessa honesta do app</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Criamos roteiros, legendas, prompts e pacotes de aprovação. A arte final, o vídeo e a publicação entram como anexos ou status.
                </p>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="font-semibold">O Cria Aí ajuda</p>
                  <p className="text-muted-foreground">a estruturar conteúdo e organizar a produção.</p>
                </div>
                <div className="rounded-xl bg-background/70 p-3">
                  <p className="font-semibold">O Cria Aí não promete</p>
                  <p className="text-muted-foreground">postar automaticamente nem substituir um editor visual.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2 rounded-full">Fluxo de uso</Badge>
            <h2 className="text-2xl font-semibold">Como o Cria Aí conduz seu conteúdo</h2>
            <p className="text-sm text-muted-foreground">Uma jornada visual para não misturar criação, aprovação e publicação.</p>
          </div>
          <HelpDialog />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flow.map((item, index) => (
            <FlowPreviewCard key={item.title} index={index + 1} {...item} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="outline" className="mb-2 rounded-full">Comece pelo cenário</Badge>
              <h2 className="text-xl font-semibold">O que você quer fazer agora?</h2>
              <p className="text-sm text-muted-foreground">Escolha um caminho. Os detalhes aparecem só depois.</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/app/templates">
                Ver presets
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {creationScenarios.map((path) => (
              <HomeActionCard key={path.title} {...path} />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm">
          <div className="mb-4">
            <Badge variant="outline" className="mb-2 rounded-full">Hoje no estúdio</Badge>
            <h2 className="text-xl font-semibold">Onde sua atenção pode ir</h2>
            <p className="text-sm text-muted-foreground">Números compactos para ação, não para competir com a criação.</p>
          </div>
          <div className="grid gap-3">
            {headlineSignals.map((signal) => (
              <StudioSignalCard key={signal.label} {...signal} />
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Próximo passo sugerido</p>
            <p className="mt-1">Continue um rascunho ou resolva aprovações pendentes antes de criar novos conteúdos.</p>
          </div>
        </div>
      </section>

      <QuickIdeaBlock />

      <section id="continuar-producao" className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><FolderOpen className="h-4 w-4" />Continuar produção</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/library">Ver biblioteca</Link>
            </Button>
          </div>
          {recent.length ? (
            <div className="grid gap-3">
              {recent.slice(0, 4).map((project) => (
                <ProjectResumeCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-card/70">
              <CardContent className="grid place-items-center gap-2 p-8 text-center">
                <p className="text-sm text-muted-foreground">Você ainda não criou conteúdos.</p>
                <Button asChild size="sm"><Link to="/app/create">Criar o primeiro</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <ClientApprovalsSection />
          <UpcomingPublicationsSection />
        </div>
      </section>
    </div>
  );
}

function FlowPreviewCard({ index, title, desc, action, icon: Icon, tone }: { index: number; title: string; desc: string; action: string; icon: typeof Briefcase; tone: HomeTone }) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-background/60 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className="absolute right-4 top-4 opacity-10 transition-opacity group-hover:opacity-20">
        <Icon className="h-16 w-16" />
      </div>
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className={cn("grid h-9 w-9 place-items-center rounded-full border text-sm font-bold", toneClasses(tone))}>{index}</span>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{desc}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/70 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{action}</p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, 20 + index * 12)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioSignalCard({ label, value, helper, icon: Icon, tone }: { label: string; value: number; helper: string; icon: typeof Briefcase; tone: HomeTone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border", toneClasses(tone))}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{helper}</p>
      </div>
    </div>
  );
}

type HomeTone = "orange" | "yellow" | "violet";

function toneClasses(tone: HomeTone) {
  const map = {
    orange: "border-primary/35 bg-primary/10 text-primary",
    yellow: "border-creative-yellow bg-creative-yellow-soft text-creative-yellow",
    violet: "border-creative-violet bg-creative-violet-soft text-creative-violet",
  };
  return map[tone];
}

function HomeMetricCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Briefcase; tone: HomeTone }) {
  return (
    <Card className="border-border/60 bg-card/85 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border", toneClasses(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HomeActionCard({ title, desc, to, icon: Icon, badge, tone }: { title: string; desc: string; to: string; icon: typeof Briefcase; badge: string; tone: HomeTone }) {
  return (
    <Link
      to={to as any}
      className="group rounded-3xl border border-border/60 bg-card/85 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-11 w-11 place-items-center rounded-2xl border", toneClasses(tone))}>
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant="outline" className="rounded-full text-[11px]">{badge}</Badge>
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Começar
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function CreationFlowStep({ index, title, desc, icon: Icon }: { index: number; title: string; desc: string; icon: typeof Briefcase }) {
  return (
    <div className="relative rounded-2xl border border-border/60 bg-background/55 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p>
    </div>
  );
}

function ProjectResumeCard({ project }: { project: { id: string; internal_title: string | null; display_title: string | null; theme: string | null; main_message: string | null; status: string; updated_at: string; brand_id: string | null; brands: { name: string } | null } }) {
  const display = getProjectDisplayTitle(project);
  return (
    <Link
      to="/app/content/$projectId/result"
      params={{ projectId: project.id }}
      title={display}
      className="grid min-w-0 gap-3 rounded-2xl border border-border/60 bg-card/85 p-4 transition-colors hover:border-primary/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="line-clamp-2 break-words font-medium">{display}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{project.brands?.name ?? "Sem marca"}</p>
      </div>
      <Badge variant="outline" className="w-fit shrink-0 capitalize">{statusLabel(project.status)}</Badge>
    </Link>
  );
}

function ExampleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 border-b border-border/40 pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    {
      draft: "Rascunho",
      review: "Em revisão",
      approved: "Aprovado",
      published: "Publicado",
      archived: "Arquivado",
    }[s] ?? s
  );
}

function UpcomingPublicationsSection() {
  const { data } = useQuery({
    queryKey: ["dashboard-schedule"],
    queryFn: () => listScheduleItems(),
  });
  const items = data ?? [];
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const upcoming = items
    .filter((it) => {
      const d = effectiveDate(it);
      return d && d >= todayIso && it.schedule_status !== "publicado" && it.schedule_status !== "cancelado";
    })
    .sort((a, b) => {
      const da = `${effectiveDate(a)}T${effectiveTime(a) ?? "00:00"}`;
      const db = `${effectiveDate(b)}T${effectiveTime(b) ?? "00:00"}`;
      return da.localeCompare(db);
    })
    .slice(0, 5);

  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekIso = weekEnd.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const metrics = {
    scheduledWeek: items.filter((it) => { const d = effectiveDate(it); return d && d >= todayIso && d <= weekIso && it.schedule_status === "agendado"; }).length,
    waitingApproval: items.filter((it) => it.schedule_status === "aguardando_aprovacao").length,
    overdue: items.filter((it) => computeIsOverdue(it)).length,
    publishedMonth: items.filter((it) => it.schedule_status === "publicado" && (effectiveDate(it) ?? "") >= monthStart).length,
    noDate: items.filter((it) => it.schedule_status === "sem_data").length,
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarCheck className="h-4 w-4" />Próximas publicações</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/calendar">Ver calendário</Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MetricTile label="Agendadas esta semana" value={metrics.scheduledWeek} />
        <MetricTile label="Aguardando aprovação" value={metrics.waitingApproval} />
        <MetricTile label="Atrasadas" value={metrics.overdue} highlight={metrics.overdue > 0} />
        <MetricTile label="Publicadas no mês" value={metrics.publishedMonth} />
        <MetricTile label="Sem data" value={metrics.noDate} />
      </div>
      {upcoming.length ? (
        <div className="grid gap-2">
          {upcoming.map((it) => {
            const d = effectiveDate(it);
            const t = effectiveTime(it);
            const title = getScheduleItemTitle(it);
            const fmt = it.format ? FORMAT_LABELS[it.format] ?? it.format : null;
            const ch = it.channel ? CHANNEL_LABELS[it.channel as ChannelKind] ?? it.channel : null;
            return (
              <Link
                key={it.id}
                to="/app/calendar"
                title={title}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-sm font-medium">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d ? `${formatDateBR(d)}${t ? ` às ${t}` : ""} · ` : ""}{it.brands?.name ?? "Sem marca"}
                    {fmt ? ` · ${fmt}` : ""}{ch ? ` · ${ch}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{STATUS_LABELS[(it.schedule_status ?? "sem_data") as ScheduleStatus]}</Badge>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-2 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma publicação próxima.</p>
            <Button asChild size="sm" variant="outline"><Link to="/app/calendar">Abrir calendário</Link></Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function MetricTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-red-500/40" : "border-border/60"}>
      <CardContent className="p-3">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function QuickIdeaBlock() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [brandId, setBrandId] = useState<string>("");
  const [idea, setIdea] = useState<Idea | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [showFormatDialog, setShowFormatDialog] = useState(false);

  const { data: brands } = useQuery({
    queryKey: ["brands-light-dash"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").order("name");
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const generate = () => {
    const brand = brands?.find((b) => b.id === brandId);
    if (!brand) {
      toast.error("Selecione uma marca para gerar uma ideia.");
      return;
    }
    const next = quickIdea(brand, [...excluded, ...(idea ? [idea.title] : [])]);
    if (!next) {
      toast.error("Não há dados suficientes nesta marca para gerar uma ideia.");
      return;
    }
    if (idea) setExcluded((p) => [...p, idea.title]);
    setIdea(next);
  };

  const recommendedFormat = idea ? formatLabelToWizardKey(idea.recommended_format) : null;

  const useIt = () => {
    if (!idea || !brandId) return;
    setShowFormatDialog(true);
  };

  const continueWithFormats = (selectedFormats: string[]) => {
    if (!idea || !brandId) return;
    const prefill = {
      brand_id: brandId,
      objective: idea.objective,
      selected_formats: selectedFormats,
      internal_title: idea.title,
      theme: idea.theme,
      specific_audience: idea.target_audience,
      audience_problem: idea.audience_problem,
      main_message: idea.central_message,
      call_to_action: idea.suggested_cta,
      mandatory_information: idea.required_information.join("\n"),
      desired_style: idea.visual_direction,
      notes: `Origem: Ideia rápida. Gancho: ${idea.hook}`,
    };
    try {
      localStorage.setItem("cria-wizard-prefill", JSON.stringify(prefill));
      sessionStorage.setItem("cria-wizard-from-idea", "1");
    } catch {}
    setShowFormatDialog(false);
    navigate({ to: "/app/content/new" });
  };

  const save = async () => {
    if (!idea || !brandId) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("content_ideas").insert({
      user_id: u.user.id, brand_id: brandId,
      title: idea.title, theme: idea.theme, content_pillar: idea.content_pillar,
      objective: idea.objective, recommended_format: idea.recommended_format,
      angle: idea.angle, target_audience: idea.target_audience,
      audience_problem: idea.audience_problem, central_message: idea.central_message,
      hook: idea.hook, suggested_cta: idea.suggested_cta,
      required_information: idea.required_information, visual_direction: idea.visual_direction,
      reason_to_publish: idea.reason_to_publish, source_elements: idea.source_elements,
      novelty_score: idea.novelty_score, novelty_badge: idea.novelty_badge,
      template_key: idea.template_key, status: "favorita", source_type: "lab",
    });
    if (error) toast.error("Não foi possível salvar", { description: error.message });
    else {
      toast.success("Ideia salva no Banco de Ideias");
      qc.invalidateQueries({ queryKey: ["saved-ideas"] });
    }
  };

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-1">
          <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" />Ideia rápida</Badge>
          <h2 className="text-lg font-semibold">Precisa postar, mas não sabe o quê?</h2>
          <p className="text-sm text-muted-foreground">Escolha a marca e receba uma sugestão pronta, baseada no que ela já tem cadastrado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
            <SelectContent>
              {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={generate} className="gap-2">
            <Sparkles className="h-4 w-4" />Gerar uma ideia rápida
          </Button>
        </div>
      </div>

      {idea && (
        <Card className="mt-4 border-border/60 bg-card">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{idea.title}</p>
              <Badge variant="outline">{idea.novelty_badge}</Badge>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              <Badge variant="outline" className="font-normal">Sugestão: {idea.recommended_format}</Badge>
              <Badge variant="outline" className="font-normal">{idea.content_pillar}</Badge>
              <Badge variant="outline" className="font-normal">{idea.objective}</Badge>
            </div>
            {idea.hook && <p className="text-sm text-muted-foreground italic">Gancho: “{idea.hook}”</p>}
            {idea.suggested_cta && <p className="text-sm"><span className="text-muted-foreground">CTA: </span>{idea.suggested_cta}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={useIt} className="gap-1"><ArrowRight className="h-3 w-3" />Usar esta ideia</Button>
              <Button size="sm" variant="outline" onClick={generate} className="gap-1"><RefreshCw className="h-3 w-3" />Gerar outra</Button>
              <Button size="sm" variant="ghost" onClick={save}>Salvar para depois</Button>
              <Button asChild size="sm" variant="ghost"><Link to="/app/ideas">Abrir Laboratório</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}
      {idea && (
        <ChooseIdeaFormatsDialog
          open={showFormatDialog}
          onOpenChange={setShowFormatDialog}
          ideaTitle={idea.title}
          recommendedFormat={recommendedFormat}
          initialFormats={recommendedFormat ? [recommendedFormat] : []}
          onContinue={continueWithFormats}
        />
      )}
    </section>
  );
}


function formatLabelToWizardKey(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  const entry = Object.entries(FORMAT_LABELS).find(([, formatLabel]) => formatLabel.toLowerCase() === normalized);
  if (entry) return entry[0];
  const aliases: Record<string, string> = {
    "post feed": "post",
    "stories": "story",
    "status whatsapp": "status_whatsapp",
  };
  return aliases[normalized] ?? null;
}

function ClientApprovalsSection() {
  const { data } = useQuery({
    queryKey: ["dashboard-approvals"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("client_approvals")
        .select("id, status, submitted_at, last_viewed_at, project_id, title, client_name, updated_at, content_projects(internal_title, display_title)")
        .order("updated_at", { ascending: false })
        .limit(50);
      const list = rows ?? [];
      const pending = list.filter((a) => a.status === "enviado_para_aprovacao" || a.status === "visualizado_pelo_cliente").length;
      const approved = list.filter((a) => a.status === "aprovado" || a.status === "aprovado_com_ajustes").length;
      const changes = list.filter((a) => a.status === "ajustes_solicitados" || a.status === "recusado").length;
      const recent = list
        .filter((a) => a.submitted_at)
        .slice(0, 3);
      return { pending, approved, changes, recent };
    },
  });

  if (!data) return null;
  const hasAny = data.pending + data.approved + data.changes > 0;
  if (!hasAny) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Aprovações do cliente</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/library" search={{ status: "awaiting_approval" }}>Ver aguardando</Link>
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Aguardando" value={data.pending} highlight={data.pending > 0} />
        <MetricTile label="Aprovadas" value={data.approved} />
        <MetricTile label="Com ajustes / recusadas" value={data.changes} />
      </div>
      {data.recent.length > 0 && (
        <div className="grid gap-2">
          {data.recent.map((a) => {
            const projectTitle =
              a.content_projects?.display_title ?? a.content_projects?.internal_title ?? a.title;
            const statusText: Record<string, string> = {
              aprovado: "Aprovado",
              aprovado_com_ajustes: "Aprovado com ajustes",
              ajustes_solicitados: "Ajustes solicitados",
              recusado: "Não aprovado",
            };
            return (
              <Link
                key={a.id}
                to="/app/content/$projectId/result"
                params={{ projectId: a.project_id }}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-sm font-medium">{projectTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.client_name ?? "Cliente"} · {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("pt-BR") : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">{statusText[a.status] ?? a.status}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

