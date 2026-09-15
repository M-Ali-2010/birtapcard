import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGoogleReviews } from '@/lib/reviews-sync'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const maxDuration = 60

/** POST /api/reviews/sync — кнопка «Обновить отзывы». SUPER ADMIN ONLY. */
export async function POST(request: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await userClient.from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ?debug=1 — сырой ответ Google по первому филиалу с Place ID (без сохранения)
  if (request.nextUrl.searchParams.get('debug') === '1') {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? ''
    const { data: b } = await createServiceRoleClient().from('branches').select('name, google_place_id').not('google_place_id', 'is', null).limit(1).single()
    if (!b?.google_place_id) return NextResponse.json({ error: 'no place id' })
    const lc = request.nextUrl.searchParams.get('lc')
    const fm = request.nextUrl.searchParams.get('fm') ?? 'rating,userRatingCount,reviews'
    const pid = request.nextUrl.searchParams.get('pid') ?? b.google_place_id
    const res = await fetch(`https://places.googleapis.com/v1/places/${pid}${lc ? `?languageCode=${lc}` : ''}`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': fm }, cache: 'no-store',
    })
    const text = await res.text()
    return NextResponse.json({ branch: b.name, status: res.status, body: text.slice(0, 3000) })
  }

  try {
    return NextResponse.json(await syncGoogleReviews())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'sync failed' }, { status: 503 })
  }
}
