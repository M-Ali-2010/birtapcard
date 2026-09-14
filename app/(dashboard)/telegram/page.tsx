'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/lib/hooks'
import { REFRESH_EVENT } from '@/components/nav-config'
import { Icon } from '@/components/ui/icons'
import {
  AccessDenied, Badge, Button, EmptyState, Field, KpiSkeleton,
  Note, Panel, Skeleton, Switch,
} from '@/components/ui/kit'
import { useToast } from '@/components/ui/toast'

/* ─── Типы ───────────────────────────────────────────────────────────────── */

type TelegramSetting = {
  id: string
  company_id: string
  chat_id: string | null
  notify_daily: boolean
  active: boolean
  created_at: string
  companies?: { name: string; slug: string } | null
}

type CompanyOption = { id: string; name: string }

/* ─── Карточка компании ──────────────────────────────────────────────────── */

function CompanyTelegramCard({
  company, setting, onSave,
}: {
  company: CompanyOption
  setting: TelegramSetting | null
  onSave: (companyId: string, data: { chat_id: string; notify_daily: boolean; active: boolean }) => Promise<void>
}) {
  const { success, error: errorToast } = useToast()
  const [chatId, setChatId] = useState(setting?.chat_id ?? '')
  const [notifyDaily, setNotifyDaily] = useState(setting?.notify_daily ?? true)
  const [active, setActive] = useState(setting?.active ?? false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setChatId(setting?.chat_id ?? '')
    setNotifyDaily(setting?.notify_daily ?? true)
    setActive(setting?.active ?? false)
  }, [setting])

  const dirty =
    chatId !== (setting?.chat_id ?? '') ||
    notifyDaily !== (setting?.notify_daily ?? true) ||
    active !== (setting?.active ?? false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(company.id, { chat_id: chatId.trim(), notify_daily: notifyDaily, active })
      success('Настройки сохранены', company.name)
    } catch {
      errorToast('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!chatId.trim()) {
      errorToast('Сначала укажите Chat ID')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId.trim(), company_name: company.name }),
      })
      const json = await res.json()
      if (res.ok && json.ok) success('Тестовое сообщение отправлено', 'Проверьте чат в Telegram')
      else errorToast(json.error ?? 'Telegram не ответил')
    } catch {
      errorToast('Ошибка подключения к Telegram')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Panel
      title={company.name}
      sub={setting ? 'Настройки сохранены' : 'Ещё не настроено'}
      action={
        <Badge tone={active ? 'mint' : 'muted'} dot>
          {active ? 'Активен' : 'Отключён'}
        </Badge>
      }
    >
      <Field label="Chat ID" hint="ID чата или канала Telegram — например, -1001234567890">
        <input
          className="input mono"
          value={chatId}
          inputMode="numeric"
          onChange={e => setChatId(e.target.value)}
          placeholder="-1001234567890"
        />
      </Field>

      <div className="stack" style={{ gap: 9, marginBottom: 16 }}>
        <Switch checked={notifyDaily} onChange={setNotifyDaily}
          label="Ежедневный отчёт каждое утро в 08:00 (Ташкент)" />
        <Switch checked={active} onChange={setActive}
          label="Уведомления включены" />
      </div>

      <div className="row row--wrap" style={{ gap: 9 }}>
        <Button variant="primary" icon="save" loading={saving} onClick={handleSave}>
          Сохранить
        </Button>
        <Button icon="bell" loading={testing} disabled={!chatId.trim()} onClick={handleTest}>
          Проверить подключение
        </Button>
        {dirty && !saving && (
          <span style={{ fontSize: 11.5, color: 'var(--warning)', alignSelf: 'center' }}>
            есть несохранённые изменения
          </span>
        )}
      </div>
    </Panel>
  )
}

/* ─── Подключение бота (вебхук) ──────────────────────────────────────────── */

type BotStatus = {
  tokenSet: boolean
  secretSet: boolean
  expected: string
  connected?: boolean
  error?: string
  info: { url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number } | null
}

