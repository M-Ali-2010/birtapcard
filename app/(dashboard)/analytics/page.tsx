'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIsMobile, useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { downloadCsv, nf, pct } from '@/lib/format'
import { Icon } from '@/components/ui/icons'
import { ChartLegend, ChartTooltip } from '@/components/ui/charts'
import {
  Badge, Button, EmptyState, KpiCard, KpiSkeleton, Panel,
  SearchInput, Segmented, Skeleton, SkeletonRows,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type ScanEvent = {
  id: string
  branch_id: string
  scan_type: string
  device: string
  is_unique: boolean
  scanned_at: string
  branches?: { name: string; companies?: { name: string } | null } | null
}

type BranchOption = { id: string; name: string; company: string }
type BranchRow = {
  id: string; name: string; company: string
  nfc: number; qr: number; total: number; unique: number; conversion: number
}
type SortKey = 'total' | 'nfc' | 'qr' | 'unique' | 'conversion'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const SORT_LABELS: Record<SortKey, string> = {
  total: 'Всего', nfc: 'NFC', qr: 'QR', unique: 'Уникальных', conversion: 'Конверсия',
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

function AnalyticsSkeleton() {
  return (
    <div className="stack">
      <div className="grid grid--kpi"><KpiSkeleton /></div>
      <Skeleton h={260} r={18} />
    </div>
  )
}

/** useSearchParams требует Suspense-границы при пререндере. */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsView />
    </Suspense>
  )
}

