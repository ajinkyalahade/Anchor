# UI Primitive Storybook

Storybook is configured in `frontend/.storybook` and covers shipped UI primitives.

## Covered Primitives

- `Card`: `frontend/src/components/ui/Card.stories.tsx`
- `Button`: `frontend/src/components/ui/Button.stories.tsx`
- `IconButton`: `frontend/src/components/ui/IconButton.stories.tsx`
- `Badge`: `frontend/src/components/ui/Badge.stories.tsx`
- `TimerBar`: `frontend/src/components/ui/TimerBar.stories.tsx`
- `VoiceInput`: `frontend/src/components/VoiceInput.stories.tsx`

## Commands

```bash
cd frontend
npm run storybook
npm run build-storybook
```

Storybook loads `frontend/src/index.css` through `.storybook/preview.ts`, so stories use the same
design tokens as the app.

## Visual QA

Static build can be served locally from `frontend/storybook-static` when Storybook dev server is
not available in the sandbox.
