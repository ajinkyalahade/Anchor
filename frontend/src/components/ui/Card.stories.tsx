import type { Meta, StoryObj } from '@storybook/react-vite';

import Card from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  args: {
    variant: 'surface',
    padding: 'md',
    hover: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['surface', 'glass', 'outline'],
    },
    padding: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    children: null,
  },
  render: (args) => (
    <Card {...args} className="w-72">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent-focus)]">
        Suggested for you
      </p>
      <h3 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
        15-minute focus session
      </h3>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        A calm card used for repeatable app surfaces.
      </p>
    </Card>
  ),
};

export const Variants: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      {(['surface', 'glass', 'outline'] as const).map((variant) => (
        <Card key={variant} variant={variant} className="w-64">
          <h3 className="font-semibold capitalize">{variant}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Calm container with constrained copy.
          </p>
        </Card>
      ))}
    </div>
  ),
};
