/**
 * Google Places API (New): рейтинг, число отзывов и последние отзывы по Place ID.
 * Google не говорит, кто оставил отзыв после скана, но точное число отзывов
 * и рейтинг отдаёт — снимаем их раз в сутки и считаем прирост.
 */

export type PlaceReview = {
  author: string
  photo: string | null
  rating: number
  text: string
  time: string           // ISO
  relative: string       // «2 недели назад» — как отдал Google
}

export type PlaceStats = {
  rating: number | null
  count: number
  reviews: PlaceReview[]
}

/** Place ID из ссылки на отзыв: search.google.com/local/writereview?placeid=ChIJ… */
export function extractPlaceId(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const id = u.searchParams.get('placeid') || u.searchParams.get('place_id')
    if (id && /^ChIJ[\w-]+$/.test(id)) return id
  } catch {}
  const m = /place_?id=(ChIJ[\w-]+)/i.exec(url)
  return m ? m[1] : null
}

export function isPlaceId(v: string): boolean {
  return /^ChIJ[\w-]{10,}$/.test(v.trim())
}

export async function fetchPlaceStats(placeId: string, apiKey: string): Promise<PlaceStats> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ru`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as {
    rating?: number
    userRatingCount?: number
    reviews?: Array<{
      rating?: number
      text?: { text?: string }
      originalText?: { text?: string }
      publishTime?: string
      relativePublishTimeDescription?: string
      authorAttribution?: { displayName?: string; photoUri?: string }
    }>
  }
  return {
    rating: typeof data.rating === 'number' ? data.rating : null,
    count: data.userRatingCount ?? 0,
    reviews: (data.reviews ?? []).map(r => ({
      author: r.authorAttribution?.displayName ?? 'Гость',
      photo: r.authorAttribution?.photoUri ?? null,
      rating: r.rating ?? 0,
      text: r.text?.text ?? r.originalText?.text ?? '',
      time: r.publishTime ?? new Date().toISOString(),
      relative: r.relativePublishTimeDescription ?? '',
    })),
  }
}
