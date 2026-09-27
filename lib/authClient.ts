export function saveAccessToken(token: string) {
  if (typeof window !== 'undefined') sessionStorage.setItem('access_token', token);
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('access_token');
}

export function clearAccessToken() {
  if (typeof window !== 'undefined') sessionStorage.removeItem('access_token');
}