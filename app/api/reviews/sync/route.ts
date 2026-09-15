import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncGoogleReviews } from '@/lib/reviews-sync'

export const maxDuration = 60

/** POST /api/reviews/sync — кнопка «Обновить отзывы». SUPER ADMIN ONLY. */
export async function POST() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await userClient.from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    return NextResponse.json(await syncGoogleReviews())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'sync failed' }, { status: 503 })
  }
}
