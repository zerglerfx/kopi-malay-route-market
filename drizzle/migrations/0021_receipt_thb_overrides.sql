ALTER TABLE public.products ADD COLUMN receipt_thb_rm_sale numeric(10,2) CHECK (receipt_thb_rm_sale >= 0);
ALTER TABLE public.promo_codes ADD COLUMN receipt_discount_thb numeric(10,2) CHECK (receipt_discount_thb >= 0);
ALTER TABLE public.orders ADD COLUMN pos_receipt_snapshot jsonb;