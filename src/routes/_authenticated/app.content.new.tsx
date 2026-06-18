import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Zap, Sparkles } from "lucide-react";
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
import { buildPrompts, FORMAT_LABELS, OBJECTIVE_LABELS, OUTPUT_LABELS, type GenerationMode } from "@/lib/promptBuilder";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/content/new")({
  head: () => ({ meta: [{ title: "Novo conteúdo — Cria Aí" }] }),
  component: ContentWizard,
});

const STEPS = ["Marca", "Objetivo", "Formatos", "Briefing", "Pacote", "Modo", "Revisão"] as const;

type State = {
  brand_id: string | null;
  objective: string;
  selected_formats: string[];
  selected_outputs: string[];
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
  desired_style: string;
  formality_level: string;
  restrictions: string;
  notes: string;
};

const DEFAULT_STATE: State = {
  brand_id: null,
  objective: "",
  selected_formats: [],
  selected_outputs: ["estrategia", "conceito", "textos_artes", "layouts", "legenda_completa", "hashtags", "prompt_visual", "checklist"],
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
  desired_style: "",
  formality_level: "",
  restrictions: "",
  notes: "",
};

const DRAFT_KEY = "cria-wizard-draft";

function ContentWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const { data: brands } = useQuery({
    queryKey: ["brands-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const selectedBrand = useMemo(() => brands?.find((b) => b.id === state.brand_id) ?? null, [brands, state.brand_id]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggleArr = (k: "selected_formats" | "selected_outputs", value: string) =>
    setState((s) => ({ ...s, [k]: s[k].includes(value) ? s[k].filter((x) => x !== value) : [...s[k], value] }));

  const canNext = () => {
    if (step === 0) return !!state.brand_id;
    if (step === 1) return !!state.objective;
    if (step === 2) return state.selected_formats.length > 0;
    if (step === 4) return state.selected_outputs.length > 0;
    return true;
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedBrand) throw new Error("Selecione uma marca.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const payload = {
        user_id: u.user.id,
        brand_id: state.brand_id,
        internal_title: state.internal_title || `${selectedBrand.name} — ${new Date().toLocaleDateString("pt-BR")}`,
        theme: state.theme || null,
        objective: state.objective || null,
        specific_audience: state.specific_audience || null,
        audience_problem: state.audience_problem || null,
        main_message: state.main_message || null,
        mandatory_information: state.mandatory_information || null,
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
        selected_outputs: state.selected_outputs,
        generation_mode: state.generation_mode,
        status: "draft" as const,
      };
      const { data: project, error } = await supabase.from("content_projects").insert(payload).select("*").single();
      if (error) throw error;

      // Build prompts and persist outputs
      const result = buildPrompts({ brand: selectedBrand, project: project as Tables<"content_projects"> });
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
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Pacote de prompts gerado!");
      navigate({ to: "/app/content/$projectId/result", params: { projectId: id } });
    },
    onError: (e: Error) => toast.error("Falha ao gerar", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">Novo conteúdo</h1>
            <p className="text-sm text-muted-foreground">
              Etapa {step + 1} de {STEPS.length}: <span className="font-medium text-foreground">{STEPS[step]}</span>
            </p>
          </div>
          <Badge variant="outline">{Math.round(((step + 1) / STEPS.length) * 100)}%</Badge>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </header>

      <Card>
        <CardContent className="p-6">
          {step === 0 && <StepBrand brands={brands ?? []} selected={state.brand_id} onSelect={(id) => set("brand_id", id)} brand={selectedBrand} />}
          {step === 1 && <StepObjective value={state.objective} onChange={(v) => set("objective", v)} />}
          {step === 2 && <StepFormats values={state.selected_formats} onToggle={(v) => toggleArr("selected_formats", v)} />}
          {step === 3 && <StepBriefing state={state} set={set} />}
          {step === 4 && <StepOutputs values={state.selected_outputs} onToggle={(v) => toggleArr("selected_outputs", v)} />}
          {step === 5 && <StepMode value={state.generation_mode} onChange={(v) => set("generation_mode", v)} />}
          {step === 6 && <StepReview state={state} brand={selectedBrand} />}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canNext()}>
            Continuar<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => create.mutate()} disabled={create.isPending} size="lg">
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Montar pacote de prompts
          </Button>
        )}
      </div>
    </div>
  );
}

