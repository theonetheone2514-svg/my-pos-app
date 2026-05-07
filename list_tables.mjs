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
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_schema, table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (error) {
    console.error('Error fetching tables:', error);
    process.exit(1);
  }

  if (data.length === 0) {
    console.log('No tables found in public schema.');
  } else {
    console.log('Tables in public schema:');
    data.forEach(row => {
      console.log(`${row.table_schema}.${row.table_name}`);
    });
  }
}

listTables();
