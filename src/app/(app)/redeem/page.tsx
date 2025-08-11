"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Coins, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RedeemPage() {
  const { player } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (redeemAmount <= 0) {
        toast({ title: "Invalid Amount", description: "Please enter a positive amount to redeem.", variant: "destructive"});
        return;
    }
    if (player && redeemAmount > player.coins) {
        toast({ title: "Insufficient Coins", description: "You cannot redeem more coins than you have.", variant: "destructive"});
        return;
    }
    
    setIsLoading(true);
    // In a real app, this would trigger a secure backend process
    setTimeout(() => {
      toast({
        title: 'Redemption Request Submitted',
        description: `Your request to redeem ${redeemAmount} coins is being processed.`,
        className: 'bg-green-500 text-white',
      });
      setIsLoading(false);
      setRedeemAmount(0);
    }, 2000);
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl">Redeem Coins</CardTitle>
            <CardDescription>
              Convert your in-game coins to real-world rewards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!player?.isKycVerified && (
                 <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>KYC Required</AlertTitle>
                    <AlertDescription>
                        You must complete KYC verification before you can redeem coins.
                    </AlertDescription>
                </Alert>
            )}
            <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Your Current Balance</p>
                <p className="text-4xl font-bold text-primary flex items-center justify-center gap-2">
                    <Coins className="h-8 w-8 text-yellow-500" />
                    {player?.coins.toLocaleString() ?? 0}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="redeemAmount">Amount to Redeem</Label>
                    <Input
                        id="redeemAmount"
                        type="number"
                        placeholder="e.g., 5000"
                        value={redeemAmount || ''}
                        onChange={(e) => setRedeemAmount(Number(e.target.value))}
                        disabled={isLoading || !player?.isKycVerified}
                        min="1"
                        max={player?.coins}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="bankDetails">Bank Account Details</Label>
                    <Input
                        id="bankDetails"
                        placeholder="Enter your bank details"
                        disabled={isLoading || !player?.isKycVerified}
                    />
                </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmit} className="w-full" disabled={isLoading || !player?.isKycVerified || !redeemAmount}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redeem Now
            </Button>
          </CardFooter>
        </Card>
    </div>
  );
}
