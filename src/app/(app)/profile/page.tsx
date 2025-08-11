
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User, Mail, Save, BarChart3, Trophy, Coins, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export default function ProfilePage() {
  const { player, isLoading } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setUsername(player.username);
    }
  }, [player]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !username.trim() || !IS_FIREBASE_CONFIGURED) {
      if (!IS_FIREBASE_CONFIGURED) {
        toast({ title: "Offline Mode", description: "Profile updates are disabled in offline mode.", variant: 'destructive' });
      }
      return;
    };
    if (username.trim() === player.username) return;

    setIsSaving(true);
    try {
      const playerRef = doc(db, "players", player.id);
      await updateDoc(playerRef, { username: username.trim() });
      toast({ title: "Success!", description: "Your username has been updated.", className: "bg-green-500 text-white" });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: "Error", description: "Could not update your profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!player) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile Not Found</CardTitle>
                <CardDescription>Please log in to view your profile.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-primary shadow-lg">
                <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="profile avatar" />
                <AvatarFallback className="text-4xl">{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
        </div>
        <div>
            <h1 className="text-4xl font-bold text-foreground">{player.username}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Mail className="h-4 w-4" />
                <span>{player.email}</span>
            </div>
             <div className="flex items-center gap-2 text-muted-foreground mt-1">
                {player.isKycVerified ? (
                    <><Check className="h-4 w-4 text-green-500" /><span>KYC Verified</span></>
                ) : (
                    <><AlertCircle className="h-4 w-4 text-yellow-500" /><span>KYC Not Verified</span></>
                )}
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        <StatCard icon={BarChart3} title="Rank" value={player.rank} />
        <StatCard icon={Trophy} title="Rating" value={player.rating} />
        <StatCard icon={Coins} title="Coins" value={player.coins.toLocaleString()} />
        <div className="flex items-center justify-around bg-card border rounded-lg p-4">
            <div>
                <p className="text-2xl font-bold text-green-500">{player.wins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-destructive">{player.losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
            </div>
             <div>
                <p className="text-2xl font-bold text-primary">{player.winStreak}</p>
                <p className="text-xs text-muted-foreground">Streak</p>
            </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your public username.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent>
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="mt-1"
                disabled={!IS_FIREBASE_CONFIGURED || isSaving}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!IS_FIREBASE_CONFIGURED || isSaving || username === player.username}>
                {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Account Verification (KYC)</CardTitle>
            <CardDescription>Verify your account to enable coin redemption and other features.</CardDescription>
          </CardHeader>
          <CardContent>
            {player.isKycVerified ? (
                 <Alert variant="default" className="border-green-500">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle className="text-green-700">Account Verified</AlertTitle>
                    <AlertDescription>
                       You have successfully completed KYC verification.
                    </AlertDescription>
                </Alert>
            ) : (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Verification Required</AlertTitle>
                    <AlertDescription>
                        Your account is not yet verified.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
          <CardFooter>
            {!player.isKycVerified && (
                 <Button asChild variant="outline">
                    <Link href="/kyc">
                        <ShieldCheck className="mr-2" />
                        Start KYC Process
                    </Link>
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>

       {!IS_FIREBASE_CONFIGURED && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Offline Mode</AlertTitle>
            <AlertDescription>
                Profile editing is disabled because the application is not connected to Firebase.
            </AlertDescription>
         </Alert>
        )}
    </div>
  );
}

function StatCard({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value: string | number }) {
    return (
        <Card className="p-4 flex flex-col items-center justify-center">
            <Icon className="h-8 w-8 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground uppercase">{title}</p>
        </Card>
    );
}


function ProfileSkeleton() {
  return (
    <div className="container mx-auto max-w-4xl space-y-8 animate-pulse">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <Skeleton className="h-32 w-32 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 rounded-md" />
          <Skeleton className="h-5 w-64 rounded-md" />
          <Skeleton className="h-5 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader><Skeleton className="h-7 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-10 w-full" /></CardContent>
          <CardFooter><Skeleton className="h-10 w-32" /></CardFooter>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-7 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-10 w-full" /></CardContent>
          <CardFooter><Skeleton className="h-10 w-36" /></CardFooter>
        </Card>
      </div>
    </div>
  );
}
