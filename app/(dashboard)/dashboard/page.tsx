'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useIsMobile, useProfile, usePersistentState } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { nf, pct, relTime } from '@/lib/format'
import { Icon, type IconName } from '@/components/ui/icons'
import { ChartLegend, ChartTooltip } from '@/components/ui/charts'
import {
  Badge, Button, EmptyState, IconButton, KpiCard, KpiSkeleton,
  Note, Panel, Segmented, Skeleton, SkeletonRows,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'
import {
  getPeriodDates,
  calculateKpiSummary,
  buildDailyChartSeries,
  generateAttentionSignals,
  calculateBranchSummaries,
  calculateTargetBreakdown,
  type PeriodRange,
  type ScanEventRaw,
  type ClickEventRaw,
  type BranchRaw,
  type ReviewSnapshotRaw,
  type DeviceRaw,
} from '@/lib/analytics-engine'

/* ─── Типы интерфейса ────────────────────────────────────────────────────── */

type ViewRole = 'owner' | 'manager' | 'admin'

export default function DashboardPage() {
  const { profile, loaded: profileLoaded, role: userRole, isBranchManager } = useProfile()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  // Фильтры и селекторы
  const [period, setPeriod] = usePersistentState<PeriodRange>('btc-dash-period', '30')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [viewRole, setViewRole] = useState<ViewRole>('owner')

  // Данные из Supabase
  const [branches, setBranches] = useState<BranchRaw[]>([])
  const [currentScans, setCurrentScans] = useState<ScanEventRaw[]>([])
  const [previousScans, setPreviousScans] = useState<ScanEventRaw[]>([])
  const [currentClicks, setCurrentClicks] = useState<ClickEventRaw[]>([])
  const [previousClicks, setPreviousClicks] = useState<ClickEventRaw[]>([])
  const [snapshots, setSnapshots] = useState<ReviewSnapshotRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAtTime, setUpdatedAtTime] = useState<string>('')
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)

  /* ── Загрузка данных с учётом RLS и периодов ───────────────────────────── */

  const loadData = useCallback(async (silent = false) => {
    if (!profileLoaded || !profile) return
    if (!silent) setLoading(true)

    const supabase = createClient()
    const { currentStart, currentEnd, previousStart, previousEnd, daysCount } = getPeriodDates(period)

    // 1. Загрузка списка филиалов
    let branchQuery = supabase
      .from('branches')
      .select('id, company_id, name, created_at, companies(id, name)')
      .order('name')

    if (profile.role === 'branch_manager' && profile.branch_id) {
      branchQuery = branchQuery.eq('id', profile.branch_id)
    }

    const { data: branchData } = await branchQuery
    const rawBranches = (branchData as BranchRaw[] | null) ?? []
    setBranches(rawBranches)

    // 2. Загрузка событий сканирования за текущий и прошлый периоды
    let curScanQuery = supabase
      .from('scan_events')
      .select('id, branch_id, scan_type, device, browser_lang, is_unique, scanned_at, branches(name, companies(name))')
      .gte('scanned_at', currentStart.toISOString())
      .lte('scanned_at', currentEnd.toISOString())
      .order('scanned_at', { ascending: false })
      .limit(6000)

    let prevScanQuery = supabase
      .from('scan_events')
      .select('id, branch_id, scan_type, scanned_at')
      .gte('scanned_at', previousStart.toISOString())
      .lte('scanned_at', previousEnd.toISOString())
      .limit(6000)

    // 3. Загрузка кликов / переходов
    let curClickQuery = supabase
      .from('link_clicks')
      .select('id, branch_id, target, clicked_at')
      .gte('clicked_at', currentStart.toISOString())
      .lte('clicked_at', currentEnd.toISOString())
      .limit(4000)

    let prevClickQuery = supabase
      .from('link_clicks')
      .select('id, branch_id, target, clicked_at')
      .gte('clicked_at', previousStart.toISOString())
      .lte('clicked_at', previousEnd.toISOString())
      .limit(4000)

    // 4. Снимки отзывов Google
    let snapQuery = supabase
      .from('review_snapshots')
      .select('branch_id, rating, review_count, captured_at')
      .gte('captured_at', new Date(currentStart.getTime() - 2 * 86400000).toISOString())
      .lte('captured_at', currentEnd.toISOString())
      .order('captured_at', { ascending: true })
      .limit(2000)

    // Фильтрация по роли менеджера
    if (profile.role === 'branch_manager' && profile.branch_id) {
      curScanQuery = curScanQuery.eq('branch_id', profile.branch_id)
      prevScanQuery = prevScanQuery.eq('branch_id', profile.branch_id)
      curClickQuery = curClickQuery.eq('branch_id', profile.branch_id)
      prevClickQuery = prevClickQuery.eq('branch_id', profile.branch_id)
      snapQuery = snapQuery.eq('branch_id', profile.branch_id)
    }

    const [curScansRes, prevScansRes, curClicksRes, prevClicksRes, snapsRes] = await Promise.all([
      curScanQuery,
      prevScanQuery,
      curClickQuery,
      prevClickQuery,
      snapQuery,
    ])

    setCurrentScans((curScansRes.data as ScanEventRaw[] | null) ?? [])
    setPreviousScans((prevScansRes.data as ScanEventRaw[] | null) ?? [])
    setCurrentClicks((curClicksRes.data as ClickEventRaw[] | null) ?? [])
    setPreviousClicks((prevClicksRes.data as ClickEventRaw[] | null) ?? [])
    setSnapshots((snapsRes.data as ReviewSnapshotRaw[] | null) ?? [])

    setUpdatedAtTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    setLoading(false)
  }, [period, profile, profileLoaded])

  useEffect(() => {
    if (profileLoaded) loadData()
  }, [loadData, profileLoaded])

  useEffect(() => {
    const handler = () => loadData(true)
    window.addEventListener(REFRESH_EVENT, handler)
    return () => window.removeEventListener(REFRESH_EVENT, handler)
  }, [loadData])

  /* ── Фильтрация данных по выбранному филиалу ──────────────────────────── */

  const filteredCurrentScans = useMemo(() => {
    if (selectedBranchId === 'all') return currentScans
    return currentScans.filter(s => s.branch_id === selectedBranchId)
  }, [currentScans, selectedBranchId])

  const filteredPrevScans = useMemo(() => {
    if (selectedBranchId === 'all') return previousScans
    return previousScans.filter(s => s.branch_id === selectedBranchId)
  }, [previousScans, selectedBranchId])

  const filteredCurrentClicks = useMemo(() => {
    if (selectedBranchId === 'all') return currentClicks
    return currentClicks.filter(c => c.branch_id === selectedBranchId)
  }, [currentClicks, selectedBranchId])

  const filteredPrevClicks = useMemo(() => {
    if (selectedBranchId === 'all') return previousClicks
    return previousClicks.filter(c => c.branch_id === selectedBranchId)
  }, [previousClicks, selectedBranchId])

  const filteredSnapshots = useMemo(() => {
    if (selectedBranchId === 'all') return snapshots
    return snapshots.filter(s => s.branch_id === selectedBranchId)
  }, [snapshots, selectedBranchId])

  // Модель устройств (каждый филиал имеет NFC и QR точки касания)
  const virtualDevices: DeviceRaw[] = useMemo(() => {
    const list: DeviceRaw[] = []
    branches.forEach(b => {
      list.push({ id: `${b.id}-nfc`, branch_id: b.id, placement: 'Основной зал', table_number: '1' })
      list.push({ id: `${b.id}-qr`, branch_id: b.id, placement: 'Касса', table_number: '2' })
      list.push({ id: `${b.id}-terrace`, branch_id: b.id, placement: 'Терраса', table_number: '3' })
    })
    return list
  }, [branches])

  /* ── Расчёт метрик движком ────────────────────────────────────────────── */

  const { daysCount } = useMemo(() => getPeriodDates(period), [period])

  const summary = useMemo(() => {
    return calculateKpiSummary({
      currentScans: filteredCurrentScans,
      previousScans: filteredPrevScans,
      currentClicks: filteredCurrentClicks,
      previousClicks: filteredPrevClicks,
      devices: virtualDevices,
      branches,
      snapshots: filteredSnapshots,
    })
  }, [filteredCurrentScans, filteredPrevScans, filteredCurrentClicks, filteredPrevClicks, virtualDevices, branches, filteredSnapshots])

  const dailyChart = useMemo(() => {
    return buildDailyChartSeries(filteredCurrentScans, filteredPrevScans, daysCount)
  }, [filteredCurrentScans, filteredPrevScans, daysCount])

  const branchStats = useMemo(() => {
    return calculateBranchSummaries({
      branches,
      currentScans,
      previousScans,
      currentClicks,
      devices: virtualDevices,
    })
  }, [branches, currentScans, previousScans, currentClicks, virtualDevices])

  const attentionSignals = useMemo(() => {
    return generateAttentionSignals({
      metricSummary: summary,
      branchStats,
    })
  }, [summary, branchStats])

  const targetBreakdown = useMemo(() => {
    return calculateTargetBreakdown(filteredCurrentClicks)
  }, [filteredCurrentClicks])

  // Выбранный филиал для правой колонки
  const activeBranch = useMemo(() => {
    if (selectedBranchId !== 'all') {
      return branches.find(b => b.id === selectedBranchId) || branches[0]
    }
    return branches[0]
  }, [branches, selectedBranchId])

  const activeBranchStat = useMemo(() => {
    if (!activeBranch) return null
    return branchStats.find(b => b.id === activeBranch.id) || null
  }, [activeBranch, branchStats])

  // Проверка непривязанного аккаунта
  const unlinked =
    !!profile &&
    profile.role !== 'super_admin' &&
    !profile.company_id &&
    !profile.branch_id

  if (!profileLoaded) {
    return (
      <div className="stack">
        <div className="grid grid--kpi"><KpiSkeleton /></div>
        <Skeleton h={320} r={18} />
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {unlinked && (
        <Note tone="warning" icon="alert">
          <strong>Аккаунт ещё не подключён.</strong> Вы вошли, но администратор пока не выдал
          вам роль и не привязал к заведению. Напишите нам в Telegram:{' '}
          <a href="https://t.me/Jrkhnv777" target="_blank" rel="noopener" style={{ color: 'var(--mint)' }}>@Jrkhnv777</a>
          {' '}— подключим за пару минут.
        </Note>
      )}

      {/* ── Тулбар управления: роли, период, статус свежести ─────────────── */}
      <div className="dash-toolbar">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="role-switcher" role="tablist" aria-label="Вид для роли">
            <button
              type="button"
              className={`role-btn${viewRole === 'owner' ? ' role-btn--active' : ''}`}
              onClick={() => setViewRole('owner')}
            >
              Владелец
            </button>
            <button
              type="button"
              className={`role-btn${viewRole === 'manager' ? ' role-btn--active' : ''}`}
              onClick={() => setViewRole('manager')}
            >
              Управляющий
            </button>
            <button
              type="button"
              className={`role-btn${viewRole === 'admin' ? ' role-btn--active' : ''}`}
              onClick={() => setViewRole('admin')}
            >
              Администратор
            </button>
          </div>

          <Segmented
            value={period}
            onChange={v => setPeriod(v as PeriodRange)}
            options={[
              { value: '7', label: '7 дней' },
              { value: '30', label: '30 дней' },
              { value: '90', label: '90 дней' },
            ]}
          />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Сравнить: прошлые {daysCount} дн.
          </div>

          <div
            className="mono"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 'var(--r-sm)', background: 'var(--card2)',
              border: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-dim)',
            }}
          >
            <span className="live-dot" />
            {loading ? 'Обновление…' : `Данные на ${updatedAtTime || 'сейчас'}`}
          </div>

          <IconButton
            icon="refresh"
            title="Обновить"
            onClick={() => loadData()}
            disabled={loading}
          />
        </div>
      </div>

      {/* ── Трёхзонный лейаут (Next-Gen Business OS) ────────────────────── */}
      <div className="dash-3zone">

        {/* ── 1. Левая зона: Дерево заведений и филиалов ─────────────────── */}
        <aside className="dash-3zone__left dash-tree">
          <div className="dash-tree__title">
            <span>Филиалы</span>
            <span style={{ fontSize: 10, color: 'var(--mint)' }}>{branches.length} точек</span>
          </div>

          <button
            type="button"
            className={`dash-tree__item${selectedBranchId === 'all' ? ' dash-tree__item--active' : ''}`}
            onClick={() => setSelectedBranchId('all')}
          >
            <span className="truncate">Все филиалы</span>
            <span className="dash-tree__badge">{summary.scans.total}</span>
          </button>

          {branches.map(b => {
            const stat = branchStats.find(s => s.id === b.id)
            const isSelected = selectedBranchId === b.id
            return (
              <button
                key={b.id}
                type="button"
                className={`dash-tree__item${isSelected ? ' dash-tree__item--active' : ''}`}
                onClick={() => setSelectedBranchId(b.id)}
              >
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div className="truncate">{b.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {b.companies?.name || 'Заведение'}
                  </div>
                </div>
                <span className="dash-tree__badge">{stat?.scans ?? 0}</span>
              </button>
            )
          })}

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
            <Link href="/branches" style={{ textDecoration: 'none' }}>
              <Button icon="plus" size="sm" block variant="ghost">
                Управление филиалами
              </Button>
            </Link>
          </div>
        </aside>

        {/* ── 2. Центральная зона: Основная аналитика и виджеты ─────────── */}
        <div className="dash-3zone__center dash-center">

          {/* ── 4 KPI Карточки (Obsidian Luxury) ────────────────────────── */}
          <div className="grid grid--kpi">
            {loading ? <KpiSkeleton count={4} /> : (
              <>
                {/* 1. Сканирования */}
                <KpiCard
                  label={`Сканирования за ${daysCount} дн.`}
                  icon="analytics"
                  accent="mint"
                  value={summary.scans.total}
                  delta={summary.scans.deltaPct !== null ? { value: summary.scans.deltaPct } : undefined}
                  sub={
                    summary.scans.isSmallSample ? (
                      <span style={{ color: 'var(--text-muted)' }}>NFC {summary.scans.nfc} · QR {summary.scans.qr} (мало данных)</span>
                    ) : (
                      <span>NFC <b>{summary.scans.nfc}</b> · QR <b>{summary.scans.qr}</b></span>
                    )
                  }
                />

                {/* 2. Переходы по ссылкам */}
                <KpiCard
                  label="Переходы по ссылкам"
                  icon="target"
                  accent="champagne"
                  value={summary.clicks.total}
                  delta={summary.clicks.deltaPct !== null ? { value: summary.clicks.deltaPct } : undefined}
                  sub={
                    summary.clicks.conversionRate !== null ? (
                      <span><b>{summary.clicks.conversionRate}%</b> сканирований завершились кликом</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{summary.clicks.total} переходов (база &lt; 20)</span>
                    )
                  }
                />

                {/* 3. Активные устройства */}
                <KpiCard
                  label="Активные устройства"
                  icon="device"
                  accent="blue"
                  value={`${summary.devices.active} / ${summary.devices.total}`}
                  sub={
                    summary.devices.silentCount > 0 ? (
                      <span style={{ color: 'var(--danger)' }}>⚠️ {summary.devices.silentCount} молчат более 7 дней</span>
                    ) : (
                      <span style={{ color: 'var(--mint)' }}>✓ Все точки активны</span>
                    )
                  }
                />

                {/* 4. Отзывы Google (изолированный внешний источник) */}
                <KpiCard
                  label="Новые отзывы Google"
                  icon="star"
                  accent="purple"
                  value={summary.googleReviews.newReviews > 0 ? `+${summary.googleReviews.newReviews}` : '0'}
                  sub={
                    summary.googleReviews.currentRating ? (
                      <span>Рейтинг ★ <b>{summary.googleReviews.currentRating.toFixed(1)}</b> · {summary.googleReviews.totalReviews} отзывов</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Внешние данные Google</span>
                    )
                  }
                />
              </>
            )}
          </div>

          {/* ── График сканирований по дням ─────────────────────────────── */}
          <Panel
            title="Динамика сканирований по дням"
            sub={`NFC (изумруд) против QR (шампань) · сравнение с прошлым периодом за ${daysCount} дн.`}
            action={
              <div className="row" style={{ gap: 10 }}>
                <span className="dot" style={{ background: 'var(--mint)' }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>NFC</span>
                <span className="dot" style={{ background: 'var(--qr-gold)' }} />
                <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>QR</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>--- Прошлый период</span>
              </div>
            }
          >
            {loading ? (
              <Skeleton h={240} r={12} />
            ) : dailyChart.length === 0 ? (
              <EmptyState icon="analytics" title="Нет данных за выбранный период" />
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                    <XAxis
                      dataKey="dayLabel"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<ChartTooltip labels={{ nfc: 'NFC касания', qr: 'QR сканы', prevTotal: 'Прошлый период' }} />}
                      cursor={{ fill: 'var(--sheen)' }}
                    />
                    <Bar dataKey="nfc" stackId="scans" fill="var(--mint)" maxBarSize={28} />
                    <Bar dataKey="qr" stackId="scans" fill="var(--qr-gold)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line
                      type="monotone"
                      dataKey="prevTotal"
                      stroke="var(--text-muted)"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          {/* ── Блок «Требует внимания» (Сигналы Aurora & Business OS) ──── */}
          {attentionSignals.length > 0 && (
            <Panel
              title="Требует внимания"
              sub="Автоматические сигналы по эффективности точек и состоянию сети"
              action={<Badge tone="orange">{attentionSignals.length} сигнала</Badge>}
            >
              <div className="signals-panel">
                {attentionSignals.map(sig => (
                  <div key={sig.id} className={`signal-card signal-card--${sig.kind}`}>
                    <div className="signal-card__icon">
                      <Icon
                        name={sig.kind === 'risk' ? 'alert' : sig.kind === 'spike' ? 'analytics' : 'info'}
                        size={15}
                      />
                    </div>
                    <div className="signal-card__content">
                      <div className="signal-card__title">
                        <span>{sig.title}</span>
                        {sig.badgeText && (
                          <Badge tone={sig.kind === 'risk' ? 'danger' : sig.kind === 'spike' ? 'mint' : 'muted'}>
                            {sig.badgeText}
                          </Badge>
                        )}
                      </div>
                      <div className="signal-card__text">{sig.text}</div>
                    </div>
                    {sig.actionLabel && (
                      <Link href={sig.actionHref || '/branches'} style={{ textDecoration: 'none' }}>
                        <Button size="sm" variant="outline">
                          {sig.actionLabel}
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* ── Сводка по филиалам ────────────────────────────────────────── */}
          <Panel
            title="Эффективность филиалов"
            sub={`Сравнение активности точек · ${branchStats.length} заведений`}
            action={
              <Link href="/analytics" style={{ textDecoration: 'none' }}>
                <Button size="sm" variant="ghost" icon="analytics">
                  Полная аналитика →
                </Button>
              </Link>
            }
          >
            {loading ? (
              <SkeletonRows rows={4} height={46} />
            ) : branchStats.length === 0 ? (
              <EmptyState icon="building" title="Филиалы не найдены" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Филиал</th>
                      <th className="ta-r">Сканы</th>
                      <th className="ta-r">Динамика</th>
                      <th className="ta-r">% переходов</th>
                      <th className="ta-r">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchStats.map(r => (
                      <tr
                        key={r.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedBranchId(r.id)}
                      >
                        <td>
                          <div style={{ fontWeight: 650, color: selectedBranchId === r.id ? 'var(--mint)' : 'var(--text)' }}>
                            {r.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.company}</div>
                        </td>
                        <td className="ta-r mono" style={{ fontWeight: 700 }}>
                          {r.scans}
                        </td>
                        <td className="ta-r">
                          {r.deltaPct !== null ? (
                            <span className={`delta delta--${r.deltaPct > 0 ? 'up' : r.deltaPct < 0 ? 'down' : 'flat'}`}>
                              <Icon name={r.deltaPct >= 0 ? 'arrowUp' : 'arrowDown'} size={11} />
                              {Math.abs(r.deltaPct)}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="ta-r mono">
                          {r.conversionRate !== null ? (
                            <span style={{ color: 'var(--mint)', fontWeight: 600 }}>{r.conversionRate}%</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>мало данных</span>
                          )}
                        </td>
                        <td className="ta-r" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {r.statusText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Куда переходят (Link Clicks Breakdown) ───────────────────── */}
          <Panel
            title="Куда переходят гости после сканирования"
            sub={`Нажатия на целевые кнопки за ${daysCount} дн. · всего ${summary.clicks.total} переходов`}
            action={
              summary.clicks.conversionRate !== null && (
                <Badge tone="mint">Конверсия в действие: {summary.clicks.conversionRate}%</Badge>
              )
            }
          >
            {loading ? (
              <SkeletonRows rows={3} height={38} />
            ) : targetBreakdown.length === 0 ? (
              <EmptyState
                icon="target"
                title="Переходов пока нет"
                text="События появятся, когда гости начнут нажимать на кнопки после касания устройства."
              />
            ) : (
              <div className="grid grid--2" style={{ gap: '10px 24px' }}>
                {targetBreakdown.map(t => (
                  <div key={t.key} className="row" style={{ gap: 12, padding: '8px 0' }}>
                    <span className="dot" style={{ background: t.color, width: 9, height: 9 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, width: 110 }} className="truncate">{t.label}</span>
                    <div className="bar" style={{ flex: 1 }}>
                      <div className="bar__fill" style={{ width: `${t.percent}%`, background: t.color }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, width: 42, textAlign: 'right' }}>
                      {t.count}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
                      {t.percent}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── 3. Правая зона: Инспекция филиала и устройств ─────────────── */}
        <aside className="dash-3zone__right dash-detail">
          {activeBranch ? (
            <>
              <div className="dash-detail__head">
                <div className="dash-detail__title truncate">{activeBranch.name}</div>
                <div className="dash-detail__sub truncate">{activeBranch.companies?.name || 'Заведение'}</div>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Сканирования</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--mint)' }}>
                    {activeBranchStat?.scans ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>% переходов</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--qr-gold)' }}>
                    {activeBranchStat?.conversionRate !== null ? `${activeBranchStat?.conversionRate}%` : '—'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Точки касания
                </div>
                <div className="dash-detail__device-list">
                  <div className="dash-detail__device-item">
                    <div>
                      <div style={{ fontWeight: 600 }}>NFC Табличка</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Основной зал</div>
                    </div>
                    <Badge tone="mint">Активна</Badge>
                  </div>

                  <div className="dash-detail__device-item">
                    <div>
                      <div style={{ fontWeight: 600 }}>QR Стенд</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Касса</div>
                    </div>
                    <Badge tone="orange">QR код</Badge>
                  </div>

                  <div className="dash-detail__device-item">
                    <div>
                      <div style={{ fontWeight: 600 }}>Стол 1-8</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Гостевой зал</div>
                    </div>
                    <Badge tone="blue">8 столов</Badge>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/qrcodes" style={{ textDecoration: 'none' }}>
                  <Button icon="qr" block size="sm" variant="outline">
                    Скачать QR-коды
                  </Button>
                </Link>
                <Link href="/branches" style={{ textDecoration: 'none' }}>
                  <Button icon="building" block size="sm" variant="ghost">
                    Настройки ссылок филиала
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Выберите филиал для инспекции
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
