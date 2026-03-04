
-- Add payment_method column to orders
ALTER TABLE public.orders ADD COLUMN payment_method text NOT NULL DEFAULT 'mobile_money';
