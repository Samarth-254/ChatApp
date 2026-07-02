const crypto = require('crypto');
const { pool } = require('../db');

const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function normalizeRoomCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeRoomName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function generateRoomCode() {
  let code = '';

  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
  }

  return code;
}

async function findRoomByCode(code) {
  const normalizedCode = normalizeRoomCode(code);

  if (!normalizedCode) {
    return null;
  }

  const result = await pool.query(
    'SELECT id AS room_id, code, name, created_by, created_at FROM rooms WHERE code = $1 LIMIT 1',
    [normalizedCode]
  );

  return result.rows[0] || null;
}

async function findRoomById(roomId) {
  if (typeof roomId !== 'string' || !roomId) {
    return null;
  }

  const result = await pool.query(
    'SELECT id AS room_id, code, name, created_by, created_at FROM rooms WHERE id = $1 LIMIT 1',
    [roomId]
  );

  return result.rows[0] || null;
}

async function createRoom({ name, createdBy }) {
  const normalizedName = normalizeRoomName(name);
  const normalizedCreatedBy = typeof createdBy === 'string' ? createdBy.trim() : '';

  if (!normalizedCreatedBy) {
    throw new Error('createdBy is required');
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRoomCode();

    try {
      const result = await pool.query(
        `
          INSERT INTO rooms (code, name, created_by)
          VALUES ($1, $2, $3)
          RETURNING id AS room_id, code, name
        `,
        [code, normalizedName, normalizedCreatedBy]
      );

      return result.rows[0];
    } catch (error) {
      if (error?.code !== '23505') {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate a unique room code');
}

module.exports = {
  createRoom,
  findRoomByCode,
  findRoomById,
  generateRoomCode,
  normalizeRoomCode,
};
