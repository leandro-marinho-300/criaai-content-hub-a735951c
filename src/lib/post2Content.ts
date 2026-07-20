import type { Tables } from "@/integrations/supabase/types";
import {
  POST2_EDITORIAL_TYPES,
  POST2_OBJECTIVES,
  type Post2Draft,
  type Post2ImportedContent,
} from "@/lib/post2";

export interface Post2ContentImportResult {
  ok: boolean;
  content: Post2ImportedContent | null;
  errors: string[];
  warnings: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean);
}

function stripCodeFence(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeHashtag(value: string) {
  const clean = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return clean ? `#${clean}` : "";
}

export function parseAndValidatePost2Content(raw: string): Post2ContentImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return {
      ok: false,
      content: null,
      errors: ["O conteúdo não é um JSON válido."],
      warnings,
    };
  }

  const root = asRecord(parsed);
  if (!root) {
    return {
      ok: false,
      content: null,
      errors: ["O JSON precisa ser um objeto."],
      warnings,
    };
  }

  const execution = asRecord(root.selected_execution);
  const art = asRecord(root.art);
  const publication = asRecord(root.publication);
  const visual = asRecord(root.visual);

  const hashtags = asStringArray(publication?.hashtags)
    .map(normalizeHashtag)
    .filter(Boolean);

  const content: Post2ImportedContent = {
    schema_version: "post_2_0",
    brand: asString(root.brand),
    central_idea: asString(root.central_idea),
    promise: asString(root.promise),
    selected_execution: {
      label: asString(execution?.label),
      concept: asString(execution?.concept),
    },
    art: {
      title: asString(art?.title),
      support_text: asString(art?.support_text),
      optional_seal: asString(art?.optional_seal),
      art_cta: asString(art?.art_cta),
    },
    publication: {
      caption: asString(publication?.caption),
      cta: asString(publication?.cta),
      hashtags,
    },
    visual: {
      concept: asString(visual?.concept),
      direction: asString(visual?.direction),
    },
    information_to_confirm: asStringArray(root.information_to_confirm),
  };

  if (asString(root.schema_version) && asString(root.schema_version) !== "post_2_0") {
    errors.push('O campo "schema_version" precisa ser "post_2_0".');
  }
  if (!content.central_idea) errors.push("A ideia central não foi preenchida.");
  if (!content.promise) errors.push("A promessa da peça não foi preenchida.");
  if (!content.art.title) errors.push("O título da arte não foi preenchido.");
  if (!content.art.support_text) errors.push("O texto de apoio da arte não foi preenchido.");
  if (!content.publication.caption) errors.push("A legenda completa não foi preenchida.");
  if (!content.visual.direction) errors.push("A direção visual não foi preenchida.");
  if (hashtags.length > 5) errors.push("Use no máximo 5 hashtags.");

  if (content.art.title.length > 90) {
    warnings.push("O título está longo para uma arte estática. Revise, mas o texto não foi cortado.");
  }
  if (content.art.support_text.length > 240) {
    warnings.push(
      "O texto de apoio está longo para a arte. Revise a hierarquia, mas o texto não foi cortado.",
    );
  }
  if (content.art.art_cta.length > 70) {
    warnings.push("O CTA da arte está longo. Revise, mas o texto não foi cortado.");
  }
  if (content.publication.caption.length < 80) {
    warnings.push("A legenda parece curta. Confirme se ela desenvolve a ideia e conclui com CTA.");
  }
  if (/incluir exatamente|usar pergunta|corrigir percep|direção visual|tipo editorial/i.test(
    `${content.art.title} ${content.art.support_text} ${content.art.art_cta}`,
  )) {
    errors.push(
      "O conteúdo da arte contém instrução estratégica. O ChatGPT deve devolver somente texto publicável nos campos de arte.",
    );
  }

  return { ok: errors.length === 0, content, errors, warnings };
}

