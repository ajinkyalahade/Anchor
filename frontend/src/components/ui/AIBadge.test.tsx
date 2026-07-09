import { render, screen } from '@testing-library/react';

import AIBadge from './AIBadge';

describe('AIBadge', () => {
  it('renders the default AI badge', () => {
    render(<AIBadge />);

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders the coming soon variant text', () => {
    render(<AIBadge variant="coming-soon" />);

    expect(screen.getByText('AI — Coming Soon')).toBeInTheDocument();
  });
});
