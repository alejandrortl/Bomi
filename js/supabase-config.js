// js/supabase-config.js

// 1. URL base estricta (SIN /rest/v1/ al final)
const supabaseUrl = 'https://dejoetyaiwqloqeinfze.supabase.co'; 

// 2. Tu clave pública (Anon Key)
const supabaseAnonKey = 'sb_publishable_4LVqnwoHy428agwAYTcESQ_3r4HwgLM';

// Inicialización
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase inicializado correctamente.");
