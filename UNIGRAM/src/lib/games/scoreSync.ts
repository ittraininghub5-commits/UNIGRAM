import { supabase } from '@/src/lib/supabase';

export type GameType = 'reaction' | 'typing' | 'memory' | 'hunter';

interface SyncGameScoreInput {
  gameType: GameType;
  playerName: string;
  score: number;
  metadata?: Record<string, any>;
}

export async function syncGameScore(input: SyncGameScoreInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const playerId = userData.user?.id || null;

    const { error } = await supabase
      .from('game_scores')
      .insert({
        player_id: playerId,
        player_name: input.playerName,
        game_type: input.gameType,
        score: input.score,
        metadata: input.metadata || null,
      });

    if (error) {
      console.warn('Unable to sync game score to Supabase:', error.message);
    }
  } catch (error) {
    console.warn('Unable to sync game score to Supabase:', error);
  }
}
