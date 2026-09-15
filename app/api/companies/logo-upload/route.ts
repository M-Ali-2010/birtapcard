import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const LOGO_BUCKET = 'logos'
const MAX_BYTES = 2 * 1024 * 1024

/**
 * POST /api/companies/logo-upload
 * Загружает логотип ресторана в Supabase Storage и сразу записывает
 * публичную ссылку в companies.logo_url. SUPER ADMIN ONLY.
 * Body: { companyId: string, imageBase64: string }  (data:image/png|jpeg|webp;base64,…)
 * Пустой imageBase64 — удалить логотип.
 */
export async function POST(request: NextRequest) {
  const userClient = await createClient()
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { companyId, imageBase64 } = body as { companyId?: string; imageBase64?: string }

  if (!companyId) {
    return NextResponse.json({ error: 'Missing companyId' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Удаление логотипа
  if (!imageBase64) {
    const { error } = await supabase.from('companies').update({ logo_url: null }).eq('id', companyId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ publicUrl: null })
  }

  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/.exec(imageBase64)
  if (!match) {
    return NextResponse.json({ error: 'Нужен PNG, JPG или WebP' }, { status: 400 })
  }
  const ext = match[1] === 'jpg' ? 'jpeg' : match[1]
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл больше 2 МБ' }, { status: 413 })
  }

  // Бакет создаётся сам при первой загрузке — ничего настраивать не нужно
  const { data: bucket } = await supabase.storage.getBucket(LOGO_BUCKET)
  if (!bucket) {
    const { error: mkErr } = await supabase.storage.createBucket(LOGO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    })
    if (mkErr && !/already exists/i.test(mkErr.message)) {
      console.error('logo bucket error:', mkErr)
      return NextResponse.json({ error: mkErr.message }, { status: 500 })
    }
  }

  const filePath = `${companyId}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(filePath, buffer, { contentType: `image/${ext}`, upsert: true })

  if (upErr) {
    console.error('logo upload error:', upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath)
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  const { error: dbErr } = await supabase.from('companies').update({ logo_url: publicUrl }).eq('id', companyId)
  if (dbErr) {
    console.error('logo_url update error:', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ publicUrl })
}
