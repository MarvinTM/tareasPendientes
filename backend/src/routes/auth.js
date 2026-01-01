import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/passport.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';

const router = express.Router();

// Initiate Google OAuth
router.get('/google', (req, res, next) => {
  // Construct callback URL dynamically based on the request host
  const protocol = req.protocol;
  const host = req.get('host');
  const callbackURL = `${protocol}://${host}/api/auth/google/callback`;

  // Use OAuth state parameter to pass redirect origin (more reliable than cookies for Safari)
  const redirectOrigin = req.query.redirect_origin || `${protocol}://${host.replace(':3001', ':5173')}`;
  const state = Buffer.from(JSON.stringify({ redirectOrigin })).toString('base64');

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL: callbackURL,
    state: state
  })(req, res, next);
});

// Google OAuth callback
router.get('/google/callback', (req, res, next) => {
  // Construct callback URL dynamically (must match the one used in /google)
  const protocol = req.protocol;
  const host = req.get('host');
  const callbackURL = `${protocol}://${host}/api/auth/google/callback`;

  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login',
    callbackURL: callbackURL
  })(req, res, next);
}, (req, res) => {
    const token = generateToken(req.user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Get redirect URL from OAuth state parameter
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      if (req.query.state) {
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        if (state.redirectOrigin) {
          frontendUrl = state.redirectOrigin;
        }
      }
    } catch (e) {
      console.error('Failed to parse OAuth state:', e);
    }

    res.redirect(frontendUrl);
  }
);

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const isAdmin = adminEmails.includes(req.user.email.toLowerCase());

  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    shortName: req.user.shortName,
    color: req.user.color,
    picture: req.user.picture,
    isApproved: req.user.isApproved,
    isAdmin
  });
});

// Check auth status (doesn't require approval)
router.get('/status', async (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.json({ authenticated: false });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        shortName: user.shortName,
        color: user.color,
        picture: user.picture,
        isApproved: user.isApproved,
        isAdmin
      }
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

export default router;
