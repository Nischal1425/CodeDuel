
"use client";

import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ProblemDisplayProps {
  question: GenerateCodingChallengeOutput;
}

// A simple function to convert markdown-like text to styled HTML.
const formatProblemStatement = (statement: string): string => {
  const html = statement
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+?)`/g, '<code class="font-mono bg-muted/70 text-foreground/80 rounded-sm px-1.5 py-1 text-xs">$1</code>')
    // Headings (e.g., ### Constraints)
    .replace(/^###\s+(.*)/gm, '<h3>$1</h3>')
    // Code blocks (e.g., ```javascript ... ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Unordered lists
    .replace(/^\s*[-*]\s+(.*)/gm, '<li>$1</li>')
    // Wrap consecutive list items in <ul>
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // Handle paragraphs and line breaks
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p)
    .map(p => {
        if (p.startsWith('<ul>') || p.startsWith('<h3>') || p.startsWith('<pre>')) {
            return p;
        }
        // Replace single newlines with <br> for line breaks within a paragraph
        return `<p>${p.replace(/\n/g, '<br />')}</p>`;
    })
    .join('');

  return html;
};


export function ProblemDisplay({ question }: ProblemDisplayProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500 hover:bg-green-600';
      case 'medium': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'hard': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };
  
  const formattedStatement = formatProblemStatement(question.problemStatement);

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
        
        <div 
          className="prose prose-sm max-w-none text-foreground/90"
          dangerouslySetInnerHTML={{ __html: formattedStatement }}
        />
      </div>
    </ScrollArea>
  );
}
