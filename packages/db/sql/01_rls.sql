-- =============================================================================
-- RLS policies — aplicar TRAS prisma migrate deploy.
-- Idempotente: usa DO/IF NOT EXISTS y DROP POLICY IF EXISTS.
-- =============================================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    WHERE c.column_name = 'business_id'
      AND c.table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
        USING (business_id = current_setting(''app.current_business_id'', true)::uuid)
        WITH CHECK (business_id = current_setting(''app.current_business_id'', true)::uuid)',
      t
    );
  END LOOP;
END$$;
