import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export const signAccessToken = (payload: { sub: string; email: string; role: string }) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });

export const signRefreshToken = (payload: { sub: string }) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });