import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or service role key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  // Try pg_tables from pg_catalog
  const { data: data1, error: error1 } = await supabase
    .from('pg_tables')
    .select('schemaname, tablename')
    .eq('schemaname', 'public');
  console.log('pg_tables result:', { data1, error1 });

  // Try information_schema.tables with schema
  const { data: data2, error: error2 } = await supabase
    .from('tables')
    .schema('information_schema')
    .select('table_schema, table_name')
    .eq('table_schema', 'public');
  console.log('information_schema.tables result:', { data2, error2 });

  // Try raw SQL via rpc? Not available. Use supabase.rpc? Not needed.
}

test();