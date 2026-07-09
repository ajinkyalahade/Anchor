import { render, screen } from '@testing-library/react';

import FeatureHeader from './FeatureHeader';

describe('FeatureHeader', () => {
  it('renders title, subtitle, description, and badge content', () => {
    render(
      <FeatureHeader
        title="Focus"
        subtitle="Stay on the next small step."
        description="Break work down and keep the timer visible."
        badge={<span>Badge</span>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByText('Stay on the next small step.')).toBeInTheDocument();
    expect(screen.getByText('Break work down and keep the timer visible.')).toBeInTheDocument();
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });
});
