import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Layers,
  Lightbulb,
  PenSquare,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { OBJECTIVE_LABELS } from "@/lib/promptBuilder";
import { rankPathsByObjective, type CreativePath } from "@/lib/creativePaths";
import type { IdeaObjective } from "@/lib/ideaTaxonomy";

export const Route = createFileRoute("/_authenticated/app/create")({
  head: () => ({ meta: [{ title: "Central de Ideias — Cria Aí" }] }),
  component: CentralIdeas,
});

type StartPoint = "sem_ideia" | "tenho_ideia" | "referencia" | "campanha";
type Step = 1 | 2 | 3;
type FormatKey = "reel" | "carrossel" | "post";

type CampaignPath = {
  id: string;
  label: string;
  centralIdea: string;
  promise: string;
  setLogic: string;
  tone: string;
  suggestedCta: string;
};

type FormatRecommendation = {
  key: FormatKey;
  label: string;
  effort: string;
  why: string;
  useWhen: string;
  deliveries: string;
  direction: string;
  limitation: string;
};

const START_POINTS: Array<{
  id: StartPoint;
  icon: typeof Lightbulb;
  title: string;
  description: string;
}> = [
  {
    id: "sem_ideia",
    icon: Lightbulb,
    title: "Estou sem ideia",
    description: "Comece por uma situação, dúvida ou oportunidade da marca.",
  },
  {
    id: "tenho_ideia",
    icon: PenSquare,
    title: "Tenho uma ideia",
    description:
      "Organize algo que já está na sua cabeça, mesmo que ainda esteja confuso.",
  },
  {
    id: "referencia",
    icon: RefreshCw,
    title: "Tenho uma referência ou tendência",
    description:
      "Use uma referência como ponto de partida, sem copiar conteúdo ou identidade.",
  },
  {
    id: "campanha",
    icon: Layers,
    title: "Quero criar uma campanha",
    description: "Planeje várias peças conectadas por uma ideia central.",
  },
];

const OBJECTIVES = [
  { key: "educar", label: "Educar" },
  { key: "informar", label: "Informar ou orientar" },
  { key: "relacionamento", label: "Gerar interação" },
  { key: "aumentar_reconhecimento", label: "Inspirar ou fortalecer marca" },
  { key: "divulgar_servico", label: "Divulgar" },
  { key: "gerar_contatos", label: "Vender ou gerar contato" },
] as const;

type ObjectiveKey = (typeof OBJECTIVES)[number]["key"];

const CAMPAIGN_PATHS: CampaignPath[] = [
  {
    id: "planejamento",
    label: "Planejar antes para agir com tranquilidade",
    centralIdea:
      "Antecipar decisões reduz insegurança e melhora a experiência final.",
    promise:
      "Ajudar o público a entender o que precisa ser planejado antes de tomar uma decisão.",
    setLogic:
      "Apresentar o problema, organizar as decisões e conduzir para o próximo passo.",
    tone: "próximo, claro, inspirador e responsável",
    suggestedCta: "Fale com a equipe para começar seu planejamento.",
  },
  {
    id: "decisoes",
    label: "As decisões que vêm antes",
    centralIdea: "Um bom resultado começa antes da escolha definitiva.",
    promise: "Mostrar as principais decisões que evitam improvisos e dúvidas.",
    setLogic: "Cada peça responde a uma etapa ou dúvida complementar.",
    tone: "educativo, prático e acolhedor",
    suggestedCta: "Salve as orientações e converse com a equipe.",
  },
  {
    id: "jornada",
    label: "Do desejo ao planejamento",
    centralIdea:
      "Transformar uma vontade inicial em um plano possível e seguro.",
    promise: "Conduzir o público da inspiração até uma ação concreta.",
    setLogic:
      "Combinar inspiração, orientação, construção de confiança e contato.",
    tone: "inspirador, humano e direto",
    suggestedCta: "Dê o primeiro passo com um atendimento personalizado.",
  },
];

