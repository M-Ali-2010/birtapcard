'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { plural } from '@/lib/format'
import { Icon } from '@/components/ui/icons'
import { QrPreviewModal } from '@/components/qr-preview-modal'
import {
  AccessDenied, Button, CopyField, EmptyState, KpiCard, KpiSkeleton,
  Note, Panel, Portal, SearchInput, Skeleton, StatusBadge,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type CompanyOption = { id: string; name: string; active: boolean }

type BranchRow = {
  id: string
  company_id: string
  name: string
  slug: string
  qr_url: string
  qr_image_url: string | null
  active: boolean
  created_at: string
  companies?: { name: string; slug: string } | null
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'missing'

/* ─── Карточка QR ────────────────────────────────────────────────────────── */

function QrCard({
  branch, selected, onToggleSelect, onPreview,
}: {
  branch: BranchRow
  selected: boolean
  onToggleSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className="card"
      style={{
        padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
        borderColor: selected ? 'var(--mint)' : undefined,
        boxShadow: selected ? '0 0 0 1px var(--mint-dim), var(--sh-2)' : undefined,
        transition: 'border-color .18s, box-shadow .18s',
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          onClick={onPreview}
          title="Показать QR-код"
          style={{
            width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--r-md)', padding: 12,
            background: '#fff', border: '1px solid var(--border)', cursor: 'pointer',
            display: 'grid', placeItems: 'center', overflow: 'hidden',
          }}
        >
          {branch.qr_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branch.qr_image_url} alt={`QR-код ${branch.name}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          ) : (
            <Icon name="qrcodes" size={30} style={{ color: '#B8C2CF' }} />
          )}
        </button>

        <button
          onClick={onToggleSelect}
          aria-label={selected ? 'Убрать из печати' : 'Добавить в печать'}
          title={selected ? 'Убрать из печати' : 'Добавить в печать'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26, borderRadius: 8, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            background: selected ? 'var(--mint)' : 'rgba(255,255,255,0.92)',
            border: `1px solid ${selected ? 'var(--mint)' : '#CBD5E1'}`,
            color: selected ? '#04121C' : '#94A3B8',
          }}
        >
          <Icon name="check" size={14} strokeWidth={3} />
        </button>
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 7, marginBottom: 3 }}>
          <span className="truncate" style={{ fontSize: 13, fontWeight: 650, flex: 1 }}>{branch.name}</span>
          <StatusBadge active={branch.active} />
        </div>
        <div className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {branch.companies?.name ?? '—'} · /{branch.slug}
        </div>
      </div>

      <CopyField value={branch.qr_url} compact />

      <div className="row" style={{ gap: 7 }}>
        <Button size="sm" icon="eye" onClick={onPreview}>Просмотр</Button>
        {branch.qr_image_url ? (
          <a href={branch.qr_image_url} download={`qr-${branch.slug}.png`} style={{ flex: 1, textDecoration: 'none' }}>
            <span className="btn btn--primary btn--sm btn--block">
              <Icon name="download" size={13} /> PNG
            </span>
          </a>
        ) : (
          <Button size="sm" disabled block>PNG</Button>
        )}
      </div>
    </div>
  )
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function QrCodesPage() {
  const { loaded: profileLoaded, isSuperAdmin } = useProfile()
  const { toast } = useToast()

  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [preview, setPreview] = useState<BranchRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [companiesRes, branchesRes] = await Promise.all([
      supabase.from('companies').select('id, name, active').order('name'),
      supabase
        .from('branches')
        .select('id, company_id, name, slug, qr_url, qr_image_url, active, created_at, companies(name, slug)')
        .order('created_at', { ascending: false }),
    ])

    setCompanies((companiesRes.data as CompanyOption[] | null) ?? [])
    setBranches((branchesRes.data as unknown as BranchRow[] | null) ?? [])
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
    if (statusFilter === 'active') list = list.filter(b => b.active)
    if (statusFilter === 'inactive') list = list.filter(b => !b.active)
    if (statusFilter === 'missing') list = list.filter(b => !b.qr_image_url)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.companies?.name ?? '').toLowerCase().includes(q))
    }
    return list
  }, [branches, companyFilter, statusFilter, search])

  const withQrCount = branches.filter(b => !!b.qr_image_url).length
  const withoutQrCount = branches.length - withQrCount
  const activeCount = branches.filter(b => b.active).length

  const printable = useMemo(
    () => filtered.filter(b => selected.has(b.id) && b.qr_image_url),
    [filtered, selected],
  )

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    const withQr = filtered.filter(b => b.qr_image_url).map(b => b.id)
    setSelected(prev => (prev.size >= withQr.length ? new Set() : new Set(withQr)))
  }

  /** Печать листа наклеек: только выбранные QR-коды, по 3 в ряд. */
  function printSheet() {
    if (printable.length === 0) {
      toast('Выберите хотя бы один QR-код', { kind: 'error' })
      return
    }
    document.body.classList.add('printing')
    const cleanup = () => {
      document.body.classList.remove('printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    setTimeout(() => window.print(), 60)
  }

  if (!profileLoaded) {
    return <div className="grid grid--kpi-3"><KpiSkeleton count={3} /></div>
  }

  if (!isSuperAdmin) return <AccessDenied what="QR-коды" />

  return (
    <div className="stack">

      <div className="grid grid--kpi-3">
        {loading ? <KpiSkeleton count={3} /> : (
          <>
            <KpiCard label="Всего QR-кодов" icon="qrcodes" accent="mint"
              value={branches.length} sub="По всем филиалам" />
            <KpiCard label="Сгенерировано" icon="check" accent="blue"
              value={withQrCount} sub={`Активных филиалов: ${activeCount}`} />
            <KpiCard label="Не сгенерировано" icon="alert" accent="orange"
              value={withoutQrCount} sub="Создаются в разделе «Филиалы»" />
          </>
        )}
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <select className="select" value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)} style={{ width: 'auto', maxWidth: 220 }}>
          <option value="all">Все рестораны</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="select" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ width: 'auto', maxWidth: 200 }}>
          <option value="all">Все статусы</option>
          <option value="active">Только активные</option>
          <option value="inactive">Только отключённые</option>
          <option value="missing">Без QR-кода</option>
        </select>

        <SearchInput value={search} onChange={setSearch} placeholder="Поиск филиала…" />
      </div>

      {branches.length === 0 && !loading && (
        <Note tone="warning">
          Пока нет ни одного филиала. Добавьте филиал в разделе «Филиалы» — QR-код сгенерируется автоматически.
        </Note>
      )}

      <Panel
        title="QR-коды филиалов"
        sub={`${filtered.length} из ${branches.length} · отмечено для печати: ${printable.length}`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" icon="check" onClick={selectAll}>
              {selected.size > 0 ? 'Снять' : 'Выбрать все'}
            </Button>
            <Button size="sm" variant="primary" icon="print" onClick={printSheet}>
              Печать{printable.length > 0 ? ` (${printable.length})` : ''}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="grid grid--cards">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={260} r={16} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="qrcodes"
            title="Ничего не найдено"
            text="Измените фильтры или добавьте филиалы — QR-коды создаются вместе с ними."
          />
        ) : (
          <div className="grid grid--cards">
            {filtered.map(b => (
              <QrCard
                key={b.id}
                branch={b}
                selected={selected.has(b.id)}
                onToggleSelect={() => toggleSelect(b.id)}
                onPreview={() => setPreview(b)}
              />
            ))}
          </div>
        )}
      </Panel>

      <Note tone="info">
        Отметьте нужные QR-коды галочкой и нажмите «Печать» — получится готовый лист наклеек
        по три в ряд с названием филиала под каждым кодом.
      </Note>

      {/* Лист для печати — виден только принтеру (портал в <body>) */}
      <Portal>
        <div className="print-only">
          <div className="print-head">
            BirTapCard · QR-коды ({printable.length} {plural(printable.length, ['код', 'кода', 'кодов'])})
          </div>
          <div className="print-sheet">
            {printable.map(b => (
              <div key={b.id} className="print-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.qr_image_url!} alt={b.name} />
                <div className="print-card__name">{b.name}</div>
                <div className="print-card__sub">{b.companies?.name ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      </Portal>

      {preview && (
        <QrPreviewModal
          title={preview.name}
          sub={preview.companies?.name ?? undefined}
          imageUrl={preview.qr_image_url}
          url={preview.qr_url}
          slug={preview.slug}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
