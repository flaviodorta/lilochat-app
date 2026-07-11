import { z } from 'zod';

/** Nickname rules: 3–20 chars, url-safe (used as avatar seed and public handle). */
export const nicknameSchema = z
  .string()
  .min(3, 'Nickname must be at least 3 characters')
  .max(20, 'Nickname must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscore');

export const emailSchema = z.string().email().max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/** Access token travels in the body; the refresh token is set as an httpOnly cookie. */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresIn: z.number().int().positive(), // seconds
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  nickname: nicknameSchema,
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileBodySchema = z.object({
  nickname: nicknameSchema,
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

/** Internal identity-service response; the gateway moves refreshToken into an httpOnly cookie. */
export const authSessionSchema = z.object({
  user: userProfileSchema,
  accessToken: z.string(),
  accessTokenExpiresIn: z.number().int().positive(),
  refreshToken: z.string(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
