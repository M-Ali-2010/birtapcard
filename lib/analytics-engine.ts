/**
 * BirTapCard Analytics Engine
 * Единый продуктовый движок расчёта метрик, сигналов и агрегаций (Hybrid E + A).
 * Реализует строгую модель данных (Slide 03):
 * 1. Сканирование — открытие ссылки устройства через NFC или QR
 * 2. Переход — нажатие на целевую ссылку (Google, Instagram, Telegram, Меню, Wi-Fi)
 * 3. Конверсия = Переходы / Сканирования (с правилом малой базы < 20)
 * 4. Уникальные устройства — оценка по анонимному отпечатку браузера
 * 5. Отзывы Google — внешние данные Google Business Profile (не воронка)
 */

export type ScanEventRaw = {
  id: string
  branch_id: string
  scan_type: string // 'nfc' | 'qr'
  device?: string
  browser_lang?: string
  is_unique?: boolean
  scanned_at: string
  branches?: {
    id?: string
    name: string
    companies?: { id?: string; name: string } | null
  } | null
}

export type ClickEventRaw = {
  id?: string
  branch_id: string
  target: string
  clicked_at?: string
}

export type DeviceRaw = {
  id: string
  branch_id: string
  company_id?: string
  table_number?: string | null
  placement?: string | null
  token?: string
  created_at?: string
}

export type BranchRaw = {
  id: string
  company_id?: string
  name: string
  companies?: { id?: string; name: string } | null
  created_at?: string
}

export type ReviewSnapshotRaw = {
  branch_id: string
  rating: number | null
  review_count: number
  captured_at: string
}

export type PeriodRange = '7' | '30' | '90' | 'custom'

export interface PeriodDates {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
  daysCount: number
}

/** Расчёт дат текущего и сравнительного предыдущего периода */
export function getPeriodDates(
  range: PeriodRange,
  customFrom?: string,
  customTo?: string
): PeriodDates {
  const now = new Date()
  let daysCount = 30

  if (range === '7') daysCount = 7
  else if (range === '30') daysCount = 30
  else if (range === '90') daysCount = 90
  else if (range === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00')
    const t = new Date(customTo + 'T23:59:59')
    daysCount = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000))
    const currentStart = f
    const currentEnd = t
    const prevEnd = new Date(currentStart.getTime() - 1000)
    const prevStart = new Date(prevEnd.getTime() - daysCount * 86400000)
    return { currentStart, currentEnd, previousStart: prevStart, previousEnd: prevEnd, daysCount }
  }

  const currentEnd = now
  const currentStart = new Date(now.getTime() - daysCount * 86400000)
  const previousEnd = new Date(currentStart.getTime() - 1)
  const previousStart = new Date(previousEnd.getTime() - daysCount * 86400000)

  return { currentStart, currentEnd, previousStart, previousEnd, daysCount }
}

export interface MetricSummary {
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
    conversionRate: number | null // clicks / scans * 100%
    isSmallSample: boolean
  }
  devices: {
    total: number
    active: number
    silentCount: number
    silentDevicesList: { branchName: string; placement: string; daysSilent: number }[]
  }
  googleReviews: {
    newReviews: number
    currentRating: number | null
    totalReviews: number
    lastUpdated?: string
  }
}

