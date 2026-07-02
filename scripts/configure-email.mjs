import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const recipient = process.argv[2]
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  throw new Error('Uso: node scripts/configure-email.mjs correo@dominio.com')
}

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

const current = await client
  .from('notification_settings')
  .select('*')
  .eq('id', 1)
  .limit(1)

if (current.error) throw current.error

const existing = current.data?.[0] || {}
const result = await client.from('notification_settings').upsert({
  id: 1,
  recipients: [recipient],
  enabled: true,
  send_time: existing.send_time || '18:00',
  timezone: 'America/Lima',
  weekdays_only: existing.weekdays_only ?? true,
  report_sections: existing.report_sections || {
    summary: true,
    justifications: true,
    pending: true,
    attendance: true,
    recurrent: false,
  },
})

if (result.error) throw result.error
console.log('EMAIL_SETTINGS_READY=true')
console.log('RECIPIENTS=1')
console.log(`SEND_TIME=${existing.send_time || '18:00'}`)
