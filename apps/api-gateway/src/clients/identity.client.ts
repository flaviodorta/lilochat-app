import { HttpException, Inject, Injectable } from '@nestjs/common';
import type {
  AuthSession,
  LoginBody,
  RegisterBody,
  UpdateProfileBody,
  UserProfile,
} from '@lilochat/contracts';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';

/**
 * Internal HTTP client for the identity service. Downstream error bodies
 * ({statusCode, code, message}) pass through to the caller unchanged —
 * the gateway adds edge concerns, it does not rewrite domain errors.
 */
@Injectable()
export class IdentityClient {
  private readonly baseUrl: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.baseUrl = config.IDENTITY_SERVICE_URL.replace(/\/$/, '');
  }

  register(body: RegisterBody): Promise<AuthSession> {
    return this.request('POST', '/auth/register', body);
  }

  login(body: LoginBody): Promise<AuthSession> {
    return this.request('POST', '/auth/login', body);
  }

  refresh(refreshToken: string): Promise<AuthSession> {
    return this.request('POST', '/auth/refresh', { refreshToken });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.request('POST', '/auth/logout', { refreshToken });
  }

  getProfile(userId: string): Promise<UserProfile> {
    return this.request('GET', `/users/${userId}`);
  }

  updateNickname(userId: string, body: UpdateProfileBody): Promise<UserProfile> {
    return this.request('PATCH', `/users/${userId}/nickname`, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new HttpException(data as object, response.status);
    return data as T;
  }
}
