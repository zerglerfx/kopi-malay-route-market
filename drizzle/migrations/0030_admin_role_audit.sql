CREATE TABLE public.admin_role_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid NOT NULL,
  changed_by_email text NOT NULL DEFAULT '',
  target_user_id uuid NOT NULL,
  target_email text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (action IN ('grant','remove')),
  changed_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_role_audit IS 'Append-only log of admin role grants/removals. No FK so rows survive account deletion.';
GRANT SELECT ON public.admin_role_audit TO service_role;
ALTER TABLE public.admin_role_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_admin_role_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'admin_role_audit is append-only'; END $$;
CREATE TRIGGER admin_role_audit_no_update BEFORE UPDATE OR DELETE ON public.admin_role_audit FOR EACH ROW EXECUTE FUNCTION public.block_admin_role_audit_mutation();
CREATE TRIGGER admin_role_audit_no_truncate BEFORE TRUNCATE ON public.admin_role_audit FOR EACH STATEMENT EXECUTE FUNCTION public.block_admin_role_audit_mutation();

CREATE OR REPLACE FUNCTION public.set_admin_role_audited(_actor uuid, _actor_email text, _target uuid, _target_email text, _grant boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target AND role = 'owner') THEN
    RAISE EXCEPTION 'Owner accounts cannot be changed here';
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = 'admin';
  END IF;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN RETURN false; END IF;
  INSERT INTO public.admin_role_audit(changed_by, changed_by_email, target_user_id, target_email, action)
  VALUES (_actor, coalesce(_actor_email,''), _target, coalesce(_target_email,''), CASE WHEN _grant THEN 'grant' ELSE 'remove' END);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.set_admin_role_audited(uuid, text, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role_audited(uuid, text, uuid, text, boolean) TO service_role;