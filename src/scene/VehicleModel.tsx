import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import type { Category } from '../data/types';

/** Méretek kategóriánként: szélesség, hossz, karosszéria-magasság. */
export const DIMENSIONS: Record<Category, { w: number; l: number; h: number }> = {
  car: { w: 1.0, l: 2.1, h: 0.42 },
  van: { w: 1.1, l: 2.5, h: 1.0 },
  minibus: { w: 1.2, l: 3.0, h: 1.15 },
  bus: { w: 1.3, l: 3.7, h: 1.3 },
};

const WHEEL_R = 0.22;
const GROUND = 0.12; // a karosszéria alja

const glass = new THREE.MeshStandardMaterial({ color: '#1d2836', roughness: 0.15, metalness: 0.6 });
const tyre = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.9 });
const rim = new THREE.MeshStandardMaterial({ color: '#b9c0c8', roughness: 0.4, metalness: 0.7 });
const lamp = new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#fff1b0', emissiveIntensity: 0.8 });
const tail = new THREE.MeshStandardMaterial({ color: '#7a0d12', emissive: '#c4151c', emissiveIntensity: 0.6 });
const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.18, 14);
const rimGeo = new THREE.CylinderGeometry(WHEEL_R * 0.55, WHEEL_R * 0.55, 0.19, 10);

interface Props {
  category: Category;
  color: string;
  ghost?: boolean;
}

/**
 * Stilizált, alakzatokból épített jármű. A +z irány az orr.
 * A ref a kerekek csoportjait adja vissza a forgatáshoz.
 */
export const VehicleModel = forwardRef<THREE.Group[], Props>(function VehicleModel({ category, color, ghost }, ref) {
  const { w, l, h } = DIMENSIONS[category];

  const paint = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.25,
        transparent: !!ghost,
        opacity: ghost ? 0.35 : 1,
      }),
    [color, ghost],
  );

  const wheelZ = category === 'car' ? l * 0.32 : l * 0.34;
  const wheels: [number, number][] = [
    [-w / 2 + 0.04, wheelZ],
    [w / 2 - 0.04, wheelZ],
    [-w / 2 + 0.04, -wheelZ],
    [w / 2 - 0.04, -wheelZ],
  ];

  const setWheel = (i: number) => (g: THREE.Group | null) => {
    if (!ref || typeof ref === 'function' || !g) return;
    if (!ref.current) ref.current = [];
    ref.current[i] = g;
  };

  return (
    <group>
      {category === 'car' ? (
        <>
          {/* alsó karosszéria */}
          <mesh material={paint} position={[0, GROUND + h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, l]} />
          </mesh>
          {/* utastér */}
          <mesh material={paint} position={[0, GROUND + h + 0.19, -0.12]} castShadow>
            <boxGeometry args={[w * 0.86, 0.38, l * 0.5]} />
          </mesh>
          <mesh material={glass} position={[0, GROUND + h + 0.19, -0.12]}>
            <boxGeometry args={[w * 0.88, 0.28, l * 0.46]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh material={paint} position={[0, GROUND + h / 2 + 0.05, 0]} castShadow>
            <boxGeometry args={[w, h, l]} />
          </mesh>
          {/* oldalsó ablaksáv */}
          <mesh material={glass} position={[0, GROUND + h * 0.68 + 0.05, -0.05]}>
            <boxGeometry args={[w + 0.02, h * 0.3, l * 0.82]} />
          </mesh>
          {/* szélvédő */}
          <mesh material={glass} position={[0, GROUND + h * 0.62 + 0.05, l / 2 + 0.005]}>
            <boxGeometry args={[w * 0.86, h * 0.42, 0.02]} />
          </mesh>
          {category === 'bus' && (
            <mesh material={paint} position={[0, GROUND + h + 0.1, -0.3]} castShadow>
              <boxGeometry args={[w * 0.6, 0.12, l * 0.35]} />
            </mesh>
          )}
        </>
      )}

      {/* lámpák */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={lamp} position={[s * w * 0.33, GROUND + 0.28, l / 2 + 0.01]}>
            <boxGeometry args={[w * 0.18, 0.08, 0.02]} />
          </mesh>
          <mesh material={tail} position={[s * w * 0.36, GROUND + 0.3, -l / 2 - 0.01]}>
            <boxGeometry args={[w * 0.14, 0.1, 0.02]} />
          </mesh>
        </group>
      ))}

      {/* kerekek */}
      {wheels.map(([x, z], i) => (
        <group key={i} position={[x, WHEEL_R, z]} ref={setWheel(i)}>
          <group rotation={[0, 0, Math.PI / 2]}>
            <mesh geometry={wheelGeo} material={tyre} castShadow />
            <mesh geometry={rimGeo} material={rim} />
          </group>
        </group>
      ))}
    </group>
  );
});

export const WHEEL_RADIUS = WHEEL_R;
