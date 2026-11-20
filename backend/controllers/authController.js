import crypto from 'crypto';
import dns from 'node:dns/promises';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import PendingSignup from '../models/PendingSignup.js';

const EMAIL_REGEX = /^(?=.{1,254}$)(?=.{1,64}@)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i;

const hasMailRoute = async (domain) => {
  try {
    const records = await dns.resolveMx(domain);
    if (records.length > 0) return true;
  } catch (err) {
    if (err.code === 'ENOTFOUND') return false;
    if (err.code !== 'ENODATA') throw err;
  }

  for (const resolve of [dns.resolve4, dns.resolve6]) {
    try {
      const records = await resolve(domain);
      if (records.length > 0) return true;
    } catch (err) {
      if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') throw err;
    }
  }

  return false;
};

const createMailer = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof email !== 'string') {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ msg: 'Password is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }

    const emailDomain = normalizedEmail.split('@')[1];
    let domainCanReceiveEmail;
    try {
      domainCanReceiveEmail = await hasMailRoute(emailDomain);
    } catch (err) {
      if (['EAI_AGAIN', 'ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(err.code)) {
        return res.status(503).json({
          msg: 'Unable to validate the email domain right now. Please try again.',
        });
      }
      throw err;
    }

    if (!domainCanReceiveEmail) {
      return res.status(400).json({
        msg: 'This email domain cannot receive email. Please check the address.',
      });
    }

    const transporter = createMailer();
    if (!transporter) {
      return res.status(500).json({
        msg: 'Email service is not configured. Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS to your .env file.',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (user && user.emailVerified) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const pendingSignup = await PendingSignup.findOneAndUpdate(
      { email: normalizedEmail },
      {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: pendingSignup.email,
      subject: 'Verify Your Email Address',
      html: `
        <h3>Verify your email address</h3>
        <p>Click the link below to verify your email and activate your account:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>This link will expire in 24 hours.</p>
      `,
    });

    res.status(201).json({ msg: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.emailVerified) {
      return res.status(404).json({ msg: 'User does not exist' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string' || !token) {
      return res.status(400).json({ msg: 'Verification token is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const pendingSignup = await PendingSignup.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (pendingSignup) {
      let user = await User.findOne({ email: pendingSignup.email });
      if (user && user.emailVerified) {
        await pendingSignup.deleteOne();
        return res.status(400).json({ msg: 'An account already exists for this email' });
      }

      if (user) {
        user.name = pendingSignup.name;
        user.password = pendingSignup.password;
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
      } else {
        await User.create({
          name: pendingSignup.name,
          email: pendingSignup.email,
          password: pendingSignup.password,
          emailVerified: true,
        });
      }

      await pendingSignup.deleteOne();
      return res.status(200).json({ msg: 'Email verified. You can now sign in.' });
    }

    // Complete verification links created before pending signups were separated.
    const legacyUser = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      emailVerified: false,
    });
    if (!legacyUser) {
      return res.status(400).json({ msg: 'Invalid or expired verification link' });
    }

    legacyUser.emailVerified = true;
    legacyUser.emailVerificationToken = undefined;
    legacyUser.emailVerificationExpires = undefined;
    await legacyUser.save();

    res.status(200).json({ msg: 'Email verified. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ msg: 'Email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ msg: 'Please verify your email address first.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = createMailer();
    if (!transporter) {
      return res.status(500).json({
        msg: 'Email service is not configured. Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS to your .env file.',
      });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h3>Password Reset</h3>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 10 minutes.</p>
      `,
    });

    res.status(200).json({
      msg: 'Password reset link sent to your email.',
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ msg: 'Token and new password are required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ msg: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
