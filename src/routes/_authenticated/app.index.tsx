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
} from "lucide-react";
import { listScheduleItems, getScheduleItemTitle } from "@/lib/scheduleQueries";
import { effectiveDate, effectiveTime, formatDateBR, STATUS_LABELS, computeIsOverdue, CHANNEL_LABELS, type ScheduleStatus, type ChannelKind } from "@/lib/calendar";
import { supabase } from "@/integrations/supabase/client";
import { getProjectDisplayTitle } from "@/lib/displayTitle";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/help-dialog";
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

  const tiles = [
    { label: "Marcas", value: stats?.brands ?? 0, icon: Briefcase },
    { label: "Rascunhos", value: stats?.drafts ?? 0, icon: FileText },
    { label: "Aprovados", value: stats?.approved ?? 0, icon: CheckCircle2 },
    { label: "Publicados", value: stats?.published ?? 0, icon: Send },
    { label: "Favoritos", value: stats?.favorites ?? 0, icon: Heart },
  ];

  const shortcuts = [
    { label: "Post", icon: ImageIcon, format: "post" },
    { label: "Carrossel", icon: Layers, format: "carrossel" },
    { label: "Stories", icon: Smartphone, format: "story" },
    { label: "Reel", icon: Film, format: "reel" },
    { label: "WhatsApp", icon: MessageCircle, format: "status_whatsapp" },
  ];

  const steps = [
    {
      icon: Briefcase,
      title: "1. Escolha uma marca",
      desc: "A identidade, o público e o tom de voz são carregados automaticamente.",
    },
    {
      icon: ClipboardList,
      title: "2. Preencha o briefing",
      desc: "Informe o tema, a mensagem e a ação esperada. O Cria Aí gera copy, legenda e estrutura.",
    },
    {
      icon: CalendarCheck,
      title: "3. Anexe as artes e planeje",
      desc: "Suba os layouts, gere o PDF para aprovação do cliente e agende a publicação no calendário.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="gradient-brand absolute inset-0 opacity-10" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full">Estúdio</Badge>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Está sem criatividade hoje?
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              O Cria Aí organiza o briefing, cria os textos, monta as peças e gera os prompts para os layouts.
              Você anexa as artes finais, exporta o PDF para o cliente e planeja a publicação no calendário.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <HelpDialog autoOpen />
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/app/ideas">
                <Lightbulb className="h-4 w-4" />
                Estou sem ideias
              </Link>
            </Button>
            <Button asChild size="lg" className="gap-2">
              <Link to="/app/content/new">
                <Plus className="h-4 w-4" />
                Criar novo conteúdo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <QuickIdeaBlock />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Como criar seu conteúdo</h2>
          <HelpDialog />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.title} className="border-border/60">
              <CardContent className="space-y-2 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              O Cria Aí entrega o pacote de produção: copy, legenda, hashtags, estrutura das peças e prompts
              para os layouts. A geração da imagem final acontece fora do app — você pode usar IAs externas
              como apoio e importar a arte de volta para gerar o PDF e agendar a publicação.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{t.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{t.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <ClientApprovalsSection />



      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atalhos rápidos</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              to="/app/content/new"
              search={{ format: s.format }}
              className="group min-w-0 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 truncate font-medium">{s.label}</p>
              <p className="truncate text-xs text-muted-foreground">Criar conteúdo</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Exemplo — Divulgação de produto</h2>
        <Card className="border-border/60">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <Badge variant="outline" className="gap-1"><Wand2 className="h-3 w-3" />Exemplo demonstrativo</Badge>
              <ExampleRow label="Marca" value="Le Marinho Atelier" />
              <ExampleRow label="Tema" value="Bolsa Eleganza Caramelo à pronta entrega" />
              <ExampleRow label="Objetivo" value="Divulgar produto" />
              <ExampleRow label="Formatos" value="Post para Feed, Story e WhatsApp" />
              <ExampleRow label="Mensagem" value="Elegância, espaço e praticidade em uma única peça." />
              <ExampleRow label="CTA" value="Chame no WhatsApp e garanta a sua." />
            </div>
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
              <p className="font-semibold">Resultado esperado</p>
              <p className="mt-1 text-muted-foreground">
                O Cria Aí transforma a ideia em um pacote de produção: textos, legenda, hashtags, estrutura
                das peças e prompts para criação dos layouts. Depois, você anexa as artes, gera o PDF de
                aprovação e planeja a publicação no calendário. A imagem final é criada fora do aplicativo.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <UpcomingPublicationsSection />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conteúdos recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/library">Ver biblioteca</Link>
          </Button>
        </div>
        {stats?.recent?.length ? (
          <div className="grid gap-3">
            {stats.recent.map((p) => {
              const display = getProjectDisplayTitle(p);
              return (
                <Link
                  key={p.id}
                  to="/app/content/$projectId/result"
                  params={{ projectId: p.id }}
                  title={display}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words font-medium">{display}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.brands?.name ?? "Sem marca"}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{statusLabel(p.status)}</Badge>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="grid place-items-center gap-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">Você ainda não criou conteúdos.</p>
              <Button asChild size="sm">
                <Link to="/app/content/new">Criar o primeiro</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
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

  const useIt = () => {
    if (!idea || !brandId) return;
    const formatMap: Record<string, string> = {
      "Post Feed": "post", "Carrossel": "carrossel", "Stories": "story",
      "Status WhatsApp": "status_whatsapp", "Reel": "reel", "Comunicado": "comunicado",
    };
    const prefill = {
      brand_id: brandId,
      objective: idea.objective,
      selected_formats: formatMap[idea.recommended_format] ? [formatMap[idea.recommended_format]] : [],
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
              <Badge variant="outline" className="font-normal">{idea.recommended_format}</Badge>
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
    </section>
  );
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

