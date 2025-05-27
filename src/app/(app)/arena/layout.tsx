
"use client";

import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ArenaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { player, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !player) {
      router.replace('/'); 
    }
  }, [player, isLoading, router]);

  if (isLoading || !player) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // This layout now provides no visible chrome. 
  // The children (ArenaPage) will fill the entire screen.
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {children}
    </div>
  );
}
