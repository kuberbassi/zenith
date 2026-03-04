import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const AmbientBackground: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        // Use pure black void
        scene.fog = new THREE.FogExp2('#000000', 0.001);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize performance
        mountRef.current.appendChild(renderer.domElement);

        // Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 700;

        const posArray = new Float32Array(particlesCount * 3);
        const colorsArray = new Float32Array(particlesCount * 3);

        const color1 = new THREE.Color('#3b82f6'); // Primary Neon Blue
        const color2 = new THREE.Color('#8b5cf6'); // Neon Purple
        const color3 = new THREE.Color('#3b82f6'); // Success Green

        for (let i = 0; i < particlesCount * 3; i += 3) {
            // Position
            posArray[i] = (Math.random() - 0.5) * 100;
            posArray[i + 1] = (Math.random() - 0.5) * 100;
            posArray[i + 2] = (Math.random() - 0.5) * 50;

            // Colors mapping
            const mix = Math.random();
            const mixedColor = mix < 0.33 ? color1 : mix < 0.66 ? color2 : color3;

            colorsArray[i] = mixedColor.r;
            colorsArray[i + 1] = mixedColor.g;
            colorsArray[i + 2] = mixedColor.b;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

        // Ultra premium glowing circular particle material
        // We render points instead of heavy geometry
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending // creates that glowing overlapping effect
        });

        const particleMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particleMesh);

        // Slow rotation variables
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;

        const onDocumentMouseMove = (event: MouseEvent) => {
            mouseX = (event.clientX - windowHalfX) * 0.0005;
            mouseY = (event.clientY - windowHalfY) * 0.0005;
        };

        document.addEventListener('mousemove', onDocumentMouseMove);

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);

        // Animation Loop
        let lastTime = 0;
        let rotationTime = 0;

        const animate = (time: number) => {
            requestAnimationFrame(animate);

            // Calculate delta time
            const deltaTime = time - lastTime;
            lastTime = time;
            rotationTime += deltaTime * 0.001;

            targetX = mouseX * 0.5;
            targetY = mouseY * 0.5;

            // Ease rotation
            particleMesh.rotation.y += 0.05 * (targetX - particleMesh.rotation.y);
            particleMesh.rotation.x += 0.05 * (targetY - particleMesh.rotation.x);

            // Constant drift
            particleMesh.position.y = Math.sin(rotationTime * 0.5) * 0.5;

            renderer.render(scene, camera);
        };

        requestAnimationFrame(animate);

        return () => {
            // Cleanup
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousemove', onDocumentMouseMove);

            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }

            particlesGeometry.dispose();
            particlesMaterial.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={mountRef}
            className="fixed inset-0 z-0 pointer-events-none opacity-50 mix-blend-screen"
            style={{
                background: 'radial-gradient(circle at center, transparent 0%, #000000 80%)'
            }}
        />
    );
};

export default AmbientBackground;
