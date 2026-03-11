import { Routes, Route } from 'react-router-dom'
import RoadmapPage from './pages/RoadmapPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoadmapPage />} />
    </Routes>
  )
}
