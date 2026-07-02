import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
    .map(line => {
      const separator = line.indexOf('=')
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^"|"$/g, '')]
    }),
)

const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const openApiResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Accept: 'application/openapi+json',
  },
})
if (openApiResponse.ok) {
  const spec = await openApiResponse.json()
  const tables = Object.keys(spec.definitions || {}).filter(name => !name.startsWith('rpc/'))
  console.log(`exposed_tables=${tables.join(',')}`)
}

for (const table of ['profiles', 'attendance', 'justifications', 'notification_settings', 'report_deliveries']) {
  const result = await client.from(table).select('*', { count: 'exact', head: true })
  if (result.error) throw result.error
  console.log(`${table}=${result.count ?? 0}`)
}

const notificationSettings = await client
  .from('notification_settings')
  .select('enabled,send_time,timezone,weekdays_only,recipients')
  .eq('id', 1)
  .limit(1)
if (notificationSettings.error) throw notificationSettings.error
if (notificationSettings.data?.[0]) {
  const setting = notificationSettings.data[0]
  console.log(`notification_schedule=enabled:${setting.enabled},time:${setting.send_time},timezone:${setting.timezone},weekdays_only:${setting.weekdays_only},recipients:${setting.recipients?.length || 0}`)
}

const profiles = await client.from('profiles').select('id,email,full_name,department,role,status,created_at').limit(10)
if (profiles.error) throw profiles.error
console.log(JSON.stringify(profiles.data, null, 2))

const justifications = await client
  .from('justifications')
  .select('id,user_id,date,reason,description,document_url,status,reviewed_by,reviewer_comment,reviewed_at,created_at')
  .order('created_at', { ascending: false })
  .limit(10)
if (justifications.error) throw justifications.error
console.log('[justifications]')
console.log(JSON.stringify(justifications.data, null, 2))

const legacyJustifications = await client
  .from('justificaciones')
  .select('*')
  .limit(10)
if (legacyJustifications.error) throw legacyJustifications.error
console.log('[justificaciones]')
console.log(JSON.stringify(legacyJustifications.data, null, 2))
