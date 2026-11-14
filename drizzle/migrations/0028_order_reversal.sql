ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pre_claim_status text, ADD COLUMN IF NOT EXISTS pre_claim_stock_status text;

-- Claim an order for Undo Verify / Refund. Saves the original status and stock status on the row so a crash never loses them.
CREATE OR REPLACE FUNCTION public.claim_order_reverse(_id uuid, _claim uuid, _allowed text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.status = ANY(_allowed) AND (o.pos_claim_id IS NULL OR o.pos_claim_until < now()) THEN
    UPDATE public.orders SET pre_claim_status = o.status, pre_claim_stock_status = o.stock_status, status = 'reversing', stock_status = 'restoring', pos_claim_id = _claim, pos_claim_until = now() + interval '5 minutes' WHERE id = _id;
    RETURN o.status;
  ELSIF o.status = 'reversing' AND o.pos_claim_until < now() AND o.pre_claim_status = ANY(_allowed) THEN
    -- Expired claim: take over, keeping the saved originals. The POS intent prevents a second receipt.
    UPDATE public.orders SET pos_claim_id = _claim, pos_claim_until = now() + interval '5 minutes' WHERE id = _id;
    RETURN o.pre_claim_status;
  END IF;
  RETURN NULL;
END $$;

-- Put a failed reversal back exactly as it was. No history row.
CREATE OR REPLACE FUNCTION public.release_order_reverse(_id uuid, _claim uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders SET status = pre_claim_status, stock_status = pre_claim_stock_status, pre_claim_status = NULL, pre_claim_stock_status = NULL, pos_claim_id = NULL, pos_claim_until = NULL
  WHERE id = _id AND status = 'reversing' AND pos_claim_id = _claim;
  RETURN FOUND;
END $$;

-- Finish a reversal: status, stock state and its history row in one transaction.
CREATE OR REPLACE FUNCTION public.finish_order_reverse(_id uuid, _claim uuid, _to text, _stock text, _actor uuid, _actor_email text, _pos_receipt text, _notes text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  IF _to NOT IN ('pending_verification','refunded') OR _stock NOT IN ('restored','written_off') THEN RAISE EXCEPTION 'invalid reversal'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'reversing' OR o.pos_claim_id IS DISTINCT FROM _claim THEN RETURN false; END IF;
  UPDATE public.orders SET status = _to, stock_status = _stock, stock_restored_at = now(), pre_claim_status = NULL, pre_claim_stock_status = NULL, pos_claim_id = NULL, pos_claim_until = NULL WHERE id = _id;
  INSERT INTO public.order_status_history(order_id, order_number, changed_by, changed_by_email, from_status, to_status, tracking_number, pos_receipt_number, notes)
  VALUES (_id, o.order_number, _actor, COALESCE(_actor_email, ''), o.pre_claim_status, _to, o.tracking_number, _pos_receipt, _notes);
  RETURN true;
END $$;

-- After Undo Verify with a write-off, the order can be verified again.
CREATE OR REPLACE FUNCTION public.claim_order_verify(_id uuid, _claim uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; prev text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.status = 'pending_verification' AND o.stock_status IN ('not_deducted','restored','written_off') THEN prev := o.stock_status;
  ELSIF o.status = 'verifying' AND o.pos_claim_until < now() THEN prev := 'not_deducted';
  ELSE RETURN NULL; END IF;
  UPDATE public.orders SET status = 'verifying', stock_status = 'deducting', pos_claim_id = _claim, pos_claim_until = now() + interval '5 minutes' WHERE id = _id;
  RETURN prev;
END $$;

REVOKE ALL ON FUNCTION public.claim_order_reverse(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_order_reverse(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_order_reverse(uuid, uuid, text, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_order_verify(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_reverse(uuid, uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_order_reverse(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_order_reverse(uuid, uuid, text, text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_verify(uuid, uuid) TO service_role;