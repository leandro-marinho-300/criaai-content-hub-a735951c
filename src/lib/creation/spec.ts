import {
  PROVENANCE_SCHEMA_VERSION,
  type DecisionProvenance,
  type KnownProvenanceOrigin,
  type StrategyDecisionKey,
  type StrategyProvenance,
} from "@/lib/creation/provenance";
import type { StrategyVersionInput } from "@/lib/creation/strategy";
import {
  mapLegacyApproachToCanonical,
  mapLegacyFormatToCanonical,
  mapLegacyObjectiveToCanonical,
  normalizeCreationApproach,
  normalizeCreationConcept,
  normalizeCreationFormat,
  normalizeCreationObjective,
  type CreationApproach,
  type CreationFormat,
  type CreationObjective,
} from "@/lib/creation/taxonomy";

/**
 * $Spec V2 — minimum creative decisions.
 *
 * Objective, Approach, Format and Concept are the maximum set of decisions the
 * orchestration may need, not four mandatory questions/screens. A decision that
 * is already safely resolved is never requested again.
 *
 * This module does not generate creative recommendations by itself. When the
 * user asks Cria Aí to decide, a recommendation must be supplied by a separate
 * rule/strategy executor and is then recorded here as system_recommendation.
 */
export const SPEC_SCHEMA_VERSION = "1.0" as const;

export const SPEC_DECISION_ORDER = [
  "objective",
  "approach",
  "format",
  "concept",
] as const satisfies ReadonlyArray<StrategyDecisionKey>;

export type SpecDecisionKey = (typeof SPEC_DECISION_ORDER)[number];
export type SpecResolutionMode = "ask_user" | "recommend";

export type SpecDecisionValueMap = {
  objective: CreationObjective;
  approach: CreationApproach;
  format: CreationFormat;
  concept: string;
};

export type SpecDecision<K extends SpecDecisionKey = SpecDecisionKey> = {
  key: K;
  value: SpecDecisionValueMap[K];
  provenance: DecisionProvenance;
};

export type SpecDecisions = {
  [K in SpecDecisionKey]?: SpecDecision<K>;
};

export type SpecState = {
  schemaVersion: string;
  decisions: SpecDecisions;
};

export type SpecDecisionSeed<K extends SpecDecisionKey = SpecDecisionKey> = {
  key: K;
  value: string | null | undefined;
  origin: KnownProvenanceOrigin;
  source?: string | null;
  recordedAt?: string | null;
};

export type SpecSeedInput = Partial<{
  objective: Omit<SpecDecisionSeed<"objective">, "key">;
  approach: Omit<SpecDecisionSeed<"approach">, "key">;
  format: Omit<SpecDecisionSeed<"format">, "key">;
  concept: Omit<SpecDecisionSeed<"concept">, "key">;
}>;

export type SpecResolutionPlan = {
  unresolved: SpecDecisionKey[];
  nextDecision: SpecDecisionKey | null;
  modeByDecision: Partial<Record<SpecDecisionKey, SpecResolutionMode>>;
};

export type SpecStrategySeed = Pick<
  StrategyVersionInput,
  "objective" | "approach" | "format" | "concept" | "provenance"
>;

const EXPLICIT_OBJECTIVE_ALIASES: ReadonlyArray<{
  value: CreationObjective;
  aliases: readonly string[];
}> = [
  { value: "engage", aliases: ["engajar"] },
  { value: "convert", aliases: ["converter"] },
  {
    value: "inform_position",
    aliases: ["informar e posicionar", "informar & posicionar"],
  },
];

const EXPLICIT_APPROACH_ALIASES: ReadonlyArray<{
  value: CreationApproach;
  aliases: readonly string[];
}> = [
  { value: "viral", aliases: ["viral"] },
  { value: "educational", aliases: ["educativo", "educativa"] },
  { value: "community", aliases: ["comunidade"] },
  { value: "offer", aliases: ["oferta"] },
  { value: "storytelling", aliases: ["storytelling"] },
  { value: "social_proof", aliases: ["prova social"] },
];

