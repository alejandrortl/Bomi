// js/supabase-config.js
const supabaseUrl = 'https://dejoetyaiwqloqeinfze.supabase.co/rest/v1/'; 
const supabaseAnonKey = 'sb_publishable_4LVqnwoHy428agwAYTcESQ_3r4HwgLM';

// Usamos el nombre 'supabaseClient' para no chocar con la librería externa
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

console.log("Supabase inicializado correctamente.");
