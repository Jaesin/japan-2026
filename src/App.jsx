import { Routes, Route } from 'react-router-dom'
import PublicPage from './PublicPage'
import JoinPage from './portal/pages/JoinPage.jsx'
import PortalShell from './portal/PortalShell.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/portal/*" element={<PortalShell />} />
    </Routes>
  )
}

export default App
