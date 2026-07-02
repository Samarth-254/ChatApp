const { pool } = require('../db');

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

async function getMessagesByRoomId(roomId) {
  const result = await pool.query(
    'SELECT id, room_id, sender_name, content, created_at FROM messages WHERE room_id = $1 ORDER BY created_at ASC, id ASC',
    [roomId]
  );

  return result.rows;
}

async function createMessage(roomId, senderName, content) {
  const result = await pool.query(
    'INSERT INTO messages (room_id, sender_name, content) VALUES ($1, $2, $3) RETURNING id, room_id, sender_name, content, created_at',
    [roomId, senderName, content]
  );

  return result.rows[0];
}

module.exports = {
  ensureMessagesTable,
  ensureUsersTable,
  getMessagesByRoomId,
  createMessage,
};
