import type { SVGProps } from 'react';

export function CodeDuelLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="hsl(var(--primary))"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="CodeDuelz Logo"
      {...props}
    >
      <path d="M12 2a5 5 0 0 0-5 5v2.5" />
      <path d="M17 9.5V7a5 5 0 0 0-10 0v2.5" />
      <path d="M12 22V12" />
      <path d="M9 12H7.5a4.5 4.5 0 1 1 0-9" />
      <path d="M15 12h1.5a4.5 4.5 0 1 0 0-9" />
      <path d="M9 16l-4-4" />
      <path d="M15 16l4-4" />
    </svg>
  );
}
