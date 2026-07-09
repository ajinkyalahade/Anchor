import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mic, Pause, Play, RotateCcw } from 'lucide-react';

import IconButton from './IconButton';

const meta = {
  title: 'UI/IconButton',
  component: IconButton,
  args: {
    icon: <Play size={18} />,
    label: 'Start',
    size: 'md',
    active: false,
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Toolbar: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-bg-surface)] p-3">
      <IconButton icon={<Play size={18} />} label="Start" active />
      <IconButton icon={<Pause size={18} />} label="Pause" />
      <IconButton icon={<RotateCcw size={18} />} label="Reset" />
      <IconButton icon={<Mic size={18} />} label="Voice input" />
    </div>
  ),
};
