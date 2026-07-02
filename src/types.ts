export type JustificationStatus = 'Pendiente' | 'Aprobada' | 'Rechazada'

export interface UserRecord {
  id: string
  name: string
  email: string
  department: string
  initials: string
  attendance: number
  absences: number
  pending: number
  status: 'Activo' | 'Inactivo'
  role?: 'admin' | 'user'
}

export interface Justification {
  id: string
  userId: string
  source?: 'canonical' | 'legacy'
  name: string
  initials: string
  department: string
  date: string
  reason: string
  submitted: string
  status: JustificationStatus
  document?: string
  documentUrl?: string
  description?: string
  dni?: string
}
