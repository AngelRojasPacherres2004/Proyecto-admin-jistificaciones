import { FormEvent, ReactNode, useEffect, useState } from 'react'
import {
  Activity, Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Download, Eye, FileBarChart, FileCheck2, FileText, Filter,
  LayoutDashboard, LockKeyhole, LogOut, Mail, Menu, MoreHorizontal, Paperclip,
  Plus, RefreshCw, Search, Send, Settings, ShieldCheck, Sparkles, TrendingDown,
  TrendingUp, UserRound, Users, X, XCircle, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { useAdminData } from './hooks/useAdminData'
import { supabase } from './lib/supabase'
import { adminApi, type UserInput } from './lib/api'
import { activity, statusData, weeklyData } from './data/mockData'
import type { Justification, JustificationStatus, UserRecord } from './types'

type Page = 'dashboard' | 'justifications' | 'users' | 'reports' | 'notifications' | 'settings'

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase))
  const [demoSession, setDemoSession] = useState(false)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setCheckingSession(false)
      return
    }
    client.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: profile } = await client.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle()
        setAuthenticated(profile?.role === 'admin')
      }
      setCheckingSession(false)
    })
  }, [])

  if (checkingSession) return <Splash />
  if (!authenticated) {
    return <Login onAuthenticated={(demo = false) => {
      setDemoSession(demo)
      setAuthenticated(true)
    }} />
  }

  return <AdminApp demoSession={demoSession} onLogout={async () => {
    if (!demoSession && supabase) await supabase.auth.signOut()
    setAuthenticated(false)
    setDemoSession(false)
  }} />
}

function Splash() {
  return <div className="splash"><Brand /><div className="loader" /></div>
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <div className="brand-mark"><Check size={18} strokeWidth={3} /></div>
    {!compact && <div><strong>justifica</strong><span>ADMIN</span></div>}
  </div>
}

