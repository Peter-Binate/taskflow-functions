import { createClient } from '@supabase/supabase-js'

export default async function (context, req) {

  const projectId = req.query.project_id
  if (!projectId) {
    context.res = { status: 400, body: 'project_id requis' }
    return
  }

  // Client admin — pas besoin d'auth pour les stats
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data: allTasks } = await supabase
    .from('tasks')
    .select('status, due_date, assigned_to')
    .eq('project_id', projectId)

  // Compter les tâches par statut
  const statusCount = (allTasks ?? []).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  // Tâches en retard (due_date dépassée et pas encore done)
  const today = new Date().toISOString().split('T')[0]
  const overdueCount = (allTasks ?? [])
    .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
    .length

  // Membres actifs (ayant au moins une tâche assignée)
  const uniqueMembers = new Set(
    (allTasks ?? []).map(t => t.assigned_to).filter(Boolean)
  ).size

  const total = allTasks?.length ?? 0
  const done  = statusCount['done'] ?? 0

  context.res = {
    status: 200,
    body: JSON.stringify({
      total_tasks:     total,
      completion_rate: total > 0 ? Math.round((done / total) * 100) : 0,
      by_status:       statusCount,
      overdue_count:   overdueCount,
      active_members:  uniqueMembers,
    })
  }
}