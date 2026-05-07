-- คำสั่งปิด RLS ชั่วคราวเพื่อทดสอบ
-- รันใน Supabase SQL Editor แล้วกด Run

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- คำสั่งตรวจสอบสถานะ RLS หลังปิดแล้ว
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'inventory', 'sales', 'sale_items', 'stock_movements', 'settings');