const FORMAT_RECOMMENDATIONS: Record<FormatKey, FormatRecommendation> = {
  reel: {
    key: "reel",
    label: "Reel educativo",
    effort: "Produção maior",
    why: "Funciona bem quando a ideia depende de situação, demonstração, fala ou transformação rápida.",
    useWhen:
      "Use quando for importante mostrar causa e efeito com ritmo e presença humana.",
    deliveries:
      "Ganchos, roteiro por cenas, texto falado, texto na tela, orientação visual, legenda, CTA e título de capa.",
    direction:
      "Começar por uma situação reconhecível, explicar o que acontece e fechar com um ajuste prático.",
    limitation:
      "Não é ideal para listas extensas, comparações detalhadas ou conteúdo de consulta.",
  },
  carrossel: {
    key: "carrossel",
    label: "Carrossel educativo",
    effort: "Produção média",
    why: "É forte para organizar explicações, listas, etapas e comparações com leitura pausada.",
    useWhen:
      "Use quando o público precisar consultar, salvar ou acompanhar uma sequência lógica.",
    deliveries:
      "Estrutura por páginas, títulos, textos curtos, orientação visual, legenda e CTA.",
    direction:
      "Organizar a mensagem em abertura, desenvolvimento por etapas, síntese e ação final.",
    limitation: "Tem menos força para demonstrar movimento, reação e timing.",
  },
  post: {
    key: "post",
    label: "Post estático",
    effort: "Produção menor",
    why: "É adequado quando a mensagem principal cabe em uma afirmação forte e direta.",
    useWhen:
      "Use para orientação única, posicionamento, divulgação simples ou reforço de campanha.",
    deliveries:
      "Conceito da peça, texto principal, hierarquia visual, legenda e CTA.",
    direction:
      "Destacar uma ideia principal e usar a legenda para contextualizar e orientar.",
    limitation:
      "Não comporta bem explicações longas ou várias etapas de raciocínio.",
  },
};

function normalizeObjectiveForPaths(objective: ObjectiveKey): IdeaObjective {
  if (objective === "aumentar_reconhecimento") return "inspirar";
  if (objective === "divulgar_servico") return "vender";
  return objective;
}

function cleanEditorialTheme(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
}

function isCanineContext(
  brand: {
    name?: string | null;
    segment?: string | null;
    description?: string | null;
  } | null,
  theme: string,
) {
  const text =
    `${brand?.name ?? ""} ${brand?.segment ?? ""} ${brand?.description ?? ""} ${theme}`.toLowerCase();
  return /cachorro|canino|adestra|comportamento animal|pet|tutor/.test(text);
}

function isNoCommandTheme(theme: string) {
  const text = theme.toLowerCase();
  return (
    /\bn[aã]o\b/.test(text) &&
    /cachorro|respeita|obedec|comportamento|interromp/.test(text)
  );
}

function buildContextualPaths(
  paths: CreativePath[],
  context: {
    theme: string;
    audience: string;
    objective: ObjectiveKey;
    brand: {
      name?: string | null;
      segment?: string | null;
      description?: string | null;
    } | null;
    mustAppear: string;
    mustAvoid: string;
  },
): CreativePath[] {
  const theme = cleanEditorialTheme(context.theme) || "o tema informado";
  const audience = context.audience.trim() || "o público da marca";

  if (isCanineContext(context.brand, theme) && isNoCommandTheme(theme)) {
    const variants = [
      {
        label: "O “não” não ensina o que fazer",
        description:
          "Interromper um comportamento não mostra ao cachorro qual resposta é esperada.",
        cta: "Qual comportamento você mais tenta interromper dizendo “não”?",
        opening: "Situação cotidiana + explicação do que falta ensinar.",
      },
      {
        label: "Interromper não é orientar",
        description:
          "Repetir uma proibição pode parar o comportamento por um instante, mas não ensina uma alternativa clara.",
        cta: "Em qual situação o “não” parece funcionar só por alguns segundos?",
        opening:
          "Contraste entre interromper e ensinar uma resposta alternativa.",
      },
      {
        label: "O que ensinar no lugar do “não”",
        description:
          "Uma orientação eficiente indica ao cachorro o comportamento que pode substituir aquilo que o tutor quer interromper.",
        cta: "Que resposta você gostaria que seu cachorro aprendesse no lugar desse comportamento?",
        opening: "Problema real + comportamento substituto observável.",
      },
    ];
    return paths.slice(0, 3).map((path, index) => ({
      ...path,
      label: variants[index].label,
      description: variants[index].description,
      suggestedCta: variants[index].cta,
      openingStyle: variants[index].opening,
      previewTitle: () => variants[index].label,
      suggestedFormats:
        index === 0 ? ["reel", "carrossel", "post"] : path.suggestedFormats,
    }));
  }

  return paths.slice(0, 3).map((path) => {
    const lowerTheme = theme.charAt(0).toLowerCase() + theme.slice(1);
    const details: Record<
      string,
      { label: string; description: string; cta: string }
    > = {
      educativo: {
        label: `Entender ${lowerTheme}`,
        description: `Explicar o ponto central de ${lowerTheme} de forma aplicável à realidade de ${audience}.`,
        cta: `Qual é sua principal dúvida sobre ${lowerTheme}?`,
      },
      autoridade: {
        label: `Os critérios por trás de ${lowerTheme}`,
        description: `Apresentar os critérios e cuidados usados pela marca ao orientar sobre ${lowerTheme}.`,
        cta: `Qual desses critérios você ainda não considerava?`,
      },
      checklist: {
        label: `O que observar em ${lowerTheme}`,
        description: `Organizar os pontos que ${audience} precisa verificar antes de agir sobre ${lowerTheme}.`,
        cta: `Qual item desta lista você precisa revisar primeiro?`,
      },
      erro_comum: {
        label: `O erro mais comum em ${lowerTheme}`,
        description: `Mostrar um equívoco recorrente relacionado a ${lowerTheme} e orientar uma alternativa mais segura.`,
        cta: `Você já passou por essa situação?`,
      },
      curiosidade: {
        label: `O detalhe pouco percebido em ${lowerTheme}`,
        description: `Revelar um aspecto específico de ${lowerTheme} que costuma passar despercebido por ${audience}.`,
        cta: `Você já tinha percebido esse detalhe?`,
      },
    };
    const detail = details[path.id] ?? {
      label: `${path.label}: ${theme}`,
      description: `${path.description} Aplicar a abordagem diretamente ao tema “${theme}” e ao público ${audience}.`,
      cta: `Como ${lowerTheme} aparece na sua realidade?`,
    };
    return {
      ...path,
      label: detail.label,
      description: detail.description,
      suggestedCta: detail.cta,
      previewTitle: () => detail.label,
    };
  });
}

