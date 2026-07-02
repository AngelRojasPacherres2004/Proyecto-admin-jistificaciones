import type { Justification, UserRecord } from '../types'

export const weeklyData = [
  { day: 'Lun', justificaciones: 14, faltas: 22 },
  { day: 'Mar', justificaciones: 19, faltas: 27 },
  { day: 'Mié', justificaciones: 13, faltas: 18 },
  { day: 'Jue', justificaciones: 24, faltas: 31 },
  { day: 'Vie', justificaciones: 21, faltas: 25 },
  { day: 'Sáb', justificaciones: 7, faltas: 9 },
  { day: 'Dom', justificaciones: 4, faltas: 6 },
]

export const statusData = [
  { name: 'Aprobadas', value: 64, color: '#b8f13c' },
  { name: 'Pendientes', value: 23, color: '#f5b83d' },
  { name: 'Rechazadas', value: 13, color: '#f26060' },
]

export const users: UserRecord[] = [
  { id: 'USR-001', name: 'Camila Torres', email: 'camila.torres@empresa.pe', department: 'Operaciones', initials: 'CT', attendance: 96, absences: 2, pending: 1, status: 'Activo' },
  { id: 'USR-002', name: 'Diego Mendoza', email: 'diego.mendoza@empresa.pe', department: 'Logística', initials: 'DM', attendance: 89, absences: 6, pending: 2, status: 'Activo' },
  { id: 'USR-003', name: 'Valeria Ríos', email: 'valeria.rios@empresa.pe', department: 'Finanzas', initials: 'VR', attendance: 98, absences: 1, pending: 0, status: 'Activo' },
  { id: 'USR-004', name: 'Mateo Salazar', email: 'mateo.salazar@empresa.pe', department: 'Tecnología', initials: 'MS', attendance: 92, absences: 4, pending: 1, status: 'Activo' },
  { id: 'USR-005', name: 'Lucía Paredes', email: 'lucia.paredes@empresa.pe', department: 'Recursos Humanos', initials: 'LP', attendance: 94, absences: 3, pending: 0, status: 'Activo' },
  { id: 'USR-006', name: 'Sebastián Cruz', email: 'sebastian.cruz@empresa.pe', department: 'Comercial', initials: 'SC', attendance: 84, absences: 9, pending: 3, status: 'Activo' },
  { id: 'USR-007', name: 'Daniela Castro', email: 'daniela.castro@empresa.pe', department: 'Operaciones', initials: 'DC', attendance: 97, absences: 1, pending: 0, status: 'Activo' },
  { id: 'USR-008', name: 'Nicolás Vega', email: 'nicolas.vega@empresa.pe', department: 'Logística', initials: 'NV', attendance: 90, absences: 5, pending: 1, status: 'Inactivo' },
]

export const initialJustifications: Justification[] = [
  { id: 'JUS-1048', userId: 'USR-002', name: 'Diego Mendoza', initials: 'DM', department: 'Logística', date: '02 Jul, 2026', reason: 'Consulta médica', submitted: 'Hace 18 min', status: 'Pendiente', document: 'constancia-medica.pdf' },
  { id: 'JUS-1047', userId: 'USR-006', name: 'Sebastián Cruz', initials: 'SC', department: 'Comercial', date: '02 Jul, 2026', reason: 'Emergencia familiar', submitted: 'Hace 42 min', status: 'Pendiente', document: 'declaracion.pdf' },
  { id: 'JUS-1046', userId: 'USR-004', name: 'Mateo Salazar', initials: 'MS', department: 'Tecnología', date: '01 Jul, 2026', reason: 'Descanso médico', submitted: 'Ayer, 18:24', status: 'Pendiente', document: 'descanso-medico.pdf' },
  { id: 'JUS-1045', userId: 'USR-001', name: 'Camila Torres', initials: 'CT', department: 'Operaciones', date: '01 Jul, 2026', reason: 'Cita programada', submitted: 'Ayer, 16:10', status: 'Aprobada' },
  { id: 'JUS-1044', userId: 'USR-005', name: 'Lucía Paredes', initials: 'LP', department: 'Recursos Humanos', date: '30 Jun, 2026', reason: 'Asunto personal', submitted: '30 Jun, 14:05', status: 'Rechazada' },
  { id: 'JUS-1043', userId: 'USR-003', name: 'Valeria Ríos', initials: 'VR', department: 'Finanzas', date: '30 Jun, 2026', reason: 'Consulta médica', submitted: '30 Jun, 10:42', status: 'Aprobada' },
]

export const activity = [
  { text: 'Aprobaste la justificación JUS-1041', time: 'Hace 12 minutos', color: 'green' },
  { text: 'Se generó el reporte diario', time: 'Hoy, 08:00', color: 'blue' },
  { text: 'Nuevo usuario sincronizado: Daniela Castro', time: 'Ayer, 17:46', color: 'purple' },
  { text: 'Se actualizaron los destinatarios', time: 'Ayer, 12:15', color: 'orange' },
]
