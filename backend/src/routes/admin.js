import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [
        { isApproved: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        email: true,
        name: true,
        shortName: true,
        color: true,
        picture: true,
        isApproved: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user details
router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { shortName, color } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        shortName,
        color
      },
      select: {
        id: true,
        email: true,
        name: true,
        shortName: true,
        color: true,
        picture: true,
        isApproved: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Approve user
router.patch('/users/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isApproved: true },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        isApproved: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Revoke user access
router.patch('/users/:id/revoke', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent revoking admin users
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (adminEmails.includes(targetUser.email.toLowerCase())) {
      return res.status(400).json({ error: 'Cannot revoke admin user access' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isApproved: false },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        isApproved: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Error revoking user access:', error);
    res.status(500).json({ error: 'Failed to revoke user access' });
  }
});

// Delete user (only if not approved)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Can only delete users that are not approved
    if (targetUser.isApproved) {
      return res.status(400).json({ error: 'Cannot delete an approved user. Revoke access first.' });
    }

    // Prevent deleting admin users
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (adminEmails.includes(targetUser.email.toLowerCase())) {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
