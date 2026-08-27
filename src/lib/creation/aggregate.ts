import type { Tables, TablesInsert } from "@/integrations/supabase/types";

/**
 * Canonical schema version for the first Cria Aí Creation V2 aggregate contract.
 *
 * The Creation ID is still content_projects.id. The creation_core row is only
 * the V2 canonical anchor associated 1:1 with that existing operational envelope.
 */
export const CREATION_SCHEMA_VERSION = "2.0" as const;

export type CreationId = string;

export type CreationAggregate = {
  id: CreationId;
  schemaVersion: string;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
};

export function buildCreationCoreInsert(projectId: CreationId): TablesInsert<"creation_core"> {
  return {
    project_id: projectId,
    schema_version: CREATION_SCHEMA_VERSION,
    aggregate_version: 1,
  };
}

export function toCreationAggregate(row: Tables<"creation_core">): CreationAggregate {
  return {
    id: row.project_id,
    schemaVersion: row.schema_version,
    aggregateVersion: row.aggregate_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isCreationV2(
  row: Pick<Tables<"creation_core">, "schema_version"> | null | undefined,
): boolean {
  return row?.schema_version.startsWith("2.") ?? false;
}
