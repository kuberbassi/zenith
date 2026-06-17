import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/contexts/ThemeContext';

interface ThreeBackgroundProps {
    /**
     * `contained={true}` → canvas is `absolute`, sized to its parent element.
     * Omitted / false     → canvas is `fixed`, sized to the viewport.
     */
    contained?: boolean;
}

/**
 * High-quality Three.js icosahedron wireframe background.
 *
 * Render quality:
 * - Pixel ratio: full devicePixelRatio, capped at 2.5 (true 2.5K on HiDPI)
 * - Antialias: enabled (GPU MSAA — crisp lines at any resolution)
 * - Geometry: IcosahedronGeometry detail=2 → 320 smooth triangles
 * - Edges: LineSegments with LineBasicMaterial (native 1px GPU lines, zero fill)
 * - Vertex dots: PointsMaterial with sRGB-encoded size for pixel-perfect dots
 * - Outer glow ring: second icosahedron at 1.04× scale, AdditiveBlending, softer opacity
 *
 * Performance:
 * - 60 fps on desktop (uncapped — lines are extremely cheap to rasterise)
 * - 30 fps on mobile / battery-constrained devices (detected via max touch points)
 * - IntersectionObserver: pauses RAF when canvas is off-screen
 * - visibilitychange: pauses RAF when tab is hidden
 * - Resize: debounced 150ms
 * - Cleanup: alive flag kills RAF loop synchronously on unmount
 */
