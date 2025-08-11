
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Swords, Trophy, UserCircle, LogOut, DollarSign, ShieldQuestion, Award, History, Landmark, ShieldCheck } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/arena', label: 'Arena', icon: Swords },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/history', label: 'Match History', icon: History },
  { href: '/achievements', label: 'Achievements', icon: Award },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

const secondaryNavItems = [
  { href: '/buy-coins', label: 'Buy Coins', icon: DollarSign },
  { href: '/cooldown-challenge', label: 'Cooldown Challenge', icon: ShieldQuestion },
  { href: '/redeem', label: 'Redeem', icon: Landmark },
  { href: '/kyc', label: 'KYC', icon: ShieldCheck },
];

export function AppNavigation() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              isActive={pathname.startsWith(item.href)}
              tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
              className="justify-start"
            >
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
      
      <div className="mt-4 pt-4 border-t border-sidebar-border group-data-[collapsible=icon]:mx-2">
        <p className="px-4 py-2 text-xs font-semibold text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Store & Help</p>
         {secondaryNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref legacyBehavior>
              <SidebarMenuButton
                isActive={pathname.startsWith(item.href)}
                tooltip={{ children: item.label, side: 'right', className: 'bg-popover text-popover-foreground' }}
                className="justify-start"
              >
                <item.icon className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </div>

      <SidebarMenuItem className="mt-auto"> 
        <SidebarMenuButton
            tooltip={{ children: "Log Out", side: 'right', className: 'bg-popover text-popover-foreground' }}
            className="justify-start hover:bg-destructive/20 hover:text-destructive"
            onClick={handleLogout}
        >
            <LogOut className="h-5 w-5" />
            <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
