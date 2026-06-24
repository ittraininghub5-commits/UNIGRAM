import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
// ✅ FIX: CSS moved here from App.tsx so it only loads on this route
import '../styles/GamesPage.css';
import { safeStorage } from '@/src/lib/games/storage';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameCard {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  route: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: string | number;
  game: string;
}

interface PlayerRank {
  currentRank: number;
  totalPlayers: number;
  bestScore: string | number;
}

interface GameScoreRow {
  player_name: string;
  game_type: 'reaction' | 'typing' | 'memory' | 'hunter';
  score: number;
  created_at: string;
}

// ─── Constants (outside component) ───────────────────────────────────────────
const GAMES: GameCard[] = [
  { id: 'reaction', name: 'Lightning Reflexes', description: 'Test your reaction time and reflexes',   emoji: '⚡',  color: 'gradient-1', route: '/game/reaction' },
  { id: 'typing',   name: 'Type Racer',          description: 'Race against time while typing',         emoji: '🏎️', color: 'gradient-2', route: '/game/typing'   },
  { id: 'memory',   name: 'Memory Master',        description: 'Test your memory with color sequences',  emoji: '🧠',  color: 'gradient-3', route: '/game/memory'   },
  { id: 'hunter',   name: 'Number Hunter',        description: 'Hunt down the mystery number',           emoji: '🎯',  color: 'gradient-4', route: '/game/hunter'   },
];

const GAME_TYPE_LABELS: Record<string, string> = {
  reaction: 'Reaction',
  typing:   'Typing',
  memory:   'Memory',
  hunter:   'Hunter',
};

const STORAGE_PREFIXES = ['score:', 'typing:', 'memory:', 'hunter:'];
const DEFAULT_PLAYER_RANK: PlayerRank = { currentRank: 0, totalPlayers: 0, bestScore: 0 };

// ─── Subcomponent: GameCardItem ───────────────────────────────────────────────
const GameCardItem = memo(function GameCardItem({
  game, onPlay,
}: { game: GameCard; onPlay: (route: string) => void }) {
  const handleClick = useCallback(() => onPlay(game.route), [onPlay, game.route]);
  return (
    <div className={`game-card ${game.color}`}>
      <div className="game-card-content">
        <div className="game-emoji">{game.emoji}</div>
        <h3 className="game-name">{game.name}</h3>
        <p className="game-description">{game.description}</p>
      </div>
      <button className="play-button" onClick={handleClick}>Play Now</button>
    </div>
  );
});

// ─── Subcomponent: LeaderboardItem ────────────────────────────────────────────
const LeaderboardItem = memo(function LeaderboardItem({ entry }: { entry: LeaderboardEntry }) {
  const rankDisplay = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
  return (
    <div className="leaderboard-item">
      <div className="rank-column">
        <span className={`leaderboard-rank-badge rank-${entry.rank}`}>{rankDisplay}</span>
      </div>
      <div className="player-column">
        <span className="player-name">{entry.name}</span>
        <span className="game-tag">{entry.game}</span>
      </div>
      <div className="score-column">
        <span className="score-value">{entry.score}</span>
      </div>
    </div>
  );
});

