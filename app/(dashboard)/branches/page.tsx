'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { plural, shortDate, slugify } from '@/lib/format'
import { Icon } from '@/components/ui/icons'
import { extractPlaceId } from '@/lib/google-places'
import {
  AccessDenied, Badge, Button, CopyLine, EmptyState, Fab, Field, IconButton, KpiCard,
  KpiSkeleton, Modal, Note, Panel, SearchInput, SkeletonRows, Switch,
  useConfirm,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'
import { QrPreviewModal } from '@/components/qr-preview-modal'

/* ─── Конфигурация ───────────────────────────────────────────────────────── */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

/**
 * Прибавить месяцы к сроку подписки.
 * Если подписка ещё идёт — считаем от её конца (ранняя оплата не сгорает).
 * Если срока нет или он прошёл — от fallback: для нового филиала это сегодня,
 * для существующего — дата, когда его добавили (момент покупки устройства).
 */
function extendFrom(current: string | null, months: number, fallback: Date = new Date()): string {
  const now = new Date()
  const base = current && new Date(current) > now ? new Date(current) : new Date(fallback)
  base.setMonth(base.getMonth() + months)
  return base.toISOString()
}

/** ISO → значение для <input type="date"> в локальном времени */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Состояние подписки филиала — для бейджа в списке и блока в форме */
function subState(paidUntil: string | null): { tone: 'mint' | 'orange' | 'danger' | 'muted'; label: string; days: number } {
  if (!paidUntil) return { tone: 'muted', label: 'без срока', days: Infinity }
  const days = Math.ceil((new Date(paidUntil).getTime() - Date.now()) / 86400000)
  if (days < 0) return { tone: 'danger', label: 'подписка истекла', days }
  if (days <= 7) return { tone: 'orange', label: `осталось ${days} ${plural(days, ['день', 'дня', 'дней'])}`, days }
  return { tone: 'mint', label: `до ${shortDate(paidUntil)}`, days }
}

/** «@name», «t.me/name» и полная ссылка приводятся к одному виду */
function normalizeTelegram(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const handle = v
    .replace(/^@/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?(t\.me|telegram\.me)\//i, '')
    .replace(/\/+$/, '')
  return handle ? `https://t.me/${handle}` : null
}

/** «@name», «instagram.com/name» и полная ссылка приводятся к одному виду */
function normalizeInstagram(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, '')
  const handle = v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  return handle ? `https://instagram.com/${handle}` : null
}

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type CompanyOption = { id: string; name: string; active: boolean }

type Branch = {
  id: string
  company_id: string
  name: string
  slug: string
  google_url: string
  google_place_id: string | null
  instagram_url: string | null
  yandex_url: string | null
  gis_url: string | null
  telegram_url: string | null
  bot_url: string | null
  paid_until: string | null
  nfc_token: string
  qr_token: string
  nfc_url: string
  qr_url: string
  qr_image_url: string | null
  active: boolean
  created_at: string
  companies?: { name: string; slug: string } | null
}

/* ─── Генерация и загрузка QR (через API — обходит RLS) ──────────────────── */

async function generateAndUploadQr(branchId: string, qrUrl: string): Promise<string> {
  const imageBase64 = await QRCode.toDataURL(qrUrl, {
    width: 512,
    margin: 2,
    color: { dark: '#070C1A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  const res = await fetch('/api/branches/qr-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, imageBase64 }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Ошибка загрузки QR-кода')
  }

  const { publicUrl } = await res.json()
  return publicUrl
}

/* ─── Модалка филиала ────────────────────────────────────────────────────── */

function BranchModal({
  branch, companies, defaultCompanyId, onClose, onSaved,
}: {
  branch: Branch | null
  companies: CompanyOption[]
  defaultCompanyId: string | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const isEdit = !!branch
  const [companyId, setCompanyId] = useState(branch?.company_id ?? defaultCompanyId ?? companies[0]?.id ?? '')
  const [name, setName] = useState(branch?.name ?? '')
  const [slug, setSlug] = useState(branch?.slug ?? '')
  const [googleUrl, setGoogleUrl] = useState(branch?.google_url ?? '')
  const [placeId, setPlaceId] = useState(branch?.google_place_id ?? '')
  const [instagram, setInstagram] = useState(branch?.instagram_url ?? '')
  const [yandex, setYandex] = useState(branch?.yandex_url ?? '')
  const [gis, setGis] = useState(branch?.gis_url ?? '')
  const [telegram, setTelegram] = useState(branch?.telegram_url ?? '')
  const [bot, setBot] = useState(branch?.bot_url ?? '')
  // Для существующего филиала месяц/год считаются от дня его добавления
  const startBase = branch ? new Date(branch.created_at) : new Date()
  const [paidUntil, setPaidUntil] = useState<string | null>(
    branch ? branch.paid_until : extendFrom(null, 1),
  )
  const [active, setActive] = useState(branch?.active ?? true)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState('')

  function handleNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function handleSave() {
    if (!companyId) { setError('Выберите ресторан'); return }
    if (!name.trim()) { setError('Введите название филиала'); return }
    if (!slug.trim()) { setError('Введите slug'); return }
    if (!googleUrl.trim()) { setError('Укажите ссылку на отзывы Google'); return }

    setSaving(true)
    setError(null)

    try {
      if (isEdit) {
        setStep('Сохраняем изменения…')
        const updRes = await fetch('/api/branches/manage', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: branch!.id,
            company_id: companyId,
            name: name.trim(),
            slug: slug.trim(),
            google_url: googleUrl.trim(),
            google_place_id: placeId.trim() || null,
            instagram_url: normalizeInstagram(instagram),
            yandex_url: yandex.trim() || null,
            gis_url: gis.trim() || null,
            telegram_url: normalizeTelegram(telegram),
            bot_url: normalizeTelegram(bot),
            paid_until: paidUntil,
            active,
          }),
        })
        if (!updRes.ok) {
          const err = await updRes.json().catch(() => ({}))
          throw new Error(err.error || 'Не удалось обновить филиал')
        }
      } else {
        setStep('Создаём филиал и токены…')
        const nfcToken = crypto.randomUUID()
        const qrToken = crypto.randomUUID()
        const qrUrl = `${SITE_URL}/r/qr/${qrToken}`

        const createRes = await fetch('/api/branches/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            name: name.trim(),
            slug: slug.trim(),
            google_url: googleUrl.trim(),
            google_place_id: placeId.trim() || null,
            instagram_url: normalizeInstagram(instagram),
            yandex_url: yandex.trim() || null,
            gis_url: gis.trim() || null,
            telegram_url: normalizeTelegram(telegram),
            bot_url: normalizeTelegram(bot),
            paid_until: paidUntil,
            nfc_token: nfcToken,
            qr_token: qrToken,
            active,
          }),
        })
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          throw new Error(err.error || 'Не удалось создать филиал')
        }
        const inserted = await createRes.json()

        setStep('Генерируем QR-код…')
        const publicUrl = await generateAndUploadQr(inserted.id, qrUrl)

        setStep('Сохраняем QR-код…')
        const patchRes = await fetch('/api/branches/manage', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: inserted.id, qr_image_url: publicUrl }),
        })
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}))
          throw new Error(err.error || 'Не удалось сохранить QR-код')
        }
      }

      setSaving(false)
      onSaved(isEdit ? 'Филиал обновлён' : 'Филиал создан, QR-код готов')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить филиал')
      setSaving(false)
      setStep('')
    }
  }

  return (
    <Modal
      icon={isEdit ? 'edit' : 'plus'}
      title={isEdit ? 'Редактировать филиал' : 'Новый филиал'}
      sub={isEdit ? branch!.companies?.name ?? undefined : 'Токены и QR-код создадутся автоматически'}
      onClose={onClose}
      footer={
        <>
          {saving && step && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginRight: 'auto' }}>{step}</span>
          )}
          <Button onClick={onClose} disabled={saving}>Отмена</Button>
          <Button
            variant="primary" icon="check" loading={saving}
            disabled={companies.length === 0}
            onClick={handleSave}
          >
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <Field label="Ресторан" hint="Логотип на экране после скана берётся из карточки ресторана.">
        <select className="select" value={companyId} onChange={e => setCompanyId(e.target.value)}>
          {companies.length === 0 && <option value="">Нет ресторанов</option>}
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{!c.active ? ' (отключен)' : ''}</option>
          ))}
        </select>
      </Field>

      <Field label="Название филиала">
        <input className="input" value={name} autoFocus
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Grand Registan — Чорсу" />
      </Field>

      <Field label="Slug" hint="Используется в ссылках.">
        <input className="input mono" value={slug}
          onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
          placeholder="chorsu" />
      </Field>

      <Field
        label="Ссылка на отзывы Google"
        hint="После скана NFC или QR гость попадёт именно сюда."
      >
        <input className="input" value={googleUrl} inputMode="url"
          onChange={e => {
            setGoogleUrl(e.target.value)
            const derived = extractPlaceId(e.target.value)
            if (derived) setPlaceId(derived)
          }}
          placeholder="https://g.page/r/…/review" />
      </Field>

      <Field
        label="Google Place ID"
        hint={placeId
          ? 'По нему считаются реальные отзывы и рейтинг в Google.'
          : 'Нужен для подсчёта реальных отзывов. Из ссылки вида search.google.com/local/writereview?placeid=… подставляется сам; для g.page-ссылок вставьте вручную.'}
      >
        <input className="input mono" value={placeId}
          onChange={e => setPlaceId(e.target.value.trim())}
          placeholder="ChIJ…" />
      </Field>

      <Field
        label="Instagram заведения"
        hint="Необязательно. Когда гость вернётся из Google после отзыва, ему предложат подписаться. Можно вставить @имя или полную ссылку."
      >
        <input className="input" value={instagram} inputMode="url"
          onChange={e => setInstagram(e.target.value)}
          placeholder="@grand_registan" />
      </Field>

      <Field
        label="Отзывы на Яндекс Картах"
        hint="Необязательно. Кнопка появится на странице после скана — рядом с Google."
      >
        <input className="input" value={yandex} inputMode="url"
          onChange={e => setYandex(e.target.value)}
          placeholder="https://yandex.uz/maps/-/…" />
      </Field>

      <Field
        label="Отзывы в 2ГИС"
        hint="Необязательно. Тоже отдельной кнопкой на странице после скана."
      >
        <input className="input" value={gis} inputMode="url"
          onChange={e => setGis(e.target.value)}
          placeholder="https://go.2gis.com/…" />
      </Field>

      <Field
        label="Telegram-канал заведения"
        hint="Необязательно. Кнопка появится рядом с Instagram. Можно вставить @канал или ссылку."
      >
        <input className="input" value={telegram} inputMode="url"
          onChange={e => setTelegram(e.target.value)}
          placeholder="@quest_house_uz" />
      </Field>

      <Field
        label="Telegram-бот заведения"
        hint="Необязательно. Например, бот доставки или брони. Можно вставить @бот или ссылку."
      >
        <input className="input" value={bot} inputMode="url"
          onChange={e => setBot(e.target.value)}
          placeholder="@quest_house_bot" />
      </Field>

      <Field
        label="Подписка устройства"
        hint={
          branch
            ? `Филиал добавлен ${shortDate(branch.created_at)} — «+1 месяц» и «+1 год» считают от этой даты, если срок ещё не задан. Дату можно поправить вручную.`
            : 'Новый филиал получает месяц с сегодняшнего дня. Когда срок пройдёт, гость при скане увидит «подписка истекла — обратитесь в поддержку».'
        }
      >
        {(() => {
          const st = subState(paidUntil)
          return (
            <div className="switch-row" style={{ cursor: 'default', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13.5, fontWeight: 650 }}>
                  {paidUntil ? `Действует до ${shortDate(paidUntil)}` : 'Без ограничения срока'}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <input
                  className="input" type="date" value={toDateInput(paidUntil)}
                  onChange={e => setPaidUntil(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null)}
                  style={{ width: 'auto', minHeight: 32, padding: '4px 9px', fontSize: 12.5 }}
                  title="Задать дату окончания вручную"
                />
                <Button size="sm" variant="outline" onClick={() => setPaidUntil(extendFrom(paidUntil, 1, startBase))}>+1 месяц</Button>
                <Button size="sm" variant="outline" onClick={() => setPaidUntil(extendFrom(paidUntil, 12, startBase))}>+1 год</Button>
                {paidUntil && (
                  <Button size="sm" variant="ghost" onClick={() => setPaidUntil(null)}>Без срока</Button>
                )}
              </div>
            </div>
          )
        })()}
      </Field>

      <div style={{ marginBottom: 15 }}>
        <Switch checked={active} onChange={setActive} label="Филиал активен" />
      </div>

      {!isEdit && (
        <div style={{ marginBottom: 14 }}>
          <Note tone="info">
            При создании автоматически сгенерируются NFC- и QR-токены, а также QR-код для печати.
          </Note>
        </div>
      )}

      {error && <div style={{ marginBottom: 14 }}><Note tone="danger">{error}</Note></div>}
    </Modal>
  )
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function BranchesPage() {
  return (
    <Suspense fallback={<div className="grid grid--kpi-3"><KpiSkeleton count={3} /></div>}>
      <BranchesView />
    </Suspense>
  )
}

