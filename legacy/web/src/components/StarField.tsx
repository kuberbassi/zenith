'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  z: number
  pz: number
  size: number
  opacity: number
  speed: number
}

interface StarFieldProps {
  count?: number
  speed?: number
  opacity?: number
}

export function StarField({
  count = 180,
  speed = 0.4,
  opacity = 0.7,
}: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const starsRef = useRef<Star[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
      initStars()
    }

    const initStars = () => {
      starsRef.current = Array.from({ length: count }, () => ({
        x: (Math.random() * W - W / 2) * 2,
        y: (Math.random() * H - H / 2) * 2,
        z: Math.random() * Math.max(W, H),
        pz: 0,
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        speed: Math.random() * speed + speed * 0.5,
      }))
    }

    canvas.width = W
    canvas.height = H
    initStars()

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      const cx = W / 2
      const cy = H / 2

      starsRef.current.forEach((star) => {
        star.pz = star.z
        star.z -= star.speed * 60 * 0.016 // ~60fps delta

        if (star.z <= 0) {
          star.x = (Math.random() * W - W / 2) * 2
          star.y = (Math.random() * H - H / 2) * 2
          star.z = Math.max(W, H)
          star.pz = star.z
        }

        const px = (star.x / star.z) * (W * 0.5) + cx
        const py = (star.y / star.z) * (H * 0.5) + cy
        const ppx = (star.x / star.pz) * (W * 0.5) + cx
        const ppy = (star.y / star.pz) * (H * 0.5) + cy

        const size = Math.max(0.1, (1 - star.z / Math.max(W, H)) * star.size * 2.5)
        const alpha = (1 - star.z / Math.max(W, H)) * opacity * star.opacity

        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.lineWidth = size
        ctx.moveTo(ppx, ppy)
        ctx.lineTo(px, py)
        ctx.stroke()
      })

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [count, speed, opacity])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
