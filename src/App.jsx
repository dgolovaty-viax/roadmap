import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Nav from '@/components/Nav'
import { AuthProvider, useAuth } from '@/components/AuthProvider'
import LoginPage from '@/pages/LoginPage'
import RoadmapPage from '@/pages/RoadmapPage'
import NorthStarPage from '@/pages/NorthStarPage'
import PlanningPage from '@/pages/PlanningPage'
import SessionPage from '@/pages/SessionPage'
import IdeasPage from '@/pages/IdeasPage'
import IdeaVotePage from '@/pages/IdeaVotePage'

// Public paths that don't require authentication
const PUBLIC_PATH_PREFIX = '/ideas/vote/'

function AppContent() {
  const { session, loading } = useAuth()
  const location = useLocation()

  const isPublicRoute = location.pathname.startsWith(PUBLIC_PATH_PREFIX)

  // Show nothing while loading auth state (prevents flash)
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#F8F7F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Funnel Sans', 'Inter', system-ui, sans-serif",
      }}>
        <span style={{ color: '#AAAAAA', fontSize: 14 }}>Loading…</span>
      </div>
    )
  }

  // Public voting routes — no auth required, no Nav
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/ideas/vote/:sessionId" element={<IdeaVotePage />} />
      </Routes>
    )
  }

  // Not authenticated — show login page
  if (!session) {
    return <LoginPage />
  }

  // Authenticated — show full app
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ fontFamily: "'Funnel Sans', 'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<RoadmapPage />} />
          <Route path="/north-star" element={<NorthStarPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/planning/epics/:epicId" element={<PlanningPage />} />
          <Route path="/planning/session/:sessionId" element={<SessionPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="*" element={<RoadmapPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