function Login({ onAuthenticated }: { onAuthenticated: (demo?: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!supabase) {
      setError('Supabase no está configurado. Usa la vista de demostración.')
      return
    }
    setLoading(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) {
      setError('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('Acceso denegado. Esta plataforma es exclusiva para administradores.')
      setLoading(false)
      return
    }
    onAuthenticated()
  }

  return <main className="login-page">
    <div className="login-glow glow-one" />
    <div className="login-glow glow-two" />
    <section className="login-panel">
      <Brand />
      <div className="login-copy">
        <span className="eyebrow"><ShieldCheck size={14} /> Portal seguro</span>
        <h1>Todo bajo control,<br /><em>en un solo lugar.</em></h1>
        <p>Supervisa asistencias, resuelve justificaciones y mantén a tu equipo informado.</p>
      </div>
      <div className="login-stat-row">
        <div><strong>99.8%</strong><span>Disponibilidad</span></div>
        <div><strong>24/7</strong><span>Monitoreo</span></div>
        <div><strong>100%</strong><span>Seguro</span></div>
      </div>
      <p className="login-footer">© 2026 Justifica · Gestión inteligente de asistencia</p>
    </section>
    <section className="login-form-wrap">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-card-icon"><LockKeyhole size={22} /></div>
        <div>
          <p className="kicker">Bienvenido de vuelta</p>
          <h2>Acceso administrativo</h2>
          <p className="muted">Ingresa tus credenciales para continuar.</p>
        </div>
        <label>Correo corporativo
          <div className="input-with-icon"><Mail size={17} /><input type="email" placeholder="admin@empresa.pe" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        </label>
        <label>Contraseña
          <div className="input-with-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)}><Eye size={17} /></button></div>
        </label>
        <div className="login-options"><label className="check-label"><input type="checkbox" /> Recordarme</label><button type="button" className="text-button">¿Olvidaste tu contraseña?</button></div>
        {error && <div className="error-message"><CircleHelp size={16} />{error}</div>}
        <button className="primary-button login-button" disabled={loading}>{loading ? <RefreshCw className="spin" size={18} /> : <>Ingresar al panel <ChevronRight size={18} /></>}</button>
        {import.meta.env.DEV && <><div className="divider"><span>Entorno de desarrollo</span></div><button type="button" className="demo-button" onClick={() => onAuthenticated(true)}><Sparkles size={16} /> Explorar panel con datos demo</button></>}
        <p className="secure-note"><ShieldCheck size={13} /> Conexión cifrada y protegida</p>
      </form>
    </section>
  </main>
}

function AdminApp({ onLogout, demoSession }: { onLogout: () => void, demoSession: boolean }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState('')
  const { users, justifications, updateStatus, usingDemoData, refresh } = useAdminData(demoSession)

  const navigate = (target: Page) => {
    setPage(target)
    setSidebarOpen(false)
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const titles: Record<Page, [string, string]> = {
    dashboard: ['Resumen general', 'Lo que está pasando en tu organización hoy.'],
    justifications: ['Justificaciones', 'Revisa, aprueba y organiza todas las solicitudes.'],
    users: ['Usuarios', 'Gestiona personas y consulta su historial de asistencia.'],
    reports: ['Reportes', 'Analiza tendencias y exporta información consolidada.'],
    notifications: ['Notificaciones', 'Configura alertas y reportes automáticos.'],
    settings: ['Configuración', 'Ajusta las preferencias del panel administrativo.'],
  }

  return <div className="admin-shell">
    <Sidebar page={page} navigate={navigate} open={sidebarOpen} onLogout={onLogout} />
    <main className="main-content">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button>
        <div className="page-title"><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div>
        <div className="topbar-actions">
          {(usingDemoData || demoSession) && <span className="demo-pill"><span /> Datos de muestra</span>}
          <button className="top-icon" onClick={() => navigate('notifications')}><Bell size={19} /><b>3</b></button>
          <div className="avatar">AR</div>
          <div className="admin-meta"><strong>Admin Principal</strong><span>Administrador</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
      </header>
      <div className="page-body">
        {page === 'dashboard' && <Dashboard users={users} justifications={justifications} navigate={navigate} usingDemoData={usingDemoData} />}
        {page === 'justifications' && <JustificationsPage justifications={justifications} updateStatus={updateStatus} notify={notify} />}
        {page === 'users' && <UsersPage users={users} justifications={justifications} refresh={refresh} notify={notify} demoMode={demoSession} />}
        {page === 'reports' && <ReportsPage notify={notify} users={users} justifications={justifications} usingDemoData={usingDemoData} />}
        {page === 'notifications' && <NotificationsPage notify={notify} demoMode={demoSession} />}
        {page === 'settings' && <SettingsPage notify={notify} />}
      </div>
    </main>
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
    {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
  </div>
}

const navItems: { id: Page, icon: typeof LayoutDashboard, label: string, badge?: number }[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { id: 'justifications', icon: FileCheck2, label: 'Justificaciones', badge: 3 },
  { id: 'users', icon: Users, label: 'Usuarios' },
  { id: 'reports', icon: FileBarChart, label: 'Reportes' },
  { id: 'notifications', icon: Bell, label: 'Notificaciones' },
]

function Sidebar({ page, navigate, open, onLogout }: { page: Page, navigate: (p: Page) => void, open: boolean, onLogout: () => void }) {
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <Brand />
    <div className="sidebar-section">
      <span className="sidebar-label">GESTIÓN</span>
      <nav>{navItems.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>)}</nav>
    </div>
    <div className="sidebar-section secondary">
      <span className="sidebar-label">SISTEMA</span>
      <nav><button className={page === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings size={19} /><span>Configuración</span></button><button><CircleHelp size={19} /><span>Centro de ayuda</span></button></nav>
    </div>
    <div className="sidebar-spacer" />
    <div className="sidebar-health"><span><Zap size={15} /> Sistema operativo</span><small>Última sync: ahora</small></div>
    <button className="logout-button" onClick={onLogout}><LogOut size={18} />Cerrar sesión</button>
  </aside>
}

function Dashboard({ users, justifications, navigate, usingDemoData }: { users: UserRecord[], justifications: Justification[], navigate: (p: Page) => void, usingDemoData: boolean }) {
  const pending = justifications.filter(item => item.status === 'Pendiente')
  const approved = justifications.filter(item => item.status === 'Aprobada').length
  const rejected = justifications.filter(item => item.status === 'Rechazada').length
  const total = justifications.length
  const liveStatusData = usingDemoData ? statusData : [
    { name: 'Aprobadas', value: approved, color: '#b8f13c' },
    { name: 'Pendientes', value: pending.length, color: '#f5b83d' },
    { name: 'Rechazadas', value: rejected, color: '#f26060' },
  ]
  const liveWeeklyData = usingDemoData ? weeklyData : weeklyData.map(item => ({ ...item, justificaciones: 0, faltas: 0 }))
  const activeUsers = users.filter(user => user.status === 'Activo').length
  const averageAttendance = users.length ? (users.reduce((sum, user) => sum + user.attendance, 0) / users.length).toFixed(1) : '0.0'
  return <>
    <div className="summary-strip">
      <div className="date-chip"><CalendarDays size={18} /><span><small>HOY</small>Jueves, 02 de julio</span></div>
      <div className="summary-message"><span className="pulse-dot" /><p><strong>Buen día, Admin.</strong> Tienes {pending.length} justificaciones esperando tu revisión.</p></div>
      <button className="text-link" onClick={() => navigate('justifications')}>Revisar ahora <ChevronRight size={16} /></button>
    </div>
    <section className="metric-grid">
      <MetricCard icon={Users} label="Usuarios activos" value={String(activeUsers)} trend={usingDemoData ? '+12' : 'Real'} caption={usingDemoData ? 'este mes' : 'en Supabase'} tone="lime" />
      <MetricCard icon={FileCheck2} label="Justificaciones" value={String(total)} trend={usingDemoData ? '+8.4%' : 'Real'} caption={usingDemoData ? 'vs. semana anterior' : 'registros totales'} tone="violet" />
      <MetricCard icon={Clock3} label="Pendientes" value={String(pending.length)} trend={usingDemoData ? '-14%' : 'Real'} caption={usingDemoData ? 'vs. ayer' : 'por revisar'} tone="orange" down />
      <MetricCard icon={Activity} label="Asistencia" value={`${averageAttendance}%`} trend={usingDemoData ? '+2.1%' : 'Real'} caption={usingDemoData ? 'sobre el promedio' : 'promedio registrado'} tone="blue" />
    </section>
    <section className="dashboard-grid">
      <div className="panel chart-panel">
        <PanelHeader title="Actividad semanal" subtitle="Faltas y justificaciones registradas" action={<button className="select-button">Últimos 7 días <ChevronDown size={14} /></button>} />
        <div className="chart-legend"><span><i className="green-dot" /> Justificaciones</span><span><i className="gray-dot" /> Faltas</span></div>
        <ResponsiveContainer width="100%" height={270}>
          <AreaChart data={liveWeeklyData} margin={{ top: 15, right: 12, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="limeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#b8f13c" stopOpacity={0.25}/><stop offset="95%" stopColor="#b8f13c" stopOpacity={0}/></linearGradient>
              <linearGradient id="grayFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6d7180" stopOpacity={0.16}/><stop offset="95%" stopColor="#6d7180" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#242424" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#777', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} />
            <Area type="monotone" dataKey="faltas" stroke="#696d78" strokeWidth={2} fill="url(#grayFill)" />
            <Area type="monotone" dataKey="justificaciones" stroke="#b8f13c" strokeWidth={2.5} fill="url(#limeFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="panel distribution-panel">
        <PanelHeader title="Estado de solicitudes" subtitle="Distribución del mes" />
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart><Pie data={liveStatusData} dataKey="value" innerRadius={61} outerRadius={82} paddingAngle={4} stroke="none">{liveStatusData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 10 }} /></PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><strong>{total}</strong><span>TOTAL</span></div>
        </div>
        <div className="status-list">{liveStatusData.map(item => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{total ? Math.round(item.value / total * 100) : 0}%</strong></div>)}</div>
      </div>
    </section>
    <section className="dashboard-grid lower-grid">
      <div className="panel">
        <PanelHeader title="Requieren tu atención" subtitle={`${pending.length} solicitudes pendientes`} action={<button className="text-link" onClick={() => navigate('justifications')}>Ver todas <ChevronRight size={15}/></button>} />
        <div className="attention-list">{pending.slice(0, 3).map(item => <div className="attention-row" key={item.id}><Avatar initials={item.initials}/><div className="attention-person"><strong>{item.name}</strong><span>{item.reason} · {item.department}</span></div><span className="date-text">{item.date}</span><StatusBadge status={item.status} /><button className="icon-button"><MoreHorizontal size={19}/></button></div>)}</div>
      </div>
      <div className="panel">
        <PanelHeader title="Actividad reciente" subtitle="Últimos movimientos" />
        <div className="activity-list">{activity.slice(0, 4).map((item, index) => <div key={index}><i className={item.color} /><span><strong>{item.text}</strong><small>{item.time}</small></span></div>)}</div>
      </div>
    </section>
  </>
}

function MetricCard({ icon: Icon, label, value, trend, caption, tone, down }: { icon: typeof Users, label: string, value: string, trend: string, caption: string, tone: string, down?: boolean }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-label">{label}<CircleHelp size={13}/></div><strong className="metric-value">{value}</strong><div className={`metric-trend ${down ? 'down' : ''}`}>{down ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}<b>{trend}</b><span>{caption}</span></div></div>
}

function PanelHeader({ title, subtitle, action }: { title: string, subtitle?: string, action?: ReactNode }) {
  return <div className="panel-header"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function JustificationsPage({ justifications, updateStatus, notify }: { justifications: Justification[], updateStatus: (id: string, s: JustificationStatus) => Promise<void>, notify: (m: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Todas' | JustificationStatus>('Todas')
  const [selected, setSelected] = useState<Justification | null>(null)
  const filtered = justifications.filter(item => (filter === 'Todas' || item.status === filter) && `${item.name} ${item.id} ${item.reason}`.toLowerCase().includes(query.toLowerCase()))
  const handleStatus = async (id: string, status: JustificationStatus) => {
    try {
      await updateStatus(id, status)
      setSelected(current => current ? { ...current, status } : null)
      notify(status === 'Aprobada' ? 'Justificación aprobada correctamente' : 'Justificación rechazada')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo actualizar la justificación')
    }
  }

  return <>
    <div className="toolbar">
      <div className="search-box"><Search size={17}/><input placeholder="Buscar por usuario, código o motivo..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div>
      <div className="filter-tabs">{(['Todas', 'Pendiente', 'Aprobada', 'Rechazada'] as const).map(status => <button className={filter === status ? 'active' : ''} onClick={() => setFilter(status)} key={status}>{status}{status === 'Pendiente' && <b>{justifications.filter(j => j.status === 'Pendiente').length}</b>}</button>)}</div>
      <button className="secondary-button"><Filter size={16}/> Filtros</button>
    </div>
    <div className="panel table-panel">
      <div className="table-summary"><span>Mostrando <strong>{filtered.length}</strong> solicitudes</span><button className="secondary-button"><Download size={16}/> Exportar</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Solicitud</th><th>Usuario</th><th>Fecha de falta</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><span className="code">{item.id}</span><small>{item.submitted}</small></td><td><div className="person-cell"><Avatar initials={item.initials}/><span><strong>{item.name}</strong><small>{item.department}</small></span></div></td><td>{item.date}</td><td>{item.reason}{item.document && <small className="attachment"><Paperclip size={12}/>{item.document}</small>}</td><td><StatusBadge status={item.status}/></td><td><button className="row-action" onClick={() => setSelected(item)}>Revisar <ChevronRight size={15}/></button></td></tr>)}</tbody></table></div>
    </div>
    {selected && <DetailDrawer title="Detalle de justificación" onClose={() => setSelected(null)}>
      <div className="drawer-profile"><Avatar initials={selected.initials} large/><div><h3>{selected.name}</h3><p>{selected.department} · {selected.userId}</p></div></div>
      <div className="detail-grid"><Detail label={selected.source === 'legacy' ? 'DNI' : 'Código'} value={selected.dni || selected.id}/><Detail label="Fecha de falta" value={selected.date}/><Detail label="Motivo" value={selected.reason}/><Detail label="Enviada" value={selected.submitted}/></div>
      {selected.description && <div className="description-card"><span>DESCRIPCIÓN DEL SOLICITANTE</span><p>{selected.description}</p></div>}
      <div className="document-card"><FileText size={20}/><div><strong>{selected.document || 'Sin documento adjunto'}</strong><span>Documento de sustento</span></div>{selected.documentUrl && <a className="icon-button" href={selected.documentUrl} target="_blank" rel="noreferrer" aria-label="Abrir documento"><Eye size={17}/></a>}</div>
      <label className="notes-label">Comentario administrativo<textarea placeholder="Añade una observación para el usuario..." /></label>
      {selected.status === 'Pendiente' ? <div className="drawer-actions"><button className="reject-button" onClick={() => handleStatus(selected.id, 'Rechazada')}><XCircle size={17}/> Rechazar</button><button className="approve-button" onClick={() => handleStatus(selected.id, 'Aprobada')}><CheckCircle2 size={17}/> Aprobar</button></div> : <div className="resolved-state"><CheckCircle2 size={18}/> Esta solicitud ya fue {selected.status.toLowerCase()}.</div>}
    </DetailDrawer>}
  </>
}

function UsersPage({ users, justifications, refresh, notify, demoMode }: { users: UserRecord[], justifications: Justification[], refresh: () => Promise<void>, notify: (message: string) => void, demoMode: boolean }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState<UserInput & { status: 'active' | 'inactive' }>({
    email: '', full_name: '', department: '', role: 'user', status: 'active', password: '',
  })
  const filtered = users.filter(user => `${user.name} ${user.email} ${user.department}`.toLowerCase().includes(query.toLowerCase()))
  const averageAttendance = users.length ? (users.reduce((sum, user) => sum + user.attendance, 0) / users.length).toFixed(1) : '0.0'
  const openCreate = () => {
    setEditing(null)
    setForm({ email: '', full_name: '', department: '', role: 'user', status: 'active', password: '' })
    setFormError('')
    setShowForm(true)
  }
  const openEdit = (user: UserRecord) => {
    setEditing(user)
    setForm({
      email: user.email,
      full_name: user.name,
      department: user.department === 'Sin área' ? '' : user.department,
      role: user.role || 'user',
      status: user.status === 'Activo' ? 'active' : 'inactive',
      password: '',
    })
    setSelected(null)
    setFormError('')
    setShowForm(true)
  }
  const saveUser = async (event: FormEvent) => {
    event.preventDefault()
    if (demoMode) {
      setFormError('La gestión de usuarios requiere iniciar sesión como administrador real.')
      return
    }
    if (!editing && (!form.password || form.password.length < 10)) {
      setFormError('La contraseña temporal debe tener al menos 10 caracteres.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await adminApi.updateUser(editing.id, {
          email: form.email,
          full_name: form.full_name,
          department: form.department,
          role: form.role,
          status: form.status,
        })
        if (form.password) await adminApi.resetPassword(editing.id, form.password)
        notify('Usuario actualizado correctamente')
      } else {
        await adminApi.createUser(form)
        notify('Usuario creado correctamente')
      }
      await refresh()
      setShowForm(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el usuario')
    } finally {
      setSaving(false)
    }
  }
  return <>
    <section className="mini-metrics"><div><Users/><span><small>Total usuarios</small><strong>{users.length}</strong></span></div><div><CheckCircle2/><span><small>Usuarios activos</small><strong>{users.filter(u => u.status === 'Activo').length}</strong></span></div><div><TrendingUp/><span><small>Asistencia promedio</small><strong>{averageAttendance}%</strong></span></div><div><Activity/><span><small>En observación</small><strong>{users.filter(user => user.absences >= 3).length}</strong></span></div></section>
    <div className="toolbar users-toolbar"><div className="search-box"><Search size={17}/><input placeholder="Buscar usuarios..." value={query} onChange={e => setQuery(e.target.value)}/></div><button className="secondary-button"><Filter size={16}/> Área: Todas</button><button className="primary-button" onClick={openCreate}><Plus size={16}/> Nuevo usuario</button></div>
    <div className="panel table-panel"><div className="data-table-wrap"><table className="data-table users-table"><thead><tr><th>Usuario</th><th>Área</th><th>Rol</th><th>Asistencia</th><th>Faltas</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(user => <tr key={user.id}><td><div className="person-cell"><Avatar initials={user.initials}/><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td>{user.department}</td><td><span className={`role-badge ${user.role}`}>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</span></td><td><div className="attendance-cell"><span>{user.attendance}%</span><div><i style={{width: `${user.attendance}%`}}/></div></div></td><td>{user.absences}</td><td><span className={`user-status ${user.status.toLowerCase()}`}><i/>{user.status}</span></td><td><button className="row-action" onClick={() => setSelected(user)}>Ver perfil <ChevronRight size={15}/></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="table-empty"><Users size={25}/><strong>No hay usuarios</strong><span>Crea el primer usuario o cambia tu búsqueda.</span></div>}</div></div>
    {selected && <DetailDrawer title="Perfil del usuario" onClose={() => setSelected(null)}>
      <div className="drawer-profile user-drawer"><Avatar initials={selected.initials} large/><div><h3>{selected.name}</h3><p>{selected.email}</p><span className="user-status activo"><i/>Activo</span></div></div>
      <div className="detail-grid"><Detail label="Código" value={selected.id}/><Detail label="Área" value={selected.department}/><Detail label="Asistencia" value={`${selected.attendance}%`}/><Detail label="Faltas acumuladas" value={String(selected.absences)}/></div>
      <button className="primary-button full-button" onClick={() => openEdit(selected)}><Settings size={16}/> Editar usuario</button>
      <h4 className="section-heading">Historial de justificaciones</h4>
      <div className="history-list">{justifications.filter(j => j.userId === selected.id).map(item => <div key={item.id}><div className="history-icon"><FileCheck2 size={17}/></div><span><strong>{item.reason}</strong><small>{item.date} · {item.id}</small></span><StatusBadge status={item.status}/></div>)}{!justifications.some(j => j.userId === selected.id) && <p className="empty-text">Este usuario todavía no tiene justificaciones.</p>}</div>
      <button className="secondary-button full-button"><Download size={16}/> Descargar historial completo</button>
    </DetailDrawer>}
    {showForm && <DetailDrawer title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowForm(false)}>
      <form className="user-form" onSubmit={saveUser}>
        <div className="form-intro"><div className="feature-icon"><UserRound size={20}/></div><div><h3>{editing ? 'Información de la cuenta' : 'Crear acceso al sistema'}</h3><p>La contraseña se almacena protegida por Supabase Auth y nunca se guarda como texto visible.</p></div></div>
        <label>Nombre completo<input required minLength={2} value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Ej. María Fernández"/></label>
        <label>Correo electrónico<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="usuario@empresa.pe"/></label>
        <label>Área o departamento<input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Ej. Recursos Humanos"/></label>
        <div className="inline-fields">
          <label>Rol<select value={form.role} onChange={e => setForm({...form, role: e.target.value as 'admin' | 'user'})}><option value="user">Usuario</option><option value="admin">Administrador</option></select></label>
          <label>Estado<select value={form.status} onChange={e => setForm({...form, status: e.target.value as 'active' | 'inactive'})}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
        </div>
        <label>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña temporal'}<input required={!editing} minLength={10} type="password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} placeholder={editing ? 'Déjala vacía para conservarla' : 'Mínimo 10 caracteres'}/><small>{editing ? 'Solo se cambiará si escribes una nueva.' : 'Pide al usuario cambiarla después del primer acceso.'}</small></label>
        {formError && <div className="error-message"><CircleHelp size={16}/>{formError}</div>}
        <div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <RefreshCw className="spin" size={16}/> : <Check size={16}/>} {editing ? 'Guardar cambios' : 'Crear usuario'}</button></div>
      </form>
    </DetailDrawer>}
  </>
}

function ReportsPage({ notify, users, justifications, usingDemoData }: { notify: (m: string) => void, users: UserRecord[], justifications: Justification[], usingDemoData: boolean }) {
  const [period, setPeriod] = useState('Este mes')
  const totalAbsences = users.reduce((sum, user) => sum + user.absences, 0)
  const approved = justifications.filter(item => item.status === 'Aprobada').length
  const approvalRate = justifications.length ? Math.round(approved / justifications.length * 100) : 0
  const reportChartData = usingDemoData ? weeklyData : weeklyData.map(item => ({ ...item, justificaciones: 0, faltas: 0 }))
  const areaRanking = Object.entries(users.reduce<Record<string, number>>((acc, user) => {
    acc[user.department] = (acc[user.department] || 0) + user.absences
    return acc
  }, {})).sort((a, b) => b[1] - a[1])
  const exportReport = () => {
    const rows = [['Usuario','Correo','Área','Asistencia','Faltas'], ...users.map(user => [user.name,user.email,user.department,`${user.attendance}%`,user.absences])]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'reporte-justificaciones.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    notify('Reporte CSV descargado')
  }
  return <>
    <div className="report-hero"><div><span className="eyebrow"><FileBarChart size={14}/> CENTRO DE REPORTES</span><h2>Convierte datos en<br/><em>decisiones claras.</em></h2><p>Consulta indicadores, detecta patrones y comparte resultados con tu equipo.</p></div><div className="report-actions"><select value={period} onChange={e => setPeriod(e.target.value)}><option>Este mes</option><option>Últimos 30 días</option><option>Este trimestre</option></select><button className="primary-button" onClick={exportReport}><Download size={17}/> Exportar CSV</button></div></div>
    <section className="metric-grid report-metrics"><MetricCard icon={FileCheck2} label="Justificaciones" value={String(justifications.length)} trend={usingDemoData ? '+12.3%' : 'Real'} caption={usingDemoData ? 'vs. periodo anterior' : 'registros en Supabase'} tone="lime"/><MetricCard icon={Activity} label="Faltas registradas" value={String(totalAbsences)} trend={usingDemoData ? '-5.8%' : 'Real'} caption={usingDemoData ? 'vs. periodo anterior' : 'registros en Supabase'} tone="orange" down/><MetricCard icon={CheckCircle2} label="Tasa de aprobación" value={`${approvalRate}%`} trend={usingDemoData ? '+3.1%' : 'Real'} caption={usingDemoData ? 'mejora mensual' : 'sobre solicitudes'} tone="violet"/><MetricCard icon={Users} label="Usuarios activos" value={String(users.filter(user => user.status === 'Activo').length)} trend={usingDemoData ? '+4' : 'Real'} caption="cuentas habilitadas" tone="blue"/></section>
    <section className="dashboard-grid">
      <div className="panel chart-panel"><PanelHeader title="Evolución del periodo" subtitle={`${period} · Comparativa diaria`}/><ResponsiveContainer width="100%" height={300}><AreaChart data={reportChartData} margin={{top:20,right:15,left:-20,bottom:0}}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#242424"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#777'}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#666'}}/><Tooltip contentStyle={{background:'#171717',border:'1px solid #333',borderRadius:10}}/><Area type="monotone" dataKey="faltas" stroke="#6d7180" fill="#6d718022" strokeWidth={2}/><Area type="monotone" dataKey="justificaciones" stroke="#b8f13c" fill="#b8f13c22" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
      <div className="panel"><PanelHeader title="Áreas con más incidencias" subtitle="Ranking del periodo"/><div className="ranking-list">{areaRanking.map(([name,value], i)=><div key={name}><span><b>{i+1}</b>{name}</span><strong>{value}</strong><div><i style={{width:`${areaRanking[0]?.[1] ? value / areaRanking[0][1] * 100 : 0}%`}}/></div></div>)}{areaRanking.length === 0 && <p className="empty-text">No hay datos de incidencias todavía.</p>}</div></div>
    </section>
  </>
}

function NotificationsPage({ notify, demoMode }: { notify: (m: string) => void, demoMode: boolean }) {
  const [emails, setEmails] = useState<string[]>(demoMode ? ['rrhh@empresa.pe', 'gerencia@empresa.pe'] : [])
  const [newEmail, setNewEmail] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [time, setTime] = useState('18:00')
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(!demoMode)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    const client = supabase
    if (demoMode || !client) {
      setLoadingSettings(false)
      return
    }
    const loadSettings = async () => {
      setLoadingSettings(true)
      const { data, error } = await client
        .from('notification_settings')
        .select('recipients,enabled,send_time,timezone,weekdays_only')
        .eq('id', 1)
        .maybeSingle()
      if (error) {
        setSettingsError('No se pudo cargar la configuración guardada.')
      } else if (data) {
        setEmails(Array.isArray(data.recipients) ? data.recipients : [])
        setEnabled(data.enabled)
        setTime(String(data.send_time || '18:00').slice(0, 5))
        setWeekdaysOnly(data.weekdays_only ?? true)
        setSettingsError('')
      }
      setLoadingSettings(false)
    }
    loadSettings()
  }, [demoMode])
  const addEmail = () => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail]); setNewEmail('')
    }
  }
  const save = async () => {
    if (demoMode) {
      notify('Configuración demo actualizada localmente')
      return
    }
    if (!supabase) {
      setSettingsError('Supabase no está configurado.')
      return
    }
    if (!emails.length) {
      setSettingsError('Añade al menos un destinatario antes de guardar.')
      return
    }
    setSavingSettings(true)
    setSettingsError('')
    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.from('notification_settings').upsert({
      id: 1,
      recipients: emails,
      enabled,
      send_time: time,
      timezone: 'America/Lima',
      weekdays_only: weekdaysOnly,
      updated_by: sessionData.session?.user.id,
      updated_at: new Date().toISOString(),
    })
    setSavingSettings(false)
    if (error) {
      setSettingsError('No se pudieron guardar los destinatarios.')
      return
    }
    notify(`Configuración guardada para ${emails.length} destinatario${emails.length === 1 ? '' : 's'}`)
  }
  const sendTest = async () => {
    setSendingTest(true)
    try {
      const result = await adminApi.sendDailyReport()
      notify(result.sent ? `Reporte enviado a ${result.recipients || emails.length} destinatarios` : 'No se envió: revisa destinatarios y configuración')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo enviar el reporte')
    } finally {
      setSendingTest(false)
    }
  }
  return <div className="settings-layout">
    <div className="settings-main">
      <div className="panel notification-card">
        <div className="notification-heading"><div className="feature-icon"><Send size={21}/></div><div><h3>Reporte diario automático</h3><p>Envía un resumen de las justificaciones y faltas registradas durante el día.</p></div><label className="switch"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/><span/></label></div>
        <div className="form-section">
          <div className="saved-recipients-heading"><div><label>Destinatarios guardados</label><p>El reporte llegará a todos los correos de esta lista.</p></div><span className="saved-count"><CheckCircle2 size={13}/>{loadingSettings ? 'Cargando…' : `${emails.length} guardado${emails.length === 1 ? '' : 's'}`}</span></div>
          <div className="email-chips">{loadingSettings ? <div className="settings-loading"><RefreshCw className="spin" size={16}/> Consultando Supabase…</div> : emails.map(email => <span key={email}><Mail size={13}/>{email}<button onClick={() => setEmails(emails.filter(e => e !== email))} aria-label={`Eliminar ${email}`}><X size={13}/></button></span>)}{!loadingSettings && emails.length === 0 && <div className="no-recipients"><Mail size={17}/><span>No hay correos guardados todavía.</span></div>}</div>
          <div className="add-email"><div className="input-with-icon"><Mail size={17}/><input type="email" placeholder="nuevo@empresa.pe" value={newEmail} onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()}/></div><button className="secondary-button" onClick={addEmail}><Plus size={16}/> Añadir correo</button></div>
          {settingsError && <div className="error-message notification-error"><CircleHelp size={15}/>{settingsError}</div>}
        </div>
        <div className="form-grid">
          <label>Hora de envío<input type="time" value={time} onChange={e => setTime(e.target.value)}/><small>Zona horaria: Lima (GMT-5)</small></label>
          <label>Frecuencia<select value={weekdaysOnly ? 'weekdays' : 'daily'} onChange={e => setWeekdaysOnly(e.target.value === 'weekdays')}><option value="weekdays">Todos los días laborables</option><option value="daily">Todos los días</option></select><small>El reporte se prepara al cierre.</small></label>
        </div>
        <div className="report-content">
          <label>Contenido del reporte</label>
          {['Resumen ejecutivo del día','Lista de justificaciones recibidas','Solicitudes pendientes de revisión','Comparativa de asistencia','Usuarios con incidencias recurrentes'].map((item, i) => <label className="check-row" key={item}><input type="checkbox" defaultChecked={i < 4}/><span><Check size={12}/></span>{item}</label>)}
        </div>
        <div className="card-footer"><div className="sync-note"><ShieldCheck size={13}/> Configuración sincronizada con Supabase</div><button className="secondary-button" onClick={sendTest} disabled={sendingTest || loadingSettings || !emails.length}>{sendingTest ? <RefreshCw className="spin" size={16}/> : <Send size={16}/>} Enviar prueba</button><button className="primary-button" onClick={save} disabled={savingSettings || loadingSettings}>{savingSettings ? <RefreshCw className="spin" size={16}/> : <Check size={16}/>} Guardar cambios</button></div>
      </div>
    </div>
    <aside className="settings-aside">
      <div className="panel report-preview"><span className="eyebrow">VISTA PREVIA</span><div className="preview-mail"><Brand/><p className="preview-date">REPORTE DIARIO · 02 JUL 2026</p><h3>Resumen de asistencia</h3><p>Hola, este es el consolidado de actividad del día.</p><div className="preview-stats"><div><strong>23</strong><span>FALTAS</span></div><div><strong>14</strong><span>JUSTIFICADAS</span></div><div><strong>3</strong><span>PENDIENTES</span></div></div><div className="preview-bar"><i/><span>94.6% de asistencia</span></div></div></div>
      <div className="panel next-send"><Clock3 size={18}/><div><span>PRÓXIMO ENVÍO</span><strong>{weekdaysOnly ? 'Próximo día laborable' : 'Hoy'} a las {time}</strong><small>A {emails.length} destinatario{emails.length === 1 ? '' : 's'} guardado{emails.length === 1 ? '' : 's'}</small></div></div>
    </aside>
  </div>
}

