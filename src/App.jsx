import { Routes, Route } from 'react-router-dom'
import PublicPage from './PublicPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
    </Routes>
  )
}

export default App
