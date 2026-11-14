ALTER TABLE public.order_status_history ADD COLUMN reason text;
ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_reason_len CHECK (reason IS NULL OR char_length(reason) <= 200);

DROP FUNCTION public.transition_order_status(uuid, text, text, uuid, text, text, text, text, uuid, jsonb);

CREATE FUNCTION public.transition_order_status(_id uuid, _from text, _to text, _actor uuid, _actor_email text, _tracking text DEFAULT NULL, _pos_receipt text DEFAULT NULL, _notes text DEFAULT NULL, _claim uuid DEFAULT NULL, _deltas jsonb DEFAULT NULL, _reason text DEFAULT NULL)
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
  INSERT INTO public.order_status_history(order_id, order_number, changed_by, changed_by_email, from_status, to_status, tracking_number, old_tracking_number, pos_receipt_number, notes, reason)
  VALUES (_id, o.order_number, _actor, COALESCE(_actor_email, ''), CASE WHEN _from = 'verifying' THEN 'pending_verification' ELSE _from END, _to,
    COALESCE(_tracking, o.tracking_number),
    CASE WHEN _tracking IS NOT NULL AND o.tracking_number IS NOT NULL AND _tracking <> o.tracking_number THEN o.tracking_number END,
    _pos_receipt, _notes,
    CASE WHEN _to = 'rejected' THEN NULLIF(btrim(_reason), '') ELSE NULL END);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.transition_order_status(uuid, text, text, uuid, text, text, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, text, text, uuid, text, text, text, text, uuid, jsonb, text) TO service_role;