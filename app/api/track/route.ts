import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TARGETS = new Set(['google', 'yandex', 'gis', 'instagram', 'telegram', 'bot'])

/**
 * POST /api/track — гость нажал кнопку на странице после скана.
 *
 * Вызывается через navigator.sendBeacon с экрана /r/go, поэтому тело
 * приходит как text/plain. Никакой авторизации: страница публичная, а
 * записать можно только валидный токен филиала и одну из шести целей.
 * Ответ всегда 204 — гостю не нужно ждать, а ошибки не должны ему мешать.
 */
export async function POST(request: NextRequest) {
  let payload: { token?: string; target?: string } = {}
  try {
    payload = JSON.parse(await request.text())
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const { token, target } = payload
  if (!token || !UUID.test(token) || !target || !TARGETS.has(target)) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const supabase = createServiceRoleClient()
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .or(`nfc_token.eq.${token},qr_token.eq.${token}`)
      .maybeSingle()

    if (branch?.id) {
      const { error } = await supabase
        .from('link_clicks')
        .insert({ branch_id: branch.id, target })
      if (error) console.error('link_clicks insert error:', error)
    }
  } catch (e) {
    console.error('track error:', e)
  }

  return new NextResponse(null, { status: 204 })
}
