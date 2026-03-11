import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const enforceViaxDomain = async (session) => {
    const u = session?.user ?? null
    if (u && !u.email?.endsWith('@viax.io')) {
      await supabase.auth.signOut()
      setError('Access restricted to @viax.io accounts.')
      setUser(null)
      return null
    }
    setError(null)
    return u
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = await enforceViaxDomain(session)
      setUser(u)
      setLoading(false)
    })

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = await enforceViaxDomain(session)
        setUser(u)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = () => {
    setError(null)
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        hd: 'viax.io', // hints Google to show only @viax.io accounts
        redirectTo: window.location.origin,
      },
    })
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
