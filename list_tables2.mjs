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

async function listTables() {
  // Try pg_catalog.pg_tables
  const { data, error } = await supabase
    .from('pg_catalog.pg_tables')
    .select('schemaname, tablename')
    .eq('schemaname', 'public')
    .order('tablename');

  if (error) {
    console.error('Error fetching tables:', error);
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('No tables found in public schema.');
  } else {
    console.log('Tables in public schema:');
    data.forEach(row => {
      console.log(`${row.schemaname}.${row.tablename}`);
    });
  }
}

listTables();