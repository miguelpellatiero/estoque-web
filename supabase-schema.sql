-- MoveisEstoque - esquema inicial do Supabase

CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    quantity INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    address TEXT,
    photo_url TEXT,
    photo_type TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_address TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'EMPTY',
    warehouse_config TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO categories (name) VALUES
('Sofas e Estofados'),
('Mesas e Cadeiras'),
('Armarios e Guarda-Roupas'),
('Camas e Colchoes'),
('Estantes e Prateleiras'),
('Moveis de Escritorio'),
('Moveis de Cozinha'),
('Decoracao e Acessorios'),
('Moveis Infantis'),
('Moveis para Area Externa')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (email, password, name) VALUES
('miguel@mg.com', '1234', 'Miguel')
ON CONFLICT (email) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE categories;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'addresses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE addresses;
    END IF;
END $$;
