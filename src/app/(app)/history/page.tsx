"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { MatchHistoryEntry } from '@/types';
import { History, Coins, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const mockHistory: MatchHistoryEntry[] = [
  {
    matchId: 'm1',
    opponent: { username: 'ByteMaster', avatarUrl: 'https://placehold.co/40x40.png?text=BM' },
    outcome: 'win',
    difficulty: 'medium',
    wager: 100,
    date: '2024-07-20',
  },
  {
    matchId: 'm2',
    opponent: { username: 'AlgoQueen', avatarUrl: 'https://placehold.co/40x40.png?text=AQ' },
    outcome: 'loss',
    difficulty: 'hard',
    wager: 200,
    date: '2024-07-19',
  },
  {
    matchId: 'm3',
    opponent: { username: 'ScriptKiddie', avatarUrl: 'https://placehold.co/40x40.png?text=SK' },
    outcome: 'win',
    difficulty: 'easy',
    wager: 50,
    date: '2024-07-19',
  },
    {
    matchId: 'm4',
    opponent: { username: 'RecursionRebel', avatarUrl: 'https://placehold.co/40x40.png?text=RR' },
    outcome: 'draw',
    difficulty: 'medium',
    wager: 100,
    date: '2024-07-18',
  },
  {
    matchId: 'm5',
    opponent: { username: 'CodeNinja', avatarUrl: 'https://placehold.co/40x40.png?text=CN' },
    outcome: 'loss',
    difficulty: 'hard',
    wager: 200,
    date: '2024-07-17',
  },
];


const getOutcomeStyles = (outcome: 'win' | 'loss' | 'draw') => {
    switch (outcome) {
        case 'win': return "bg-green-500 hover:bg-green-600 text-white";
        case 'loss': return "bg-destructive hover:bg-destructive/90 text-destructive-foreground";
        case 'draw': return "bg-yellow-500 hover:bg-yellow-600 text-white";
    }
}

export default function HistoryPage() {
  const { player, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center py-10">Please log in to view your match history.</div>;
  }
  
  return (
    <div className="container mx-auto max-w-4xl">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="text-center">
            <History className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-4xl font-bold">Match History</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">Review your past duels and performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opponent</TableHead>
                <TableHead className="text-center">Outcome</TableHead>
                <TableHead className="text-center">Difficulty</TableHead>
                <TableHead className="text-right">Wager</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockHistory.map((match) => (
                <TableRow key={match.matchId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border">
                        <AvatarImage src={match.opponent.avatarUrl} alt={match.opponent.username} data-ai-hint="avatar placeholder"/>
                        <AvatarFallback>{match.opponent.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{match.opponent.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("capitalize", getOutcomeStyles(match.outcome))}>
                      {match.outcome}
                    </Badge>
                  </TableCell>
                   <TableCell className="text-center">
                    <Badge variant="secondary" className="capitalize">
                      {match.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className={cn(
                        {'text-green-600': match.outcome === 'win'},
                        {'text-destructive': match.outcome === 'loss'},
                        {'text-muted-foreground': match.outcome === 'draw'}
                    )}>
                        {match.outcome === 'win' ? '+' : (match.outcome === 'loss' ? '-' : '')}{match.wager}
                    </span>
                     <Coins className="inline h-3 w-3 text-yellow-500 ml-1" />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(match.date).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
