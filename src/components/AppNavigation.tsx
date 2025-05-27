"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Swords, Trophy, UserCircle, LogOut, DollarSign, ShieldQuestion } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/arena', label: 'Arena', icon: Swords },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/buy-coins', label: 'Buy Coins', icon: DollarSign },
  { href: '/cooldown-challenge', label: 'Cooldown Challenge', icon: ShieldQuestion },
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname === item.href}
              tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
              className="justify-start"
            >
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
      <SidebarMenuItem className="mt-auto"> {/* Pushes Log out to bottom */}
         {/* Mock Log out button */}
        <SidebarMenuButton
            tooltip={{ children: "Log Out", side: 'right', className: 'bg-popover text-popover-foreground' }}
            className="justify-start hover:bg-destructive/20 hover:text-destructive"
            onClick={() => alert("Log out clicked (mock)")}
        >
            <LogOut className="h-5 w-5" />
            <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