function StepBrand({ brands, selected, onSelect, brand }: { brands: Tables<"brands">[]; selected: string | null; onSelect: (id: string) => void; brand: Tables<"brands"> | null }) {
  if (!brands.length) {
    return (
      <div className="grid place-items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Você precisa cadastrar uma marca antes.</p>
        <Button asChild><a href="/app/brands/new">Cadastrar marca</a></Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Marca</Label>
        <Select value={selected ?? ""} onValueChange={onSelect}>
          <SelectTrigger><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
          <SelectContent>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {brand && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_1fr]">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="h-16 w-16 rounded-lg border bg-background object-contain p-1" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg gradient-brand font-bold text-white">{brand.name.slice(0, 2).toUpperCase()}</div>
            )}
            <div className="min-w-0 space-y-1.5 text-sm">
              <p className="font-semibold">{brand.name}{brand.segment && <span className="text-muted-foreground"> · {brand.segment}</span>}</p>
              {brand.tone_of_voice && <p><span className="text-muted-foreground">Tom: </span>{brand.tone_of_voice}</p>}
              {brand.audience && <p><span className="text-muted-foreground">Público: </span>{brand.audience}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {brand.primary_color && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs"><span className="inline-block h-3 w-3 rounded-full border" style={{ background: brand.primary_color }} />{brand.primary_color}</span>}
                {brand.prohibited_words && brand.prohibited_words.length > 0 && <Badge variant="outline" className="text-xs">{brand.prohibited_words.length} palavras proibidas</Badge>}
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
              value === k ? "border-primary bg-primary/10 text-foreground" : "border-border/60 hover:border-primary/40"
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
  return (
    <div className="space-y-3">
      <Label>Selecione os formatos (múltipla escolha)</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(FORMAT_LABELS).map(([k, label]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${values.includes(k) ? "border-primary bg-primary/5" : "border-border/60"}`}>
            <Checkbox checked={values.includes(k)} onCheckedChange={() => onToggle(k)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function StepBriefing({ state, set }: { state: State; set: <K extends keyof State>(k: K, v: State[K]) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Título interno do projeto" className="sm:col-span-2"><Input value={state.internal_title} onChange={(e) => set("internal_title", e.target.value)} /></Field>
      <Field label="Tema principal" className="sm:col-span-2"><Input value={state.theme} onChange={(e) => set("theme", e.target.value)} /></Field>
      <Field label="Público específico"><Input value={state.specific_audience} onChange={(e) => set("specific_audience", e.target.value)} /></Field>
      <Field label="Problema ou necessidade"><Input value={state.audience_problem} onChange={(e) => set("audience_problem", e.target.value)} /></Field>
      <Field label="Mensagem principal" className="sm:col-span-2"><Textarea rows={2} value={state.main_message} onChange={(e) => set("main_message", e.target.value)} /></Field>
      <Field label="Informações obrigatórias" className="sm:col-span-2"><Textarea rows={2} value={state.mandatory_information} onChange={(e) => set("mandatory_information", e.target.value)} /></Field>
      <Field label="Chamada para ação"><Input value={state.call_to_action} onChange={(e) => set("call_to_action", e.target.value)} /></Field>
      <Field label="Data da publicação"><Input type="date" value={state.publication_date} onChange={(e) => set("publication_date", e.target.value)} /></Field>
      <Field label="Data do evento"><Input type="date" value={state.event_date} onChange={(e) => set("event_date", e.target.value)} /></Field>
      <Field label="Horário"><Input value={state.event_time} onChange={(e) => set("event_time", e.target.value)} placeholder="Ex.: 19h30" /></Field>
      <Field label="Local"><Input value={state.location} onChange={(e) => set("location", e.target.value)} /></Field>
      <Field label="Valor"><Input value={state.price_information} onChange={(e) => set("price_information", e.target.value)} placeholder="Ex.: R$ 199,00" /></Field>
      <Field label="Contato" className="sm:col-span-2"><Input value={state.contact_information} onChange={(e) => set("contact_information", e.target.value)} /></Field>
      <Field label="Estilo desejado"><Input value={state.desired_style} onChange={(e) => set("desired_style", e.target.value)} /></Field>
      <Field label="Nível de formalidade">
        <Select value={state.formality_level} onValueChange={(v) => set("formality_level", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="muito_casual">Muito casual</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="neutro">Neutro</SelectItem>
            <SelectItem value="formal">Formal</SelectItem>
            <SelectItem value="muito_formal">Muito formal</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Restrições" className="sm:col-span-2"><Textarea rows={2} value={state.restrictions} onChange={(e) => set("restrictions", e.target.value)} /></Field>
      <Field label="Observações" className="sm:col-span-2"><Textarea rows={2} value={state.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <p className="sm:col-span-2 text-xs text-muted-foreground">Datas, valores, telefones e locais devem ser fornecidos — nada será inventado.</p>
    </div>
  );
}

function StepOutputs({ values, onToggle }: { values: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <Label>O que entregar?</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(OUTPUT_LABELS).map(([k, label]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${values.includes(k) ? "border-primary bg-primary/5" : "border-border/60"}`}>
            <Checkbox checked={values.includes(k)} onCheckedChange={() => onToggle(k)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function StepMode({ value, onChange }: { value: GenerationMode; onChange: (v: GenerationMode) => void }) {
  const options: Array<{ id: GenerationMode; title: string; desc: string; icon: typeof ShieldCheck }> = [
    { id: "safe", title: "Modo Seguro", desc: "Prioriza textos separados da imagem, aplicação controlada de nomes, datas, valores e contatos e orientações completas para evitar erros.", icon: ShieldCheck },
    { id: "fast", title: "Modo Rápido", desc: "Cria prompts mais diretos para peças simples e textos curtos.", icon: Zap },
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
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-background"><o.icon className="h-5 w-5 text-primary" /></div>
          <p className="font-semibold">{o.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{o.desc}</p>
        </button>
      ))}
    </div>
  );
}

function StepReview({ state, brand }: { state: State; brand: Tables<"brands"> | null }) {
  return (
    <div className="space-y-4 text-sm">
      <Row label="Marca" value={brand?.name ?? "—"} />
      <Row label="Objetivo" value={OBJECTIVE_LABELS[state.objective] ?? "—"} />
      <Row label="Formatos" value={state.selected_formats.map((f) => FORMAT_LABELS[f] ?? f).join(", ") || "—"} />
      <Row label="Entregas" value={state.selected_outputs.map((o) => OUTPUT_LABELS[o] ?? o).join(", ") || "—"} />
      <Row label="Modo" value={state.generation_mode === "safe" ? "Seguro" : "Rápido"} />
      <Row label="Título" value={state.internal_title || "—"} />
      <Row label="Tema" value={state.theme || "—"} />
      <Row label="Mensagem" value={state.main_message || "—"} />
      <Row label="CTA" value={state.call_to_action || "—"} />
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Check className="mr-1.5 inline h-3 w-3" />
        Ao confirmar, geraremos um pacote completo de prompts a partir dos seus dados. Nada é inventado.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}
