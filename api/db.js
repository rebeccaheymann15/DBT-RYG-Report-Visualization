const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database schema
async function initializeDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        report_id VARCHAR(255) UNIQUE NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        upload_time TIMESTAMP NOT NULL,
        report_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_reports_id ON reports(report_id);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    `);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Query functions
const db = {
  async saveReport(reportId, originalName, uploadTime, htmlContent) {
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
      console.error('Error saving report:', err);
      throw err;
    }
  },

  async getReport(reportId) {
    try {
      const result = await pool.query(
        'SELECT report_html FROM reports WHERE report_id = $1;',
        [reportId]
      );
      return result.rows[0];
    } catch (err) {
      console.error('Error getting report:', err);
      throw err;
    }
  },

  async getAllReports() {
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
      console.error('Error getting all reports:', err);
      throw err;
    }
  },

  async deleteReport(reportId) {
    try {
      await pool.query(
        'DELETE FROM reports WHERE report_id = $1;',
        [reportId]
      );
    } catch (err) {
      console.error('Error deleting report:', err);
      throw err;
    }
  }
};

module.exports = { db, initializeDB, pool };
