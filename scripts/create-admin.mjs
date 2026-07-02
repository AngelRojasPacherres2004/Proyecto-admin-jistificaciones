import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2] || 'admin@empresa.pe'
const env = Object.fromEntries(
  fs.readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
    .map(line => {
      const separator = line.indexOf('=')
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim().replace(/^"|"$/g, ''),
      ]
    }),
)

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env')
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listed.error) throw listed.error

let user = listed.data.users.find(item => item.email === email)
let temporaryPassword = ''
let created = false

if (!user) {
  temporaryPassword = `Adm!${crypto.randomBytes(18).toString('base64url')}`
  const result = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Admin Principal' },
  })
  if (result.error) throw result.error
  user = result.data.user
  created = true
}

const updated = await supabase
  .from('profiles')
  .update({
    role: 'admin',
    status: 'active',
    full_name: 'Admin Principal',
    email,
  })
  .eq('id', user.id)
  .select('role,status')
  .single()

if (updated.error) throw updated.error

console.log(`ADMIN_READY=true`)
console.log(`CREATED=${created}`)
console.log(`EMAIL=${email}`)
console.log(`TEMP_PASSWORD=${created ? temporaryPassword : '<sin cambios>'}`)
console.log(`ROLE=${updated.data.role}`)
console.log(`STATUS=${updated.data.status}`)
