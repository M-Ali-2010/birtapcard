'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Icon, type IconName } from '@/components/ui/icons'
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui/kit'
import { ChartTooltip } from '@/components/ui/charts'
import { nf } from '@/lib/format'

/* ─── Типы Telegram WebApp ───────────────────────────────────────────────── */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        expand: () => void
        close: () => void
        setHeaderColor: (color: string) => void
        setBackgroundColor: (color: string) => void
        openLink: (url: string) => void
        openTelegramLink: (url: string) => void
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
        }
        initData: string
        initDataUnsafe?: {
          user?: {
            id: number
            first_name?: string
            last_name?: string
            username?: string
            language_code?: string
          }
        }
        colorScheme?: 'dark' | 'light'
      }
    }
  }
}

type TabKey = 'overview' | 'branches' | 'analytics' | 'profile'
type PeriodRange = '7' | '30' | '90'

interface TmaData {
  ok: boolean
  user: {
    telegramId?: number
    role: string
    fullName: string
    isAdmin: boolean
  }
  company: {
    id: string
    name: string
    logoUrl?: string
  }
  availableCompanies: { id: string; name: string }[]
  period: PeriodRange
  daysCount: number
  summary: {
    scans: {
      total: number
      nfc: number
      qr: number
      prevTotal: number
      deltaPct: number | null
      isSmallSample: boolean
    }
    clicks: {
      total: number
      prevTotal: number
      deltaPct: number | null
      conversionRate: number | null
      isSmallSample: boolean
    }
    devices: {
      total: number
      active: number
      silentCount: number
    }
    googleReviews: {
      newReviews: number
      currentRating: number | null
      totalReviews: number
      lastUpdated?: string
    }
  }
  dailyChart: {
    date: string
    dayLabel: string
    nfc: number
    qr: number
    total: number
    prevTotal?: number
  }[]
  branchStats: {
    id: string
    name: string
    company: string
    scans: number
    nfc: number
    qr: number
    clicks: number
    conversionRate: number | null
    deltaPct: number | null
    devicesCount: number
    statusText: string
  }[]
  attentionSignals: {
    id: string
    kind: 'risk' | 'spike' | 'opportunity' | 'info'
    title: string
    text: string
    actionLabel?: string
    actionHref?: string
    badgeText?: string
  }[]
  targetBreakdown: {
    key: string
    label: string
    count: number
    percent: number
    color: string
  }[]
  hourlyDistribution: {
    hour: string
    nfc: number
    qr: number
    total: number
  }[]
  branches: {
    id: string
    name: string
    paidUntil?: string
    nfcUrl?: string
    qrUrl?: string
    qrImageUrl?: string
  }[]
  updatedAt: string
}

