BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE ingestion_runs (
  id text PRIMARY KEY, source text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('running','complete','failed')),
  checkpoint jsonb NOT NULL DEFAULT '{}', policy jsonb NOT NULL
);
CREATE TABLE raw_records (
  id text PRIMARY KEY, run_id text NOT NULL REFERENCES ingestion_runs,
  external_id text NOT NULL, source_url text NOT NULL, payload jsonb NOT NULL,
  sha256 text NOT NULL, exclusions jsonb NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, external_id, sha256)
);
CREATE TABLE raw_artifacts (
  id text PRIMARY KEY, raw_id text NOT NULL REFERENCES raw_records, path text NOT NULL,
  sha256 text NOT NULL, policy jsonb NOT NULL
);
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable record'; END $$;
CREATE TRIGGER raw_immutable BEFORE UPDATE OR DELETE ON raw_records FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER artifact_immutable BEFORE UPDATE OR DELETE ON raw_artifacts FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TABLE staging_records (
  id text PRIMARY KEY, run_id text NOT NULL REFERENCES ingestion_runs,
  raw_id text NOT NULL REFERENCES raw_records, draft jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','needs_revision','rejected','expired')),
  reviewed_by text, reviewed_at timestamptz, reason text,
  CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(reason)>0))
);
CREATE TABLE approved_batches (
  version text PRIMARY KEY, snapshot jsonb NOT NULL, sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), reviewer text NOT NULL,
  CHECK (snapshot->'manifest'->>'publication' = 'approved'),
  CHECK (snapshot->'manifest'->>'version' = version)
);
CREATE TRIGGER batch_immutable BEFORE UPDATE OR DELETE ON approved_batches FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TABLE active_batch (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version text NOT NULL REFERENCES approved_batches, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE serving_resources (
  version text NOT NULL REFERENCES approved_batches, id text NOT NULL,
  resource jsonb NOT NULL, search_text text NOT NULL, embedding vector(768),
  embedding_model text, PRIMARY KEY(version,id),
  CHECK ((embedding IS NULL) = (embedding_model IS NULL))
);
CREATE INDEX resource_trgm ON serving_resources USING gin (search_text gin_trgm_ops);
CREATE INDEX resource_vector ON serving_resources USING hnsw (embedding vector_cosine_ops);
CREATE TABLE change_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor text NOT NULL, action text NOT NULL,
  record_id text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON change_log FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TABLE revalidation_queue (
  resource_id text PRIMARY KEY, version text NOT NULL REFERENCES approved_batches,
  reason text NOT NULL, due_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE ai_usage (
  model text NOT NULL, "window" text NOT NULL, requests integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0, PRIMARY KEY(model,"window")
);
COMMIT;
