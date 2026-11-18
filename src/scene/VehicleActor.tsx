import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { slotPose } from '../data/layout';
import type { Vehicle } from '../data/types';
import { branchById, useFleet, type Transit } from '../state/store';
import { DIMENSIONS, VehicleModel, WHEEL_RADIUS } from './VehicleModel';
import { dragPoint } from './dragPoint';
import { useMounted } from './useMounted';

const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2;

/** A tolatás lassabb: a szakasz „súlyozott” hossza nagyobb. */
const REVERSE_WEIGHT = 2.2;

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function VehicleActor({ vehicle }: { vehicle: Vehicle }) {
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group[]>([]);
  const transit = useFleet((s) => s.transits[vehicle.id]) as Transit | undefined;
  const selected = useFleet((s) => s.selectedId === vehicle.id);
  const dragging = useFleet((s) => (s.dragging?.vehicleId === vehicle.id ? s.dragging : null));
  const select = useFleet((s) => s.select);
  const setDragging = useFleet((s) => s.setDragging);
  const arrive = useFleet((s) => s.arrive);
  const [hovered, setHovered] = useState(false);
  const mounted = useMounted();

  const branch = branchById(vehicle.branchId);
  const rest = useMemo(() => slotPose(branch, vehicle.slot), [branch, vehicle.slot]);

  // Az út szakaszainak időarányai.
  const plan = useMemo(() => {
    if (!transit) return null;
    const weights = transit.segments.map((s) => s.curve.getLength() * (s.reverse ? REVERSE_WEIGHT : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    return transit.segments.map((s, i) => {
      const start = acc / total;
      acc += weights[i];
      return { ...s, start, end: acc / total };
    });
  }, [transit]);

  const startedAt = useRef<number | null>(null);
  const yaw = useRef(rest.yaw);
  const lastPos = useRef(new THREE.Vector3());

  useEffect(() => {
    startedAt.current = null;
  }, [transit]);

  // Kezdő elhelyezés.
  useEffect(() => {
    if (group.current && !transit) {
      group.current.position.copy(rest.position);
      group.current.rotation.y = rest.yaw;
      yaw.current = rest.yaw;
      lastPos.current.copy(rest.position);
    }
    // csak az első rendereléskor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const target = new THREE.Vector3();
    let targetYaw = yaw.current;
    let lift = 0;

    if (transit && plan) {
      if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
      const p = (state.clock.elapsedTime - startedAt.current) / transit.duration;
      if (p >= 1) {
        arrive(vehicle.id);
        target.copy(rest.position);
        targetYaw = rest.yaw;
      } else {
        const seg = plan.find((s) => p <= s.end) ?? plan[plan.length - 1];
        const u = easeInOut((p - seg.start) / (seg.end - seg.start));
        seg.curve.getPointAt(u, target);
        const tan = seg.curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
        targetYaw = Math.atan2(tan.x, tan.z) + (seg.reverse ? Math.PI : 0);
      }
      g.position.copy(target);
      yaw.current += shortestAngle(yaw.current, targetYaw) * Math.min(1, delta * 10);
    } else if (dragging?.active) {
      target.set(dragPoint.x, 0, dragPoint.z);
      lift = 1.2;
      g.position.lerp(target.setY(lift), Math.min(1, delta * 14));
      yaw.current += shortestAngle(yaw.current, rest.yaw) * Math.min(1, delta * 6);
    } else {
      g.position.lerp(rest.position, Math.min(1, delta * 10));
      yaw.current += shortestAngle(yaw.current, rest.yaw) * Math.min(1, delta * 8);
    }
    g.rotation.y = yaw.current;

    // Kerékforgás a megtett út alapján (tolatásnál visszafelé).
    const moved = lastPos.current.distanceTo(g.position);
    if (moved > 1e-4 && moved < 5) {
      const dir = new THREE.Vector3().subVectors(g.position, lastPos.current);
      const forward = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
      const sign = dir.dot(forward) >= 0 ? 1 : -1;
      for (const w of wheels.current) if (w) w.rotation.x += (sign * moved) / WHEEL_RADIUS;
    }
    lastPos.current.copy(g.position);
  });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    select(vehicle.id);
    if (!transit && vehicle.status !== 'retired') {
      setDragging({ vehicleId: vehicle.id, hoverBranchId: vehicle.branchId, active: false });
    }
  };

  const { l, h } = DIMENSIONS[vehicle.category];
  const showLabel = hovered || selected || !!transit || !!dragging?.active;
  const ring = selected || hovered || !!transit;

  return (
    <group
      ref={group}
      name={`vehicle-${vehicle.id}`}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = vehicle.status === 'retired' ? 'pointer' : 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <VehicleModel ref={wheels} category={vehicle.category} color={vehicle.color} ghost={vehicle.status === 'retired'} />

      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[l * 0.62, l * 0.7, 40]} />
          <meshBasicMaterial color={transit ? '#ffb020' : selected ? '#2f6bff' : '#ffffff'} transparent opacity={0.9} />
        </mesh>
      )}

      {mounted && (vehicle.status === 'service' || vehicle.expiringDoc) && (
        <Html position={[0, h + 0.9, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="badges">
            {vehicle.status === 'service' && (
              <span className="badge badge-service" title="Szervizben">
                🔧
              </span>
            )}
            {vehicle.expiringDoc && (
              <span className="badge badge-doc" title={`Lejáró: ${vehicle.expiringDoc}`}>
                !
              </span>
            )}
          </div>
        </Html>
      )}

      {mounted && showLabel && (
        <Html position={[0, h + (vehicle.status === 'service' || vehicle.expiringDoc ? 1.6 : 1.0), 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`plate ${transit ? 'plate-transit' : ''}`}>
            <span className="plate-hu">H</span>
            {vehicle.plate}
          </div>
        </Html>
      )}
    </group>
  );
}
