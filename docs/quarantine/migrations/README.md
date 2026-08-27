# Quarantined migrations

This directory contains SQL files intentionally removed from the active Supabase migration chain.

## 20260625030000_pickup_packaging_and_smart_schedule.sql

- Origin: unrelated medication-management domain.
- Status in Cria Aí database at stabilization time: not applied.
- Action: quarantined only; no DROP, rollback SQL, or medication-related database change was executed.
- Do not move this file back to `supabase/migrations/` unless a future audit proves it belongs to this project.
