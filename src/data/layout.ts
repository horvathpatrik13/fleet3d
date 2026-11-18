import * as THREE from 'three';
import type { Branch } from './types';

/**
 * Egy branch-sziget helyi koordinátái (méterszerű egységek).
 * A helyi +z irány a kapu felé (a térkép közepe felé) mutat.
 *
 *   z = -6  ┌──────────── garázs (tető) ────────────┐
 *   z = -3.2   A0   A1   A2   A3   A4   A5   (orral +z felé)
 *   z =  0.4   ─────────────── manőverező sáv ───────
 *   z =  3.4   B0   B1             B2   B3   (orral -z felé)
 *   z =  6  └──────────────── kapu ──────────────────┘
 */
export const ISLAND = { width: 17, depth: 13 };
export const AISLE_Z = 0.4;
export const GATE_Z = ISLAND.depth / 2;

const ROW_A_X = [-6.25, -3.75, -1.25, 1.25, 3.75, 6.25];
const ROW_B_X = [-6.25, -3.75, 3.75, 6.25];

export interface SlotDef {
  x: number;
  z: number;
  /** Az orr iránya: +1 → helyi +z, -1 → helyi -z. */
  facing: 1 | -1;
}

export const SLOTS: SlotDef[] = [
  ...ROW_A_X.map((x) => ({ x, z: -3.2, facing: 1 as const })),
  ...ROW_B_X.map((x) => ({ x, z: 3.4, facing: -1 as const })),
];

export const SLOT_COUNT = SLOTS.length;

/** Helyi pont → világpont az adott branch szigetén. */
export function toWorld(branch: Branch, x: number, z: number, y = 0): THREE.Vector3 {
  const v = new THREE.Vector3(x, y, z);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), branch.heading);
  v.x += branch.position[0];
  v.z += branch.position[1];
  return v;
}

/** A parkoló jármű világbeli helye és elforgatása (yaw). */
export function slotPose(branch: Branch, slot: number): { position: THREE.Vector3; yaw: number } {
  const s = SLOTS[slot % SLOT_COUNT];
  return {
    position: toWorld(branch, s.x, s.z),
    yaw: branch.heading + (s.facing === 1 ? 0 : Math.PI),
  };
}

export interface PathSegment {
  curve: THREE.CatmullRomCurve3;
  /** Tolatás: a jármű a haladási iránnyal ellentétesen néz. */
  reverse: boolean;
}

/**
 * Útvonal két parkolóhely között:
 * kiállás a sávra → kapu → út a körforgalomig → cél kapu → sáv a hely mögött → betolatás.
 */
export function buildPath(from: Branch, fromSlot: number, to: Branch, toSlot: number): PathSegment[] {
  const a = SLOTS[fromSlot];
  const b = SLOTS[toSlot];

  // 1. Kiállás előre a sávra, majd ki a kapun.
  const outPoints = [
    toWorld(from, a.x, a.z),
    toWorld(from, a.x, a.z + a.facing * 1.6),
    toWorld(from, a.x * 0.6, AISLE_Z),
    toWorld(from, 0, AISLE_Z + 2.2),
    toWorld(from, 0, GATE_Z),
    toWorld(from, 0, GATE_Z + 3),
  ];

  // 2. Körforgalom: a kezdő és cél irány között a kör ívén haladunk (az óramutatóval ellentétesen).
  const R = RING_RADIUS;
  const startAngle = Math.atan2(outPoints[5].x, outPoints[5].z);
  const targetGateOuter = toWorld(to, 0, GATE_Z + 3);
  let endAngle = Math.atan2(targetGateOuter.x, targetGateOuter.z);
  while (endAngle <= startAngle) endAngle += Math.PI * 2;
  const ring: THREE.Vector3[] = [];
  const steps = Math.max(2, Math.round(((endAngle - startAngle) / (Math.PI * 2)) * 10));
  for (let i = 0; i <= steps; i++) {
    const t = startAngle + ((endAngle - startAngle) * i) / steps;
    ring.push(new THREE.Vector3(Math.sin(t) * R, 0, Math.cos(t) * R));
  }

  // 3. Be a cél kapun, végig a sávon a hely „mögé”.
  const beyondX = b.x + (b.x >= 0 ? -1 : 1) * 2.4;
  const inPoints = [
    targetGateOuter,
    toWorld(to, 0, GATE_Z),
    toWorld(to, 0, AISLE_Z + 2.2),
    toWorld(to, (beyondX + b.x) / 2, AISLE_Z),
    toWorld(to, beyondX, AISLE_Z + b.facing * 0.3),
  ];

  const drive = new THREE.CatmullRomCurve3([...outPoints, ...ring, ...inPoints], false, 'centripetal', 0.5);

  // 4. Betolatás a helyre (orral a sáv felé áll meg).
  const park = new THREE.CatmullRomCurve3(
    [
      toWorld(to, beyondX, AISLE_Z + b.facing * 0.3),
      toWorld(to, (beyondX + b.x) / 2 + (b.x - beyondX) * 0.3, b.z + b.facing * 2.2),
      toWorld(to, b.x, b.z + b.facing * 0.9),
      toWorld(to, b.x, b.z),
    ],
    false,
    'centripetal',
    0.5,
  );

  return [
    { curve: drive, reverse: false },
    { curve: park, reverse: true },
  ];
}

/** A kapu és a körforgalom közti útszakasz két végpontja (világ). */
export function roadEnds(branch: Branch): [THREE.Vector3, THREE.Vector3] {
  const gate = toWorld(branch, 0, GATE_Z - 0.2);
  const hub = gate.clone().setY(0).normalize().multiplyScalar(RING_RADIUS);
  return [gate, hub];
}

export const RING_RADIUS = 4.2;
