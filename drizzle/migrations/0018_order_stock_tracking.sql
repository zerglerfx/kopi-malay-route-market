ALTER TABLE public.orders
  ADD COLUMN stock_status text NOT NULL DEFAULT 'not_deducted',
  ADD COLUMN stock_deductions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN stock_deducted_at timestamptz,
  ADD COLUMN stock_restored_at timestamptz;
ALTER TABLE public.orders ADD CONSTRAINT orders_stock_status_check
  CHECK (stock_status IN ('not_deducted','deducting','deducted','restoring','restored','unknown'));

-- Backfill: orders placed before this change were deducted at checkout (failures can't be proven), so flag as 'unknown'.
UPDATE public.orders o SET stock_status = 'unknown', stock_deductions = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('variantId', v, 'quantity', q))
  FROM (
    SELECT COALESCE(sl.loyverse_variant_id, ps.loyverse_variant_id) AS v, SUM(oi.quantity)::int AS q
    FROM public.order_items oi
    LEFT JOIN public.shared_stock_links sl ON sl.product_id = oi.product_id
    LEFT JOIN public.product_stock ps ON sl.product_id IS NULL AND ps.product_id = oi.product_id AND ps.size = oi.selected_variant
    WHERE oi.order_id = o.id AND COALESCE(sl.loyverse_variant_id, ps.loyverse_variant_id) IS NOT NULL
    GROUP BY 1
  ) t), '[]'::jsonb);