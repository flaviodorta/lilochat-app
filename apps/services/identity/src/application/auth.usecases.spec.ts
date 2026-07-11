import { beforeEach, describe, expect, it } from 'vitest';
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  NicknameAlreadyInUseError,
  RefreshTokenReuseError,
  UserNotFoundError,
} from '../domain/errors.js';
import { GetProfileUseCase } from './get-profile.usecase.js';
import { LoginUseCase } from './login.usecase.js';
import { LogoutUseCase } from './logout.usecase.js';
import { RefreshUseCase } from './refresh.usecase.js';
import { RegisterUseCase } from './register.usecase.js';
import { UpdateNicknameUseCase } from './update-nickname.usecase.js';
import { makeTestContext, type TestContext } from '../testing/fakes.js';

const INPUT = { email: 'Flavio@Example.com', password: 'supersecret', nickname: 'flavio' };

let ctx: TestContext;
let register: RegisterUseCase;
let login: LoginUseCase;
let refresh: RefreshUseCase;
let logout: LogoutUseCase;

beforeEach(() => {
  ctx = makeTestContext();
  register = new RegisterUseCase({
    users: ctx.users,
    hasher: ctx.hasher,
    tokens: ctx.tokens,
    clock: ctx.clock,
    ids: ctx.ids,
  });
  login = new LoginUseCase({ users: ctx.users, hasher: ctx.hasher, tokens: ctx.tokens });
  refresh = new RefreshUseCase({
    users: ctx.users,
    refreshTokens: ctx.refreshTokens,
    generator: ctx.generator,
    tokens: ctx.tokens,
    clock: ctx.clock,
  });
  logout = new LogoutUseCase({
    refreshTokens: ctx.refreshTokens,
    generator: ctx.generator,
    clock: ctx.clock,
  });
});

describe('RegisterUseCase', () => {
  it('creates the user and returns profile + tokens', async () => {
    const session = await register.execute(INPUT);
    expect(session.user.email).toBe('flavio@example.com');
    expect(session.user.nickname).toBe('flavio');
    expect(session.accessToken).toContain('jwt:');
    expect(session.refreshToken).toBe('refresh-1');
    expect(ctx.users.byId.size).toBe(1);
  });

  it('stores the hashed password, never the plain one', async () => {
    await register.execute(INPUT);
    const user = await ctx.users.findByEmail('flavio@example.com');
    expect(user?.passwordHash).toBe('hashed:supersecret');
  });

  it('rejects duplicate email (case-insensitive) and nickname', async () => {
    await register.execute(INPUT);
    await expect(
      register.execute({ ...INPUT, nickname: 'other', email: 'FLAVIO@example.com' }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
    await expect(register.execute({ ...INPUT, email: 'x@y.com' })).rejects.toBeInstanceOf(
      NicknameAlreadyInUseError,
    );
  });
});

describe('LoginUseCase', () => {
  beforeEach(() => register.execute(INPUT));

  it('returns a session for correct credentials (email case-insensitive)', async () => {
    const session = await login.execute({ email: 'FLAVIO@example.com', password: 'supersecret' });
    expect(session.user.nickname).toBe('flavio');
    expect(session.refreshToken).toBe('refresh-2'); // new family after register's refresh-1
  });

  it('throws the same error for wrong password and unknown email (no enumeration)', async () => {
    const wrongPassword = login
      .execute({ email: INPUT.email, password: 'nope' })
      .catch((e: unknown) => e);
    const unknownEmail = login
      .execute({ email: 'ghost@x.com', password: 'nope' })
      .catch((e: unknown) => e);
    expect(await wrongPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(await unknownEmail).toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('RefreshUseCase — rotation & reuse detection', () => {
  it('rotates: old token becomes single-use, new token works', async () => {
    const first = await register.execute(INPUT);

    const second = await refresh.execute({ refreshToken: first.refreshToken });
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // the rotated (old) token is now poisoned: using it = reuse
    await expect(refresh.execute({ refreshToken: first.refreshToken })).rejects.toBeInstanceOf(
      RefreshTokenReuseError,
    );
  });

  it('reuse revokes the WHOLE family — even the newest token dies', async () => {
    const first = await register.execute(INPUT);
    const second = await refresh.execute({ refreshToken: first.refreshToken });

    await refresh.execute({ refreshToken: first.refreshToken }).catch(() => undefined); // reuse!

    await expect(refresh.execute({ refreshToken: second.refreshToken })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('rejects unknown and expired tokens', async () => {
    await expect(refresh.execute({ refreshToken: 'ghost' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    const session = await register.execute(INPUT);
    ctx.clock.advanceMs(31 * 24 * 60 * 60 * 1000); // past the 30-day TTL
    await expect(refresh.execute({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('keeps the familyId across rotations', async () => {
    const first = await register.execute(INPUT);
    await refresh.execute({ refreshToken: first.refreshToken });
    const families = new Set([...ctx.refreshTokens.records.values()].map((r) => r.familyId));
    expect(families.size).toBe(1);
  });
});

describe('LogoutUseCase', () => {
  it('revokes the family: refresh stops working', async () => {
    const session = await register.execute(INPUT);
    await logout.execute({ refreshToken: session.refreshToken });
    await expect(refresh.execute({ refreshToken: session.refreshToken })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('is idempotent for unknown tokens', async () => {
    await expect(logout.execute({ refreshToken: 'ghost' })).resolves.toBeUndefined();
  });
});

describe('GetProfileUseCase / UpdateNicknameUseCase', () => {
  it('returns the profile and 404s unknown users', async () => {
    const session = await register.execute(INPUT);
    const getProfile = new GetProfileUseCase({ users: ctx.users });
    await expect(getProfile.execute(session.user.id)).resolves.toEqual(session.user);
    await expect(getProfile.execute('00000000-0000-4000-8000-999999999999')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('updates nickname, no-ops on same value, rejects taken nicknames', async () => {
    const updateNickname = new UpdateNicknameUseCase({ users: ctx.users, clock: ctx.clock });
    const a = await register.execute(INPUT);
    await register.execute({ email: 'b@x.com', password: 'supersecret', nickname: 'other' });

    const updated = await updateNickname.execute({ userId: a.user.id, nickname: 'flavio2' });
    expect(updated.nickname).toBe('flavio2');

    await expect(
      updateNickname.execute({ userId: a.user.id, nickname: 'flavio2' }),
    ).resolves.toMatchObject({ nickname: 'flavio2' }); // no-op

    await expect(
      updateNickname.execute({ userId: a.user.id, nickname: 'other' }),
    ).rejects.toBeInstanceOf(NicknameAlreadyInUseError);
  });
});
