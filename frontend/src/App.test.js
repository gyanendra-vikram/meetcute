import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the sign-in screen to logged-out visitors', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
});
