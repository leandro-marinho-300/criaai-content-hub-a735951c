import type { Tables } from "@/integrations/supabase/types";
import { createPost2Draft, type Post2Draft, type Post2ImportedContent } from "@/lib/post2";

export interface Post2ProjectSnapshot {
  source: "post_2_0";
  schema_version: "post2-v2";
  post2: Post2Draft;
  generated_content: Post2ImportedContent | null;
  caption: {
    text: string;
    hashtags: string[];
  };
  layout_prompt: string;
  created_at?: string;
  updated_at?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getPost2ProjectSnapshot(
  project: Pick<Tables<"content_projects">, "campaign_content_json">,
): Post2ProjectSnapshot | null {
  const root = asRecord(project.campaign_content_json);
  if (!root) return null;
  const source = typeof root.source === "string" ? root.source : "";
  if (source !== "post_2_0" && source !== "post2") return null;

  const storedDraft = asRecord(root.post2);
  if (!storedDraft) return null;
  const draft = {
    ...createPost2Draft(),
    ...(storedDraft as Partial<Post2Draft>),
    version: 2,
  } satisfies Post2Draft;
  const generated = asRecord(root.generated_content) ?? asRecord(storedDraft.imported_content);
  const captionRoot = asRecord(root.caption);

  return {
    source: "post_2_0",
    schema_version: "post2-v2",
    post2: draft,
    generated_content: generated as unknown as Post2ImportedContent | null,
    caption: {
      text:
        typeof captionRoot?.text === "string"
          ? captionRoot.text
          : draft.caption,
      hashtags: Array.isArray(captionRoot?.hashtags)
        ? captionRoot.hashtags.filter((item): item is string => typeof item === "string")
        : draft.hashtags.split(/\s+/).filter(Boolean),
    },
    layout_prompt: typeof root.layout_prompt === "string" ? root.layout_prompt : "",
    created_at: typeof root.created_at === "string" ? root.created_at : undefined,
    updated_at: typeof root.updated_at === "string" ? root.updated_at : undefined,
  };
}

export function isPost2Project(
  project: Pick<Tables<"content_projects">, "campaign_content_json">,
) {
  return Boolean(getPost2ProjectSnapshot(project));
}