const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ contained = false }) => {
    const canvasRef         = useRef<HTMLCanvasElement | null>(null);
    const lineMaterialRef   = useRef<THREE.LineBasicMaterial | null>(null);
    const glowMaterialRef   = useRef<THREE.LineBasicMaterial | null>(null);
    const pointsMaterialRef = useRef<THREE.PointsMaterial | null>(null);
    const { theme } = useTheme();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let alive      = true;
        let tabVisible = !document.hidden;
        let inView     = true;
        let lastFrameTs = 0;

        // Desktop → 60fps; mobile (touch device) → 30fps to save battery
        const isMobile = window.navigator.maxTouchPoints > 0;
        const FRAME_MS  = isMobile ? 1000 / 30 : 0; // 0 = uncapped on desktop

        const getW = () => contained ? (canvas.parentElement?.clientWidth  ?? window.innerWidth)  : window.innerWidth;
        const getH = () => contained ? (canvas.parentElement?.clientHeight ?? window.innerHeight) : window.innerHeight;

        // ── Renderer ─────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha:           true,
            antialias:       true,          // MSAA — crisp lines at all DPRs
            depth:           false,
            stencil:         false,
            powerPreference: 'default',     // stays on iGPU, no dGPU wake
        });
        renderer.setSize(getW(), getH(), false);
        // Full device pixel ratio, capped at 2.5 for true 2.5K rendering on HiDPI
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // ── Scene / Camera ────────────────────────────────────────────────────
        const scene  = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, getW() / getH(), 0.1, 100);
        camera.position.z = 7.5;

        // ── Icosahedron geometry (detail=2 → 320 triangles, smooth sphere) ───
        const geo = new THREE.IcosahedronGeometry(3.0, 2);

        // Extract edges only — LineSegments renders crisp 1px GPU lines with
        // zero triangle fill (much sharper than wireframe mesh at high DPI)
        const edgesGeo  = new THREE.EdgesGeometry(geo, 1);  // threshold=1° = include all edges
        const edgesGeoGlow = new THREE.EdgesGeometry(geo, 1);

        // ── Read initial theme from DOM (no flash on first frame) ─────────────
        const isDark    = document.documentElement.classList.contains('dark');
        const col       = isDark ? 0xffffff : 0x111111;
        const lineOp    = isDark ? 0.10 : 0.06;
        const glowOp    = isDark ? 0.035 : 0.018;
        const pointOp   = isDark ? 0.28 : 0.16;

        // ── Primary edge lines ───────────────────────────────────────────────
        const lineMaterial = new THREE.LineBasicMaterial({
            color:       col,
            transparent: true,
            opacity:     lineOp,
            depthWrite:  false,
        });
        lineMaterialRef.current = lineMaterial;
        const lines = new THREE.LineSegments(edgesGeo, lineMaterial);
        scene.add(lines);

        // ── Glow ring (slightly larger, additive blending → halo effect) ─────
        const glowMaterial = new THREE.LineBasicMaterial({
            color:        col,
            transparent:  true,
            opacity:      glowOp,
            depthWrite:   false,
            blending:     THREE.AdditiveBlending,
        });
        glowMaterialRef.current = glowMaterial;
        const glowLines = new THREE.LineSegments(edgesGeoGlow, glowMaterial);
        glowLines.scale.setScalar(1.045); // slightly larger → outer glow ring
        scene.add(glowLines);

        // ── Vertex dots ───────────────────────────────────────────────────────
        const pointsMaterial = new THREE.PointsMaterial({
            color:       col,
            size:        0.055,
            sizeAttenuation: true,
            transparent: true,
            opacity:     pointOp,
            depthWrite:  false,
        });
        pointsMaterialRef.current = pointsMaterial;
        const points = new THREE.Points(geo, pointsMaterial);
        scene.add(points);

        // ── Mouse parallax ────────────────────────────────────────────────────
        let mouseX = 0, mouseY = 0;
        let targetX = 0, targetY = 0;
        let rotX = 0, rotY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = (e.clientX / window.innerWidth)  * 2 - 1;
            mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        // Touch parallax (mobile)
        const handleTouchMove = (e: TouchEvent) => {
            const t = e.touches[0];
            if (!t) return;
            mouseX = (t.clientX / window.innerWidth)  * 2 - 1;
            mouseY = -(t.clientY / window.innerHeight) * 2 + 1;
        };
        window.addEventListener('touchmove', handleTouchMove, { passive: true });

        // ── Debounced resize ──────────────────────────────────────────────────
        let resizeTimer: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (!alive) return;
                const w = getW(), h = getH();
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h, false);
            }, 150);
        };
        window.addEventListener('resize', handleResize, { passive: true });

        // ── Visibility / Intersection observers ───────────────────────────────
        const handleVisibility = () => { tabVisible = !document.hidden; };
        document.addEventListener('visibilitychange', handleVisibility);

        const io = new IntersectionObserver(
            ([entry]) => { inView = entry.isIntersecting; },
            { threshold: 0 }
        );
        io.observe(canvas);

        // ── Animation loop ────────────────────────────────────────────────────
        const animate = (ts: number) => {
            if (!alive) return;
            requestAnimationFrame(animate);
            if (!tabVisible || !inView) return;
            if (FRAME_MS > 0 && ts - lastFrameTs < FRAME_MS) return;
            lastFrameTs = ts;

            // Gentle ambient rotation
            rotX += 0.00025;
            rotY += 0.0005;

            // Smooth mouse parallax (eased lerp)
            targetX += (mouseX * 0.25 - targetX) * 0.035;
            targetY += (mouseY * 0.25 - targetY) * 0.035;

            const rx = rotX + targetY;
            const ry = rotY + targetX;

            lines.rotation.x     = rx;  lines.rotation.y     = ry;
            glowLines.rotation.x = rx;  glowLines.rotation.y = ry;
            points.rotation.x    = rx;  points.rotation.y    = ry;

            renderer.render(scene, camera);
        };
        requestAnimationFrame(animate);

        // ── Cleanup ───────────────────────────────────────────────────────────
        return () => {
            alive = false;
            clearTimeout(resizeTimer);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibility);
            io.disconnect();

            geo.dispose();
            edgesGeo.dispose();
            edgesGeoGlow.dispose();
            lineMaterial.dispose();
            glowMaterial.dispose();
            pointsMaterial.dispose();
            renderer.dispose();

            lineMaterialRef.current   = null;
            glowMaterialRef.current   = null;
            pointsMaterialRef.current = null;
        };
    }, [contained]);

    // ── Theme colour updates (no context reset) ───────────────────────────────
    useEffect(() => {
        const lm = lineMaterialRef.current;
        const gm = glowMaterialRef.current;
        const pm = pointsMaterialRef.current;
        if (!lm || !gm || !pm) return;

        const isDark = theme === 'dark';
        const col    = isDark ? 0xffffff : 0x111111;

        lm.color.setHex(col); lm.opacity = isDark ? 0.10 : 0.06; lm.needsUpdate = true;
        gm.color.setHex(col); gm.opacity = isDark ? 0.035 : 0.018; gm.needsUpdate = true;
        pm.color.setHex(col); pm.opacity = isDark ? 0.28 : 0.16; pm.needsUpdate = true;
    }, [theme]);

    return (
        <canvas
            ref={canvasRef}
            className={[
                'w-full h-full pointer-events-none',
                contained ? 'absolute inset-0' : 'fixed inset-0 -z-20',
            ].join(' ')}
            aria-hidden="true"
        />
    );
};

export default ThreeBackground;
