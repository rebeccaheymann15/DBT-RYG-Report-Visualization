import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { db, initializeDB } from '../api/db.js';
import { generateReport } from './reportGenerator.js';
import {
  sendSignupVerificationEmail,
  sendPasswordSetupEmail,
  sendPasswordResetEmail,
  sendSignupApprovedEmail
} from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database on startup
await initializeDB();

// Create temporary upload directory for file processing
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Session store using PostgreSQL
const pgSessionStore = pgSession(session);
const sessionStore = new pgSessionStore({
  pool: db.getPool(),
  createTableIfMissing: true,
  tableName: 'session'
});

// Session middleware
const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
});

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

app.use(sessionMiddleware);
app.use(cors({ credentials: true }));
app.use(express.json());

// Helper function to generate tokens
function generateToken() {
  return randomBytes(32).toString('hex');
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  console.log('Auth check - session:', {
    sessionId: req.sessionID,
    userId: req.session?.userId,
    cookies: req.headers.cookie?.substring(0, 100)
  });
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ============ AUTHENTICATION ENDPOINTS ============

// Sign up with email
app.post('/api/auth/signup', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check if signup request already exists
    const existingRequest = await db.getSignupRequest(email);
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(409).json({ error: 'Signup request already pending. Check your email.' });
    }

    // Create signup request
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.createSignupRequest(email, token, expiresAt);

    // Send verification email to admin (non-blocking)
    sendSignupVerificationEmail(email, token).catch(err => {
      console.error('Failed to send signup verification email:', err.message);
    });

    res.json({
      success: true,
      message: 'Signup request submitted. Check your email for verification.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending signups (for manual approval)
app.get('/api/admin/pending-signups', async (req, res) => {
  try {
    const signups = await db.getPendingSignups();
    res.json(signups);
  } catch (error) {
    console.error('Error getting pending signups:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin approves signup
app.post('/api/admin/approve-signup/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const signupRequest = await db.getSignupRequest(token);
    if (!signupRequest) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    if (signupRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Signup request already processed' });
    }

    // Approve signup
    await db.approveSignup(token);

    // Generate password setup token
    const setupToken = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.createPasswordSetupToken(signupRequest.email, setupToken, expiresAt);

    // Send password setup email (non-blocking)
    sendPasswordSetupEmail(signupRequest.email, setupToken).catch(err => {
      console.error('Failed to send password setup email:', err.message);
    });

    res.json({
      success: true,
      message: `Signup approved. Password setup email sent to ${signupRequest.email}`,
      setupToken: setupToken,
      setupLink: `${process.env.APP_URL || 'http://localhost:5000'}/setup-password/${setupToken}`
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin rejects signup
app.post('/api/admin/reject-signup/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const signupRequest = await db.getSignupRequest(token);
    if (!signupRequest) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Reject signup
    await db.rejectSignup(token);

    // Send rejection email
    await sendSignupApprovedEmail(signupRequest.email);

    res.json({
      success: true,
      message: `Signup rejected. Notification sent to ${signupRequest.email}`
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set password after approval
app.post('/api/auth/set-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const setupToken = await db.getPasswordSetupToken(token);
    if (!setupToken) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.createUser(setupToken.email, hashedPassword, true);

    // Mark setup token as used
    await db.markPasswordSetupTokenUsed(token);

    // Log user in
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    res.json({
      success: true,
      message: 'Password set successfully. You are now logged in.'
    });
  } catch (error) {
    console.error('Password setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.json({
      success: true,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true, email: req.session.userEmail });
  } else {
    res.json({ authenticated: false });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If email exists, password reset link will be sent'
      });
    }

    // Create reset token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.createPasswordResetToken(user.id, token, expiresAt);

    // Send reset email (non-blocking)
    sendPasswordResetEmail(email, token).catch(err => {
      console.error('Failed to send password reset email:', err.message);
    });

    res.json({
      success: true,
      message: 'Password reset email sent if account exists'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset password
app.post('/api/auth/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const resetToken = await db.getPasswordResetToken(token);
    if (!resetToken) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await db.updateUserPassword(resetToken.user_id, hashedPassword);

    // Mark token as used
    await db.markPasswordResetTokenUsed(token);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PROTECTED ENDPOINTS ============

// Upload and process file (protected)
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = parseInt(req.file.filename.split('-')[0]);
  const uploadTime = new Date(timestamp);
  const reportId = timestamp.toString();

  try {
    // Generate report from Excel file
    let reportHTML;
    try {
      reportHTML = generateReport(filePath, originalName);
    } catch (error) {
      console.error('Error generating report:', error);
      reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report Generation Error</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .error { background: #fee; border: 1px solid #fcc; color: #c33; padding: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Report Generation Error</h3>
    <p>Could not process file: ${originalName}</p>
    <p>${error.message}</p>
  </div>
</body>
</html>
      `;
    }

    await db.saveReport(reportId, originalName, uploadTime, reportHTML);

    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.json({
      success: true,
      id: reportId,
      fileName: originalName,
      uploadTime: uploadTime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upload history (protected)
app.get('/api/uploads', requireAuth, async (req, res) => {
  try {
    const files = await db.getAllReports();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific report (protected)
app.get('/api/report/:id', requireAuth, async (req, res) => {
  try {
    const report = await db.getReport(req.params.id);
    if (report) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(report.report_html);
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'neon-postgresql' });
});

// Serve React app in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
