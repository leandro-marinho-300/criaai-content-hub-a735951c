import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  FileJson2,
  Image as ImageIcon,
  LayoutTemplate,
  Lightbulb,
  BookOpenCheck,
  MessageSquareText,
  Palette,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getAllPresets, type ContentPreset } from "@/lib/contentPresets";
import {
  POST2_EDITORIAL_TYPES,
  POST2_ENTRY_OPTIONS,
  POST2_OBJECTIVES,
  buildPost2LayoutPrompt,
  clearPost2Draft,
  createPost2Draft,
  exportPost2Json,
  generatePost2Result,
  generatePost2Titles,
  getSelectedPost2Title,
  loadPost2Draft,
  savePost2Draft,
  type Post2Draft,
  type Post2EditorialType,
  type Post2EntryMode,
  type Post2Objective,
  type Post2Ratio,
} from "@/lib/post2";

export const Route = createFileRoute("/_authenticated/app/create/post")({
  head: () => ({ meta: [{ title: "Criar Post 2.0 — Cria Aí" }] }),
  component: CreatePost2,
});

const STEP_LABELS = [
  "Entrada",
  "Marca",
  "Objetivo",
  "Tipo",
  "Mensagem",
  "Título",
  "Resultado",
] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function CreatePost2() {
  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Post2Draft>(() => createPost2Draft());

  const { data: brands } = useQuery({
    queryKey: ["brands-post2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const presets = useMemo(
    () =>
      getAllPresets().filter(
        (preset) => preset.formats.includes("post") || preset.idea_formats.includes("post"),
      ),
    [],
  );

  const selectedBrand = useMemo(
    () => brands?.find((brand) => brand.id === draft.brand_id) ?? null,
    [brands, draft.brand_id],
  );
  const title = getSelectedPost2Title(draft);
  const layoutPrompt = useMemo(
    () => buildPost2LayoutPrompt(draft, selectedBrand),
    [draft, selectedBrand],
  );
  const jsonOutput = useMemo(() => exportPost2Json(draft, selectedBrand), [draft, selectedBrand]);

  useEffect(() => savePost2Draft(draft), [draft]);

  const patch = (partial: Partial<Post2Draft>) =>
    setDraft((current) => ({ ...current, ...partial, updated_at: new Date().toISOString() }));
  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  const canContinue = useMemo(() => {
    if (step === 0) {
      if (!draft.entry_mode) return false;
      if (draft.entry_mode === "preset") return Boolean(draft.preset_id);
      if (draft.entry_mode === "reference") return draft.reference_content.trim().length >= 3;
      return true;
    }
    if (step === 1) return Boolean(draft.brand_id);
    if (step === 2) return Boolean(draft.objective);
    if (step === 3) return Boolean(draft.editorial_type);
    if (step === 4) return draft.theme.trim().length >= 3 && draft.understanding.trim().length >= 3;
    if (step === 5) return Boolean(title.trim());
    return true;
  }, [draft, step, title]);

  const goNext = () => {
    if (!canContinue) {
      toast.error("Complete esta etapa antes de continuar.");
      return;
    }
    if (step === 4) {
      patch({
        title_options: generatePost2Titles(draft, selectedBrand),
        selected_title_index: 0,
        custom_title: "",
      });
    }
    if (step === 5) {
      patch(generatePost2Result(draft, selectedBrand));
    }
    setStep((current) => Math.min(6, current + 1) as StepIndex);
  };

  const chooseEntry = (mode: Post2EntryMode) => {
    patch({ entry_mode: mode });
  };

  const continueDraft = () => {
    const loaded = loadPost2Draft();
    setDraft(loaded);
    setStep(loaded.brand_id ? 1 : 0);
    toast.success("Rascunho do Post 2.0 carregado.");
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    patch({
      preset_id: presetId,
      call_to_action: draft.call_to_action || preset.cta,
      mandatory_information: draft.mandatory_information || preset.mandatory_information,
      restrictions: draft.restrictions || preset.restrictions,
      visual_direction: draft.visual_direction || preset.visual_instructions,
      imported_context: [preset.description, preset.desired_style, preset.notes]
        .filter(Boolean)
        .join("\n\n"),
    });
    toast.success("Preset aplicado como ponto de partida.");
  };

  const reset = () => {
    clearPost2Draft();
    setDraft(createPost2Draft());
    setStep(0);
    toast.success("Novo Post 2.0 iniciado.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2 rounded-full">
              Post 2.0
            </Badge>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Crie um post com direção antes do layout
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Defina conteúdo, legenda e direção visual. No final, copie o prompt pronto para o GPT
              gerar a arte — sem IA interna no Cria Aí.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/create">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Novo post
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Etapa {step + 1} de {STEP_LABELS.length} · {STEP_LABELS[step]}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="hidden grid-cols-7 gap-2 md:grid">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => index <= step && setStep(index as StepIndex)}
              className={cn(
                "rounded-lg border px-2 py-2 text-xs",
                index === step
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : index < step
                    ? "border-border bg-muted/40"
                    : "border-border/50 text-muted-foreground",
              )}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </header>

      {step === 0 && (
        <EntryStep
          value={draft.entry_mode}
          onSelect={chooseEntry}
          presets={presets}
          presetId={draft.preset_id}
          onPresetChange={applyPreset}
          referenceContent={draft.reference_content}
          onReferenceContentChange={(value) => patch({ reference_content: value })}
          referenceNotes={draft.reference_notes}
          onReferenceNotesChange={(value) => patch({ reference_notes: value })}
          onContinueDraft={continueDraft}
        />
      )}
      {step === 1 && (
        <BrandStep
          brands={brands ?? []}
          brandId={draft.brand_id}
          onChange={(brandId) => {
            const brand = brands?.find((item) => item.id === brandId);
            patch({ brand_id: brandId, audience: draft.audience || brand?.audience || "" });
          }}
          selectedBrand={selectedBrand}
          ratio={draft.ratio}
          onRatioChange={(ratio) => patch({ ratio })}
        />
      )}
      {step === 2 && (
        <ObjectiveStep value={draft.objective} onChange={(objective) => patch({ objective })} />
      )}
      {step === 3 && (
        <EditorialTypeStep
          value={draft.editorial_type}
          onChange={(editorial_type) => patch({ editorial_type })}
        />
      )}
      {step === 4 && <MessageStep draft={draft} patch={patch} />}
      {step === 5 && <TitleStep draft={draft} brand={selectedBrand} patch={patch} />}
      {step === 6 && (
        <ResultStep
          draft={draft}
          brand={selectedBrand}
          layoutPrompt={layoutPrompt}
          jsonOutput={jsonOutput}
          patch={patch}
          onRegenerate={() => patch(generatePost2Result(draft, selectedBrand))}
        />
      )}

      <div className="flex items-center justify-between border-t pt-5">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1) as StepIndex)}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        {step < 6 ? (
          <Button onClick={goNext} disabled={!canContinue}>
            Continuar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => {
              savePost2Draft(draft);
              toast.success("Rascunho salvo neste navegador.");
            }}
          >
            <Save className="mr-1 h-4 w-4" />
            Salvar rascunho
          </Button>
        )}
      </div>
    </div>
  );
}