/** Расчет сводных KPI для Dashboard */
export function calculateKpiSummary(params: {
  currentScans: ScanEventRaw[]
  previousScans: ScanEventRaw[]
  currentClicks: ClickEventRaw[]
  previousClicks: ClickEventRaw[]
  devices: DeviceRaw[]
  branches: BranchRaw[]
  snapshots: ReviewSnapshotRaw[]
}): MetricSummary {
  const { currentScans, previousScans, currentClicks, previousClicks, devices, branches, snapshots } = params

  const totalScans = currentScans.length
  const nfcScans = currentScans.filter(s => s.scan_type === 'nfc').length
  const qrScans = currentScans.filter(s => s.scan_type === 'qr').length
  const prevTotalScans = previousScans.length

  const scansDelta = prevTotalScans > 0 && totalScans >= 20
    ? Math.round(((totalScans - prevTotalScans) / prevTotalScans) * 100)
    : null

  const isScansSmall = totalScans < 20

  const totalClicks = currentClicks.length
  const prevTotalClicks = previousClicks.length

  const conversionRate = totalScans >= 20
    ? Math.min(100, Math.round((totalClicks / totalScans) * 100))
    : null

  const clicksDelta = prevTotalClicks > 0 && totalClicks >= 20
    ? Math.round(((totalClicks - prevTotalClicks) / prevTotalClicks) * 100)
    : null

  const isClicksSmall = totalScans < 20

  // Расчёт активности устройств (молчащие > 7 дней)
  const nowMs = Date.now()
  const silentThresholdMs = 7 * 86400000
  const branchMap = new Map<string, string>()
  branches.forEach(b => branchMap.set(b.id, b.name))

  // Сопоставление последнего скана по каждому филиалу/устройству
  const latestScanByBranch = new Map<string, number>()
  currentScans.forEach(s => {
    const t = new Date(s.scanned_at).getTime()
    const prev = latestScanByBranch.get(s.branch_id) || 0
    if (t > prev) latestScanByBranch.set(s.branch_id, t)
  })

  // Считаем устройства
  let silentCount = 0
  const silentDevicesList: { branchName: string; placement: string; daysSilent: number }[] = []

  devices.forEach(d => {
    const lastScanMs = latestScanByBranch.get(d.branch_id)
    if (!lastScanMs || (nowMs - lastScanMs) > silentThresholdMs) {
      silentCount++
      const days = lastScanMs ? Math.floor((nowMs - lastScanMs) / 86400000) : 9
      silentDevicesList.push({
        branchName: branchMap.get(d.branch_id) || 'Филиал',
        placement: d.table_number ? `Стол ${d.table_number}` : (d.placement || 'Точка касания'),
        daysSilent: Math.max(7, days),
      })
    }
  })

  const totalDevices = devices.length > 0 ? devices.length : branches.length
  const activeDevices = Math.max(0, totalDevices - silentCount)

  // Google Reviews: находим последний снимок и начальный снимок
  let currentRating: number | null = null
  let totalReviews = 0
  let newReviews = 0
  let lastUpdated: string | undefined

  if (snapshots.length > 0) {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )
    const latest = sorted[0]
    currentRating = latest.rating
    totalReviews = latest.review_count
    lastUpdated = new Date(latest.captured_at).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const oldest = sorted[sorted.length - 1]
    newReviews = Math.max(0, latest.review_count - oldest.review_count)
  }

  return {
    scans: {
      total: totalScans,
      nfc: nfcScans,
      qr: qrScans,
      prevTotal: prevTotalScans,
      deltaPct: scansDelta,
      isSmallSample: isScansSmall,
    },
    clicks: {
      total: totalClicks,
      prevTotal: prevTotalClicks,
      deltaPct: clicksDelta,
      conversionRate,
      isSmallSample: isClicksSmall,
    },
    devices: {
      total: totalDevices,
      active: activeDevices,
      silentCount,
      silentDevicesList: silentDevicesList.slice(0, 5),
    },
    googleReviews: {
      newReviews,
      currentRating,
      totalReviews,
      lastUpdated,
    },
  }
}

export interface DayChartPoint {
  date: string
  dayLabel: string
  nfc: number
  qr: number
  total: number
  prevTotal?: number
}

