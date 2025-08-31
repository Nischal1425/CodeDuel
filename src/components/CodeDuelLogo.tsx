import type { SVGProps } from 'react';

export function CodeDuelLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 215 50"
      width="180"
      height="42"
      aria-label="Code Duelz Logo"
      {...props}
    >
      <rect width="215" height="50" fill="transparent" />
      <path d="M25 5 L15 15 L15 35 L25 45 L35 35 L35 15 Z" fill="hsl(var(--primary))" />
      <path d="M20 10 L10 20 L10 30 L20 40 L30 30 L30 20 Z" fill="hsl(var(--background))" />
      <path d="M25 12 L18 18 L18 32 L25 38 L32 32 L32 18 Z" fill="hsl(var(--primary))" />
      
      <text
        x="48"
        y="34"
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="28"
        fontWeight="bold"
        fill="hsl(var(--foreground))"
      >
        CodeDuelz
      </text>
    </svg>
  );
}