function BotSetupCard() {
  const { success, error: errorToast } = useToast()
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/telegram/setup')
      setStatus(await res.json())
    } catch {
      setStatus(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function connect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/telegram/setup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Не удалось подключить')
      success('Бот подключён', json.url)
      await load()
    } catch (e) {
      errorToast(e instanceof Error ? e.message : 'Не удалось подключить')
    }
    setConnecting(false)
  }

  const tone: 'mint' | 'orange' | 'danger' | 'muted' =
    loading ? 'muted'
    : !status?.tokenSet ? 'danger'
    : status.connected ? 'mint'
    : 'orange'

  const label =
    loading ? 'проверяем…'
    : !status?.tokenSet ? 'нет токена'
    : status.connected ? 'подключён'
    : status.info?.url ? 'смотрит на другой адрес'
    : 'не подключён'

  return (
    <Panel
      title="Бот"
      sub="Куда Telegram отправляет сообщения от пользователей"
      action={<Badge tone={tone} dot>{label}</Badge>}
    >
      {loading ? (
        <Skeleton h={64} r={12} />
      ) : !status?.tokenSet ? (
        <Note tone="danger">
          В Vercel не задан <strong>TELEGRAM_BOT_TOKEN</strong> — без него бот не работает.
          Settings → Environment Variables → добавить → Redeploy.
        </Note>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 6, fontSize: 13 }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>Сейчас вебхук</span>
              <span className="mono truncate" style={{ fontSize: 12 }}>{status.info?.url || '— не установлен —'}</span>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>Должен быть</span>
              <span className="mono truncate" style={{ fontSize: 12 }}>{status.expected}</span>
            </div>
            {status.info && status.info.pending_update_count > 0 && (
              <div className="row" style={{ gap: 10 }}>
                <span style={{ color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>В очереди</span>
                <span>{status.info.pending_update_count} сообщений</span>
              </div>
            )}
            {status.info?.last_error_message && (
              <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>Последняя ошибка</span>
                <span style={{ color: 'var(--danger)' }}>{status.info.last_error_message}</span>
              </div>
            )}
          </div>

          {!status.secretSet && (
            <Note tone="warning">
              Не задан <strong>TELEGRAM_WEBHOOK_SECRET</strong> — бот принимает запросы от кого угодно.
              Добавьте в Vercel любую длинную случайную строку, сделайте Redeploy и нажмите «Подключить» ещё раз —
              секрет передастся в Telegram автоматически.
            </Note>
          )}

          <div className="row row--wrap" style={{ gap: 9 }}>
            <Button variant={status.connected ? 'ghost' : 'primary'} icon="telegram" loading={connecting} onClick={connect}>
              {status.connected ? 'Переподключить' : 'Подключить бота'}
            </Button>
            <Button icon="refresh" onClick={load}>Обновить статус</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ─── Страница ───────────────────────────────────────────────────────────── */

export default function TelegramPage() {
  const { loaded: profileLoaded, isSuperAdmin } = useProfile()

  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [settings, setSettings] = useState<TelegramSetting[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Telegram настраивает только super_admin
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('active', true)
      .order('name')
    const companiesData = (data as CompanyOption[] | null) ?? []
    setCompanies(companiesData)

    if (companiesData.length > 0) {
      const ids = companiesData.map(c => c.id)
      const { data: tgData } = await supabase
        .from('telegram_settings')
        .select('*')
        .in('company_id', ids)
      setSettings((tgData as TelegramSetting[] | null) ?? [])
    } else {
      setSettings([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!profileLoaded) return
    if (isSuperAdmin) load()
    else setLoading(false)
  }, [profileLoaded, isSuperAdmin, load])

  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, load)
    return () => window.removeEventListener(REFRESH_EVENT, load)
  }, [load])

  async function handleSave(
    companyId: string,
    data: { chat_id: string; notify_daily: boolean; active: boolean },
  ) {
    const existing = settings.find(s => s.company_id === companyId)
    const res = await fetch('/api/telegram/settings', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing ? { id: existing.id, ...data } : { company_id: companyId, ...data }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? 'Не удалось сохранить')
    }
    await load()
  }

  if (!profileLoaded) return <div className="grid grid--kpi-3"><KpiSkeleton count={3} /></div>
  if (!isSuperAdmin) return <AccessDenied what="Telegram" />

  const activeCount = settings.filter(s => s.active).length

  return (
    <div className="stack" style={{ maxWidth: 960 }}>

      {/* Как это работает */}
      <div className="spotlight">
        <div className="row" style={{ marginBottom: 10, position: 'relative' }}>
          <Badge tone="mint"><Icon name="sparkles" size={11} /> КАК ЭТО РАБОТАЕТ</Badge>
          {!loading && (
            <span className="toolbar__spacer" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              подключено: {activeCount} из {companies.length}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-dim)', position: 'relative' }}>
          <strong style={{ color: 'var(--text)' }}>Ежедневные отчёты</strong> уходят каждое утро в{' '}
          <strong style={{ color: 'var(--mint)' }}>08:00 по Ташкенту</strong>: сканирования, уникальные
          посетители, конверсия и лучший филиал дня. Укажите Chat ID вашего чата или канала
          и нажмите «Проверить подключение».
        </div>
      </div>

      <BotSetupCard />

      {/* Пример отчёта */}
      <Panel title="Пример отчёта" sub="Так это выглядит в Telegram">
        <div
          className="mono"
          style={{
            background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: 15,
            fontSize: 12.5, lineHeight: 1.9, border: '1px solid var(--border)',
            overflowX: 'auto',
          }}
        >
          <div style={{ color: 'var(--mint)', fontWeight: 700, marginBottom: 6 }}>
            📊 BirTapCard · Отчёт за 26.06.2026
          </div>
          <div>🏪 <strong>Grand Registan</strong></div>
          <div style={{ color: 'var(--text-dim)' }}>📡 NFC: 247 сканирований</div>
          <div style={{ color: 'var(--text-dim)' }}>⬛ QR: 389 сканирований</div>
          <div style={{ color: 'var(--mint)' }}>📈 Конверсия: 81.3%</div>
          <div style={{ color: 'var(--text-dim)' }}>👥 Уникальных: 512</div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11 }}>
            🏆 Лучший филиал: Grand Airport (+23%)
          </div>
        </div>
      </Panel>

      {/* Настройки по компаниям */}
      {loading ? (
        <div className="stack">
          <Skeleton h={240} r={18} />
          <Skeleton h={240} r={18} />
        </div>
      ) : companies.length === 0 ? (
        <Panel>
          <EmptyState
            icon="restaurants"
            title="Нет активных ресторанов"
            text="Добавьте ресторан в разделе «Рестораны» — после этого его можно будет подключить к Telegram."
          />
        </Panel>
      ) : (
        <div className="stack">
          {companies.map(company => (
            <CompanyTelegramCard
              key={company.id}
              company={company}
              setting={settings.find(s => s.company_id === company.id) ?? null}
              onSave={handleSave}
            />
          ))}
        </div>
      )}

      {/* Инструкция */}
      <Panel title="Как получить Chat ID" sub="Четыре шага">
        <div className="stack" style={{ gap: 12 }}>
          {[
            'Создайте Telegram-бота через @BotFather и получите токен (в системе он уже задан).',
            'Добавьте бота в ваш чат или канал как администратора.',
            'Перешлите любое сообщение из чата боту @userinfobot — он покажет Chat ID.',
            'Для каналов Chat ID начинается с -100…',
          ].map((text, i) => (
            <div key={i} className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: 'var(--mint-dim)', color: 'var(--mint)',
                fontWeight: 700, fontSize: 12,
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, paddingTop: 4 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Note tone="info">
        Отчёт отправляется только тем ресторанам, у которых включён переключатель
        «Уведомления включены» и указан корректный Chat ID.
      </Note>
    </div>
  )
}
