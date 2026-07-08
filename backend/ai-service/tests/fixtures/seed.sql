-- Synthetic test data for Business Query Agent integration tests.
-- Mirrors production schema shape without any real business data.
-- Reset between runs: TRUNCATE orders, products, customers, order_items RESTART IDENTITY CASCADE;

-- ── Schema ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    region      VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(50),
    price       NUMERIC(10, 2) NOT NULL,
    stock_qty   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id           SERIAL PRIMARY KEY,
    customer_id  INT REFERENCES customers(id),
    status       VARCHAR(20) DEFAULT 'completed',
    total_amount NUMERIC(12, 2),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INT REFERENCES orders(id),
    product_id  INT REFERENCES products(id),
    quantity    INT NOT NULL,
    unit_price  NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS query_log (
    id           SERIAL PRIMARY KEY,
    session_id   VARCHAR(36) NOT NULL,
    question     TEXT NOT NULL,
    intent       JSONB,
    generated_sql TEXT NOT NULL,
    row_count    INT DEFAULT 0,
    execution_ms INT DEFAULT 0,
    status       VARCHAR(20) DEFAULT 'success',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_log_session ON query_log(session_id);
CREATE INDEX IF NOT EXISTS idx_query_log_created_at ON query_log(created_at DESC);

-- ── Seed data ──────────────────────────────────────────────────────────────

INSERT INTO customers (name, email, region) VALUES
    ('Acme Corp',       'acme@example.com',    'North'),
    ('Globex Inc',      'globex@example.com',  'South'),
    ('Initech LLC',     'initech@example.com', 'East'),
    ('Umbrella Ltd',    'umbrella@example.com','West'),
    ('Stark Industries','stark@example.com',   'North');

INSERT INTO products (name, category, price, stock_qty) VALUES
    ('Widget A',    'Hardware',  29.99,  150),
    ('Gadget Pro',  'Electronics',199.00, 42),
    ('Super Donut', 'Food',        3.49, 500),
    ('Mega Bolt',   'Hardware',   12.50,  80),
    ('Turbo Fan',   'Electronics',89.00,  15);

INSERT INTO orders (customer_id, status, total_amount, created_at) VALUES
    (1, 'completed', 299.97, NOW() - INTERVAL '1 day'),
    (2, 'completed', 199.00, NOW() - INTERVAL '1 day'),
    (3, 'pending',    59.98, NOW() - INTERVAL '2 days'),
    (4, 'completed', 445.00, NOW() - INTERVAL '7 days'),
    (5, 'completed',  34.90, NOW() - INTERVAL '30 days'),
    (1, 'completed', 178.00, NOW() - INTERVAL '90 days'),
    (2, 'refunded',   89.00, NOW() - INTERVAL '91 days');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 10,  29.99),
    (1, 3,  2,   3.49),
    (2, 2,  1, 199.00),
    (3, 4,  4,  12.50),
    (3, 1,  2,  29.99),
    (4, 2,  2, 199.00),
    (4, 5,  1,  89.00),
    (5, 3, 10,   3.49),
    (6, 5,  2,  89.00),
    (7, 5,  1,  89.00);
