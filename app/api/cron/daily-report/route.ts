/**
 * app/api/cron/daily-report/route.ts
 *
 * Ежедневная сводка владельцу в Telegram: касания, новые отзывы Google,
 * переходы по кнопкам, лучшая точка. Текст собирает lib/telegram/reports.ts —
 * тот же, что отдают кнопки бота, чтобы цифры нигде не расходились.
 *
 * Расписание (vercel.json) — раз в сутки: тариф Hobby более частый крон не
 * принимает и отклоняет деплой целиком. Поэтому час из telegram_settings.
 * report_hour работает как пожелание: при суточном запуске срабатывает
 * подстраховка «не было больше 26 часов» и сводка всё равно уходит.
 *
 * Логика ниже уже умеет и точное время: при переходе на план с ежечасным
 * кроном достаточно поменять расписание в vercel.json на "0 * * * *",
 * и каждая компания начнёт получать отчёт в выбранный ею час.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/telegram/bot'
import { fetchCompanyReport, formatReport, getReportRange, previousRange } from '@/lib/telegram/reports'

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000  // Ташкент, UTC+5
const MIN_GAP_MS = 20 * 60 * 60 * 1000   // ближе 20 часов второй отчёт не шлём
const STALE_MS = 26 * 60 * 60 * 1000     // не было больше 26 часов — шлём, не дожидаясь часа

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

interface Settings {
  id: string
  company_id: string
  chat_id: string | null
  report_hour: number | null
  last_report_at: string | null
  companies: { id: string; name: string; active: boolean }[] | { id: string; name: string; active: boolean } | null
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const now = Date.now()
  const localHour = new Date(now + TZ_OFFSET_MS).getUTCHours()

  const range = getReportRange('yesterday')
  const prev = previousRange(range)

  const { data: settings, error } = await supabase
    .from('telegram_settings')
    .select('id, company_id, chat_id, report_hour, last_report_at, companies(id, name, active)')
    .eq('notify_daily', true)
    .eq('active', true)

  if (error) {
    console.error('[cron/daily-report] telegram_settings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: { company: string; sent: boolean; reason?: string }[] = []

  for (const raw of (settings ?? []) as Settings[]) {
    const company = Array.isArray(raw.companies) ? raw.companies[0] : raw.companies
    if (!company?.active || !raw.chat_id) continue

    // ── Пора ли? ────────────────────────────────────────────────────────────
    const sinceLast = raw.last_report_at ? now - new Date(raw.last_report_at).getTime() : Infinity
    if (sinceLast < MIN_GAP_MS) continue                       // уже получили сегодня

    const hour = raw.report_hour ?? 8
    const due = hour === localHour || sinceLast >= STALE_MS
    if (!due) continue

    // ── Собираем и отправляем ───────────────────────────────────────────────
    const data = await fetchCompanyReport(supabase, company.id, range, prev)
    if (!data) {
      results.push({ company: company.name, sent: false, reason: 'no-branches' })
      continue
    }

    const res = await sendMessage(raw.chat_id, formatReport(data))

    if (res.ok) {
      await supabase
        .from('telegram_settings')
        .update({ last_report_at: new Date(now).toISOString() })
        .eq('id', raw.id)
    } else {
      console.error(`[cron/daily-report] ${company.name}: ${res.error}`)
    }

    results.push({ company: company.name, sent: res.ok, reason: res.ok ? undefined : res.error })
  }

  const sent = results.filter(r => r.sent).length
  console.log(`[cron/daily-report] hour=${localHour} sent=${sent}/${results.length}`)

  return NextResponse.json({ ok: true, hour: localHour, period: range.label, sent, results })
}
