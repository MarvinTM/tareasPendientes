import express from 'express';
import { prisma } from '../config/passport.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

const router = express.Router();

// Get all categories (for any authenticated user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        emoji: true,
        createdAt: true,
        _count: {
          select: { tasks: true }
        }
      }
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, emoji } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        emoji: emoji.trim()
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        createdAt: true,
        _count: {
          select: { tasks: true }
        }
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category (admin only)
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emoji } = req.body;

    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updateData.name = name.trim();
    }
    if (emoji !== undefined) {
      if (!emoji.trim()) {
        return res.status(400).json({ error: 'Emoji cannot be empty' });
      }
      updateData.emoji = emoji.trim();
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        emoji: true,
        createdAt: true,
        _count: {
          select: { tasks: true }
        }
      }
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category (admin only, blocked if tasks exist)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tasks: true }
        }
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category._count.tasks > 0) {
      return res.status(400).json({
        error: `Cannot delete category. It has ${category._count.tasks} task(s) assigned to it.`
      });
    }

    await prisma.category.delete({ where: { id } });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
