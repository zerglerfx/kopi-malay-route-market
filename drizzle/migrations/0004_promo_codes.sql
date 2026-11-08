CREATE TYPE public.promo_discount_type AS ENUM ('percentage','fixed_amount');
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type public.promo_discount_type NOT NULL,
  discount_value numeric NOT NULL DEFAULT 0,
  discount_myr numeric,
  discount_thb numeric,
  min_order_myr numeric,
  min_order_thb numeric,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX promo_codes_code_upper_idx ON public.promo_codes (upper(code));
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ADD COLUMN promo_code text, ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.promo_codes SET current_uses = current_uses + 1
  WHERE upper(code) = upper(_code) AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR current_uses < max_uses);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO service_role;