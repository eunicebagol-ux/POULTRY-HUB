-- Migration 001: Initial Tables
-- POULTRY HUB Foundational Schema

-- ==========================================
-- 1. ENUMS
-- ==========================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE egg_size AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE', 'JUMBO', 'UNGRADED');
CREATE TYPE packaging_type AS ENUM ('PIECE', 'TRAY_30', 'CARTON_12', 'BOX_360');
CREATE TYPE entry_type AS ENUM ('STANDARD', 'CORRECTION_REVERSAL');
CREATE TYPE egg_transaction_type AS ENUM ('PRODUCTION', 'SALE', 'ADJUSTMENT', 'CORRECTION');
CREATE TYPE feed_transaction_type AS ENUM ('STOCK_RECEIVED', 'CONSUMPTION', 'ADJUSTMENT', 'CORRECTION');
CREATE TYPE flock_status AS ENUM ('ACTIVE', 'RETIRED', 'QUARANTINED');

-- ==========================================
-- 2. TABLES
-- ==========================================

-- 1. profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'STAFF',
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. flocks
CREATE TABLE flocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flock_identifier TEXT NOT NULL UNIQUE,
    breed TEXT,
    acquisition_date DATE NOT NULL,
    initial_bird_count INTEGER NOT NULL CHECK (initial_bird_count > 0),
    current_bird_count INTEGER NOT NULL CHECK (current_bird_count >= 0 AND current_bird_count <= initial_bird_count),
    status flock_status NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. flock_mortality
CREATE TABLE flock_mortality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flock_id UUID NOT NULL REFERENCES flocks(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL, 
    event_date DATE NOT NULL,
    reason TEXT,
    entry_record_type entry_type NOT NULL DEFAULT 'STANDARD',
    reference_entry_id UUID REFERENCES flock_mortality(id) ON DELETE RESTRICT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. flock_culling
CREATE TABLE flock_culling (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flock_id UUID NOT NULL REFERENCES flocks(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    event_date DATE NOT NULL,
    reason TEXT,
    entry_record_type entry_type NOT NULL DEFAULT 'STANDARD',
    reference_entry_id UUID REFERENCES flock_culling(id) ON DELETE RESTRICT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. egg_production
CREATE TABLE egg_production (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flock_id UUID NOT NULL REFERENCES flocks(id) ON DELETE RESTRICT,
    production_date DATE NOT NULL,
    collection_shift TEXT,
    total_eggs INTEGER NOT NULL CHECK (total_eggs >= 0),
    good_eggs INTEGER NOT NULL CHECK (good_eggs >= 0),
    damaged_eggs INTEGER NOT NULL CHECK (damaged_eggs >= 0),
    cracked_eggs INTEGER NOT NULL CHECK (cracked_eggs >= 0),
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT egg_production_integrity CHECK (total_eggs = good_eggs + damaged_eggs + cracked_eggs),
    CONSTRAINT egg_production_unique_shift UNIQUE (flock_id, production_date, collection_shift)
);

-- 6. egg_production_sizes
CREATE TABLE egg_production_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_id UUID NOT NULL REFERENCES egg_production(id) ON DELETE CASCADE,
    size egg_size NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    UNIQUE (production_id, size)
);

-- 7. egg_inventory
CREATE TABLE egg_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size egg_size NOT NULL UNIQUE,
    stock_pieces INTEGER NOT NULL DEFAULT 0 CHECK (stock_pieces >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. egg_inventory_transactions
CREATE TABLE egg_inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size egg_size NOT NULL REFERENCES egg_inventory(size) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    transaction_type egg_transaction_type NOT NULL,
    reference_id UUID, 
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. feed_inventory
CREATE TABLE feed_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_type TEXT NOT NULL UNIQUE,
    current_stock_kg NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_stock_kg >= 0),
    cost_per_kg NUMERIC(12,2) DEFAULT 0 CHECK (cost_per_kg >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. feed_inventory_transactions
CREATE TABLE feed_inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_type TEXT NOT NULL REFERENCES feed_inventory(feed_type) ON DELETE RESTRICT,
    quantity_kg NUMERIC(10,2) NOT NULL,
    transaction_type feed_transaction_type NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. feed_consumption
CREATE TABLE feed_consumption (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flock_id UUID NOT NULL REFERENCES flocks(id) ON DELETE RESTRICT,
    feed_type TEXT NOT NULL REFERENCES feed_inventory(feed_type) ON DELETE RESTRICT,
    quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    consumption_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. egg_sales
CREATE TABLE egg_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT egg_sales_total_check CHECK (total_amount = subtotal - discount)
);

-- 15. egg_sale_items
CREATE TABLE egg_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES egg_sales(id) ON DELETE CASCADE,
    size egg_size NOT NULL,
    packaging packaging_type NOT NULL,
    package_quantity INTEGER NOT NULL CHECK (package_quantity > 0),
    total_pieces INTEGER NOT NULL CHECK (total_pieces > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT egg_sale_items_line_total_calc_check CHECK (line_total = package_quantity * unit_price)
);

-- 16. expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. activity_logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_table TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. system_settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. INDEXES
-- ==========================================

CREATE INDEX idx_profiles_role ON profiles(role);

CREATE INDEX idx_flocks_status ON flocks(status);

CREATE INDEX idx_flock_mortality_flock_id ON flock_mortality(flock_id);
CREATE INDEX idx_flock_mortality_event_date ON flock_mortality(event_date);

CREATE INDEX idx_flock_culling_flock_id ON flock_culling(flock_id);
CREATE INDEX idx_flock_culling_event_date ON flock_culling(event_date);

CREATE INDEX idx_egg_production_flock_id ON egg_production(flock_id);
CREATE INDEX idx_egg_production_date ON egg_production(production_date);

CREATE INDEX idx_egg_production_sizes_prod_id ON egg_production_sizes(production_id);

CREATE INDEX idx_egg_inv_tx_size ON egg_inventory_transactions(size);
CREATE INDEX idx_egg_inv_tx_created_at ON egg_inventory_transactions(created_at);

CREATE INDEX idx_feed_inv_tx_type ON feed_inventory_transactions(feed_type);
CREATE INDEX idx_feed_inv_tx_created_at ON feed_inventory_transactions(created_at);

CREATE INDEX idx_feed_consumption_flock_id ON feed_consumption(flock_id);
CREATE INDEX idx_feed_consumption_date ON feed_consumption(consumption_date);

CREATE INDEX idx_egg_sales_customer_id ON egg_sales(customer_id);
CREATE INDEX idx_egg_sales_date ON egg_sales(sale_date);

CREATE INDEX idx_egg_sale_items_sale_id ON egg_sale_items(sale_id);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE INDEX idx_activity_logs_actor_id ON activity_logs(actor_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_table, entity_id);
