import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/GamesPage.css';
import { safeStorage } from '@/src/lib/games/storage';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ✅ Moved outside component — never recreated on re-render
const GAMES: GameCard[] = [
  { id: 'reaction', name: 'Lightning Reflexes', description: 'Test your reaction time and reflexes',  emoji: '⚡',  color: 'gradient-1', route: '/game/reaction' },
  { id: 'typing',   name: 'Type Racer',          description: 'Race against time while typing',        emoji: '🏎️', color: 'gradient-2', route: '/game/typing'   },
  { id: 'memory',   name: 'Memory Master',        description: 'Test your memory with color sequences', emoji: '🧠',  color: 'gradient-3', route: '/game/memory'   },
  { id: 'hunter',   name: 'Number Hunter',        description: 'Hunt down the mystery number',          emoji: '🎯',  color: 'gradient-4', route: '/game/hunter'   },
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
// memo: only re-renders if game data changes (never — GAMES is a constant)
const GameCardItem = memo(function GameCardItem({
  game, onPlay,
}: {
  game: GameCard;
  onPlay: (route: string) => void;
}) {
  const handleClick = useCallback(() => onPlay(game.route), [onPlay, game.route]);
  return (
    <div className={`game-card ${game.color}`}>
      <div className="game-card-content">
        <div className="game-emoji">{game.emoji}</div>
        <h3 className="game-name">{game.name}</h3>
        <p className="game-description">{game.description}</p>
      </div>
      <button className="play-button" onClick={handleClick}>
        Play Now
      </button>
    </div>
  );
});

// ─── Subcomponent: LeaderboardItem ───────────────────────────────────────────
// memo: only re-renders if this specific entry changes
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

  // ✅ useCallback — stable reference so the realtime subscription doesn't recreate
  const loadGameData = useCallback(async () => {
    try {
      const allScores: LeaderboardEntry[] = [];

      const { data: liveScores, error: liveScoresError } = await supabase
        .from('game_scores')
        .select('player_name, game_type, score, created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (!liveScoresError && (liveScores || []).length > 0) {
        (liveScores as GameScoreRow[]).forEach((row) => {
          allScores.push({
            rank: 0,
            name: row.player_name,
            score: row.score,
            game: GAME_TYPE_LABELS[row.game_type] || row.game_type,
          });
        });
      } else {
        // Fallback to local storage scores
        const storagePromises = STORAGE_PREFIXES.map(async (prefix) => {
          const result = await safeStorage.list(prefix, true);
          if (!result?.keys) return [];
          
          const items = await Promise.all(result.keys.map(async (key) => {
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
                };
              }
            } catch (e) { console.error('Error loading score:', e); }
            return null;
          }));
          return items.filter(Boolean) as LeaderboardEntry[];
        });
        const results = await Promise.all(storagePromises);
        results.forEach(batch => allScores.push(...batch));
      }

      // Sort and take top 10
      allScores.sort((a, b) => {
        const scoreA = typeof a.score === 'number' ? a.score : 0;
        const scoreB = typeof b.score === 'number' ? b.score : 0;
        return scoreB - scoreA;
      });

      const topScores = allScores.slice(0, 10).map((entry, index) => ({ ...entry, rank: index + 1 }));
      setLeaderboard(topScores);

      // Player rank
      const currentPlayer = localStorage.getItem('currentPlayer') || 'Guest';
      const playerScores  = allScores.filter((s) => s.name === currentPlayer);
      const bestScore     = playerScores.length > 0
        ? Math.max(...playerScores.map((s) => typeof s.score === 'number' ? s.score : 0))
        : 0;
      const playerRankPos = allScores.findIndex((s) => s.name === currentPlayer) + 1;

      setPlayerRank({
        currentRank:  playerRankPos || allScores.length + 1,
        totalPlayers: new Set(allScores.map((s) => s.name)).size || 1,
        bestScore:    bestScore || 0,
      });
    } catch (error) {
      console.error('Error loading game data:', error);
    } finally {
      setLoading(false);
    }
  }, []); // ✅ empty deps — no external deps, reads from supabase/localStorage directly

  useEffect(() => {
    void loadGameData();

    // ✅ Realtime subscription — stable because loadGameData is memoized
    const channel = supabase
      .channel('game-scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_scores' }, () => {
        void loadGameData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadGameData]);

  // ✅ Stable callback for navigation
  const handlePlayGame = useCallback((route: string) => navigate(route), [navigate]);
  const handleBack     = useCallback(() => safeNavigateBack(navigate, '/feed'), [navigate]);

  // ✅ useMemo for rank display string
  const rankDisplay = useMemo(() =>
    `#${playerRank.currentRank} out of ${playerRank.totalPlayers} players`,
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

        {/* Header */}
        <div className="games-header">
          <h1>Games Arena</h1>
          <p>Master multiple challenges and climb the leaderboards</p>
        </div>

        {/* Player Rank */}
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

        {/* Games Grid — GameCardItem is memo'd, GAMES is constant = zero re-renders */}
        <div className="games-grid">
          {GAMES.map((game) => (
            <GameCardItem key={game.id} game={game} onPlay={handlePlayGame} />
          ))}
        </div>

        {/* Leaderboard */}
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