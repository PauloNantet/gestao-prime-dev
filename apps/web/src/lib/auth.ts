import type { AuthResponse, User } from '@gestao-prime/shared';
import api from './api';

export const TOKEN_KEY = '@gp:token';
export const USER_KEY = '@gp:user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login';
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  setAuth(data);
  return data;
}

export async function register(name: string, email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
  setAuth(data);
  return data;
}
