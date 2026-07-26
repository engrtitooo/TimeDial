/**
 * Email Helper & Privacy Utilities for TimeDial 2FA System
 */

export interface AuthVerifyAccessResponse {
  success: boolean;
  challengeToken?: string;
  maskedEmail?: string;
  message?: string;
}

export interface AuthVerify2FAResponse {
  success: boolean;
  token?: string;
  message?: string;
}

export interface AuthCheckResponse {
  authenticated: boolean;
  user?: string;
}

/**
 * Client-side email masking utility for UI privacy.
 * Example: 'user@example.com' -> 'us***r@example.com'
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  if (name.length === 3) {
    return `${name[0]}*${name[2]}@${domain}`;
  }
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}