function BranchesView() {
  const { loaded: profileLoaded, isSuperAdmin } = useProfile()
  const confirm = useConfirm()
  const { success, error: errorToast, toast } = useToast()
  const params = useSearchParams()

  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>(params.get('company') ?? 'all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [regenId, setRegenId] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<Branch | null>(null)

  useEffect(() => {
    const c = params.get('company')
    if (c) setCompanyFilter(c)
  }, [params])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const BASE = 'id, company_id, name, slug, google_url, instagram_url, yandex_url, gis_url, telegram_url, bot_url, paid_until, nfc_token, qr_token, nfc_url, qr_url, qr_image_url, active, created_at, companies(name, slug)'
    const selectBranches = (cols: string) =>
      supabase.from('branches').select(cols).order('created_at', { ascending: false })

    const [companiesRes, firstTry] = await Promise.all([
      supabase.from('companies').select('id, name, active').order('name'),
      selectBranches(`${BASE}, google_place_id`),
    ])
    // Пока миграция 0003 (google_place_id) не выполнена — список не должен пропадать
    const branchesRes = firstTry.error ? await selectBranches(BASE) : firstTry

    setCompanies((companiesRes.data as CompanyOption[] | null) ?? [])
    setBranches((branchesRes.data as unknown as Branch[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (isSuperAdmin) loadData() }, [isSuperAdmin, loadData])

  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, loadData)
    return () => window.removeEventListener(REFRESH_EVENT, loadData)
  }, [loadData])

  const filtered = useMemo(() => {
    let list = branches
    if (companyFilter !== 'all') list = list.filter(b => b.company_id === companyFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.companies?.name ?? '').toLowerCase().includes(q))
    }
    return list
  }, [branches, companyFilter, search])

  const activeCount = branches.filter(b => b.active).length
  const withoutQrCount = branches.filter(b => !b.qr_image_url).length
  const expiredCount = branches.filter(b => subState(b.paid_until).days < 0).length
  const expiringCount = branches.filter(b => { const d = subState(b.paid_until).days; return d >= 0 && d <= 7 }).length

  async function handleToggleActive(b: Branch) {
    setBusyId(b.id)
    const res = await fetch('/api/branches/manage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, active: !b.active }),
    })
    if (res.ok) {
      setBranches(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))
      toast(!b.active ? `«${b.name}» включён` : `«${b.name}» отключён`, { kind: 'info' })
    } else {
      const err = await res.json().catch(() => ({}))
      errorToast(err.error || 'Ошибка обновления')
    }
    setBusyId(null)
  }

  async function handleRegenerateQr(b: Branch) {
    setRegenId(b.id)
    try {
      const publicUrl = await generateAndUploadQr(b.id, b.qr_url)
      const patchRes = await fetch('/api/branches/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id, qr_image_url: publicUrl }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось сохранить QR')
      }
      setBranches(prev => prev.map(x => x.id === b.id ? { ...x, qr_image_url: publicUrl } : x))
      success('QR-код обновлён', b.name)
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Не удалось перегенерировать QR-код')
    }
    setRegenId(null)
  }

  async function handleDelete(b: Branch) {
    const ok = await confirm({
      title: `Удалить филиал «${b.name}»?`,
      text: 'NFC-табличка и QR-код перестанут работать. История сканирований останется в базе. Действие необратимо.',
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok) return

    setBusyId(b.id)
    try {
      const delRes = await fetch('/api/branches/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: b.id }),
      })
      if (!delRes.ok) {
        const err = await delRes.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось удалить филиал')
      }
      setBranches(prev => prev.filter(x => x.id !== b.id))
      success('Филиал удалён', b.name)
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Не удалось удалить филиал')
    }
    setBusyId(null)
  }

  if (!profileLoaded) {
    return <div className="grid grid--kpi"><KpiSkeleton /></div>
  }

  if (!isSuperAdmin) return <AccessDenied what="Филиалы" />

  return (
    <div className="stack has-fab">

      <div className="grid grid--kpi">
        {loading ? <KpiSkeleton /> : (
          <>
            <KpiCard label="Филиалов" icon="branches" accent="mint"
              value={branches.length} sub="По всем ресторанам" />
            <KpiCard label="Активных" icon="check" accent="blue"
              value={activeCount} sub={`Отключено: ${branches.length - activeCount}`} />
            <KpiCard label="Подписка истекла" icon="lock" accent="orange"
              value={expiredCount} sub={expiringCount > 0 ? `Истекает в течение недели: ${expiringCount}` : 'Карточки заблокированы'} />
            <KpiCard label="Без QR-кода" icon="qrcodes" accent="purple"
              value={withoutQrCount} sub="Требуют генерации" />
          </>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <select
          className="select"
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          style={{ width: 'auto', maxWidth: 240 }}
        >
          <option value="all">Все рестораны</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <SearchInput value={search} onChange={setSearch} placeholder="Поиск филиала…" />

        <div className="toolbar__spacer hide-mobile">
          <Button
            variant="primary" icon="plus"
            disabled={companies.length === 0}
            onClick={() => { setEditing(null); setModalOpen(true) }}
          >
            Добавить филиал
          </Button>
        </div>
      </div>

      {companies.length > 0 && (
        <Fab label="Филиал" onClick={() => { setEditing(null); setModalOpen(true) }} />
      )}

      {companies.length === 0 && !loading && (
        <Note tone="warning">
          Сначала добавьте хотя бы один ресторан в разделе «Рестораны» — филиал привязывается к ресторану.
        </Note>
      )}

      <Panel
        title="Филиалы"
        sub={search || companyFilter !== 'all'
          ? `Найдено ${filtered.length} из ${branches.length}`
          : `Всего ${branches.length}`}
      >
        {loading ? (
          <SkeletonRows rows={3} height={128} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={branches.length === 0 ? 'branches' : 'search'}
            title={branches.length === 0 ? 'Пока нет филиалов' : 'Ничего не найдено'}
            text={branches.length === 0
              ? 'Создайте первый филиал — токены NFC/QR и QR-код сгенерируются автоматически.'
              : 'Измените запрос или сбросьте фильтр по ресторану.'}
          />
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {filtered.map(b => {
              const st = subState(b.paid_until)
              const chips: React.ReactNode[] = []
              if (st.tone !== 'muted') chips.push(<Badge key="sub" tone={st.tone}>{st.label}</Badge>)
              if (b.instagram_url) chips.push(
                <Badge key="ig" tone="purple">
                  <Icon name="share" size={10} />
                  {b.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/+$/, '')}
                </Badge>,
              )
              if (b.yandex_url) chips.push(<Badge key="ya" tone="danger">Яндекс</Badge>)
              if (b.gis_url) chips.push(<Badge key="gis" tone="success">2ГИС</Badge>)
              if (b.telegram_url) chips.push(
                <Badge key="tg" tone="blue">
                  <Icon name="telegram" size={10} />
                  {b.telegram_url.replace(/^https?:\/\/(www\.)?t\.me\//i, '@').replace(/\/+$/, '')}
                </Badge>,
              )
              if (b.bot_url) chips.push(
                <Badge key="bot" tone="purple">
                  <Icon name="zap" size={10} />
                  {b.bot_url.replace(/^https?:\/\/(www\.)?t\.me\//i, '@').replace(/\/+$/, '')}
                </Badge>,
              )

              return (
                <article key={b.id} className={`bcard${b.active ? '' : ' bcard--off'}`}>
                  <div className="bcard__head">
                    <button onClick={() => setQrPreview(b)} title="Показать QR-код" className="bcard__qr">
                      {b.qr_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.qr_image_url} alt="QR" />
                      ) : (
                        <Icon name="qrcodes" size={20} style={{ color: '#94A3B8' }} />
                      )}
                    </button>
                    <div className="bcard__main">
                      <div className="bcard__name truncate">{b.name}</div>
                      <div className="bcard__meta truncate">{b.companies?.name ?? '—'} · /{b.slug}</div>
                    </div>
                  </div>

                  {chips.length > 0 && <div className="bcard__chips">{chips}</div>}

                  <div className="bcard__links">
                    <CopyLine tag="NFC" tone="mint" value={b.nfc_url} />
                    <CopyLine tag="QR" tone="purple" value={b.qr_url} />
                  </div>

                  <div className="bcard__foot">
                    <label className={`bcard__toggle${b.active ? '' : ' bcard__toggle--off'}`}>
                      <Switch checked={b.active} disabled={busyId === b.id} onChange={() => handleToggleActive(b)} />
                      <span>{b.active ? 'Активен' : 'Отключен'}</span>
                    </label>
                    <div className="bcard__actions">
                      <IconButton
                        icon="refresh" title="Перегенерировать QR"
                        disabled={regenId === b.id}
                        onClick={() => handleRegenerateQr(b)}
                      />
                      <IconButton icon="edit" title="Редактировать"
                        onClick={() => { setEditing(b); setModalOpen(true) }} />
                      <IconButton icon="trash" title="Удалить" danger
                        disabled={busyId === b.id} onClick={() => handleDelete(b)} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Panel>

      {modalOpen && (
        <BranchModal
          branch={editing}
          companies={companies}
          defaultCompanyId={companyFilter !== 'all' ? companyFilter : null}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={(msg) => {
            setModalOpen(false)
            setEditing(null)
            success(msg)
            loadData()
          }}
        />
      )}

      {qrPreview && (
        <QrPreviewModal
          title={qrPreview.name}
          sub={qrPreview.companies?.name ?? undefined}
          imageUrl={qrPreview.qr_image_url}
          url={qrPreview.qr_url}
          slug={qrPreview.slug}
          branchId={qrPreview.id}
          onClose={() => setQrPreview(null)}
        />
      )}
    </div>
  )
}
