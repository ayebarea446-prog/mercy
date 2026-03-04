ALTER TABLE public.products
ALTER COLUMN status SET DEFAULT 'approved'::public.product_status;

UPDATE public.products
SET status = 'approved'::public.product_status
WHERE status = 'pending'::public.product_status;