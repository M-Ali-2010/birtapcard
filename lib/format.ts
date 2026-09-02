/** Форматирование чисел, дат и склонений — общее для всех страниц. */

export function nf(n: number): string {
  return n.toLocaleString('ru-RU')
}

/** plural(3, ['филиал','филиала','филиалов']) → 'филиала' */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export function pluralWithCount(n: number, forms: [string, string, string]): string {
  return `${nf(n)} ${plural(n, forms)}`
}

/** «5 мин назад», «вчера, 14:20» */
export function relTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)

  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`

  const hours = Math.floor(min / 60)
  if (hours < 6) return `${hours} ${plural(hours, ['час', 'часа', 'часов'])} назад`

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (d.toDateString() === today) return hm
  if (d.toDateString() === yesterday) return `вчера, ${hm}`
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + `, ${hm}`
}

export function shortDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** Транслитерация в slug (кириллица → латиница) */
export function slugify(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  }
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/[а-яё]/g, ch => map[ch] ?? '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Скачивание CSV с BOM (корректно открывается в Excel) */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
