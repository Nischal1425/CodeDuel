
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, player } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && player) {
      router.replace('/dashboard');
    }
  }, [player, isLoading, router]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Validation Error", description: "Please enter email and password.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);

    if (!IS_FIREBASE_CONFIGURED) {
      // Mock login for offline mode, no real auth happens
      const mockPlayerId = `mock-${email.replace(/@.*/, '')}`;
      await new Promise(resolve => setTimeout(resolve, 500));
      // In offline mode, AuthProvider handles creating a mock player
      // We just need to set the ID and let it take over.
      const { setPlayerId } = useAuth();
      setPlayerId(mockPlayerId);
      router.push('/dashboard');
      setIsProcessing(false);
      return;
    }
    
    // --- Firebase Auth Flow ---
    if (authMode === 'login') {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Login Successful", description: "Welcome back!", className: "bg-green-500 text-white" });
        // AuthProvider's onAuthStateChanged will handle the redirect
      } catch (error) {
        const authError = error as AuthError;
        console.error("Login Error: ", authError);
        toast({ title: "Login Failed", description: "Invalid credentials. Please check your email and password.", variant: "destructive" });
      }
    } else { // authMode === 'signup'
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
        // AuthProvider's onAuthStateChanged will handle the redirect
      } catch (error) {
        const authError = error as AuthError;
        let errorMessage = "An error occurred during sign-up.";
        if (authError.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (authError.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Try logging in instead.';
        }
        console.error("Sign-up Error: ", authError);
        toast({ title: "Sign-up Failed", description: errorMessage, variant: "destructive" });
      }
    }

    setIsProcessing(false);
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
                <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as 'login' | 'signup')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>
                    <form onSubmit={handleAuthAction}>
                        <CardHeader className="pt-6">
                            <CardTitle className="text-2xl text-center text-primary">
                                {authMode === 'login' ? 'Welcome Back!' : 'Join the Battle!'}
                            </CardTitle>
                            <CardDescription className="text-center text-muted-foreground">
                                {IS_FIREBASE_CONFIGURED 
                                    ? (authMode === 'login' ? "Enter your credentials to log in." : "Create an account to start dueling.")
                                    : "Enter any email/password to play in offline mode."
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                           <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isProcessing || !email || !password}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isProcessing ? 'Processing...' : (authMode === 'login' ? 'Login' : 'Create Account')}
                            </Button>
                             <p className="text-xs text-muted-foreground text-center">
                              {IS_FIREBASE_CONFIGURED 
                                ? "Your password is handled securely by Firebase Authentication." 
                                : "No Firebase credentials found. The app is in offline mode."
                              }
                            </p>
                        </CardFooter>
                    </form>
                </Tabs>
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
