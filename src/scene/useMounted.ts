import { useEffect, useState } from 'react';

/**
 * A drei <Html> az első rendereléskor még a canvas szülőjébe csatol, majd átköltözik az
 * eseménykezelő konténerbe; a legelső felirat ilyenkor üresen marad. Mount után renderelve ez nem fordul elő.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
