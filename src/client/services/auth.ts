import { api, setToken, clearToken } from './api.js';
import { generateEncryptionKey, storeKey, clearStoredKey, getStoredKey } from '../crypto/encryption.js';

export interface RegisterResult {
  username: string;
  encryptionKey: string;
}

export async function register(username: string, password: string): Promise<RegisterResult> {
  const result = await api.auth.register(username, password);
  setToken(result.token);

  // Generate encryption key for user to save
  const encryptionKey = await generateEncryptionKey();
  storeKey(encryptionKey);

  return { username: result.username, encryptionKey };
}

export async function login(username: string, password: string, encryptionKey: string): Promise<void> {
  const result = await api.auth.login(username, password);
  setToken(result.token);
  storeKey(encryptionKey);
}

export async function loginWithPasskey(encryptionKey: string): Promise<string> {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const options = await api.passkeys.getAuthenticationOptions();
  const authResponse = await startAuthentication({ optionsJSON: options });
  const result = await api.passkeys.verifyAuthentication(authResponse, options.challenge);
  setToken(result.token);
  storeKey(encryptionKey);
  return result.username;
}

export async function registerPasskey(): Promise<void> {
  const { startRegistration } = await import('@simplewebauthn/browser');
  const options = await api.passkeys.getRegistrationOptions();
  const regResponse = await startRegistration({ optionsJSON: options });
  await api.passkeys.verifyRegistration(regResponse, options.challenge);
}

export function logout(): void {
  clearToken();
  clearStoredKey();
}

export function isLoggedIn(): boolean {
  return !!sessionStorage.getItem('lavendar_token');
}

export function hasEncryptionKey(): boolean {
  return !!getStoredKey();
}
