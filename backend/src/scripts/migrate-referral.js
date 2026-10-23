const crypto = require('crypto');
const db = require('../config/db');

function generateReferralCode() {
  // Generate uppercase 8-char code: 'KH' + 6 characters alphanumeric (excluding ambiguous characters 0/O, 1/I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'KH';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function runMigration() {
  console.log('[Migration] Starting 3-Level Referral Program database migration...');

  try {
    // 1. Add referral_code, referred_by, referral_bound_at to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE,
      ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS referral_bound_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log('✅ Added referral columns to users table.');

    // 2. Add 'referral_bonus' to transaction_type enum if not exists
    await db.query(`
      DO $$ BEGIN
        ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral_bonus';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Updated transaction_type enum with referral_bonus.');

    // 3. Create referral_rewards table
    await db.query(`
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level INT NOT NULL CHECK (level BETWEEN 1 AND 3),
        topup_tx_id UUID REFERENCES khqr_transactions(id) ON DELETE SET NULL,
        deposit_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
        deposit_coins BIGINT NOT NULL DEFAULT 0,
        commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
        bonus_coins BIGINT NOT NULL CHECK (bonus_coins > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_referee ON referral_rewards(referee_id);
    `);
    console.log('✅ Created referral_rewards table and indexes.');

    // 4. Seed system_settings for referral program
    await db.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES 
        ('referral_program_enabled', 'true', 'Enable or disable the multi-level referral commission program'),
        ('referral_bonus_level1_percent', '5', 'Commission % awarded to direct inviter (Level A from Level B deposit)'),
        ('referral_bonus_level2_percent', '1', 'Commission % awarded to secondary inviter (Level A from Level C deposit)'),
        ('referral_bonus_level3_percent', '0.5', 'Commission % awarded to tertiary inviter (Level 3 referral deposit)')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✅ Seeded referral system_settings.');

    // 5. Backfill referral_code for any user that doesn't have one
    const usersWithoutCode = await db.query(`
      SELECT id, username FROM users WHERE referral_code IS NULL;
    `);

    console.log(`[Migration] Found ${usersWithoutCode.rows.length} users needing referral codes.`);

    for (const u of usersWithoutCode.rows) {
      let code;
      let isUnique = false;
      while (!isUnique) {
        code = generateReferralCode();
        const check = await db.query('SELECT id FROM users WHERE referral_code = $1', [code]);
        if (check.rows.length === 0) isUnique = true;
      }
      await db.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, u.id]);
      console.log(`   Assigned code ${code} to user ${u.username} (${u.id})`);
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
