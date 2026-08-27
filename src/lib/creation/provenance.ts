import type { Json } from "@/integrations/supabase/types";

export const PROVENANCE_SCHEMA_VERSION = "1.0" as const;

export const KNOWN_PROVENANCE_ORIGINS = [
  "human",
  "system_recommendation",
  "external_manual",
  "legacy_import",
] as const;

export type KnownProvenanceOrigin = (typeof KNOWN_PROVENANCE_ORIGINS)[number];
export type ProvenanceOrigin = KnownProvenanceOrigin | "unknown";

export const STRATEGY_DECISION_KEYS = [
  "objective",
  "approach",
  "format",
  "concept",
] as const;

export type StrategyDecisionKey = (typeof STRATEGY_DECISION_KEYS)[number];

export type DecisionProvenance = {
  origin: ProvenanceOrigin;
  source: string | null;
  recordedAt: string | null;
};

export type StrategyProvenance = {
  schemaVersion: string;
  origin: ProvenanceOrigin;
  source: string | null;
  recordedAt: string | null;
  decisions: Partial<Record<StrategyDecisionKey, DecisionProvenance>>;
};

const ORIGINS = new Set<string>(KNOWN_PROVENANCE_ORIGINS);
const DECISION_KEYS = new Set<string>(STRATEGY_DECISION_KEYS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isKnownProvenanceOrigin(
  value: unknown,
): value is KnownProvenanceOrigin {
  return typeof value === "string" && ORIGINS.has(value);
}

function normalizeOrigin(value: unknown): ProvenanceOrigin {
  return isKnownProvenanceOrigin(value) ? value : "unknown";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDecisionProvenance(value: unknown): DecisionProvenance | null {
  if (!isRecord(value)) return null;

  return {
    origin: normalizeOrigin(value.origin),
    source: nullableString(value.source),
    recordedAt: nullableString(value.recordedAt),
  };
}

export function buildStrategyProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  recordedAt?: string | null;
  decisions?: Partial<
    Record<
      StrategyDecisionKey,
      {
        origin: KnownProvenanceOrigin;
        source?: string | null;
        recordedAt?: string | null;
      }
    >
  >;
}): StrategyProvenance {
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const decisions: StrategyProvenance["decisions"] = {};

  for (const key of STRATEGY_DECISION_KEYS) {
    const decision = input.decisions?.[key];
    if (!decision) continue;

    decisions[key] = {
      origin: decision.origin,
      source: decision.source?.trim() || null,
      recordedAt: decision.recordedAt ?? recordedAt,
    };
  }

  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: input.origin,
    source: input.source?.trim() || null,
    recordedAt,
    decisions,
  };
}

/**
 * Reads provenance already stored in JSONB without fabricating a known origin.
 * Historical/empty payloads become origin "unknown" until a later version is created.
 */
export function parseStrategyProvenance(value: Json): StrategyProvenance {
  if (!isRecord(value)) {
    return {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      origin: "unknown",
      source: null,
      recordedAt: null,
      decisions: {},
    };
  }

  const decisions: StrategyProvenance["decisions"] = {};
  if (isRecord(value.decisions)) {
    for (const [key, raw] of Object.entries(value.decisions)) {
      if (!DECISION_KEYS.has(key)) continue;
      const parsed = parseDecisionProvenance(raw);
      if (parsed) decisions[key as StrategyDecisionKey] = parsed;
    }
  }

  return {
    schemaVersion:
      nullableString(value.schemaVersion) ?? PROVENANCE_SCHEMA_VERSION,
    origin: normalizeOrigin(value.origin),
    source: nullableString(value.source),
    recordedAt: nullableString(value.recordedAt),
    decisions,
  };
}

export function strategyProvenanceToJson(
  provenance: StrategyProvenance,
): Json {
  return {
    schemaVersion: provenance.schemaVersion,
    origin: provenance.origin,
    source: provenance.source,
    recordedAt: provenance.recordedAt,
    decisions: Object.fromEntries(
      Object.entries(provenance.decisions).map(([key, decision]) => [
        key,
        decision
          ? {
              origin: decision.origin,
              source: decision.source,
              recordedAt: decision.recordedAt,
            }
          : null,
      ]),
    ),
  };
}
