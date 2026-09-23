import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWebhookInfo, setWebhook } from '@/lib/telegram/bot'
import { configureBot } from '@/lib/telegram/profile'

export const dynamic = 'force-dynamic'

async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  return data?.role === 'super_admin'
}

/** Где должен стоять вебхук для этого деплоя */
function webhookUrl(request: NextRequest): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '')
  return `${base}/api/telegram/webhook`
}

/**
 * GET  /api/telegram/setup — состояние бота: куда смотрит вебхук, есть ли ошибки.
 * POST /api/telegram/setup — поставить вебхук на этот сайт (с секретом, если задан).
 * Только для super_admin.
 */
export async function GET(request: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const expected = webhookUrl(request)
  const tokenSet = !!process.env.TELEGRAM_BOT_TOKEN
  const secretSet = !!process.env.TELEGRAM_WEBHOOK_SECRET

  if (!tokenSet) {
    return NextResponse.json({ tokenSet, secretSet, expected, info: null })
  }

  try {
    const info = await getWebhookInfo()
    return NextResponse.json({ tokenSet, secretSet, expected, info, connected: info?.url === expected })
  } catch (e) {
    return NextResponse.json({ tokenSet, secretSet, expected, info: null, error: e instanceof Error ? e.message : 'Telegram недоступен' })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'В Vercel не задан TELEGRAM_BOT_TOKEN' }, { status: 400 })
  }

  try {
    const url = webhookUrl(request)
    const result = await setWebhook(url)
    if (!result.ok) {
      return NextResponse.json({ error: result.description ?? 'Telegram отклонил вебхук' }, { status: 502 })
    }

    // Заодно прописываем имя, описания, команды и кнопку меню —
    // чтобы в BotFather руками ничего вбивать не приходилось.
    const configured = await configureBot()

    return NextResponse.json({ ok: true, url, configured })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ошибка' }, { status: 500 })
  }
}
