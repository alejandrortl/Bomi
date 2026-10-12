CREATE TABLE IF NOT EXISTS clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_cliente TEXT NOT NULL,
    obra TEXT NOT NULL,
    direccion TEXT NOT NULL,
    localidad TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso autenticado clientes" ON clientes;
CREATE POLICY "Acceso autenticado clientes" ON clientes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
