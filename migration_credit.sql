-- Migration: Add credit/customer feature
-- รันใน Supabase SQL Editor

-- 1. Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'cash';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT NULL;

-- 3. Create credit_payments table
CREATE TABLE IF NOT EXISTS credit_payments (
  id BIGSERIAL PRIMARY KEY,
  sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT DEFAULT ''
);

-- Disable RLS on new tables
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments DISABLE ROW LEVEL SECURITY;
