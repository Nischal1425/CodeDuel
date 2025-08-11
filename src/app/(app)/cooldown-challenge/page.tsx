
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldQuestion, Clock } from 'lucide-react';

export default function CooldownChallengePage() {
  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="shadow-lg border-accent/20">
        <CardHeader className="text-center">
            <ShieldQuestion className="h-16 w-16 text-accent mx-auto mb-4" />
            <CardTitle className="text-4xl font-bold">Cooldown Challenge</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              A daily puzzle to keep your skills sharp and earn rewards.
            </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
            <p>
                This feature is coming soon! Check back later for a new, non-competitive challenge every day.
                Solve the puzzle within the time limit to earn bonus coins. It's a great way to warm up or cool down from intense duels.
            </p>
            <div className="flex items-center justify-center text-muted-foreground">
                <Clock className="h-5 w-5 mr-2"/>
                <span>A new challenge will be available every 24 hours.</span>
            </div>
             <Button size="lg" disabled>
                Challenge Coming Soon
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
