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
            {/* Using dangerouslySetInnerHTML for potentially markdown formatted problem statements.
                Ensure the AI output is sanitized or use a markdown renderer if complex markdown is expected.
                For now, splitting by newline for basic formatting. */}
            {question.problemStatement.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-3 last:mb-0">{paragraph}</p>
            ))}
        </div>

        {/* You can add sections for Input/Output format, Constraints, Examples here if provided by AI */}
        {/* For example:
        <Separator />
        <div>
            <h3 className="text-lg font-medium text-foreground mb-1">Input Format:</h3>
            <p className="text-sm text-foreground/80">Example: A single integer N.</p>
        </div>
        <div>
            <h3 className="text-lg font-medium text-foreground mb-1">Output Format:</h3>
            <p className="text-sm text-foreground/80">Example: Print N*2.</p>
        </div>
        <div>
            <h3 className="text-lg font-medium text-foreground mb-1">Example:</h3>
            <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                <code>
                    Input:<br/>
                    5<br/>
                    <br/>
                    Output:<br/>
                    10
                </code>
            </pre>
        </div>
        */}
      </div>
    </ScrollArea>
  );
}
