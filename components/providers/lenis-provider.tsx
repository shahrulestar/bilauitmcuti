'use client';

import { ReactLenis } from 'lenis/react';

interface LenisProviderProps {
  children: React.ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
  return (
    <ReactLenis
      root
      options={{ lerp: 0.1, duration: 1.2, smoothWheel: true, syncTouch: true }}
    >
      {children}
    </ReactLenis>
  );
}
