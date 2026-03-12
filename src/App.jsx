import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from '@/components/Nav'
import RoadmapPage from '@/pages/RoadmapPage'
import PlanningPage from '@/pages/PlanningPage'

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
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="*" element={<RoadmapPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
