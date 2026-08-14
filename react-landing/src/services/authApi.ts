export type Role = 'customer' | 'broker';

export interface AuthProfile {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  created_by: string;
  created_date: string;
  last_updated_by: string | null;
  last_updated_date: string | null;
}

export interface SignupInput {
  email: string;
  password: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface JwtClaims {
  sub?: string;
  username?: string;
  role?: Role;
  exp?: number;
}

// The API's login field is literally "username" — signup() below sets it to
// the email the person types, so "log in with email" holds end to end.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '')
  ?? 'https://divinevisioninfrabackend.onrender.com';

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function firstValidationMessage(detail: unknown): string | null {
  if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
    return detail[0].msg as string;
  }
  return null;
}

function messageForError(status: number, detail: unknown, kind: 'signup' | 'login'): string {
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 500) return "Something went wrong on our end. Please try again shortly.";

  if (kind === 'signup') {
    if (status === 400 && detail === 'username_taken') return 'That email is already registered.';
    if (status === 409) return 'That account could not be created. Please try again.';
    if (status === 422) return firstValidationMessage(detail) ?? 'Please check the details you entered.';
  } else {
    if (status === 401) return 'Incorrect email or password.';
    if (status === 422) return firstValidationMessage(detail) ?? 'Please check the details you entered.';
  }

  return 'Something went wrong. Please try again.';
}

async function postJson<T>(path: string, body: unknown, kind: 'signup' | 'login'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, null, 'Could not reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForError(res.status, detail, kind));
  }

  return data as T;
}

export function signup(role: Role, input: SignupInput): Promise<AuthProfile> {
  return postJson<AuthProfile>(`/${role}/signup`, {
    username: input.email,
    email: input.email,
    password: input.password,
    phone: input.phone || undefined,
    first_name: input.first_name || undefined,
    last_name: input.last_name || undefined,
  }, 'signup');
}

export function login(role: Role, input: LoginInput): Promise<AuthTokenResponse> {
  return postJson<AuthTokenResponse>(`/${role}/login`, {
    username: input.email,
    password: input.password,
  }, 'login');
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}