function buildIndividualPromise(
  path: CreativePath | undefined,
  theme: string,
  brand: {
    name?: string | null;
    segment?: string | null;
    description?: string | null;
  } | null,
) {
  const cleanedTheme = cleanEditorialTheme(theme);
  const isSpecificNoPath = Boolean(
    path &&
      (path.label.includes("não ensina") ||
        path.label.includes("Interromper") ||
        path.label.includes("lugar do “não”")),
  );
  if (
    path &&
    ((isCanineContext(brand, cleanedTheme) && isNoCommandTheme(cleanedTheme)) ||
      isSpecificNoPath)
  ) {
    if (path.label.includes("não ensina"))
      return "Explicar por que repetir “não” falha e ensinar uma orientação mais clara.";
    if (path.label.includes("Interromper"))
      return "Mostrar a diferença entre interromper momentaneamente e ensinar uma resposta alternativa.";
    return "Ensinar como substituir a proibição por uma orientação observável e compreensível para o cachorro.";
  }
  return path
    ? `${path.description.replace(/[.!?]+$/, "")} A entrega deve mostrar uma conclusão prática sobre “${cleanedTheme}”.`
    : `Desenvolver “${cleanedTheme}” com uma orientação específica e útil para o público.`;
}

function CentralIdeas() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [brandId, setBrandId] = useState("");
  const [startPoint, setStartPoint] = useState<StartPoint>("tenho_ideia");
  const [objective, setObjective] = useState<ObjectiveKey>("educar");
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [reference, setReference] = useState("");
  const [referenceInsight, setReferenceInsight] = useState("");
  const [occasion, setOccasion] = useState("");
  const [mandatoryPiece, setMandatoryPiece] = useState("");
  const [confirmationInfo, setConfirmationInfo] = useState("");
  const [mustAppear, setMustAppear] = useState("");
  const [mustAvoid, setMustAvoid] = useState("");
  const [selectedPathId, setSelectedPathId] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<FormatKey>("reel");

  const { data: brands } = useQuery({
    queryKey: ["brands-central-ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, segment, description, tone_of_voice")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<
        Tables<"brands">,
        "id" | "name" | "segment" | "description" | "tone_of_voice"
      >[];
    },
  });

  const brand = useMemo(
    () => brands?.find((item) => item.id === brandId) ?? null,
    [brands, brandId],
  );
  const isCampaign = startPoint === "campanha";
  const individualPaths = useMemo(
    () =>
      buildContextualPaths(
        rankPathsByObjective(normalizeObjectiveForPaths(objective)),
        {
          theme,
          audience,
          objective,
          brand,
          mustAppear,
          mustAvoid,
        },
      ),
    [objective, theme, audience, brand, mustAppear, mustAvoid],
  );
  const selectedIndividualPath =
    individualPaths.find((path) => path.id === selectedPathId) ??
    individualPaths[0];
  const selectedCampaignPath =
    CAMPAIGN_PATHS.find((path) => path.id === selectedPathId) ??
    CAMPAIGN_PATHS[0];

  const recommendedFormats = useMemo<FormatKey[]>(() => {
    if (isCampaign) return ["reel", "carrossel", "post"];
    const path = selectedIndividualPath;
    const candidates = (path?.suggestedFormats ?? []).filter(
      (value): value is FormatKey =>
        value === "reel" || value === "carrossel" || value === "post",
    );
    const fallback: FormatKey[] =
      objective === "educar"
        ? ["reel", "carrossel", "post"]
        : objective === "gerar_contatos" || objective === "divulgar_servico"
          ? ["post", "carrossel", "reel"]
          : ["carrossel", "reel", "post"];
    return Array.from(new Set([...fallback, ...candidates])).slice(
      0,
      3,
    ) as FormatKey[];
  }, [isCampaign, objective, selectedIndividualPath]);

  const mainFormat = recommendedFormats[0] ?? "reel";
  const formatInfo = FORMAT_RECOMMENDATIONS[selectedFormat];

  const canContinueStep1 = Boolean(
    brandId &&
      objective &&
      theme.trim().length >= 3 &&
      (startPoint !== "referencia" || reference.trim().length >= 3),
  );
  const canContinueStep2 = Boolean(
    selectedPathId || (isCampaign ? CAMPAIGN_PATHS[0] : individualPaths[0]),
  );

  const selectStartPoint = (value: StartPoint) => {
    setStartPoint(value);
    setSelectedPathId("");
    setSelectedFormat("reel");
  };

  const goToStep2 = () => {
    if (!selectedPathId) {
      setSelectedPathId(
        isCampaign ? CAMPAIGN_PATHS[0].id : (individualPaths[0]?.id ?? ""),
      );
    }
    setStep(2);
  };

  const goToStep3 = () => {
    setSelectedFormat(mainFormat);
    setStep(3);
  };

  const approveAndCreate = () => {
    const pathLabel = isCampaign
      ? selectedCampaignPath.label
      : (selectedIndividualPath?.label ?? "");
    const centralIdea = isCampaign
      ? selectedCampaignPath.centralIdea
      : (selectedIndividualPath?.description ?? theme.trim());
    const promise = isCampaign
      ? selectedCampaignPath.promise
      : buildIndividualPromise(selectedIndividualPath, theme, brand);
    const tone = isCampaign
      ? selectedCampaignPath.tone
      : brand?.tone_of_voice ||
        "claro, coerente com a marca e adequado ao público";
    const cta = isCampaign
      ? selectedCampaignPath.suggestedCta
      : selectedIndividualPath?.suggestedCta ||
        "Convide o público para uma ação coerente com o objetivo.";

    const campaignFormats = [
      "reel",
      "carrossel",
      "sequencia_stories",
      "post",
      "status_whatsapp",
    ];
    const selectedFormats = isCampaign ? campaignFormats : [selectedFormat];
    const confirmationText =
      confirmationInfo.trim() ||
      "Nenhuma informação externa precisa ser confirmada.";

    const notes = [
      `Origem: Central de Ideias V2`,
      `Ponto de partida: ${START_POINTS.find((item) => item.id === startPoint)?.title}`,
      `Caminho editorial: ${pathLabel}`,
      `Ideia central: ${centralIdea}`,
      `Promessa: ${promise}`,
      `Tom editorial: ${tone}`,
      `O que precisa aparecer: ${mustAppear.trim() || "Não informado"}`,
      `O que deve ser evitado: ${mustAvoid.trim() || "Não informado"}`,
      `Informações a confirmar: ${confirmationText}`,
      isCampaign
        ? `Lógica do conjunto: ${selectedCampaignPath.setLogic}`
        : `Direção sugerida: ${formatInfo.direction}`,
      isCampaign
        ? "Função das peças: Reel abre o tema; Carrossel organiza; Stories interagem; Post reforça; Status conduz ao contato."
        : `Limitação do formato: ${formatInfo.limitation}`,
    ].join("\n");

    if (!isCampaign && selectedFormat === "reel") {
      window.location.assign("/app/create/reel");
      return;
    }

    try {
      localStorage.setItem(
        "cria-wizard-prefill",
        JSON.stringify({
          ...(!isCampaign
            ? {
                source: "central_ideas",
                schema_version: 1,
                briefing_approved: true,
                format_approved: true,
                start_at: "package",
                allow_briefing_edit: true,
              }
            : {}),
          brand_id: brandId,
          objective,
          selected_formats: selectedFormats,
          internal_title: `${isCampaign ? "Campanha" : formatInfo.label} — ${theme.trim()}`,
          theme: theme.trim(),
          specific_audience: audience.trim(),
          main_message: centralIdea,
          mandatory_information: mustAppear.trim(),
          call_to_action: cta,
          desired_style: tone,
          restrictions: mustAvoid.trim(),
          notes,
          event_date: occasion.trim(),
          price_information: confirmationInfo.trim(),
        }),
      );
    } catch {}

    navigate({ to: "/app/content/new" });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="secondary" className="rounded-full">
              Central de Ideias
            </Badge>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Da intenção ao briefing de criação
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Organize o contexto, escolha um caminho editorial e aprove um
              formato ou campanha antes da criação técnica.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full border ${step >= item ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {step > item ? <Check className="h-3.5 w-3.5" /> : item}
                </span>
                {item < 3 && <span className="h-px w-6 bg-border sm:w-12" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      {step === 1 && (
        <StepOne
          brands={brands ?? []}
          brand={brand}
          brandId={brandId}
          setBrandId={setBrandId}
          startPoint={startPoint}
          selectStartPoint={selectStartPoint}
          objective={objective}
          setObjective={setObjective}
          theme={theme}
          setTheme={setTheme}
          audience={audience}
          setAudience={setAudience}
          reference={reference}
          setReference={setReference}
          referenceInsight={referenceInsight}
          setReferenceInsight={setReferenceInsight}
          occasion={occasion}
          setOccasion={setOccasion}
          mandatoryPiece={mandatoryPiece}
          setMandatoryPiece={setMandatoryPiece}
          confirmationInfo={confirmationInfo}
          setConfirmationInfo={setConfirmationInfo}
          canContinue={canContinueStep1}
          onContinue={goToStep2}
        />
      )}

      {step === 2 && (
        <StepTwo
          isCampaign={isCampaign}
          theme={theme}
          objective={objective}
          audience={audience}
          individualPaths={individualPaths}
          campaignPaths={CAMPAIGN_PATHS}
          selectedPathId={selectedPathId}
          setSelectedPathId={setSelectedPathId}
          mustAppear={mustAppear}
          setMustAppear={setMustAppear}
          mustAvoid={mustAvoid}
          setMustAvoid={setMustAvoid}
          selectedIndividualPath={selectedIndividualPath}
          selectedCampaignPath={selectedCampaignPath}
          tone={
            isCampaign
              ? selectedCampaignPath.tone
              : brand?.tone_of_voice || "adequado à marca"
          }
          onBack={() => setStep(1)}
          onContinue={goToStep3}
          canContinue={canContinueStep2}
        />
      )}

      {step === 3 && (
        <StepThree
          isCampaign={isCampaign}
          brandName={brand?.name ?? ""}
          objective={objective}
          audience={audience}
          theme={theme}
          selectedIndividualPath={selectedIndividualPath}
          selectedCampaignPath={selectedCampaignPath}
          recommendedFormats={recommendedFormats}
          mainFormat={mainFormat}
          selectedFormat={selectedFormat}
          setSelectedFormat={setSelectedFormat}
          mustAppear={mustAppear}
          mustAvoid={mustAvoid}
          confirmationInfo={confirmationInfo}
          mandatoryPiece={mandatoryPiece}
          tone={
            isCampaign
              ? selectedCampaignPath.tone
              : brand?.tone_of_voice || "adequado à marca"
          }
          onBack={() => setStep(2)}
          onApprove={approveAndCreate}
        />
      )}
    </div>
  );
}

function StepOne(props: {
  brands: Pick<
    Tables<"brands">,
    "id" | "name" | "segment" | "description" | "tone_of_voice"
  >[];
  brand: Pick<
    Tables<"brands">,
    "id" | "name" | "segment" | "description" | "tone_of_voice"
  > | null;
  brandId: string;
  setBrandId: (value: string) => void;
  startPoint: StartPoint;
  selectStartPoint: (value: StartPoint) => void;
  objective: ObjectiveKey;
  setObjective: (value: ObjectiveKey) => void;
  theme: string;
  setTheme: (value: string) => void;
  audience: string;
  setAudience: (value: string) => void;
  reference: string;
  setReference: (value: string) => void;
  referenceInsight: string;
  setReferenceInsight: (value: string) => void;
  occasion: string;
  setOccasion: (value: string) => void;
  mandatoryPiece: string;
  setMandatoryPiece: (value: string) => void;
  confirmationInfo: string;
  setConfirmationInfo: (value: string) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const isCampaign = props.startPoint === "campanha";
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Etapa 1 de 3 · Contexto e intenção
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Vamos transformar o ponto de partida em uma intenção clara
        </h2>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Marca</Label>
            <Select value={props.brandId} onValueChange={props.setBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {props.brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {props.brand && (
              <p className="text-xs text-muted-foreground">
                {[props.brand.segment, props.brand.description]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {props.brand && (
              <Button asChild variant="ghost" size="sm">
                <Link
                  to="/app/brands/$brandId/edit"
                  params={{ brandId: props.brand.id }}
                >
                  Ver contexto
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.setBrandId("")}
            >
              Trocar marca
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <Label>De onde você está partindo?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {START_POINTS.map((item) => {
            const selected = props.startPoint === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => props.selectStartPoint(item.id)}
                className={`grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"}`}
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>
              {isCampaign
                ? "Tema ou ação central"
                : props.startPoint === "sem_ideia"
                  ? "Situação, dúvida ou oportunidade"
                  : "Conte sua ideia do seu jeito"}
            </Label>
            <Textarea
              value={props.theme}
              onChange={(event) => props.setTheme(event.target.value)}
              placeholder={
                isCampaign
                  ? "Ex.: campanha para incentivar o planejamento antecipado das férias"
                  : "Ex.: o tutor acha que o cachorro não obedece, mas pode reforçar o comportamento sem perceber"
              }
              rows={3}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Público principal</Label>
            <Input
              value={props.audience}
              onChange={(event) => props.setAudience(event.target.value)}
              placeholder="Quem precisa receber esta mensagem?"
            />
          </div>

          {props.startPoint === "referencia" && (
            <>
              <div className="space-y-2">
                <Label>Referência ou tendência</Label>
                <Input
                  value={props.reference}
                  onChange={(event) => props.setReference(event.target.value)}
                  placeholder="Link, descrição ou nome da referência"
                />
              </div>
              <div className="space-y-2">
                <Label>O que chamou sua atenção?</Label>
                <Input
                  value={props.referenceInsight}
                  onChange={(event) =>
                    props.setReferenceInsight(event.target.value)
                  }
                  placeholder="Estrutura, ritmo, abordagem ou interação"
                />
              </div>
            </>
          )}

          {isCampaign && (
            <>
              <div className="space-y-2">
                <Label>Período ou ocasião</Label>
                <Input
                  value={props.occasion}
                  onChange={(event) => props.setOccasion(event.target.value)}
                  placeholder="Ex.: férias de verão ou lançamento de agosto"
                />
              </div>
              <div className="space-y-2">
                <Label>Peça obrigatória, quando houver</Label>
                <Input
                  value={props.mandatoryPiece}
                  onChange={(event) =>
                    props.setMandatoryPiece(event.target.value)
                  }
                  placeholder="Ex.: Reel de abertura"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  Datas, preços, ofertas ou condições que precisam de
                  confirmação
                </Label>
                <Textarea
                  value={props.confirmationInfo}
                  onChange={(event) =>
                    props.setConfirmationInfo(event.target.value)
                  }
                  placeholder="Deixe em branco quando não houver pendências."
                  rows={2}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <Label>
            Escolha o principal resultado que este conteúdo precisa alcançar.
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha somente um objetivo principal.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OBJECTIVES.map((item) => {
            const selected = props.objective === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => props.setObjective(item.key)}
                className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/40"}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button disabled={!props.canContinue} onClick={props.onContinue}>
          Encontrar caminhos editoriais <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepTwo(props: {
  isCampaign: boolean;
  theme: string;
  objective: ObjectiveKey;
  audience: string;
  individualPaths: CreativePath[];
  campaignPaths: CampaignPath[];
  selectedPathId: string;
  setSelectedPathId: (value: string) => void;
  mustAppear: string;
  setMustAppear: (value: string) => void;
  mustAvoid: string;
  setMustAvoid: (value: string) => void;
  selectedIndividualPath?: CreativePath;
  selectedCampaignPath: CampaignPath;
  tone: string;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const paths = props.isCampaign ? props.campaignPaths : props.individualPaths;
  const selectedPath = props.isCampaign
    ? props.selectedCampaignPath
    : props.selectedIndividualPath;
  const centralIdea = props.isCampaign
    ? props.selectedCampaignPath.centralIdea
    : props.selectedIndividualPath?.description;
  const promise = props.isCampaign
    ? props.selectedCampaignPath.promise
    : buildIndividualPromise(props.selectedIndividualPath, props.theme, null);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Etapa 2 de 3 · Caminho editorial
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Escolha como a ideia será desenvolvida
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {props.isCampaign
            ? "As rotas abaixo organizam o conjunto de peças, não uma publicação isolada."
            : "A escolha define a abordagem antes do formato."}
        </p>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">Tema</span>
            <p className="font-medium">{props.theme}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Objetivo principal</span>
            <p className="font-medium">
              {OBJECTIVE_LABELS[props.objective] ?? props.objective}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Público</span>
            <p className="font-medium">
              {props.audience || "Ainda não especificado"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {paths.map((rawPath) => {
          const id = rawPath.id;
          const selected = props.selectedPathId
            ? props.selectedPathId === id
            : paths[0]?.id === id;
          const campaignPath = props.isCampaign
            ? (rawPath as CampaignPath)
            : null;
          const individualPath = !props.isCampaign
            ? (rawPath as CreativePath)
            : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => props.setSelectedPathId(id)}
              className={`rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{rawPath.label}</p>
                {selected && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                )}
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ideia central
                  </p>
                  <p className="mt-1">
                    {campaignPath?.centralIdea ?? individualPath?.description}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Promessa
                  </p>
                  <p className="mt-1">
                    {campaignPath?.promise ??
                      `Apresentar o tema por uma abordagem ${individualPath?.label.toLowerCase()} e útil.`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {props.isCampaign
                      ? "Lógica do conjunto"
                      : "Abertura típica"}
                  </p>
                  <p className="mt-1">
                    {campaignPath?.setLogic ?? individualPath?.openingStyle}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>O que precisa aparecer?</Label>
            <Textarea
              value={props.mustAppear}
              onChange={(event) => props.setMustAppear(event.target.value)}
              placeholder="Informações, exemplos ou elementos obrigatórios"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>O que deve ser evitado?</Label>
            <Textarea
              value={props.mustAvoid}
              onChange={(event) => props.setMustAvoid(event.target.value)}
              placeholder="Promessas, abordagens, termos ou interpretações indesejadas"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Síntese editorial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <BriefRow label="Ideia central" value={centralIdea || props.theme} />
          <BriefRow label="Promessa" value={promise} />
          <BriefRow
            label="Objetivo"
            value={OBJECTIVE_LABELS[props.objective] ?? props.objective}
          />
          <BriefRow
            label="Público"
            value={props.audience || "Ainda não especificado"}
          />
          <BriefRow label="Tom editorial" value={props.tone} />
          <BriefRow
            label="Cuidado obrigatório"
            value={
              props.mustAvoid ||
              "Manter coerência com a marca e não criar informações não confirmadas."
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={props.onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button
          disabled={!props.canContinue || !selectedPath}
          onClick={props.onContinue}
        >
          {props.isCampaign
            ? "Montar briefing da campanha"
            : "Recomendar formato"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepThree(props: {
  isCampaign: boolean;
  brandName: string;
  objective: ObjectiveKey;
  audience: string;
  theme: string;
  selectedIndividualPath?: CreativePath;
  selectedCampaignPath: CampaignPath;
  recommendedFormats: FormatKey[];
  mainFormat: FormatKey;
  selectedFormat: FormatKey;
  setSelectedFormat: (value: FormatKey) => void;
  mustAppear: string;
  mustAvoid: string;
  confirmationInfo: string;
  mandatoryPiece: string;
  tone: string;
  onBack: () => void;
  onApprove: () => void;
}) {
  if (props.isCampaign) {
    const pieces = [
      ["Reel", "Abrir o tema e gerar identificação"],
      ["Carrossel", "Organizar as decisões e orientações"],
      ["Sequência de Stories", "Gerar interação e levantar dúvidas"],
      ["Post estático", "Reforçar a mensagem principal"],
      ["Status do WhatsApp", "Conduzir para contato direto"],
    ];
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Etapa 3 de 3 · Campanha + briefing
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            Uma ideia central, várias peças com funções diferentes
          </h2>
        </div>
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Campanha recomendada</CardTitle>
              <Badge>Conjunto conectado</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A campanha organiza peças complementares. Elas podem ser ajustadas
              antes da criação, sem transformar campanha em um formato único.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {pieces.map(([piece, role]) => (
                <div key={piece} className="rounded-xl border p-3">
                  <p className="font-medium">{piece}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{role}</p>
                  {props.mandatoryPiece &&
                    piece
                      .toLowerCase()
                      .includes(props.mandatoryPiece.toLowerCase()) && (
                      <Badge variant="outline" className="mt-2">
                        Peça obrigatória
                      </Badge>
                    )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Briefing final da campanha
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <BriefRow label="Marca" value={props.brandName} />
            <BriefRow
              label="Objetivo"
              value={OBJECTIVE_LABELS[props.objective] ?? props.objective}
            />
            <BriefRow
              label="Público"
              value={props.audience || "Ainda não especificado"}
            />
            <BriefRow
              label="Ideia central"
              value={props.selectedCampaignPath.centralIdea}
            />
            <BriefRow
              label="Promessa da campanha"
              value={props.selectedCampaignPath.promise}
            />
            <BriefRow label="Tom editorial" value={props.tone} />
            <BriefRow
              label="CTA principal"
              value={props.selectedCampaignPath.suggestedCta}
            />
            <BriefRow
              label="Peças conectadas"
              value={pieces.map(([piece]) => piece).join(", ")}
            />
            <BriefRow
              label="Função de cada peça"
              value={pieces
                .map(([piece, role]) => `${piece}: ${role}`)
                .join("; ")}
            />
            <BriefRow
              label="Alertas e cuidados"
              value={
                props.mustAvoid ||
                "Não prometer preço, disponibilidade ou condições ainda não confirmadas."
              }
            />
            <BriefRow
              label="Informações a confirmar"
              value={
                props.confirmationInfo ||
                "Nenhuma informação externa precisa ser confirmada."
              }
            />
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={props.onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ajustar briefing
          </Button>
          <Button onClick={props.onApprove}>
            Aprovar e criar campanha <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const format = FORMAT_RECOMMENDATIONS[props.selectedFormat];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Etapa 3 de 3 · Formato + briefing
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Escolha o formato para desenvolver a ideia
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O primeiro formato é recomendado, mas você pode selecionar uma
          alternativa sem voltar à etapa editorial.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {props.recommendedFormats.map((key) => {
          const item = FORMAT_RECOMMENDATIONS[key];
          const selected = props.selectedFormat === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => props.setSelectedFormat(key)}
              className={`rounded-2xl border p-4 text-left transition ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.effort}
                  </p>
                </div>
                {key === props.mainFormat ? (
                  <Badge>Recomendado</Badge>
                ) : selected ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : null}
              </div>
              <p className="mt-4 text-sm">{item.why}</p>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <p>
                  <strong className="text-foreground">Quando usar:</strong>{" "}
                  {item.useWhen}
                </p>
                <p>
                  <strong className="text-foreground">Limitação:</strong>{" "}
                  {item.limitation}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{format.label}</CardTitle>
            <Badge variant="outline">{format.effort}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <BriefRow label="Entregas" value={format.deliveries} />
          <BriefRow label="Direção sugerida" value={format.direction} />
          <BriefRow label="Limitações" value={format.limitation} />
          <BriefRow
            label="O que precisa aparecer"
            value={props.mustAppear || "Nenhuma exigência adicional informada."}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Briefing final</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <BriefRow label="Marca" value={props.brandName} />
          <BriefRow
            label="Objetivo"
            value={OBJECTIVE_LABELS[props.objective] ?? props.objective}
          />
          <BriefRow
            label="Público"
            value={props.audience || "Ainda não especificado"}
          />
          <BriefRow
            label="Rota editorial"
            value={props.selectedIndividualPath?.label || ""}
          />
          <BriefRow
            label="Ideia central"
            value={props.selectedIndividualPath?.description || props.theme}
          />
          <BriefRow
            label="Promessa"
            value={buildIndividualPromise(
              props.selectedIndividualPath,
              props.theme,
              null,
            )}
          />
          <BriefRow label="Tom editorial" value={props.tone} />
          <BriefRow label="Formato escolhido" value={format.label} />
          <BriefRow
            label="CTA"
            value={
              props.selectedIndividualPath?.suggestedCta ||
              "Ação coerente com o objetivo principal."
            }
          />
          <BriefRow label="Entregas" value={format.deliveries} />
          <BriefRow label="Direção sugerida" value={format.direction} />
          <BriefRow
            label="Alertas e cuidados"
            value={
              props.mustAvoid ||
              "Manter coerência com a marca e não inventar informações."
            }
          />
          <BriefRow
            label="Informações a confirmar"
            value={
              props.confirmationInfo ||
              "Nenhuma informação externa precisa ser confirmada."
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={props.onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ajustar briefing
        </Button>
        <Button onClick={props.onApprove}>
          Aprovar e criar {format.label.replace(" educativo", "")}{" "}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 leading-relaxed">{value || "—"}</p>
    </div>
  );
}
