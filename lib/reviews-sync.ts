import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractPlaceId, fetchPlaceStats } from '@/lib/google-places'

export type SyncResult = {
  synced: number
  skipped: number
  errors: { branch: string; error: string }[]
}

/**
 * Снимает снимок отзывов Google по каждому активному филиалу.
 * Place ID берётся из branches.google_place_id, а если его нет — из ссылки
 * на отзыв (и тогда сохраняется в колонку, чтобы дальше не парсить).
 * Вызывается кроном раз в сутки и кнопкой «Обновить отзывы» в панели.
 */
export async function syncGoogleReviews(): Promise<SyncResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY не задан в Vercel')

  const supabase = createServiceRoleClient()
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, name, google_url, google_place_id')
    .eq('active', true)
  if (error) throw new Error(error.message)

  const result: SyncResult = { synced: 0, skipped: 0, errors: [] }

  for (const b of branches ?? []) {
    let placeId: string | null = b.google_place_id
    if (!placeId) {
      placeId = extractPlaceId(b.google_url)
      if (placeId) await supabase.from('branches').update({ google_place_id: placeId }).eq('id', b.id)
    }
    if (!placeId) { result.skipped++; continue }

    try {
      const stats = await fetchPlaceStats(placeId, apiKey)
      const { error: insErr } = await supabase.from('review_snapshots').insert({
        branch_id: b.id,
        source: 'google',
        rating: stats.rating,
        review_count: stats.count,
        reviews: stats.reviews,
      })
      if (insErr) throw new Error(insErr.message)
      result.synced++
    } catch (e) {
      result.errors.push({ branch: b.name, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return result
}
