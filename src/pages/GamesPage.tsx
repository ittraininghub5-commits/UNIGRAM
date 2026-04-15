import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import '../styles/GamesPage.css';
import { safeStorage } from '@/src/lib/games/storage';
import { supabase } from '@/src/lib/supabase';
import { safeNavigateBack } from '@/src/lib/navigation';
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

const GamesPage: React.FC = () => {
  const navigate = useNavigate();
  const [playerRank, setPlayerRank] = useState<PlayerRank>({
    currentRank: 0,
    totalPlayers: 0,
    bestScore: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const games: GameCard[] = [
    {
      id: 'reaction',
      name: 'Lightning Reflexes',
      description: 'Test your reaction time and reflexes',
      emoji: '⚡',
      color: 'gradient-1',
      route: '/game/reaction',
    },
    {
      id: 'typing',
      name: 'Type Racer',
      description: 'Race against time while typing',
      emoji: '🏎️',
      color: 'gradient-2',
      route: '/game/typing',
    },
    {
      id: 'memory',
      name: 'Memory Master',
      description: 'Test your memory with color sequences',
      emoji: '🧠',
      color: 'gradient-3',
      route: '/game/memory',
    },
    {
      id: 'hunter',
      name: 'Number Hunter',
      description: 'Hunt down the mystery number',
      emoji: '🎯',
      color: 'gradient-4',
      route: '/game/hunter',
    },
  ];

  useEffect(() => {
    loadGameData();

    const channel = supabase
      .channel('game-scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_scores' }, () => {
        void loadGameData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadGameData = async () => {
    try {
      const allScores: LeaderboardEntry[] = [];

      // Try Supabase realtime scores first
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
            game:
              row.game_type === 'reaction' ? 'Reaction' :
              row.game_type === 'typing' ? 'Typing' :
              row.game_type === 'memory' ? 'Memory' :
              'Hunter',
          });
        });
      } else {
        // Fallback to local storage scores
        const games_keys = ['score:', 'typing:', 'memory:', 'hunter:'];

        for (const prefix of games_keys) {
          try {
            const result = await safeStorage.list(prefix, true);
            if (result?.keys?.length > 0) {
              for (const key of result.keys) {
                try {
                  const data = await safeStorage.get(key, true);
                  if (data?.value) {
                    const scoreData = JSON.parse(data.value);
                    const gameType = key.split(':')[0] === 'score' ? 'Reaction' :
                                    key.split(':')[0] === 'typing' ? 'Typing' :
                                    key.split(':')[0] === 'memory' ? 'Memory' : 'Hunter';
                    allScores.push({
                      rank: 0,
                      name: scoreData.name,
                      score: scoreData.time || scoreData.wpm || scoreData.level || scoreData.score,
                      game: gameType,
                    });
                  }
                } catch (e) {
                  console.error('Error loading score:', e);
                }
              }
            }
          } catch {
            // No scores for this game yet
          }
        }
      }

      // Sort by score and get top 10
      allScores.sort((a, b) => {
        const scoreA = typeof a.score === 'number' ? a.score : 0;
        const scoreB = typeof b.score === 'number' ? b.score : 0;
        return scoreB - scoreA;
      });

      const topScores = allScores.slice(0, 10).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      setLeaderboard(topScores);

      // Calculate player rank
      const currentPlayer = localStorage.getItem('currentPlayer') || 'Guest';
      const playerScores = allScores.filter((s) => s.name === currentPlayer);
      const bestScore = playerScores.length > 0 ? Math.max(...playerScores.map(s => typeof s.score === 'number' ? s.score : 0)) : 0;
      const playerRankPosition = allScores.findIndex((s) => s.name === currentPlayer) + 1;

      setPlayerRank({
        currentRank: playerRankPosition || allScores.length + 1,
        totalPlayers: new Set(allScores.map((s) => s.name)).size || 1,
        bestScore: bestScore || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading game data:', error);
      setLoading(false);
    }
  };

  const handlePlayGame = (route: string) => {
    navigate(route);
  };

  return (
    <div className="games-page">
      <div className="games-container">
        <button
          onClick={() => safeNavigateBack(navigate, '/feed')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header Section */}
        <div className="games-header">
          <h1>Games Arena</h1>
          <p>Master multiple challenges and climb the leaderboards</p>
        </div>

        {/* Player Rank Section */}
        <div className="player-rank-section">
          <div className="rank-card">
            <div className="rank-badge">#{playerRank.currentRank}</div>
            <div className="rank-info">
              <h3>Your Rank</h3>
              <p>Out of {playerRank.totalPlayers} players</p>
            </div>
            <div className="rank-best">
              <div className="best-label">Best Score</div>
              <div className="best-value">{playerRank.bestScore}</div>
            </div>
          </div>
        </div>

        {/* Games Grid - 2x2 */}
        <div className="games-grid">
          {games.map((game) => (
            <div key={game.id} className={`game-card ${game.color}`}>
              <div className="game-card-content">
                <div className="game-emoji">{game.emoji}</div>
                <h3 className="game-name">{game.name}</h3>
                <p className="game-description">{game.description}</p>
              </div>
              <button
                className="play-button"
                onClick={() => handlePlayGame(game.route)}
              >
                Play Now
              </button>
            </div>
          ))}
        </div>

        {/* Leaderboard Section */}
        <div className="leaderboard-section">
          <h2>Global Leaderboard</h2>
          <div className="leaderboard-container">
            {loading ? (
              <div className="loading-state">
                <p>Loading leaderboards...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="empty-state">
                <p>🎮 No scores yet!</p>
                <p>Be the first to play and claim the top spot!</p>
              </div>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry) => (
                  <div key={`${entry.rank}-${entry.name}`} className="leaderboard-item">
                    <div className="rank-column">
                      <span className={`leaderboard-rank-badge rank-${entry.rank}`}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                    </div>
                    <div className="player-column">
                      <span className="player-name">{entry.name}</span>
                      <span className="game-tag">{entry.game}</span>
                    </div>
                    <div className="score-column">
                      <span className="score-value">{entry.score}</span>
                    </div>
                  </div>
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