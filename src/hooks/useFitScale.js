import { useEffect, useState } from 'react';

// Facteur d'échelle du cadre téléphone (390 × 844) pour qu'il tienne dans la fenêtre, par pas de 0,02.
const compute = () => {
  const H = window.innerHeight, W = window.innerWidth;
  if (H < 300 || W < 200) return null;
  return Math.round(Math.min(1, (H - 32) / 844, (W - 32) / 390) * 50) / 50;
};

export function useFitScale() {
  const [k, setK] = useState(() => (typeof window === 'undefined' ? 1 : compute() ?? 1));
  useEffect(() => {
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const v = compute(); if (v != null) setK(v); }); };
    window.addEventListener('resize', onResize);
    onResize();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return k;
}
