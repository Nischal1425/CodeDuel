import type { SVGProps } from 'react';

export function CodeDuelLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="hsl(var(--primary))"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="CodeDuelz Logo"
      {...props}
    >
      <path d="M9 6L4 12l5 6" />
      <path d="M15 6l5 6-5 6" />
    </svg>
  );
}
