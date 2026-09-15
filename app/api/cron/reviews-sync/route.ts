import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleReviews } from '@/lib/reviews-sync'

export const maxDuration = 60

/**
 * GET /api/cron/reviews-sync — раз в сутки (vercel.json) снимает отзывы Google
 * по всем активным филиалам. Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncGoogleReviews()
    if (result.errors.length) console.error('reviews-sync errors:', result.errors)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sync failed'
    console.error('reviews-sync failed:', msg)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
