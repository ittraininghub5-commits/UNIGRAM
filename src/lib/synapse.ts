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

export function saveWorkspace(userId: string, workspace: SynapseWorkspace) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${WORKSPACE_PREFIX}${userId}`, JSON.stringify(workspace));
}

export function loadOutreach(userId: string | null | undefined): SynapseOutreach[] {
  if (!userId || typeof window === 'undefined') {
    return [];
  }

  const entries = safeParse<SynapseOutreach[]>(
    window.localStorage.getItem(`${OUTREACH_PREFIX}${userId}`),
    [],
  );

  return entries.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function saveOutreach(userId: string, items: SynapseOutreach[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${OUTREACH_PREFIX}${userId}`, JSON.stringify(items));
}

export function loadAchievements(userId: string | null | undefined): SynapseAchievement[] {
  if (!userId || typeof window === 'undefined') {
    return [];
  }

  const entries = safeParse<SynapseAchievement[]>(
    window.localStorage.getItem(`${ACHIEVEMENT_PREFIX}${userId}`),
    [],
  );

  return entries.sort((a, b) => +new Date(b.achievedAt) - +new Date(a.achievedAt));
}

export function saveAchievements(userId: string, items: SynapseAchievement[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${ACHIEVEMENT_PREFIX}${userId}`, JSON.stringify(items));
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
