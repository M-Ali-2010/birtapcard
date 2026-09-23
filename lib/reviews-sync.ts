import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractPlaceId, fetchPlaceStats } from '@/lib/google-places'
import { sendMessage, escapeMd } from '@/lib/telegram/bot'

export type SyncResult = {
  synced: number
  skipped: number
  errors: { branch: string; error: string }[]
  details: { branch: string; count: number; rating: number | null; reviews: number }[]
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
    .select('id, name, company_id, google_url, google_place_id')
    .eq('active', true)
  if (error) throw new Error(error.message)

  const result: SyncResult = { synced: 0, skipped: 0, errors: [], details: [] }

  for (const b of branches ?? []) {
    let placeId: string | null = b.google_place_id
    if (!placeId) {
      placeId = extractPlaceId(b.google_url)
      if (placeId) await supabase.from('branches').update({ google_place_id: placeId }).eq('id', b.id)
    }
    if (!placeId) { result.skipped++; continue }

    try {
      const stats = await fetchPlaceStats(placeId, apiKey)

      // Предыдущий снимок — чтобы понять, появились ли отзывы прямо сейчас
      const { data: prevSnap } = await supabase
        .from('review_snapshots')
        .select('review_count, rating')
        .eq('branch_id', b.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { error: insErr } = await supabase.from('review_snapshots').insert({
        branch_id: b.id,
        source: 'google',
        rating: stats.rating,
        review_count: stats.count,
        reviews: stats.reviews,
      })
      if (insErr) throw new Error(insErr.message)

      const gained = prevSnap ? stats.count - (prevSnap.review_count ?? 0) : 0
      if (gained > 0) await notifyNewReviews(supabase, b, gained, stats.rating, prevSnap?.rating ?? null)

      result.synced++
      result.details.push({ branch: b.name, count: stats.count, rating: stats.rating, reviews: stats.reviews.length })
    } catch (e) {
      result.errors.push({ branch: b.name, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return result
}


/**
 * Сообщение владельцу в момент появления отзывов, а не спустя сутки в сводке.
 * Отправляем только если компания это включила (telegram_settings.notify_reviews).
 */
async function notifyNewReviews(
  supabase: ReturnType<typeof createServiceRoleClient>,
  branch: { id: string; name: string; company_id: string | null },
  gained: number,
  rating: number | null,
  prevRating: number | null,
): Promise<void> {
  if (!branch.company_id) return

  const { data: tg } = await supabase
    .from('telegram_settings')
    .select('chat_id, active, notify_reviews')
    .eq('company_id', branch.company_id)
    .maybeSingle()

  if (!tg?.active || !tg.chat_id || tg.notify_reviews === false) return

  const word = gained === 1 ? 'новый отзыв' : gained < 5 ? 'новых отзыва' : 'новых отзывов'
  let text = `⭐ *${gained} ${word} в Google*\n🏪 ${escapeMd(branch.name)}`

  if (rating !== null) {
    const move = prevRating !== null && Math.abs(rating - prevRating) >= 0.05
      ? ` _(${rating > prevRating ? '+' : '−'}${Math.abs(rating - prevRating).toFixed(1)})_`
      : ''
    text += `\n📈 Рейтинг: *${rating.toFixed(1)}*${move}`
  }

  await sendMessage(tg.chat_id, text)
}
