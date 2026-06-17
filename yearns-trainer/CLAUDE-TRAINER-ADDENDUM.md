# Yearns — Trainer system addendum
# Append this section to the main CLAUDE.md under a new heading.
# It documents the trainer module so Claude Code has full context.

---

## Trainer system (added v1.1)

Quality review infrastructure for the Yearns prompt iteration and
fine-tuning pipeline. Trainers are trusted internal users who read
generated stories, score them, annotate text spans, and submit
structured feedback that feeds into prompt improvements and the
gold corpus for fine-tuning.

### New files

| File | Purpose |
|---|---|
| `src/middleware.ts` | Protects /trainer and /api/trainer routes — checks role |
| `src/types/trainer.ts` | All TypeScript types for the trainer system |
| `src/app/api/trainer/reviews/route.ts` | GET queue · POST submit · GET stats |
| `src/app/api/trainer/queue/route.ts` | Admin: populate queue from generation_logs |
| `supabase/migrations/0006_trainer_system.sql` | trainer_reviews + story_queue tables + RLS |
| `supabase/migrations/0007_prompt_stats_function.sql` | update_prompt_version_stats() + quality view |

### New tables

| Table | Purpose |
|---|---|
| `trainer_reviews` | One review per trainer per story. Scores, annotations, corpus tag. |
| `story_queue` | Controls which stories trainers see. Supports blind review. |

### New DB functions

| Function | Purpose |
|---|---|
| `get_trainer_queue(trainer_id, limit)` | Returns next stories for a trainer, prioritised |
| `get_review_stats(version, model, lang)` | Aggregate quality metrics with optional filters |
| `update_prompt_version_stats(version)` | Updates prompt_versions.avg_score after a gold review |

### New view

`prompt_quality_leaderboard` — ranks all prompt versions by avg_score.
Use in admin dashboard to compare versions and decide which to promote.

### Build order for trainer system

- [ ] Run migrations 0006 and 0007
- [ ] Create Supabase Storage bucket: `trainer-stories` (private, service role only)
- [ ] Update logGeneration() to return inserted ID (needed for story text upload)
- [ ] Add story text upload to generate route (see comment in queue/route.ts)
- [ ] Build /trainer page using the dashboard mockup as reference
- [ ] Build /admin/queue page to trigger queue population
- [ ] Seed trainer accounts: UPDATE users SET role='trainer' WHERE email='...'

### Critical constraint

Trainer accounts must have age_verified = true before they can access
the dashboard. The middleware enforces this. Set it manually in Supabase
dashboard for each trainer account after they complete Veriff verification.

### Blind review

story_queue.blind_review = true (default) means the trainer sees the
story text only — prompt_version and model_used are hidden until after
they submit. This prevents confirmation bias (knowing it's Llama vs Claude
before scoring). The revealed metadata appears in the session stats response
after submission.

### Corpus pipeline (manual at V1)

Gold stories (corpus_tag = 'gold') are identified automatically when
avg_score >= 4.0 AND reread = true, or set manually by the trainer.

At V1: export gold stories periodically for fine-tuning prep:
  SELECT tr.story_id, gl.prompt_version, gl.model_used, gl.language,
         tr.scores, tr.avg_score
  FROM trainer_reviews tr
  JOIN generation_logs gl ON gl.id = tr.story_id
  WHERE tr.corpus_tag = 'gold'
  ORDER BY tr.avg_score DESC;

Story text for fine-tuning is fetched from Supabase Storage:
  trainer-stories/{story_id}.txt

At V2: automate this into a Together.ai fine-tuning job trigger.
