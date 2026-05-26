'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface PwaInstallButtonProps {
  isInstalled: boolean;
}

export function PwaInstallButton({ isInstalled }: PwaInstallButtonProps) {
  const router = useRouter();

  if (isInstalled) return null;

  return (
    <Button
      size="sm"
      variant="default"
      onMouseEnter={() => router.prefetch('/download')}
      onClick={() => router.push('/download')}
      className="w-full !h-[38px] justify-center border-border text-center transition-none"
    >
      Download as PWA
    </Button>
  );
}
