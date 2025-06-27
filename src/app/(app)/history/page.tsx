"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { History, Coins, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

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
  
  const matchHistory = player.matchHistory || [];
  
  return (
    <div className="container mx-auto max-w-4xl">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="text-center">
            <History className="h-16 w-16 text-primary mx-auto mb-4" />
            <CardTitle className="text-4xl font-bold">Match History</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">Review your past duels and performance.</CardDescription>
        </CardHeader>
        <CardContent>
          {matchHistory.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <History className="mx-auto h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No Matches Played Yet</p>
                <p>Head to the Arena to start your first duel!</p>
            </div>
          ) : (
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
                {matchHistory.map((match) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
