/**
 * lib/venue-links.ts
 *
 * Ссылки экрана заведения (отзыв, сайт, бот, канал, Instagram, Google Play, App Store),
 * которые администратор меняет в боте: заведение → «🔗 Ссылки экрана».
 * Хранятся в таблице venue_links (миграция 0010). Нет записи — экран берёт значение по умолчанию.
 *
 * Чтение «мягкое», как у Wi-Fi: нет таблицы или запрос упал — экран открывается со ссылками
 * по умолчанию, гость ошибки не видит.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isPdpSchoolCompany, LINK_KEYS, type LinkKey, type VenueLinks } from '@/lib/screens/pdp-school'

export { LINK_KEYS }
export type { LinkKey, VenueLinks }

/** Есть ли у экрана заведения настраиваемые ссылки (пока только у PDP School — экран PDP) */
export function venueHasLinksScreen(companyName: unknown): boolean {
  return isPdpSchoolCompany(companyName)
}

function isKey(k: unknown): k is LinkKey {
  return typeof k === 'string' && (LINK_KEYS as readonly string[]).includes(k)
}

function toLinks(rows: { key?: unknown; url?: unknown }[] | null | undefined): VenueLinks {
  const out: VenueLinks = {}
  for (const r of rows ?? []) {
    if (isKey(r.key) && typeof r.url === 'string' && r.url.trim()) out[r.key] = r.url.trim()
  }
  return out
}

export type LinksRead = { links: VenueLinks; error: string | null }

export async function readVenueLinks(supabase: SupabaseClient, companyId: string | null | undefined): Promise<LinksRead> {
  if (!companyId) return { links: {}, error: null }
  try {
    const { data, error } = await supabase.from('venue_links').select('key, url').eq('company_id', companyId)
    if (error) return { links: {}, error: error.message }
    return { links: toLinks(data), error: null }
  } catch (err) {
    return { links: {}, error: String(err) }
  }
}

/** Для экрана гостя: любая ошибка чтения = «своих ссылок нет» */
export async function getVenueLinks(supabase: SupabaseClient, companyId: string | null | undefined): Promise<VenueLinks> {
  return (await readVenueLinks(supabase, companyId)).links
}

/** Ссылки PDP School для открытого демо /pdp/links, где токена филиала нет */
export async function getPdpSchoolLinks(supabase: SupabaseClient): Promise<VenueLinks> {
  try {
    const { data: companies } = await supabase.from('companies').select('id, name').ilike('name', '%pdp%')
    const ids = (companies ?? []).filter(c => isPdpSchoolCompany(c.name)).map(c => c.id as string)
    if (!ids.length) return {}
    const { data } = await supabase.from('venue_links').select('key, url').in('company_id', ids)
    return toLinks(data)
  } catch {
    return {}
  }
}

export type LinkWrite = { ok: true } | { ok: false; error: string }

export async function saveVenueLink(
  supabase: SupabaseClient, companyId: string, key: LinkKey, url: string, updatedBy: number | null
): Promise<LinkWrite> {
  try {
    const { error } = await supabase.from('venue_links').upsert({
      company_id: companyId, key, url, updated_by: updatedBy, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,key' })
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function resetVenueLink(supabase: SupabaseClient, companyId: string, key: LinkKey): Promise<LinkWrite> {
  try {
    const { error } = await supabase.from('venue_links').delete().eq('company_id', companyId).eq('key', key)
    return error ? { ok: false, error: error.message } : { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Что вводит администратор ────────────────────────────────────────────────

export type ParsedLink = { ok: true; url: string } | { ok: false; reason: string }

const HANDLE = /^@?([A-Za-z0-9_.]{3,})$/

/**
 * Приводит введённое к ссылке:
 *   · @имя для Telegram-бота и канала → https://t.me/имя, для Instagram → https://www.instagram.com/имя/;
 *   · ссылка на Instagram очищается от служебных параметров (?srtk=…, ?igsh=…);
 *   · остальное — любой http(s)-адрес.
 */
export function parseLinkInput(key: LinkKey, input: string): ParsedLink {
  const text = input.trim()
  if (!text) return { ok: false, reason: 'Пустое сообщение.' }
  if (text.length > 500) return { ok: false, reason: 'Ссылка длиннее 500 символов.' }

  const handle = HANDLE.exec(text)
  if (handle && (key === 'bot' || key === 'channel')) return { ok: true, url: `https://t.me/${handle[1]}` }
  if (handle && key === 'instagram') return { ok: true, url: `https://www.instagram.com/${handle[1]}/` }

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  let u: URL
  try { u = new URL(withScheme) } catch { return { ok: false, reason: 'Это не похоже на ссылку.' } }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: 'Нужна ссылка, которая начинается с https://' }
  if (!u.hostname.includes('.')) return { ok: false, reason: 'Это не похоже на ссылку.' }

  if (key === 'instagram' && /(^|\.)instagram\.com$/i.test(u.hostname)) {
    const seg = u.pathname.split('/').filter(Boolean)[0]
    if (seg && /^[A-Za-z0-9_.]+$/.test(seg)) return { ok: true, url: `https://www.instagram.com/${seg}/` }
  }
  return { ok: true, url: u.toString() }
}
