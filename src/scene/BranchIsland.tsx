import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { AISLE_Z, GATE_Z, ISLAND, SLOT_COUNT, SLOTS } from '../data/layout';
import type { Branch } from '../data/types';
import { useFleet } from '../state/store';
import { useMounted } from './useMounted';

const asphalt = new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.95 });
const concrete = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.85 });
const line = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6 });
const roofMat = new THREE.MeshStandardMaterial({ color: '#e8edf3', roughness: 0.5, transparent: true, opacity: 0.38 });
const pillar = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.6 });

const H = 0.3; // a sziget magassága

export function BranchIsland({ branch }: { branch: Branch }) {
  const focusBranch = useFleet((s) => s.focusBranch);
  const count = useFleet((s) => s.vehicles.filter((v) => v.branchId === branch.id).length);
  const gateOpen = useFleet((s) =>
    Object.values(s.transits).some((t) => {
      const m = s.movements.find((x) => x.id === t.movementId);
      return !!m && (m.fromBranchId === branch.id || m.toBranchId === branch.id);
    }),
  );
  const dropTarget = useFleet((s) => s.dragging?.active && s.dragging.hoverBranchId === branch.id);
  const accent = new THREE.Color(branch.color);
  const mounted = useMounted();

  return (
    <group position={[branch.position[0], 0, branch.position[1]]} rotation={[0, branch.heading, 0]}>
      {/* alap */}
      <RoundedBox
        args={[ISLAND.width + 0.8, H, ISLAND.depth + 0.8]}
        radius={0.1}
        smoothness={2}
        position={[0, H / 2 - 0.02, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          focusBranch(branch.id);
        }}
      >
        <meshStandardMaterial
          color={dropTarget ? branch.color : '#cfd5dc'}
          emissive={accent}
          emissiveIntensity={dropTarget ? 0.35 : 0}
          roughness={0.9}
        />
      </RoundedBox>

      <group position={[0, H, 0]}>
        {/* aszfalt */}
        <mesh material={asphalt} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[ISLAND.width, ISLAND.depth]} />
        </mesh>

        {/* parkolóhely-vonalak */}
        {SLOTS.map((s, i) => (
          <group key={i} position={[s.x, 0.012, s.z]}>
            {[-1.25, 1.25].map((dx) => (
              <mesh key={dx} material={line} position={[dx, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.08, 4.2]} />
              </mesh>
            ))}
            <mesh material={line} position={[0, 0, -s.facing * 2.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.58, 0.08]} />
            </mesh>
          </group>
        ))}

        {/* sávfelfestés */}
        {[-6, -3, 0, 3, 6].map((x) => (
          <mesh key={x} material={line} position={[x, 0.012, AISLE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.1, 0.1]} />
          </mesh>
        ))}

        {/* garázs: hátfal, oldalfalak, oszlopok, áttetsző tető */}
        <mesh material={concrete} position={[0, 1.4, -ISLAND.depth / 2 + 0.15]} castShadow receiveShadow>
          <boxGeometry args={[ISLAND.width, 2.8, 0.3]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={concrete} position={[s * (ISLAND.width / 2 - 0.15), 1.4, -3.4]} castShadow>
            <boxGeometry args={[0.3, 2.8, 6.2]} />
          </mesh>
        ))}
        {[-5, 0, 5].map((x) => (
          <mesh key={x} material={pillar} position={[x, 1.4, -0.55]} castShadow>
            <boxGeometry args={[0.25, 2.8, 0.25]} />
          </mesh>
        ))}
        <mesh material={roofMat} position={[0, 2.86, -3.4]}>
          <boxGeometry args={[ISLAND.width + 0.2, 0.12, 6.4]} />
        </mesh>
        {/* színes sáv a tetőn */}
        <mesh position={[0, 2.86, -0.25]}>
          <boxGeometry args={[ISLAND.width + 0.2, 0.3, 0.12]} />
          <meshStandardMaterial color={branch.color} roughness={0.5} />
        </mesh>

        {/* kapu sorompóval */}
        {[-1.9, 1.9].map((x) => (
          <mesh key={x} position={[x, 0.55, GATE_Z - 0.1]} castShadow>
            <boxGeometry args={[0.3, 1.1, 0.3]} />
            <meshStandardMaterial color={branch.color} />
          </mesh>
        ))}
        <group position={[-1.9, 1.05, GATE_Z - 0.1]} rotation={[0, 0, gateOpen ? 1.25 : 0]}>
          <mesh position={[1.7, 0, 0]}>
            <boxGeometry args={[3.4, 0.1, 0.1]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        </group>

        {/* felirat */}
        {mounted && (
        <Html position={[0, 3.2, -8.6]} center zIndexRange={[40, 30]}>
          <button className="branch-label" style={{ borderColor: branch.color }} onClick={() => focusBranch(branch.id)}>
            <span className="branch-dot" style={{ background: branch.color }} />
            <span>
              <strong>{branch.city}</strong>
              <small>{branch.name}</small>
            </span>
            <span className="branch-count">
              {count}/{SLOT_COUNT}
            </span>
          </button>
        </Html>
        )}
      </group>
    </group>
  );
}
