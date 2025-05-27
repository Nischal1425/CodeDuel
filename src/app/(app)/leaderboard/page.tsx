
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { LeaderboardEntry } from '@/types';
import { Crown, ShieldCheck, BarChartHorizontalBig } from 'lucide-react';
import Image from 'next/image';

const mockLeaderboardData: LeaderboardEntry[] = [
  { rank: 1, playerId: 'player001', username: 'CodeNinja', rating: 2850, coins: 150000, matchesPlayed: 320, winRate: 85.5 },
  { rank: 2, playerId: 'player002', username: 'AlgoQueen', rating: 2780, coins: 125000, matchesPlayed: 290, winRate: 82.1 },
  { rank: 3, playerId: 'player003', username: 'ByteMaster', rating: 2700, coins: 100000, matchesPlayed: 350, winRate: 78.0 },
  { rank: 4, playerId: 'player004', username: 'SyntaxSorcerer', rating: 2650, coins: 95000, matchesPlayed: 250, winRate: 75.3 },
  { rank: 5, playerId: 'player005', username: 'LogicLord', rating: 2600, coins: 80000, matchesPlayed: 310, winRate: 70.2 },
  { rank: 6, playerId: 'player006', username: 'DebugDiva', rating: 2550, coins: 75000, matchesPlayed: 280, winRate: 68.9 },
  { rank: 7, playerId: 'player007', username: 'ScriptKiddiePro', rating: 2500, coins: 70000, matchesPlayed: 260, winRate: 65.0 },
  { rank: 8, playerId: 'player008', username: 'KernelKing', rating: 2450, coins: 65000, matchesPlayed: 240, winRate: 62.5 },
  { rank: 9, playerId: 'player009', username: 'RecursionRebel', rating: 2400, coins: 60000, matchesPlayed: 270, winRate: 60.1 },
  { rank: 10, playerId: 'player010', username: 'PointerProdigy', rating: 2350, coins: 55000, matchesPlayed: 220, winRate: 58.7 },
];

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="text-center relative overflow-hidden py-10 bg-gradient-to-br from-primary to-accent">
           <div className="absolute inset-0 opacity-10">
            <Image src="https://placehold.co/1200x200.png" alt="Abstract background" layout="fill" objectFit="cover" data-ai-hint="abstract tech" />
           </div>
          <div className="relative z-10">
            <BarChartHorizontalBig className="h-16 w-16 text-primary-foreground mx-auto mb-4 opacity-80" />
            <CardTitle className="text-4xl font-bold text-primary-foreground">Leaderboard</CardTitle>
            <CardDescription className="text-lg text-primary-foreground/80 mt-2">
              See who reigns supreme in the Code Duel arena!
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[80px] text-center font-semibold">Rank</TableHead>
                <TableHead className="font-semibold">Player</TableHead>
                <TableHead className="text-right font-semibold">Rating</TableHead>
                <TableHead className="text-right font-semibold">Coins</TableHead>
                <TableHead className="text-center font-semibold">Matches</TableHead>
                <TableHead className="text-right font-semibold">Win Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeaderboardData.map((entry, index) => (
                <TableRow key={entry.playerId} className={`hover:bg-primary/5 ${index < 3 ? 'font-medium' : ''}`}>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      {entry.rank === 1 && <Crown className="h-5 w-5 text-yellow-500 mr-1" />}
                      {entry.rank === 2 && <ShieldCheck className="h-5 w-5 text-gray-400 mr-1" />}
                      {entry.rank === 3 && <ShieldCheck className="h-5 w-5 text-orange-400 mr-1" />}
                      {entry.rank}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-primary/50">
                        <AvatarImage src={`https://placehold.co/40x40.png?text=${entry.username.substring(0,1)}`} alt={entry.username} data-ai-hint="avatar placeholder" />
                        <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{entry.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-primary">{entry.rating.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-yellow-600">{entry.coins.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{entry.matchesPlayed}</TableCell>
                  <TableCell className="text-right text-green-600">{entry.winRate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
