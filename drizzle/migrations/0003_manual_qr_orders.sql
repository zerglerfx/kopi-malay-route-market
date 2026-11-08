ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_token text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders(order_number);
COMMENT ON COLUMN public.orders.stripe_session_id IS 'DEPRECATED: payments now via manual DuitNow QR';
COMMENT ON COLUMN public.orders.stripe_payment_intent_id IS 'DEPRECATED: payments now via manual DuitNow QR';