import type { Tables } from "@/integrations/supabase/types";
import type { Reel2Draft } from "@/lib/reel2";

export type Reel2TopicEntityType = "destino" | "local" | "produto" | "servico" | "comportamento" | "evento" | "outro" | "desconhecido";

export interface Reel2TopicContext {
  topic: string;
  entityType: Reel2TopicEntityType;
  intent: string;
  confidence: "baixo" | "medio" | "alto";
  associations: string[];
  cautions: string[];
  doNotInvent: string[];
  userProvidedContext: boolean;
  safeMode: boolean;
  summary: string;
}

const QUESTION_PREFIX = /^(você sabe|voce sabe|sabe|o que|como|por que|porque|qual|quais|onde|quando)\b/i;

export function analyzeReel2TopicContext(draft: Reel2Draft, brand?: Pick<Tables<"brands">, "name" | "segment" | "description" | "audience"> | null): Reel2TopicContext {
  const source = [draft.central_idea, draft.promise, draft.extra_notes, draft.base_content, draft.trend_term, draft.reference_notes].filter(Boolean).join(" \n");
  const brandText = [brand?.name, brand?.segment, brand?.description, brand?.audience].filter(Boolean).join(" ").toLowerCase();
  const userAssociations = splitList(draft.topic_associations || "");
  const cautions = splitList(draft.topic_cautions || "");
  const doNotInvent = splitList(draft.topic_do_not_invent || "");
  const manualTopic = (draft.topic_entity || "").trim();
  const detected = detectTopic(source, brandText);
  const topic = manualTopic || detected.topic || shortClean(draft.central_idea || draft.promise || "este assunto");
  const manualEntityType = draft.topic_entity_type && draft.topic_entity_type !== "desconhecido" ? (draft.topic_entity_type as Reel2TopicEntityType) : "";
  const entityType = manualEntityType || detected.entityType;
  const intent = detectIntent(source);
  const userProvidedContext = Boolean(manualTopic || userAssociations.length || cautions.length || doNotInvent.length || manualEntityType);
  const confidence: Reel2TopicContext["confidence"] = userProvidedContext ? "alto" : detected.confidence;
  const safeMode = !userProvidedContext && confidence !== "alto";

  return {
    topic,
    entityType,
    intent,
    confidence,
    associations: userAssociations,
    cautions,
    doNotInvent,
    userProvidedContext,
    safeMode,
    summary: buildReel2TopicContextSummary({
      topic,
      entityType,
      intent,
      confidence,
      associations: userAssociations,
      cautions,
      doNotInvent,
      userProvidedContext,
      safeMode,
    }),
  };
}

export function buildReel2TopicContextSummary(context: Omit<Reel2TopicContext, "summary">): string {
  const base = `${context.topic} · ${labelEntityType(context.entityType)} · ${labelIntent(context.intent)}`;
  if (context.associations.length) return `${base} · associações: ${context.associations.slice(0, 4).join(", ")}`;
  if (context.safeMode) return `${base} · contexto baixo: gerar ganchos seguros, sem inventar detalhes específicos.`;
  return base;
}

export function buildReel2TopicContextPrompt(draft: Reel2Draft, brand?: Pick<Tables<"brands">, "name" | "segment" | "description" | "audience" | "tone_of_voice"> | null): string {
  const context = analyzeReel2TopicContext(draft, brand);
  const idea = draft.central_idea?.trim() || "não informado";
  const promise = draft.promise?.trim() || "não informada; use a ideia central e a intenção como base";
  const notes = draft.extra_notes?.trim() || "não informado";
  const currentAssociations = splitList(draft.topic_associations || "");
  const currentCautions = splitList(draft.topic_cautions || "");
  const currentDoNotInvent = splitList(draft.topic_do_not_invent || "");

  return `Analise o tema abaixo para ajudar o Cria Aí a criar Reels sem usar IA interna.\n\nIMPORTANTE:\n- Não escreva o roteiro completo.\n- Não invente preços, datas, promessas, disponibilidade, atrações específicas, eventos, horários ou fatos que precisem de confirmação.\n- Use apenas contexto geral seguro e indique o que precisa ser confirmado.\n- O objetivo é enriquecer o contexto do tema para gerar ganchos melhores.\n- Depois este JSON será colado no campo “Importar contexto enriquecido” do Cria Aí.\n- Devolva SOMENTE JSON válido, sem markdown e sem comentários.\n\nMARCA:\nNome: ${brand?.name || ""}\nSegmento: ${brand?.segment || ""}\nDescrição: ${brand?.description || ""}\nPúblico: ${brand?.audience || ""}\nTom: ${brand?.tone_of_voice || ""}\n\nTEMA/PROMESSA:\nIdeia central: ${idea}\nPromessa: ${promise}\nObservações: ${notes}\n\nCONTEXTO JÁ INFORMADO PELO USUÁRIO:\nAssunto principal: ${draft.topic_entity || context.topic || ""}\nTipo do assunto: ${draft.topic_entity_type || labelEntityType(context.entityType)}\nPalavras associadas: ${currentAssociations.length ? currentAssociations.join(", ") : "não informado"}\nCuidados/ângulos a evitar: ${currentCautions.length ? currentCautions.join(", ") : "não informado"}\nNão inventar: ${currentDoNotInvent.length ? currentDoNotInvent.join(", ") : "não informado"}\n\nINTERPRETAÇÃO INICIAL DO CRIA AÍ:\nAssunto: ${context.topic}\nTipo: ${labelEntityType(context.entityType)}\nIntenção: ${labelIntent(context.intent)}\nNível de contexto: ${context.confidence}\n\nFormato obrigatório de resposta:\n{\n  "topic_entity": "",\n  "topic_entity_type": "destino | local | produto | servico | comportamento | evento | outro",\n  "topic_associations": [""],\n  "topic_cautions": [""],\n  "topic_do_not_invent": [""],\n  "safe_angles_for_hooks": [""],\n  "unsafe_or_unconfirmed_angles": [""]\n}`;
}

