import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from '@/components/Nav'
import RoadmapPage from '@/pages/RoadmapPage'
import NorthStarPage from '@/pages/NorthStarPage'
import PlanningPage from '@/pages/PlanningPage'
import SessionPage from '@/pages/SessionPage'
import IdeasPage from '@/pages/IdeasPage'
import IdeaVotePage from '@/pages/IdeaVotePage'

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="/ideas/vote/:sessionId" element={<IdeaVotePage />} />
            <Route path="*" element={<RoadmapPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
