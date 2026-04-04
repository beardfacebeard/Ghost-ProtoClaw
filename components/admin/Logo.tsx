/**
 * Ghost ProtoClaw Logo
 *
 * Three-slash claw mark with descending opacity.
 * Used in the sidebar header and mobile nav.
 */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="3" fill="#141414" />
      <g transform="translate(4, 5)">
        <path
          d="M6 2 L2 10 L6 8 L4 18 L10 10 L7 12 L11 4 L7 6 Z"
          fill="#e63946"
          opacity="0.95"
        />
        <path
          d="M14 4 L10 12 L14 10 L12 20 L18 12 L15 14 L19 6 L15 8 Z"
          fill="#e63946"
          opacity="0.6"
        />
        <path
          d="M20 1 L17 7 L20 5.5 L18.5 14 L23 8 L20.5 9.5 L24 3 L20.5 4.5 Z"
          fill="#e63946"
          opacity="0.3"
        />
      </g>
    </svg>
  );
}
