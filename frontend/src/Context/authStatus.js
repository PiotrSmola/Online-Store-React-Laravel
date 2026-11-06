export const AUTH_STATUS = {
  /** A stored token is being checked. Guarded pages must wait. */
  loading: 'loading',
  authenticated: 'authenticated',
  guest: 'guest',
  /** The check failed for a reason other than the token, such as a lost connection. */
  unknown: 'unknown',
};
