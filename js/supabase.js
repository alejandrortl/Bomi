// js/supabase.js

// URL base extraída de tu enlace
const SUPABASE_URL = 'https://dejoetyaiwqloqeinfze.supabase.co';
// Tu clave pública (anon key)
const SUPABASE_ANON_KEY = 'sb_publishable_4LVqnwoHy428agwAYTcESQ_3r4HwgLM';

// Inicializar cliente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Comprobación rápida por consola
console.log('Supabase inicializado correctamente.');