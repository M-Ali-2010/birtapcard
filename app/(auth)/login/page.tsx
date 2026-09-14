'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearProfileCache } from '@/lib/hooks'
import { Icon, Logo } from '@/components/ui/icons'
import { Button, Field, Note } from '@/components/ui/kit'
import { ThemeToggle } from '@/components/ui/theme'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      setError('Неверный email или пароль')
      return
    }

    clearProfileCache()
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
      position: 'relative',
    }}>
      <div className="brand-orbs" aria-hidden="true">
        <div className="brand-orb brand-orb--a" />
        <div className="brand-orb brand-orb--b" />
        <div className="brand-orb brand-orb--c" />
      </div>

      <div style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Бренд */}
        <div className="brand-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 26 }}>
          <Logo size={72} />
          <div style={{ textAlign: 'center' }}>
            <div className="wordmark" style={{ fontSize: 30 }}>Bir<em>Tap</em>Card</div>
            <div style={{
              fontSize: 10.5, color: 'var(--mint)', fontWeight: 700,
              letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 8,
            }}>
              одно касание — один отзыв
            </div>
          </div>
        </div>

        <div className="card brand-in brand-in--2" style={{ padding: 26, boxShadow: 'var(--sh-3)' }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 5px', letterSpacing: '-0.01em' }}>
            Вход в систему
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 22px' }}>
            NFC и QR аналитика для ваших заведений
          </p>

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
                  onChange={e => setEmail(e.target.value)}
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
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  style={{
                    position: 'absolute', right: 8, top: '50%', translate: '0 -50%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 6, display: 'flex',
                  }}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </Field>

            {error && (
              <div style={{ marginBottom: 14 }}>
                <Note tone="danger">{error}</Note>
              </div>
            )}

            <Button type="submit" variant="primary" block loading={loading} icon="chevronRight">
              {loading ? 'Входим…' : 'Войти'}
            </Button>
          </form>
        </div>

        <p className="brand-in brand-in--3" style={{
          textAlign: 'center', fontSize: 11.5, color: 'var(--text-muted)',
          marginTop: 18, lineHeight: 1.6,
        }}>
          Доступ выдаёт администратор сети.<br />
          Забыли пароль — обратитесь к нему.
        </p>
      </div>
    </div>
  )
}
