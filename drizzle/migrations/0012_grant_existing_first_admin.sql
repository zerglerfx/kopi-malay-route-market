INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'zerglerfx@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.users.id AND r.role = 'admin');