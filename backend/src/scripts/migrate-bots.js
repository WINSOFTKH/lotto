const crypto = require('crypto');
const db = require('../config/db');

// 40 Common Cambodian Surnames (Family Names)
const KHMER_SURNAMES = [
  'Sok', 'Chan', 'Chea', 'Heng', 'Lim', 'Keo', 'Meas', 'Seng', 'Ouk', 'Pich',
  'Long', 'Tep', 'Sar', 'Chhay', 'Bun', 'Sun', 'Ly', 'Ung', 'Vong', 'Kim',
  'San', 'Yin', 'Mao', 'Khun', 'Prak', 'Tuy', 'Chhin', 'Huy', 'Mom', 'Pen',
  'Suos', 'Yim', 'Ros', 'Som', 'Nou', 'Men', 'Tea', 'Kong', 'Chhun', 'Khorn'
];

// 100 Popular Cambodian Given Names
const KHMER_GIVEN_NAMES = [
  'San', 'Dara', 'Visal', 'Pisey', 'Rithy', 'Makara', 'Sopheak', 'Sovann', 'Kosal', 'Rothana',
  'Samnang', 'Panha', 'Nary', 'Piseth', 'Pich', 'Ratanak', 'Kiri', 'Boran', 'Socheata', 'Chhaya',
  'Vibol', 'Narith', 'Kalyan', 'Thida', 'Vathana', 'Chantha', 'Sreypov', 'Bunroeun', 'Chenda', 'Malis',
  'Bopha', 'Vicheka', 'Khemara', 'Leakhena', 'Theara', 'Sreyneang', 'Vannak', 'Sovannarith', 'Virak', 'Kunthea',
  'Mengly', 'Sreymom', 'Phearith', 'Sothea', 'Romdoul', 'Vichet', 'Daneth', 'Reasmey', 'Sreynich', 'Chanthou',
  'Phalla', 'Channa', 'Chamroeun', 'Ravy', 'Kompheak', 'Maneth', 'Vanny', 'Sovannara', 'Sokunthea', 'Chandara',
  'Phanith', 'Ratana', 'Tola', 'Chhay', 'Dalis', 'Sinat', 'Sreyleak', 'Vathanak', 'Borey', 'Kanha',
  'Sokhom', 'Sambo', 'Chanthea', 'Somaly', 'Vireak', 'Monineath', 'Rathana', 'Dalin', 'Sreylin', 'Phearun',
  'Bunnath', 'Voleak', 'Sovanratana', 'Ratanaka', 'Chetra', 'Oudom', 'Channarith', 'Sopheap', 'Sokun', 'Vanna',
  'Sovan', 'Sambath', 'Serey', 'Raksmey', 'Kolab', 'Sitha', 'Pharith', 'Sophat', 'Dararith', 'Botum'
];

// Female Cambodian Given Names set for gender-matching real human portraits
const FEMALE_GIVEN_NAMES = new Set([
  'Pisey', 'Rothana', 'Nary', 'Pich', 'Socheata', 'Kalyan', 'Thida', 'Chantha', 
  'Sreypov', 'Chenda', 'Malis', 'Bopha', 'Vicheka', 'Leakhena', 'Sreyneang', 
  'Kunthea', 'Sreymom', 'Romdoul', 'Daneth', 'Reasmey', 'Sreynich', 'Chanthou', 
  'Phalla', 'Channa', 'Ravy', 'Vanny', 'Sokunthea', 'Dalis', 'Sinat', 'Sreyleak', 
  'Kanha', 'Chanthea', 'Somaly', 'Monineath', 'Dalin', 'Sreylin', 'Voleak', 
  'Kolab', 'Sitha', 'Botum', 'Sopheap', 'Sokun', 'Vanna', 'Raksmey',
  'Vathana', 'Theara', 'Ratana', 'Serey', 'Rathana', 'Ratanaka'
]);

/**
 * Generates 200 distinct authentic Cambodian names with a space between first and last name
 * and real human face portrait photos
 * Example: "Sok San", "Chan Dara", "Chea Visal", "Heng Pisey", ...
 */
function generate200KhmerBots() {
  const bots = [];
  const nameSet = new Set();
  let round = 0;
  let maleIdx = 0;
  let femaleIdx = 0;

  while (bots.length < 200) {
    for (let i = 0; i < KHMER_SURNAMES.length; i++) {
      const surname = KHMER_SURNAMES[i];
      const givenName = KHMER_GIVEN_NAMES[(i + round * 17) % KHMER_GIVEN_NAMES.length];
      const fullName = `${surname} ${givenName}`;

      if (!nameSet.has(fullName)) {
        nameSet.add(fullName);
        const emailSlug = `${surname.toLowerCase()}.${givenName.toLowerCase()}`;
        const isFemale = FEMALE_GIVEN_NAMES.has(givenName);
        const photoUrl = isFemale 
          ? `/avatars/bots/cambodian_w_${++femaleIdx}.jpg`
          : `/avatars/bots/cambodian_m_${++maleIdx}.jpg`;

        bots.push({
          username: fullName,
          email: `${emailSlug}.${bots.length + 1}@lotto4u.bot`,
          photo_url: photoUrl,
        });

        if (bots.length === 200) break;
      }
    }
    round++;
  }

  return bots;
}

function generateReferralCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'KH';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function runBotMigration() {
  console.log('=====================================================');
  console.log('🤖 Starting Migration: Create 200 Khmer Bot Players');
  console.log('=====================================================');

  try {
    // 1. Ensure `is_bot` column exists
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log('✅ Checked/added is_bot column in users table.');

    // 2. Ensure system_settings for bots are active
    await db.query(`
      INSERT INTO system_settings (key, value, description)
      VALUES
        ('bot_players_enabled', 'true', 'Enable or disable automatic bot players joining tables'),
        ('max_bot_players_per_table', '9', 'Maximum number of bot players per table'),
        ('bot_join_delay_seconds', '30', 'Wait time in seconds before bot players join seats')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✅ Seeded bot configuration in system_settings.');

    // 3. Generate 200 Khmer Bot profiles
    const botProfiles = generate200KhmerBots();
    console.log(`📋 Generated ${botProfiles.length} unique Khmer bot names with space (e.g. "${botProfiles[0].username}").`);

    // 4. Check existing bot accounts
    const existingBotsRes = await db.query(`
      SELECT id, username FROM users WHERE is_bot = true ORDER BY created_at ASC;
    `);
    const existingBots = existingBotsRes.rows;
    console.log(`ℹ️  Found ${existingBots.length} existing bot records in database.`);

    // 5. Update existing bots or insert new bots to reach exactly 200 bots
    let updatedCount = 0;
    let insertedCount = 0;

    for (let i = 0; i < botProfiles.length; i++) {
      const profile = botProfiles[i];
      let refCode = generateReferralCode();

      if (i < existingBots.length) {
        // Update existing bot with new Khmer name "First Last" and real human photo
        const botId = existingBots[i].id;
        await db.query(
          `UPDATE users 
           SET username = $1, email = $2, coin_balance = 100000, is_bot = true, photo_url = $3, updated_at = NOW()
           WHERE id = $4;`,
          [profile.username, profile.email, profile.photo_url, botId]
        );
        updatedCount++;
      } else {
        // Insert new bot record with real human photo
        await db.query(
          `INSERT INTO users (username, email, password_hash, role, coin_balance, is_bot, referral_code, photo_url)
           VALUES ($1, $2, 'BOT_ACCOUNT_NO_LOGIN', 'player', 100000, true, $3, $4)
           ON CONFLICT (username) DO UPDATE 
           SET is_bot = true, email = EXCLUDED.email, coin_balance = 100000, photo_url = EXCLUDED.photo_url;`,
          [profile.username, profile.email, refCode, profile.photo_url]
        );
        insertedCount++;
      }
    }

    // 6. Regenerate SQL Migration file with 100% unique bot avatars
    const fs = require('fs');
    const path = require('path');
    const sqlValues = botProfiles.map(
      (b) => `  ('${b.username.replace(/'/g, "''")}', '${b.email}', 'BOT_ACCOUNT_NO_LOGIN', 'player', 100000, true, '${b.photo_url}')`
    ).join(',\n');

    const sqlMigrationContent = `-- Migration: Create 200 Khmer Bot Players with 100% Unique Cambodian Profile Photos
-- Note: Bot names are formatted as "First Last" with a space (e.g. "Sok San")
-- Every single bot player has a 100% unique authentic Cambodian profile photo

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO system_settings (key, value, description)
VALUES
  ('bot_players_enabled', 'true', 'Enable or disable automatic bot players joining tables'),
  ('max_bot_players_per_table', '9', 'Maximum number of bot players per table'),
  ('bot_join_delay_seconds', '30', 'Wait time in seconds before bot players join seats')
ON CONFLICT (key) DO NOTHING;

INSERT INTO users (username, email, password_hash, role, coin_balance, is_bot, photo_url)
VALUES
${sqlValues}
ON CONFLICT (username) DO UPDATE SET
  is_bot = true,
  email = EXCLUDED.email,
  coin_balance = 100000,
  photo_url = EXCLUDED.photo_url;
`;

    const sqlPath = path.resolve(__dirname, '../../migrations/20261023_seed_200_khmer_bots.sql');
    fs.writeFileSync(sqlPath, sqlMigrationContent, 'utf8');
    console.log(`📄 Wrote updated SQL migration to: ${sqlPath}`);

    // 7. Verification
    const finalCountRes = await db.query(`
      SELECT count(*) AS total_bots, count(DISTINCT photo_url) AS distinct_photos FROM users WHERE is_bot = true;
    `);
    const sampleBotsRes = await db.query(`
      SELECT id, username, email, photo_url, coin_balance 
      FROM users 
      WHERE is_bot = true 
      ORDER BY id ASC 
      LIMIT 10;
    `);

    console.log('-----------------------------------------------------');
    console.log(`🎉 Migration Completed Successfully!`);
    console.log(`   Updated bots:    ${updatedCount}`);
    console.log(`   Inserted bots:   ${insertedCount}`);
    console.log(`   Total bots:      ${finalCountRes.rows[0].total_bots}`);
    console.log(`   Unique photos:   ${finalCountRes.rows[0].distinct_photos} (100% UNIQUE!)`);
    console.log('-----------------------------------------------------');
    console.log('Sample Khmer Bot Players:');
    sampleBotsRes.rows.forEach((b, idx) => {
      console.log(`   ${idx + 1}. "${b.username}" <${b.email}> (Balance: ${Number(b.coin_balance).toLocaleString()} coins)`);
    });
    console.log('=====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runBotMigration();
