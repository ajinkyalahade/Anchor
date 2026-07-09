import { render, screen } from '@testing-library/react';

import Button from './Button';

describe('Button', () => {
  it('disables the button and shows a spinner while loading', () => {
    render(<Button loading>Save changes</Button>);

    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('respects the disabled prop', () => {
    render(<Button disabled>Submit</Button>);

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
