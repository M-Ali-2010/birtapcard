'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearProfileCache, useProfile } from '@/lib/hooks'
import { Icon } from '@/components/ui/icons'
import { useTheme } from '@/components/ui/theme'
import {
  AccessDenied, Avatar, Badge, Button, Field, IconButton, Note,
  Panel, Segmented, Skeleton, roleLabel,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Индикатор надёжности пароля ────────────────────────────────────────── */

function strengthOf(pwd: string) {
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-ZА-Я]/.test(pwd) && /[a-zа-я]/.test(pwd)) score++
  if (/\d/.test(pwd) && /[^\w\s]/.test(pwd)) score++
  return Math.min(score, 4)
}

const STRENGTH = [
  { label: 'Слишком короткий', color: 'var(--danger)' },
  { label: 'Слабый', color: 'var(--danger)' },
  { label: 'Нормальный', color: 'var(--orange)' },
  { label: 'Хороший', color: 'var(--blue)' },
  { label: 'Надёжный', color: 'var(--mint)' },
]

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { profile, loaded: profileLoaded, role, isSuperAdmin } = useProfile()
  const { mode, setMode } = useTheme()
  const { success, error: errorToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    setEmail(user.email ?? '')

    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, companies!company_id(name)')
      .eq('user_id', user.id)
      .single()

    if (prof) {
      const company = Array.isArray(prof.companies) ? (prof.companies[0] ?? null) : (prof.companies ?? null)
      setCompanyName((company as { name: string } | null)?.name ?? null)
      setFullName(prof.full_name ?? '')
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (profileLoaded) load() }, [profileLoaded, load])

  async function handleSaveProfile() {
    if (!profile) return
    setSavingProfile(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', profile.id)
    setSavingProfile(false)

    if (error) {
      errorToast('Ошибка при сохранении имени')
    } else {
      success('Имя обновлено')
      clearProfileCache()
      await load()
    }
  }

  async function handleSavePassword() {
    if (!newPassword) { errorToast('Введите новый пароль'); return }
    if (newPassword.length < 8) { errorToast('Пароль должен быть не менее 8 символов'); return }
    if (newPassword !== confirmPassword) { errorToast('Пароли не совпадают'); return }

    setSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) {
      errorToast(error.message ?? 'Ошибка при смене пароля')
    } else {
      success('Пароль изменён')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  if (!profileLoaded || loading) {
    return (
      <div className="stack" style={{ maxWidth: 760 }}>
        <Skeleton h={104} r={18} />
        <Skeleton h={260} r={18} />
        <Skeleton h={260} r={18} />
      </div>
    )
  }

  if (!isSuperAdmin) return <AccessDenied what="Настройки" />

  const strength = strengthOf(newPassword)
  const mismatch = !!confirmPassword && confirmPassword !== newPassword

  return (
    <div className="stack" style={{ maxWidth: 760 }}>

      {/* Шапка профиля */}
      <div className="card" style={{ padding: 18 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={fullName || email} role={role ?? undefined} size={62} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {fullName || '—'}
            </div>
            <div className="truncate" style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '3px 0 8px' }}>
              {email}
            </div>
            <div className="row row--wrap" style={{ gap: 7 }}>
              <Badge tone={role === 'super_admin' ? 'purple' : role === 'owner' ? 'mint' : 'blue'}>
                {roleLabel(role)}
              </Badge>
              {companyName && <Badge tone="muted">{companyName}</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Внешний вид */}
      <Panel title="Внешний вид" sub="Тема интерфейса запоминается на этом устройстве">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'dark', label: '🌙 Тёмная' },
            { value: 'light', label: '☀️ Светлая' },
            { value: 'system', label: '⚙️ Как в системе' },
          ]}
        />
      </Panel>

      {/* Личные данные */}
      <Panel title="Личные данные" sub="Имя, которое видят другие пользователи">
        <Field label="Полное имя">
          <input className="input" value={fullName}
            onChange={e => setFullName(e.target.value)} placeholder="Введите ваше имя" />
        </Field>

        <Field label="Email" hint="Email привязан к учётной записи и не меняется здесь.">
          <input className="input" value={email} readOnly />
        </Field>

        <Button variant="primary" icon="save" loading={savingProfile}
          disabled={!fullName.trim()} onClick={handleSaveProfile}>
          Сохранить имя
        </Button>
      </Panel>

      {/* Смена пароля */}
      <Panel title="Смена пароля" sub="Минимум 8 символов">
        <Field label="Новый пароль">
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Введите новый пароль"
              style={{ paddingRight: 44 }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              aria-label={showNew ? 'Скрыть пароль' : 'Показать пароль'}
              style={{
                position: 'absolute', right: 8, top: '50%', translate: '0 -50%',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 6, display: 'flex',
              }}
            >
              <Icon name={showNew ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
        </Field>

        {newPassword && (
          <div style={{ marginTop: -6, marginBottom: 15 }}>
            <div className="row" style={{ gap: 4, marginBottom: 6 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= strength ? STRENGTH[strength].color : 'var(--border)',
                  transition: 'background .25s',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: STRENGTH[strength].color }}>
              {STRENGTH[strength].label}
            </div>
          </div>
        )}

        <Field label="Подтверждение пароля" error={mismatch ? 'Пароли не совпадают' : undefined}>
          <div style={{ position: 'relative' }}>
            <input
              className={`input${mismatch ? ' input--error' : ''}`}
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
              style={{ paddingRight: 44 }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
              style={{
                position: 'absolute', right: 8, top: '50%', translate: '0 -50%',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 6, display: 'flex',
              }}
            >
              <Icon name={showConfirm ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
        </Field>

        <Button
          variant="primary" icon="key" loading={savingPassword}
          disabled={!newPassword || newPassword !== confirmPassword || newPassword.length < 8}
          onClick={handleSavePassword}
        >
          Изменить пароль
        </Button>
      </Panel>

      {/* Информация об аккаунте */}
      <Panel title="Аккаунт" sub="Служебная информация">
        <div className="stack" style={{ gap: 0 }}>
          {[
            { key: 'Роль в системе', value: roleLabel(role) },
            { key: 'Ресторан', value: companyName ?? '—' },
            { key: 'ID пользователя', value: profile?.user_id ?? '—', mono: true },
          ].map(row => (
            <div key={row.key} className="row" style={{
              justifyContent: 'space-between', gap: 14,
              padding: '11px 0', borderBottom: '1px solid var(--border-soft)',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{row.key}</span>
              <span className={`truncate ${row.mono ? 'mono' : ''}`}
                style={{ fontSize: row.mono ? 11.5 : 13, color: 'var(--text-dim)' }}>
                {row.value}
              </span>
              {row.mono && row.value !== '—' && (
                <IconButton
                  icon="copy" small title="Скопировать ID"
                  onClick={() => {
                    navigator.clipboard?.writeText(row.value)
                    success('ID скопирован')
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Note tone="info">
        Права доступа настраиваются в разделе «Пользователи». Если нужно сменить email —
        это делается в консоли Supabase (Authentication → Users).
      </Note>
    </div>
  )
}
