/**
 * Egységes vonalikon-készlet (1.75 px vonal, 20 px rács), SF Symbols-szerű formákkal.
 * Dekoratív ikonként aria-hidden; ahol egyedül áll, a hívó ad szöveges címkét.
 */
const PATHS = {
  today: 'M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4M10 6.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  map: 'M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2zM7.5 3v12M12.5 5v12',
  clock: 'M10 2.75a7.25 7.25 0 1 1 0 14.5 7.25 7.25 0 0 1 0-14.5zM10 6v4l2.75 1.75',
  key: 'M12.5 2.75a4.75 4.75 0 1 1-4.3 6.8L3 14.75V17h2.25v-1.5h1.5V14h1.5l1.2-1.2A4.75 4.75 0 0 1 12.5 2.75zM13.5 6.5h.01',
  wrench: 'M12.9 3.1a4 4 0 0 0-4.8 5.3L3 13.5a1.8 1.8 0 0 0 2.5 2.5l5.1-5.1a4 4 0 0 0 5.3-4.8l-2.4 2.4-2.3-.6-.6-2.3z',
  route: 'M5 4.5a2 2 0 1 0 0 .01M15 15.5a2 2 0 1 0 0 .01M5 6.5v3.5a2.5 2.5 0 0 0 2.5 2.5h5A2.5 2.5 0 0 1 15 15M15 13.5V10',
  snow: 'M10 2.5v15M3.5 6.25l13 7.5M3.5 13.75l13-7.5M8 4l2 1.5L12 4M8 16l2-1.5 2 1.5',
  doc: 'M5 2.75h6.5L15 6.25v11H5zM11.5 2.75v3.5H15M7.5 10h5M7.5 13h5',
  chart: 'M3 17h14M5.5 14V9M10 14V5M14.5 14v-3',
  reset: 'M3.5 10a6.5 6.5 0 1 0 2-4.7M3.5 3v3.5H7',
  close: 'M5 5l10 10M15 5L5 15',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
