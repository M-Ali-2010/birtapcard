/**
 * lib/telegram/reports.ts
 *
 * Сборка отчётов для Telegram за любой период.
 * Используется ежедневным кроном, кнопками «Сегодня / Аналитика» и выгрузкой.
 *
 * Отчёт собирается из трёх источников:
 *   scan_events     — касания карточки (NFC и QR)
 *   link_clicks     — куда гость нажал: Google, Яндекс, 2ГИС, Instagram, Telegram, бот
 *   review_snapshots — реальное число отзывов и рейтинг Google (снимок раз в сутки)
 *
 * Важно про честность цифр: Instagram и Telegram мы считаем ПЕРЕХОДАМИ,
 * а не подписчиками — сторонние площадки не отдают нам, кто именно подписался.
 * Отзывы Google, наоборот, настоящие: это разница между снимками review_snapshots.
 *
 * Все периоды считаются по ташкентскому времени (UTC+5), а не по UTC —
 * иначе «вчера» в отчёте начиналось бы в 5 утра.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { escapeMd } from '@/lib/telegram/bot'

export type ReportPeriod = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'prev_month' | 'custom'

/** Ташкент — UTC+5 круглый год, перехода на летнее время нет */
const TZ_OFFSET_MS = 5 * 60 * 60 * 1000

export interface ReportRange {
  start: Date
  end: Date
  label: string
}

/** Начало локальных суток (00:00 в Ташкенте), выраженное в UTC */
function localDayStart(ts: number): Date {
  const local = new Date(ts + TZ_OFFSET_MS)
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(midnightLocal - TZ_OFFSET_MS)
}

