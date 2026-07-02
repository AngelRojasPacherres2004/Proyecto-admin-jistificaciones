import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { adminApi } from '../lib/api'
import { initialJustifications, users as fallbackUsers } from '../data/mockData'
import type { Justification, UserRecord } from '../types'

export function useAdminData(demoMode = false) {
  const [users, setUsers] = useState<UserRecord[]>(demoMode || !supabase ? fallbackUsers : [])
  const [justifications, setJustifications] = useState<Justification[]>(demoMode || !supabase ? initialJustifications : [])
  const [loading, setLoading] = useState(Boolean(supabase) && !demoMode)
  const [usingDemoData, setUsingDemoData] = useState(demoMode || !supabase)

  const load = useCallback(async () => {
    if (demoMode || !supabase) {
      setUsers(fallbackUsers)
      setJustifications(initialJustifications)
      setUsingDemoData(true)
      setLoading(false)
      return
    }
    const client = supabase
    setLoading(true)
    const [profilesResult, justificationsResult, attendanceResult, legacyJustifications] = await Promise.all([
        client.from('profiles').select('id, full_name, email, department, status, role'),
        client.from('justifications').select('id, user_id, date, reason, status, document_url, created_at, profiles!justifications_user_id_fkey(full_name, department)'),
        client.from('attendance').select('user_id, status'),
        adminApi.listLegacyJustifications().catch(() => []),
    ])

    if (!profilesResult.error) {
      const attendance = attendanceResult.data || []
      const justifications = justificationsResult.data || []
      setUsers((profilesResult.data || []).map((profile: any) => {
          const name = profile.full_name || 'Sin nombre'
          const records = attendance.filter((row: any) => row.user_id === profile.id)
          const present = records.filter((row: any) => row.status === 'present' || row.status === 'late').length
          const absences = records.filter((row: any) => row.status === 'absent').length
          return {
            id: profile.id,
            name,
            email: profile.email || '',
            department: profile.department || 'Sin área',
            initials: name.split(' ').map((part: string) => part[0]).slice(0, 2).join('').toUpperCase(),
            attendance: records.length ? Math.round((present / records.length) * 100) : 0,
            absences,
            pending: justifications.filter((item: any) => item.user_id === profile.id && item.status === 'pending').length,
            status: profile.status === 'inactive' ? 'Inactivo' : 'Activo',
            role: profile.role === 'admin' ? 'admin' : 'user',
          }
        }))
      setUsingDemoData(false)
    }
    if (!justificationsResult.error) {
      const canonical: Justification[] = (justificationsResult.data || []).map((item: any) => ({
          id: item.id,
          userId: item.user_id,
          source: 'canonical',
          name: item.profiles?.full_name || 'Usuario',
          initials: (item.profiles?.full_name || 'US').split(' ').map((part: string) => part[0]).slice(0, 2).join(''),
          department: item.profiles?.department || 'Sin área',
          date: new Date(item.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
          reason: item.reason,
          submitted: new Date(item.created_at).toLocaleString('es-PE'),
          status: item.status === 'approved' ? 'Aprobada' : item.status === 'rejected' ? 'Rechazada' : 'Pendiente',
          document: item.document_url?.split('/').pop(),
          documentUrl: item.document_url,
        }))
      const legacy: Justification[] = legacyJustifications.map(item => ({
        id: item.id,
        userId: item.dni,
        source: 'legacy',
        name: item.nombre_completo,
        initials: item.nombre_completo.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase(),
        department: `DNI ${item.dni}`,
        date: new Date(`${item.fecha_inasistencia}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
        reason: item.motivo,
        description: item.descripcion,
        dni: item.dni,
        submitted: new Date(item.created_at).toLocaleString('es-PE'),
        status: item.review_status === 'approved' ? 'Aprobada' : item.review_status === 'rejected' ? 'Rechazada' : 'Pendiente',
        document: item.documento_nombre,
        documentUrl: item.documento_url,
      }))
      setJustifications([...canonical, ...legacy].sort((a, b) => b.submitted.localeCompare(a.submitted)))
      setUsingDemoData(false)
    }
    setLoading(false)
  }, [demoMode])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (id: string, status: Justification['status']) => {
    const target = justifications.find(item => item.id === id)
    if (target?.source === 'legacy' && !usingDemoData) {
      const apiStatus = status === 'Aprobada' ? 'approved' : status === 'Rechazada' ? 'rejected' : 'pending'
      await adminApi.reviewLegacyJustification(id, apiStatus)
    } else if (supabase && !usingDemoData) {
      const dbStatus = status === 'Aprobada' ? 'approved' : status === 'Rechazada' ? 'rejected' : 'pending'
      await supabase.from('justifications').update({ status: dbStatus, reviewed_at: new Date().toISOString() }).eq('id', id)
    }
    setJustifications(current => current.map(item => item.id === id ? { ...item, status } : item))
  }

  return { users, justifications, updateStatus, loading, usingDemoData, refresh: load }
}
