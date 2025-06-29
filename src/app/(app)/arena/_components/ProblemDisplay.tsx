
"use client";

import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ProblemDisplayProps {
  question: GenerateCodingChallengeOutput;
}

/**
 * Parses a problem statement string with '###' headers into a structured object.
 * @param {string} statement The raw problem statement string from the AI.
 * @returns {Record<string, string>} An object where keys are section titles (e.g., 'description')
 * and values are the content of that section.
 */
const parseProblemStatement = (statement: string): Record<string, string> => {
  const sections: Record<string, string> = {};
  const regex = /###\s*(.*?)\n([\s\S]*?)(?=###\s*|$)/g;
  let match;
  while ((match = regex.exec(statement)) !== null) {
    const title = match[1].trim().toLowerCase();
    const content = match[2].trim();
    sections[title] = content;
  }
  return sections;
};

/**
 * A simple component to render markdown-like text into styled HTML.
 * Supports:
 * - **bold** -> <strong>
 * - `inline code` -> <code>
 * - lists starting with "- " -> <ul><li>
 * @param {string} content The markdown content to render.
 */
const SimpleMarkdownRenderer = ({ content }: { content: string }) => {
  if (!content) return null;

  // Process paragraphs and simple markdown replacements
  const htmlContent = content
    .split('\n')
    .map((line, index) => {
      // Skip empty lines
      if (!line.trim()) return '';
      
      let processedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+?)`/g, '<code class="font-mono bg-muted/70 text-foreground/80 rounded-sm px-1.5 py-1 text-xs">$1</code>');

      // Handle bullet points
      if (processedLine.trim().startsWith('- ')) {
        return `<li>${processedLine.trim().substring(2)}</li>`;
      }
      
      return `<p>${processedLine}</p>`;
    })
    .join('')
    // Wrap consecutive list items in a <ul>
    .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc pl-5 space-y-1 mt-2">$1</ul>');

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
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
  
  const sections = parseProblemStatement(question.problemStatement);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 text-sm">
        <div>
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-foreground">Problem Details</h2>
                <Badge className={`capitalize text-white ${getDifficultyColor(question.difficulty)}`}>
                    {question.difficulty}
                </Badge>
            </div>
            <Separator />
        </div>
        
        {sections.description && (
          <section>
            <h3 className="font-semibold text-foreground text-base mb-2">Description</h3>
            <div className="prose prose-sm max-w-none text-foreground/90 space-y-3">
              <SimpleMarkdownRenderer content={sections.description} />
            </div>
          </section>
        )}
        
        {sections.examples && (
          <section>
            <h3 className="font-semibold text-foreground text-base mb-2">Examples</h3>
            <div className="prose prose-sm max-w-none text-foreground/90 space-y-4">
              <SimpleMarkdownRenderer content={sections.examples} />
            </div>
          </section>
        )}
        
        {sections.constraints && (
          <section>
            <h3 className="font-semibold text-foreground text-base mb-2">Constraints</h3>
            <div className="prose prose-sm max-w-none text-foreground/90">
              <SimpleMarkdownRenderer content={sections.constraints} />
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
