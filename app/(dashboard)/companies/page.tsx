'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { plural, shortDate, slugify } from '@/lib/format'
import { Icon } from '@/components/ui/icons'
import {
  AccessDenied, Button, EmptyState, Field, IconButton, KpiCard, KpiSkeleton,
  Modal, Note, Panel, SearchInput, SkeletonRows, StatusBadge, Switch, useConfirm,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type Company = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  owner_id: string
  active: boolean
  created_at: string
  branches?: { id: string }[] | null
}

/* ─── Подготовка логотипа ────────────────────────────────────────────────── */

const LOGO_SIZE = 512

/** Вписывает картинку в квадрат 512×512 (прозрачные поля) и отдаёт PNG data-URL. */
function squareLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = LOGO_SIZE
      canvas.height = LOGO_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      const k = Math.min(LOGO_SIZE / img.width, LOGO_SIZE / img.height, 1)
      const w = Math.round(img.width * k)
      const h = Math.round(img.height * k)
      ctx.drawImage(img, (LOGO_SIZE - w) / 2, (LOGO_SIZE - h) / 2, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

/* ─── Модалка создания / редактирования ──────────────────────────────────── */

function CompanyModal({
  company, onClose, onSaved,
}: {
  company: Company | null
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const isEdit = !!company
  const [name, setName] = useState(company?.name ?? '')
  const [slug, setSlug] = useState(company?.slug ?? '')
  const [logoUrl, setLogoUrl] = useState(company?.logo_url ?? '')
  // Новый файл ждёт сохранения: сначала создаём/обновляем ресторан, потом грузим логотип
  const [logoFile, setLogoFile] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [active, setActive] = useState(company?.active ?? true)
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function handleLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoError(null)
    try {
      setLogoFile(await squareLogo(file))
    } catch {
      setLogoError('Не удалось прочитать картинку — нужен PNG, JPG или WebP')
    }
  }

  function handleLogoRemove() {
    setLogoFile(null)
    setLogoUrl('')
    setLogoError(null)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Введите название ресторана'); return }
    if (!slug.trim()) { setError('Введите slug'); return }
    setSaving(true)
    setError(null)

    const payload = { name: name.trim(), slug: slug.trim(), logo_url: logoUrl.trim() || null, active }

    const res = await fetch('/api/companies/manage', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: company!.id, ...payload } : payload),
    })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) { setError(json.error ?? 'Не удалось сохранить'); setSaving(false); return }

    if (logoFile) {
      const companyId: string = isEdit ? company!.id : json.id
      const up = await fetch('/api/companies/logo-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, imageBase64: logoFile }),
      })
      const upJson = await up.json().catch(() => ({}))
      if (!up.ok) {
        setSaving(false)
        setError(`${isEdit ? 'Ресторан обновлён' : 'Ресторан создан'}, но логотип не загрузился: ${upJson.error ?? up.status}`)
        return
      }
    }

    setSaving(false)
    onSaved(isEdit ? 'Ресторан обновлён' : 'Ресторан создан')
  }

  const logoPreview = logoFile ?? (logoUrl.trim() || null)

  return (
    <Modal
      icon={isEdit ? 'edit' : 'plus'}
      title={isEdit ? 'Редактировать ресторан' : 'Новый ресторан'}
      sub={isEdit ? company!.name : 'Добавьте заведение в платформу'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} icon="check">
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <Field label="Название">
        <input className="input" value={name} autoFocus
          onChange={e => handleNameChange(e.target.value)} placeholder="Grand Registan" />
      </Field>

      <Field label="Slug" hint="Используется в ссылках. Генерируется автоматически из названия.">
        <input className="input mono" value={slug}
          onChange={e => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
          placeholder="grand-registan" />
      </Field>

      <Field label="Логотип" error={logoError ?? undefined}
        hint="Гость увидит его на экране после скана. PNG, JPG или WebP — лучше квадратный.">
        <div className="logo-pick">
          <div
            className="thumb logo-pick__thumb"
            style={logoPreview ? { backgroundImage: `url(${logoPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!logoPreview && <Icon name="restaurants" size={22} style={{ color: 'var(--text-muted)' }} />}
          </div>
          <div className="logo-pick__actions">
            <label className="btn btn--ghost btn--sm">
              <Icon name="download" size={14} />
              {logoPreview ? 'Заменить' : 'Загрузить'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleLogoPick} />
            </label>
            {logoPreview && (
              <Button size="sm" variant="danger" icon="trash" onClick={handleLogoRemove}>Убрать</Button>
            )}
          </div>
        </div>
      </Field>

      <div style={{ marginBottom: 15 }}>
        <Switch checked={active} onChange={setActive} label="Ресторан активен" />
      </div>

      {error && <div style={{ marginBottom: 14 }}><Note tone="danger">{error}</Note></div>}
    </Modal>
  )
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function CompaniesPage() {
  const { loaded: profileLoaded, isSuperAdmin } = useProfile()
  const confirm = useConfirm()
  const { toast, success, error: errorToast } = useToast()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('companies')
      .select('id, name, slug, logo_url, owner_id, active, created_at, branches(id)')
      .order('created_at', { ascending: false })
    setCompanies((data as Company[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (isSuperAdmin) loadCompanies() }, [isSuperAdmin, loadCompanies])

  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, loadCompanies)
    return () => window.removeEventListener(REFRESH_EVENT, loadCompanies)
  }, [loadCompanies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [companies, search])

  const activeCount = companies.filter(c => c.active).length
  const totalBranches = companies.reduce((acc, c) => acc + (c.branches?.length ?? 0), 0)

  async function handleToggleActive(c: Company) {
    setBusyId(c.id)
    const res = await fetch('/api/companies/manage', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    })
    if (res.ok) {
      setCompanies(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))
      toast(!c.active ? `«${c.name}» включён` : `«${c.name}» отключён`, { kind: 'info' })
    } else {
      errorToast('Не удалось изменить статус')
    }
    setBusyId(null)
  }

  async function handleDelete(c: Company) {
    const branchCount = c.branches?.length ?? 0

    if (branchCount > 0) {
      await confirm({
        title: 'Сначала удалите филиалы',
        text: `У ресторана «${c.name}» ещё ${branchCount} ${plural(branchCount, ['филиал', 'филиала', 'филиалов'])}. Удалите их в разделе «Филиалы», затем возвращайтесь сюда.`,
        confirmLabel: 'Понятно',
        cancelLabel: 'Закрыть',
      })
      return
    }

    const ok = await confirm({
      title: `Удалить «${c.name}»?`,
      text: 'Ресторан будет удалён безвозвратно. Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok) return

    setBusyId(c.id)
    try {
      const res = await fetch('/api/companies/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось удалить ресторан')
      }
      setCompanies(prev => prev.filter(x => x.id !== c.id))
      success('Ресторан удалён', c.name)
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Не удалось удалить ресторан')
    }
    setBusyId(null)
  }

  if (!profileLoaded) {
    return <div className="grid grid--kpi-3"><KpiSkeleton count={3} /></div>
  }

  if (!isSuperAdmin) return <AccessDenied what="Рестораны" />

  return (
    <div className="stack">

      <div className="grid grid--kpi-3">
        {loading ? <KpiSkeleton count={3} /> : (
          <>
            <KpiCard label="Ресторанов" icon="restaurants" accent="mint"
              value={companies.length} sub="Подключено к платформе" />
            <KpiCard label="Активных" icon="check" accent="blue"
              value={activeCount} sub={`Отключено: ${companies.length - activeCount}`} />
            <KpiCard label="Филиалов" icon="branches" accent="purple"
              value={totalBranches} sub="По всем ресторанам" />
          </>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Поиск по названию или slug…" />
        <div className="toolbar__spacer">
          <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setModalOpen(true) }}>
            Добавить ресторан
          </Button>
        </div>
      </div>

      <Panel
        title="Рестораны"
        sub={search ? `Найдено ${filtered.length} из ${companies.length}` : `Всего ${companies.length}`}
      >
        {loading ? (
          <SkeletonRows rows={4} height={58} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={companies.length === 0 ? 'restaurants' : 'search'}
            title={companies.length === 0 ? 'Пока нет ресторанов' : 'Ничего не найдено'}
            text={companies.length === 0
              ? 'Добавьте первое заведение — после этого можно будет создавать филиалы и генерировать QR-коды.'
              : 'Попробуйте изменить запрос.'}
            action={companies.length === 0 && (
              <Button variant="primary" icon="plus" onClick={() => { setEditing(null); setModalOpen(true) }}>
                Добавить ресторан
              </Button>
            )}
          />
        ) : (
          filtered.map(c => {
            const branchCount = c.branches?.length ?? 0
            return (
              <div key={c.id} className="row-item">
                <div
                  className="thumb"
                  style={c.logo_url ? { background: `url(${c.logo_url}) center/cover` } : undefined}
                >
                  {!c.logo_url && <Icon name="restaurants" size={20} style={{ color: 'var(--text-muted)' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="truncate" style={{ fontSize: 14, fontWeight: 650 }}>{c.name}</span>
                    <StatusBadge active={c.active} />
                  </div>
                  <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    /{c.slug} · {branchCount} {plural(branchCount, ['филиал', 'филиала', 'филиалов'])} · c {shortDate(c.created_at)}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  <Switch
                    checked={c.active}
                    disabled={busyId === c.id}
                    onChange={() => handleToggleActive(c)}
                  />
                  <IconButton icon="edit" title="Редактировать"
                    onClick={() => { setEditing(c); setModalOpen(true) }} />
                  <IconButton icon="trash" title="Удалить" danger
                    disabled={busyId === c.id}
                    onClick={() => handleDelete(c)} />
                </div>
              </div>
            )
          })
        )}
      </Panel>

      {modalOpen && (
        <CompanyModal
          company={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={(msg) => {
            setModalOpen(false)
            setEditing(null)
            success(msg)
            loadCompanies()
          }}
        />
      )}
    </div>
  )
}
