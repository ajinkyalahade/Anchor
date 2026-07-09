import type { Meta, StoryObj } from '@storybook/react-vite';
import { Play, Sparkles } from 'lucide-react';

import Button from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: 'Start',
    size: 'md',
    variant: 'primary',
    disabled: false,
    fullWidth: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'calm', 'focus', 'spark', 'warm'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithIcon: Story = {
  args: {
    children: 'Begin focus',
    icon: <Play size={18} />,
    variant: 'focus',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['primary', 'secondary', 'ghost', 'calm', 'focus', 'spark', 'warm'] as const).map(
        (variant) => (
          <Button key={variant} variant={variant} icon={<Sparkles size={16} />}>
            {variant}
          </Button>
        ),
      )}
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    children: 'Waiting',
    disabled: true,
  },
};
