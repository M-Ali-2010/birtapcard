'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Профиль текущего пользователя (кэш на уровне модуля) ─────────────────── */

export type AppProfile = {
  id: string
  user_id: string
  full_name: string | null
  role: string | null
  company_id: string | null
  branch_id: string | null
}

let cached: AppProfile | null | undefined
let inflight: Promise<AppProfile | null> | null = null

async function fetchProfile(): Promise<AppProfile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, role, company_id, branch_id')
    .eq('user_id', user.id)
    .single()
  return (data as AppProfile | null) ?? null
}

export function clearProfileCache() {
  cached = undefined
  inflight = null
}

/**
 * Профиль загружается один раз за сессию и переиспользуется всеми страницами —
 * переходы между разделами больше не ждут повторного запроса.
 */
export function useProfile() {
  const [profile, setProfile] = useState<AppProfile | null>(cached ?? null)
  const [loaded, setLoaded] = useState(cached !== undefined)

  useEffect(() => {
    if (cached !== undefined) {
      setProfile(cached)
      setLoaded(true)
      return
    }
    let alive = true
    if (!inflight) inflight = fetchProfile()
    inflight
      .then(p => {
        cached = p
        if (alive) { setProfile(p); setLoaded(true) }
      })
      .catch(() => {
        cached = null
        if (alive) { setProfile(null); setLoaded(true) }
      })
    return () => { alive = false }
  }, [])

  const role = profile?.role ?? null
  return {
    profile,
    loaded,
    role,
    isSuperAdmin: role === 'super_admin',
    isOwner: role === 'owner',
    isBranchManager: role === 'branch_manager',
  }
}

/* ─── Медиа-запрос ────────────────────────────────────────────────────────── */

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export function useIsMobile() { return useMediaQuery('(max-width: 1024px)') }

/* ─── Сохраняемое состояние ───────────────────────────────────────────────── */

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {}
    loaded.current = true
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  }, [key, value])

  return [value, setValue] as const
}
