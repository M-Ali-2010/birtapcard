'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile, useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { shortDate } from '@/lib/format'
import {
  AccessDenied, Avatar, Badge, Button, EmptyState, Field, IconButton, KpiCard,
  KpiSkeleton, Modal, Note, Panel, RoleBadge, SearchInput, SkeletonRows,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type UserRow = {
  id: string
  user_id: string
  role: string
  company_id: string | null
  full_name: string | null
  created_at: string
  companies?: { name: string; slug: string } | null
}

type BranchUserRow = {
  id: string
  user_id: string
  branch_id: string
  role: string
  branches?: { name: string; company_id: string; companies?: { name: string } | null } | null
}

type DisplayUser = {
  user_id: string
  full_name: string | null
  email: string | null
  profile_role: string
  company_name: string | null
  company_id: string | null
  branch_roles: { branch_name: string; role: string }[]
  created_at: string
  profile_id: string
}

type CompanyOption = { id: string; name: string }

/* ─── Модалка редактирования ─────────────────────────────────────────────── */

function EditUserModal({
  user, companies, onClose, onSaved,
}: {
  user: DisplayUser
  companies: CompanyOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [role, setRole] = useState(user.profile_role)
  const [companyId, setCompanyId] = useState(user.company_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    const res = await fetch('/api/users/manage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: user.profile_id,
        full_name: fullName.trim() || null,
        role,
        company_id: role === 'super_admin' ? null : (companyId || null),
      }),
    })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(json.error ?? 'Не удалось сохранить')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal
      icon="user"
      title="Редактировать пользователя"
      sub={user.email ?? user.user_id}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" icon="check" loading={saving} onClick={handleSave}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="row" style={{ gap: 13, marginBottom: 18 }}>
        <Avatar name={fullName || user.full_name} role={role} size={48} />
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 14, fontWeight: 650 }}>
            {fullName || 'Без имени'}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {user.user_id.slice(0, 13)}…
          </div>
        </div>
      </div>

      <Field label="Полное имя">
        <input className="input" value={fullName} autoFocus
          onChange={e => setFullName(e.target.value)} placeholder="Имя Фамилия" />
      </Field>

      <Field label="Роль" hint="Super Admin видит всю систему, остальные — только аналитику.">
        <select className="select" value={role} onChange={e => setRole(e.target.value)}>
          <option value="super_admin">Super Admin</option>
          <option value="owner">Owner — владелец ресторана</option>
          <option value="branch_manager">Branch Manager — управляющий</option>
        </select>
      </Field>

      {role !== 'super_admin' && (
        <Field label="Ресторан">
          <select className="select" value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">— Не привязан —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      {error && <div style={{ marginBottom: 14 }}><Note tone="danger">{error}</Note></div>}
    </Modal>
  )
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const { loaded: profileLoaded, isSuperAdmin } = useProfile()
  const isMobile = useIsMobile()
  const { success } = useToast()

  const [users, setUsers] = useState<DisplayUser[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [editing, setEditing] = useState<DisplayUser | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [profilesRes, branchUsersRes, companiesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, user_id, role, company_id, full_name, created_at, companies(name, slug)')
        .order('created_at', { ascending: false }),
      supabase
        .from('branch_users')
        .select('id, user_id, branch_id, role, branches(name, company_id, companies(name))'),
      supabase
        .from('companies')
        .select('id, name')
        .order('name'),
    ])

    setCompanies((companiesRes.data as CompanyOption[] | null) ?? [])

    const rawProfiles = (profilesRes.data as UserRow[] | null) ?? []
    const rawBranchUsers = (branchUsersRes.data as BranchUserRow[] | null) ?? []

    const branchRolesMap: Record<string, { branch_name: string; role: string }[]> = {}
    for (const bu of rawBranchUsers) {
      if (!branchRolesMap[bu.user_id]) branchRolesMap[bu.user_id] = []
      branchRolesMap[bu.user_id].push({
        branch_name: bu.branches?.name ?? bu.branch_id,
        role: bu.role,
      })
    }

    setUsers(rawProfiles.map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: null, // email хранится в auth.users и недоступен из клиента
      profile_role: p.role ?? 'branch_manager',
      company_name: (p.companies as { name: string; slug: string } | null)?.name ?? null,
      company_id: p.company_id,
      branch_roles: branchRolesMap[p.user_id] ?? [],
      created_at: p.created_at,
      profile_id: p.id,
    })))

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!profileLoaded) return
    if (isSuperAdmin) loadData()
    else setLoading(false)
  }, [profileLoaded, isSuperAdmin, loadData])

  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, loadData)
    return () => window.removeEventListener(REFRESH_EVENT, loadData)
  }, [loadData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u => {
      if (roleFilter !== 'all' && u.profile_role !== roleFilter) return false
      if (companyFilter !== 'all' && (u.company_id ?? '') !== companyFilter) return false
      if (q) {
        const hay = [u.full_name, u.email, u.company_name].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, search, roleFilter, companyFilter])

  const kpi = useMemo(() => ({
    total: users.length,
    owners: users.filter(u => u.profile_role === 'owner').length,
    managers: users.filter(u => u.profile_role === 'branch_manager').length,
    admins: users.filter(u => u.profile_role === 'super_admin').length,
  }), [users])

  const hasFilters = !!search || roleFilter !== 'all' || companyFilter !== 'all'

  if (!profileLoaded) {
    return <div className="grid grid--kpi"><KpiSkeleton /></div>
  }

  if (!isSuperAdmin) return <AccessDenied what="Пользователи" />

  return (
    <div className="stack">

      <div className="grid grid--kpi">
        {loading ? <KpiSkeleton /> : (
          <>
            <KpiCard label="Пользователей" icon="users" accent="mint" value={kpi.total} sub="В системе" />
            <KpiCard label="Super Admin" icon="zap" accent="purple" value={kpi.admins} sub="Полный доступ" />
            <KpiCard label="Владельцев" icon="restaurants" accent="orange" value={kpi.owners} sub="Владельцы ресторанов" />
            <KpiCard label="Менеджеров" icon="branches" accent="blue" value={kpi.managers} sub="Управляющие филиалов" />
          </>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск по имени или ресторану…" />

        <select className="select" value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)} style={{ width: 'auto', maxWidth: 190 }}>
          <option value="all">Все роли</option>
          <option value="super_admin">Super Admin</option>
          <option value="owner">Owner</option>
          <option value="branch_manager">Branch Manager</option>
        </select>

        <select className="select" value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)} style={{ width: 'auto', maxWidth: 220 }}>
          <option value="all">Все рестораны</option>
          <option value="">Без ресторана</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {hasFilters && (
          <Button icon="close" onClick={() => { setSearch(''); setRoleFilter('all'); setCompanyFilter('all') }}>
            Сбросить
          </Button>
        )}
      </div>

      <Panel
        title="Пользователи"
        sub={`Показано ${filtered.length} из ${users.length}`}
      >
        {loading ? (
          <SkeletonRows rows={5} height={56} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title="Пользователи не найдены"
            text="Измените параметры поиска или сбросьте фильтры."
          />
        ) : isMobile ? (
          <div className="stack" style={{ gap: 10 }}>
            {filtered.map(u => (
              <div key={u.user_id} className="card" style={{ padding: 13 }}>
                <div className="row" style={{ gap: 11 }}>
                  <Avatar name={u.full_name} role={u.profile_role} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13.5, fontWeight: 650 }}>
                      {u.full_name ?? <span style={{ color: 'var(--text-muted)' }}>Имя не указано</span>}
                    </div>
                    <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {u.company_name ?? 'без ресторана'} · с {shortDate(u.created_at)}
                    </div>
                  </div>
                  <IconButton icon="edit" title="Редактировать" onClick={() => setEditing(u)} />
                </div>
                <div className="row row--wrap" style={{ gap: 6, marginTop: 10 }}>
                  <RoleBadge role={u.profile_role} />
                  {u.branch_roles.slice(0, 3).map((br, i) => (
                    <Badge key={i} tone="muted">{br.branch_name}</Badge>
                  ))}
                  {u.branch_roles.length > 3 && (
                    <Badge tone="muted">+{u.branch_roles.length - 3}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Ресторан</th>
                  <th>Филиалы</th>
                  <th>Регистрация</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.user_id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={u.full_name} role={u.profile_role} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 650 }}>
                            {u.full_name ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Имя не указано</span>}
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {u.user_id.slice(0, 8)}…
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.profile_role} /></td>
                    <td style={{ color: 'var(--text-dim)' }}>{u.company_name ?? '—'}</td>
                    <td>
                      {u.branch_roles.length > 0 ? (
                        <div className="row row--wrap" style={{ gap: 5 }}>
                          {u.branch_roles.slice(0, 2).map((br, i) => (
                            <Badge key={i} tone="blue">{br.branch_name}</Badge>
                          ))}
                          {u.branch_roles.length > 2 && (
                            <Badge tone="muted">+{u.branch_roles.length - 2}</Badge>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {shortDate(u.created_at)}
                    </td>
                    <td className="ta-r">
                      <IconButton icon="edit" title="Редактировать" small onClick={() => setEditing(u)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Note tone="info" icon="info">
        Пользователи появляются здесь после регистрации через Supabase Auth — им автоматически
        создаётся профиль с ролью <strong>branch_manager</strong>. Здесь можно изменить роль,
        привязать к ресторану и поправить имя. Email хранится в Supabase Auth
        (<span style={{ color: 'var(--blue)' }}>Authentication → Users</span>).
      </Note>

      {editing && (
        <EditUserModal
          user={editing}
          companies={companies}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); success('Пользователь обновлён'); loadData() }}
        />
      )}
    </div>
  )
}