function AnalyticsView() {
  const { profile, loaded: profileLoaded, isBranchManager } = useProfile()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const params = useSearchParams()

  const [range, setRange] = useState<'7' | '30' | '90' | 'custom'>('7')
  const [customFrom, setCustomFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [branchFilter, setBranchFilter] = useState<string>(params.get('branch') ?? 'all')
  const [events, setEvents] = useState<ScanEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState('')

  // Ссылка из палитры команд: /analytics?branch=…
  useEffect(() => {
    const b = params.get('branch')
    if (b) setBranchFilter(b)
  }, [params])

  // Список филиалов для фильтра (ограничен RLS)
  useEffect(() => {
    if (!profileLoaded) return
    const supabase = createClient()
    supabase
      .from('branches')
      .select('id, name, companies(name)')
      .order('name')
      .then(({ data }) => {
        const list = ((data as { id: string; name: string; companies?: { name: string } | null }[] | null) ?? [])
          .map(b => ({ id: b.id, name: b.name, company: b.companies?.name ?? '—' }))
        setBranches(list)
      })
  }, [profileLoaded])

  const { since, until, daysCount } = useMemo(() => {
    if (range === 'custom') {
      const fromD = new Date(customFrom + 'T00:00:00')
      const toD = new Date(customTo + 'T23:59:59')
      const days = Math.max(1, Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1)
      return { since: fromD.toISOString(), until: toD.toISOString(), daysCount: days }
    }
    const days = parseInt(range)
    return {
      since: new Date(Date.now() - days * 86400000).toISOString(),
      until: new Date().toISOString(),
      daysCount: days,
    }
  }, [range, customFrom, customTo])

  const loadData = useCallback(async (silent = false) => {
    if (!profileLoaded || !profile) return
    if (!silent) setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('scan_events')
      .select('id, branch_id, scan_type, device, is_unique, scanned_at, branches(name, companies(name))')
      .gte('scanned_at', since)
      .lte('scanned_at', until)
      .order('scanned_at', { ascending: false })
      .limit(5000)

    // Менеджер филиала жёстко привязан к своей точке
    if (profile.role === 'branch_manager' && profile.branch_id) {
      query = query.eq('branch_id', profile.branch_id)
    } else if (branchFilter !== 'all') {
      query = query.eq('branch_id', branchFilter)
    }

    const { data } = await query
    setEvents((data as ScanEvent[] | null) ?? [])
    setLoading(false)
  }, [since, until, branchFilter, profile, profileLoaded])

  useEffect(() => { if (profileLoaded) loadData() }, [loadData, profileLoaded])

  useEffect(() => {
    const handler = () => loadData(true)
    window.addEventListener(REFRESH_EVENT, handler)
    return () => window.removeEventListener(REFRESH_EVENT, handler)
  }, [loadData])

  /* ── Показатели ───────────────────────────────────────────────────────── */

  const totalScans = events.length
  const nfcTotal = events.filter(e => e.scan_type === 'nfc').length
  const qrTotal = events.filter(e => e.scan_type === 'qr').length
  const uniqueTotal = events.filter(e => e.is_unique).length
  const avgPerDay = daysCount > 0 ? Math.round((totalScans / daysCount) * 10) / 10 : 0
  const repeatRate = pct(totalScans - uniqueTotal, totalScans)

  const hourlyData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ nfc: 0, qr: 0 }))
    events.forEach(e => {
      const h = new Date(e.scanned_at).getHours()
      if (e.scan_type === 'nfc') buckets[h].nfc++
      else buckets[h].qr++
    })
    return buckets.map((v, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, ...v }))
  }, [events])

  const weekdayData = useMemo(() => {
    const buckets = Array.from({ length: 7 }, () => ({ nfc: 0, qr: 0 }))
    events.forEach(e => {
      const jsDay = new Date(e.scanned_at).getDay() // 0=Вс…6=Сб
      const idx = jsDay === 0 ? 6 : jsDay - 1       // 0=Пн…6=Вс
      if (e.scan_type === 'nfc') buckets[idx].nfc++
      else buckets[idx].qr++
    })
    return buckets.map((v, i) => ({ day: WEEKDAYS[i], ...v }))
  }, [events])

  // Пик активности — короткая подсказка над графиками
  const peakHour = useMemo(() => {
    let best = -1, bestVal = 0
    hourlyData.forEach((h, i) => {
      const sum = h.nfc + h.qr
      if (sum > bestVal) { bestVal = sum; best = i }
    })
    return best >= 0 && bestVal > 0 ? { label: `${String(best).padStart(2, '0')}:00`, value: bestVal } : null
  }, [hourlyData])

  const peakDay = useMemo(() => {
    let best = -1, bestVal = 0
    weekdayData.forEach((d, i) => {
      const sum = d.nfc + d.qr
      if (sum > bestVal) { bestVal = sum; best = i }
    })
    return best >= 0 && bestVal > 0 ? { label: WEEKDAYS[best], value: bestVal } : null
  }, [weekdayData])

  const branchRows: BranchRow[] = useMemo(() => {
    const map: Record<string, BranchRow> = {}
    events.forEach(e => {
      const id = e.branch_id
      if (!map[id]) {
        map[id] = {
          id,
          name: e.branches?.name ?? '—',
          company: e.branches?.companies?.name ?? '—',
          nfc: 0, qr: 0, total: 0, unique: 0, conversion: 0,
        }
      }
      const row = map[id]
      if (e.scan_type === 'nfc') row.nfc++
      else row.qr++
      row.total++
      if (e.is_unique) row.unique++
    })

    const q = search.trim().toLowerCase()
    return Object.values(map)
      .map(r => ({ ...r, conversion: pct(r.unique, r.total) }))
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.company.toLowerCase().includes(q))
      .sort((a, b) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]))
  }, [events, sortKey, sortAsc, search])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  function exportCsv() {
    downloadCsv(
      `birtapcard-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Филиал', 'Ресторан', 'NFC', 'QR', 'Всего', 'Уникальных', 'Конверсия %'],
      branchRows.map(r => [r.name, r.company, r.nfc, r.qr, r.total, r.unique, r.conversion]),
    )
    toast('Файл выгружен', { kind: 'success', desc: `${branchRows.length} строк в CSV` })
  }

  if (!profileLoaded) return <AnalyticsSkeleton />

  const chartHeight = isMobile ? 190 : 224

  return (
    <div className="stack">

      {/* ── Фильтры ───────────────────────────────────────────────────── */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
            { value: '90', label: '90 дней' },
            { value: 'custom', label: 'Период' },
          ]}
        />

        {range === 'custom' && (
          <div className="row" style={{ gap: 7 }}>
            <input
              className="input" type="date" value={customFrom} max={customTo}
              onChange={e => setCustomFrom(e.target.value)} style={{ width: 'auto' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <input
              className="input" type="date" value={customTo} min={customFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setCustomTo(e.target.value)} style={{ width: 'auto' }}
            />
          </div>
        )}

        {!isBranchManager && (
          <select
            className="select"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            style={{ width: 'auto', maxWidth: 280 }}
          >
            <option value="all">Все филиалы</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.company} — {b.name}</option>
            ))}
          </select>
        )}

        <div className="toolbar__spacer">
          <Button icon="download" onClick={exportCsv} disabled={branchRows.length === 0}>
            Экспорт CSV
          </Button>
        </div>
      </div>

      {/* ── KPI ───────────────────────────────────────────────────────── */}
      <div className="grid grid--kpi">
        {loading ? <KpiSkeleton /> : (
          <>
            <KpiCard
              label="Всего сканирований" icon="analytics" accent="mint"
              value={totalScans} sub={`За ${daysCount} дн.`}
            />
            <KpiCard
              label="Уникальных гостей" icon="user" accent="orange"
              value={uniqueTotal}
              sub={totalScans > 0 ? `${pct(uniqueTotal, totalScans)}% от всех сканов` : 'Нет данных'}
            />
            <KpiCard
              label="Сканов в день" icon="calendar" accent="blue"
              value={avgPerDay} sub={`NFC ${nf(nfcTotal)} · QR ${nf(qrTotal)}`}
            />
            <KpiCard
              label="Повторных визитов" icon="refresh" accent="purple"
              value={repeatRate} suffix="%" sub="Те же устройства повторно"
            />
          </>
        )}
      </div>

      {/* ── Почасовое + по дням недели ────────────────────────────────── */}
      <div className="grid grid--2">
        <Panel
          title="Почасовое распределение"
          sub="Когда чаще всего сканируют"
          action={peakHour && <Badge tone="mint"><Icon name="clock" size={11} /> пик {peakHour.label}</Badge>}
        >
          {loading ? <Skeleton h={chartHeight} r={12} /> : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={hourlyData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="hour" tickLine={false} axisLine={false} interval={isMobile ? 5 : 2}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(0, 2)}
                />
                <YAxis
                  tickLine={false} axisLine={false} allowDecimals={false} width={40}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                />
                <Tooltip
                  content={<ChartTooltip labels={{ nfc: 'NFC', qr: 'QR' }} />}
                  cursor={{ fill: 'var(--sheen)' }}
                />
                <Bar dataKey="nfc" stackId="a" fill="var(--mint)" name="nfc" maxBarSize={26} />
                <Bar dataKey="qr" stackId="a" fill="var(--orange)" name="qr" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          title="По дням недели"
          sub="Понедельник — воскресенье"
          action={peakDay && <Badge tone="blue"><Icon name="calendar" size={11} /> лучший {peakDay.label}</Badge>}
        >
          {loading ? <Skeleton h={chartHeight} r={12} /> : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={weekdayData} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis
                  tickLine={false} axisLine={false} allowDecimals={false} width={40}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                />
                <Tooltip
                  content={<ChartTooltip labels={{ nfc: 'NFC', qr: 'QR' }} />}
                  cursor={{ fill: 'var(--sheen)' }}
                />
                <Bar dataKey="nfc" stackId="a" fill="var(--mint)" name="nfc" maxBarSize={38} />
                <Bar dataKey="qr" stackId="a" fill="var(--orange)" name="qr" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <ChartLegend items={[
            { color: 'var(--mint)', label: 'NFC' },
            { color: 'var(--orange)', label: 'QR' },
          ]} />
        </Panel>
      </div>

      {/* ── Сравнение филиалов ────────────────────────────────────────── */}
      <Panel
        title="Сравнение филиалов"
        sub={`${branchRows.length} ${branchRows.length === 1 ? 'филиал' : 'филиалов'} за период`}
        action={
          <div style={{ width: isMobile ? 150 : 230 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Найти филиал…" />
          </div>
        }
      >
        {loading ? (
          <SkeletonRows rows={5} height={44} />
        ) : branchRows.length === 0 ? (
          <EmptyState
            icon="analytics"
            title="Нет данных за период"
            text="Попробуйте выбрать другой диапазон дат или снять фильтр по филиалу."
          />
        ) : isMobile ? (
          /* Мобильная версия таблицы — карточки */
          <div className="stack" style={{ gap: 10 }}>
            <div className="row row--wrap" style={{ gap: 6 }}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                <button
                  key={k}
                  className={`btn btn--sm btn--${sortKey === k ? 'outline' : 'ghost'}`}
                  onClick={() => toggleSort(k)}
                  style={sortKey === k ? { color: 'var(--mint)', borderColor: 'color-mix(in srgb, var(--mint) 40%, transparent)' } : undefined}
                >
                  {SORT_LABELS[k]}
                  {sortKey === k && <Icon name={sortAsc ? 'arrowUp' : 'arrowDown'} size={12} />}
                </button>
              ))}
            </div>

            {branchRows.map(r => (
              <div key={r.id} className="card" style={{ padding: 13 }}>
                <div className="row" style={{ marginBottom: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate" style={{ fontSize: 13.5, fontWeight: 650 }}>{r.name}</div>
                    <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.company}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{r.total}</span>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <Badge tone="mint">NFC {r.nfc}</Badge>
                  <Badge tone="orange">QR {r.qr}</Badge>
                  <Badge tone="blue">уник. {r.unique}</Badge>
                  <Badge tone="purple">{r.conversion}%</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Филиал</th>
                  <th>Ресторан</th>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={`ta-r is-sortable${sortKey === key ? ' is-active' : ''}`}
                    >
                      {SORT_LABELS[key]}
                      {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.company}</td>
                    <td className="ta-r mono">{r.nfc}</td>
                    <td className="ta-r mono">{r.qr}</td>
                    <td className="ta-r mono" style={{ fontWeight: 700 }}>{r.total}</td>
                    <td className="ta-r mono">{r.unique}</td>
                    <td className="ta-r mono" style={{ color: 'var(--mint)', fontWeight: 650 }}>{r.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