function SettingsPage({ notify }: { notify: (m: string) => void }) {
  return <div className="settings-layout"><div className="panel settings-main-card"><PanelHeader title="Preferencias generales" subtitle="Personaliza el comportamiento del panel"/><div className="form-grid"><label>Nombre de la organización<input defaultValue="Mi Empresa S.A.C."/></label><label>Zona horaria<select defaultValue="America/Lima"><option value="America/Lima">Lima (GMT-5)</option></select></label></div><div className="settings-rows"><SettingRow icon={Bell} title="Alertas en tiempo real" text="Notificar cuando se registre una nueva justificación"/><SettingRow icon={ShieldCheck} title="Confirmación para acciones críticas" text="Solicitar confirmación antes de rechazar solicitudes"/><SettingRow icon={Activity} title="Registro de auditoría" text="Guardar todas las acciones administrativas"/></div><div className="card-footer"><button className="primary-button" onClick={() => notify('Preferencias actualizadas')}><Check size={16}/> Guardar cambios</button></div></div><aside className="settings-aside"><div className="panel security-card"><div className="feature-icon"><ShieldCheck/></div><h3>Seguridad de acceso</h3><p>El panel usa autenticación de Supabase y políticas RLS. Solo perfiles con rol <code>admin</code> pueden consultar información.</p><span className="secure-status"><CheckCircle2 size={15}/> Protección activa</span></div></aside></div>
}

function SettingRow({ icon: Icon, title, text }: { icon: typeof Bell, title: string, text: string }) {
  return <div><div className="setting-row-icon"><Icon size={18}/></div><span><strong>{title}</strong><small>{text}</small></span><label className="switch"><input type="checkbox" defaultChecked/><span/></label></div>
}

function Avatar({ initials, large = false }: { initials: string, large?: boolean }) {
  const colors = ['purple', 'orange', 'green', 'blue']
  const index = initials.charCodeAt(0) % colors.length
  return <div className={`person-avatar ${colors[index]} ${large ? 'large' : ''}`}>{initials}</div>
}

function StatusBadge({ status }: { status: JustificationStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i/>{status}</span>
}

function DetailDrawer({ title, onClose, children }: { title: string, onClose: () => void, children: ReactNode }) {
  return <><div className="drawer-scrim" onClick={onClose}/><aside className="detail-drawer"><header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></header><div className="drawer-body">{children}</div></aside></>
}

function Detail({ label, value }: { label: string, value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

export default App
