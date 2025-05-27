import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppNavigation } from '@/components/AppNavigation';
import { UserDisplay } from '@/components/UserDisplay';
import { CodeDuelLogo } from '@/components/CodeDuelLogo';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react'; // Assuming theme toggle, not implementing fully

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Code Duel - 1v1 Coding Battles',
  description: 'Challenge other coders in real-time 1v1 battles on Code Duel.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <SidebarProvider defaultOpen={true} open={true}> {/* Keep sidebar open by default */}
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
              <SidebarContent className="p-2 flex-grow"> {/* flex-grow to make nav take remaining space */}
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
                <SidebarTrigger className="md:hidden" /> {/* Mobile trigger */}
                <h1 className="text-xl font-semibold">Code Duel</h1>
                <div className="ml-auto flex items-center gap-2">
                  {/* Dark mode toggle can be added here if needed */}
                   {/* <Button variant="ghost" size="icon">
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button> */}
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-6 bg-background">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}

// Placeholder for SwordsIcon if not available, or use a similar one from Lucide
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
