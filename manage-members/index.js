// manage-members/index.js
const { createClient } = require('@supabase/supabase-js')

module.exports = async function (context, req) {

  // Vérifier que l'utilisateur est authentifié
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    context.res = { status: 401, body: 'Unauthorized' }
    return
  }

  // Client utilisateur — pour vérifier son identité
  const userClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Client admin — pour les opérations sur project_members
  const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    context.res = { status: 401, body: 'Invalid token' }
    return
  }

  const { action, project_id, target_user_id, role } = req.body ?? {}

  // Vérifier que l'appelant est admin ou owner du projet
  const { data: callerRole } = await adminClient
    .from('project_members')
    .select('role')
    .eq('project_id', project_id)
    .eq('user_id', user.id)
    .single()

  if (!callerRole || !['admin', 'owner'].includes(callerRole.role)) {
    context.res = { status: 403, body: JSON.stringify({ error: 'Admin requis' }) }
    return
  }

  // ── Action : ajouter un membre ───────────────────────────────
  if (action === 'add') {
    const { error } = await adminClient
      .from('project_members')
      .insert({ project_id, user_id: target_user_id, role: role ?? 'member' })

    context.res = error
      ? { status: 400, body: JSON.stringify({ error: error.message }) }
      : { status: 200, body: JSON.stringify({ success: true }) }
    return
  }

  // ── Action : retirer un membre ───────────────────────────────
  if (action === 'remove') {

    // Impossible de retirer le owner
    const { data: target } = await adminClient
      .from('project_members')
      .select('role')
      .eq('project_id', project_id)
      .eq('user_id', target_user_id)
      .single()

    if (target?.role === 'owner') {
      context.res = { status: 403, body: JSON.stringify({ error: 'Impossible de retirer le owner' }) }
      return
    }

    const { error } = await adminClient
      .from('project_members')
      .delete()
      .eq('project_id', project_id)
      .eq('user_id', target_user_id)

    context.res = error
      ? { status: 400, body: JSON.stringify({ error: error.message }) }
      : { status: 200, body: JSON.stringify({ success: true }) }
    return
  }

  context.res = { status: 400, body: JSON.stringify({ error: 'action invalide' }) }
}