'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { drawerPrimaryButtonClassName } from '@/components/ui/drawer';

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
      className={drawerPrimaryButtonClassName}
    >
      Download as PWA
    </Button>
  );
}
