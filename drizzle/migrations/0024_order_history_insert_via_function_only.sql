REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.order_status_history FROM service_role, authenticated, anon;
ALTER TABLE public.order_status_history DISABLE TRIGGER order_status_history_no_update;
DELETE FROM public.order_status_history WHERE order_number = 'TEST' AND to_status = 'x' AND changed_by_email = '';
ALTER TABLE public.order_status_history ENABLE TRIGGER order_status_history_no_update;