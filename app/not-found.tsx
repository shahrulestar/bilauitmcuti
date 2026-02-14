'use client';

import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  const router = useRouter();
  
  const bgClass = 'bg-background text-foreground';
  const textClass = 'text-foreground';
  const mutedClass = 'text-muted-foreground';

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bgClass}`}>
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8">
        {/* 404 Content */}
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          {/* 404 Number */}
          <h1 className={`text-8xl sm:text-9xl font-bold mb-4 ${textClass}`}>
            404
          </h1>

          {/* Title */}
          <h2 className={`text-2xl sm:text-3xl font-semibold mb-3 ${textClass}`}>
            Page Not Found
          </h2>

          {/* Description */}
          <p className={`text-base sm:text-lg mb-8 max-w-md ${mutedClass}`}>
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Action Button */}
          <Button
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
