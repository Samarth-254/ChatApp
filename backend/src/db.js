const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy backend/.env.example to backend/.env and set DATABASE_URL.');
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function ensureMessagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      room_id UUID,
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id UUID');

  const nullRoomResult = await pool.query('SELECT COUNT(*)::int AS count FROM messages WHERE room_id IS NULL');

  if (nullRoomResult.rows[0]?.count > 0) {
    const legacyRoom = await ensureLegacyRoom();

    if (legacyRoom) {
      await pool.query('UPDATE messages SET room_id = $1 WHERE room_id IS NULL', [legacyRoom.id]);
    }
  }

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'messages'
          AND constraint_name = 'messages_room_id_fkey'
      ) THEN
        ALTER TABLE messages
          ADD CONSTRAINT messages_room_id_fkey
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await pool.query('ALTER TABLE messages ALTER COLUMN room_id SET NOT NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS messages_room_id_created_at_idx ON messages (room_id, created_at, id)');
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureRoomsTable() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(8) NOT NULL UNIQUE,
      name VARCHAR(255),
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms (code)');
}

async function ensureLegacyRoom() {
  const inserted = await pool.query(
    `
      INSERT INTO rooms (code, name, created_by)
      VALUES ('LEGACY', 'Legacy room', 'system')
      ON CONFLICT (code) DO NOTHING
      RETURNING id, code, name
    `
  );

  if (inserted.rows[0]) {
    return inserted.rows[0];
  }

  const existing = await pool.query('SELECT id, code, name FROM rooms WHERE code = $1 LIMIT 1', ['LEGACY']);
  return existing.rows[0] || null;
}

module.exports = {
  pool,
  ensureMessagesTable,
  ensureRoomsTable,
  ensureUsersTable,
  ensureLegacyRoom,
};
