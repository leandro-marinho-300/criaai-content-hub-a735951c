import { z } from "zod";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { ReelScript } from "@/lib/reelScript";

export const REEL_SCRIPT_VISUAL_META_KEY = "_script_visual";

export type ReelScriptVisualStatus =
  | "not_requested"
  | "prompt_ready"
  | "sent_to_chatgpt"
  | "waiting_upload"
  | "uploaded"
  | "approved"
  | "needs_revision";

const visualMetaSchema = z.object({
  model: z.literal("storyboard_full").default("storyboard_full"),
  status: z
    .enum([
      "not_requested",
      "prompt_ready",
      "sent_to_chatgpt",
      "waiting_upload",
      "uploaded",
      "approved",
      "needs_revision",
    ])
    .default("not_requested"),
  prompt_version: z.number().int().positive().default(1),
  visual_version: z.number().int().nonnegative().default(0),
  generated_at: z.string().nullable().optional(),
  copied_at: z.string().nullable().optional(),
  last_uploaded_at: z.string().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  script_version: z.number().int().positive().nullable().optional(),
});

export type ReelScriptVisualMeta = z.infer<typeof visualMetaSchema>;

export const DEFAULT_REEL_SCRIPT_VISUAL_META: ReelScriptVisualMeta = {
  model: "storyboard_full",
  status: "not_requested",
  prompt_version: 1,
  visual_version: 0,
  generated_at: null,
  copied_at: null,
  last_uploaded_at: null,
  approved_at: null,
  script_version: null,
};

export function getStoredReelScriptVisualMeta(value: unknown): ReelScriptVisualMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_REEL_SCRIPT_VISUAL_META };
  }
  const candidate = (value as Record<string, unknown>)[REEL_SCRIPT_VISUAL_META_KEY];
  const result = visualMetaSchema.safeParse(candidate);
  return result.success
    ? { ...DEFAULT_REEL_SCRIPT_VISUAL_META, ...result.data }
    : { ...DEFAULT_REEL_SCRIPT_VISUAL_META };
}

export function attachReelScriptVisualMeta(
  script: ReelScript,
  meta: Partial<ReelScriptVisualMeta>,
): Json {
  return {
    ...(script as unknown as Record<string, Json>),
    [REEL_SCRIPT_VISUAL_META_KEY]: {
      ...DEFAULT_REEL_SCRIPT_VISUAL_META,
      ...meta,
    } as unknown as Json,
  } as Json;
}

function clean(value: string | null | undefined, fallback = "Não informado"): string {
  const result = value?.trim();
  return result || fallback;
}

function list(value: string[] | null | undefined, fallback = "Nenhum informado"): string {
  return value?.filter(Boolean).join("; ") || fallback;
}

