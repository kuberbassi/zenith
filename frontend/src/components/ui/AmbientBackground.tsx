import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const STAR_COUNT = 1800;
const TWINKLE_COUNT = 120;

const AmbientBackground: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000,
        );
        camera.position.z = 40;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
        renderer.setClearColor(0x000000, 1);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        mountRef.current.appendChild(renderer.domElement);

        /* ── Static star-field ─────────────────────────────── */
        const starsGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes = new Float32Array(STAR_COUNT);
        const opacities = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 120;

            // Most stars are visible; some are bigger and brighter
            const r = Math.random();
            sizes[i] = r < 0.9 ? 0.2 + Math.random() * 0.3 : 0.6 + Math.random() * 0.8;
            opacities[i] = r < 0.9 ? 0.4 + Math.random() * 0.4 : 0.8 + Math.random() * 0.2;
        }

        starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        starsGeo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

        const starsMat = new THREE.ShaderMaterial({
            uniforms: {
                uPixelRatio: { value: renderer.getPixelRatio() },
            },
            vertexShader: `
                attribute float aSize;
                attribute float aOpacity;
                varying float vOpacity;
                uniform float uPixelRatio;
                void main() {
                    vOpacity = aOpacity;
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * uPixelRatio * (120.0 / -mvPos.z);
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                varying float vOpacity;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float alpha = smoothstep(0.5, 0.15, d) * vOpacity;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const starsMesh = new THREE.Points(starsGeo, starsMat);
        scene.add(starsMesh);

        /* ── Twinkle stars (subtle brightness pulse) ────── */
        const twinkleGeo = new THREE.BufferGeometry();
        const twinklePos = new Float32Array(TWINKLE_COUNT * 3);
        const twinklePhase = new Float32Array(TWINKLE_COUNT);
        const twinkleSpeed = new Float32Array(TWINKLE_COUNT);

        for (let i = 0; i < TWINKLE_COUNT; i++) {
            twinklePos[i * 3]     = (Math.random() - 0.5) * 180;
            twinklePos[i * 3 + 1] = (Math.random() - 0.5) * 180;
            twinklePos[i * 3 + 2] = (Math.random() - 0.5) * 80;
            twinklePhase[i] = Math.random() * Math.PI * 2;
            twinkleSpeed[i] = 0.3 + Math.random() * 0.8;
        }

        twinkleGeo.setAttribute('position', new THREE.BufferAttribute(twinklePos, 3));
        twinkleGeo.setAttribute('aPhase', new THREE.BufferAttribute(twinklePhase, 1));
        twinkleGeo.setAttribute('aSpeed', new THREE.BufferAttribute(twinkleSpeed, 1));

        const twinkleMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: renderer.getPixelRatio() },
            },
            vertexShader: `
                attribute float aPhase;
                attribute float aSpeed;
                uniform float uTime;
                uniform float uPixelRatio;
                varying float vBrightness;
                void main() {
                    vBrightness = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * aSpeed + aPhase));
                    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = (0.3 + 0.15 * vBrightness) * uPixelRatio * (120.0 / -mvPos.z);
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                varying float vBrightness;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (d > 0.5) discard;
                    float glow = smoothstep(0.5, 0.0, d);
                    float alpha = glow * vBrightness;
                    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const twinkleMesh = new THREE.Points(twinkleGeo, twinkleMat);
        scene.add(twinkleMesh);

        /* ── Interaction ───────────────────────────────────── */
        let mouseX = 0;
        let mouseY = 0;

        const onMouseMove = (e: MouseEvent) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 0.4;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 0.4;
        };
        document.addEventListener('mousemove', onMouseMove, { passive: true });

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            const pr = Math.min(window.devicePixelRatio, 1.5);
            renderer.setPixelRatio(pr);
            starsMat.uniforms.uPixelRatio.value = pr;
            twinkleMat.uniforms.uPixelRatio.value = pr;
        };
        window.addEventListener('resize', onResize);

        /* ── Render loop ───────────────────────────────────── */
        let clock = 0;
        let animId = 0;

        const animate = (time: number) => {
            animId = requestAnimationFrame(animate);
            clock = time * 0.001;

            // Very slow constant drift
            starsMesh.rotation.y += 0.00008;
            starsMesh.rotation.x += 0.00003;

            // Parallax from mouse
            starsMesh.rotation.y += (mouseX * 0.15 - starsMesh.rotation.y) * 0.02;
            starsMesh.rotation.x += (mouseY * 0.15 - starsMesh.rotation.x) * 0.02;

            twinkleMesh.rotation.copy(starsMesh.rotation);
            twinkleMat.uniforms.uTime.value = clock;

            renderer.render(scene, camera);
        };

        animId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            document.removeEventListener('mousemove', onMouseMove);
            if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
            starsGeo.dispose();
            starsMat.dispose();
            twinkleGeo.dispose();
            twinkleMat.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={mountRef}
            className="fixed inset-0 z-0 pointer-events-none"
        />
    );
};

export default AmbientBackground;
