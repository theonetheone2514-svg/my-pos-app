import dotenv from 'dotenv';
dotenv.config();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('URL:', url);
console.log('Key length:', key?.length || 0);
console.log('Key starts with:', key?.slice(0, 30) || '');
console.log('Key ends with:', key?.slice(-30) || '');
if (!url || !key) {
  process.exit(1);
}
