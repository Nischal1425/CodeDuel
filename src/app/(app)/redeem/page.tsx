
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Gift, ShieldAlert, ArrowLeft, Coins as CoinsIcon, Banknote } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const MIN_REDEEM = 5000;
const REDEEM_RATE_INR_PER_100_COINS = 8; // e.g., 8 rupees per 100 coins
const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export default function RedeemPage() {
  const { player, isLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountToRedeem, setAmountToRedeem] = useState<number | string>("");

  const calculatedValue = typeof amountToRedeem === 'number' ? (amountToRedeem / 100) * REDEEM_RATE_INR_PER_100_COINS : 0;

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !amountToRedeem || typeof amountToRedeem !== 'number') return;
    
    if (amountToRedeem < MIN_REDEEM) {
        toast({ title: "Amount Too Low", description: `You must redeem at least ${MIN_REDEEM} coins.`, variant: "destructive" });
        return;
    }
    if (amountToRedeem > player.coins) {
        toast({ title: "Insufficient Coins", description: `You cannot redeem more coins than you have.`, variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    toast({
      title: "Processing Redemption",
      description: `Redeeming ${amountToRedeem} coins...`,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (IS_FIREBASE_CONFIGURED) {
        try {
            const playerRef = doc(db, "players", player.id);
            await updateDoc(playerRef, { coins: player.coins - amountToRedeem });
        } catch (error) {
            console.error("Redeem failed:", error);
            toast({ title: "Error", description: "Could not process your redemption request.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
    }
    
    // Auth context will update automatically via real-time listener
    toast({
      title: "Redemption Successful!",
      description: `${amountToRedeem} coins have been redeemed.`,
      className: "bg-green-500 text-white",
    });
    setAmountToRedeem("");
    setIsSubmitting(false);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center py-10">Please log in to view this page.</div>;
  }
  
  if (!player.isKycVerified) {
    return (
       <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg border-destructive/50">
                <CardHeader>
                    <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
                    <CardTitle className="text-3xl text-destructive">KYC Verification Required</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg text-muted-foreground">
                       You must verify your account before you can redeem winnings. This is to ensure a fair and secure environment for all players on the Pro Circuit.
                    </p>
                    <Button asChild variant="destructive">
                        <Link href="/kyc">Start KYC Verification</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <Gift className="h-16 w-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl">Redeem Your Winnings</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Current Balance: <span className="font-bold text-yellow-600">{player.coins.toLocaleString()}</span> <CoinsIcon className="inline h-5 w-5 align-text-bottom text-yellow-500" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Banknote className="h-4 w-4" />
            <AlertTitle>Redemption Details (Mock)</AlertTitle>
            <AlertDescription>
                Minimum redemption is {MIN_REDEEM.toLocaleString()} coins. Rate: ₹{REDEEM_RATE_INR_PER_100_COINS} per 100 coins. No real money is transferred.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleMockSubmit} className="space-y-6">
            <div className="space-y-1.5">
                <Label htmlFor="amount">Coins to Redeem</Label>
                <Input 
                    id="amount" 
                    type="number" 
                    placeholder={`e.g., ${MIN_REDEEM}`} 
                    required 
                    min={MIN_REDEEM}
                    max={player.coins}
                    value={amountToRedeem}
                    onChange={(e) => setAmountToRedeem(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    disabled={isSubmitting} 
                />
            </div>
            {calculatedValue > 0 && (
                <p className="text-sm text-muted-foreground">Estimated redemption value: <span className="font-semibold text-green-600">₹{calculatedValue.toFixed(2)}</span></p>
            )}
             <div className="space-y-1.5">
                <Label htmlFor="bankAccount">Bank Account (IBAN)</Label>
                <Input id="bankAccount" placeholder="DE89 3704 0044 0532 0130 00" required disabled={isSubmitting} />
             </div>
             <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || !amountToRedeem}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Processing...' : `Redeem ${amountToRedeem > 0 ? amountToRedeem : ''} Coins`}
            </Button>
          </form>
        </CardContent>
         <CardFooter>
            <Button variant="link" asChild className="mx-auto">
                <Link href="/profile"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Profile</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
