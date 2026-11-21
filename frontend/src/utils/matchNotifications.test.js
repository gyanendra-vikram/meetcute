import { toast } from 'react-toastify';
import { notifyMatch } from './matchNotifications';

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn() },
}));

test('shows a match notification only once per match', () => {
  const match = { _id: 'notification-test-match', profile: { name: 'Taylor' } };

  notifyMatch(match);
  notifyMatch(match);

  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledWith(
    "It's a match with Taylor! Your meme battle is waiting in Battles.",
  );
});
