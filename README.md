# 🎰 KH-Lotto: Real-Time Web Lottery Application

A production-ready, secure, and high-concurrency Lottery Web App built with **React / Tailwind CSS**, **Node.js (Express & Socket.io)**, **PostgreSQL (Connection Pooling + Row-Level Locking)**, **Redis (Socket.io Multi-Instance Adapter)**, and native **Bakong KHQR Payment Integration**.

---

## 🏛️ System Architecture Overview

```
                      +---------------------------------------+
                      |     Client Browser (React / Vite)     |
                      |  Tailwind CSS • Framer Motion • Howler |
                      +-------------------+-------------------+
                                          |
                        HTTP REST / JSON  |  WebSocket (Socket.io)
                                          v
                      +-------------------+-------------------+
                      |      Node.js Express / Socket.io      |
                      |  - JWT Auth & RBAC Middleware         |
                      |  - Lottery Cryptographic Engine       |
                      |  - Bakong KHQR Dynamic Generator      |
                      +----------+-----------------+----------+
                                 |                 |
                   Row-Level Lock|                 |Pub/Sub
            (SELECT ... FOR UPDATE)                |Adapter
                                 v                 v
            +--------------------+---+       +-----+-----+
            |   PostgreSQL 15+       |       |   Redis   |
            |   (PgBouncer Pool)     |       | (Cluster) |
            +------------------------+       +-----------+
```

---

## 🚀 Key Features & Implementation Mechanics

### 1. User Authentication & Role-Based Access Control (RBAC)
- **Roles**: `'player'`, `'moderator'`, `'finance'`, `'admin'`.
- Secure password hashing using `bcryptjs` (salt rounds: 10).
- Signed JWT tokens carrying user identity and role credentials.
- `requireRoles(['admin', 'finance'])` middleware protecting administrative and treasury endpoints.

### 2. Daily Bonus System
- Players claim **10 free coins** once every 24 calendar hours.
- Atomic, race-condition free PostgreSQL conditional update:
  ```sql
  UPDATE users 
  SET coin_balance = coin_balance + 10, 
      last_claim_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE id = $1 AND (last_claim_date IS NULL OR last_claim_date < CURRENT_DATE)
  RETURNING coin_balance, last_claim_date;
  ```

### 3. Bakong KHQR Top-up System
- Native EMVCo / National Bank of Cambodia (NBC) KHQR compliance:
  - Generates TLV dynamic QR strings with CRC16-CCITT checksum verification.
- Webhook endpoint (`POST /api/khqr/webhook`):
  - Idempotent transaction settlement.
  - Row-level lock (`SELECT ... FOR UPDATE`) prevents double-crediting.
  - Live simulation endpoint (`POST /api/khqr/simulate`) for instant local testing.

### 4. Table Management & Betting (Max 10 Players)
- Strictly **10 players per table**.
- Concurrency handled via PostgreSQL transactions & row-level locking:
  ```sql
  BEGIN;
  SELECT * FROM tables WHERE id = $1 FOR UPDATE;
  -- Verify status == 'waiting' and current_players < 10
  -- Debit entry fee from user wallet with SELECT coin_balance FROM users FOR UPDATE
  -- Insert into table_players
  -- Increment current_players; If 10, set status = 'playing'
  COMMIT;
  ```

### 5. Lottery Generation & Real-Time Drawing Mechanics
- **Ticket Generation**: Cryptographically secure random 5 numbers (range **1 to 99**) generated via `crypto.randomInt(1, 100)`.
- **Distinct Tickets**: Uniqueness check ensures no two players at the same table receive identical tickets.
- **Real-Time Drawing**:
  - Broadcasts ball extractions **every 3 seconds** over Socket.io.
  - Matches calculated dynamically per round.
  - **Winning Condition**: First player to achieve a complete 5/5 match stops the draw immediately.

### 6. Automated Payout & Platform Fee (10%)
- **Total Pool**: `10 × Entry Fee Coins`.
- **Platform Commission (10%)**: Deducted automatically and logged.
- **Winner Payout (90%)**: Credited directly to the winner's wallet atomically.
- **Celebration**: Triggers real-time fanfare audio (`Howler.js`) and multi-angle confetti explosion (`canvas-confetti`).

### 7. Coin-to-Cash Withdrawal System
- **Dynamic Exchange Rate**: Stored in `system_settings` table (`1500 coins = $1.00 USD`).
- Bank details: Supports ABA Bank, ACLEDA Bank, Wing, Canadia, Sathapana, etc.
- Immediate escrow deduction upon request submission.
- Admin/Finance can approve or reject (rejecting refunds coins atomically back to the user's wallet).

### 8. Comprehensive Admin Operations Console
- Live KPI cards: Platform Revenue, Pool Volume, Registered Users, Pending Cash-Outs.
- Dynamic System Settings Editor: Update exchange rates and fees live without deploying code.
- User RBAC Editor & Suspension controls.
- Withdrawal Approval Queue with 1-click approvals and refund reasons.
- Searchable Audit Security Log.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)
- Redis (optional for single-node development, required for multi-node production)

### 1. Database Setup
```bash
# Create the PostgreSQL database
createdb kh_lotto

# Import the schema and seed data
psql -d kh_lotto -f backend/schema.sql
```

Default Admin Credentials:
- **Email**: `admin@kh-lotto.com`
- **Password**: `Admin@123456`

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env

# Edit .env with your PostgreSQL credentials
# Start backend server
npm start
```

Backend will run at: `http://localhost:5000`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend will run at: `http://localhost:3000`

---

## 🧪 Testing the Real-Time Drawing Flow

1. Open `http://localhost:3000` and sign in as `admin@kh-lotto.com`.
2. Open an Incognito window, register a new player (e.g. `luckyguy`), and claim the **Daily Bonus** (or Top-up with simulated KHQR).
3. In Dashboard, click **Quick Play** or **Create Table**.
4. Once 10 seats fill (or simulate seats), the table status locks to **Playing**, the 5-second countdown triggers, and numbers from 1 to 99 are drawn every 3 seconds until a champion wins the 90% payout!
