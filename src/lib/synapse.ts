import { supabase } from '@/src/lib/supabase';

export interface SynapseWorkspace {
  headline: string;
  skills: string[];
  interests: string[];
  availability: string;
  projectGoals: string;
  preferredRoles: string[];
  updatedAt: string | null;
}

export interface SynapseOutreach {
  id: string;
  targetId: string;
  targetName: string;
  goal: string;
  message: string;
  neededSkills: string[];
  projectIdea: string;
  createdAt: string;
}

export interface SynapseThreadMessage {
  fromId: string;
  toId: string;
  content: string;
  createdAt: string;
}

export interface SynapseAchievement {
  id: string;
  title: string;
  category: string;
  description: string;
  proofUrl: string;
  imageDataUrl?: string;
  certificateDataUrl?: string;
  achievedAt: string;
  createdAt: string;
}

const WORKSPACE_PREFIX = 'synapse:workspace:';
const OUTREACH_PREFIX = 'synapse:outreach:';
const ACHIEVEMENT_PREFIX = 'synapse:achievement:';
const SYNAPSE_CONNECT_REQUEST_MARKERS = [
  'I would like to connect through Synapse.',
  'I would like to connect through Collab.',
];
const SYNAPSE_CONNECT_DECLINE_MARKERS = [
  '[Synapse Connect Declined]',
  '[Collab Request Declined]',
];

const defaultWorkspace: SynapseWorkspace = {
  headline: '',
  skills: [],
  interests: [],
  availability: '',
  projectGoals: '',
  preferredRoles: [],
  updatedAt: null,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isMissingTableError(message: string) {
  return message.includes('does not exist') || message.includes('schema cache');
}

function rowToWorkspace(row: Record<string, unknown>): SynapseWorkspace {
  return {
    headline: String(row.headline || ''),
    skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
    availability: String(row.availability || ''),
    projectGoals: String(row.project_goals || ''),
    preferredRoles: Array.isArray(row.preferred_roles) ? row.preferred_roles.map(String) : [],
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

function workspaceToRow(userId: string, workspace: SynapseWorkspace) {
  return {
    user_id: userId,
    headline: workspace.headline,
    skills: workspace.skills,
    interests: workspace.interests,
    availability: workspace.availability,
    project_goals: workspace.projectGoals,
    preferred_roles: workspace.preferredRoles,
    updated_at: new Date().toISOString(),
  };
}

export function parseCommaSeparatedList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function formatListForInput(values: string[]): string {
  return values.join(', ');
}

/** @deprecated Use fetchWorkspace — reads local cache only */
export function loadWorkspace(userId: string | null | undefined): SynapseWorkspace {
  if (!userId || typeof window === 'undefined') {
    return defaultWorkspace;
  }

  return {
    ...defaultWorkspace,
    ...safeParse<SynapseWorkspace>(
      window.localStorage.getItem(`${WORKSPACE_PREFIX}${userId}`),
      defaultWorkspace,
    ),
  };
}

export async function fetchWorkspace(userId: string | null | undefined): Promise<SynapseWorkspace> {
  if (!userId) return defaultWorkspace;

  const cached = loadWorkspace(userId);

  try {
    const { data, error } = await supabase
      .from('synapse_workspaces')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error.message)) {
        console.warn('[synapse] fetchWorkspace:', error.message);
      }
      return cached;
    }

    if (data) {
      const remote = rowToWorkspace(data);
      saveWorkspaceLocal(userId, remote);
      return remote;
    }

    if (cached.updatedAt || cached.skills.length > 0 || cached.headline) {
      await persistWorkspace(userId, cached);
      return cached;
    }

    return defaultWorkspace;
  } catch {
    return cached;
  }
}

export async function fetchWorkspacesBulk(userIds: string[]): Promise<Map<string, SynapseWorkspace>> {
  const map = new Map<string, SynapseWorkspace>();
  if (userIds.length === 0) return map;

  userIds.forEach((id) => map.set(id, defaultWorkspace));

  try {
    const { data, error } = await supabase
      .from('synapse_workspaces')
      .select('*')
      .in('user_id', userIds);

    if (error) {
      if (!isMissingTableError(error.message)) {
        console.warn('[synapse] fetchWorkspacesBulk:', error.message);
      }
      userIds.forEach((id) => map.set(id, loadWorkspace(id)));
      return map;
    }

    (data || []).forEach((row) => {
      const workspace = rowToWorkspace(row);
      map.set(String(row.user_id), workspace);
      saveWorkspaceLocal(String(row.user_id), workspace);
    });

    userIds.forEach((id) => {
      if (!map.get(id)?.updatedAt && loadWorkspace(id).updatedAt) {
        map.set(id, loadWorkspace(id));
      }
    });
  } catch {
    userIds.forEach((id) => map.set(id, loadWorkspace(id)));
  }

  return map;
}