/** Локальная дата в формате 22.09 */
function fmtShort(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${String(local.getUTCDate()).padStart(2, '0')}.${String(local.getUTCMonth() + 1).padStart(2, '0')}`
}

function fmtDate(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MS)
  return local.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

/** Диапазоны стандартных периодов по ташкентскому времени */
export function getReportRange(period: ReportPeriod, customStart?: Date, customEnd?: Date): ReportRange {
  const now = Date.now()
  const todayStart = localDayStart(now)
  const dayMs = 86400000
  const todayEnd = new Date(todayStart.getTime() + dayMs - 1)

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd, label: 'Сегодня' }

    case 'yesterday': {
      const s = new Date(todayStart.getTime() - dayMs)
      return { start: s, end: new Date(s.getTime() + dayMs - 1), label: `Вчера, ${fmtShort(s)}` }
    }

    case '7d': {
      const s = new Date(todayStart.getTime() - 7 * dayMs)
      return { start: s, end: todayEnd, label: 'Последние 7 дней' }
    }

    case '30d': {
      const s = new Date(todayStart.getTime() - 30 * dayMs)
      return { start: s, end: todayEnd, label: 'Последние 30 дней' }
    }

    case 'month': {
      const local = new Date(now + TZ_OFFSET_MS)
      const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET_MS)
      return { start: s, end: todayEnd, label: 'Этот месяц' }
    }

    case 'prev_month': {
      const local = new Date(now + TZ_OFFSET_MS)
      const s = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1) - TZ_OFFSET_MS)
      const e = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TZ_OFFSET_MS - 1)
      const monthName = new Date(s.getTime() + TZ_OFFSET_MS)
        .toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      return { start: s, end: e, label: `Прошлый месяц (${monthName})` }
    }

    case 'custom':
      if (!customStart || !customEnd) throw new Error('Custom range requires start and end dates')
      return { start: customStart, end: customEnd, label: `${fmtDate(customStart)} — ${fmtDate(customEnd)}` }
  }
}

/** Диапазон такой же длины, стоящий вплотную перед данным — для сравнения */
export function previousRange(range: ReportRange): ReportRange {
  const span = range.end.getTime() - range.start.getTime()
  const end = new Date(range.start.getTime() - 1)
  return { start: new Date(range.start.getTime() - span - 1), end, label: 'предыдущий период' }
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%'
  return ((a / b) * 100).toFixed(0) + '%'
}

/** «+12» / «−3» / «» — короткая дельта рядом с числом */
function delta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '' : ''
  const d = current - previous
  if (d === 0) return ''
  return d > 0 ? ` (+${d})` : ` (−${Math.abs(d)})`
}

// ─── Типы данных отчёта ──────────────────────────────────────────────────────

export type ClickTarget = 'google' | 'yandex' | 'gis' | 'instagram' | 'telegram' | 'bot'

export const TARGET_LABEL: Record<ClickTarget, string> = {
  google: 'Google',
  yandex: 'Яндекс',
  gis: '2ГИС',
  instagram: 'Instagram',
  telegram: 'Telegram',
  bot: 'бот',
}

export interface BranchStats {
  branchId: string
  branchName: string
  nfc: number
  qr: number
  total: number
  unique: number
}

export interface ReviewStats {
  /** Новые отзывы Google за период — разница между снимками */
  gained: number
  /** Текущий рейтинг (средний по филиалам, взвешенный по числу отзывов) */
  rating: number | null
  /** Изменение рейтинга за период */
  ratingDelta: number | null
  /** Всего отзывов на конец периода */
  total: number
  /** Есть ли вообще снимки — если нет, раздел не показываем */
  known: boolean
}

export interface ReportData {
  label: string
  companyName: string
  nfc: number
  qr: number
  total: number
  unique: number
  googleReviews: number
  conversion: string
  bestBranch: BranchStats | null
  worstBranch: BranchStats | null
  branches: BranchStats[]
  prevTotal: number
  clicks: Record<ClickTarget, number>
  clicksTotal: number
  reviews: ReviewStats
}

const EMPTY_CLICKS: Record<ClickTarget, number> = {
  google: 0, yandex: 0, gis: 0, instagram: 0, telegram: 0, bot: 0,
}

// ─── Отзывы Google из снимков ────────────────────────────────────────────────

/**
 * Прирост отзывов = (последний снимок в периоде) − (последний снимок ДО периода).
 * Снимок снимается раз в сутки, поэтому берём с запасом в 3 дня назад:
 * если сутки пропущены, база сравнения всё равно найдётся.
 */
async function fetchReviewStats(
  supabase: SupabaseClient,
  branchIds: string[],
  range: ReportRange
): Promise<ReviewStats> {
  const lookback = new Date(range.start.getTime() - 3 * 86400000).toISOString()

  const { data: snaps } = await supabase
    .from('review_snapshots')
    .select('branch_id, rating, review_count, captured_at')
    .in('branch_id', branchIds)
    .gte('captured_at', lookback)
    .lte('captured_at', range.end.toISOString())
    .order('captured_at', { ascending: true })
    .limit(5000)

  if (!snaps?.length) {
    return { gained: 0, rating: null, ratingDelta: null, total: 0, known: false }
  }

  // По каждому филиалу: последний снимок до начала периода и последний внутри
  const before = new Map<string, { count: number; rating: number | null }>()
  const after = new Map<string, { count: number; rating: number | null }>()

  for (const s of snaps) {
    const at = new Date(s.captured_at).getTime()
    const row = { count: s.review_count ?? 0, rating: s.rating === null ? null : Number(s.rating) }
    if (at < range.start.getTime()) before.set(s.branch_id, row)
    else after.set(s.branch_id, row)
  }

  let gained = 0
  let total = 0
  let ratingSum = 0
  let ratingWeight = 0
  let prevRatingSum = 0
  let prevRatingWeight = 0

  for (const branchId of branchIds) {
    const end = after.get(branchId) ?? before.get(branchId)
    const start = before.get(branchId)
    if (!end) continue

    total += end.count
    if (start) gained += Math.max(0, end.count - start.count)

    if (end.rating !== null && end.count > 0) {
      ratingSum += end.rating * end.count
      ratingWeight += end.count
    }
    if (start?.rating != null && start.count > 0) {
      prevRatingSum += start.rating * start.count
      prevRatingWeight += start.count
    }
  }

  const rating = ratingWeight > 0 ? ratingSum / ratingWeight : null
  const prevRating = prevRatingWeight > 0 ? prevRatingSum / prevRatingWeight : null
  const ratingDelta = rating !== null && prevRating !== null ? rating - prevRating : null

  return { gained, rating, ratingDelta, total, known: true }
}

// ─── Сбор данных ─────────────────────────────────────────────────────────────

export async function fetchCompanyReport(
  supabase: SupabaseClient,
  companyId: string,
  range: ReportRange,
  prevRange?: ReportRange
): Promise<ReportData | null> {
  const { data: company } = await supabase.from('companies').select('name').eq('id', companyId).single()
  if (!company) return null

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('active', true)

  if (!branches?.length) return null
  const branchIds = branches.map(b => b.id)

  const [{ data: events }, { data: clickRows }, reviews] = await Promise.all([
    supabase
      .from('scan_events')
      .select('branch_id, scan_type, is_unique')
      .in('branch_id', branchIds)
      .gte('scanned_at', range.start.toISOString())
      .lte('scanned_at', range.end.toISOString())
      .limit(20000),
    supabase
      .from('link_clicks')
      .select('target')
      .in('branch_id', branchIds)
      .gte('clicked_at', range.start.toISOString())
      .lte('clicked_at', range.end.toISOString())
      .limit(20000),
    fetchReviewStats(supabase, branchIds, range),
  ])

  const ev = events ?? []

  const branchMap = new Map<string, BranchStats>()
  for (const b of branches) {
    branchMap.set(b.id, { branchId: b.id, branchName: b.name, nfc: 0, qr: 0, total: 0, unique: 0 })
  }
  for (const e of ev) {
    const bs = branchMap.get(e.branch_id)
    if (!bs) continue
    bs.total++
    if (e.scan_type === 'nfc') bs.nfc++
    else if (e.scan_type === 'qr') bs.qr++
    if (e.is_unique) bs.unique++
  }

  const branchStats = Array.from(branchMap.values())
  const sorted = [...branchStats].sort((a, b) => b.total - a.total)
  const bestBranch = sorted[0]?.total > 0 ? sorted[0] : null
  const worstBranch = sorted.length > 1 && sorted[sorted.length - 1].total < sorted[0].total
    ? sorted[sorted.length - 1]
    : null

  const clicks = { ...EMPTY_CLICKS }
  for (const c of clickRows ?? []) {
    const t = c.target as ClickTarget
    if (t in clicks) clicks[t]++
  }
  const clicksTotal = Object.values(clicks).reduce((a, b) => a + b, 0)

  let prevTotal = 0
  if (prevRange) {
    const { count } = await supabase
      .from('scan_events')
      .select('id', { count: 'exact', head: true })
      .in('branch_id', branchIds)
      .gte('scanned_at', prevRange.start.toISOString())
      .lte('scanned_at', prevRange.end.toISOString())
    prevTotal = count ?? 0
  }

  const total = ev.length

  return {
    label: range.label,
    companyName: company.name,
    nfc: ev.filter(e => e.scan_type === 'nfc').length,
    qr: ev.filter(e => e.scan_type === 'qr').length,
    total,
    unique: ev.filter(e => e.is_unique).length,
    googleReviews: reviews.gained,
    conversion: pct(clicksTotal, total),
    bestBranch,
    worstBranch,
    branches: branchStats,
    prevTotal,
    clicks,
    clicksTotal,
    reviews,
  }
}

// ─── Форматирование ──────────────────────────────────────────────────────────

/** Строка переходов: только те площадки, по которым были нажатия */
function clicksLine(clicks: Record<ClickTarget, number>): string | null {
  const parts = (Object.keys(TARGET_LABEL) as ClickTarget[])
    .filter(t => clicks[t] > 0)
    .sort((a, b) => clicks[b] - clicks[a])
    .map(t => `${TARGET_LABEL[t]} ${clicks[t]}`)
  return parts.length ? parts.join(' · ') : null
}

/**
 * Короткий отчёт: что произошло, одним экраном без прокрутки.
 * Пустые разделы не показываем — молчание лучше нулей в столбик.
 */
export function formatReport(data: ReportData): string {
  const lines: string[] = [
    `📊 *BirTapCard · ${data.label}*`,
    `🏪 ${escapeMd(data.companyName)}`,
    '',
  ]

  if (data.total === 0 && data.clicksTotal === 0 && data.reviews.gained === 0) {
    lines.push('_Касаний не было._')
    return lines.join('\n')
  }

  lines.push(`👆 Касаний: *${data.total}*${delta(data.total, data.prevTotal)}` +
    (data.total > 0 ? `  _(NFC ${data.nfc} · QR ${data.qr})_` : ''))

  if (data.reviews.known) {
    const r = data.reviews
    let line = `⭐ Новых отзывов Google: *${r.gained}*`
    if (r.rating !== null) {
      const d = r.ratingDelta !== null && Math.abs(r.ratingDelta) >= 0.05
        ? ` (${r.ratingDelta > 0 ? '+' : '−'}${Math.abs(r.ratingDelta).toFixed(1)})`
        : ''
      line += `  _рейтинг ${r.rating.toFixed(1)}${d}_`
    }
    lines.push(line)
  }

  const cl = clicksLine(data.clicks)
  if (cl) {
    lines.push('')
    lines.push(`👉 Переходы: *${data.clicksTotal}* из ${data.total}  _(${data.conversion})_`)
    lines.push(`   ${cl}`)
  }

  if (data.bestBranch && data.branches.length > 1) {
    lines.push('')
    lines.push(`🏆 Лучшая точка: *${escapeMd(data.bestBranch.branchName)}* — ${data.bestBranch.total}`)
    if (data.worstBranch) {
      lines.push(`📉 Слабее всех: ${escapeMd(data.worstBranch.branchName)} — ${data.worstBranch.total}`)
    }
  }

  return lines.join('\n')
}

// ─── Готовые отчёты по ролям ─────────────────────────────────────────────────

export async function fetchOwnerReport(
  supabase: SupabaseClient,
  companyId: string,
  range: ReportRange
): Promise<string | null> {
  const data = await fetchCompanyReport(supabase, companyId, range, previousRange(range))
  if (!data) return null
  return formatReport(data)
}

export async function fetchBranchReport(
  supabase: SupabaseClient,
  branchId: string,
  range: ReportRange
): Promise<string | null> {
  const { data: branch } = await supabase
    .from('branches')
    .select('name, companies(name)')
    .eq('id', branchId)
    .single()

  if (!branch) return null

  const [{ data: events }, { data: clickRows }, reviews] = await Promise.all([
    supabase
      .from('scan_events')
      .select('scan_type, is_unique')
      .eq('branch_id', branchId)
      .gte('scanned_at', range.start.toISOString())
      .lte('scanned_at', range.end.toISOString())
      .limit(20000),
    supabase
      .from('link_clicks')
      .select('target')
      .eq('branch_id', branchId)
      .gte('clicked_at', range.start.toISOString())
      .lte('clicked_at', range.end.toISOString())
      .limit(20000),
    fetchReviewStats(supabase, [branchId], range),
  ])

  const ev = events ?? []
  const clicks = { ...EMPTY_CLICKS }
  for (const c of clickRows ?? []) {
    const t = c.target as ClickTarget
    if (t in clicks) clicks[t]++
  }
  const clicksTotal = Object.values(clicks).reduce((a, b) => a + b, 0)

  const companies = branch.companies as { name: string }[] | { name: string } | null
  const companyName = (Array.isArray(companies) ? companies[0]?.name : companies?.name) ?? ''

  const lines = [
    `📊 *BirTapCard · ${range.label}*`,
    `🏪 ${escapeMd(companyName)} — ${escapeMd(branch.name)}`,
    '',
  ]

  if (ev.length === 0 && clicksTotal === 0) {
    lines.push('_Касаний не было._')
    return lines.join('\n')
  }

  lines.push(`👆 Касаний: *${ev.length}*  _(NFC ${ev.filter(e => e.scan_type === 'nfc').length} · QR ${ev.filter(e => e.scan_type === 'qr').length})_`)
  if (reviews.known) {
    lines.push(`⭐ Новых отзывов Google: *${reviews.gained}*` +
      (reviews.rating !== null ? `  _рейтинг ${reviews.rating.toFixed(1)}_` : ''))
  }
  const cl = clicksLine(clicks)
  if (cl) {
    lines.push('')
    lines.push(`👉 Переходы: *${clicksTotal}* из ${ev.length}  _(${pct(clicksTotal, ev.length)})_`)
    lines.push(`   ${cl}`)
  }

  return lines.join('\n')
}
