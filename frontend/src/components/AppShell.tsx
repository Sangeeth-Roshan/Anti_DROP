import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useUpload } from '../context'
import {
  BarChart2, Users, Upload, ClipboardList,
  Database, ChevronRight, Brain
} from 'lucide-react'

const NAV = [
  { to: '/',        icon: BarChart2,    label: 'Dashboard'       },
  { to: '/students',icon: Users,        label: 'Students'        },
  { to: '/roster',  icon: ClipboardList,label: 'Faculty Roster'  },
  { to: '/upload',  icon: Upload,       label: 'Upload CSV'      },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { upload, setUpload } = useUpload()
  const navigate = useNavigate()

  function switchToDefault() {
    setUpload({ upload_id: 'default', label: 'Default Dataset', total: 0 })
    navigate('/')
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-surface-700 bg-surface-800/50 backdrop-blur-sm">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Brain size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-tight">AntiDROP</p>
              <p className="text-xs text-surface-400">Dropout Intervention</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
              id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Active dataset */}
        <div className="p-4 border-t border-surface-700">
          <div className="card-sm space-y-2">
            <div className="flex items-center gap-2 text-xs text-surface-400">
              <Database size={13} />
              <span className="uppercase tracking-wider font-semibold">Viewing</span>
            </div>
            <p className="text-sm font-medium text-surface-100 leading-tight">{upload.label}</p>
            {upload.total > 0 && (
              <p className="text-xs text-surface-400">{upload.total} students</p>
            )}
            {upload.upload_id !== 'default' && (
              <button
                onClick={switchToDefault}
                className="text-xs text-primary hover:text-primary-light flex items-center gap-1 transition-colors"
                id="switch-to-default-btn"
              >
                Switch to default <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

// ─── Skeleton loaders ────────────────────────────────────────────────────────
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-3 animate-pulse">
      <div className="skeleton h-4 w-1/3 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-3 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-10 rounded-b-none mb-0" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-surface-700 px-4 py-3 flex gap-4 animate-pulse">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-16 rounded ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ─── Error display ───────────────────────────────────────────────────────────
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="alert-error">
      <span className="text-lg">⚠️</span>
      <div>
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm mt-0.5">{message}</p>
        <p className="text-xs mt-2 text-red-400/70">Make sure the backend is running on port 8000.</p>
      </div>
    </div>
  )
}
