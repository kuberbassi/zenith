'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import { StarField } from '@/components/StarField'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard')
  }, [isAuthenticated, isLoading, router])

  const handleGoogleSuccess = async (cred: { credential?: string }) => {
    if (!cred.credential) return
    setSigningIn(true)
    setError(null)
    try {
      await login(cred.credential)
      router.replace('/dashboard')
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="w-4 h-4 rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--border-bright)', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite' }}
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ background: '#000' }}>
      <StarField count={200} speed={0.5} opacity={0.8} />

      {/* Subtle purple gradient orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -60%)',
          background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 1,
        }}
      />

      {/* Nav bar — BunkToBrains style */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="rgba(167,139,250,1)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 2v20M3 7l9 5 9-5" stroke="rgba(167,139,250,0.4)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">AcadHub</span>
        </div>
        <span className="section-label">Attendance Tracker</span>
      </nav>

      {/* Hero content — centered */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 max-w-md"
        >
          {/* Tag */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(81,255,197,0.08)', color: 'var(--lf-green)', border: '1px solid rgba(81,255,197,0.15)' }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lf-green)' }} />
            Track  Analyze  Stay Ahead
          </div>

          {/* Headline — BunkToBrains inspired bold headline */}
          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight text-white">
            Your attendance,<br />
            <span style={{ color: 'var(--lf-green)' }}>under control.</span>
          </h1>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Know exactly when you can bunk, when you need to attend,
            and how close you are to that 75%.
          </p>

          {/* Google login */}
          <div className="pt-2">
            {signingIn ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <div
                  className="w-4 h-4 rounded-full border-2"
                  style={{ borderColor: 'var(--border-bright)', borderTopColor: 'var(--lf-green)',
                    animation: 'spin 0.8s linear infinite' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Signing in</span>
              </div>
            ) : (
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in failed.')}
                  theme="filled_black"
                  size="large"
                  shape="rectangular"
                  text="continue_with"
                />
              </div>
            )}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-xs"
                  style={{ color: 'var(--red)' }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Stats row — BunkToBrains "2.5K+ Students" style */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {[
              { value: '75%', label: 'Min required' },
              { value: '', label: 'Subjects tracked' },
              { value: '0', label: 'Cost' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-base font-bold mono text-white">{value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6">
        <p className="text-[10px]" style={{ color: '#2a2a2a' }}> 2026 AcadHub</p>
      </div>
    </div>
  )
}
