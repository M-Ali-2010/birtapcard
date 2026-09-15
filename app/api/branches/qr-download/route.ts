import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/branches/qr-download?id=<branchId>
 * Отдаёт PNG QR-кода филиала как вложение (Content-Disposition: attachment).
 * Прямая ссылка на Storage — чужой домен, браузеры игнорируют атрибут download
 * и просто открывают картинку, а WebView в приложении вообще ничего не делает.
 * Через свой домен и вложение скачивание работает везде. Доступ — по RLS пользователя.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: branch } = await supabase
    .from('branches')
    .select('slug, qr_image_url')
    .eq('id', id)
    .single()

  if (!branch?.qr_image_url) return NextResponse.json({ error: 'QR не сгенерирован' }, { status: 404 })

  const upstream = await fetch(branch.qr_image_url, { cache: 'no-store' })
  if (!upstream.ok) return NextResponse.json({ error: 'Не удалось получить файл' }, { status: 502 })

  const png = await upstream.arrayBuffer()
  return new NextResponse(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      'Content-Disposition': `attachment; filename="qr-${branch.slug}.png"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