function saveWorkspaceLocal(userId: string, workspace: SynapseWorkspace) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${WORKSPACE_PREFIX}${userId}`,
    JSON.stringify({ ...workspace, updatedAt: workspace.updatedAt || new Date().toISOString() }),
  );
}

/** @deprecated Use persistWorkspace */
export function saveWorkspace(userId: string, workspace: SynapseWorkspace) {
  saveWorkspaceLocal(userId, workspace);
  void persistWorkspace(userId, workspace);
}

export async function persistWorkspace(userId: string, workspace: SynapseWorkspace) {
  const payload = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  };
  saveWorkspaceLocal(userId, payload);

  try {
    const { error } = await supabase
      .from('synapse_workspaces')
      .upsert(workspaceToRow(userId, payload), { onConflict: 'user_id' });

    if (error && !isMissingTableError(error.message)) {
      console.warn('[synapse] persistWorkspace:', error.message);
    }
  } catch {
    // local cache already saved
  }
}

/** @deprecated Use fetchOutreachList */
export function loadOutreach(userId: string | null | undefined): SynapseOutreach[] {
  if (!userId || typeof window === 'undefined') return [];
  const entries = safeParse<SynapseOutreach[]>(
    window.localStorage.getItem(`${OUTREACH_PREFIX}${userId}`),
    [],
  );
  return entries.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

function saveOutreachLocal(userId: string, items: SynapseOutreach[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${OUTREACH_PREFIX}${userId}`, JSON.stringify(items));
}

export async function fetchOutreachList(userId: string | null | undefined): Promise<SynapseOutreach[]> {
  if (!userId) return [];
  const cached = loadOutreach(userId);

  try {
    const { data, error } = await supabase
      .from('synapse_outreach')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (!isMissingTableError(error.message)) {
        console.warn('[synapse] fetchOutreachList:', error.message);
      }
      return cached;
    }

    if (!data?.length) {
      if (cached.length > 0) {
        await Promise.all(cached.map((item) => persistOutreachItem(userId, item)));
      }
      return cached;
    }

    const remote: SynapseOutreach[] = data.map((row) => ({
      id: String(row.id),
      targetId: String(row.target_id),
      targetName: String(row.target_name || ''),
      goal: String(row.goal || ''),
      message: String(row.message || ''),
      neededSkills: Array.isArray(row.needed_skills) ? row.needed_skills.map(String) : [],
      projectIdea: String(row.project_idea || ''),
      createdAt: String(row.created_at),
    }));

    saveOutreachLocal(userId, remote);
    return remote;
  } catch {
    return cached;
  }
}

export function saveOutreach(userId: string, items: SynapseOutreach[]) {
  saveOutreachLocal(userId, items);
  void Promise.all(items.map((item) => persistOutreachItem(userId, item)));
}

async function persistOutreachItem(userId: string, item: SynapseOutreach) {
  try {
    const row = {
      id: item.id.includes('-') && item.id.length > 20 ? item.id : undefined,
      user_id: userId,
      target_id: item.targetId,
      target_name: item.targetName,
      goal: item.goal,
      message: item.message,
      needed_skills: item.neededSkills,
      project_idea: item.projectIdea,
      created_at: item.createdAt,
    };

    const { error } = await supabase.from('synapse_outreach').upsert(row);
    if (error && !isMissingTableError(error.message)) {
      console.warn('[synapse] persistOutreachItem:', error.message);
    }
  } catch {
    // local cache is source of truth until migration runs
  }
}

/** @deprecated Use fetchAchievementsList */
export function loadAchievements(userId: string | null | undefined): SynapseAchievement[] {
  if (!userId || typeof window === 'undefined') return [];
  const entries = safeParse<SynapseAchievement[]>(
    window.localStorage.getItem(`${ACHIEVEMENT_PREFIX}${userId}`),
    [],
  );
  return entries.sort((a, b) => +new Date(b.achievedAt) - +new Date(a.achievedAt));
}

