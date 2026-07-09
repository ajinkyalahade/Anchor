import type { Meta, StoryObj } from '@storybook/react-vite';

import TimerBar from './TimerBar';

const meta = {
  title: 'UI/TimerBar',
  component: TimerBar,
  args: {
    progress: 0.64,
    variant: 'focus',
    height: 8,
    animated: false,
  },
  argTypes: {
    progress: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
    },
    variant: {
      control: 'select',
      options: ['focus', 'calm', 'spark', 'warm', 'lilac'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TimerBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-96 max-w-[80vw]">
      <TimerBar {...args} />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="grid w-96 max-w-[80vw] gap-4">
      {(['focus', 'calm', 'spark', 'warm', 'lilac'] as const).map((variant, index) => (
        <div key={variant}>
          <p className="mb-1 text-sm font-medium capitalize text-[var(--color-text-muted)]">
            {variant}
          </p>
          <TimerBar progress={0.85 - index * 0.16} variant={variant} animated={false} />
        </div>
      ))}
    </div>
  ),
};
