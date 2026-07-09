import { render } from '@testing-library/react';

import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('renders the shimmer shell with aria-hidden', () => {
    const { container } = render(<Skeleton className="h-12 w-24" />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton.className).toContain('animate-pulse');
  });
});