function saveAchievementsLocal(userId: string, items: SynapseAchievement[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${ACHIEVEMENT_PREFIX}${userId}`, JSON.stringify(items));
}

export async function fetchAchievementsList(userId: string | null | undefined): Promise<SynapseAchievement[]> {
  if (!userId) return [];
  const cached = loadAchievements(userId);

  try {
    const { data, error } = await supabase
      .from('synapse_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });

    if (error) {
      if (!isMissingTableError(error.message)) {
        console.warn('[synapse] fetchAchievementsList:', error.message);
      }
      return cached;
    }

    if (!data?.length) return cached;

    const remote: SynapseAchievement[] = data.map((row) => {
      const local = cached.find((item) => item.id === String(row.id));
      return {
        id: String(row.id),
        title: String(row.title),
        category: String(row.category || 'Project'),
        description: String(row.description || ''),
        proofUrl: String(row.proof_url || ''),
        imageDataUrl: local?.imageDataUrl || row.image_url || undefined,
        certificateDataUrl: local?.certificateDataUrl || row.certificate_url || undefined,
        achievedAt: row.achieved_at ? String(row.achieved_at) : String(row.created_at),
        createdAt: String(row.created_at),
      };
    });

    saveAchievementsLocal(userId, remote);
    return remote;
  } catch {
    return cached;
  }
}

export function saveAchievements(userId: string, items: SynapseAchievement[]) {
  saveAchievementsLocal(userId, items);
  void persistAchievements(userId, items);
}

async function persistAchievements(userId: string, items: SynapseAchievement[]) {
  try {
    const rows = items.map((item) => ({
      id: item.id.includes('-') && item.id.length > 20 ? item.id : undefined,
      user_id: userId,
      title: item.title,
      category: item.category,
      description: item.description,
      proof_url: item.proofUrl,
      image_url: item.imageDataUrl && item.imageDataUrl.length < 500_000 ? item.imageDataUrl : null,
      certificate_url: item.certificateDataUrl && item.certificateDataUrl.length < 500_000 ? item.certificateDataUrl : null,
      achieved_at: item.achievedAt,
      created_at: item.createdAt,
    }));

    const { error } = await supabase.from('synapse_achievements').upsert(rows);
    if (error && !isMissingTableError(error.message)) {
      console.warn('[synapse] persistAchievements:', error.message);
    }
  } catch {
    // local cache retained
  }
}

export function computeMatchScore(
  current: SynapseWorkspace,
  candidate: SynapseWorkspace,
  sameInstitution: boolean,
) {
  const skillOverlap = current.skills.filter((skill) => candidate.skills.includes(skill)).length;
  const interestOverlap = current.interests.filter((interest) =>
    candidate.interests.includes(interest),
  ).length;

  return skillOverlap * 3 + interestOverlap * 2 + (sameInstitution ? 1 : 0);
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isSynapseConnectRequest(content: string | null | undefined) {
  return SYNAPSE_CONNECT_REQUEST_MARKERS.some((marker) => (content || '').includes(marker));
}

export function isSynapseConnectDecline(content: string | null | undefined) {
  return SYNAPSE_CONNECT_DECLINE_MARKERS.some((marker) => (content || '').includes(marker));
}

export function createSynapseDeclineMessage(name?: string | null) {
  const safeName = (name || 'there').trim();
  return `[Collab Request Declined]
Hi ${safeName}, thank you for reaching out through Collab. I'm going to decline this request for now. Wishing you the best with your work ahead.`;
}

export function isSynapseThreadAccepted(
  currentUserId: string,
  partnerId: string,
  messages: SynapseThreadMessage[],
) {
  const sorted = [...messages].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );

  const outgoingRequest = sorted.find(
    (message) =>
      message.fromId === currentUserId &&
      message.toId === partnerId &&
      isSynapseConnectRequest(message.content),
  );

  const incomingRequest = sorted.find(
    (message) =>
      message.fromId === partnerId &&
      message.toId === currentUserId &&
      isSynapseConnectRequest(message.content),
  );

  const declinedOutgoingRequest = outgoingRequest
    ? sorted.some(
        (message) =>
          message.fromId === partnerId &&
          +new Date(message.createdAt) > +new Date(outgoingRequest.createdAt) &&
          isSynapseConnectDecline(message.content),
      )
    : false;

  const declinedIncomingRequest = incomingRequest
    ? sorted.some(
        (message) =>
          message.fromId === currentUserId &&
          +new Date(message.createdAt) > +new Date(incomingRequest.createdAt) &&
          isSynapseConnectDecline(message.content),
      )
    : false;

  if (declinedOutgoingRequest || declinedIncomingRequest) {
    return false;
  }

  const repliedToOutgoing = outgoingRequest
    ? sorted.some(
        (message) =>
          message.fromId === partnerId &&
          +new Date(message.createdAt) > +new Date(outgoingRequest.createdAt),
      )
    : false;

  const repliedToIncoming = incomingRequest
    ? sorted.some(
        (message) =>
          message.fromId === currentUserId &&
          +new Date(message.createdAt) > +new Date(incomingRequest.createdAt),
      )
    : false;

  return repliedToOutgoing || repliedToIncoming;
}
