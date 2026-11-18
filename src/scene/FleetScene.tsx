import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { AISLE_Z, ISLAND, toWorld } from '../data/layout';
import { branchById, useFleet } from '../state/store';
import { BranchIsland } from './BranchIsland';
import { VehicleActor } from './VehicleActor';
import { World } from './World';
import { dragPoint } from './dragPoint';

const OVERVIEW = { pos: [0, 70, 58] as const, target: [0, 0, 3] as const };
const DRAG_THRESHOLD = 0.8;

function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const focusBranchId = useFleet((s) => s.focusBranchId);
  const nonce = useFleet((s) => s.focusNonce);
  const dragging = useFleet((s) => !!s.dragging);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const smooth = nonce > 0 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (focusBranchId) {
      const b = branchById(focusBranchId);
      const target = toWorld(b, 0, -1.5);
      const eye = toWorld(b, 0, 17, 13);
      c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, smooth);
    } else {
      c.setLookAt(...OVERVIEW.pos, ...OVERVIEW.target, smooth);
    }
  }, [focusBranchId, nonce]);

  return (
    <CameraControls
      ref={ref}
      enabled={!dragging}
      minDistance={8}
      maxDistance={95}
      maxPolarAngle={Math.PI * 0.44}
      smoothTime={0.6}
    />
  );
}

/** Fogd és vidd: a talajsíkra vetített egérpozíció, és ledobáskor áthelyezés. */
function DragController() {
  const { camera, pointer, raycaster } = useThree();
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3));
  const start = useRef<THREE.Vector3 | null>(null);

  useFrame(() => {
    const d = useFleet.getState().dragging;
    if (!d) {
      start.current = null;
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane.current, hit)) return;
    if (!start.current) start.current = hit.clone();
    dragPoint.copy(hit);

    let hover: string | null = null;
    for (const b of useFleet.getState().branches) {
      const local = new THREE.Vector3(hit.x - b.position[0], 0, hit.z - b.position[1]).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -b.heading,
      );
      if (Math.abs(local.x) < ISLAND.width / 2 + 1 && Math.abs(local.z) < ISLAND.depth / 2 + 1) hover = b.id;
    }
    const active = d.active || hit.distanceTo(start.current) > DRAG_THRESHOLD;
    if (active !== d.active || hover !== d.hoverBranchId) {
      useFleet.getState().setDragging({ ...d, active, hoverBranchId: hover });
      document.body.style.cursor = active ? 'grabbing' : document.body.style.cursor;
    }
  });

  useEffect(() => {
    const up = () => {
      const { dragging, vehicles, requestMove, setDragging } = useFleet.getState();
      if (!dragging) return;
      const v = vehicles.find((x) => x.id === dragging.vehicleId);
      if (dragging.active && v && dragging.hoverBranchId && dragging.hoverBranchId !== v.branchId) {
        requestMove(v.id, dragging.hoverBranchId);
      }
      setDragging(null);
      document.body.style.cursor = '';
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return null;
}

/** Automata tesztekhez (?e2e): jármű és telephely képernyő-koordinátái. */
function E2EHooks() {
  const { camera, size, scene } = useThree();
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('e2e')) return;
    const project = (v: THREE.Vector3) => {
      const p = v.clone().project(camera);
      const rect = document.querySelector('.stage canvas')!.getBoundingClientRect();
      return { x: rect.left + ((p.x + 1) / 2) * size.width, y: rect.top + ((1 - p.y) / 2) * size.height };
    };
    const w = window as unknown as Record<string, unknown>;
    w.__fleetScreen = (id: string) => {
      const obj = scene.getObjectByName(`vehicle-${id}`);
      return obj ? project(obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0))) : null;
    };
    w.__fleetScreenBranch = (id: string) => {
      const b = branchById(id);
      return project(toWorld(b, 0, AISLE_Z, 0.3));
    };
  }, [camera, size, scene]);
  return null;
}

function Vehicles() {
  const vehicles = useFleet((s) => s.vehicles);
  return (
    <group position={[0, 0.3, 0]}>
      {vehicles.map((v) => (
        <VehicleActor key={v.id} vehicle={v} />
      ))}
    </group>
  );
}

/** paused: a térkép nincs a képernyőn – nem rajzolunk, a függő animációk láthatóvá váláskor indulnak. */
export function FleetScene({ paused = false }: { paused?: boolean }) {
  const branches = useFleet((s) => s.branches);
  const select = useFleet((s) => s.select);

  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      shadows
      dpr={[1, 2]}
      camera={{ position: [...OVERVIEW.pos], fov: 40, near: 0.5, far: 400 }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#e9f0f5']} />
      <fog attach="fog" args={['#e9f0f5', 80, 160]} />
      <hemisphereLight args={['#ffffff', '#9fb59a', 0.9]} />
      <directionalLight
        position={[30, 45, 20]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0004}
      />
      <World branches={branches} />
      {branches.map((b) => (
        <BranchIsland key={b.id} branch={b} />
      ))}
      <Vehicles />
      <CameraRig />
      <DragController />
      <E2EHooks />
    </Canvas>
  );
}
