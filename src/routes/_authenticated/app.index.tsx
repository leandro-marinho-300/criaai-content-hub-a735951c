import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Compass,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChooseIdeaFormatsDialog } from "@/components/choose-idea-formats-dialog";
import { supabase } from "@/integrations/supabase/client";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { quickIdea, type Idea } from "@/lib/ideaGenerator";
import { getProjectDisplayTitle } from "@/lib/displayTitle";
import { listScheduleItems, getScheduleItemTitle } from "@/lib/scheduleQueries";
import { effectiveDate, effectiveTime, formatDateBR, STATUS_LABELS } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Início — Cria Aí" }] }),
  component: Dashboard,
});

type ProjectRow = {
  id: string;
  internal_title: string | null;
  display_title: string | null;
  theme: string | null;
  main_message: string | null;
  status: string;
  updated_at: string;
  brand_id: string | null;
  brands: { name: string } | null;
};

type HomeTone = "orange" | "lavender" | "violet" | "graphite";

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-creative-home"],
    queryFn: async () => {
      const [brandsRes, draftsRes, approvedRes, publishedRes, recentRes] = await Promise.all([
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase
          .from("content_projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft"),
        supabase
          .from("content_projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        supabase
          .from("content_projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
        supabase
          .from("content_projects")
          .select(
            "id, internal_title, display_title, theme, main_message, status, updated_at, brand_id, brands(name)",
          )
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

      return {
        brands: brandsRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        published: publishedRes.count ?? 0,
        recent: (recentRes.data ?? []) as ProjectRow[],
      };
    },
  });

  const recent = stats?.recent ?? [];
  const activeProjects = (stats?.drafts ?? 0) + (stats?.approved ?? 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          <div className="bg-studio-glow absolute inset-0 opacity-95" />
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge className="rounded-full bg-accent/10 text-accent hover:bg-accent/10">
                  Cria Aí 2.0 · Estúdio criativo guiado
                </Badge>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Olá 👋</p>
                  <h1 className="mt-1 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                    O que você quer criar hoje?
                  </h1>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Comece pelo formato. Marca, briefing, contexto, aprovação e calendário aparecem no
                  momento certo, sem misturar tudo na entrada.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/75 p-3 text-sm shadow-sm">
                <p className="font-semibold">Hoje no estúdio</p>
                <p className="text-muted-foreground">
                  {activeProjects} em produção · {stats?.approved ?? 0} aprovados
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FormatTile
                title="Reels"
                desc="Roteiro, gancho, capa/frame e aprovação."
                to="/app/create/reel"
                icon={Film}
                tone="orange"
                label="Carro-chefe"
              />
              <FormatTile
                title="Post"
                desc="Mensagem visual direta, com legenda e CTA."
                to="/app/content/new"
                search={{ format: "post" }}
                icon={ImageIcon}
                tone="lavender"
                label="Rápido"
              />
              <FormatTile
                title="Carrossel"
                desc="Conteúdo dividido em etapas ou listas."
                to="/app/content/new"
                search={{ format: "carrossel" }}
                icon={Layers}
                tone="violet"
                label="Explicativo"
              />
              <FormatTile
                title="Status"
                desc="Mensagem curta para WhatsApp."
                to="/app/content/new"
                search={{ format: "status_whatsapp" }}
                icon={MessageCircle}
                tone="graphite"
                label="Curto"
              />
            </div>
          </div>
        </div>

        <Card className="border-border/70 bg-[var(--creative-graphite)] text-white shadow-sm">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
            <div className="space-y-2">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold">Entrada simples, produção guiada.</h2>
              <p className="text-sm leading-6 text-white/70">
                A Home agora serve para escolher o que criar ou continuar. O passo a passo fica
                dentro da criação, onde ele realmente ajuda.
              </p>
            </div>
            <div className="grid gap-2 text-sm">
              <HomeMiniStat label="Marcas" value={stats?.brands ?? 0} />
              <HomeMiniStat label="Publicados" value={stats?.published ?? 0} />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2 rounded-full">
                  Produção
                </Badge>
                <h2 className="text-xl font-semibold">Continuar produção</h2>
                <p className="text-sm text-muted-foreground">
                  Retome o que já está em andamento, aprovado ou aguardando ajuste.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/app/library">
                  Ver biblioteca
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            {recent.length > 0 ? (
              <div className="grid gap-3">
                {recent.map((project) => (
                  <ProjectResumeCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhum conteúdo recente"
                desc="Crie o primeiro conteúdo para começar sua linha de produção."
                action="Criar conteúdo"
                to="/app/create"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <AttentionPanel />
          <NextPublicationPanel />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2 rounded-full">
                  Caminhos criativos
                </Badge>
                <h2 className="text-xl font-semibold">Não quer começar pelo formato?</h2>
                <p className="text-sm text-muted-foreground">
                  Use ideias, tendências, presets ou campanhas quando o formato ainda não estiver
                  claro.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/app/templates">
                  Ver presets
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CreativeShortcut
                title="Estou sem ideias"
                desc="Receba caminhos editoriais a partir da marca."
                to="/app/ideas"
                icon={Lightbulb}
                tone="violet"
              />
              <CreativeShortcut
                title="Seguir tendência"
                desc="Transforme sinais externos em briefing."
                to="/app/trends"
                icon={Compass}
                tone="lavender"
              />
              <CreativeShortcut
                title="Usar preset"
                desc="Comece com um modelo salvo."
                to="/app/templates"
                icon={Star}
                tone="graphite"
              />
              <CreativeShortcut
                title="Criar campanha"
                desc="Monte um pacote com formatos conectados."
                to="/app/create"
                icon={ClipboardList}
                tone="orange"
              />
            </div>
          </CardContent>
        </Card>

        <QuickIdeaBlock />
      </section>
    </div>
  );
}

function HomeMiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-white/75">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

function FormatTile({
  title,
  desc,
  to,
  search,
  icon: Icon,
  tone,
  label,
}: {
  title: string;
  desc: string;
  to: string;
  search?: Record<string, string>;
  icon: typeof Film;
  tone: HomeTone;
  label: string;
}) {
  return (
    <Link
      to={to as any}
      search={search as any}
      className="group rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn("grid h-12 w-12 place-items-center rounded-2xl border", toneClasses(tone))}
        >
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant="outline" className="rounded-full text-[11px]">
          {label}
        </Badge>
      </div>
      <p className="mt-4 text-xl font-semibold">{title}</p>
      <p className="mt-1 min-h-[44px] text-sm leading-5 text-muted-foreground">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        Criar agora
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function CreativeShortcut({
  title,
  desc,
  to,
  icon: Icon,
  tone,
}: {
  title: string;
  desc: string;
  to: string;
  icon: typeof Film;
  tone: HomeTone;
}) {
  return (
    <Link
      to={to as any}
      className="group rounded-2xl border border-border/70 bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md"
    >
      <div
        className={cn("grid h-10 w-10 place-items-center rounded-2xl border", toneClasses(tone))}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{desc}</p>
      <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Começar
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function ProjectResumeCard({ project }: { project: ProjectRow }) {
  const display = getProjectDisplayTitle(project);
  return (
    <Link
      to="/app/content/$projectId/result"
      params={{ projectId: project.id }}
      title={display}
      className="grid min-w-0 gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 transition-colors hover:border-primary/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <p className="line-clamp-2 break-words font-medium">{display}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {project.brands?.name ?? "Sem marca"} · atualizado{" "}
          {formatRelativeDate(project.updated_at)}
        </p>
      </div>
      <Badge variant="outline" className="w-fit shrink-0 capitalize">
        {statusLabel(project.status)}
      </Badge>
    </Link>
  );
}

function AttentionPanel() {
  const { data } = useQuery({
    queryKey: ["dashboard-attention-approvals"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("client_approvals")
        .select(
          "id, status, submitted_at, project_id, title, client_name, updated_at, content_projects(internal_title, display_title)",
        )
        .order("updated_at", { ascending: false })
        .limit(30);
      const list = rows ?? [];
      const pending = list.filter(
        (a) => a.status === "enviado_para_aprovacao" || a.status === "visualizado_pelo_cliente",
      );
      const changes = list.filter(
        (a) => a.status === "ajustes_solicitados" || a.status === "recusado",
      );
      return {
        pendingCount: pending.length,
        changesCount: changes.length,
        recent: [...pending, ...changes].slice(0, 2),
      };
    },
  });

  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge variant="outline" className="mb-2 rounded-full">
              Atenção
            </Badge>
            <h2 className="text-xl font-semibold">Aprovações</h2>
            <p className="text-sm text-muted-foreground">O que depende de resposta do cliente.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/library" search={{ status: "awaiting_approval" }}>
              Ver
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FocusMetric label="Aguardando" value={data?.pendingCount ?? 0} tone="orange" />
          <FocusMetric label="Com ajuste" value={data?.changesCount ?? 0} tone="violet" />
        </div>
        {data?.recent?.length ? (
          <div className="grid gap-2">
            {data.recent.map((a) => {
              const projectTitle =
                a.content_projects?.display_title ?? a.content_projects?.internal_title ?? a.title;
              return (
                <Link
                  key={a.id}
                  to="/app/content/$projectId/result"
                  params={{ projectId: a.project_id }}
                  className="rounded-2xl border border-border/70 bg-background/70 p-3 hover:border-primary/45"
                >
                  <p className="line-clamp-2 text-sm font-medium">{projectTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.client_name ?? "Cliente"} · {approvalStatusLabel(a.status)}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NextPublicationPanel() {
  const { data } = useQuery({
    queryKey: ["dashboard-next-publication-compact"],
    queryFn: () => listScheduleItems(),
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const items = data ?? [];
  const next = items
    .filter((it) => {
      const d = effectiveDate(it);
      return (
        d &&
        d >= todayIso &&
        it.schedule_status !== "publicado" &&
        it.schedule_status !== "cancelado"
      );
    })
    .sort((a, b) => {
      const da = `${effectiveDate(a)}T${effectiveTime(a) ?? "00:00"}`;
      const db = `${effectiveDate(b)}T${effectiveTime(b) ?? "00:00"}`;
      return da.localeCompare(db);
    })[0];
  const noDate = items.filter((it) => it.schedule_status === "sem_data").length;

  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge variant="outline" className="mb-2 rounded-full">
              Calendário
            </Badge>
            <h2 className="text-xl font-semibold">Próxima publicação</h2>
            <p className="text-sm text-muted-foreground">Só o suficiente para agir.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/calendar">Abrir</Link>
          </Button>
        </div>
        {next ? (
          <Link
            to="/app/calendar"
            className="block rounded-2xl border border-border/70 bg-background/70 p-4 hover:border-primary/45"
          >
            <p className="line-clamp-2 text-sm font-medium">{getScheduleItemTitle(next)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateBR(effectiveDate(next) ?? "")}{" "}
              {effectiveTime(next) ? `às ${effectiveTime(next)}` : ""}
            </p>
            <Badge variant="outline" className="mt-3">
              {STATUS_LABELS[next.schedule_status as keyof typeof STATUS_LABELS] ??
                next.schedule_status}
            </Badge>
          </Link>
        ) : (
          <EmptyState
            title="Nada agendado"
            desc="Organize uma data quando o conteúdo estiver aprovado."
            to="/app/calendar"
            action="Abrir calendário"
          />
        )}
        {noDate > 0 && (
          <div className="rounded-2xl border border-creative-lavender bg-creative-lavender-soft p-3 text-sm">
            <p className="font-semibold">{noDate} conteúdo(s) sem data</p>
            <p className="text-muted-foreground">Vale organizar antes de perder o timing.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FocusMetric({ label, value, tone }: { label: string; value: number; tone: HomeTone }) {
  return (
    <div className={cn("rounded-2xl border p-4", toneClasses(tone))}>
      <p className="text-3xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
    </div>
  );
}

function EmptyState({
  title,
  desc,
  action,
  to,
}: {
  title: string;
  desc: string;
  action: string;
  to: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <Button asChild size="sm" variant="outline" className="mt-3 rounded-full">
        <Link to={to as any}>{action}</Link>
      </Button>
    </div>
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
      user_id: u.user.id,
      brand_id: brandId,
      title: idea.title,
      theme: idea.theme,
      content_pillar: idea.content_pillar,
      objective: idea.objective,
      recommended_format: idea.recommended_format,
      angle: idea.angle,
      target_audience: idea.target_audience,
      audience_problem: idea.audience_problem,
      central_message: idea.central_message,
      hook: idea.hook,
      suggested_cta: idea.suggested_cta,
      required_information: idea.required_information,
      visual_direction: idea.visual_direction,
      reason_to_publish: idea.reason_to_publish,
      source_elements: idea.source_elements,
      novelty_score: idea.novelty_score,
      novelty_badge: idea.novelty_badge,
      template_key: idea.template_key,
      status: "favorita",
      source_type: "lab",
    });
    if (error) toast.error("Não foi possível salvar", { description: error.message });
    else {
      toast.success("Ideia salva no Banco de Ideias");
      qc.invalidateQueries({ queryKey: ["saved-ideas"] });
    }
  };

  return (
    <Card className="border-creative-lavender bg-creative-lavender-soft shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1 rounded-full bg-background/70">
            <Sparkles className="h-3 w-3" />
            Ideia rápida
          </Badge>
          <h2 className="text-xl font-semibold">Precisa postar, mas não sabe o quê?</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Escolha uma marca e receba uma sugestão baseada no cadastro dela.
          </p>
        </div>
        <div className="grid gap-2">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="bg-background/80">
              <SelectValue placeholder="Selecione a marca" />
            </SelectTrigger>
            <SelectContent>
              {(brands ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={generate} className="gap-2 rounded-full">
            <Sparkles className="h-4 w-4" />
            Gerar ideia
          </Button>
        </div>

        {idea && (
          <Card className="border-border/70 bg-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{idea.title}</p>
                <Badge variant="outline">{idea.novelty_badge}</Badge>
              </div>
              {idea.hook && <p className="text-sm text-muted-foreground italic">“{idea.hook}”</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={useIt} className="gap-1 rounded-full">
                  <ArrowRight className="h-3 w-3" />
                  Usar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generate}
                  className="gap-1 rounded-full"
                >
                  <RefreshCw className="h-3 w-3" />
                  Outra
                </Button>
                <Button size="sm" variant="ghost" onClick={save}>
                  Salvar
                </Button>
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
      </CardContent>
    </Card>
  );
}

function toneClasses(tone: HomeTone) {
  const map = {
    orange: "border-creative-orange bg-creative-orange-soft text-creative-orange",
    lavender: "border-creative-lavender bg-creative-lavender-soft text-[var(--creative-graphite)]",
    violet: "border-creative-violet bg-creative-violet-soft text-creative-violet",
    graphite:
      "border-[var(--creative-graphite)]/20 bg-[var(--creative-graphite)]/10 text-[var(--creative-graphite)] dark:text-white",
  };
  return map[tone];
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

function approvalStatusLabel(s: string) {
  return (
    {
      enviado_para_aprovacao: "aguardando",
      visualizado_pelo_cliente: "visualizado",
      aprovado: "aprovado",
      aprovado_com_ajustes: "aprovado com ajustes",
      ajustes_solicitados: "ajustes solicitados",
      recusado: "não aprovado",
    }[s] ?? s
  );
}

function formatRelativeDate(date: string) {
  const updated = new Date(date).getTime();
  const diffHours = Math.max(1, Math.round((Date.now() - updated) / 1000 / 60 / 60));
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `há ${diffDays}d`;
}

function formatLabelToWizardKey(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  const entry = Object.entries(FORMAT_LABELS).find(
    ([, formatLabel]) => formatLabel.toLowerCase() === normalized,
  );
  if (entry) return entry[0];
  const aliases: Record<string, string> = {
    "post feed": "post",
    stories: "story",
    "status whatsapp": "status_whatsapp",
  };
  return aliases[normalized] ?? null;
}
