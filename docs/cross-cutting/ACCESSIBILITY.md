# Accessibility

Anchor should feel calm and usable for users under cognitive load.

## UI Rules

- Mobile-first layouts.
- Bottom navigation stays at five items.
- Timers include visual time bars, not digits only.
- Body text should meet at least WCAG AA contrast.
- Prefer clear action labels over explanatory copy blocks.
- Avoid shame language and streak-loss language.

## Motion

Global reduced-motion support lives in `frontend/src/index.css`.

Rules:

- No bouncy transitions.
- Keep state changes around 200-400 ms.
- Disable long-running decorative animation when `prefers-reduced-motion` is set.

## Text Input

Voice input is expected for text-heavy fields. The shared component is
`frontend/src/components/VoiceInput.tsx`.

## Verification

For visual changes:

- check mobile width around 375 px
- check tablet/desktop around 768 px and 1440 px
- verify text does not overlap cards or nav
- verify bottom nav does not cover primary buttons
