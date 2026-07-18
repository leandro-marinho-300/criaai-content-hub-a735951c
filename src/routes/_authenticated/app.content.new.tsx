import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  Zap,
  Sparkles,
  AlertCircle,
  PenSquare,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPrompts,
  FORMAT_LABELS,
  OBJECTIVE_LABELS,
  type GenerationMode,
} from "@/lib/promptBuilder";
import { ACCESSORY_CONTENT_FORMATS, PRIMARY_CONTENT_FORMATS } from "@/lib/contentFormatGuide";
import {
  OUTPUT_CATALOG,
  resolveOutputsFromFormats,
  appliesToLabel,
  withCaptionToken,
  extractCaptionMode,
  type CaptionMode,
} from "@/lib/formatOutputRules";
import type { Tables } from "@/integrations/supabase/types";
import { HelpDialog } from "@/components/help-dialog";
import {
  DevelopContentStep,
  DEFAULT_DEVELOP_STATE,
  type DevelopState,
} from "@/components/develop-content-step";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/app/content/new")({
  head: () => ({ meta: [{ title: "Novo conteúdo — Cria Aí" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    format: typeof s.format === "string" ? s.format : undefined,
  }),
  component: ContentWizard,
});

const STEPS = [
  "Marca",
  "Objetivo",
  "Formatos",
  "Briefing",
  "Desenvolver",
  "Pacote",
  "Modo",
  "Revisão",
] as const;

type State = {
  source?: "central_ideas" | string;
  schema_version?: number;
  briefing_approved?: boolean;
  format_approved?: boolean;
  start_at?: "package" | "review" | string;
  allow_briefing_edit?: boolean;
  brand_id: string | null;
  objective: string;
  selected_formats: string[];
  selected_outputs: string[];
  caption_mode: CaptionMode;
  generation_mode: GenerationMode;
  internal_title: string;
  theme: string;
  specific_audience: string;
  audience_problem: string;
  main_message: string;
  mandatory_information: string;
  call_to_action: string;
  publication_date: string;
  event_date: string;
  event_time: string;
  location: string;
  price_information: string;
  contact_information: string;
  product_description: string;
  desired_style: string;
  formality_level: string;
  restrictions: string;
  notes: string;
  develop: DevelopState;
};

const DEFAULT_STATE: State = {
  source: undefined,
  schema_version: undefined,
  briefing_approved: false,
  format_approved: false,
  start_at: undefined,
  allow_briefing_edit: false,
  brand_id: null,
  objective: "",
  selected_formats: [],
  selected_outputs: [],
  caption_mode: "none",
  generation_mode: "safe",
  internal_title: "",
  theme: "",
  specific_audience: "",
  audience_problem: "",
  main_message: "",
  mandatory_information: "",
  call_to_action: "",
  publication_date: "",
  event_date: "",
  event_time: "",
  location: "",
  price_information: "",
  contact_information: "",
  product_description: "",
  desired_style: "",
  formality_level: "",
  restrictions: "",
  notes: "",
  develop: DEFAULT_DEVELOP_STATE,
};

const DRAFT_KEY = "cria-wizard-draft";
const PREFILL_KEY = "cria-wizard-prefill";

const formatNoun = (key: string) => {
  const labels: Record<string, string> = {
    post: "um Post",
    carrossel: "um Carrossel",
    story: "um Story",
    sequencia_stories: "uma sequência de Stories",
    status_whatsapp: "um Status do WhatsApp",
    reel: "um Reel",
    capa_reel: "uma capa de Reel",
    comunicado: "um Comunicado",
    banner: "um Banner",
    texto_grupo: "um texto para grupo",
    impresso: "um material impresso",
  };
  return labels[key] ?? (FORMAT_LABELS[key] ? `um ${FORMAT_LABELS[key]}` : "um conteúdo");
};

function ContentWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [step, setStep] = useState(0);
  const [fromIdea, setFromIdea] = useState(false);
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
      const prefillRaw = localStorage.getItem(PREFILL_KEY);
      if (prefillRaw) {
        const prefill = JSON.parse(prefillRaw);
        localStorage.removeItem(PREFILL_KEY);
        return { ...DEFAULT_STATE, ...prefill };
      }
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });
  const [fromCentral] = useState(
    () => state.source === "central_ideas" && state.briefing_approved === true,
  );
  const [centralReturnStep, setCentralReturnStep] = useState(5);
  const [showErrors, setShowErrors] = useState(false);

  // Pre-select format from query (?format=post) e flag de "vindo de ideia"
  useEffect(() => {
    if (search.format && FORMAT_LABELS[search.format]) {
      setState((s) =>
        s.selected_formats.includes(search.format!)
          ? s
          : { ...s, selected_formats: [...s.selected_formats, search.format!] },
      );
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("cria-wizard-from-idea") === "1") {
      setFromIdea(true);
      sessionStorage.removeItem("cria-wizard-from-idea");
      // Pula direto para a etapa de Briefing quando vem do laboratório
      setStep(3);
    } else if (fromCentral) {
      // A Central já concluiu marca, objetivo, formato e briefing.
      // Pacote é o primeiro ponto seguro porque entregas e modo ainda são decisões do wizard.
      setStep(state.start_at === "review" ? 7 : 5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Reconcilia entregas conforme formatos: insere obrigatórias/recomendadas,
  // preserva opcionais ainda compatíveis e remove incompatíveis.
  const formatsKey = state.selected_formats.join("|");
  useEffect(() => {
    if (!state.selected_formats.length) return;
    setState((s) => {
      const resolved = resolveOutputsFromFormats(
        s.selected_formats,
        s.selected_outputs,
        s.caption_mode,
      );
      const before = new Set(s.selected_outputs);
      const after = new Set(resolved.selectedOutputs);
      let changed = before.size !== after.size;
      if (!changed)
        for (const id of after)
          if (!before.has(id)) {
            changed = true;
            break;
          }
      if (!changed && s.caption_mode === resolved.captionMode) return s;
      if (changed && typeof window !== "undefined") {
        toast("Entregas atualizadas de acordo com os formatos selecionados.", { duration: 2500 });
      }
      return {
        ...s,
        selected_outputs: resolved.selectedOutputs,
        caption_mode: resolved.captionMode,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatsKey]);

  const { data: brands } = useQuery({
    queryKey: ["brands-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const selectedBrand = useMemo(
    () => brands?.find((b) => b.id === state.brand_id) ?? null,
    [brands, state.brand_id],
  );

  const set = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggleArr = (k: "selected_formats" | "selected_outputs", value: string) =>
    setState((s) => ({
      ...s,
      [k]: s[k].includes(value) ? s[k].filter((x) => x !== value) : [...s[k], value],
    }));

  // Briefing required-field validation
  const briefingErrors = useMemo(() => {
    const e: Partial<Record<keyof State, string>> = {};
    if (!state.internal_title.trim())
      e.internal_title = "Informe um título interno para o projeto.";
    if (!state.theme.trim()) e.theme = "Informe o tema principal do conteúdo.";
    if (!state.main_message.trim())
      e.main_message = "Escreva a mensagem principal que quer transmitir.";
    if (!state.call_to_action.trim()) e.call_to_action = "Defina a chamada para ação esperada.";
    const hasContext =
      state.mandatory_information.trim() ||
      state.audience_problem.trim() ||
      state.product_description.trim();
    if (!hasContext)
      e.mandatory_information =
        "Preencha ao menos um destes: informações obrigatórias, problema/necessidade ou descrição do produto/serviço.";
    return e;
  }, [state]);

  const briefingValid = Object.keys(briefingErrors).length === 0;

  // Quality indicator
  const quality = useMemo(() => {
    const checks = [
      !!state.brand_id,
      !!state.objective,
      state.selected_formats.length > 0,
      !!state.theme.trim(),
      !!state.specific_audience.trim(),
      !!state.main_message.trim(),
      !!(
        state.mandatory_information.trim() ||
        state.audience_problem.trim() ||
        state.product_description.trim()
      ),
      !!state.call_to_action.trim(),
      !!state.desired_style.trim(),
    ];
    const score = checks.filter(Boolean).length;
    const total = checks.length;
    let label: "Incompleto" | "Básico" | "Bom" | "Completo" = "Incompleto";
    if (score >= total) label = "Completo";
    else if (score >= 7) label = "Bom";
    else if (score >= 4) label = "Básico";
    return { score, total, label, pct: Math.round((score / total) * 100) };
  }, [state]);

  const canNext = () => {
    if (step === 0) return !!state.brand_id;
    if (step === 1) return !!state.objective;
    if (step === 2) return state.selected_formats.length > 0;
    if (step === 3) return briefingValid;
    if (step === 4) return true; // Desenvolver é opcional
    if (step === 5) return state.selected_outputs.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 3 && !briefingValid) {
      setShowErrors(true);
      toast.error("Complete os campos obrigatórios do briefing.");
      return;
    }
    if (fromCentral && step === 3 && centralReturnStep >= 5) {
      setShowErrors(false);
      setStep(centralReturnStep);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const canGenerate = briefingValid;

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedBrand) throw new Error("Selecione uma marca.");
      if (!canGenerate) throw new Error("Complete o briefing antes de montar o pacote.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const mandatory = [
        state.mandatory_information,
        state.product_description ? `Produto/serviço: ${state.product_description}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const payload = {
        user_id: u.user.id,
        brand_id: state.brand_id,
        internal_title:
          state.internal_title ||
          `${selectedBrand.name} — ${new Date().toLocaleDateString("pt-BR")}`,
        theme: state.theme || null,
        objective: state.objective || null,
        specific_audience: state.specific_audience || null,
        audience_problem: state.audience_problem || null,
        main_message: state.main_message || null,
        mandatory_information: mandatory || null,
        call_to_action: state.call_to_action || null,
        publication_date: state.publication_date || null,
        event_date: state.event_date || null,
        event_time: state.event_time || null,
        location: state.location || null,
        price_information: state.price_information || null,
        contact_information: state.contact_information || null,
        desired_style: state.desired_style || null,
        formality_level: state.formality_level || null,
        restrictions: state.restrictions || null,
        notes: state.notes || null,
        selected_formats: state.selected_formats,
        selected_outputs: withCaptionToken(state.selected_outputs, state.caption_mode),
        generation_mode: state.generation_mode,
        status: "draft" as const,
        content_source: state.develop.source,
        content_development_status:
          state.develop.source === "external_chatgpt" && state.develop.imported
            ? ("imported" as const)
            : state.develop.source === "manual"
              ? ("manually_reviewed" as const)
              : ("draft_auto" as const),
        campaign_content_json:
          state.develop.imported || Object.keys(state.develop.campaign).length
            ? JSON.parse(
                JSON.stringify({
                  campaign: state.develop.campaign,
                  pieces: state.develop.imported?.pieces ?? [],
                  caption: state.develop.imported?.caption,
                  source: state.develop.source,
                }),
              )
            : null,
        imported_at: state.develop.imported?.imported_at ?? null,
        selected_differentiators: state.develop.selected_differentiators,
        avoid_terms: state.develop.avoid_terms,
      };
      const { data: project, error } = await supabase
        .from("content_projects")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;

      const result = buildPrompts({
        brand: selectedBrand,
        project: project as Tables<"content_projects">,
      });
      const rows = result.blocks.map((b, i) => ({
        project_id: project.id,
        user_id: u.user!.id,
        output_type: b.key,
        title: b.title,
        original_content: b.content,
        display_order: i,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from("content_outputs").insert(rows);
        if (insErr) throw insErr;
      }
      return project.id as string;
    },
    onSuccess: (id) => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Pacote de prompts gerado!");
      navigate({ to: "/app/content/$projectId/result", params: { projectId: id } });
    },
    onError: (e: Error) => toast.error("Falha ao gerar", { description: e.message }),
  });

  const goToBriefing = () => {
    if (fromCentral && step >= 5) setCentralReturnStep(step);
    setStep(3);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Novo conteúdo</h1>
            <p className="text-sm text-muted-foreground">
              Etapa {step + 1} de {STEPS.length}:{" "}
              <span className="font-medium text-foreground">{STEPS[step]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HelpDialog />
            <Badge variant="outline">{Math.round(((step + 1) / STEPS.length) * 100)}%</Badge>
          </div>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
        <CreationMiniFlow step={step} />

        {fromIdea && (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
            Briefing iniciado a partir de uma ideia do Laboratório. Revise e complemente os dados
            factuais antes de gerar o prompt.
          </p>
        )}

        {fromCentral && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <span>
              Briefing e formato aprovados na Central de Ideias. Continue pelo pacote de entregas.
            </span>
            {state.allow_briefing_edit && step >= 5 && (
              <Button size="sm" variant="outline" onClick={goToBriefing}>
                <PenSquare className="mr-2 h-3 w-3" />
                Alterar briefing
              </Button>
            )}
          </div>
        )}

        {state.selected_formats.length > 0 && (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            Você está preparando um prompt para criar{" "}
            {state.selected_formats.length === 1
              ? formatNoun(state.selected_formats[0])
              : `${state.selected_formats.length} formatos`}
            .
          </p>
        )}

        <QualityIndicator quality={quality} />
      </header>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <StepBrand
              brands={brands ?? []}
              selected={state.brand_id}
              onSelect={(id) => set("brand_id", id)}
              brand={selectedBrand}
            />
          )}
          {step === 1 && (
            <StepObjective value={state.objective} onChange={(v) => set("objective", v)} />
          )}
          {step === 2 && (
            <StepFormats
              values={state.selected_formats}
              onToggle={(v) => toggleArr("selected_formats", v)}
            />
          )}
          {step === 3 && (
            <StepBriefing state={state} set={set} errors={showErrors ? briefingErrors : {}} />
          )}
          {step === 4 && (
            <DevelopContentStep
              brand={selectedBrand}
              projectLike={{
                internal_title: state.internal_title,
                theme: state.theme,
                objective: state.objective,
                selected_formats: state.selected_formats,
                specific_audience: state.specific_audience,
                audience_problem: state.audience_problem,
                main_message: state.main_message,
                mandatory_information: state.mandatory_information,
                call_to_action: state.call_to_action,
                event_date: state.event_date,
                event_time: state.event_time,
                location: state.location,
                price_information: state.price_information,
                contact_information: state.contact_information,
                restrictions: state.restrictions,
                notes: state.notes,
              }}
              state={state.develop}
              onChange={(d) => set("develop", d)}
            />
          )}
          {step === 5 && (
            <StepOutputs
              formats={state.selected_formats}
              values={state.selected_outputs}
              captionMode={state.caption_mode}
              onToggle={(v) => toggleArr("selected_outputs", v)}
              onCaptionChange={(m) => set("caption_mode", m)}
            />
          )}
          {step === 6 && (
            <StepMode value={state.generation_mode} onChange={(v) => set("generation_mode", v)} />
          )}
          {step === 7 && (
            <StepReview
              state={state}
              brand={selectedBrand}
              errors={briefingErrors}
              onEditBriefing={goToBriefing}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(fromCentral ? 5 : 0, s - 1))}
          disabled={step === 0 || (fromCentral && step === 5)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canNext()}>
            {fromCentral && step === 3 ? "Salvar briefing" : "Continuar"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !canGenerate}
            size="lg"
          >
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Montar prompt
          </Button>
        )}
      </div>

      {step === 7 && !canGenerate && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-2">
              <p>
                Tema, mensagem principal e chamada para ação são obrigatórios antes de montar o
                prompt.
              </p>
              <Button size="sm" variant="outline" onClick={goToBriefing}>
                <PenSquare className="mr-2 h-3 w-3" />
                Editar briefing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        O Cria Aí monta o prompt.{" "}
        <Link to="/app/library" className="underline">
          A criação do conteúdo final é feita por você na IA escolhida.
        </Link>
      </p>
    </div>
  );
}

function CreationMiniFlow({ step }: { step: number }) {
  const current = step <= 2 ? 0 : step <= 4 ? 1 : step <= 6 ? 2 : 3;
  const items = [
    { title: "Escolher", desc: "Marca e formato" },
    { title: "Briefing", desc: "Tema e contexto" },
    { title: "Pacote", desc: "Entregas e modo" },
    { title: "Revisar", desc: "Conferir e gerar" },
  ];
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {items.map((item, index) => {
          const active = index === current;
          const done = index < current;
          return (
            <div
              key={item.title}
              className={
                "flex items-center gap-3 rounded-xl border p-3 text-xs transition-colors " +
                (active
                  ? "border-primary/40 bg-primary/10"
                  : done
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "border-border/50 bg-background/55")
              }
            >
              <span
                className={
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground")
                }
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{item.title}</span>
                <span className="block truncate text-muted-foreground">{item.desc}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QualityIndicator({
  quality,
}: {
  quality: { score: number; total: number; label: string; pct: number };
}) {
  const color =
    quality.label === "Completo"
      ? "bg-emerald-500"
      : quality.label === "Bom"
        ? "bg-primary"
        : quality.label === "Básico"
          ? "bg-amber-500"
          : "bg-destructive";
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Qualidade do briefing</span>
        <span className="text-muted-foreground">
          {quality.score}/{quality.total} ·{" "}
          <span className="font-semibold text-foreground">{quality.label}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all ${color}`} style={{ width: `${quality.pct}%` }} />
      </div>
    </div>
  );
}

function StepBrand({
  brands,
  selected,
  onSelect,
  brand,
}: {
  brands: Tables<"brands">[];
  selected: string | null;
  onSelect: (id: string) => void;
  brand: Tables<"brands"> | null;
}) {
  if (!brands.length) {
    return (
      <div className="grid place-items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Você precisa cadastrar uma marca antes.</p>
        <Button asChild>
          <a href="/app/brands/new">Cadastrar marca</a>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Marca</Label>
        <Select value={selected ?? ""} onValueChange={onSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          A identidade, o público e o tom de voz serão carregados automaticamente.
        </p>
      </div>
      {brand && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_1fr]">
            {brand.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-16 w-16 rounded-lg border bg-background object-contain p-1"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg gradient-brand font-bold text-white">
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 space-y-1.5 text-sm">
              <p className="font-semibold">
                {brand.name}
                {brand.segment && <span className="text-muted-foreground"> · {brand.segment}</span>}
              </p>
              {brand.tone_of_voice && (
                <p>
                  <span className="text-muted-foreground">Tom: </span>
                  {brand.tone_of_voice}
                </p>
              )}
              {brand.audience && (
                <p>
                  <span className="text-muted-foreground">Público: </span>
                  {brand.audience}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {brand.primary_color && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs">
                    <span
                      className="inline-block h-3 w-3 rounded-full border"
                      style={{ background: brand.primary_color }}
                    />
                    {brand.primary_color}
                  </span>
                )}
                {brand.prohibited_words && brand.prohibited_words.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {brand.prohibited_words.length} palavras proibidas
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepObjective({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label>Qual o objetivo deste conteúdo?</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(OBJECTIVE_LABELS).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`rounded-lg border p-3 text-left text-sm transition-colors ${
              value === k
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepFormats({ values, onToggle }: { values: string[]; onToggle: (v: string) => void }) {
  const hasReel = values.includes("reel");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label>Escolha o formato principal</Label>
        <p className="text-sm text-muted-foreground">
          Cada formato serve para uma situação diferente. Escolha pelo que você quer produzir, não
          só pelo canal.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {PRIMARY_CONTENT_FORMATS.map((item) => {
          const selected = values.includes(item.key);
          return (
            <label
              key={item.key}
              className={`grid cursor-pointer gap-3 rounded-2xl border p-4 text-sm transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggle(item.key)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold leading-none">{item.label}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.complexity}
                    </Badge>
                    {item.key === "reel" && <Badge className="text-[10px]">Fluxo próprio</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.useWhen}</p>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl bg-muted/40 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-medium text-foreground">O Cria Aí entrega</p>
                  <p className="mt-1 text-muted-foreground">
                    {item.generates.slice(0, 4).join(" · ")}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Não é para</p>
                  <p className="mt-1 text-muted-foreground">
                    {item.doesNotGenerate.slice(0, 3).join(" · ")}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{item.userHint}</p>
            </label>
          );
        })}
      </div>

      {hasReel && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Reel tem fluxo especial no Cria Aí 2.0</p>
              <p className="text-muted-foreground">
                Para criar um Reel com promessa, gancho, roteiro, capa/frame, storyboard e aprovação
                em pacote, use o Criar Reel 2.0.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/app/create/reel">Abrir Criar Reel 2.0</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="rounded-2xl border border-dashed px-4">
        <AccordionItem value="subprodutos" className="border-0">
          <AccordionTrigger className="text-sm hover:no-underline">
            Subprodutos e formatos de apoio
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-2 pb-4 sm:grid-cols-2">
              {ACCESSORY_CONTENT_FORMATS.map((item) => {
                const selected = values.includes(item.key);
                return (
                  <label
                    key={item.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                      selected ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggle(item.key)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.userHint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function StepBriefing({
  state,
  set,
  errors,
}: {
  state: State;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
  errors: Partial<Record<keyof State, string>>;
}) {
  const hasDevError = !!errors.audience_problem || !!errors.mandatory_information;
  const hasEssentialError =
    !!errors.internal_title || !!errors.theme || !!errors.main_message || !!errors.call_to_action;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        Briefing progressivo: comece pelo essencial, refine no desenvolvimento e abra a parte
        avançada só quando precisar. Nada fica permanentemente escondido — você pode editar tudo.
      </div>
      <Accordion
        type="multiple"
        defaultValue={["essencial", hasDevError ? "desenvolvimento" : ""].filter(Boolean)}
        className="space-y-2"
      >
        <AccordionItem value="essencial" className="rounded-lg border border-border/60 px-3">
          <AccordionTrigger className="text-sm hover:no-underline">
            <span className="flex items-center gap-2">
              Essencial
              {hasEssentialError && (
                <Badge variant="destructive" className="text-[10px]">
                  Pendente
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Field
                label="Título interno do projeto *"
                className="sm:col-span-2"
                error={errors.internal_title}
              >
                <Input
                  value={state.internal_title}
                  onChange={(e) => set("internal_title", e.target.value)}
                  placeholder="Ex.: Divulgação Bolsa Eleganza — Junho"
                />
              </Field>
              <Field label="Tema principal *" className="sm:col-span-2" error={errors.theme}>
                <Input
                  value={state.theme}
                  onChange={(e) => set("theme", e.target.value)}
                  placeholder="Divulgação da Bolsa Eleganza Caramelo à pronta entrega"
                />
              </Field>
              <Field
                label="Mensagem principal *"
                className="sm:col-span-2"
                error={errors.main_message}
              >
                <Textarea
                  rows={2}
                  value={state.main_message}
                  onChange={(e) => set("main_message", e.target.value)}
                  placeholder="Elegância, espaço e praticidade para diferentes momentos da rotina"
                />
              </Field>
              <Field
                label="Chamada para ação *"
                className="sm:col-span-2"
                error={errors.call_to_action}
              >
                <Input
                  value={state.call_to_action}
                  onChange={(e) => set("call_to_action", e.target.value)}
                  placeholder="Chame no WhatsApp e garanta a sua"
                />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="desenvolvimento" className="rounded-lg border border-border/60 px-3">
          <AccordionTrigger className="text-sm hover:no-underline">
            <span className="flex items-center gap-2">
              Desenvolvimento
              {hasDevError && (
                <Badge variant="destructive" className="text-[10px]">
                  Pendente
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Field label="Público específico">
                <Input
                  value={state.specific_audience}
                  onChange={(e) => set("specific_audience", e.target.value)}
                  placeholder="Ex.: Mulheres 30-50, executivas"
                />
              </Field>
              <Field
                label="Problema ou necessidade"
                error={
                  !state.audience_problem &&
                  !state.mandatory_information &&
                  !state.product_description
                    ? "Preencha ao menos um campo de contexto."
                    : undefined
                }
              >
                <Input
                  value={state.audience_problem}
                  onChange={(e) => set("audience_problem", e.target.value)}
                  placeholder="Ex.: bolsa elegante que cabe notebook"
                />
              </Field>
              <Field label="Descrição do produto ou serviço" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={state.product_description}
                  onChange={(e) => set("product_description", e.target.value)}
                  placeholder="Descreva o produto, materiais, diferenciais, etc."
                />
              </Field>
              <Field
                label="Informações obrigatórias"
                className="sm:col-span-2"
                error={errors.mandatory_information}
              >
                <Textarea
                  rows={2}
                  value={state.mandatory_information}
                  onChange={(e) => set("mandatory_information", e.target.value)}
                  placeholder="Datas, valores, endereços, telefones — tudo que a IA deve incluir literalmente."
                />
              </Field>
              <Field label="Estilo desejado">
                <Input
                  value={state.desired_style}
                  onChange={(e) => set("desired_style", e.target.value)}
                  placeholder="Ex.: minimalista, sofisticado"
                />
              </Field>
              <Field label="Nível de formalidade">
                <Select
                  value={state.formality_level}
                  onValueChange={(v) => set("formality_level", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="muito_casual">Muito casual</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="neutro">Neutro</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="muito_formal">Muito formal</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="avancado" className="rounded-lg border border-border/60 px-3">
          <AccordionTrigger className="text-sm hover:no-underline">
            Avançado (opcional)
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <Field label="Data da publicação">
                <Input
                  type="date"
                  value={state.publication_date}
                  onChange={(e) => set("publication_date", e.target.value)}
                />
              </Field>
              <Field label="Data do evento">
                <Input
                  type="date"
                  value={state.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </Field>
              <Field label="Horário">
                <Input
                  value={state.event_time}
                  onChange={(e) => set("event_time", e.target.value)}
                  placeholder="Ex.: 19h30"
                />
              </Field>
              <Field label="Local">
                <Input value={state.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
              <Field label="Valor">
                <Input
                  value={state.price_information}
                  onChange={(e) => set("price_information", e.target.value)}
                  placeholder="Ex.: R$ 199,00"
                />
              </Field>
              <Field label="Contato">
                <Input
                  value={state.contact_information}
                  onChange={(e) => set("contact_information", e.target.value)}
                />
              </Field>
              <Field label="Restrições" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={state.restrictions}
                  onChange={(e) => set("restrictions", e.target.value)}
                />
              </Field>
              <Field label="Observações" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={state.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <p className="text-xs text-muted-foreground">
        * campos obrigatórios. Datas, valores, telefones e locais devem ser fornecidos — nada será
        inventado.
      </p>
    </div>
  );
}

function StepOutputs({
  formats,
  values,
  captionMode,
  onToggle,
  onCaptionChange,
}: {
  formats: string[];
  values: string[];
  captionMode: CaptionMode;
  onToggle: (v: string) => void;
  onCaptionChange: (m: CaptionMode) => void;
}) {
  const resolved = useMemo(
    () => resolveOutputsFromFormats(formats, values, captionMode),
    [formats, values, captionMode],
  );
  const { requiredOutputs, recommendedOutputs, optionalOutputs, appliesTo, hashtagsApplicable } =
    resolved;

  if (!formats.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione ao menos um formato na etapa anterior para ver as entregas aplicáveis.
      </p>
    );
  }

  const isSelected = (id: string) => values.includes(id);
  const captionAllowed =
    resolved.captionMode !== "none" ||
    formats.some((f) => f === "post" || f === "carrossel" || f === "reel");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-base">Entregas da campanha</Label>
        <p className="text-sm text-muted-foreground">
          Com base nos formatos escolhidos, o Cria Aí selecionou automaticamente os materiais
          necessários. Você pode ajustar os complementos opcionais.
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">Formatos escolhidos:</span>
          {formats.map((f) => (
            <Badge key={f} variant="secondary">
              {FORMAT_LABELS[f] ?? f}
            </Badge>
          ))}
        </div>
      </div>

      {/* A. Incluído automaticamente */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="default">A</Badge>
          <Label className="text-sm">Incluído automaticamente</Label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {requiredOutputs.map((id) => (
            <div
              key={id}
              className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm opacity-100"
            >
              <Checkbox checked disabled className="mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium">{OUTPUT_CATALOG[id]?.label ?? id}</p>
                <p className="text-xs text-muted-foreground">
                  Obrigatório por:{" "}
                  {appliesToLabel(id, appliesTo, "required") || "formato selecionado"}
                </p>
              </div>
            </div>
          ))}
          {!requiredOutputs.length && (
            <p className="text-xs text-muted-foreground">
              Nenhuma entrega obrigatória para os formatos selecionados.
            </p>
          )}
        </div>
      </section>

      {/* B. Recomendado */}
      {recommendedOutputs.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">B</Badge>
            <Label className="text-sm">Recomendado</Label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {recommendedOutputs.map((id) => (
              <label
                key={id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${isSelected(id) ? "border-primary bg-primary/5" : "border-border/60"}`}
              >
                <Checkbox
                  checked={isSelected(id)}
                  onCheckedChange={() => onToggle(id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="font-medium">{OUTPUT_CATALOG[id]?.label ?? id}</p>
                  <p className="text-xs text-muted-foreground">
                    Recomendado para:{" "}
                    {appliesToLabel(id, appliesTo, "recommended") || "formato selecionado"}
                    {OUTPUT_CATALOG[id]?.help ? ` · ${OUTPUT_CATALOG[id]?.help}` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* C. Opcionais */}
      {optionalOutputs.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">C</Badge>
            <Label className="text-sm">Complementos opcionais</Label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {optionalOutputs.map((id) => (
              <label
                key={id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${isSelected(id) ? "border-primary bg-primary/5" : "border-border/60"}`}
              >
                <Checkbox
                  checked={isSelected(id)}
                  onCheckedChange={() => onToggle(id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className="font-medium">{OUTPUT_CATALOG[id]?.label ?? id}</p>
                  <p className="text-xs text-muted-foreground">
                    Aplica-se a:{" "}
                    {appliesToLabel(id, appliesTo, "optional") || "formato selecionado"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Legenda selector */}
      {captionAllowed && (
        <section className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3">
          <Label className="text-sm">Legenda</Label>
          <Select value={captionMode} onValueChange={(v) => onCaptionChange(v as CaptionMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não gerar</SelectItem>
              <SelectItem value="short">Curta</SelectItem>
              <SelectItem value="full">Completa</SelectItem>
              <SelectItem value="both">Gerar duas variações</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A legenda será gerada apenas para formatos compatíveis (Feed, Carrossel, Reel).
            {formats.some((f) =>
              ["story", "sequencia_stories", "status_whatsapp", "texto_grupo"].includes(f),
            ) && " Formatos como Story, Status e Texto para grupo não recebem legenda."}
          </p>
        </section>
      )}

      {hashtagsApplicable && formats.some((f) => !["post", "carrossel", "reel"].includes(f)) && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          As hashtags serão aplicadas somente às publicações compatíveis (Feed, Carrossel, Reel).
        </p>
      )}

      <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        A revisão de qualidade será aplicada automaticamente a todas as peças.
      </p>
    </div>
  );
}

function StepMode({
  value,
  onChange,
}: {
  value: GenerationMode;
  onChange: (v: GenerationMode) => void;
}) {
  const options: Array<{
    id: GenerationMode;
    title: string;
    desc: string;
    icon: typeof ShieldCheck;
  }> = [
    {
      id: "safe",
      title: "Modo Seguro",
      desc: "Prioriza textos separados da imagem, aplicação controlada de nomes, datas, valores e contatos e orientações completas para evitar erros.",
      icon: ShieldCheck,
    },
    {
      id: "fast",
      title: "Modo Rápido",
      desc: "Cria prompts mais diretos para peças simples e textos curtos.",
      icon: Zap,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-xl border p-5 text-left transition-colors ${value === o.id ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40"}`}
        >
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-background">
            <o.icon className="h-5 w-5 text-primary" />
          </div>
          <p className="font-semibold">{o.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

function StepReview({
  state,
  brand,
  errors,
  onEditBriefing,
}: {
  state: State;
  brand: Tables<"brands"> | null;
  errors: Partial<Record<keyof State, string>>;
  onEditBriefing: () => void;
}) {
  const essentialMissing = errors.theme || errors.main_message || errors.call_to_action;
  return (
    <div className="space-y-4 text-sm">
      <Row label="Marca" value={brand?.name} />
      <Row label="Objetivo" value={OBJECTIVE_LABELS[state.objective]} />
      <Row
        label="Formatos"
        value={state.selected_formats.map((f) => FORMAT_LABELS[f] ?? f).join(", ")}
      />
      <Row
        label="Entregas"
        value={state.selected_outputs
          .map((o) => OUTPUT_CATALOG[o]?.label ?? o)
          .filter(Boolean)
          .join(", ")}
      />
      <Row
        label="Legenda"
        value={
          (
            {
              none: "Não gerar",
              short: "Curta",
              full: "Completa",
              both: "Duas variações",
            } as Record<CaptionMode, string>
          )[state.caption_mode]
        }
      />
      <Row label="Modo" value={state.generation_mode === "safe" ? "Seguro" : "Rápido"} />
      <Row label="Título" value={state.internal_title} />
      <Row label="Tema" value={state.theme} essential onEdit={onEditBriefing} />
      <Row label="Público" value={state.specific_audience} suggest onEdit={onEditBriefing} />
      <Row label="Mensagem" value={state.main_message} essential onEdit={onEditBriefing} />
      <Row
        label="Informações obrigatórias"
        value={state.mandatory_information}
        suggest
        onEdit={onEditBriefing}
      />
      <Row label="CTA" value={state.call_to_action} essential onEdit={onEditBriefing} />
      <Row label="Estilo desejado" value={state.desired_style} suggest onEdit={onEditBriefing} />

      {essentialMissing ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-3 text-xs">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p>Há campos essenciais não preenchidos. Volte e complete antes de montar o prompt.</p>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Check className="mr-1.5 inline h-3 w-3" />
          Ao confirmar, geraremos um pacote completo de prompts a partir dos seus dados. Nada é
          inventado.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  essential,
  suggest,
  onEdit,
}: {
  label: string;
  value?: string | null;
  essential?: boolean;
  suggest?: boolean;
  onEdit?: () => void;
}) {
  const empty = !value || !String(value).trim();
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words">
        {empty ? (
          <div className="space-y-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${essential ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
            >
              <AlertCircle className="h-3 w-3" />
              Informação não preenchida
            </span>
            {essential && (
              <p className="text-xs text-muted-foreground">
                Volte e preencha este campo para obter um conteúdo mais personalizado.
              </p>
            )}
            {suggest && !essential && (
              <p className="text-xs text-muted-foreground">
                Opcional, mas melhora bastante o resultado.
              </p>
            )}
            {onEdit && (
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onEdit}>
                <PenSquare className="mr-1 h-3 w-3" />
                Editar briefing
              </Button>
            )}
          </div>
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
