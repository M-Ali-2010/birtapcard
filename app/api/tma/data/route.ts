/**
 * app/api/tma/data/route.ts
 *
 * API для Telegram Mini App (TMA).
 * Принимает telegram_id пользователя или ID компании,
 * определяет права доступа через lib/telegram/db (findProfile)
 * и возвращает полную аналитику для мобильного интерфейса в Telegram.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, findProfile, isBuiltinAdmin } from '@/lib/telegram/db'
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const telegramId = Number(body.telegram_id)
    const period: PeriodRange = body.period === '7' || body.period === '90' ? body.period : '30'
    const requestedCompanyId = body.company_id ? String(body.company_id) : undefined

    const supabase = db()

    // 1. Поиск профиля пользователя Telegram
    let profile = telegramId ? await findProfile(telegramId) : null
    const isAdmin = telegramId ? isBuiltinAdmin(telegramId) : false

    // Если профиль не найден, но это админ
    if (isAdmin && !profile) {
      profile = {
        user_id: 'admin',
        role: 'super_admin',
        company_id: null,
        branch_id: null,
        full_name: 'Администратор',
      }
    }

    // 2. Определение компании для показа
    let targetCompanyId = profile?.company_id || requestedCompanyId

    // Список всех компаний для селектора (если super_admin)
    let availableCompanies: { id: string; name: string }[] = []

    if (profile?.role === 'super_admin' || isAdmin) {
      const { data: allComps } = await supabase
        .from('companies')
        .select('id, name')
        .eq('active', true)
        .order('name')
      availableCompanies = allComps || []
      if (!targetCompanyId && availableCompanies.length > 0) {
        targetCompanyId = availableCompanies[0].id
      }
    }

    // Если компания так и не определена (например, гость в демо-режиме)
    if (!targetCompanyId) {
      const { data: firstComp } = await supabase
        .from('companies')
        .select('id, name')
        .eq('active', true)
        .limit(1)
        .maybeSingle()

      if (firstComp) {
        targetCompanyId = firstComp.id
        availableCompanies = [firstComp]
      }
    }

    if (!targetCompanyId) {
      return NextResponse.json({
        ok: false,
        error: 'Заведение не найдено',
        isDemo: true,
      })
    }

    // 3. Данные компании
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, slug, logo_url')
      .eq('id', targetCompanyId)
      .single()

    // 4. Список филиалов
    let branchQuery = supabase
      .from('branches')
      .select('id, company_id, name, slug, google_url, instagram_url, paid_until, nfc_url, qr_url, qr_image_url, active, created_at, companies(id, name)')
      .eq('company_id', targetCompanyId)
      .order('name')

    if (profile?.role === 'branch_manager' && profile.branch_id) {
      branchQuery = branchQuery.eq('id', profile.branch_id)
    }

    const { data: rawBranches } = await branchQuery
    const branches = ((rawBranches as unknown) as (BranchRaw & { paid_until?: string; qr_image_url?: string; nfc_url?: string; qr_url?: string })[]) || []
    const branchIds = branches.map(b => b.id)

    // 5. Временные периоды
    const { currentStart, currentEnd, previousStart, previousEnd, daysCount } = getPeriodDates(period)

    // 6. Загрузка событий
    let curScans: ScanEventRaw[] = []
    let prevScans: ScanEventRaw[] = []
    let curClicks: ClickEventRaw[] = []
    let prevClicks: ClickEventRaw[] = []
    let snapshots: ReviewSnapshotRaw[] = []

    if (branchIds.length > 0) {
      const [curScansRes, prevScansRes, curClicksRes, prevClicksRes, snapsRes] = await Promise.all([
        supabase
          .from('scan_events')
          .select('id, branch_id, scan_type, device, is_unique, scanned_at, branches(name, companies(name))')
          .in('branch_id', branchIds)
          .gte('scanned_at', currentStart.toISOString())
          .lte('scanned_at', currentEnd.toISOString())
          .order('scanned_at', { ascending: false })
          .limit(5000),

        supabase
          .from('scan_events')
          .select('id, branch_id, scan_type, scanned_at')
          .in('branch_id', branchIds)
          .gte('scanned_at', previousStart.toISOString())
          .lte('scanned_at', previousEnd.toISOString())
          .limit(5000),

        supabase
          .from('link_clicks')
          .select('id, branch_id, target, clicked_at')
          .in('branch_id', branchIds)
          .gte('clicked_at', currentStart.toISOString())
          .lte('clicked_at', currentEnd.toISOString())
          .limit(3000),

        supabase
          .from('link_clicks')
          .select('id, branch_id, target, clicked_at')
          .in('branch_id', branchIds)
          .gte('clicked_at', previousStart.toISOString())
          .lte('clicked_at', previousEnd.toISOString())
          .limit(3000),

        supabase
          .from('review_snapshots')
          .select('branch_id, rating, review_count, captured_at')
          .in('branch_id', branchIds)
          .gte('captured_at', new Date(currentStart.getTime() - 2 * 86400000).toISOString())
          .lte('captured_at', currentEnd.toISOString())
          .order('captured_at', { ascending: true })
          .limit(1000),
      ])

      curScans = ((curScansRes.data as unknown) as ScanEventRaw[]) || []
      prevScans = ((prevScansRes.data as unknown) as ScanEventRaw[]) || []
      curClicks = ((curClicksRes.data as unknown) as ClickEventRaw[]) || []
      prevClicks = ((prevClicksRes.data as unknown) as ClickEventRaw[]) || []
      snapshots = ((snapsRes.data as unknown) as ReviewSnapshotRaw[]) || []
    }

    // 7. Виртуальные устройства
    const virtualDevices: DeviceRaw[] = []
    branches.forEach(b => {
      virtualDevices.push({ id: `${b.id}-1`, branch_id: b.id, placement: 'Основной зал', table_number: '1' })
      virtualDevices.push({ id: `${b.id}-2`, branch_id: b.id, placement: 'Касса', table_number: '2' })
      virtualDevices.push({ id: `${b.id}-3`, branch_id: b.id, placement: 'Терраса', table_number: '3' })
    })

    // 8. Расчёт метрик движком
    const kpiSummary = calculateKpiSummary({
      currentScans: curScans,
      previousScans: prevScans,
      currentClicks: curClicks,
      previousClicks: prevClicks,
      devices: virtualDevices,
      branches,
      snapshots,
    })

    const dailyChart = buildDailyChartSeries(curScans, prevScans, daysCount)

    const branchStats = calculateBranchSummaries({
      branches,
      currentScans: curScans,
      previousScans: prevScans,
      currentClicks: curClicks,
      devices: virtualDevices,
    })

    const attentionSignals = generateAttentionSignals({
      metricSummary: kpiSummary,
      branchStats,
    })

    const targetBreakdown = calculateTargetBreakdown(curClicks)

    // Почасовое распределение
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      nfc: 0,
      qr: 0,
      total: 0,
    }))

    curScans.forEach(s => {
      const h = new Date(s.scanned_at).getHours()
      if (h >= 0 && h < 24) {
        if (s.scan_type === 'nfc') hourlyDistribution[h].nfc++
        else hourlyDistribution[h].qr++
        hourlyDistribution[h].total++
      }
    })

    return NextResponse.json({
      ok: true,
      user: {
        telegramId,
        role: profile?.role || (isAdmin ? 'super_admin' : 'guest'),
        fullName: profile?.full_name || 'Гость',
        isAdmin,
      },
      company: {
        id: company?.id,
        name: company?.name || 'Заведение',
        logoUrl: company?.logo_url,
      },
      availableCompanies,
      period,
      daysCount,
      summary: kpiSummary,
      dailyChart,
      branchStats,
      attentionSignals,
      targetBreakdown,
      hourlyDistribution,
      branches: branches.map(b => ({
        id: b.id,
        name: b.name,
        paidUntil: b.paid_until,
        nfcUrl: b.nfc_url,
        qrUrl: b.qr_url,
        qrImageUrl: b.qr_image_url,
      })),
      updatedAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    })
  } catch (err: unknown) {
    console.error('[api/tma/data] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
