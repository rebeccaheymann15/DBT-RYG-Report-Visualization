import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'rebecca.heymann@merkle.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Create transporter based on environment
let transporter;

if (process.env.EMAIL_SERVICE === 'gmail') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
} else if (process.env.EMAIL_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
} else {
  console.warn('⚠️  Email service not configured. Set EMAIL_SERVICE or EMAIL_HOST environment variables.');
}

async function sendSignupVerificationEmail(email, token) {
  if (!transporter) {
    console.warn(`⚠️  Email not sent (transporter not configured). Signup request from ${email} needs manual approval.`);
    console.warn(`   Admin approval URL: ${APP_URL}/admin/verify-signup/${token}`);
    return; // Don't throw, just warn and continue
  }

  const approveUrl = `${APP_URL}/admin/verify-signup/${token}`;
  const denyUrl = `${APP_URL}/admin/deny-signup/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: ADMIN_EMAIL,
    subject: `New Signup Request: ${email}`,
    html: `
      <h2>New Signup Request</h2>
      <p>Email: <strong>${email}</strong></p>
      <p>Someone is requesting access to the DX Project Portfolio tool with this email address.</p>
      <p>
        <a href="${approveUrl}" style="background: #388e3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
          Approve
        </a>
        <a href="${denyUrl}" style="background: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Deny
        </a>
      </p>
      <p style="color: #999; font-size: 12px;">This request will expire in 24 hours.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Signup verification email sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error('⚠️  Error sending signup verification email:', err.message);
    console.error(`   Signup request from ${email} created but email notification failed.`);
    // Don't throw - let signup succeed even if email fails
  }
}

async function sendPasswordSetupEmail(email, token) {
  if (!transporter) {
    console.warn(`⚠️  Password setup email not sent to ${email} (transporter not configured).`);
    console.warn(`   Setup URL: ${APP_URL}/setup-password/${token}`);
    return;
  }

  const setupUrl = `${APP_URL}/setup-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Complete Your DX Project Portfolio Account Setup',
    html: `
      <h2>Welcome to DX Project Portfolio</h2>
      <p>Your signup has been approved! Click the link below to set your password and complete your account setup.</p>
      <p style="margin: 24px 0;">
        <a href="${setupUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Set Password
        </a>
      </p>
      <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Password setup email sent to ${email}`);
  } catch (err) {
    console.error('⚠️  Error sending password setup email to ${email}:', err.message);
  }
}

async function sendPasswordResetEmail(email, token) {
  if (!transporter) {
    console.warn(`⚠️  Password reset email not sent to ${email} (transporter not configured).`);
    console.warn(`   Reset URL: ${APP_URL}/reset-password/${token}`);
    return;
  }

  const resetUrl = `${APP_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Reset Your DX Project Portfolio Password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Password reset email sent to ${email}`);
  } catch (err) {
    console.error('⚠️  Error sending password reset email to ${email}:', err.message);
  }
}

async function sendSignupApprovedEmail(email) {
  if (!transporter) {
    console.warn(`⚠️  Denial email not sent to ${email} (transporter not configured).`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your DX Project Portfolio Request Has Been Denied',
    html: `
      <h2>Signup Request Denied</h2>
      <p>Unfortunately, your signup request for the DX Project Portfolio has been denied.</p>
      <p>If you believe this is a mistake, please contact the administrator.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error(`⚠️  Error sending denial email to ${email}:`, err.message);
  }
}

export {
  sendSignupVerificationEmail,
  sendPasswordSetupEmail,
  sendPasswordResetEmail,
  sendSignupApprovedEmail,
  ADMIN_EMAIL
};
