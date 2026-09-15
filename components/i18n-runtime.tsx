'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { EN, EN_PATTERNS, EN_WORDS } from '@/lib/i18n/en'

/**
 * Язык панели. Русский — исходный (строки лежат прямо в компонентах).
 * Английский накладывается на DOM: переводим текстовые узлы и атрибуты
 * по словарю, MutationObserver подхватывает всё, что React дорисовывает.
 * Выбор хранится в localStorage btc:lang (тот же ключ, что и на экране скана).
 */

export type Lang = 'ru' | 'en'
const KEY = 'btc:lang'
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt']

type Ctx = { lang: Lang; setLang: (l: Lang) => void }
const LangCtx = createContext<Ctx>({ lang: 'ru', setLang: () => {} })
export const useLang = () => useContext(LangCtx)

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'ru') return v
  } catch {}
  return 'ru'
}

function translateText(raw: string): string | null {
  const key = raw.replace(/\s+/g, ' ').trim()
  if (!key || !/[А-Яа-яЁё]/.test(key)) return null
  let out: string | null = EN[key] ?? null
  if (out === null) {
    for (const [re, rep] of EN_PATTERNS) {
      if (re.test(key)) { out = key.replace(re, rep); break }
    }
  }
  if (out === null) {
    // По словам — только если знаем каждое русское слово в строке
    let ok = true
    const replaced = key.replace(/[А-Яа-яЁё]+/g, w => {
      const t = EN_WORDS[w] ?? EN_WORDS[w.toLowerCase()]
      if (t === undefined) { ok = false; return w }
      return t
    })
    if (ok) out = replaced
  }
  if (out === null) return null
  const lead = raw.match(/^\s*/)![0]
  const trail = raw.match(/\s*$/)![0]
  return lead + out + trail
}

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = translateText(node.nodeValue ?? '')
    if (t !== null && t !== node.nodeValue) node.nodeValue = t
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v) { const t = translateText(v); if (t !== null && t !== v) el.setAttribute(a, t) }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let n: Node | null
  while ((n = walker.nextNode())) {
    const t = translateText(n.nodeValue ?? '')
    if (t !== null && t !== n.nodeValue) n.nodeValue = t
  }
  // вложенные элементы с атрибутами
  el.querySelectorAll(ATTRS.map(a => `[${a}]`).join(',')).forEach(child => {
    for (const a of ATTRS) {
      const v = child.getAttribute(a)
      if (v) { const t = translateText(v); if (t !== null && t !== v) child.setAttribute(a, t) }
    }
  })
}

function installTranslator(): () => void {
  translateNode(document.body)
  const title = translateText(document.title)
  if (title) document.title = title
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target)
      else if (m.type === 'attributes') translateNode(m.target)
      else m.addedNodes.forEach(translateNode)
    }
  })
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  const titleObs = new MutationObserver(() => {
    const t = translateText(document.title)
    if (t && t !== document.title) document.title = t
  })
  const titleEl = document.querySelector('title')
  if (titleEl) titleObs.observe(titleEl, { childList: true, characterData: true, subtree: true })
  return () => { obs.disconnect(); titleObs.disconnect() }
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru')

  useEffect(() => { setLangState(readLang()) }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    if (lang !== 'en') return
    // после гидратации — иначе React пожалуется на расхождение текста
    const stop = installTranslator()
    return stop
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(KEY, l) } catch {}
    if (l === 'ru' && lang === 'en') {
      // обратно на русский: проще перерисовать страницу целиком
      window.location.reload()
      return
    }
    setLangState(l)
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
}

/** Переключатель с флагами: 🇷🇺 RU / 🇬🇧 EN */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang()
  const opts: { v: Lang; flag: string; label: string }[] = [
    { v: 'ru', flag: '🇷🇺', label: 'RU' },
    { v: 'en', flag: '🇬🇧', label: 'EN' },
  ]
  return (
    <div className={`langsw${compact ? ' langsw--compact' : ''}`} role="group" aria-label="Language">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          className={`langsw__btn${lang === o.v ? ' is-on' : ''}`}
          onClick={() => setLang(o.v)}
          aria-pressed={lang === o.v}
        >
          <span className="langsw__flag">{o.flag}</span>{!compact && o.label}
        </button>
      ))}
    </div>
  )
}
