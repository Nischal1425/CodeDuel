
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import { Home, Swords, Trophy, UserCircle, LogOut, DollarSign, ShieldQuestion } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext'; // Added useAuth

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home }, // Updated href
  { href: '/arena', label: 'Arena', icon: Swords },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/buy-coins', label: 'Buy Coins', icon: DollarSign },
  { href: '/cooldown-challenge', label: 'Cooldown Challenge', icon: ShieldQuestion },
];

export function AppNavigation() {
  const pathname = usePathname();
  const { logout } = useAuth(); // Get logout function
  const router = useRouter(); // Get router for redirection

  const handleLogout = () => {
    logout();
    router.push('/'); // Redirect to the landing page
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/(app)/dashboard'))} // Handle route group for dashboard active state
              tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
              className="justify-start"
            >
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
      <SidebarMenuItem className="mt-auto"> 
        <SidebarMenuButton
            tooltip={{ children: "Log Out", side: 'right', className: 'bg-popover text-popover-foreground' }}
            className="justify-start hover:bg-destructive/20 hover:text-destructive"
            onClick={handleLogout} // Use the new logout handler
        >
            <LogOut className="h-5 w-5" />
            <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
