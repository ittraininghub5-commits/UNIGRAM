import { UserRole } from '@/src/types';

export function normalizeUserRole(role: string | null | undefined): UserRole {
  const value = String(role || '').trim().toLowerCase();
  if (value.startsWith('mentor')) {
    return 'mentor';
  }
  return 'student';
}

export function isMentorRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === 'mentor';
}

export function isStudentRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === 'student';
}

export function getHomeRouteForRole(role: string | null | undefined): '/feed' | '/dashboard' {
  return isMentorRole(role) ? '/dashboard' : '/feed';
}
