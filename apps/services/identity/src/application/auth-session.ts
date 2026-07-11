import type { UserProfile } from '@lilochat/contracts';
import type { IssuedTokens } from './token-issuer.js';

/** What auth flows return to the HTTP layer (the gateway turns refreshToken into a cookie). */
export interface AuthSession extends IssuedTokens {
  user: UserProfile;
}
