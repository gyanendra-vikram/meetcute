import User from '../models/User.js';

export const isMemeAdminEmail = (email) => {
  const allowedEmails = (process.env.MEME_ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowedEmails.includes(String(email || '').trim().toLowerCase());
};

export const requireMemeAdmin = async (req, res, next) => {
  const user = await User.findById(req.user.id).select('email');
  if (!user) return res.status(404).json({ msg: 'User not found' });
  if (!isMemeAdminEmail(user.email)) {
    return res.status(403).json({ msg: 'Meme admin access is required' });
  }
  next();
};
