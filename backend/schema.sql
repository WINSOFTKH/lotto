-- ====================================================================
-- KH-Lotto PostgreSQL Production Database Schema
-- High-Concurrency Real-Time Lottery with RBAC and Wallet Ledger
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('player', 'moderator', 'finance', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE table_status AS ENUM ('waiting', 'playing', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE khqr_status AS ENUM ('pending', 'completed', 'failed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'cancelled';

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'daily_bonus',
        'khqr_deposit',
        'table_entry',
        'table_win',
        'table_refund',
        'withdrawal_deduct',
        'withdrawal_refund',
        'admin_adjustment',
        'referral_bonus'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'player',
    coin_balance BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
    last_claim_date DATE DEFAULT NULL,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_id VARCHAR(64) UNIQUE DEFAULT NULL,
    photo_url TEXT DEFAULT NULL,
    referral_code VARCHAR(20) UNIQUE DEFAULT NULL,
    referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    referral_bound_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. SYSTEM SETTINGS TABLE (Dynamic config without code deployment)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. LOTTERY TABLES
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    entry_fee BIGINT NOT NULL CHECK (entry_fee > 0),
    max_players INT NOT NULL DEFAULT 10 CHECK (max_players >= 2 AND max_players <= 100),
    current_players INT NOT NULL DEFAULT 0 CHECK (current_players >= 0 AND current_players <= 100),
    status table_status NOT NULL DEFAULT 'waiting',
    winner_id UUID REFERENCES users(id),
    total_pool BIGINT NOT NULL DEFAULT 0,
    platform_fee BIGINT NOT NULL DEFAULT 0,
    winner_payout BIGINT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id),
    host_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE PLAYERS (Tickets and Seats)
CREATE TABLE IF NOT EXISTS table_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seat_number INT NOT NULL CHECK (seat_number BETWEEN 1 AND 100),
    numbers INT[] NOT NULL CHECK (array_length(numbers, 1) = 5),
    matched_count INT NOT NULL DEFAULT 0 CHECK (matched_count BETWEEN 0 AND 5),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_table_user UNIQUE (table_id, user_id),
    CONSTRAINT unique_table_seat UNIQUE (table_id, seat_number)
);

-- 7. TABLE DRAWS (Ball-by-ball drawing history)
CREATE TABLE IF NOT EXISTS table_draws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    drawn_numbers INT[] NOT NULL DEFAULT '{}',
    current_ball INT DEFAULT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    winning_ball INT DEFAULT NULL,
    winner_id UUID REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ DEFAULT NULL
);

