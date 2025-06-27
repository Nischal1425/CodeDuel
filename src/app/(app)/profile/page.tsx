
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { DollarSign, Gift, History, Loader2, Mail, User, Edit3, ShieldAlert, Award, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements';
import type { Achievement as AchievementType, Player } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { generateAvatar } from '@/ai/flows/generate-avatar';

const getAchievementProgress = (player: Player, achievement: AchievementType) => {
  if (!achievement.stat) return { current: 0, goal: achievement.goal, percent: 0 };
  
  const current = player[achievement.stat] as number || 0;
  const goal = achievement.goal;
  const percent = Math.min(100, (current / goal) * 100);

  return { current, goal, percent };
};


export default function ProfilePage() {
  const { player, isLoading, setPlayer } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAvatar = async () => {
      if (!prompt.trim()) {
          toast({ title: "Prompt is empty", description: "Please enter a description for your avatar.", variant: "destructive" });
          return;
      }
      setIsGenerating(true);
      setGeneratedAvatar(null);
      try {
          const result = await generateAvatar({ prompt });
          if (result.imageDataUri) {
              setGeneratedAvatar(result.imageDataUri);
              toast({ title: "Avatar Generated!", description: "You can now set it as your profile picture." });
          } else {
              throw new Error("Received an empty response from the AI.");
          }
      } catch (error) {
          console.error("Error generating avatar:", error);
          toast({ title: "Generation Failed", description: "Could not generate avatar. The AI might be busy. Please try again.", variant: "destructive" });
      } finally {
          setIsGenerating(false);
      }
  };

  const handleSetAvatar = () => {
      if (!generatedAvatar || !player) return;
      setPlayer({ ...player, avatarUrl: generatedAvatar });
      toast({
          title: "Profile Picture Updated!",
          className: "bg-green-500 text-white",
      });
  };

  // Safeguard for direct navigation or if layout somehow fails to redirect
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    // This case should ideally be handled by the AuthenticatedAppLayout redirecting to '/'
    return <div className="text-center py-10">Please log in to view your profile. <Link href="/" className="text-primary underline">Go to Login</Link></div>;
  }

  const progressToNextRank = (player.rating % 100); 

  return (
    <div className="container mx-auto max-w-4xl">
      <Card className="mb-8 shadow-xl border-accent/20">
        <CardHeader className="flex flex-col items-center text-center bg-gradient-to-b from-accent/10 to-transparent py-8">
          <Avatar className="h-32 w-32 mb-4 border-4 border-accent shadow-lg">
            <AvatarImage src={player.avatarUrl || `https://placehold.co/128x128.png?text=${player.username.substring(0,1)}`} alt={player.username} data-ai-hint="user avatar placeholder" />
            <AvatarFallback className="text-4xl">{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-4xl font-bold text-accent">{player.username}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Level {player.rank} Duelist</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoItem icon={<User />} label="Username" value={player.username} />
            <InfoItem icon={<Mail />} label="Email" value={player.email || 'Not set'} />
            <InfoItem icon={<DollarSign className="text-yellow-500" />} label="Coins" value={player.coins.toLocaleString()} />
            <InfoItem icon={<Gift className="text-green-500" />} label="Rank" value={player.rank.toString()} />
          </div>
          
          <div>
            <Label htmlFor="rating" className="text-sm font-medium text-muted-foreground">Rating: {player.rating}</Label>
            <Progress value={progressToNextRank} className="w-full mt-1 h-3" />
            <p className="text-xs text-muted-foreground mt-1 text-right">{progressToNextRank}% to next rank (mock)</p>
          </div>

          <Separator />
          
          <section>
            <h3 className="text-xl font-semibold mb-4 text-foreground">Achievements & Badges</h3>
            <TooltipProvider>
              <div className="flex flex-wrap gap-4">
                {ALL_ACHIEVEMENTS.map((achievement) => {
                  const isUnlocked = player.unlockedAchievements.includes(achievement.id);
                  const progress = getAchievementProgress(player, achievement);
                  
                  return (
                    <Tooltip key={achievement.id} delayDuration={100}>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex flex-col items-center justify-center text-center p-3 w-24 h-28 rounded-lg bg-muted/50 border border-muted-foreground/20 transition-all",
                          isUnlocked ? "border-accent/80" : "grayscale opacity-70"
                        )}>
                          <achievement.icon className={cn("h-8 w-8 mb-2", isUnlocked ? "text-accent" : "text-muted-foreground")} />
                          <span className="text-xs font-medium text-muted-foreground truncate w-full h-8 flex items-center justify-center">{achievement.name}</span>
                          {!isUnlocked && achievement.type === 'counter' && (
                            <Progress value={progress.percent} className="h-1 w-full mt-1" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">{achievement.name}</p>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        {!isUnlocked && achievement.type === 'counter' && (
                          <p className="text-xs text-primary mt-1">Progress: {progress.current} / {progress.goal}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
            <div className="mt-4">
                <Link href="/achievements" passHref>
                    <Button variant="link" className="p-0 h-auto">View All Achievements <Award className="ml-2 h-4 w-4"/></Button>
                </Link>
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Account Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Button variant="outline" className="w-full justify-start" disabled>
                <Edit3 className="mr-2 h-4 w-4" /> Edit Profile (Soon)
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <History className="mr-2 h-4 w-4" /> Match History (Soon)
              </Button>
               <Button variant="outline" className="w-full justify-start" disabled>
                <ShieldAlert className="mr-2 h-4 w-4" /> KYC Verification (Soon)
              </Button>
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-xl font-semibold mb-3 text-foreground flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-accent" /> AI Avatar Generator
            </h3>
            <Card className="bg-secondary/30">
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <Label htmlFor="avatar-prompt">Describe your new avatar</Label>
                    <Input
                      id="avatar-prompt"
                      placeholder="e.g., a cosmic owl, a robot knight, a wizard made of code"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Unleash your creativity! Let our AI craft a unique avatar for you.
                    </p>
                  </div>
                  <Button onClick={handleGenerateAvatar} disabled={isGenerating || !prompt.trim()}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
                    {isGenerating ? 'Generating...' : 'Generate Avatar'}
                  </Button>
                </div>
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="h-32 w-32 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                    {isGenerating && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
                    {!isGenerating && generatedAvatar && (
                      <Image src={generatedAvatar} alt="Generated Avatar" width={128} height={128} className="rounded-lg object-cover" />
                    )}
                    {!isGenerating && !generatedAvatar && (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <Button onClick={handleSetAvatar} disabled={!generatedAvatar || isGenerating} size="sm" variant="outline">
                    Set as Profile Picture
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                        <p className="text-sm text-muted-foreground">Need more coins to compete? Visit the store to stock up!</p>
                    </CardContent>
                    <CardFooter>
                        <Link href="/buy-coins" passHref legacyBehavior>
                            <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white">
                                <a>Visit Store</a>
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
                 <Card className="bg-secondary/30">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center"><Gift className="mr-2 h-5 w-5 text-blue-500"/>Redeem Coins</CardTitle>
                        <CardDescription>Withdraw your winnings (Feature coming soon).</CardDescription>
                    </CardHeader>
                     <CardContent>
                        <Label htmlFor="redeem-amount">Amount (Coins)</Label>
                        <Input id="redeem-amount" type="number" placeholder="e.g., 10000 coins" className="mt-1" disabled />
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled>Redeem Coins (Soon)</Button>
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
