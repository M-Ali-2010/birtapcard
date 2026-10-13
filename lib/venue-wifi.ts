/**
 * lib/venue-wifi.ts
 *
 * Wi-Fi заведения для карточки «Wi-Fi» на экране ссылок (сейчас она есть у
 * PDP School — lib/screens/pdp-school.ts).
 *
 * Сеть и пароль лежат в таблице venue_wifi (миграция 0009) и вводятся в боте:
 * карточка заведения → «📶 Wi-Fi на карточке». Переменные окружения и деплой для
 * этого не нужны. Пароль не хранится в репозитории и не попадает в отчёты.
 *
 * Чтение «мягкое»: если таблицы ещё нет или запрос не удался, экран открывается
 * без карточки Wi-Fi (или с запасным вариантом из переменных PDP_WIFI_*) —
 * гость не должен получать ошибку из-за настройки.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isPdpSchoolCompany, type PdpWifi } from '@/lib/screens/pdp-school'

/** 802.11: имя сети — до 32 байт (кириллица занимает по два) */
export const WIFI_SSID_MAX_BYTES = 32
/** WPA2: парольная фраза — 8…63 символа. Нижнюю границу не навязываем, верхнюю держим */
export const WIFI_PASSWORD_MAX = 64

/** Есть ли у экрана этого заведения карточка Wi-Fi (пока только у PDP School) */
export function venueSupportsWifi(companyName: unknown): boolean {
  return isPdpSchoolCompany(companyName)
}

function toWifi(row: { ssid?: unknown; password?: unknown } | null | undefined): PdpWifi | null {
  const ssid = typeof row?.ssid === 'string' ? row.ssid.trim() : ''
  if (!ssid) return null
  const password = typeof row?.password === 'string' ? row.password.trim() : ''
  return { ssid, password: password || undefined }
}

export type WifiRead = { wifi: PdpWifi | null; error: string | null }

/** Wi-Fi заведения; error заполнен, если прочитать не удалось (например, нет таблицы) */
export async function readVenueWifi(
  supabase: SupabaseClient,
  companyId: string | null | undefined
): Promise<WifiRead> {
  if (!companyId) return { wifi: null, error: null }
  try {
    const { data, error } = await supabase
      .from('venue_wifi').select('ssid, password').eq('company_id', companyId).maybeSingle()
    if (error) return { wifi: null, error: error.message }
    return { wifi: toWifi(data), error: null }
  } catch (err) {
    return { wifi: null, error: String(err) }
  }
}

/** Wi-Fi заведения для экрана гостя: любая ошибка чтения = «карточки нет» */
export async function getVenueWifi(
  supabase: SupabaseClient,
  companyId: string | null | undefined
): Promise<PdpWifi | null> {
  return (await readVenueWifi(supabase, companyId)).wifi
}

/** Wi-Fi PDP School для открытого демо /pdp/links, где токена филиала нет */
export async function getPdpSchoolWifi(supabase: SupabaseClient): Promise<PdpWifi | null> {
  try {
    const { data: companies } = await supabase.from('companies').select('id, name').ilike('name', '%pdp%')
    const ids = (companies ?? []).filter(c => isPdpSchoolCompany(c.name)).map(c => c.id as string)
    if (!ids.length) return null
    const { data } = await supabase
      .from('venue_wifi').select('ssid, password').in('company_id', ids).order('updated_at', { ascending: false }).limit(1)
    return toWifi(data?.[0])
  } catch {
    return null
  }
}

export type SaveWifiResult = { ok: true } | { ok: false; error: string }

export async function saveVenueWifi(
  supabase: SupabaseClient,
  companyId: string,
  wifi: { ssid: string; password: string | null },
  updatedBy: number | null
): Promise<SaveWifiResult> {
  try {
    const { error } = await supabase.from('venue_wifi').upsert({
      company_id: companyId,
      ssid: wifi.ssid,
      password: wifi.password,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function deleteVenueWifi(supabase: SupabaseClient, companyId: string): Promise<SaveWifiResult> {
  try {
    const { error } = await supabase.from('venue_wifi').delete().eq('company_id', companyId)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Проверка ввода из бота ──────────────────────────────────────────────────

export type ParsedSsid = { ok: true; ssid: string } | { ok: false; reason: string }
export type ParsedPassword = { ok: true; password: string | null } | { ok: false; reason: string }

export function parseWifiSsid(input: string): ParsedSsid {
  const ssid = input.trim()
  if (!ssid) return { ok: false, reason: 'Название сети пустое.' }
  if (Buffer.byteLength(ssid, 'utf8') > WIFI_SSID_MAX_BYTES) {
    return { ok: false, reason: `Название сети длиннее ${WIFI_SSID_MAX_BYTES} байт — у Wi-Fi такого не бывает.` }
  }
  return { ok: true, ssid }
}

/** «-» — сеть без пароля (открытая) */
export function parseWifiPassword(input: string): ParsedPassword {
  const value = input.trim()
  if (!value) return { ok: false, reason: 'Пароль пустой.' }
  if (value === '-') return { ok: true, password: null }
  if (value.length > WIFI_PASSWORD_MAX) {
    return { ok: false, reason: `Пароль длиннее ${WIFI_PASSWORD_MAX} символов — у Wi-Fi такого не бывает.` }
  }
  return { ok: true, password: value }
}
