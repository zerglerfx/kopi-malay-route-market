CREATE TABLE public.owner_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  salt text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.owner_pins TO service_role;
ALTER TABLE public.owner_pins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.owner_pin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_pin_codes_user_created ON public.owner_pin_codes (user_id, created_at DESC);
GRANT ALL ON public.owner_pin_codes TO service_role;
ALTER TABLE public.owner_pin_codes ENABLE ROW LEVEL SECURITY;

-- Issue a code: max 5 per rolling hour per owner; older unused codes are invalidated.
CREATE FUNCTION public.issue_owner_pin_code(_user uuid, _hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_pin_code:' || _user::text));
  IF (SELECT count(*) FROM public.owner_pin_codes WHERE user_id = _user AND created_at > now() - interval '1 hour') >= 5 THEN
    RETURN NULL;
  END IF;
  UPDATE public.owner_pin_codes SET used_at = now() WHERE user_id = _user AND used_at IS NULL;
  INSERT INTO public.owner_pin_codes(user_id, code_hash, expires_at) VALUES (_user, _hash, now() + interval '10 minutes') RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Check a code atomically: correct -> consumed (single use); wrong -> attempts+1 (max 3).
CREATE FUNCTION public.check_owner_pin_code(_user uuid, _hash text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _row public.owner_pin_codes;
BEGIN
  UPDATE public.owner_pin_codes SET used_at = now()
   WHERE user_id = _user AND used_at IS NULL AND expires_at > now() AND attempts < 3 AND code_hash = _hash
   RETURNING * INTO _row;
  IF FOUND THEN RETURN 'ok'; END IF;
  UPDATE public.owner_pin_codes SET attempts = attempts + 1,
         used_at = CASE WHEN attempts + 1 >= 3 THEN now() ELSE used_at END
   WHERE user_id = _user AND used_at IS NULL AND expires_at > now() AND attempts < 3
   RETURNING * INTO _row;
  IF FOUND THEN RETURN CASE WHEN _row.attempts >= 3 THEN 'exhausted' ELSE 'wrong' END; END IF;
  RETURN 'none';
END $$;

-- Record a wrong PIN in one atomic update; 5 fails -> 15 minute lock.
CREATE FUNCTION public.register_owner_pin_failure(_user uuid)
RETURNS timestamptz LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.owner_pins SET
    failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
    locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
  WHERE user_id = _user
  RETURNING CASE WHEN locked_until > now() THEN locked_until ELSE NULL END;
$$;

REVOKE ALL ON FUNCTION public.issue_owner_pin_code(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_owner_pin_code(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_owner_pin_failure(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_owner_pin_code(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_owner_pin_code(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_owner_pin_failure(uuid) TO service_role;

-- Owner/admin enrollment: both designated emails, confirmed account + verified Google identity, at sign-in.
CREATE OR REPLACE FUNCTION public.designated_google_admin_matches(_email text, _confirmed_at timestamptz, _provider text, _identity_email text, _email_verified boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT COALESCE(lower(_email) IN ('kopimalay22@gmail.com','zerglerfx@gmail.com') AND _confirmed_at IS NOT NULL AND _provider = 'google' AND lower(_identity_email) = lower(_email) AND _email_verified, false);
$$;
CREATE OR REPLACE FUNCTION public.grant_designated_google_admin_on_login()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.last_sign_in_at IS NOT NULL AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND EXISTS (
   SELECT 1 FROM auth.identities i WHERE i.user_id = NEW.id AND public.designated_google_admin_matches(NEW.email, NEW.email_confirmed_at, i.provider, i.identity_data->>'email', (i.identity_data->>'email_verified') = 'true')
 ) THEN
   INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin'),(NEW.id,'owner') ON CONFLICT (user_id,role) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
-- Remove the unsafe insert-time grant (fired before email confirmation).
DROP TRIGGER IF EXISTS on_auth_user_grant_admin ON auth.users;

-- Backfill owner for the two existing, already-qualifying accounts.
INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'owner'::public.app_role FROM auth.users u
WHERE EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND public.designated_google_admin_matches(u.email, u.email_confirmed_at, i.provider, i.identity_data->>'email', (i.identity_data->>'email_verified') = 'true'))
ON CONFLICT (user_id, role) DO NOTHING;

DO $$ BEGIN
 IF NOT public.designated_google_admin_matches('zerglerfx@gmail.com', now(), 'google', 'zerglerfx@gmail.com', true) THEN RAISE EXCEPTION 'owner email must qualify'; END IF;
 IF public.designated_google_admin_matches('zerglerfx@gmail.com', now(), 'email', 'zerglerfx@gmail.com', true) THEN RAISE EXCEPTION 'email-only must not qualify'; END IF;
 IF public.designated_google_admin_matches('zerglerfx@gmail.com', NULL, 'google', 'zerglerfx@gmail.com', true) THEN RAISE EXCEPTION 'unconfirmed must not qualify'; END IF;
END $$;