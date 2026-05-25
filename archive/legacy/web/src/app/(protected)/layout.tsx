'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { StarField } from '@/components/StarField'
import { useAuth } from '@/contexts/AuthContext'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/attendance', label: 'Logs', icon: ClipboardList },
]

function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[220px] flex-col justify-between border-r hidden md:flex"
      style={{
        background: 'rgba(0,0,0,0.8)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 50,
      }}
    >
      {/* Top: Logo */}
      <div>
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7v10l9 5 9-5V7L12 2z"
                stroke="rgba(167,139,250,1)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 2v20M3 7l9 5 9-5"
                stroke="rgba(167,139,250,0.4)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Zenith</span>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Attendance Tracker
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname ? (pathname === href || pathname.startsWith(href + '/')) : false
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                  color: active ? 'rgba(167,139,250,1)' : 'var(--text-muted)',
                  border: active ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
                {active && (
                  <ChevronRight size={12} className="ml-auto opacity-60" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom: User + logout */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            {user.picture ? (
              <Image
                src={user.picture}
                alt={user.name}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: 'var(--accent-glow)', color: '#c4b5fd' }}
              >
                {user.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            e.currentTarget.style.color = 'var(--red)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-4 py-3 md:hidden"
      style={{
        background: 'rgba(0,0,0,0.9)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname ? (pathname === href || pathname.startsWith(href + '/')) : false
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 text-[10px] transition-colors"
            style={{ color: active ? 'rgba(167,139,250,1)' : 'var(--text-muted)' }}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-5 h-5 rounded-full border border-white/20 border-t-white/80 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-black">
      <StarField count={100} speed={0.25} opacity={0.5} />
      <Sidebar />
      <BottomNav />

      {/* Main content */}
      <main
        className="relative z-10 md:ml-[220px] min-h-screen pb-20 md:pb-0"
        style={{ padding: '0' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto px-4 md:px-8 py-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
