import { useMemo } from 'react';
import * as THREE from 'three';
import { ISLAND, RING_RADIUS, roadEnds } from '../data/layout';
import type { Branch } from '../data/types';

const ROAD_Y = 0.3;
const ROAD_W = 3.4;
const road = new THREE.MeshStandardMaterial({ color: '#454b54', roughness: 0.95 });
const curb = new THREE.MeshStandardMaterial({ color: '#c3c9d0', roughness: 0.9 });
const dash = new THREE.MeshStandardMaterial({ color: '#f1d36b', roughness: 0.6 });
const grass = new THREE.MeshStandardMaterial({ color: '#8fc78f', roughness: 1 });
const trunk = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 1 });
const leaf = new THREE.MeshStandardMaterial({ color: '#4f9a5c', roughness: 0.9, flatShading: true });
const leaf2 = new THREE.MeshStandardMaterial({ color: '#69b06a', roughness: 0.9, flatShading: true });

function Road({ branch }: { branch: Branch }) {
  const [a, b] = roadEnds(branch);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  const dashes = Math.floor(len / 1.6);
  return (
    <group position={[mid.x, 0, mid.z]} rotation={[0, yaw, 0]}>
      <mesh material={curb} position={[0, ROAD_Y / 2 - 0.02, 0]} receiveShadow>
        <boxGeometry args={[ROAD_W + 0.4, ROAD_Y - 0.04, len]} />
      </mesh>
      <mesh material={road} position={[0, ROAD_Y - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_W, len]} />
      </mesh>
      {Array.from({ length: dashes }, (_, i) => (
        <mesh key={i} material={dash} position={[0, ROAD_Y, -len / 2 + 0.8 + i * 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

function Tree({ x, z, s }: { x: number; z: number; s: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh material={trunk} position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1, 6]} />
      </mesh>
      <mesh material={s > 1 ? leaf : leaf2} position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.8, 1.9, 7]} />
      </mesh>
    </group>
  );
}

/** Talaj, körforgalom, utak, díszfák. */
export function World({ branches, dark = false }: { branches: Branch[]; dark?: boolean }) {
  const trees = useMemo(() => {
    // Determinisztikus „véletlen”, hogy minden betöltésnél ugyanúgy álljanak.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { x: number; z: number; s: number }[] = [];
    const clear = (x: number, z: number) => {
      if (Math.hypot(x, z) < RING_RADIUS + 3) return false;
      for (const b of branches) {
        const dx = x - b.position[0];
        const dz = z - b.position[1];
        if (Math.hypot(dx, dz) < Math.max(ISLAND.width, ISLAND.depth) / 2 + 2.5) return false;
        // az út sávja a sziget és a középpont között
        const t = (dx * -b.position[0] + dz * -b.position[1]) / (b.position[0] ** 2 + b.position[1] ** 2);
        if (t > 0 && t < 1) {
          const px = b.position[0] * (1 - t) - x;
          const pz = b.position[1] * (1 - t) - z;
          if (Math.hypot(px, pz) < 3.5) return false;
        }
      }
      return true;
    };
    for (let i = 0; i < 260 && out.length < 70; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 6 + rnd() * 40;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (clear(x, z)) out.push({ x, z, s: 0.7 + rnd() * 0.8 });
    }
    return out;
  }, [branches]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={dark ? '#26332a' : '#cfe3c7'} roughness={1} />
      </mesh>

      {/* körforgalom */}
      <mesh material={curb} position={[0, ROAD_Y / 2 - 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[RING_RADIUS + ROAD_W / 2 + 0.2, RING_RADIUS + ROAD_W / 2 + 0.2, ROAD_Y - 0.04, 48]} />
      </mesh>
      <mesh material={road} position={[0, ROAD_Y - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[RING_RADIUS - ROAD_W / 2, RING_RADIUS + ROAD_W / 2, 48]} />
      </mesh>
      <mesh material={grass} position={[0, ROAD_Y + 0.05, 0]}>
        <cylinderGeometry args={[RING_RADIUS - ROAD_W / 2, RING_RADIUS - ROAD_W / 2, 0.12, 40]} />
      </mesh>
      <Tree x={0} z={0} s={1.3} />

      {branches.map((b) => (
        <Road key={b.id} branch={b} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  );
}
