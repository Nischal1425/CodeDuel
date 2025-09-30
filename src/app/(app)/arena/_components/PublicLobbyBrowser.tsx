"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { rtdb } from '@/lib/firebase';
import { onValue, ref } from 'firebase/database';

type PublicLobby = {
  id: string;
  hostId: string;
  isPublic: boolean;
  status: 'waiting' | 'forming' | 'starting';
  teams?: {
    blue: Record<'1' | '2' | '3' | '4', { id: string; username: string } | null>;
    red: Record<'1' | '2' | '3' | '4', { id: string; username: string } | null>;
  };
};

interface PublicLobbyBrowserProps {
  open: boolean;
  onClose: () => void;
  onJoinLobby: (lobbyId: string) => void;
}

export function PublicLobbyBrowser({ open, onClose, onJoinLobby }: PublicLobbyBrowserProps) {
  const [lobbies, setLobbies] = useState<PublicLobby[]>([]);
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    if (!open || !rtdb) return;
    const lobbiesRef = ref(rtdb, 'customLobbies');
    const unsub = onValue(lobbiesRef, (snap) => {
      const data = snap.val() || {};
      const list: PublicLobby[] = Object.values<PublicLobby>(
        Object.entries<any>(data).reduce((acc, [id, lobby]) => {
          if (lobby?.isPublic && (lobby.status === 'waiting' || lobby.status === 'forming')) {
            acc[id] = { id, ...lobby } as PublicLobby;
          }
          return acc;
        }, {} as Record<string, PublicLobby>)
      ).map((l: any) => ({ ...l }));
      setLobbies(list);
    });
    return () => unsub();
  }, [open]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return lobbies;
    return lobbies.filter(l => l.id.toLowerCase().includes(q));
  }, [lobbies, queryText]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Public Lobbies</CardTitle>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Input placeholder="Search lobby code" value={queryText} onChange={(e) => setQueryText(e.target.value)} className="bg-background"/>
          </div>
          <Separator className="mb-3"/>
          <ScrollArea className="h-[420px] pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(lobby => {
                const teamCount = (team: any) => Object.values(team || {}).filter(Boolean).length;
                const blue = teamCount(lobby.teams?.blue);
                const red = teamCount(lobby.teams?.red);
                const total = blue + red;
                return (
                  <div key={lobby.id} className={cn("border rounded-lg p-3 bg-card/40 flex flex-col gap-2")}> 
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Lobby Code</p>
                        <p className="font-semibold tracking-wide">{lobby.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Players</p>
                        <p className="font-semibold">{total}/8</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Blue {blue}/4 · Red {red}/4</div>
                    <Button className="mt-1" onClick={() => onJoinLobby(lobby.id)} disabled={total >= 8}>Join</Button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground">No public lobbies available yet.</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}


