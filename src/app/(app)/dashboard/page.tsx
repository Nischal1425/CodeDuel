
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, BarChart3, Coins, Play, Trophy, User, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
  const { player, isLoading } = useAuth();

  // isLoading is handled by (app)/layout.tsx, but good practice to keep it here for standalone component logic
  if (isLoading) { 
    return <DashboardLoadingSkeleton />;
  }

  // If player is null after loading (e.g. auth failed or navigated here directly), layout will redirect.
  // But as a safeguard or for direct use:
  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
        <p className="mb-6 text-muted-foreground">Please log in to view the dashboard.</p>
        <Link href="/" passHref>
          <Button>Go to Login</Button> 
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <Card className="mb-8 shadow-lg border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-primary">Welcome back, {player.username}!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Ready to duel and climb the ranks?</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <StatCard icon={<Coins className="text-yellow-500" />} title="Your Coins" value={player.coins.toLocaleString()} />
          <StatCard icon={<BarChart3 className="text-green-500" />} title="Your Rank" value={player.rank.toString()} />
          <StatCard icon={<Trophy className="text-blue-500" />} title="Rating" value={player.rating.toString()} />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        <ActionCard
          title="Enter the Arena"
          description="Challenge opponents in real-time coding battles. Put your skills and coins on the line!"
          ctaText="Find Match"
          href="/arena"
          icon={<Play className="h-12 w-12 text-primary" />}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Coding battle illustration"
          aiHint="coding battle"
        />
        <ActionCard
          title="View Leaderboard"
          description="See where you stand among the best coders. Aim for the top!"
          ctaText="Go to Leaderboard"
          href="/leaderboard"
          icon={<Trophy className="h-12 w-12 text-accent" />}
          imageSrc="https://placehold.co/600x400.png"
          imageAlt="Leaderboard illustration"
          aiHint="leaderboard trophy"
        />
      </div>

       <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Your Profile</CardTitle>
          <CardDescription>Manage your account and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Quick links to manage your Code Duel presence.</p>
        </CardContent>
        <CardFooter>
          <Link href="/profile" passHref>
            <Button variant="outline">
              <User className="mr-2 h-4 w-4" />
              Go to Profile
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
}

function StatCard({ icon, title, value }: StatCardProps) {
  return (
    <Card className="bg-secondary/50 hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-secondary-foreground">{title}</CardTitle>
        <div className="h-6 w-6">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
      </CardContent>
    </Card>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  ctaText: string;
  href: string;
  icon: React.ReactNode;
  imageSrc: string;
  imageAlt: string;
  aiHint: string;
}

function ActionCard({ title, description, ctaText, href, icon, imageSrc, imageAlt, aiHint }: ActionCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="relative h-48 w-full">
        <Image src={imageSrc} alt={imageAlt} layout="fill" objectFit="cover" data-ai-hint={aiHint}/>
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">{description}</p>
      </CardContent>
      <CardFooter>
        <Link href={href} passHref>
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {ctaText} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function DashboardLoadingSkeleton() {
  return (
    <div className="container mx-auto animate-pulse">
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-6 bg-muted rounded w-1/2"></div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-secondary/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-6 w-6 bg-muted rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-8">
        {[1, 2].map(i => (
          <Card key={i} className="overflow-hidden">
            <div className="h-48 w-full bg-muted"></div>
            <CardHeader>
              <div className="h-7 bg-muted rounded w-3/5"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </CardContent>
            <CardFooter>
              <div className="h-10 bg-muted rounded w-full"></div>
            </CardFooter>
          </Card>
        ))}
      </div>
       <Card className="mt-8">
        <CardHeader>
          <div className="h-7 bg-muted rounded w-2/5 mb-1"></div>
          <div className="h-5 bg-muted rounded w-3/5"></div>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded w-full"></div>
        </CardContent>
        <CardFooter>
          <div className="h-10 bg-muted rounded w-1/3"></div>
        </CardFooter>
      </Card>
    </div>
  );
}
