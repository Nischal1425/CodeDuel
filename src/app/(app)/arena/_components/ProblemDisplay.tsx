
"use client";

import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ProblemDisplayProps {
  question: GenerateCodingChallengeOutput;
}

export function ProblemDisplay({ question }: ProblemDisplayProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500 hover:bg-green-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'hard': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div>
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-foreground">Problem Details</h2>
                <Badge className={`capitalize text-white ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty}
                </Badge>
            </div>
            <Separator />
        </div>
        
        <div className="prose prose-sm max-w-none text-foreground/90">
            <h3 className="text-lg font-medium text-foreground mb-1">Statement:</h3>
            {question.problemStatement.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-3 last:mb-0">{paragraph}</p>
            ))}
        </div>
      </div>
    </ScrollArea>
  );
}