function detectTopic(source: string, brandText: string): { topic: string; entityType: Reel2TopicEntityType; confidence: Reel2TopicContext["confidence"] } {
  const clean = source.replace(/\s+/g, " ").trim();
  const destinationMatch = clean.match(/(?:em|para|pra|no|na|nos|nas)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]+(?:\s+(?:do|da|dos|das|de|d'|e|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]+)){0,5})/);
  if (destinationMatch?.[1]) {
    const topic = cleanupTopic(destinationMatch[1]);
    if (topic && !isGenericTopic(topic)) return { topic, entityType: /viagem|turismo|travel|destino|férias|roteiro/.test(brandText) ? "destino" : "local", confidence: "medio" };
  }

  const titleCase = clean.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]+(?:\s+(?:do|da|dos|das|de|d'|e|[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ'-]+)){1,5})/);
  if (titleCase?.[1]) {
    const topic = cleanupTopic(titleCase[1]);
    if (topic && !isGenericTopic(topic)) return { topic, entityType: /viagem|turismo|travel|destino|férias|roteiro/.test(brandText) ? "destino" : "outro", confidence: "medio" };
  }

  if (/cachorro|canino|pet|tutor|rosn|passeio|guia|desconfort/i.test(clean)) return { topic: shortClean(clean), entityType: "comportamento", confidence: "medio" };
  return { topic: shortClean(clean || "este assunto"), entityType: "desconhecido", confidence: "baixo" };
}

function detectIntent(source: string): string {
  const s = normalize(source);
  if (/o que fazer|fazer em|passeios?|lugares?|roteiro|onde ir/.test(s)) return "o_que_fazer";
  if (/cuidado|alerta|nao|não|erro|risco|evitar/.test(s)) return "alerta";
  if (/por que|porque|motivo|causa/.test(s)) return "explicar_causa";
  if (/como|passo|checklist|organizar|planejar/.test(s)) return "passo_a_passo";
  if (QUESTION_PREFIX.test(source.trim())) return "responder_duvida";
  return "orientar";
}

export function labelIntent(intent: string) {
  const map: Record<string, string> = {
    o_que_fazer: "mostrar o que fazer / orientar roteiro",
    alerta: "alertar sobre cuidado ou risco",
    explicar_causa: "explicar causa ou motivo",
    passo_a_passo: "ensinar passo a passo",
    responder_duvida: "responder dúvida do público",
    orientar: "orientar decisão",
  };
  return map[intent] || intent;
}

export function labelEntityType(type: Reel2TopicEntityType) {
  const map: Record<Reel2TopicEntityType, string> = {
    destino: "destino",
    local: "local",
    produto: "produto",
    servico: "serviço",
    comportamento: "comportamento",
    evento: "evento",
    outro: "outro assunto",
    desconhecido: "assunto pouco contextualizado",
  };
  return map[type] || type;
}

function splitList(value: string) {
  return value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function cleanupTopic(value: string) {
  return value
    .replace(/[?.!,;:]+$/g, "")
    .replace(/\b(antes|depois|confira|veja|sabe|fazer|roteiro|viagem|destino)$/i, "")
    .trim();
}

function isGenericTopic(value: string) {
  return /^(sua|seu|minha|meu|próxima|proxima|viagem|destino|roteiro|teste|pergunta|dica)$/i.test(value.trim());
}

function shortClean(value: string) {
  const clean = value.replace(/\s+/g, " ").replace(/^ex\.?:\s*/i, "").trim();
  if (!clean) return "este assunto";
  return clean.length > 80 ? `${clean.slice(0, 77).trim()}...` : clean;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
