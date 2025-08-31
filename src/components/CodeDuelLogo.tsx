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
      <path d="M10 9L5 12l5 3" />
      <path d="M14 9l5 3-5 3" />
    </svg>
  );
}
