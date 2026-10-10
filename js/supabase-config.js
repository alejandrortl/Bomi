// js/supabase-config.js
// 1. Reemplaza estas dos variables con tus datos reales de Supabase
const supabaseUrl = 'TU_URL_DE_SUPABASE_AQUI'; 
const supabaseAnonKey = 'TU_ANON_KEY_DE_SUPABASE_AQUI';

// 2. Inicializamos el cliente de Supabase
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// 3. Verificamos la conexión en consola (puedes borrar esto en producción)
console.log("Supabase inicializado correctamente.");