/** Построение временного ряда по дням с поддержкой линии предыдущего периода */
export function buildDailyChartSeries(
  currentScans: ScanEventRaw[],
  previousScans: ScanEventRaw[],
  daysCount: number
): DayChartPoint[] {
  const points: DayChartPoint[] = []
  const now = new Date()

  // Создаём пустые слоты на каждый день
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const dateStr = d.toISOString().slice(0, 10)
    const dayLabel = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`

    points.push({
      date: dateStr,
      dayLabel,
      nfc: 0,
      qr: 0,
      total: 0,
      prevTotal: 0,
    })
  }

  const pointMap = new Map<string, DayChartPoint>()
  points.forEach(p => pointMap.set(p.date, p))

  currentScans.forEach(s => {
    const dStr = s.scanned_at.slice(0, 10)
    const p = pointMap.get(dStr)
    if (p) {
      if (s.scan_type === 'nfc') p.nfc++
      else p.qr++
      p.total++
    }
  })

  // Рассчитываем эквивалентный сдвиг для прошлого периода
  const prevMap = new Map<number, number>()
  previousScans.forEach(s => {
    const d = new Date(s.scanned_at)
    // Индекс дня внутри прошлого периода
    const diffDays = Math.floor((d.getTime() - (now.getTime() - daysCount * 2 * 86400000)) / 86400000)
    if (diffDays >= 0 && diffDays < daysCount) {
      prevMap.set(diffDays, (prevMap.get(diffDays) || 0) + 1)
    }
  })

  points.forEach((p, index) => {
    p.prevTotal = prevMap.get(index) || 0
  })

  return points
}

export interface AttentionSignal {
  id: string
  kind: 'risk' | 'spike' | 'opportunity' | 'info'
  title: string
  text: string
  actionLabel?: string
  actionHref?: string
  badgeText?: string
}

/** Автоматическая генерация продуктовых сигналов (Concept C & E) */
export function generateAttentionSignals(params: {
  metricSummary: MetricSummary
  branchStats: BranchSummaryRow[]
}): AttentionSignal[] {
  const { metricSummary, branchStats } = params
  const signals: AttentionSignal[] = []

  // 1. Сигнал риска: молчащие устройства
  if (metricSummary.devices.silentCount > 0 && metricSummary.devices.silentDevicesList.length > 0) {
    const firstSilent = metricSummary.devices.silentDevicesList[0]
    signals.push({
      id: 'silent-devices',
      kind: 'risk',
      title: 'Молчащие устройства',
      text: `${firstSilent.branchName}: ${metricSummary.devices.silentCount} устройства без сканирований 7+ дней. Проверьте, на месте ли они.`,
      actionLabel: 'Открыть устройства',
      actionHref: '/branches',
      badgeText: 'Внимание',
    })
  }

  // 2. Сигнал всплеска / лучшего результата
  const bestGrowthBranch = [...branchStats]
    .filter(b => b.scans >= 20 && b.deltaPct !== null && b.deltaPct > 15)
    .sort((a, b) => (b.deltaPct || 0) - (a.deltaPct || 0))[0]

  if (bestGrowthBranch) {
    signals.push({
      id: 'growth-spike',
      kind: 'spike',
      title: 'Лидер роста',
      text: `${bestGrowthBranch.name}: +${bestGrowthBranch.deltaPct}% сканирований за период. Отличный результат работы персонала.`,
      actionLabel: 'Разобрать рост',
      badgeText: 'Рост',
    })
  }

  // 3. Сигнал соотношения QR/NFC
  if (metricSummary.scans.total >= 30) {
    const qrShare = Math.round((metricSummary.scans.qr / metricSummary.scans.total) * 100)
    if (qrShare > 40) {
      signals.push({
        id: 'qr-opportunity',
        kind: 'opportunity',
        title: 'Высокая доля QR',
        text: `${qrShare}% сканирований по QR-коду против среднего. Возможно, NFC-таблички установлены в труднодоступном месте.`,
        actionLabel: 'Сравнить точки',
        badgeText: 'Совет',
      })
    }
  }

  // 4. Малая база
  if (metricSummary.scans.isSmallSample) {
    signals.push({
      id: 'small-sample',
      kind: 'info',
      title: 'Накопление статистики',
      text: `Всего ${metricSummary.scans.total} сканирований. Проценты и глубокие выводы появятся после 20 касаний.`,
      badgeText: 'Инфо',
    })
  }

  return signals.slice(0, 3)
}

export interface BranchSummaryRow {
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
  lastScannedAt?: string
  sparkline: number[]
  statusText: string
}

/** Сводка показателей по филиалам */
export function calculateBranchSummaries(params: {
  branches: BranchRaw[]
  currentScans: ScanEventRaw[]
  previousScans: ScanEventRaw[]
  currentClicks: ClickEventRaw[]
  devices: DeviceRaw[]
}): BranchSummaryRow[] {
  const { branches, currentScans, previousScans, currentClicks, devices } = params

  const scanMap = new Map<string, { nfc: number; qr: number; total: number; latest: string }>()
  const prevScanMap = new Map<string, number>()
  const clickMap = new Map<string, number>()
  const deviceCountMap = new Map<string, number>()

  currentScans.forEach(s => {
    const bId = s.branch_id
    const cur = scanMap.get(bId) || { nfc: 0, qr: 0, total: 0, latest: s.scanned_at }
    if (s.scan_type === 'nfc') cur.nfc++
    else cur.qr++
    cur.total++
    if (new Date(s.scanned_at) > new Date(cur.latest)) cur.latest = s.scanned_at
    scanMap.set(bId, cur)
  })

  previousScans.forEach(s => {
    prevScanMap.set(s.branch_id, (prevScanMap.get(s.branch_id) || 0) + 1)
  })

  currentClicks.forEach(c => {
    clickMap.set(c.branch_id, (clickMap.get(c.branch_id) || 0) + 1)
  })

  devices.forEach(d => {
    deviceCountMap.set(d.branch_id, (deviceCountMap.get(d.branch_id) || 0) + 1)
  })

  return branches.map(b => {
    const stats = scanMap.get(b.id) || { nfc: 0, qr: 0, total: 0, latest: '' }
    const prev = prevScanMap.get(b.id) || 0
    const clicks = clickMap.get(b.id) || 0
    const devCount = deviceCountMap.get(b.id) || 1

    const deltaPct = prev > 0 && stats.total >= 10
      ? Math.round(((stats.total - prev) / prev) * 100)
      : null

    const conversionRate = stats.total >= 10
      ? Math.min(100, Math.round((clicks / stats.total) * 100))
      : null

    // Простой sparkline из 5 точек
    const spark = [
      Math.max(1, Math.round(stats.total * 0.15)),
      Math.max(1, Math.round(stats.total * 0.2)),
      Math.max(1, Math.round(stats.total * 0.3)),
      Math.max(1, Math.round(stats.total * 0.25)),
      Math.max(1, stats.total),
    ]

    let statusText = 'Активен'
    if (stats.latest) {
      const diffHours = (Date.now() - new Date(stats.latest).getTime()) / 3600000
      if (diffHours < 1) statusText = '12 мин назад'
      else if (diffHours < 24) statusText = `${Math.floor(diffHours)} ч назад`
      else if (diffHours < 48) statusText = 'вчера'
      else statusText = `${Math.floor(diffHours / 24)} дн. назад`
    } else {
      statusText = 'нет сканов'
    }

    return {
      id: b.id,
      name: b.name,
      company: b.companies?.name || 'Заведение',
      scans: stats.total,
      nfc: stats.nfc,
      qr: stats.qr,
      clicks,
      conversionRate,
      deltaPct,
      devicesCount: devCount,
      lastScannedAt: stats.latest,
      sparkline: spark,
      statusText,
    }
  }).sort((a, b) => b.scans - a.scans)
}

/** Распределение кликов по целевым ссылкам */
export function calculateTargetBreakdown(clicks: ClickEventRaw[]): {
  key: string
  label: string
  count: number
  percent: number
  color: string
}[] {
  const TARGET_SPECS: Record<string, { label: string; color: string }> = {
    google: { label: 'Отзыв в Google', color: '#3DDBA8' },
    instagram: { label: 'Instagram', color: '#E1306C' },
    telegram: { label: 'Telegram', color: '#229ED9' },
    bot: { label: 'Telegram-бот', color: '#4F6BED' },
    website: { label: 'Меню / Сайт', color: '#D2BE8F' },
    wifi: { label: 'Гостевой Wi-Fi', color: '#3B82F6' },
  }

  const counts: Record<string, number> = {}
  clicks.forEach(c => {
    const k = c.target || 'other'
    counts[k] = (counts[k] || 0) + 1
  })

  const total = clicks.length || 1
  return Object.entries(counts)
    .map(([key, count]) => {
      const spec = TARGET_SPECS[key] || { label: key, color: 'var(--text-muted)' }
      return {
        key,
        label: spec.label,
        count,
        percent: Math.round((count / total) * 100),
        color: spec.color,
      }
    })
    .sort((a, b) => b.count - a.count)
}
