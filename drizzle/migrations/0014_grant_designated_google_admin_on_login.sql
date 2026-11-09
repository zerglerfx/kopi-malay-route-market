CREATE FUNCTION public.designated_google_admin_matches(_email text, _confirmed_at timestamptz, _provider text, _identity_email text, _email_verified boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT COALESCE(lower(_email) = 'kopimalay22@gmail.com' AND _confirmed_at IS NOT NULL AND _provider = 'google' AND lower(_identity_email) = 'kopimalay22@gmail.com' AND _email_verified, false);
$$;
REVOKE ALL ON FUNCTION public.designated_google_admin_matches(text,timestamptz,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.designated_google_admin_matches(text,timestamptz,text,text,boolean) TO authenticated, service_role;
CREATE FUNCTION public.grant_designated_google_admin_on_login()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.last_sign_in_at IS NOT NULL AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND EXISTS (
   SELECT 1 FROM auth.identities i WHERE i.user_id = NEW.id AND public.designated_google_admin_matches(NEW.email, NEW.email_confirmed_at, i.provider, i.identity_data->>'email', (i.identity_data->>'email_verified') = 'true')
 ) THEN
   INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin') ON CONFLICT (user_id,role) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_designated_google_admin_on_login() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_google_login_grant_designated_admin AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_designated_google_admin_on_login();
DO $$
BEGIN
 IF NOT public.designated_google_admin_matches('kopimalay22@gmail.com', now(), 'google', 'kopimalay22@gmail.com', true) THEN RAISE EXCEPTION 'Verified designated Google account must qualify'; END IF;
 IF public.designated_google_admin_matches('other@gmail.com', now(), 'google', 'other@gmail.com', true) THEN RAISE EXCEPTION 'Other account must not qualify'; END IF;
 IF public.designated_google_admin_matches('kopimalay22@gmail.com', now(), 'email', 'kopimalay22@gmail.com', true) THEN RAISE EXCEPTION 'Email-only account must not qualify'; END IF;
 IF public.designated_google_admin_matches('kopimalay22@gmail.com', now(), 'google', 'kopimalay22@gmail.com', false) THEN RAISE EXCEPTION 'Unverified Google identity must not qualify'; END IF;
 IF public.designated_google_admin_matches('kopimalay22@gmail.com', now(), 'google', 'other@gmail.com', true) THEN RAISE EXCEPTION 'Mismatched Google identity must not qualify'; END IF;
END;
$$;