
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { CodeDuelLogo } from '@/components/CodeDuelLogo';
import { Swords, LogIn, Info, Loader2 } from 'lucide-react';
import type { Player } from '@/types';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, type AuthError } from 'firebase/auth';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export default function LandingPage() {
  const router = useRouter();
  const { setPlayerId, isLoading, player } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && player) {
      router.replace('/dashboard');
    }
  }, [player, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Validation Error", description: "Please enter email and password.", variant: "destructive" });
      return;
    }

    setIsLoggingIn(true);
    
    if (!IS_FIREBASE_CONFIGURED) {
      // Mock login for offline mode
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockPlayerId = `mock-${email.replace(/@.*/, '')}`;
      setPlayerId(mockPlayerId);
      router.push('/dashboard');
      setIsLoggingIn(false);
      return;
    }
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Login Successful", description: "Welcome back!", className: "bg-green-500 text-white" });
    } catch (error) {
        const authError = error as AuthError;
        // If sign-in fails, it could be a new user or a wrong password.
        // We'll try to create an account. If that also fails, it's likely an issue
        // like "password too weak" or the email is already in use with a different credential type.
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const newPlayer: Omit<Player, 'id'> = {
                username: email.split('@')[0] || 'New Duelist',
                email: email,
                coins: 500, // Starting coins
                rank: 1,
                rating: 1000, // Starting rating
                avatarUrl: `https://placehold.co/100x100.png?text=${email.substring(0,1).toUpperCase()}`,
                unlockedAchievements: [],
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                winStreak: 0,
                isKycVerified: false,
            };
            
            await setDoc(doc(db, "players", user.uid), newPlayer);
            toast({ title: "Account Created!", description: "Welcome to Code Duel!", className: "bg-green-500 text-white" });

        } catch (creationError) {
            const creationAuthError = creationError as AuthError;
            // If sign-up also fails, show a more generic but helpful error.
            let errorMessage = "An error occurred. Please check your credentials and try again.";
            if (creationAuthError.code === 'auth/weak-password') {
                errorMessage = 'The password is too weak. Please use at least 6 characters.';
            } else if (authError.code === 'auth/invalid-credential') {
                // This is the most likely case for a login failure on an existing account
                errorMessage = "Incorrect password or user not found. Please check your credentials.";
            }

            console.error("Authentication Error: ", creationAuthError);
            toast({ title: "Authentication Failed", description: errorMessage, variant: "destructive" });
        }
    } finally {
        setIsLoggingIn(false);
    }
  };

  if (isLoading || (!isLoading && player)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/30">
      <header className="py-6 px-4 sm:px-6 lg:px-8 shadow-sm sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CodeDuelLogo />
            <h1 className="text-xl font-semibold font-mono text-foreground">CodeDuelz</h1>
          </div>
          <Button variant="ghost" onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Login / Sign Up
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-20 md:py-32 text-center bg-background/50">
          <div className="container mx-auto px-4">
            <Swords className="h-20 w-20 text-primary mx-auto mb-6" />
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6">
              Welcome to Code Duel
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Challenge other coders in thrilling 1v1 real-time battles. Sharpen your skills, earn coins, and climb the leaderboard!
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <LogIn className="mr-2 h-5 w-5" /> Get Started
            </Button>
          </div>
        </section>

        <section id="about-section" className="py-16 bg-card">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Info className="h-12 w-12 text-accent mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground">What is Code Duel?</h2>
            </div>
            <div className="max-w-3xl mx-auto text-md md:text-lg text-card-foreground/90 space-y-6 leading-relaxed">
              <p>
                Code Duel is an exciting platform where developers can test their coding prowess against others in head-to-head programming challenges. 
              </p>
              <p>
                Whether you're a seasoned competitive programmer or just looking to improve your problem-solving skills, Code Duel offers a fun and engaging way to compete, learn, and win.
              </p>
              <ul className="list-disc list-inside space-y-3 pl-4">
                <li>Solve unique, AI-generated coding problems tailored to your skill level.</li>
                <li>Compete for virtual coins and climb the global leaderboard.</li>
                <li>Experience quick, intense matches perfect for a coding adrenaline rush.</li>
                <li>Improve your coding speed, accuracy, and problem-solving under pressure.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="login-section" className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-md">
            <Card className="shadow-2xl border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl text-center text-primary">Join the Battle!</CardTitle>
                <CardDescription className="text-center text-muted-foreground">
                  {IS_FIREBASE_CONFIGURED ? "Log in or create an account to start dueling." : "Enter any email/password to play in offline mode."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required 
                           className="bg-input/50 focus:border-primary"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required 
                           className="bg-input/50 focus:border-primary"/>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoggingIn || !email || !password}>
                    {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoggingIn ? 'Processing...' : 'Login / Sign Up'}
                  </Button>
                </form>
              </CardContent>
               <CardFooter className="text-xs text-muted-foreground text-center block pt-4">
                <p>
                  {IS_FIREBASE_CONFIGURED 
                    ? "Your password is handled securely by Firebase Authentication." 
                    : "No Firebase credentials found. The app is in offline mode."
                  }
                </p>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center bg-card border-t">
        <div className="container mx-auto px-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Code Duel. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
