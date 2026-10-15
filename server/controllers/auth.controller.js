const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const INSECURE_JWT_SECRETS = new Set([
  'super_secret_jwt_key_diploma_smart_parking_2026',
  'secret',
  'jwt_secret',
  'changeme',
  '12345678',
  'replace_with_a_long_random_secret',
  'your_jwt_secret_here',
  'default_secret',
  'smartparking'
]);

function getValidatedJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || INSECURE_JWT_SECRETS.has(secret.trim().toLowerCase()) || secret.length < 32) {
      throw new Error('Fatal Security Blocker: In production mode, you must set a strong, unique JWT_SECRET (minimum 32 characters, non-default).');
    }
    return secret;
  }

  return secret || 'super_secret_jwt_key_diploma_smart_parking_2026';
}

function generateToken(user) {
  const secret = getValidatedJwtSecret();
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { full_name, email, password, phone, role } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, and password.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Explicitly prohibit self-registration with administrator privileges
    if (role && role.toLowerCase().trim() === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Self-registration with administrator privileges is prohibited.'
      });
    }

    // Check if user already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Enforce role strictly as 'user'
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)',
      [full_name.trim(), email.toLowerCase().trim(), passwordHash, phone || null, 'user']
    );

    const newUser = {
      id: result.insertId,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      role: 'user'
    };

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: newUser
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const [rows] = await db.execute(
      'SELECT id, full_name, email, password_hash, phone, role FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function getMe(req, res, next) {
  try {
    const [rows] = await db.execute(
      'SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      user: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/profile
async function updateProfile(req, res, next) {
  try {
    const { full_name, phone, current_password, new_password } = req.body;
    const userId = req.user.id;

    const [userRows] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userRows[0];

    // If changing password, verify current password
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to set a new password.'
        });
      }

      const match = await bcrypt.compare(current_password, user.password_hash);
      if (!match) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect current password.'
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters.'
        });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
    }

    // Update name and phone
    const updatedName = full_name ? full_name.trim() : user.full_name;
    const updatedPhone = phone !== undefined ? phone : user.phone;

    await db.execute(
      'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
      [updatedName, updatedPhone, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user.id,
        full_name: updatedName,
        email: user.email,
        phone: updatedPhone,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  generateToken,
  getValidatedJwtSecret
};