function sceneBlock(script: ReelScript): string {
  return script.scenes
    .map((scene) => {
      const supporting = scene.supporting_images.length
        ? scene.supporting_images.map((item) => `- ${item}`).join("\n")
        : "- Nenhuma imagem adicional informada";
      return [
        `CENA ${scene.scene_number} — ${scene.scene_title}`,
        `Tempo: ${scene.start_second}-${scene.end_second}s`,
        `Função: ${scene.purpose}`,
        `Tipo de entrega: ${scene.delivery_type}`,
        `Fala/Narração: ${scene.speech_or_narration || "—"}`,
        `Texto na tela: ${scene.on_screen_text || "—"}`,
        `Gravação: ${scene.recording_direction}`,
        `Enquadramento: ${scene.framing}`,
        `Movimento de câmera: ${scene.camera_movement}`,
        `Imagens de apoio:\n${supporting}`,
        `Transição: ${scene.transition}`,
        `Observações: ${scene.production_notes || "—"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function shortVersionBlock(script: ReelScript): string {
  return script.short_version.scenes
    .map((scene) =>
      [
        `CENA ${scene.scene_number} — ${scene.start_second}-${scene.end_second}s`,
        `Fala/Narração: ${scene.speech_or_narration || "—"}`,
        `Texto na tela: ${scene.on_screen_text || "—"}`,
        `Gravação: ${scene.recording_direction}`,
      ].join("\n"),
    )
    .join("\n\n");
}

export interface BuildReelScriptVisualPromptInput {
  script: ReelScript;
  brand: Tables<"brands"> | null;
  projectTitle: string;
}

/**
 * Monta o pedido externo para o ChatGPT criar um PDF visual de storyboard.
 * Não realiza chamadas de IA nem envia dados automaticamente.
 */
export function buildReelScriptVisualPrompt({
  script,
  brand,
  projectTitle,
}: BuildReelScriptVisualPromptInput): string {
  const brandName = brand?.name || "Marca não informada";
  const primaryColor = clean(brand?.primary_color, "Usar a cor principal da identidade anexada");
  const secondaryColor = clean(brand?.secondary_color, "Usar uma cor secundária compatível");
  const fonts = clean(brand?.fonts, "Usar tipografia sans-serif profissional e legível");
  const style = clean(brand?.visual_style, "Visual profissional, limpo e coerente com a marca");
  const elements = clean(
    brand?.graphic_elements,
    "Elementos gráficos discretos relacionados ao tema",
  );
  const tone = clean(brand?.tone_of_voice, "Próximo, claro e profissional");

  return `Crie um PDF visual profissional de storyboard e guia de produção para um Reel da marca ${brandName}.

IMPORTANTE

Este PDF é um MATERIAL INTERNO DE PRODUÇÃO E VALIDAÇÃO.
Ele não é uma peça para publicação nas redes sociais.
Crie o arquivo final em PDF e disponibilize-o para download. Não entregue apenas instruções ou um modelo em texto.

OBJETIVO DO ARQUIVO

Organizar visualmente:
- conceito central;
- objetivo e público;
- duração e formato narrativo;
- roteiro principal dividido por cenas;
- falas ou narrações;
- textos na tela;
- orientações de gravação;
- enquadramento, movimentos e imagens de apoio;
- transições;
- versão reduzida;
- guia de produção;
- ganchos alternativos;
- fechamento e CTA;
- legenda e hashtags.

MODELO VISUAL DESEJADO

- PDF em orientação paisagem;
- duas páginas como padrão;
- aparência profissional e editorial;
- cabeçalho escuro com destaques na cor principal;
- cards claros e legíveis para as cenas;
- contraste entre abertura, desenvolvimento e fechamento;
- leitura confortável em tela e impressão;
- não cortar textos;
- não diminuir excessivamente a tipografia;
- quando o conteúdo não couber, criar página adicional;
- preservar integralmente o roteiro aprovado.

IDENTIDADE DA MARCA

Marca: ${brandName}
Título do projeto: ${projectTitle}
Cor principal: ${primaryColor}
Cor secundária: ${secondaryColor}
Tipografia: ${fonts}
Tom: ${tone}
Estilo visual: ${style}
Elementos gráficos: ${elements}
Logo: utilize o logo oficial que será anexado na conversa, sem redesenhá-lo e preservando sua proporção.
Referência visual: caso um PDF de exemplo seja anexado, use-o como referência de organização, hierarquia e acabamento, sem copiar textos ou substituir a identidade da marca.

PÁGINA 1 — ROTEIRO PRINCIPAL

Crie um cabeçalho com:
- logo oficial;
- título do Reel;
- selo “Roteiro principal”;
- duração;
- formato narrativo;
- objetivo.

Abaixo, crie uma faixa com:
- conceito central;
- reação desejada;
- orientação geral de locução ou produção.

Depois, distribua todas as cenas em cards. Cada card deve mostrar:
- intervalo de tempo;
- número e título da cena;
- função;
- fala ou narração;
- texto na tela;
- imagem ou orientação de produção;
- transição, quando houver.

PÁGINA 2 — VERSÃO REDUZIDA E GUIA

Divida a página em duas áreas.

Lado esquerdo:
- título “Linha do tempo — versão de ${script.short_version.duration_seconds} segundos”;
- todas as cenas da versão reduzida;
- número, tempo, título ou função, fala e texto na tela.

Lado direito, criar cards para:
1. Clima e edição;
2. Ganchos alternativos;
3. Fechamento e CTA;
4. Publicação, com legenda completa e hashtags.

REGRAS DE INTEGRIDADE

- Preservar acentos, pontuação e emojis.
- Preservar as falas e o CTA exatamente.
- Não criar, remover ou reorganizar cenas.
- Não mudar os tempos.
- Não resumir conteúdo sem autorização.
- Não inventar dados, preços, datas, regras ou benefícios.
- Não transformar o roteiro em arte publicável.
- Não inserir placeholders no PDF final.
- Não cortar a legenda nem qualquer orientação de produção.
- Não usar imagens com dados pessoais, documentos reais legíveis ou marcas de terceiros.
- Usar somente o logo oficial anexado.

DADOS DO ROTEIRO

TÍTULO
${script.title}

CONCEITO CENTRAL
${script.overview.central_concept}

OBJETIVO
${script.overview.objective}

PÚBLICO
${script.overview.target_audience}

REAÇÃO DESEJADA
${script.overview.desired_reaction}

FORMATO NARRATIVO
${script.overview.narrative_format}

DURAÇÃO PRINCIPAL
${script.overview.duration_seconds} segundos

GANCHO PRINCIPAL
${script.hooks.primary}

GANCHOS ALTERNATIVOS
1. ${script.hooks.alternatives[0]}
2. ${script.hooks.alternatives[1]}

PONTOS OBRIGATÓRIOS
${list(script.required_points)}

CENAS DO ROTEIRO PRINCIPAL

${sceneBlock(script)}

GUIA DE PRODUÇÃO

Clima da trilha: ${script.production.soundtrack_mood}
Ritmo de edição: ${script.production.editing_rhythm}
Transições gerais: ${list(script.production.general_transitions)}
Acessibilidade: ${list(script.production.accessibility_notes)}

FECHAMENTO
${script.closing.memorable_line}

CTA — PRESERVAR EXATAMENTE
${script.closing.cta}

VERSÃO REDUZIDA

Duração: ${script.short_version.duration_seconds} segundos
Gancho: ${script.short_version.hook}

${shortVersionBlock(script)}

Fechamento reduzido: ${script.short_version.closing}
CTA reduzido — preservar exatamente: ${script.short_version.cta}

PUBLICAÇÃO

Legenda:
${script.publication.caption}

Hashtags:
${script.publication.hashtags.join(" ") || "Nenhuma hashtag informada"}

VALIDAÇÃO ANTES DA ENTREGA

Confirme que:
- todas as ${script.scenes.length} cenas principais estão presentes;
- todas as ${script.short_version.scenes.length} cenas reduzidas estão presentes;
- os tempos foram preservados;
- nenhuma fala foi alterada;
- o CTA está idêntico;
- nenhum texto foi cortado;
- o logo está nítido;
- o documento está legível;
- o PDF final pode ser baixado normalmente.

Entregue o arquivo final em PDF.`;
}
