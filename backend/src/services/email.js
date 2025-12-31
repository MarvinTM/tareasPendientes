import nodemailer from 'nodemailer';

// Create transporter only if email is configured
let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
}

const sizeLabels = {
  Pequena: 'Pequeña (S)',
  Mediana: 'Mediana (M)',
  Grande: 'Grande (L)'
};

export async function sendTaskAssignmentEmail(assigneeEmail, assigneeName, task, assignedByName) {
  if (!transporter) {
    console.log('Email not configured - skipping notification');
    return;
  }

  const sizeLabel = sizeLabels[task.size] || task.size;

  const mailOptions = {
    from: `"Tareas Pendientes" <${process.env.EMAIL_USER}>`,
    to: assigneeEmail,
    subject: `Nueva tarea asignada: "${task.title}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Hola ${assigneeName.split(' ')[0]},</h2>

        <p>Se te ha asignado una nueva tarea:</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">${task.title}</h3>
          ${task.description ? `<p style="color: #666;">${task.description}</p>` : ''}
          <p style="margin-bottom: 0;">
            <strong>Dificultad:</strong> ${sizeLabel}
          </p>
        </div>

        <p style="color: #666;">
          Asignada por: <strong>${assignedByName}</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

        <p style="color: #999; font-size: 12px;">
          Este es un mensaje automático de Tareas Pendientes.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Assignment email sent to ${assigneeEmail}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
