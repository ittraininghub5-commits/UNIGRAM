import { supabase } from '@/src/lib/supabase';

export type NotificationType =
  | 'message'
  | 'certificate'
  | 'enrollment'
  | 'follow'
  | 'collab'
  | 'system';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn('[notificationService] insert failed (run supabase_migrations_v2.sql):', error.message);
  }
}

export async function fetchNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[notificationService] fetch failed:', error.message);
    return [];
  }

  return (data || []) as AppNotification[];
}

export async function markNotificationRead(notificationId: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
}
