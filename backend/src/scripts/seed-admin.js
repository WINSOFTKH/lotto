const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seedAdmin() {
  const username = 'admin';
  const email = 'admin@kh-lotto.com';
  const plainPassword = 'Admin@123456';

  console.log('Generating secure bcrypt hash for Admin...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(plainPassword, salt);

  const query = `
    INSERT INTO users (username, email, password_hash, role, coin_balance)
    VALUES ($1, $2, $3, 'admin', 100000)
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = EXCLUDED.password_hash, role = 'admin', is_banned = false
    RETURNING id, username, email, role;
  `;

  try {
    const res = await db.query(query, [username, email, passwordHash]);
    console.log('✅ Admin user successfully created/updated in PostgreSQL:');
    console.log(res.rows[0]);
    console.log(`\nYou can now log in with:\n  Email:    ${email}\n  Password: ${plainPassword}\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to seed admin user:', err.message);
    process.exit(1);
  }
}

seedAdmin();
