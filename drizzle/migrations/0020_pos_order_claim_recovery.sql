ALTER TABLE public.orders ADD COLUMN pos_claim_id uuid, ADD COLUMN pos_claim_until timestamptz;
CREATE FUNCTION public.claim_order_pos(_id uuid, _prev text, _busy text, _claim uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed uuid;
BEGIN
 UPDATE public.orders SET stock_status=_busy, pos_claim_id=_claim, pos_claim_until=now()+interval '5 minutes'
 WHERE id=_id AND (stock_status=_prev OR (stock_status=_busy AND pos_claim_until < now())) RETURNING id INTO claimed;
 RETURN claimed IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.claim_order_pos(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_pos(uuid,text,text,uuid) TO service_role;