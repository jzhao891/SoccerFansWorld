import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function Hello({ name }: { name: string }) {
  return <div>Hello, {name}!</div>;
}

describe('smoke test', () => {
  it('renders a React component', () => {
    render(<Hello name="Soccer Fans World" />);
    expect(screen.getByText('Hello, Soccer Fans World!')).toBeInTheDocument();
  });
});