-- 8. KHQR TRANSACTIONS (Top-Up Ledger)
CREATE TABLE IF NOT EXISTS khqr_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
    coin_amount BIGINT NOT NULL CHECK (coin_amount > 0),
    khqr_string TEXT NOT NULL,
    md5_hash VARCHAR(64) NOT NULL UNIQUE,
    status khqr_status NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. WITHDRAWALS TABLE (Cash-out requests)
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    coin_amount BIGINT NOT NULL CHECK (coin_amount > 0),
    amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd > 0),
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    status withdrawal_status NOT NULL DEFAULT 'pending',
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. WALLET TRANSACTIONS (Double-entry audit ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type transaction_type NOT NULL,
    amount BIGINT NOT NULL, -- Positive for credit, negative for debit
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AUDIT LOGS (Security & Compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SUPPORT MESSAGES (Help Desk & Player Inquiries)
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL DEFAULT 'player', -- 'player' or 'admin'
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(150) DEFAULT 'General Support',
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'replied', 'resolved'
    is_read_by_player BOOLEAN NOT NULL DEFAULT TRUE,
    is_read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. REFERRAL REWARDS (Level A from Direct B and Sub C Commission Ledger)
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level BETWEEN 1 AND 2),
    topup_tx_id UUID REFERENCES khqr_transactions(id) ON DELETE SET NULL,
    deposit_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
    deposit_coins BIGINT NOT NULL DEFAULT 0,
    commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    bonus_coins BIGINT NOT NULL CHECK (bonus_coins > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PLAYER PAYMENT METHODS (Saved Bank Accounts for Selling Coins)
CREATE TABLE IF NOT EXISTS player_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    label VARCHAR(100) DEFAULT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- HIGH-PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_last_claim_date ON users(last_claim_date);

CREATE INDEX IF NOT EXISTS idx_tables_status_players ON tables(status, current_players);
CREATE INDEX IF NOT EXISTS idx_table_players_table_user ON table_players(table_id, user_id);
CREATE INDEX IF NOT EXISTS idx_table_draws_table ON table_draws(table_id);

CREATE INDEX IF NOT EXISTS idx_khqr_md5 ON khqr_transactions(md5_hash);
CREATE INDEX IF NOT EXISTS idx_khqr_user_status ON khqr_transactions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_date ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_user_created ON support_messages(user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_status_created ON support_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_admin_read ON support_messages(is_read_by_admin);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referee ON referral_rewards(referee_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON player_payment_methods(user_id, is_default DESC, created_at DESC);

-- ====================================================================
-- SEED DEFAULT SYSTEM SETTINGS & INITIAL ADMIN USER
-- ====================================================================
INSERT INTO system_settings (key, value, description)
VALUES 
    ('coins_per_usd', '1500', 'Exchange rate: 1500 Coins = 1 USD'),
    ('platform_fee_percent', '10', 'Platform cut: 10% of total pool'),
    ('daily_bonus_coins', '10', 'Free coins awarded per daily claim'),
    ('min_withdrawal_coins', '1500', 'Minimum coins required for cash-out'),
    ('quick_play_coins', '100', 'Default entry coin fee for Quick Play matchmaking'),
    ('allowed_entry_fees', '50,100,250,500', 'Comma-separated entry fee preset options for creating tables'),
    ('game_auto_start_seconds', '30', 'Countdown in seconds to auto-start game when table has >= 2 players'),
    ('topup_coins_per_usd', '4000', 'Exchange rate for KHQR top-up: Coins awarded per $1 USD'),
    ('topup_coin_presets', '50000,100000,200000,5000000', 'Comma-separated coin amounts available in KHQR top-up packages'),
    ('max_players_per_table', '10', 'Default maximum number of player seats allowed per lottery table'),
    ('crashed_game_timeout_minutes', '15', 'Threshold in minutes before a stuck playing game is automatically reset to waiting status due to crash'),
    ('chat_messages_per_minute', '15', 'Maximum chat messages and emoji reactions allowed per player per minute to prevent spam'),
    ('welcome_bonus_coins', '50', 'Initial welcome bonus coins credited to newly registered players'),
    ('auto_rejoin_enabled', 'true', 'Enable or disable automatic table re-joining after game ends for players with enough coins'),
    ('auto_rejoin_delay_seconds', '7', 'Countdown duration in seconds before auto re-joining the current table after game completion'),
    ('bot_players_enabled', 'true', 'Enable or disable automatic bot players joining tables when fewer than 2 real players are seated'),
    ('max_bot_players_per_table', '9', 'Maximum number of bot players (bots join randomly from 1 up to this max) on a table with fewer than 2 real players'),
    ('bot_join_delay_seconds', '30', 'Wait time in seconds before bot players automatically join seats when a table has fewer than 2 real players'),
    ('referral_program_enabled', 'true', 'Enable or disable the referral commission program'),
    ('referral_bonus_level1_percent', '5', 'Commission % awarded to direct inviter (Level A from Level B deposit)'),
    ('referral_bonus_level2_percent', '1', 'Commission % awarded to secondary inviter (Level A from Level C deposit)'),
    ('referral_bind_bonus_coins', '50', 'Bonus coins awarded immediately to a player upon entering and binding an inviter referral code')
ON CONFLICT (key) DO NOTHING;

-- Default password is Admin@123456 (bcrypt hash: $2a$10$XyfZIChVcy1WVsLG6JLrPOfoj0wm6ClEo6D8pJZlzEXCIi9w8JPV6)
INSERT INTO users (username, email, password_hash, role, coin_balance)
VALUES (
    'admin',
    'admin@kh-lotto.com',
    '$2a$10$XyfZIChVcy1WVsLG6JLrPOfoj0wm6ClEo6D8pJZlzEXCIi9w8JPV6',
    'admin',
    100000
) ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash, role = 'admin';
