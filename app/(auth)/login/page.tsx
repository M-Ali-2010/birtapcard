'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearProfileCache } from '@/lib/hooks'
import { Icon, Logo } from '@/components/ui/icons'
import { Button, Field, Note } from '@/components/ui/kit'
import { ThemeToggle } from '@/components/ui/theme'
import { LangSwitch } from '@/components/i18n-runtime'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null)
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !authData.user) {
      setLoading(false)
      setError('Неверный email или пароль')
      return
    }

    clearProfileCache()

    // 1. If explicit ?next= was requested, go there
    if (nextUrl && nextUrl.startsWith('/')) {
      router.push(nextUrl)
      router.refresh()
      return
    }

    // 2. Check restaurant role routing
    try {
      const { data: restUser } = await supabase
        .from('restaurant_users')
        .select('restaurant_id, role')
        .eq('user_id', authData.user.id)
        .limit(1)
        .maybeSingle()

      if (restUser) {
        if (restUser.role === 'kitchen') {
          router.push(`/restaurant-admin/${restUser.restaurant_id}/kitchen`)
          router.refresh()
          return
        }
        if (restUser.role === 'staff' || restUser.role === 'restaurant_admin') {
          router.push(`/restaurant-admin/${restUser.restaurant_id}/orders`)
          router.refresh()
          return
        }
      }
    } catch {
      // Fallback to dashboard
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Введите email для сброса пароля')
      return
    }
    setForgotLoading(true)
    setError(null)
    setForgotSuccess(null)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    })

    setForgotLoading(false)
    if (resetError) {
      setError('Не удалось отправить ссылку для сброса. Проверьте правильность email.')
    } else {
      setForgotSuccess('Ссылка для сброса пароля отправлена на ваш email.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
        position: 'relative',
      }}
    >
      <div className="brand-orbs" aria-hidden="true">
        <div className="brand-orb brand-orb--a" />
        <div className="brand-orb brand-orb--b" />
        <div className="brand-orb brand-orb--c" />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          right: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <LangSwitch />
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Бренд */}
        <div
          className="brand-in"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginBottom: 26,
          }}
        >
          <Logo size={72} />
          <div style={{ textAlign: 'center' }}>
            <div className="wordmark" style={{ fontSize: 30 }}>
              Bir<em>Tap</em>Card
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--mint)',
                fontWeight: 700,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                marginTop: 8,
              }}
            >
              одно касание — один отзыв
            </div>
          </div>
        </div>

        <div className="card brand-in brand-in--2" style={{ padding: 26, boxShadow: 'var(--sh-3)' }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 5px', letterSpacing: '-0.01em' }}>
            {forgotOpen ? 'Сброс пароля' : 'Вход в систему'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 22px' }}>
            {forgotOpen
              ? 'Введите ваш рабочий email для получения ссылки'
              : 'NFC и QR сервис для гостей и персонала заведений'}
          </p>

          {!forgotOpen ? (
            <form onSubmit={handleSubmit}>
              <Field label="Email">
                <div className="search">
                  <span className="search__icon"><Icon name="user" size={15} /></span>
                  <input
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.uz"
                  />
                </div>
              </Field>

              <Field label="Пароль">
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      translate: '0 -50%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 10,
                      display: 'flex',
                      borderRadius: 8,
                    }}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                </div>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setForgotSuccess(null)
                    setForgotOpen(true)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 12.5,
                    color: 'var(--mint-2)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Забыли пароль?
                </button>
              </div>

              {error && (
                <div style={{ marginBottom: 14 }}>
                  <Note tone="danger">{error}</Note>
                </div>
              )}

              <Button type="submit" variant="primary" block loading={loading} icon="chevronRight">
                {loading ? 'Входим…' : 'Войти'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <Field label="Email">
                <div className="search">
                  <span className="search__icon"><Icon name="user" size={15} /></span>
                  <input
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.uz"
                  />
                </div>
              </Field>

              {error && (
                <div style={{ marginBottom: 14 }}>
                  <Note tone="danger">{error}</Note>
                </div>
              )}

              {forgotSuccess && (
                <div style={{ marginBottom: 14 }}>
                  <Note tone="success">{forgotSuccess}</Note>
                </div>
              )}

              <Button type="submit" variant="primary" block loading={forgotLoading}>
                {forgotLoading ? 'Отправляем…' : 'Отправить ссылку'}
              </Button>

              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setForgotOpen(false)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ← Вернуться ко входу
                </button>
              </div>
            </form>
          )}
        </div>

        <p
          className="brand-in brand-in--3"
          style={{
            textAlign: 'center',
            fontSize: 11.5,
            color: 'var(--text-muted)',
            marginTop: 18,
            lineHeight: 1.6,
          }}
        >
          Доступ для персонала выдаёт управляющий заведения.<br />
          При трудностях обратитесь к администратору.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
      <LoginForm />
    </Suspense>
  )
}
