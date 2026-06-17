-- Yearns — Migration 0007: Prompt version quality stats updater
-- Called after each gold review submission to keep prompt_versions
-- quality metrics current without a full table scan.

CREATE OR REPLACE FUNCTION public.update_prompt_version_stats(
  p_version TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg    NUMERIC;
  v_count  INTEGER;
BEGIN
  IF p_version IS NULL THEN RETURN; END IF;

  SELECT
    ROUND(AVG(avg_score), 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM public.trainer_reviews
  WHERE prompt_version = p_version;

  UPDATE public.prompt_versions
  SET
    avg_score    = v_avg,
    sample_count = v_count
  WHERE version = p_version;
END;
$$;

-- Convenience view: prompt quality leaderboard
-- Useful for the admin dashboard to compare prompt versions at a glance.
CREATE OR REPLACE VIEW public.prompt_quality_leaderboard AS
  SELECT
    pv.version,
    pv.avg_score,
    pv.sample_count,
    pv.is_active,
    pv.deployed_at,
    pv.description,
    COUNT(tr.id) FILTER (WHERE tr.corpus_tag = 'gold')    AS gold_count,
    COUNT(tr.id) FILTER (WHERE tr.corpus_tag = 'discard') AS discard_count,
    ROUND(AVG(tr.reread::int::numeric) * 100, 1)          AS reread_rate_pct,
    -- Top failure code for this version
    (
      SELECT unnest(failure_codes) AS code
      FROM public.trainer_reviews
      WHERE prompt_version = pv.version
      GROUP BY code
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_failure_code
  FROM public.prompt_versions pv
  LEFT JOIN public.trainer_reviews tr ON tr.prompt_version = pv.version
  GROUP BY pv.version, pv.avg_score, pv.sample_count, pv.is_active,
           pv.deployed_at, pv.description
  ORDER BY pv.avg_score DESC NULLS LAST;

COMMENT ON VIEW public.prompt_quality_leaderboard IS
  'Aggregated quality metrics per prompt version. Used by admin dashboard.';
