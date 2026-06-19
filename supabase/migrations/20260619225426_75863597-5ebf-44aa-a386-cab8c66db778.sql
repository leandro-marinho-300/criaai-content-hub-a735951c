ALTER TABLE public.content_ideas
  ADD COLUMN IF NOT EXISTS approach TEXT,
  ADD COLUMN IF NOT EXISTS compatibility_level TEXT,
  ADD COLUMN IF NOT EXISTS compatibility_reason TEXT,
  ADD COLUMN IF NOT EXISTS applied_fallback_level INTEGER NOT NULL DEFAULT 0;