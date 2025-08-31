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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="CodeDuelz Logo"
      {...props}
    >
        <path d="m14.5 3.5-4 4L2 16l.5 3.5L4 21l3.5-1.5L16 11l4-4 .5-3.5L21 4l-3.5-.5Z" />
        <path d="m18 7 1-1" />
        <path d="m2 16 2.5 2.5" />
        <path d="m14.5 3.5 4.5 4.5" />
        <path d="m10 8 4.5 4.5" />
    </svg>
  );
}
