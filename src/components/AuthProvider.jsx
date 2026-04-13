import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

const ALLOWED_DOMAIN = 'viax.io'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [domainError, setDomainError] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s && !s.user?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        supabase.auth.signOut()
        setDomainError(true)
        setSession(null)
      } else {
        setSession(s)
        setDomainError(false)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s && !s.user?.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        supabase.auth.signOut()
        setDomainError(true)
        setSession(null)
      } else {
        setSession(s)
        setDomainError(false)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, loading, domainError, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