export function applyPost2ImportedContent(
  content: Post2ImportedContent,
  raw: string,
): Partial<Post2Draft> {
  return {
    imported_content: content,
    imported_content_raw: raw,
    imported_content_imported_at: new Date().toISOString(),
    custom_title: content.art.title,
    support_text: content.art.support_text,
    badge_text: content.art.optional_seal,
    art_cta: content.art.art_cta,
    caption: content.publication.caption,
    call_to_action: content.publication.cta,
    hashtags: content.publication.hashtags.join(" "),
    visual_direction: content.visual.direction,
  };
}

export function buildPost2ExternalContentPrompt(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
): string {
  const selected = draft.concept_options[draft.selected_concept_index ?? 0];
  const objective = POST2_OBJECTIVES.find((item) => item.id === draft.objective)?.label ?? "";
  const editorial =
    POST2_EDITORIAL_TYPES.find((item) => item.id === draft.editorial_type)?.label ?? "";

  return `Crie o conteúdo editorial completo de um Post estático para o Cria Aí 2.0.

IMPORTANTE
- Não crie a imagem ainda.
- Não gere layout nesta resposta.
- Escreva o conteúdo do Post e a legenda com qualidade editorial.
- Não corte, resuma silenciosamente ou devolva frases incompletas.
- Não transforme instruções estratégicas em texto publicável.
- Não invente preços, datas, condições, promessas, serviços, benefícios ou informações da marca.
- Quando uma informação precisar ser confirmada, registre em "information_to_confirm".
- Use no máximo 5 hashtags.
- Devolva SOMENTE JSON válido, sem markdown e sem comentários.

MARCA
Nome: ${brand?.name || ""}
Segmento: ${brand?.segment || ""}
Descrição: ${brand?.description || ""}
Público: ${draft.audience || brand?.audience || ""}
Tom: ${brand?.tone_of_voice || ""}
Personalidade: ${brand?.personality || ""}
Produtos e serviços confirmados: ${brand?.products_services || ""}
Diferenciais confirmados: ${brand?.differentiators || ""}
Palavras proibidas: ${(brand?.prohibited_words || []).join(", ")}
Não inventar: ${brand?.forbidden_inventions || ""}

DIREÇÃO APROVADA
Objetivo: ${objective}
Caminho criativo: ${editorial}
Ideia central: ${draft.theme}
Promessa: ${draft.understanding}
Execução escolhida: ${selected?.label || ""}
Conceito da execução: ${selected?.concept || ""}
Título inicial da execução: ${selected?.title || ""}
Texto de apoio inicial: ${selected?.support_text || ""}
CTA inicial: ${selected?.art_cta || draft.call_to_action}
Direção visual inicial: ${selected?.visual_direction || draft.visual_direction}
Informações obrigatórias: ${draft.mandatory_information || "Nenhuma"}
Cuidados e restrições: ${draft.restrictions || "Nenhum adicional"}
Referência usada apenas como aprendizado: ${draft.reference_notes || "Nenhuma"}

O QUE VOCÊ DEVE ESCREVER
1. Um título forte e específico para a arte.
2. Um texto de apoio curto, natural e publicável.
3. Um selo opcional somente quando realmente útil.
4. Um CTA curto para a arte; pode ficar vazio quando não fizer sentido.
5. Uma legenda completa para a publicação, com abertura, desenvolvimento e conclusão.
6. Um CTA da publicação integrado naturalmente à legenda.
7. Até 5 hashtags pertinentes.
8. Um conceito visual e uma direção visual claros para a etapa posterior de criação da imagem.

FORMATO OBRIGATÓRIO
{
  "schema_version": "post_2_0",
  "brand": "",
  "central_idea": "",
  "promise": "",
  "selected_execution": {
    "label": "",
    "concept": ""
  },
  "art": {
    "title": "",
    "support_text": "",
    "optional_seal": "",
    "art_cta": ""
  },
  "publication": {
    "caption": "",
    "cta": "",
    "hashtags": [""]
  },
  "visual": {
    "concept": "",
    "direction": ""
  },
  "information_to_confirm": []
}`.trim();
}
