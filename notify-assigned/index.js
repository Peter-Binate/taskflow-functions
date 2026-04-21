import { Resend } from 'resend'

const resend   = new Resend(process.env.RESEND_API_KEY)
const SUPA_URL = process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY

// Récupère l'email et le profil d'un utilisateur via son UUID
async function getUserInfo(userId) {
  const userRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey:        SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  })
  const user = await userRes.json()

  const profileRes = await fetch(
    `${SUPA_URL}/rest/v1/profiles?id=eq.${userId}&select=username,full_name`,
    {
      headers: {
        apikey:        SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`
      }
    }
  )
  const [profile] = await profileRes.json()

  return { email: user.email, ...profile }
}

// Insère une notification dans la table Supabase
async function insertNotification(userId, type, title, body, metadata) {
  await fetch(`${SUPA_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers: {
      apikey:         SUPA_KEY,
      Authorization:  `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({ user_id: userId, type, title, body, metadata }),
  })
}

export default async function (context, req) {
  const payload = req.body

  // Ignorer tout ce qui n'est pas un UPDATE
  if (!payload || payload.type !== 'UPDATE') {
    context.res = { status: 200, body: 'ignored' }
    return
  }

  const { record, old_record } = payload
  const newAssignee = record?.assigned_to
  const oldAssignee = old_record?.assigned_to

  // Ne rien faire si l'assigné n'a pas changé
  if (!newAssignee || newAssignee === oldAssignee) {
    context.res = { status: 200, body: 'no new assignment' }
    return
  }

  try {
    const assignee = await getUserInfo(newAssignee)

    // Envoyer l'email via Resend
    await resend.emails.send({
      from:    'TaskFlow <notifications@resend.dev>',
      to:      [assignee.email],
      subject: `[TaskFlow] Nouvelle tâche : ${record.title}`,
      html: `
        <h2>Bonjour ${assignee.full_name ?? assignee.username},</h2>
        <p>Une tâche vient de vous être assignée :</p>
        <p><strong>${record.title}</strong></p>
        <p>Priorité : ${record.priority}</p>
      `,
    })

    // Insérer la notification en base
    await insertNotification(
      newAssignee,
      'task_assigned',
      `Nouvelle tâche : ${record.title}`,
      `Priorité ${record.priority}`,
      { task_id: record.id, project_id: record.project_id }
    )

    context.res = { status: 200, body: JSON.stringify({ ok: true }) }

  } catch (err) {
    context.log.error(err.message)
    context.res = { status: 500, body: JSON.stringify({ error: err.message }) }
  }
}