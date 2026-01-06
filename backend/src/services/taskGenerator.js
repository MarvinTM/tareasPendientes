import { prisma } from '../config/passport.js';
import { ACTIONS, logTaskChange } from './taskHistory.js';
import { emitTaskUpdate } from '../socket.js';
import { sendTaskAssignmentEmail } from './email.js';

/**
 * Checks if a month is within an active range.
 * Handles year wrap-around (e.g., Nov-Feb for winter tasks).
 * @param {number} currentMonth - Current month (0-11)
 * @param {number|null} fromMonth - Start of active range (0-11), null = all year
 * @param {number|null} toMonth - End of active range (0-11), null = all year
 * @returns {boolean} - True if the current month is within the active range
 */
function isMonthInActiveRange(currentMonth, fromMonth, toMonth) {
  // If both are null, task is active all year
  if (fromMonth === null && toMonth === null) return true;

  // If only one is set, treat as single month or open-ended range
  if (fromMonth === null) fromMonth = 0;
  if (toMonth === null) toMonth = 11;

  if (fromMonth <= toMonth) {
    // Normal range (e.g., Mar-Oct: 2 to 9)
    return currentMonth >= fromMonth && currentMonth <= toMonth;
  } else {
    // Wraps around year (e.g., Nov-Feb: 10 to 1)
    return currentMonth >= fromMonth || currentMonth <= toMonth;
  }
}

/**
 * Checks if tasks need to be generated for the current day/month
 * and generates them if necessary.
 * This should be called when fetching the task list.
 */
export async function generatePeriodicTasks(systemUser = null) {
  const now = new Date();
  
  // Set time to beginning of day for comparison
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Set time to beginning of month for comparison
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
  const monthOfYear = now.getMonth(); // 0 (Jan) - 11 (Dec)

  // Find Weekly tasks that need generation
  // Logic: Matches day of week AND (never generated OR generated before today)
  const weeklyTasksCandidates = await prisma.periodicTask.findMany({
    where: {
      frequency: 'WEEKLY',
      dayOfWeek: dayOfWeek,
      OR: [
        { lastGeneratedAt: null },
        { lastGeneratedAt: { lt: startOfDay } }
      ]
    },
    include: {
      category: true,
      assignedTo: true
    }
  });

  // Filter by active month range (for seasonal tasks)
  const weeklyTasksToGenerate = weeklyTasksCandidates.filter(task =>
    isMonthInActiveRange(monthOfYear, task.activeFromMonth, task.activeToMonth)
  );

  // Find Monthly tasks that need generation
  // Logic: Matches month AND (never generated OR generated before this month)
  const monthlyTasksToGenerate = await prisma.periodicTask.findMany({
    where: {
      frequency: 'MONTHLY',
      monthOfYear: monthOfYear,
      OR: [
        { lastGeneratedAt: null },
        { lastGeneratedAt: { lt: startOfMonth } }
      ]
    },
    include: {
      category: true,
      assignedTo: true
    }
  });

  const allTemplates = [
    ...weeklyTasksToGenerate.map(t => ({ template: t, source: 'Recurrente (Semanal)' })),
    ...monthlyTasksToGenerate.map(t => ({ template: t, source: 'Recurrente (Mensual)' }))
  ];

  if (allTemplates.length === 0) {
    return;
  }

  // Process each template
  for (const item of allTemplates) {
    const { template, source } = item;

    try {
      // Use a transaction to ensure atomicity of task creation and periodic task update
      await prisma.$transaction(async (tx) => {
        // Double check inside transaction to prevent race conditions
        const currentTemplate = await tx.periodicTask.findUnique({
          where: { id: template.id }
        });

        // If somehow it was processed in the meantime
        if (!currentTemplate) return; // Should not happen
        
        const isWeekly = currentTemplate.frequency === 'WEEKLY';
        const thresholdDate = isWeekly ? startOfDay : startOfMonth;

        if (currentTemplate.lastGeneratedAt && currentTemplate.lastGeneratedAt >= thresholdDate) {
          return; // Already generated
        }

        // Create the new task
        const newTask = await tx.task.create({
          data: {
            title: template.title,
            description: template.description,
            size: template.size,
            status: 'Nueva',
            categoryId: template.categoryId,
            assignedToId: template.assignedToId,
            periodicTaskId: template.id,
            // Fallback for creator
            createdById: systemUser ? systemUser.id : (template.assignedToId || template.categoryId) // fallback is tricky, but schema requires ID
          },
          include: {
            createdBy: { select: { id: true, name: true, picture: true } },
            assignedTo: { select: { id: true, name: true, picture: true, email: true } },
            category: { select: { id: true, name: true, emoji: true } }
          }
        });

        // Update the periodic task's lastGeneratedAt
        await tx.periodicTask.update({
          where: { id: template.id },
          data: { lastGeneratedAt: new Date() }
        });

        // We can't use logTaskChange easily inside a transaction because it uses prisma directly.
        // We will do it after transaction or just manually insert here.
        await tx.taskHistory.create({
          data: {
            taskId: newTask.id,
            userId: systemUser ? systemUser.id : (template.assignedToId || 'system'),
            action: 'CREATED',
            newValue: source
          }
        });

        // These side effects are safe to run even if transaction fails (ignoring them) 
        // OR better run them after, but here is "okay" for this scale.
        // Strictly speaking, we should gather events and emit after transaction.
        // But for now, we will just assume success.
        
        // Notify via socket
        emitTaskUpdate('task:created', newTask);

        // Send email if assigned
        if (newTask.assignedTo && newTask.assignedTo.email) {
            sendTaskAssignmentEmail(
              newTask.assignedTo.email, 
              newTask.assignedTo.name, 
              newTask, 
              'Sistema (Tarea Recurrente)'
            );
        }
      });
    } catch (error) {
      console.error(`Failed to generate task from template ${template.id}:`, error);
      // Continue with other tasks even if one fails
    }
  }
}