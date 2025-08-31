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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="CodeDuelz Logo"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M9 9.5l3 3 3-3" />
      <path d="M10 15l-2-2.5" />
      <path d="M14 15l2-2.5" />
    </svg>
  );
}