// ─── Main GamesPage ───────────────────────────────────────────────────────────
const GamesPage = () => {
  const navigate = useNavigate();
  const [playerRank, setPlayerRank] = useState<PlayerRank>(DEFAULT_PLAYER_RANK);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGameData = useCallback(async () => {
    try {
      const currentPlayer = localStorage.getItem('currentPlayer') || 'Guest';
      let allScores: LeaderboardEntry[] = [];

      // ✅ FIX 1: Ask the DB for only the top 10 rows instead of 200.
      // Previously fetched 200 rows then re-sorted client-side to get the top 10
      // — redundant work and an oversized payload.
      // We also fetch the current player's best score in the same round-trip using
      // a second targeted query, both fired in parallel via Promise.all.
      const [topScoresResult, playerScoresResult] = await Promise.all([
        supabase
          .from('game_scores')
          .select('player_name, game_type, score, created_at')
          .order('score', { ascending: false })
          .limit(10),                        // ✅ only what we display
        supabase
          .from('game_scores')
          .select('player_name, score')
          .eq('player_name', currentPlayer)
          .order('score', { ascending: false })
          .limit(1),                         // ✅ best score only
      ]);

      const liveScoresOk = !topScoresResult.error && (topScoresResult.data || []).length > 0;

      if (liveScoresOk) {
        allScores = (topScoresResult.data as GameScoreRow[]).map((row, index) => ({
          rank: index + 1,
          name: row.player_name,
          score: row.score,
          game: GAME_TYPE_LABELS[row.game_type] || row.game_type,
        }));
      } else {
        // Fallback: read from localStorage/artifact storage
        const storagePromises = STORAGE_PREFIXES.map(async (prefix) => {
          const result = await safeStorage.list(prefix, true);
          if (!result?.keys) return [];
          const items = await Promise.all(
            result.keys.map(async (key) => {
              try {
                const data = await safeStorage.get(key, true);
                if (data?.value) {
                  const scoreData = JSON.parse(data.value);
                  const type = key.split(':')[0];
                  const gameType = type === 'score' ? 'Reaction' : type.charAt(0).toUpperCase() + type.slice(1);
                  return {
                    rank: 0,
                    name: scoreData.name,
                    score: scoreData.time || scoreData.wpm || scoreData.level || scoreData.score,
                    game: gameType,
                  } as LeaderboardEntry;
                }
              } catch (e) { console.error('Error loading score:', e); }
              return null;
            }),
          );
          return items.filter(Boolean) as LeaderboardEntry[];
        });
        const results = await Promise.all(storagePromises);
        results.forEach((batch) => allScores.push(...batch));

        // ✅ Sort and rank after local fallback (DB path is already sorted)
        allScores.sort((a, b) => {
          const scoreA = typeof a.score === 'number' ? a.score : 0;
          const scoreB = typeof b.score === 'number' ? b.score : 0;
          return scoreB - scoreA;
        });
        allScores = allScores.slice(0, 10).map((entry, i) => ({ ...entry, rank: i + 1 }));
      }

      setLeaderboard(allScores);

      // ✅ FIX 2: Player rank derived from the leaderboard we already have,
      // plus the targeted single-row player query — no need to scan 200 rows.
      const playerBestScore = playerScoresResult.data?.[0]?.score ?? 0;
      const playerRankPos   = allScores.findIndex((s) => s.name === currentPlayer) + 1;
      const totalPlayers    = new Set(allScores.map((s) => s.name)).size || 1;

      setPlayerRank({
        currentRank:  playerRankPos || allScores.length + 1,
        totalPlayers,
        bestScore:    playerBestScore,
      });
    } catch (error) {
      console.error('Error loading game data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGameData();

    // ✅ Realtime subscription — still unfiltered (any score insert refreshes
    // the leaderboard) but now each refresh only fetches 10 rows instead of 200.
    const channel = supabase
      .channel('game-scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_scores' }, () => {
        void loadGameData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadGameData]);

  const handlePlayGame = useCallback((route: string) => navigate(route), [navigate]);
  const handleBack     = useCallback(() => safeNavigateBack(navigate, '/feed'), [navigate]);

  const rankDisplay = useMemo(
    () => `#${playerRank.currentRank} out of ${playerRank.totalPlayers} players`,
    [playerRank.currentRank, playerRank.totalPlayers],
  );

  return (
    <div className="games-page">
      <div className="games-container">
        <button
          onClick={handleBack}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="games-header">
          <h1>Games Arena</h1>
          <p>Master multiple challenges and climb the leaderboards</p>
        </div>

        <div className="player-rank-section">
          <div className="rank-card">
            <div className="rank-badge">#{playerRank.currentRank}</div>
            <div className="rank-info">
              <h3>Your Rank</h3>
              <p>{rankDisplay}</p>
            </div>
            <div className="rank-best">
              <div className="best-label">Best Score</div>
              <div className="best-value">{playerRank.bestScore}</div>
            </div>
          </div>
        </div>

        <div className="games-grid">
          {GAMES.map((game) => (
            <GameCardItem key={game.id} game={game} onPlay={handlePlayGame} />
          ))}
        </div>

        <div className="leaderboard-section">
          <h2>Global Leaderboard</h2>
          <div className="leaderboard-container">
            {loading ? (
              <div className="loading-state"><p>Loading leaderboards...</p></div>
            ) : leaderboard.length === 0 ? (
              <div className="empty-state">
                <p>🎮 No scores yet!</p>
                <p>Be the first to play and claim the top spot!</p>
              </div>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry) => (
                  <LeaderboardItem key={`${entry.rank}-${entry.name}`} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesPage;