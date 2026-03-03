import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleCanvasProps {
    className?: string;
}

const ParticleCanvas: React.FC<ParticleCanvasProps> = ({ className }) => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;

        // Scene
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 1000);
        camera.position.z = 80;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(el.clientWidth, el.clientHeight);
        renderer.setClearColor(0x000000, 0);
        el.appendChild(renderer.domElement);

        // Particles
        const count = 600;
        const positions = new Float32Array(count * 3);
        const velocities: number[] = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
            velocities.push(
                (Math.random() - 0.5) * 0.04,
                (Math.random() - 0.5) * 0.04,
                (Math.random() - 0.5) * 0.02
            );
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x6366f1,
            size: 0.6,
            transparent: true,
            opacity: 0.55,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geo, mat);
        scene.add(points);

        // Mouse parallax
        let mouseX = 0, mouseY = 0;
        const onMouseMove = (e: MouseEvent) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        };
        window.addEventListener('mousemove', onMouseMove);

        // Resize
        const onResize = () => {
            camera.aspect = el.clientWidth / el.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(el.clientWidth, el.clientHeight);
        };
        window.addEventListener('resize', onResize);

        let animId: number;
        const posArr = geo.attributes.position.array as Float32Array;

        const animate = () => {
            animId = requestAnimationFrame(animate);

            // Move particles
            for (let i = 0; i < count; i++) {
                posArr[i * 3]     += velocities[i * 3];
                posArr[i * 3 + 1] += velocities[i * 3 + 1];
                posArr[i * 3 + 2] += velocities[i * 3 + 2];

                // Wrap around
                if (Math.abs(posArr[i * 3]) > 100)     posArr[i * 3]     *= -0.99;
                if (Math.abs(posArr[i * 3 + 1]) > 100) posArr[i * 3 + 1] *= -0.99;
                if (Math.abs(posArr[i * 3 + 2]) > 100) posArr[i * 3 + 2] *= -0.99;
            }
            geo.attributes.position.needsUpdate = true;

            // Parallax rotate
            points.rotation.y += 0.0008 + mouseX * 0.0002;
            points.rotation.x += 0.0004 + mouseY * 0.0001;

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            className={className}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
        />
    );
};

export default ParticleCanvas;
