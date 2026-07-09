export default function AnchorWordmark({
  className = '',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 96"
      role="img"
      aria-label="Anchor"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="8" width="80" height="80" rx="28" fill="color-mix(in srgb, var(--color-accent-focus) 16%, var(--color-bg-surface))" />
      <path
        d="M48 24C41.373 24 36 29.373 36 36C36 41.021 39.086 45.321 43.462 47.105V53.641C37.642 55.512 33.1 60.097 31.399 65.969C31.083 67.059 31.903 68.139 33.038 68.139H43.25V74C43.25 76.623 45.377 78.75 48 78.75C50.623 78.75 52.75 76.623 52.75 74V68.139H62.962C64.097 68.139 64.917 67.059 64.601 65.969C62.9 60.097 58.358 55.512 52.538 53.641V47.105C56.914 45.321 60 41.021 60 36C60 29.373 54.627 24 48 24ZM48 31.5C50.485 31.5 52.5 33.515 52.5 36C52.5 38.485 50.485 40.5 48 40.5C45.515 40.5 43.5 38.485 43.5 36C43.5 33.515 45.515 31.5 48 31.5Z"
        fill="var(--color-accent-focus)"
      />
      <text
        x="112"
        y="54"
        fill="var(--color-text-primary)"
        fontFamily="var(--font-display)"
        fontSize="34"
        fontWeight="700"
        letterSpacing="-0.04em"
      >
        Anchor
      </text>
      <text
        x="114"
        y="74"
        fill="var(--color-text-muted)"
        fontFamily="var(--font-body)"
        fontSize="12"
        fontWeight="600"
        letterSpacing="0.18em"
      >
        START SMALL. STAY HELD.
      </text>
    </svg>
  );
}
