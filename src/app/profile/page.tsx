"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Gift, History, Loader2, Mail, User, Edit3, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

export default function ProfilePage() {
  const { player, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center py-10">Please log in to view your profile.</div>;
  }

  // Mock progress towards next rank
  const progressToNextRank = (player.rating % 100); // Example: rating 1250, next rank at 1300, so 50%

  return (
    <div className="container mx-auto max-w-4xl">
      <Card className="mb-8 shadow-xl border-accent/20">
        <CardHeader className="flex flex-col items-center text-center bg-gradient-to-b from-accent/10 to-transparent py-8">
          <Avatar className="h-32 w-32 mb-4 border-4 border-accent shadow-lg">
            <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="user avatar placeholder" />
            <AvatarFallback className="text-4xl">{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-4xl font-bold text-accent">{player.username}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Level {player.rank} Duelist</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem icon={<User />} label="Username" value={player.username} />
            <InfoItem icon={<Mail />} label="Email (mock)" value={player.email || 'coder@example.com'} />
            <InfoItem icon={<DollarSign className="text-yellow-500" />} label="Coins" value={player.coins.toLocaleString()} />
            <InfoItem icon={<Gift className="text-green-500" />} label="Rank" value={player.rank.toString()} />
          </div>
          
          <div>
            <Label htmlFor="rating" className="text-sm font-medium text-muted-foreground">Rating: {player.rating}</Label>
            <Progress value={progressToNextRank} className="w-full mt-1 h-3" />
            <p className="text-xs text-muted-foreground mt-1 text-right">{progressToNextRank}% to next rank</p>
          </div>

          <Separator />

          <section>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Account Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Button variant="outline" className="w-full justify-start">
                <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <History className="mr-2 h-4 w-4" /> Match History
              </Button>
               <Button variant="outline" className="w-full justify-start">
                <ShieldAlert className="mr-2 h-4 w-4" /> KYC Verification (Mock)
              </Button>
            </div>
          </section>
          
          <Separator />

          <section>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Coin Management</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-secondary/30">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center"><DollarSign className="mr-2 h-5 w-5 text-green-500"/>Buy Coins</CardTitle>
                        <CardDescription>Get more coins to enter duels.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="buy-amount">Amount (₹10 = 100 coins)</Label>
                        <Input id="buy-amount" type="number" placeholder="e.g., 1000 coins" className="mt-1" />
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white">Buy Coins</Button>
                    </CardFooter>
                </Card>
                 <Card className="bg-secondary/30">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center"><Gift className="mr-2 h-5 w-5 text-blue-500"/>Redeem Coins</CardTitle>
                        <CardDescription>Withdraw your winnings (Min. ₹100).</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <Label htmlFor="redeem-amount">Amount (Coins)</Label>
                        <Input id="redeem-amount" type="number" placeholder="e.g., 10000 coins" className="mt-1" />
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Redeem Coins</Button>
                    </CardFooter>
                </Card>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-md font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