function EntryStep({
  value,
  onSelect,
  presets,
  presetId,
  onPresetChange,
  referenceContent,
  onReferenceContentChange,
  referenceNotes,
  onReferenceNotesChange,
  onContinueDraft,
}: {
  value: Post2EntryMode | "";
  onSelect: (value: Post2EntryMode) => void;
  presets: ContentPreset[];
  presetId: string;
  onPresetChange: (value: string) => void;
  referenceContent: string;
  onReferenceContentChange: (value: string) => void;
  referenceNotes: string;
  onReferenceNotesChange: (value: string) => void;
  onContinueDraft: () => void;
}) {
  const iconMap: Record<Post2EntryMode, typeof Sparkles> = {
    idea: Lightbulb,
    no_ideas: Sparkles,
    preset: Wand2,
    reference: BookOpenCheck,
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Como você quer começar?</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o ponto de partida. Depois, todos os caminhos seguem para o mesmo Post 2.0.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {POST2_ENTRY_OPTIONS.map((item) => {
          const Icon = iconMap[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "rounded-2xl border p-5 text-left transition",
                value === item.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "hover:border-primary/40",
              )}
            >
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="font-semibold">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              {value === item.id && <Check className="mt-3 h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>

      {value === "no_ideas" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-5">
            <p className="font-semibold">As ideias serão sugeridas depois da escolha da marca.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O Post 2.0 usará segmento, público e objetivo para evitar sugestões genéricas.
            </p>
          </CardContent>
        </Card>
      )}

      {value === "preset" && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Preset de conteúdo</Label>
            <Select value={presetId} onValueChange={onPresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um preset compatível com Post" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O preset aplica estrutura, tom e restrições. O tema específico continuará sendo
              definido por você.
            </p>
          </CardContent>
        </Card>
      )}

      {value === "reference" && (
        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Referência</Label>
              <Textarea
                rows={7}
                value={referenceContent}
                onChange={(event) => onReferenceContentChange(event.target.value)}
                placeholder="Cole um link, texto, descrição ou informações da referência."
              />
            </div>
            <div className="space-y-2">
              <Label>O que você gostou na referência?</Label>
              <Textarea
                rows={7}
                value={referenceNotes}
                onChange={(event) => onReferenceNotesChange(event.target.value)}
                placeholder="Ex.: hierarquia, abertura, pouco texto, composição, ritmo visual..."
              />
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              A referência será usada somente para aprender organização, hierarquia e abordagem. Não
              copiar textos, imagens, identidade visual ou composição autoral.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button type="button" variant="ghost" onClick={onContinueDraft}>
          <Save className="mr-2 h-4 w-4" />
          Continuar último rascunho
        </Button>
      </div>
    </section>
  );
}

function BrandStep({
  brands,
  brandId,
  onChange,
  selectedBrand,
  ratio,
  onRatioChange,
}: {
  brands: Tables<"brands">[];
  brandId: string;
  onChange: (value: string) => void;
  selectedBrand: Tables<"brands"> | null;
  ratio: Post2Ratio;
  onRatioChange: (value: Post2Ratio) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Marca e formato</h2>
        <p className="text-sm text-muted-foreground">
          A identidade da marca orientará o prompt visual final.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Marca</Label>
            <Select value={brandId} onValueChange={onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBrand && (
              <div className="rounded-xl bg-muted/40 p-4 text-sm">
                <p className="font-medium">{selectedBrand.name}</p>
                <p className="text-muted-foreground">
                  {selectedBrand.segment || "Segmento não informado"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedBrand.tone_of_voice || "Tom de voz não informado"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Proporção do post</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["4:5", "1:1"] as Post2Ratio[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => onRatioChange(item)}
                  className={cn(
                    "rounded-xl border p-4 text-left",
                    ratio === item ? "border-primary bg-primary/5" : "hover:border-primary/40",
                  )}
                >
                  <LayoutTemplate className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">Feed {item}</p>
                  <p className="text-xs text-muted-foreground">
                    {item === "4:5"
                      ? "1080 × 1350 px · mais espaço vertical"
                      : "1080 × 1080 px · composição compacta"}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ObjectiveStep({
  value,
  onChange,
}: {
  value: Post2Objective | "";
  onChange: (value: Post2Objective) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Qual é o objetivo principal?</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um resultado principal para orientar a mensagem.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {POST2_OBJECTIVES.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-2xl border p-5 text-left",
              value === item.id ? "border-primary bg-primary/5" : "hover:border-primary/40",
            )}
          >
            <Target className="mb-3 h-5 w-5 text-primary" />
            <p className="font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function EditorialTypeStep({
  value,
  onChange,
}: {
  value: Post2EditorialType | "";
  onChange: (value: Post2EditorialType) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Escolha o caminho editorial</h2>
        <p className="text-sm text-muted-foreground">
          Isto define como o assunto será apresentado, não o layout.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {POST2_EDITORIAL_TYPES.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-2xl border p-5 text-left",
              value === item.id ? "border-primary bg-primary/5" : "hover:border-primary/40",
            )}
          >
            <MessageSquareText className="mb-3 h-5 w-5 text-primary" />
            <p className="font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function MessageStep({
  draft,
  patch,
}: {
  draft: Post2Draft;
  patch: (partial: Partial<Post2Draft>) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Defina a mensagem central</h2>
        <p className="text-sm text-muted-foreground">
          O título e o prompt visual nascerão destas informações.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Tema específico" required>
            <Input
              value={draft.theme}
              onChange={(event) => patch({ theme: event.target.value })}
              placeholder="Ex.: Por que seu cachorro não respeita o não"
            />
          </Field>
          <Field label="Público">
            <Input
              value={draft.audience}
              onChange={(event) => patch({ audience: event.target.value })}
              placeholder="Ex.: Tutores de cães"
            />
          </Field>
          <Field label="O que a pessoa precisa entender" required className="md:col-span-2">
            <Textarea
              rows={3}
              value={draft.understanding}
              onChange={(event) => patch({ understanding: event.target.value })}
              placeholder="Ex.: Interromper um comportamento não ensina ao cachorro qual resposta é esperada."
            />
          </Field>
          <Field label="Informações obrigatórias">
            <Textarea
              rows={4}
              value={draft.mandatory_information}
              onChange={(event) => patch({ mandatory_information: event.target.value })}
              placeholder="Fatos, condições ou mensagens que precisam aparecer."
            />
          </Field>
          <Field label="CTA desejado">
            <Textarea
              rows={4}
              value={draft.call_to_action}
              onChange={(event) => patch({ call_to_action: event.target.value })}
              placeholder="Ex.: Qual comportamento você mais tenta interromper dizendo não?"
            />
          </Field>
          <Field label="Cuidados e restrições" className="md:col-span-2">
            <Textarea
              rows={3}
              value={draft.restrictions}
              onChange={(event) => patch({ restrictions: event.target.value })}
              placeholder="Ex.: Não culpabilizar o tutor; não tratar o cachorro como desobediente por intenção."
            />
          </Field>
        </CardContent>
      </Card>
    </section>
  );
}

function TitleStep({
  draft,
  brand,
  patch,
}: {
  draft: Post2Draft;
  brand: Tables<"brands"> | null;
  patch: (partial: Partial<Post2Draft>) => void;
}) {
  const regenerate = () =>
    patch({
      title_options: generatePost2Titles(draft, brand),
      selected_title_index: 0,
      custom_title: "",
    });
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Escolha o título da arte</h2>
          <p className="text-sm text-muted-foreground">
            Você pode escolher uma opção ou escrever a sua.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={regenerate}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Gerar novas opções
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {draft.title_options.map((option, index) => (
          <button
            type="button"
            key={`${option}-${index}`}
            onClick={() => patch({ selected_title_index: index, custom_title: "" })}
            className={cn(
              "rounded-2xl border p-5 text-left",
              draft.selected_title_index === index && !draft.custom_title
                ? "border-primary bg-primary/5"
                : "hover:border-primary/40",
            )}
          >
            <BadgeCheck className="mb-3 h-5 w-5 text-primary" />
            <p className="font-semibold leading-snug">{option}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-2 p-5">
          <Label>Título personalizado</Label>
          <Input
            value={draft.custom_title}
            onChange={(event) =>
              patch({ custom_title: event.target.value, selected_title_index: null })
            }
            placeholder="Escreva ou ajuste o título final"
          />
        </CardContent>
      </Card>
    </section>
  );
}

function ResultStep({
  draft,
  brand,
  layoutPrompt,
  jsonOutput,
  patch,
  onRegenerate,
}: {
  draft: Post2Draft;
  brand: Tables<"brands"> | null;
  layoutPrompt: string;
  jsonOutput: string;
  patch: (partial: Partial<Post2Draft>) => void;
  onRegenerate: () => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Post 2.0 pronto para produção</h2>
          <p className="text-sm text-muted-foreground">
            Revise o conteúdo e copie o prompt para gerar o layout no GPT.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          <Wand2 className="mr-1 h-4 w-4" />
          Atualizar resultado
        </Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-primary" />
              Texto da arte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Título principal">
              <Input
                value={draft.custom_title || getSelectedPost2Title(draft)}
                onChange={(event) =>
                  patch({ custom_title: event.target.value, selected_title_index: null })
                }
              />
            </Field>
            <Field label="Texto de apoio">
              <Textarea
                rows={3}
                value={draft.support_text}
                onChange={(event) => patch({ support_text: event.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Selo opcional">
                <Input
                  value={draft.badge_text}
                  onChange={(event) => patch({ badge_text: event.target.value })}
                  placeholder="Ex.: Dica prática"
                />
              </Field>
              <Field label="CTA curto">
                <Input
                  value={draft.art_cta}
                  onChange={(event) => patch({ art_cta: event.target.value })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Legenda da publicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={10}
              value={draft.caption}
              onChange={(event) => patch({ caption: event.target.value })}
            />
            <Field label="Hashtags — máximo 5">
              <Input
                value={draft.hashtags}
                onChange={(event) => patch({ hashtags: event.target.value })}
              />
            </Field>
            <CopyAction text={`${draft.caption}\n\n${draft.hashtags}`}>Copiar legenda</CopyAction>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" />
              Direção visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={8}
              value={draft.visual_direction}
              onChange={(event) => patch({ visual_direction: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Formato: {draft.ratio === "4:5" ? "1080 × 1350 px" : "1080 × 1080 px"} · Marca:{" "}
              {brand?.name || "não selecionada"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Prompt para gerar o layout no GPT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea readOnly rows={16} value={layoutPrompt} className="font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <CopyAction text={layoutPrompt}>Copiar prompt visual</CopyAction>
              <CopyAction text={jsonOutput} variant="outline">
                <FileJson2 className="mr-1 h-4 w-4" />
                Copiar JSON
              </CopyAction>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && <span className="ml-1 text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}

function CopyAction({
  text,
  children,
  variant = "default",
}: {
  text: string;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast.success("Conteúdo copiado.");
      }}
    >
      <Copy className="mr-1 h-4 w-4" />
      {children}
    </Button>
  );
}
