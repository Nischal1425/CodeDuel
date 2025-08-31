
"use client";

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

// Create a client
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
