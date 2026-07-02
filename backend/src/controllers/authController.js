const bcrypt = require('bcryptjs');
const { createUser, findUserByUsername } = require('../models/userModel');
const { signAuthToken } = require('../utils/auth');

function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePassword(value) {
  return typeof value === 'string' ? value : '';
}

function createAuthResponse(user) {
  return {
    token: signAuthToken({ userId: user.id, username: user.username }),
    username: user.username,
  };
}

async function register(req, res) {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = normalizePassword(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await findUserByUsername(username);

    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(username, passwordHash);

    return res.status(201).json(createAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed' });
  }
}

async function login(req, res) {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = normalizePassword(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    return res.json(createAuthResponse(user));
  } catch (error) {
    return res.status(500).json({ message: 'Login failed' });
  }
}

module.exports = { login, register };
