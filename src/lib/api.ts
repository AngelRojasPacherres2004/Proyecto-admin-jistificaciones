import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('La sesión administrativa expiró')

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'No se pudo completar la operación')
  return body as T
}

export interface UserInput {
  email: string
  full_name: string
  department: string
  role: 'admin' | 'user'
  status?: 'active' | 'inactive'
  password?: string
}

export interface LegacyJustification {
  id: string
  dni: string
  nombre_completo: string
  fecha_inasistencia: string
  motivo: string
  descripcion?: string
  documento_nombre?: string
  documento_url?: string
  documento_tipo?: string
  created_at: string
  review_status?: 'pending' | 'approved' | 'rejected'
}

export const adminApi = {
  createUser: (data: UserInput) =>
    adminRequest<{ id: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Omit<UserInput, 'password'>) =>
    adminRequest<{ id: string }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    adminRequest<{ updated: boolean }>(`/api/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  listLegacyJustifications: () =>
    adminRequest<LegacyJustification[]>('/api/admin/legacy-justifications'),
  reviewLegacyJustification: (id: string, status: 'pending' | 'approved' | 'rejected') =>
    adminRequest<{ updated: boolean }>(`/api/admin/legacy-justifications/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  sendDailyReport: () =>
    adminRequest<{ sent: boolean, reason?: string, recipients?: number }>('/api/reports/daily/test', {
      method: 'POST',
    }),
}
