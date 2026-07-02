const { pool } = require('../db');

async function findUserByUsername(username) {
  const result = await pool.query(
    'SELECT id, username, password_hash, created_at FROM users WHERE username = $1 LIMIT 1',
    [username]
  );

  return result.rows[0] || null;
}

async function createUser(username, passwordHash) {
  const result = await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, passwordHash]
  );

  return result.rows[0];
}

module.exports = {
  findUserByUsername,
  createUser,
};
