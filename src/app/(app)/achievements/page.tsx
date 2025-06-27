
"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Award, Coins as CoinsIcon } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Player } from '@/types';

function getAchievementProgress(player: Player, achievement: typeof ALL_ACHIEVEMENTS[0]) {
  if (!achievement.stat) return { current: 0, goal: achievement.goal, percent: 0 };
  
  const current = player[achievement.stat] as number || 0;
  const goal = achievement.goal;
  const percent = Math.min(100, (current / goal) * 100);

  return { current, goal, percent };
}

export default function AchievementsPage() {
  const { player, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center py-10">Please log in to view achievements.</div>;
  }
  
  const unlockedCount = player.unlockedAchievements.length;
  const totalCount = ALL_ACHIEVEMENTS.length;
  const overallProgress = (unlockedCount / totalCount) * 100;

  return (
    <div className="container mx-auto max-w-4xl">
       <Card className="mb-8 shadow-lg border-accent/20">
        <CardHeader className="text-center">
            <Award className="h-16 w-16 text-accent mx-auto mb-4" />
            <CardTitle className="text-4xl font-bold">Achievements</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">Track your accomplishments and progress in Code Duel.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">Overall Progress</span>
                    <span className="text-sm font-medium text-accent">{unlockedCount} / {totalCount} Unlocked</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ALL_ACHIEVEMENTS.map((achievement) => {
                    const isUnlocked = player.unlockedAchievements.includes(achievement.id);
                    const progress = getAchievementProgress(player, achievement);

                    return (
                        <Card 
                            key={achievement.id}
                            className={cn(
                                "flex flex-col items-center text-center p-4 transition-all duration-300",
                                isUnlocked ? 'bg-accent/10 border-accent shadow-md' : 'bg-muted/50 border-muted-foreground/20'
                            )}
                        >
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className={cn("relative mb-3", !isUnlocked && "grayscale opacity-60")}>
                                          <achievement.icon className={cn("h-16 w-16", isUnlocked ? "text-accent" : "text-muted-foreground")} />
                                          {isUnlocked && <Award className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500" />}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{achievement.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <h3 className="text-lg font-semibold text-foreground">{achievement.name}</h3>
                            <p className="text-xs text-muted-foreground h-8 mb-2">{achievement.description}</p>
                            
                             {achievement.reward && (
                                <p className="text-xs font-semibold text-green-600 mb-3 flex items-center gap-1">
                                    <CoinsIcon className="h-3 w-3"/> +{achievement.reward.amount} coins
                                </p>
                            )}
                            
                            {!isUnlocked && achievement.type === 'counter' && (
                                <div className="w-full mt-auto">
                                    <Progress value={progress.percent} className="h-2" />
                                    <p className="text-xs text-muted-foreground mt-1">{progress.current} / {progress.goal}</p>
                                </div>
                            )}
                        </Card>
                    )
                })}
            </div>
        </CardContent>
       </Card>
    </div>
  )
}
