
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Player } from '@/types';
import { Crown, ShieldCheck, BarChartHorizontalBig, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const mockLeaderboardData: Player[] = [
  { id: 'player001', username: 'CodeNinja', rating: 2850, coins: 150000, matchesPlayed: 320, wins: 273, rank: 1, email: '', unlockedAchievements: [], losses: 47, winStreak: 10, isKycVerified: true, matchHistory: [] },
  { id: 'player002', username: 'AlgoQueen', rating: 2780, coins: 125000, matchesPlayed: 290, wins: 238, rank: 2, email: '', unlockedAchievements: [], losses: 52, winStreak: 5, isKycVerified: true, matchHistory: [] },
  { id: 'player003', username: 'ByteMaster', rating: 2700, coins: 100000, matchesPlayed: 350, wins: 273, rank: 3, email: '', unlockedAchievements: [], losses: 77, winStreak: 2, isKycVerified: true, matchHistory: [] },
  { id: 'player004', username: 'SyntaxSorcerer', rating: 2650, coins: 95000, matchesPlayed: 250, wins: 188, rank: 4, email: '', unlockedAchievements: [], losses: 62, winStreak: 1, isKycVerified: true, matchHistory: [] },
  { id: 'player005', username: 'LogicLord', rating: 2600, coins: 80000, matchesPlayed: 310, wins: 217, rank: 5, email: '', unlockedAchievements: [], losses: 93, winStreak: 0, isKycVerified: true, matchHistory: [] },
];

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!IS_FIREBASE_CONFIGURED) {
        setLeaderboard(mockLeaderboardData);
        setIsLoading(false);
        return;
      }

      try {
        const playersRef = collection(db, "players");
        const q = query(playersRef, orderBy("rating", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        const leaderboardData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        toast({
          title: "Error",
          description: "Could not fetch leaderboard data from the server.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, [toast]);

  const getWinRate = (player: Player) => {
    if (player.matchesPlayed === 0) return 0;
    return (player.wins / player.matchesPlayed) * 100;
  };

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
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
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
                {leaderboard.map((entry, index) => (
                  <TableRow key={entry.id} className={`hover:bg-primary/5 ${index < 3 ? 'font-medium' : ''}`}>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        {index === 0 && <Crown className="h-5 w-5 text-yellow-500 mr-1" />}
                        {index === 1 && <ShieldCheck className="h-5 w-5 text-gray-400 mr-1" />}
                        {index === 2 && <ShieldCheck className="h-5 w-5 text-orange-400 mr-1" />}
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border-2 border-primary/50">
                          <AvatarImage src={entry.avatarUrl} alt={entry.username} data-ai-hint="avatar placeholder" />
                          <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{entry.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-primary">{entry.rating.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-yellow-600">{entry.coins.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{entry.matchesPlayed}</TableCell>
                    <TableCell className="text-right text-green-600">{getWinRate(entry).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
