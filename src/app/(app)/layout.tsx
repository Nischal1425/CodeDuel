
"use client";

import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppNavigation } from '@/components/AppNavigation';
import { UserDisplay } from '@/components/UserDisplay';
import { CodeDuelLogo } from '@/components/CodeDuelLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation'; // Removed usePathname as it's no longer needed here for this logic
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Copied from original src/app/layout.tsx
function SwordsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14.5 3.5-4 4L2 16l.5 3.5L4 21l3.5-1.5L16 11l4-4 .5-3.5L21 4l-3.5-.5Z" />
      <path d="m18 7 1-1" />
      <path d="m2 16 2.5 2.5" />
      <path d="m14.5 3.5 4.5 4.5" />
      <path d="m10 8 4.5 4.5" />
    </svg>
  )
}

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { player, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !player) {
      router.replace('/'); // Redirect to landing if not logged in
    }
  }, [player, isLoading, router]);

  if (isLoading || !player) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // The main sidebar and header structure will now apply to all authenticated routes,
  // including the initial /arena (lobby selection) view.
  // Specific pages like ArenaPage will handle taking over the viewport for game states.
  return (
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
          <SidebarHeader className="p-4 items-center justify-center">
              <div className="group-data-[collapsible=icon]:hidden">
              <CodeDuelLogo />
              </div>
              <div className="hidden group-data-[collapsible=icon]:block">
                <SwordsIcon className="h-8 w-8 text-primary" />
              </div>
          </SidebarHeader>
          <UserDisplay />
          <SidebarContent className="p-2 flex-grow">
            <AppNavigation />
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/70 text-center group-data-[collapsible=icon]:hidden">
              © {new Date().getFullYear()} Code Duel
            </p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-6 shadow-sm">
            <SidebarTrigger className="md:hidden" />
            {/* Header title could be dynamic based on page */}
            <h1 className="text-xl font-semibold">Code Duel</h1> 
            <div className="ml-auto flex items-center gap-2">
              {/* Future elements like notifications or theme toggle */}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
  );
}
