import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import VoiceInput from './VoiceInput';

const meta = {
  title: 'UI/VoiceInput',
  component: VoiceInput,
  tags: ['autodocs'],
} satisfies Meta<typeof VoiceInput>;

export default meta;

type Story = StoryObj<typeof meta>;

function VoiceInputExample() {
  const [value, setValue] = useState('Voice support appears only in compatible browsers.');

  return (
    <div className="flex w-96 max-w-[80vw] items-center gap-3 rounded-2xl bg-[var(--color-bg-surface)] p-4">
      <VoiceInput onTranscript={setValue} />
      <p className="text-sm text-[var(--color-text-muted)]">{value}</p>
    </div>
  );
}

export const Playground: Story = {
  args: {
    onTranscript: () => undefined,
  },
  render: () => <VoiceInputExample />,
};
