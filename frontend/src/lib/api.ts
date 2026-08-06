import axios from 'axios';

export interface CurrentUser {
  role: 'student' | 'teacher';
  id: string;
  fullName: string;
  email: string;
  rollNumber?: string;
  semester?: string | null;
  section?: string | null;
  faceVerified?: boolean;
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// Double-submit CSRF: echo the server-issued XSRF-TOKEN cookie on every request.
api.interceptors.request.use((config) => {
  const csrf = getCookie('XSRF-TOKEN');
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  const registrationToken = localStorage.getItem('registrationToken');
  if (registrationToken && config.url?.includes('register')) {
    config.headers.Authorization = `Bearer ${registrationToken}`;
  }
  return config;
});

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await api.get('/auth/me');
    return res.data as CurrentUser;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore — the session may already be invalid.
  }
  localStorage.removeItem('registrationToken');
}

export function setRegistrationToken(token: string | null) {
  if (token) {
    localStorage.setItem('registrationToken', token);
  } else {
    localStorage.removeItem('registrationToken');
  }
}

export function getRegistrationToken(): string | null {
  return localStorage.getItem('registrationToken');
}

export default api;
