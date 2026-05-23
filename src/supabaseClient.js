import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseKey
    ? 'Abra o projeto pelo servidor Vite para carregar as variaveis do Supabase. Use npm.cmd run dev e acesse o endereco localhost mostrado no terminal.'
    : '';

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl, supabaseKey);