const EXPLICIT_FORMAT_ALIASES: ReadonlyArray<{
  value: CreationFormat;
  aliases: readonly string[];
}> = [
  { value: "post", aliases: ["post"] },
  { value: "carousel", aliases: ["carrossel", "carousel"] },
  { value: "reel", aliases: ["reel", "reels"] },
  { value: "story", aliases: ["story"] },
  {
    value: "story_sequence",
    aliases: ["sequencia de stories", "sequencia stories"],
  },
  {
    value: "whatsapp_status",
    aliases: ["status do whatsapp", "status whatsapp"],
  },
  { value: "banner", aliases: ["banner"] },
  { value: "announcement", aliases: ["comunicado"] },
  { value: "group_text", aliases: ["texto para grupo"] },
  { value: "print", aliases: ["material impresso"] },
];

function normalizeSignalText(value: string): string {
  return ` ${value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function findSingleExplicitSignal<T extends string>(
  normalizedText: string,
  definitions: ReadonlyArray<{ value: T; aliases: readonly string[] }>,
): T | null {
  const matches = new Set<T>();

  for (const definition of definitions) {
    if (
      definition.aliases.some((alias) =>
        normalizedText.includes(normalizeSignalText(alias)),
      )
    ) {
      matches.add(definition.value);
    }
  }

  return matches.size === 1 ? [...matches][0]! : null;
}

function normalizeSpecDecisionValue<K extends SpecDecisionKey>(
  key: K,
  rawValue: string | null | undefined,
): SpecDecisionValueMap[K] | null {
  switch (key) {
    case "objective": {
      const value =
        normalizeCreationObjective(rawValue) ??
        mapLegacyObjectiveToCanonical(rawValue);
      return value as SpecDecisionValueMap[K] | null;
    }
    case "approach": {
      const value =
        normalizeCreationApproach(rawValue) ??
        mapLegacyApproachToCanonical(rawValue);
      return value as SpecDecisionValueMap[K] | null;
    }
    case "format": {
      const value =
        normalizeCreationFormat(rawValue) ?? mapLegacyFormatToCanonical(rawValue);
      return value as SpecDecisionValueMap[K] | null;
    }
    case "concept": {
      const value = normalizeCreationConcept(rawValue);
      return value as SpecDecisionValueMap[K] | null;
    }
  }
}

function buildDecisionProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  recordedAt?: string | null;
}): DecisionProvenance {
  return {
    origin: input.origin,
    source: input.source?.trim() || null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

function withDecision<K extends SpecDecisionKey>(
  state: SpecState,
  input: SpecDecisionSeed<K>,
  options?: { ignoreInvalid?: boolean },
): SpecState {
  const value = normalizeSpecDecisionValue(input.key, input.value);
  if (value === null) {
    if (options?.ignoreInvalid) return state;
    throw new Error(`Invalid or ambiguous $Spec value for ${input.key}.`);
  }

  return {
    ...state,
    decisions: {
      ...state.decisions,
      [input.key]: {
        key: input.key,
        value,
        provenance: buildDecisionProvenance(input),
      },
    },
  };
}

export function createEmptySpec(): SpecState {
  return {
    schemaVersion: SPEC_SCHEMA_VERSION,
    decisions: {},
  };
}

/**
 * Seeds all decisions that are already known from the user's entry/context.
 * Unknown or ambiguous legacy values are intentionally left unresolved.
 */
export function createSpecFromSignals(input: SpecSeedInput = {}): SpecState {
  let state = createEmptySpec();

  for (const key of SPEC_DECISION_ORDER) {
    const seed = input[key] as Omit<SpecDecisionSeed, "key"> | undefined;
    if (!seed) continue;
    state = withDecision(state, { key, ...seed }, { ignoreInvalid: true });
  }

  return state;
}

/**
 * Extracts only explicit, unambiguous canonical signals from a short user text.
 * It deliberately does not guess Concept and leaves conflicting mentions open.
 * Examples: "Criar Reel" resolves Format; "carrossel educativo" resolves
 * Format + Approach.
 */
export function createSpecFromExplicitText(input: {
  text: string;
  source?: string | null;
  recordedAt?: string | null;
}): SpecState {
  const normalizedText = normalizeSignalText(input.text);
  const objective = findSingleExplicitSignal(
    normalizedText,
    EXPLICIT_OBJECTIVE_ALIASES,
  );
  const approach = findSingleExplicitSignal(
    normalizedText,
    EXPLICIT_APPROACH_ALIASES,
  );
  const format = findSingleExplicitSignal(
    normalizedText,
    EXPLICIT_FORMAT_ALIASES,
  );

  return createSpecFromSignals({
    objective: objective
      ? {
          value: objective,
          origin: "human",
          source: input.source ?? "explicit_text",
          recordedAt: input.recordedAt,
        }
      : undefined,
    approach: approach
      ? {
          value: approach,
          origin: "human",
          source: input.source ?? "explicit_text",
          recordedAt: input.recordedAt,
        }
      : undefined,
    format: format
      ? {
          value: format,
          origin: "human",
          source: input.source ?? "explicit_text",
          recordedAt: input.recordedAt,
        }
      : undefined,
  });
}

/**
 * Applies an explicit decision. This may replace a previous recommendation,
 * allowing a later user choice to win before Strategy Version creation.
 */
export function applySpecDecision<K extends SpecDecisionKey>(
  state: SpecState,
  input: SpecDecisionSeed<K>,
): SpecState {
  return withDecision(state, input);
}

/**
 * Records a system recommendation only for an unresolved decision. It never
 * overwrites a value already supplied/resolved from user context.
 */
export function applySpecRecommendation<K extends SpecDecisionKey>(
  state: SpecState,
  input: {
    key: K;
    value: string;
    source?: string | null;
    recordedAt?: string | null;
  },
): SpecState {
  if (state.decisions[input.key]) return state;

  return withDecision(state, {
    ...input,
    origin: "system_recommendation",
  });
}

export function getSpecDecision<K extends SpecDecisionKey>(
  state: SpecState,
  key: K,
): SpecDecision<K> | null {
  return (state.decisions[key] as SpecDecision<K> | undefined) ?? null;
}

export function getUnresolvedSpecDecisions(state: SpecState): SpecDecisionKey[] {
  return SPEC_DECISION_ORDER.filter((key) => !state.decisions[key]);
}

export function getNextSpecDecision(state: SpecState): SpecDecisionKey | null {
  return getUnresolvedSpecDecisions(state)[0] ?? null;
}

export function isSpecComplete(state: SpecState): boolean {
  return getNextSpecDecision(state) === null;
}

/**
 * Produces the orchestration plan without turning decisions into fixed screens.
 * recommendUnresolved=true means the user asked Cria Aí to decide the remaining
 * choices; otherwise only the next unresolved decision needs to be asked.
 */
export function buildSpecResolutionPlan(
  state: SpecState,
  options?: { recommendUnresolved?: boolean },
): SpecResolutionPlan {
  const unresolved = getUnresolvedSpecDecisions(state);
  const modeByDecision: SpecResolutionPlan["modeByDecision"] = {};

  if (options?.recommendUnresolved) {
    for (const key of unresolved) modeByDecision[key] = "recommend";
  } else if (unresolved[0]) {
    modeByDecision[unresolved[0]] = "ask_user";
  }

  return {
    unresolved,
    nextDecision: unresolved[0] ?? null,
    modeByDecision,
  };
}

function buildStrategyProvenanceFromSpec(state: SpecState): StrategyProvenance {
  const decisions: StrategyProvenance["decisions"] = {};
  const origins = new Set<KnownProvenanceOrigin>();
  let latestRecordedAt: string | null = null;

  for (const key of SPEC_DECISION_ORDER) {
    const decision = state.decisions[key];
    if (!decision) continue;

    decisions[key] = { ...decision.provenance };
    origins.add(decision.provenance.origin as KnownProvenanceOrigin);

    const recordedAt = decision.provenance.recordedAt;
    if (recordedAt && (!latestRecordedAt || recordedAt > latestRecordedAt)) {
      latestRecordedAt = recordedAt;
    }
  }

  const [singleOrigin] = [...origins];

  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: origins.size === 1 && singleOrigin ? singleOrigin : "unknown",
    source: "spec_v2",
    recordedAt: latestRecordedAt,
    decisions,
  };
}

/**
 * Returns the resolved creative decisions in the exact shape expected by the
 * Strategy Version foundation. It refuses incomplete Specs instead of inventing
 * missing decisions.
 */
export function buildStrategySeedFromSpec(state: SpecState): SpecStrategySeed {
  const unresolved = getUnresolvedSpecDecisions(state);
  if (unresolved.length > 0) {
    throw new Error(
      `Cannot build Strategy seed from incomplete $Spec. Missing: ${unresolved.join(", ")}.`,
    );
  }

  return {
    objective: getSpecDecision(state, "objective")!.value,
    approach: getSpecDecision(state, "approach")!.value,
    format: getSpecDecision(state, "format")!.value,
    concept: getSpecDecision(state, "concept")!.value,
    provenance: buildStrategyProvenanceFromSpec(state),
  };
}
