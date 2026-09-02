'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useIsMobile, useProfile, usePersistentState } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { nf, pct, relTime } from '@/lib/format'
import { Icon } from '@/components/ui/icons'
import { ChartLegend, ChartTooltip, Donut } from '@/components/ui/charts'
import {
  Badge, Button, EmptyState, IconButton, KpiCard, KpiSkeleton,
  Panel, Segmented, Skeleton, SkeletonRows,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type ScanEvent = {
  id: string
  branch_id: string
  scan_type: string
  device: string
  browser_lang: string
  is_unique: boolean
  scanned_at: string
  branches?: { name: string; companies?: { name: string } | null } | null
}

type DayPoint = { day: string; nfc: number; qr: number; total: number }
type Slice = { name: string; value: number; color: string }
type BranchStat = { name: string; company: string; scans: number }

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Мобильный', desktop: 'Десктоп', tablet: 'Планшет', unknown: 'Неизвестно',
}
const DEVICE_COLORS: Record<string, string> = {
  mobile: 'var(--mint)', desktop: 'var(--blue)', tablet: 'var(--orange)', unknown: 'var(--text-muted)',
}
const LANG_NAMES: Record<string, string> = {
  ru: 'Русский', uz: 'Узбекский', en: 'Английский', kk: 'Казахский',
}
const LANG_COLORS = ['var(--purple)', 'var(--blue)', 'var(--orange)', 'var(--mint)', 'var(--text-muted)']

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { profile, loaded: profileLoaded, role } = useProfile()
  const isMobile = useIsMobile()
  const { toast } = useToast()

  const [events, setEvents] = useState<ScanEvent[]>([])
  const [dayData, setDayData] = useState<DayPoint[]>([])
  const [deviceData, setDeviceData] = useState<Slice[]>([])
  const [langData, setLangData] = useState<Slice[]>([])
  const [topBranches, setTopBranches] = useState<BranchStat[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [aiText, setAiText] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [tab, setTab] = usePersistentState<'7' | '30' | '90'>('btc-dash-range', '7')
  const [live, setLive] = usePersistentState<boolean>('btc-dash-live', false)

  /* ── Показатели за сегодня / вчера ────────────────────────────────────── */

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const todayNfc   = events.filter(e => e.scanned_at.startsWith(todayStr) && e.scan_type === 'nfc').length
  const todayQr    = events.filter(e => e.scanned_at.startsWith(todayStr) && e.scan_type === 'qr').length
  const todayUniq  = events.filter(e => e.scanned_at.startsWith(todayStr) && e.is_unique).length
  const todayTotal = todayNfc + todayQr
  const conversion = pct(todayUniq, todayTotal)
  const yestNfc    = events.filter(e => e.scanned_at.startsWith(yesterdayStr) && e.scan_type === 'nfc').length
  const yestQr     = events.filter(e => e.scanned_at.startsWith(yesterdayStr) && e.scan_type === 'qr').length
  const yestUniq   = events.filter(e => e.scanned_at.startsWith(yesterdayStr) && e.is_unique).length

  /* ── Загрузка данных (фильтрация по роли сохранена) ───────────────────── */

  const loadData = useCallback(async (silent = false) => {
    if (!profileLoaded || !profile) return
    if (!silent) setLoading(true)

    const supabase = createClient()
    const days = parseInt(tab)
    const since = new Date(Date.now() - days * 86400000).toISOString()

    let query = supabase
      .from('scan_events')
      .select('id, branch_id, scan_type, device, browser_lang, is_unique, scanned_at, branches(name, companies(name))')
      .gte('scanned_at', since)
      .order('scanned_at', { ascending: false })
      .limit(500)

    if (profile.role === 'branch_manager' && profile.branch_id) {
      // Менеджер видит только свой филиал
      query = query.eq('branch_id', profile.branch_id)
    } else if (profile.role === 'owner' && profile.company_id) {
      // Владелец — все филиалы своей компании (RLS дублирует ограничение)
      const { data: branchIds } = await supabase
        .from('branches')
        .select('id')
        .eq('company_id', profile.company_id)
      const ids = (branchIds ?? []).map((b: { id: string }) => b.id)
      if (ids.length > 0) {
        query = query.in('branch_id', ids)
      } else {
        setEvents([]); setDayData([]); setDeviceData([]); setLangData([]); setTopBranches([])
        setLoading(false)
        return
      }
    }
    // super_admin — без фильтра

    const { data: rawEvents } = await query
    const ev: ScanEvent[] = (rawEvents as ScanEvent[] | null) ?? []
    setEvents(ev)

    // По дням
    const byDay: Record<string, { nfc: number; qr: number }> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      byDay[d] = { nfc: 0, qr: 0 }
    }
    ev.forEach(e => {
      const d = e.scanned_at.slice(0, 10)
      if (byDay[d]) {
        if (e.scan_type === 'nfc') byDay[d].nfc++
        else byDay[d].qr++
      }
    })
    setDayData(Object.entries(byDay).map(([day, v]) => ({
      day: day.slice(5).split('-').reverse().join('.'),
      nfc: v.nfc, qr: v.qr, total: v.nfc + v.qr,
    })))

    // Устройства
    const devCount: Record<string, number> = {}
    ev.forEach(e => { devCount[e.device] = (devCount[e.device] ?? 0) + 1 })
    setDeviceData(
      Object.entries(devCount)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({
          name: DEVICE_LABELS[k] ?? k,
          value: v,
          color: DEVICE_COLORS[k] ?? 'var(--purple)',
        }))
    )

    // Языки
    const langCount: Record<string, number> = {}
    ev.forEach(e => {
      const l = (e.browser_lang ?? 'unknown').split('-')[0].toLowerCase()
      langCount[l] = (langCount[l] ?? 0) + 1
    })
    setLangData(
      Object.entries(langCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v], i) => ({ name: LANG_NAMES[k] ?? k.toUpperCase(), value: v, color: LANG_COLORS[i] }))
    )

    // Топ филиалов
    const branchCount: Record<string, { name: string; company: string; count: number }> = {}
    ev.forEach(e => {
      const id = e.branch_id
      if (!branchCount[id]) {
        branchCount[id] = {
          name: e.branches?.name ?? '—',
          company: e.branches?.companies?.name ?? '—',
          count: 0,
        }
      }
      branchCount[id].count++
    })
    setTopBranches(
      Object.values(branchCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(v => ({ name: v.name, company: v.company, scans: v.count }))
    )

    setUpdatedAt(new Date())
    setLoading(false)
  }, [tab, profile, profileLoaded])

  useEffect(() => { if (profileLoaded) loadData() }, [loadData, profileLoaded])

  // Обновление из шапки / палитры команд / жеста «потяните вниз»
  useEffect(() => {
    const handler = () => loadData(true)
    window.addEventListener(REFRESH_EVENT, handler)
    return () => window.removeEventListener(REFRESH_EVENT, handler)
  }, [loadData])

  // Живой режим: тихое обновление раз в минуту
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => loadData(true), 60000)
    return () => clearInterval(id)
  }, [live, loadData])

  /* ── AI-инсайты ──────────────────────────────────────────────────────── */

  async function loadAi() {
    setAiLoading(true)
    setAiText(null)
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayNfc, todayQr, todayUniq, conversion,
          topBranches: topBranches.slice(0, 3),
          totalDays: tab,
        }),
      })
      const json = await res.json()
      setAiText(json.text ?? 'Нет данных для анализа.')
    } catch {
      setAiText('Ошибка при загрузке инсайтов. Попробуйте позже.')
    }
    setAiLoading(false)
  }

  const sparkNfc = useMemo(() => dayData.map(d => d.nfc), [dayData])
  const sparkQr = useMemo(() => dayData.map(d => d.qr), [dayData])
  const sparkTotal = useMemo(() => dayData.map(d => d.total), [dayData])
  const maxBranch = Math.max(...topBranches.map(b => b.scans), 1)
  const periodTotal = dayData.reduce((s, d) => s + d.total, 0)

  if (!profileLoaded) {
    return (
      <div className="stack">
        <div className="grid grid--kpi"><KpiSkeleton /></div>
        <Skeleton h={280} r={18} />
      </div>
    )
  }

  return (
    <div className="stack">

      {/* ── Период + живой режим ──────────────────────────────────────── */}
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: '7', label: '7 дней' },
            { value: '30', label: '30 дней' },
            { value: '90', label: '90 дней' },
          ]}
        />

        <div className="toolbar__spacer row" style={{ gap: 8 }}>
          {updatedAt && (
            <span className="hide-xs" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              обновлено {updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className={`btn btn--${live ? 'outline' : 'ghost'}`}
            onClick={() => {
              setLive(v => !v)
              toast(live ? 'Живой режим выключен' : 'Живой режим включён', {
                kind: 'info',
                desc: live ? undefined : 'Данные обновляются каждую минуту',
              })
            }}
            style={live ? { color: 'var(--success)', borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)' } : undefined}
            title="Автообновление раз в минуту"
          >
            {live ? <span className="live-dot" /> : <Icon name="zap" size={15} />}
            Live
          </button>
        </div>
      </div>

      {/* ── KPI ───────────────────────────────────────────────────────── */}
      <div className="grid grid--kpi">
        {loading ? <KpiSkeleton /> : (
          <>
            <KpiCard
              label="NFC сканы" icon="nfc" accent="mint"
              value={todayNfc} spark={sparkNfc}
              delta={{ value: todayNfc - yestNfc, label: 'vs вчера' }}
            />
            <KpiCard
              label="QR сканы" icon="qrcodes" accent="orange"
              value={todayQr} spark={sparkQr}
              delta={{ value: todayQr - yestQr, label: 'vs вчера' }}
            />
            <KpiCard
              label="Уникальных" icon="user" accent="blue"
              value={todayUniq} spark={sparkTotal}
              delta={{ value: todayUniq - yestUniq, label: 'vs вчера' }}
            />
            <KpiCard
              label="Конверсия" icon="target" accent="purple"
              value={conversion} suffix="%"
              sub={`${nf(todayUniq)} из ${nf(todayTotal)} сканов сегодня`}
            />
          </>
        )}
      </div>

      {/* ── AI-инсайты (super_admin и owner) ──────────────────────────── */}
      {(role === 'super_admin' || role === 'owner') && (
        <div className="spotlight">
          <div className="row row--wrap" style={{ marginBottom: 12, position: 'relative' }}>
            <span
              className="badge"
              style={{
                background: 'linear-gradient(135deg, var(--mint), var(--blue))',
                color: '#04121C', fontWeight: 800, letterSpacing: 0.4,
              }}
            >
              <Icon name="sparkles" size={12} strokeWidth={2.2} /> AI INSIGHTS
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 650 }}>Анализ за сегодня</span>
            <div className="toolbar__spacer row" style={{ gap: 8 }}>
              {aiText && !aiLoading && (
                <IconButton
                  icon="copy" title="Скопировать" small
                  onClick={() => {
                    navigator.clipboard?.writeText(aiText.replace(/\*\*/g, ''))
                    toast('Инсайты скопированы', { kind: 'success' })
                  }}
                />
              )}
              <Button
                size="sm"
                variant={aiText ? 'ghost' : 'primary'}
                icon={aiText ? 'refresh' : 'sparkles'}
                loading={aiLoading}
                onClick={loadAi}
              >
                {aiLoading ? 'Анализирую…' : aiText ? 'Обновить' : 'Анализировать'}
              </Button>
            </div>
          </div>

          <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-dim)', position: 'relative' }}>
            {aiLoading ? (
              <span style={{ color: 'var(--text-muted)' }}>
                Изучаю статистику
                <span style={{ display: 'inline-flex', gap: 4, marginLeft: 7 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 4, height: 4, borderRadius: '50%', background: 'var(--mint)',
                      display: 'inline-block', animation: `blink 1.4s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </span>
              </span>
            ) : aiText ? (
              <span dangerouslySetInnerHTML={{
                __html: aiText.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text)">$1</strong>'),
              }} />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Нажмите «Анализировать» — AI изучит статистику и даст рекомендации по улучшению конверсии.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── График + топ филиалов ─────────────────────────────────────── */}
      <div className="grid grid--main">
        <Panel
          title="Сканирования по дням"
          sub={`За последние ${tab} дней · всего ${nf(periodTotal)}`}
        >
          {loading ? (
            <Skeleton h={isMobile ? 190 : 224} r={12} />
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 190 : 224}>
              <AreaChart data={dayData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNfc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gQr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--orange)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="day" tickLine={false} axisLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                  interval="preserveStartEnd" minTickGap={18}
                />
                <YAxis
                  tickLine={false} axisLine={false} width={44} allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
                />
                <Tooltip
                  content={<ChartTooltip labels={{ nfc: 'NFC', qr: 'QR' }} />}
                  cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                />
                <Area
                  type="monotone" dataKey="nfc" name="nfc"
                  stroke="var(--mint)" strokeWidth={2.2} fill="url(#gNfc)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone" dataKey="qr" name="qr"
                  stroke="var(--orange)" strokeWidth={2.2} fill="url(#gQr)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <ChartLegend items={[
            { color: 'var(--mint)', label: 'NFC' },
            { color: 'var(--orange)', label: 'QR' },
          ]} />
        </Panel>

        <Panel title="Топ филиалов" sub="По количеству сканов">
          {loading ? (
            <SkeletonRows rows={4} height={42} />
          ) : topBranches.length === 0 ? (
            <EmptyState icon="branches" title="Нет данных" text="За выбранный период сканирований не было." />
          ) : (
            topBranches.map((b, i) => (
              <div key={`${b.name}-${i}`} className="row" style={{ padding: '10px 0', gap: 12, borderBottom: i < topBranches.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <span
                  className="mono"
                  style={{
                    width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center',
                    fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                    background: i === 0 ? 'var(--mint-dim)' : 'var(--card2)',
                    color: i === 0 ? 'var(--mint)' : 'var(--text-muted)',
                  }}
                >
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</div>
                  <div className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{b.company}</div>
                  <div className="bar">
                    <div className="bar__fill" style={{ width: `${Math.round((b.scans / maxBranch) * 100)}%` }} />
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{b.scans}</span>
              </div>
            ))
          )}
        </Panel>
      </div>

      {/* ── Устройства · языки · лента ────────────────────────────────── */}
      <div className="grid grid--3">
        <Panel title="Устройства" sub="Распределение сканов">
          {loading ? <Skeleton h={120} r={12} />
            : deviceData.length === 0
              ? <EmptyState icon="device" title="Нет данных" />
              : <Donut data={deviceData} centerLabel="сканов" />}
        </Panel>

        <Panel title="Языки" sub="Язык браузера гостя">
          {loading ? <Skeleton h={120} r={12} />
            : langData.length === 0
              ? <EmptyState icon="globe" title="Нет данных" />
              : <Donut data={langData} centerLabel="сканов" />}
        </Panel>

        <Panel
          title="Последние события"
          sub="В реальном времени"
          action={live ? <Badge tone="success" dot>live</Badge> : undefined}
        >
          {loading ? (
            <SkeletonRows rows={4} height={38} />
          ) : events.length === 0 ? (
            <EmptyState icon="zap" title="Событий пока нет" />
          ) : (
            events.slice(0, 6).map(e => {
              const isNfc = e.scan_type === 'nfc'
              return (
                <div key={e.id} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span
                    className="dot"
                    style={{ marginTop: 6, background: isNfc ? 'var(--mint)' : 'var(--orange)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {e.branches?.name ?? '—'}
                      </span>
                      <Badge tone={isNfc ? 'mint' : 'orange'}>{isNfc ? 'NFC' : 'QR'}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {DEVICE_LABELS[e.device] ?? e.device} · {e.is_unique ? 'уникальный' : 'повтор'}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {relTime(e.scanned_at)}
                  </span>
                </div>
              )
            })
          )}
        </Panel>
      </div>
    </div>
  )
}
