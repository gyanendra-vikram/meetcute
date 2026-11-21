import { act, render, screen } from '@testing-library/react';
import Navbar from './Navbar';
import API from '../utils/api';
import { toast } from 'react-toastify';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => require('react').createElement('a', { ...props, href: to }, children),
  NavLink: ({ children, className, to, ...props }) => require('react').createElement(
    'a',
    {
      ...props,
      href: to,
      className: typeof className === 'function' ? className({ isActive: false }) : className,
    },
    typeof children === 'function' ? children({ isActive: false }) : children,
  ),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: global.window.location.pathname }),
}), { virtual: true });
jest.mock('../utils/api', () => ({ get: jest.fn() }));
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Navbar match notifications', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/discover');
  });

  test('shows an unread badge for a new match and clears it when Battles opens', async () => {
    jest.useFakeTimers();
    const newMatch = { _id: 'new', profile: { name: 'New' } };
    let matches = [];
    API.get.mockImplementation((path) => Promise.resolve({
      data: path === '/auth/me' ? { name: 'Test User' } : matches,
    }));

    const { rerender } = render(<Navbar onLogout={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Battles' })).toBeInTheDocument();

    matches = [newMatch];
    await act(async () => {
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Battles, 1 unread notification' })).toBeInTheDocument();

    window.history.pushState({}, '', '/battles');
    rerender(<Navbar onLogout={jest.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('link', { name: 'Battles' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('battlemeet.readBattleMatchIds'))).toContain('new');
  });
});
