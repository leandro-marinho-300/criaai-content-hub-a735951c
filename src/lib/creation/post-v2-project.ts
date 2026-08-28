import type { Json } from "@/integrations/supabase/types";
import {
  createSpecFromSignals,
  type SpecDecisionKey,
  type SpecSeedInput,
  type SpecState,
} from "@/lib/creation/spec";
import { isKnownProvenanceOrigin } from "@/lib/creation/provenance";

export const POST_V2_PROJECT_SCHEMA_VERSION = "1.0" as const;

type JsonRecord = { [key: string]: Json | undefined };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decisionToJson(state: SpecState, key: SpecDecisionKey): Json {
  const decision = state.decisions[key];
  if (!decision) return null;

  return {
    value: decision.value,
    provenance: {
      origin: decision.provenance.origin,
      source: decision.provenance.source,
      recordedAt: decision.provenance.recordedAt,
    },
  };
}

export function specToPostV2ProjectJson(state: SpecState): JsonRecord {
  return {
    schema_version: POST_V2_PROJECT_SCHEMA_VERSION,
    spec_schema_version: state.schemaVersion,
    decisions: {
      objective: decisionToJson(state, "objective"),
      approach: decisionToJson(state, "approach"),
      format: decisionToJson(state, "format"),
      concept: decisionToJson(state, "concept"),
    },
    updated_at: new Date().toISOString(),
  };
}

function parseDecisionSeed(
  decisions: Record<string, unknown>,
  key: SpecDecisionKey,
): SpecSeedInput[SpecDecisionKey] | undefined {
  const raw = asRecord(decisions[key]);
  if (!raw) return undefined;

  const value = nullableString(raw.value);
  if (!value) return undefined;

  const provenance = asRecord(raw.provenance);
  const rawOrigin = provenance?.origin;

  return {
    value,
    origin: isKnownProvenanceOrigin(rawOrigin) ? rawOrigin : "legacy_import",
    source: nullableString(provenance?.source) ?? "campaign_content_json.post_v2",
    recordedAt: nullableString(provenance?.recordedAt),
  };
}

export function getPostV2SpecFromCampaignJson(value: Json | null): SpecState | null {
  const root = asRecord(value);
  const stored = asRecord(root?.post_v2);
  const decisions = asRecord(stored?.decisions);
  if (!stored || !decisions) return null;

  const seed: SpecSeedInput = {};
  const objective = parseDecisionSeed(decisions, "objective");
  const approach = parseDecisionSeed(decisions, "approach");
  const format = parseDecisionSeed(decisions, "format");
  const concept = parseDecisionSeed(decisions, "concept");

  if (objective) seed.objective = objective;
  if (approach) seed.approach = approach;
  if (format) seed.format = format;
  if (concept) seed.concept = concept;

  const spec = createSpecFromSignals(seed);
  return Object.keys(spec.decisions).length ? spec : null;
}

export function mergePostV2SpecIntoCampaignJson(
  current: Json | null,
  state: SpecState,
): Json {
  const root = asRecord(current);
  const safeRoot: JsonRecord = root ? { ...(root as JsonRecord) } : {};

  return {
    ...safeRoot,
    post_v2: specToPostV2ProjectJson(state),
  };
}
