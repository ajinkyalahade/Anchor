import type { Meta, StoryObj } from '@storybook/react-vite';

import Badge from './Badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  args: {
    children: 'Building',
    variant: 'muted',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['calm', 'focus', 'spark', 'warm', 'lilac', 'muted'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['calm', 'focus', 'spark', 'warm', 'lilac', 'muted'] as const).map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
