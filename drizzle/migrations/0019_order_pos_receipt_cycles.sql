ALTER TABLE public.orders ADD COLUMN promo_snapshot jsonb;
CREATE TABLE public.order_pos_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), cycle integer NOT NULL, kind text NOT NULL CHECK (kind IN ('sale','refund')), state text NOT NULL DEFAULT 'ready', receipt_number text, original_receipt_number text, payload jsonb NOT NULL DEFAULT '{}'::jsonb, total_thb numeric, promo_thb numeric, confirmed_by uuid, return_to_stock boolean, writeoff_state text NOT NULL DEFAULT 'none', writeoff_targets jsonb, error text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(order_id,cycle,kind), UNIQUE(receipt_number)
);
GRANT ALL ON public.order_pos_operations TO service_role;
ALTER TABLE public.order_pos_operations ENABLE ROW LEVEL SECURITY;
CREATE INDEX order_pos_operations_order_idx ON public.order_pos_operations(order_id,cycle);
COMMENT ON TABLE public.order_pos_operations IS 'Private durable POS sale/refund intents, receipt history and audited THB promo confirmations; no client writes.';