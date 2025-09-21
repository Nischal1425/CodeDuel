
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
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, googleProvider } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, type AuthError, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from '@/components/ui/separator';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        width="24px"
        height="24px"
      >
        <path
          fill="#FFC107"
          d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
        />
        <path
          fill="#FF3D00"
          d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
        />
        <path
          fill="#1976D2"
          d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.712,35.619,44,29.566,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        />
      </svg>
    );
  }

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, player, setPlayerId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
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
      const mockPlayerId = `mock-${email.replace(/@.*/, '')}`;
      await new Promise(resolve => setTimeout(resolve, 500));
      if (setPlayerId) {
        setPlayerId(mockPlayerId);
      }
      router.push('/dashboard');
      setIsProcessing(false);
      return;
    }
    
    // --- Firebase Auth Flow ---
    if (authMode === 'login') {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Login Successful", description: "Welcome back!", className: "bg-green-500 text-white" });
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
            coins: 500,
            rank: 1,
            rating: 1000,
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
  
  const handleGoogleSignIn = async () => {
    if (!IS_FIREBASE_CONFIGURED) {
        toast({ title: "Offline Mode", description: "Google Sign-In is not available in offline mode.", variant: "destructive" });
        return;
    }

    setIsGoogleProcessing(true);
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const additionalInfo = getAdditionalUserInfo(result);
        
        if (additionalInfo?.isNewUser) {
            const playerRef = doc(db, "players", user.uid);
            const docSnap = await getDoc(playerRef);

            if (!docSnap.exists()) {
                const newPlayer: Omit<Player, 'id'> = {
                    username: user.displayName || user.email?.split('@')[0] || 'New Duelist',
                    email: user.email || '',
                    coins: 500,
                    rank: 1,
                    rating: 1000,
                    avatarUrl: user.photoURL || `https://placehold.co/100x100.png?text=${user.displayName?.substring(0,1).toUpperCase() || 'A'}`,
                    unlockedAchievements: [],
                    matchesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    winStreak: 0,
                    isKycVerified: false,
                };
                await setDoc(playerRef, newPlayer);
                toast({ title: "Account Created!", description: "Welcome to Code Duel!", className: "bg-green-500 text-white" });
            }
        } else {
            toast({ title: "Login Successful", description: "Welcome back!", className: "bg-green-500 text-white" });
        }
    } catch (error) {
        const authError = error as AuthError;
        if (authError.code === 'auth/popup-closed-by-user') {
            // Silently ignore this error as it's a user action, not a failure.
            console.log("Google Sign-In popup closed by user.");
            return;
        }

        console.error("Google Sign-In Error:", authError);
        toast({
            title: "Google Sign-In Failed",
            description: "Could not sign in with Google. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsGoogleProcessing(false);
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
                        </CardFooter>
                    </form>
                    <div className="relative p-6 pt-2 pb-0">
                        <Separator />
                        <span className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">OR</span>
                    </div>
                     <CardContent className="p-6 pt-4">
                        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isGoogleProcessing}>
                            {isGoogleProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2"/>}
                             Continue with Google
                        </Button>
                         <p className="text-xs text-muted-foreground text-center mt-4">
                            {IS_FIREBASE_CONFIGURED 
                            ? "Your account is handled securely by Firebase Authentication." 
                            : "No Firebase credentials found. The app is in offline mode."
                            }
                        </p>
                    </CardContent>
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
