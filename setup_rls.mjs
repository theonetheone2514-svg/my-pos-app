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

async function setupRls() {
  // Try to create a policy that allows anon to select on products
  const sql = `
    do $$
    begin
      if not exists (select 1 from pg_policies where tablename = 'products' and policyname = 'enable anon select') then
        create policy "enable anon select" on public.products
          for select
          using (true);
      end if;
    end
    $$;
  `;

  // Supabase client doesn't have a direct way to run arbitrary SQL, but we can use rpc if we have a function?
  // Alternatively, we can use the PostgREST endpoint? Not exposed.
  // Instead, we can use the admin API via the management API? Not available in the JS client.

  // Since we cannot run arbitrary SQL via the JS client easily, we'll inform the user to do it in the SQL editor.
  console.log('Please run the following SQL in the Supabase SQL editor to enable anon select on products:');
  console.log(sql);
}

setupRls();