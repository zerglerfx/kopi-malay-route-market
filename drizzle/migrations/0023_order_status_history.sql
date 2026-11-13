CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_number text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  changed_by_email text NOT NULL DEFAULT '',
  from_status text,
  to_status text NOT NULL,
  tracking_number text,
  old_tracking_number text,
  pos_receipt_number text,
  notes text
);
COMMENT ON TABLE public.order_status_history IS 'Append-only audit trail. No FK to orders so history survives order deletion.';
CREATE INDEX order_status_history_order_idx ON public.order_status_history(order_id, changed_at);
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT SELECT, INSERT ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read order history" ON public.order_status_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.block_order_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'order_status_history is append-only'; END $$;
CREATE TRIGGER order_status_history_no_update BEFORE UPDATE OR DELETE ON public.order_status_history FOR EACH ROW EXECUTE FUNCTION public.block_order_history_mutation();
CREATE TRIGGER order_status_history_no_truncate BEFORE TRUNCATE ON public.order_status_history FOR EACH STATEMENT EXECUTE FUNCTION public.block_order_history_mutation();

-- Claim a pending order for verification before calling the POS. Returns the previous stock status, or NULL if not claimable.
CREATE OR REPLACE FUNCTION public.claim_order_verify(_id uuid, _claim uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; prev text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.status = 'pending_verification' AND o.stock_status IN ('not_deducted','restored') THEN prev := o.stock_status;
  ELSIF o.status = 'verifying' AND o.pos_claim_until < now() THEN prev := 'not_deducted';
  ELSE RETURN NULL; END IF;
  UPDATE public.orders SET status = 'verifying', stock_status = 'deducting', pos_claim_id = _claim, pos_claim_until = now() + interval '5 minutes' WHERE id = _id;
  RETURN prev;
END $$;

-- Status change + its history row in one transaction. Returns false when the order is no longer in _from (or claim mismatch).
CREATE OR REPLACE FUNCTION public.transition_order_status(_id uuid, _from text, _to text, _actor uuid, _actor_email text, _tracking text DEFAULT NULL, _pos_receipt text DEFAULT NULL, _notes text DEFAULT NULL, _claim uuid DEFAULT NULL, _deltas jsonb DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR o.status <> _from THEN RETURN false; END IF;
  IF _claim IS NOT NULL AND o.pos_claim_id IS DISTINCT FROM _claim THEN RETURN false; END IF;
  IF _from = _to AND _tracking IS NOT DISTINCT FROM o.tracking_number THEN RETURN true; END IF;
  UPDATE public.orders SET
    status = _to,
    tracking_number = COALESCE(_tracking, tracking_number),
    stock_status = CASE WHEN _deltas IS NOT NULL THEN 'deducted' ELSE stock_status END,
    stock_deducted_at = CASE WHEN _deltas IS NOT NULL THEN now() ELSE stock_deducted_at END,
    stock_deductions = COALESCE(_deltas, stock_deductions),
    pos_claim_id = CASE WHEN _claim IS NOT NULL THEN NULL ELSE pos_claim_id END,
    pos_claim_until = CASE WHEN _claim IS NOT NULL THEN NULL ELSE pos_claim_until END
  WHERE id = _id;
  INSERT INTO public.order_status_history(order_id, order_number, changed_by, changed_by_email, from_status, to_status, tracking_number, old_tracking_number, pos_receipt_number, notes)
  VALUES (_id, o.order_number, _actor, COALESCE(_actor_email, ''), CASE WHEN _from = 'verifying' THEN 'pending_verification' ELSE _from END, _to,
    COALESCE(_tracking, o.tracking_number),
    CASE WHEN _tracking IS NOT NULL AND o.tracking_number IS NOT NULL AND _tracking <> o.tracking_number THEN o.tracking_number END,
    _pos_receipt, _notes);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_order_verify(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_order_status(uuid, text, text, uuid, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_verify(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, text, uuid, text, text, text, text, uuid, jsonb) TO service_role;

-- Orders may only change through server functions (service role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;