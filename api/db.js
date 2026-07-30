import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL environment variable not set. Database features will not work.');
  console.warn('Please set DATABASE_URL to your Neon PostgreSQL connection string.');
}

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}) : null;

let dbReady = false;

// Initialize database schema
export async function initializeDB() {
  if (!pool) {
    console.error('❌ Database pool not initialized. DATABASE_URL is not set.');
    return;
  }

  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to Neon PostgreSQL');

    // Check if old users table exists with username column and migrate
    try {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
      `);

      if (result.rows.length > 0) {
        console.log('⚠️  Migrating old users table schema...');
        // Drop old users table and related foreign keys
        await pool.query('DROP TABLE IF EXISTS password_reset_tokens CASCADE');
        await pool.query('DROP TABLE IF EXISTS users CASCADE');
        console.log('✓ Dropped old schema, recreating with new structure');
      }
    } catch (err) {
      // Table might not exist yet, that's fine
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS signup_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_setup_tokens (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        report_id VARCHAR(255) UNIQUE NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        upload_time TIMESTAMP NOT NULL,
        report_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      );

      CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
      CREATE INDEX IF NOT EXISTS idx_reports_id ON reports(report_id);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    `);
    console.log('✓ Database schema initialized');
    dbReady = true;
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
    dbReady = false;
  }
}

// Query functions
export const db = {
  isReady() {
    return dbReady && pool !== null;
  },

  async saveReport(reportId, originalName, uploadTime, htmlContent) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `INSERT INTO reports (report_id, original_name, upload_time, report_html)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id) DO UPDATE SET report_html = $4
         RETURNING *;`,
        [reportId, originalName, uploadTime, htmlContent]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error saving report:', err.message);
      throw err;
    }
  },

  async getReport(reportId) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        'SELECT report_html FROM reports WHERE report_id = $1;',
        [reportId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting report:', err.message);
      throw err;
    }
  },

  async getAllReports() {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `SELECT id, report_id, original_name, upload_time
         FROM reports
         ORDER BY created_at DESC;`
      );
      return result.rows.map(row => ({
        id: row.report_id,
        originalName: row.original_name,
        uploadTime: row.upload_time.toISOString()
      }));
    } catch (err) {
      console.error('Error getting all reports:', err.message);
      throw err;
    }
  },

  async deleteReport(reportId) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      await pool.query(
        'DELETE FROM reports WHERE report_id = $1;',
        [reportId]
      );
    } catch (err) {
      console.error('Error deleting report:', err.message);
      throw err;
    }
  },

  async createUser(email, passwordHash, verified = true) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, verified) VALUES ($1, $2, $3) RETURNING id, email;',
        [email, passwordHash, verified]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error creating user:', err.message);
      throw err;
    }
  },

  async createPasswordSetupToken(email, token, expiresAt) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `INSERT INTO password_setup_tokens (email, token, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, token;`,
        [email, token, expiresAt]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error creating password setup token:', err.message);
      throw err;
    }
  },

  async getPasswordSetupToken(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `SELECT id, email, token, expires_at FROM password_setup_tokens
         WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL;`,
        [token]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting password setup token:', err.message);
      throw err;
    }
  },

  async markPasswordSetupTokenUsed(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      await pool.query(
        `UPDATE password_setup_tokens SET used_at = NOW()
         WHERE token = $1;`,
        [token]
      );
    } catch (err) {
      console.error('Error marking setup token used:', err.message);
      throw err;
    }
  },

  async getUserByEmail(email) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        'SELECT id, email, password_hash, verified FROM users WHERE email = $1;',
        [email]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting user:', err.message);
      throw err;
    }
  },

  async createSignupRequest(email, token, expiresAt) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `INSERT INTO signup_requests (email, token, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3, status = 'pending'
         RETURNING id, email, token;`,
        [email, token, expiresAt]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error creating signup request:', err.message);
      throw err;
    }
  },

  async getSignupRequest(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `SELECT id, email, token, status, expires_at FROM signup_requests
         WHERE token = $1 AND expires_at > NOW();`,
        [token]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting signup request:', err.message);
      throw err;
    }
  },

  async approveSignup(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `UPDATE signup_requests SET status = 'approved', approved_at = NOW()
         WHERE token = $1 AND status = 'pending'
         RETURNING email;`,
        [token]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error approving signup:', err.message);
      throw err;
    }
  },

  async rejectSignup(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `UPDATE signup_requests SET status = 'rejected', rejected_at = NOW()
         WHERE token = $1 AND status = 'pending'
         RETURNING email;`,
        [token]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error rejecting signup:', err.message);
      throw err;
    }
  },

  async getApprovedSignup(email) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `SELECT id, email, status FROM signup_requests
         WHERE email = $1 AND status = 'approved'
         ORDER BY approved_at DESC LIMIT 1;`,
        [email]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting approved signup:', err.message);
      throw err;
    }
  },

  async createPasswordResetToken(userId, token, expiresAt) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, token;`,
        [userId, token, expiresAt]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error creating password reset token:', err.message);
      throw err;
    }
  },

  async getPasswordResetToken(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      const result = await pool.query(
        `SELECT id, user_id, token, expires_at FROM password_reset_tokens
         WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL;`,
        [token]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting password reset token:', err.message);
      throw err;
    }
  },

  async markPasswordResetTokenUsed(token) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      await pool.query(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE token = $1;`,
        [token]
      );
    } catch (err) {
      console.error('Error marking token used:', err.message);
      throw err;
    }
  },

  async updateUserPassword(username, passwordHash) {
    if (!this.isReady()) {
      throw new Error('Database not initialized. Make sure DATABASE_URL is set.');
    }
    try {
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2;',
        [passwordHash, username]
      );
    } catch (err) {
      console.error('Error updating password:', err.message);
      throw err;
    }
  },

  getPool() {
    return pool;
  }
};