export default function TelegramMiniAppPage() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [period, setPeriod] = useState<PeriodRange>('30')
  const [data, setData] = useState<TmaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  // Тактильный отклик Telegram
  const triggerHaptic = useCallback((style: 'light' | 'medium' | 'success' = 'light') => {
    try {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
        if (style === 'success') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
        } else {
          window.Telegram.WebApp.HapticFeedback.impactOccurred(style)
        }
      }
    } catch {}
  }, [])

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (typeof window === 'undefined') return
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      try {
        tg.setHeaderColor('#0E0F11')
        tg.setBackgroundColor('#0E0F11')
      } catch {}
    }
  }, [])

  // Загрузка данных
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    let tgId: number | undefined
    if (typeof window !== 'undefined') {
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
      if (tgUser?.id) tgId = tgUser.id
      else {
        // Проверка URL параметров (для тестирования)
        const urlParams = new URLSearchParams(window.location.search)
        const pId = urlParams.get('tg_id')
        if (pId) tgId = Number(pId)
      }
    }

    try {
      const res = await fetch('/api/tma/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: tgId,
          period,
          company_id: selectedCompanyId || undefined,
          branch_id: selectedBranchId !== 'all' ? selectedBranchId : undefined,
        }),
      })

      const json = await res.json()
      if (json.ok) {
        setData(json)
        if (!selectedCompanyId && json.company?.id) {
          setSelectedCompanyId(json.company.id)
        }
      }
    } catch (e) {
      console.error('TMA data error:', e)
    } finally {
      setLoading(false)
    }
  }, [period, selectedCompanyId, selectedBranchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const userName = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || data?.user?.fullName || 'Владелец'
    }
    return data?.user?.fullName || 'Владелец'
  }, [data])

  return (
    <div className="tma-root">

      {/* ── Верхняя шапка Telegram Mini App ────────────────────────────── */}
      <header className="tma-header">
        <div className="tma-header__top">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg, var(--mint), #00A882)',
                display: 'grid', placeItems: 'center', color: '#0E0F11',
                fontWeight: 800, fontSize: 13,
              }}
            >
              B
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>BirTapCard</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {data ? `Данные на ${data.updatedAt}` : 'Загрузка…'}
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {data?.availableCompanies && data.availableCompanies.length > 1 ? (
              <select
                className="select"
                value={selectedCompanyId}
                onChange={e => {
                  setSelectedCompanyId(e.target.value)
                  triggerHaptic('light')
                }}
                style={{ height: 32, fontSize: 11.5, padding: '0 8px', maxWidth: 140 }}
              >
                {data.availableCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <span className="tma-company-pill truncate">
                <span className="live-dot" />
                {data?.company?.name || 'Заведение'}
              </span>
            )}

            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => {
                triggerHaptic('medium')
                loadData()
              }}
              aria-label="Обновить"
              title="Обновить"
            >
              <Icon name="refresh" size={13} style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            </button>
          </div>
        </div>

        {/* Переключатель периодов (7 / 30 / 90 дней) */}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Привет, <b>{userName}</b> 👋
          </div>

          <div className="segmented" style={{ height: 30, padding: 2 }}>
            {(['7', '30', '90'] as PeriodRange[]).map(p => (
              <button
                key={p}
                type="button"
                className={`segmented__item${period === p ? ' segmented__item--active' : ''}`}
                style={{ fontSize: 11, padding: '0 8px' }}
                onClick={() => {
                  setPeriod(p)
                  triggerHaptic('light')
                }}
              >
                {p} дн
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Основное содержимое по вкладкам ────────────────────────────── */}
      <main style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══════════ ВКЛАДКА 1: ОБЗОР ══════════ */}
        {tab === 'overview' && (
          <>
            {/* 4 Карточки KPI */}
            {loading && !data ? (
              <div className="tma-kpi-grid">
                <Skeleton h={84} r={12} />
                <Skeleton h={84} r={12} />
                <Skeleton h={84} r={12} />
                <Skeleton h={84} r={12} />
              </div>
            ) : data ? (
              <div className="tma-kpi-grid">
                {/* 1. Сканирования */}
                <div className="tma-kpi-card" style={{ ['--card-accent' as string]: 'var(--mint)' }}>
                  <div className="tma-kpi-card__title">
                    <span>Сканирования</span>
                    <Icon name="analytics" size={13} />
                  </div>
                  <div className="tma-kpi-card__value">
                    {nf(data.summary.scans.total)}
                  </div>
                  <div className="tma-kpi-card__sub">
                    {data.summary.scans.deltaPct !== null ? (
                      <span className={`delta delta--${data.summary.scans.deltaPct >= 0 ? 'up' : 'down'}`}>
                        {data.summary.scans.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(data.summary.scans.deltaPct)}% к прошлому
                      </span>
                    ) : (
                      <span>NFC {data.summary.scans.nfc} · QR {data.summary.scans.qr}</span>
                    )}
                  </div>
                </div>

                {/* 2. Переходы по ссылкам */}
                <div className="tma-kpi-card" style={{ ['--card-accent' as string]: 'var(--qr-gold)' }}>
                  <div className="tma-kpi-card__title">
                    <span>Переходы</span>
                    <Icon name="target" size={13} />
                  </div>
                  <div className="tma-kpi-card__value">
                    {nf(data.summary.clicks.total)}
                  </div>
                  <div className="tma-kpi-card__sub">
                    {data.summary.clicks.conversionRate !== null ? (
                      <span style={{ color: 'var(--mint)', fontWeight: 650 }}>
                        {data.summary.clicks.conversionRate}% конверсия
                      </span>
                    ) : (
                      <span>база &lt; 20</span>
                    )}
                  </div>
                </div>

                {/* 3. Активные устройства */}
                <div className="tma-kpi-card" style={{ ['--card-accent' as string]: 'var(--blue)' }}>
                  <div className="tma-kpi-card__title">
                    <span>Точки</span>
                    <Icon name="device" size={13} />
                  </div>
                  <div className="tma-kpi-card__value">
                    {data.summary.devices.active} / {data.summary.devices.total}
                  </div>
                  <div className="tma-kpi-card__sub">
                    {data.summary.devices.silentCount > 0 ? (
                      <span style={{ color: 'var(--danger)' }}>
                        ⚠️ {data.summary.devices.silentCount} молчат 7+ дн
                      </span>
                    ) : (
                      <span style={{ color: 'var(--mint)' }}>✓ Все активны</span>
                    )}
                  </div>
                </div>

                {/* 4. Отзывы Google */}
                <div className="tma-kpi-card" style={{ ['--card-accent' as string]: 'var(--purple)' }}>
                  <div className="tma-kpi-card__title">
                    <span>Отзывы Google</span>
                    <Icon name="star" size={13} />
                  </div>
                  <div className="tma-kpi-card__value">
                    {data.summary.googleReviews.newReviews > 0 ? `+${data.summary.googleReviews.newReviews}` : '0'}
                  </div>
                  <div className="tma-kpi-card__sub">
                    {data.summary.googleReviews.currentRating ? (
                      <span>★ {data.summary.googleReviews.currentRating.toFixed(1)} рейтинг</span>
                    ) : (
                      <span>Google Profile</span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* График динамики по дням */}
            <div className="panel" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Сканирования по дням</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>За {data?.daysCount || period} дней</div>
                </div>
                <div className="row" style={{ gap: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--mint)', fontWeight: 650 }}>● NFC</span>
                  <span style={{ color: 'var(--qr-gold)', fontWeight: 650 }}>● QR</span>
                </div>
              </div>

              {loading && !data ? (
                <Skeleton h={180} r={12} />
              ) : data && data.dailyChart.length > 0 ? (
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailyChart} margin={{ top: 8, right: 0, left: -26, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                      <XAxis dataKey="dayLabel" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip labels={{ nfc: 'NFC', qr: 'QR', prevTotal: 'Прошлый' }} />} cursor={{ fill: 'var(--sheen)' }} />
                      <Bar dataKey="nfc" stackId="s" fill="var(--mint)" maxBarSize={16} />
                      <Bar dataKey="qr" stackId="s" fill="var(--qr-gold)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                      <Line type="monotone" dataKey="prevTotal" stroke="var(--text-muted)" strokeDasharray="3 3" dot={false} strokeWidth={1.2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon="analytics" title="Нет данных за период" />
              )}
            </div>

            {/* Сигналы «Требует внимания» */}
            {data && data.attentionSignals.length > 0 && (
              <div className="signals-panel">
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 2 }}>
                  Требует внимания
                </div>
                {data.attentionSignals.map(sig => (
                  <div key={sig.id} className={`signal-card signal-card--${sig.kind}`} style={{ padding: '10px 12px' }}>
                    <div className="signal-card__icon" style={{ width: 24, height: 24 }}>
                      <Icon name={sig.kind === 'risk' ? 'alert' : 'analytics'} size={13} />
                    </div>
                    <div className="signal-card__content">
                      <div className="signal-card__title" style={{ fontSize: 12 }}>
                        <span>{sig.title}</span>
                        {sig.badgeText && <Badge tone={sig.kind === 'risk' ? 'danger' : 'mint'}>{sig.badgeText}</Badge>}
                      </div>
                      <div className="signal-card__text" style={{ fontSize: 11 }}>{sig.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Куда переходят гости */}
            {data && data.targetBreakdown.length > 0 && (
              <div className="panel" style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Куда переходят гости</div>
                <div className="stack" style={{ gap: 8 }}>
                  {data.targetBreakdown.map(t => (
                    <div key={t.key} className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <span className="dot" style={{ background: t.color, width: 8, height: 8 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, width: 100 }} className="truncate">{t.label}</span>
                      <div className="bar" style={{ flex: 1, height: 6 }}>
                        <div className="bar__fill" style={{ width: `${t.percent}%`, background: t.color }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, width: 34, textAlign: 'right' }}>{t.count}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>{t.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ ВКЛАДКА 2: ТОЧКИ И QR-КОДЫ ══════════ */}
        {tab === 'branches' && (
          <div className="stack" style={{ gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Филиалы и устройства заведения</div>

            {data?.branches.map(b => {
              const stat = data.branchStats.find(s => s.id === b.id)
              return (
                <div key={b.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {stat?.statusText ? `Посл. скан: ${stat.statusText}` : 'Активен'}
                      </div>
                    </div>
                    <Badge tone="mint">{stat?.scans ?? 0} сканов</Badge>
                  </div>

                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <Badge tone="mint">NFC {stat?.nfc ?? 0}</Badge>
                    <Badge tone="orange">QR {stat?.qr ?? 0}</Badge>
                    <Badge tone="blue">{stat && stat.conversionRate !== null ? `${stat.conversionRate}% переходов` : 'мало данных'}</Badge>
                  </div>

                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    {b.qrImageUrl && (
                      <a
                        href={b.qrImageUrl}
                        target="_blank"
                        rel="noopener"
                        className="btn btn--sm btn--outline"
                        style={{ flex: 1, textDecoration: 'none', fontSize: 11.5 }}
                        onClick={() => triggerHaptic('light')}
                      >
                        <Icon name="qr" size={13} /> Скачать QR
                      </a>
                    )}
                    {b.nfcUrl && (
                      <a
                        href={b.nfcUrl}
                        target="_blank"
                        rel="noopener"
                        className="btn btn--sm btn--ghost"
                        style={{ flex: 1, textDecoration: 'none', fontSize: 11.5 }}
                        onClick={() => triggerHaptic('light')}
                      >
                        <Icon name="external" size={13} /> Тест ссылки
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════ ВКЛАДКА 3: АНАЛИТИКА ══════════ */}
        {tab === 'analytics' && (
          <div className="stack" style={{ gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Почасовая активность гостей</div>
            <div className="panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                В какое время суток гости чаще всего касаются табличек
              </div>

              {data && data.hourlyDistribution.length > 0 ? (
                <div style={{ width: '100%', height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.hourlyDistribution} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                      <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={9} tickLine={false} interval={2} />
                      <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip labels={{ nfc: 'NFC', qr: 'QR', total: 'Всего' }} />} />
                      <Bar dataKey="nfc" stackId="h" fill="var(--mint)" maxBarSize={12} />
                      <Bar dataKey="qr" stackId="h" fill="var(--qr-gold)" radius={[2, 2, 0, 0]} maxBarSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>

            {/* Рейтинг филиалов */}
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Сравнение точек</div>
            <div className="stack" style={{ gap: 8 }}>
              {data?.branchStats.map((bs, idx) => (
                <div key={bs.id} className="tma-device-card">
                  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: idx === 0 ? 'var(--mint)' : 'var(--text-muted)', width: 18 }}>
                      #{idx + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 650 }}>{bs.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        NFC {bs.nfc} · QR {bs.qr}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                      {bs.scans}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--mint)' }}>
                      {bs.conversionRate !== null ? `${bs.conversionRate}% кликов` : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ ВКЛАДКА 4: ПРОФИЛЬ И БОТ ══════════ */}
        {tab === 'profile' && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--mint-dim)', color: 'var(--mint)',
                    display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700,
                  }}
                >
                  🏢
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{data?.company?.name || 'Заведение'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Роль: <b>{data?.user?.role === 'super_admin' ? 'Супер-администратор' : 'Владелец заведения'}</b>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                • Утренний отчёт: <b>08:00 (Ташкент, UTC+5)</b><br />
                • Уведомления об отзывах: <b>Включены</b><br />
                • Точек в сети: <b>{data?.branches.length || 0} филиалов</b>
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  triggerHaptic('success')
                  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                    window.Telegram.WebApp.openTelegramLink('https://t.me/birtapcard')
                  }
                }}
              >
                <Icon name="chat" size={15} /> Написать в поддержку BirTapCard
              </button>

              <button
                type="button"
                className="btn btn--outline"
                onClick={() => {
                  triggerHaptic('light')
                  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                    window.Telegram.WebApp.close()
                  }
                }}
              >
                Закрыть Mini App
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Нижняя панель навигации Telegram Mini App ──────────────────── */}
      <nav className="tma-bottom-nav">
        <button
          type="button"
          className={`tma-nav-btn${tab === 'overview' ? ' tma-nav-btn--active' : ''}`}
          onClick={() => {
            setTab('overview')
            triggerHaptic('light')
          }}
        >
          <Icon name="home" size={18} />
          <span>Обзор</span>
        </button>

        <button
          type="button"
          className={`tma-nav-btn${tab === 'branches' ? ' tma-nav-btn--active' : ''}`}
          onClick={() => {
            setTab('branches')
            triggerHaptic('light')
          }}
        >
          <Icon name="building" size={18} />
          <span>Точки</span>
        </button>

        <button
          type="button"
          className={`tma-nav-btn${tab === 'analytics' ? ' tma-nav-btn--active' : ''}`}
          onClick={() => {
            setTab('analytics')
            triggerHaptic('light')
          }}
        >
          <Icon name="analytics" size={18} />
          <span>Аналитика</span>
        </button>

        <button
          type="button"
          className={`tma-nav-btn${tab === 'profile' ? ' tma-nav-btn--active' : ''}`}
          onClick={() => {
            setTab('profile')
            triggerHaptic('light')
          }}
        >
          <Icon name="user" size={18} />
          <span>Кабинет</span>
        </button>
      </nav>
    </div>
  )
}
