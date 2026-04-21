import { createClient } from '@supabase/supabase-js'

export default async function (context, req) {

  const authHeader = req.headers['authorization']
  if (!authHeader) {
    context.res = { status: 401, body: 'Non authentifié' }
    return
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  )
  const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { project_id, title, due_date, assigned_to } = req.body ?? {}
  const errors = []


  if (!title || title.trim().length < 3)
    errors.push('Le titre doit faire au moins 3 caractères')

  if (title?.length > 200)
    errors.push('Le titre ne peut pas dépasser 200 caractères')

  if (due_date && new Date(due_date) < new Date())
    errors.push("La date d'échéance ne peut pas être dans le passé")

  if (assigned_to) {
    const { data: membership } = await adminClient
      .from('project_members')
      .select('user_id')
      .eq('project_id', project_id)
      .eq('user_id', assigned_to)
      .single()

    if (!membership)
      errors.push("L'utilisateur assigné n'est pas membre du projet")
  }


  if (errors.length > 0) {
    context.res = { status: 400, body: JSON.stringify({ valid: false, errors }) }
    return
  }

  const { data: { user } } = await supabase.auth.getUser()

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      project_id,
      title: title.trim(),
      due_date,
      assigned_to,
      created_by: user?.id
    })
    .select()
    .single()

  context.res = error
    ? { status: 500, body: JSON.stringify({ error: error.message }) }
    : { status: 201, body: JSON.stringify({ valid: true, task }) }
}