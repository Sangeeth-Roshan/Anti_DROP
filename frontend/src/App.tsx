import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context'
import { AppShell } from './components/AppShell'
import { Dashboard }     from './pages/Dashboard'
import { Students }      from './pages/Students'
import { StudentDetail } from './pages/StudentDetail'
import { UploadPage }    from './pages/Upload'
import { Roster }        from './pages/Roster'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/students"   element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/upload"     element={<UploadPage />} />
            <Route path="/roster"     element={<Roster />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  )
}
