'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { Button, EmptyState, IconButton, Panel, Skeleton } from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'
import { nf, relTime } from '@/lib/format'
import type { PlaceReview } from '@/lib/google-places'

export type ReviewSnapshot = {
  branch_id: string
  rating: number | null
  review_count: number
  reviews: PlaceReview[] | null
  captured_at: string
  branches?: { name: string } | null
}

/**
 * «Отзывы в Google» — реальные отзывы, а не переходы. Считаем по снимкам:
 * новые за период = последний снимок − снимок на начало периода, по каждому филиалу.
 */
export function ReviewsPanel({
  snapshots, since, scans, loading, canSync, onSynced,
}: {
  snapshots: ReviewSnapshot[]
  since: string           // ISO начала периода
  scans: number           // сканов за период — для «отзывов на 100 сканов»
  loading: boolean
  canSync: boolean
  onSynced: () => void
}) {
  const { toast, success, error } = useToast()
  const [syncing, setSyncing] = useState(false)

  const stats = useMemo(() => {
    const byBranch = new Map<string, ReviewSnapshot[]>()
    for (const s of snapshots) {
      const arr = byBranch.get(s.branch_id) ?? []
      arr.push(s)
      byBranch.set(s.branch_id, arr)
    }
    let total = 0, fresh = 0, ratingSum = 0, ratingWeight = 0
    const latestReviews: (PlaceReview & { branch: string })[] = []
    for (const arr of byBranch.values()) {
      arr.sort((a, b) => a.captured_at.localeCompare(b.captured_at))
      const latest = arr[arr.length - 1]
      const before = [...arr].reverse().find(s => s.captured_at <= since) ?? arr[0]
      total += latest.review_count
      fresh += Math.max(0, latest.review_count - before.review_count)
      if (latest.rating != null && latest.review_count > 0) {
        ratingSum += latest.rating * latest.review_count
        ratingWeight += latest.review_count
      }
      for (const r of latest.reviews ?? []) latestReviews.push({ ...r, branch: latest.branches?.name ?? '' })
    }
    latestReviews.sort((a, b) => b.time.localeCompare(a.time))
    return {
      branches: byBranch.size,
      total,
      fresh,
      rating: ratingWeight ? ratingSum / ratingWeight : null,
      per100: scans > 0 ? (fresh / scans) * 100 : 0,
      latest: latestReviews.slice(0, 5),
      capturedAt: snapshots.reduce((m, s) => (s.captured_at > m ? s.captured_at : m), ''),
    }
  }, [snapshots, since, scans])

  async function sync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/reviews/sync', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не удалось обновить')
      const errs = (json.errors ?? []) as { branch: string; error: string }[]
      if (json.synced > 0) success(`Обновлено: ${json.synced} ${json.synced === 1 ? 'филиал' : 'филиалов'}`, errs.length ? `Ошибок: ${errs.length}` : json.skipped ? `Без Place ID: ${json.skipped}` : undefined)
      else if (errs.length) error('Google не ответил', errs[0].error.slice(0, 120))
      else toast('Нет филиалов с Place ID', { kind: 'info', desc: 'Укажите Place ID в карточке филиала' })
      onSynced()
    } catch (e) {
      error('Не удалось обновить отзывы', e instanceof Error ? e.message : undefined)
    }
    setSyncing(false)
  }

  const action = canSync ? (
    <IconButton icon="refresh" title="Обновить отзывы из Google" small disabled={syncing} onClick={sync} />
  ) : undefined

  return (
    <Panel
      title="Отзывы в Google"
      sub={stats.capturedAt ? `Реальные отзывы · обновлено ${relTime(stats.capturedAt)}` : 'Реальные отзывы, а не переходы'}
      action={action}
    >
      {loading ? (
        <Skeleton h={140} r={12} />
      ) : snapshots.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Пока нет данных"
          text={canSync
            ? 'Нажмите «Обновить» — подтянем число отзывов и рейтинг по Place ID каждого филиала. Дальше обновляется само раз в сутки.'
            : 'Отзывы подтягиваются раз в сутки — загляните завтра.'}
          action={canSync && <Button variant="primary" icon="refresh" loading={syncing} onClick={sync}>Обновить</Button>}
        />
      ) : (
        <>
          <div className="rv-stats">
            <div className="rv-stat rv-stat--hero">
              <div className="rv-stat__value">+{nf(stats.fresh)}</div>
              <div className="rv-stat__label">новых за период</div>
            </div>
            <div className="rv-stat">
              <div className="rv-stat__value">{nf(stats.total)}</div>
              <div className="rv-stat__label">всего отзывов</div>
            </div>
            <div className="rv-stat">
              <div className="rv-stat__value rv-stat__value--star">
                <Icon name="star" size={15} />{stats.rating ? stats.rating.toFixed(1) : '—'}
              </div>
              <div className="rv-stat__label">рейтинг</div>
            </div>
            <div className="rv-stat">
              <div className="rv-stat__value">{stats.per100.toFixed(1)}</div>
              <div className="rv-stat__label">на 100 сканов</div>
            </div>
          </div>

          {stats.latest.length > 0 && (
            <div className="rv-list">
              {stats.latest.map((r, i) => (
                <div key={i} className="rv-item">
                  <div className="rv-item__avatar">{(r.author || '?').slice(0, 1).toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="rv-item__head">
                      <span className="truncate" style={{ fontWeight: 650 }}>{r.author}</span>
                      <span className="rv-item__stars" aria-label={`${r.rating} из 5`}>
                        {'★'.repeat(Math.max(0, Math.min(5, r.rating)))}
                        <span className="rv-item__stars-off">{'★'.repeat(5 - Math.max(0, Math.min(5, r.rating)))}</span>
                      </span>
                    </div>
                    <div className="rv-item__meta truncate">{r.branch}{r.relative ? ` · ${r.relative}` : ''}</div>
                    {r.text && <div className="rv-item__text">{r.text}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
