import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoreEntry {
  name: string;
  score: number;
  timestamp: number;
}

type HintType = "higher" | "lower" | "correct" | "idle";

interface GuessBadge {
  value: number;
  dir: "higher" | "lower";
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const storage = (window as any).storage as {
  list: (prefix: string, shared: boolean) => Promise<{ keys: string[] }>;
  get: (key: string, shared: boolean) => Promise<{ value: string }>;
  set: (key: string, value: string, shared: boolean) => Promise<void>;
};

async function fetchLeaderboard(prefix: string): Promise<ScoreEntry[]> {
  try {
    const result = await storage.list(prefix, true);
    if (!result?.keys?.length) return [];
    const entries: ScoreEntry[] = [];
    for (const key of result.keys) {
      try {
        const data = await storage.get(key, true);
        if (data?.value) entries.push(JSON.parse(data.value) as ScoreEntry);
      } catch {}
    }
    return entries.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch {
    return [];
  }
}

async function persistScore(prefix: string, entry: ScoreEntry): Promise<void> {
  const id = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await storage.set(id, JSON.stringify(entry), true);
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

const Leaderboard: React.FC<{ scores: ScoreEntry[]; label: string }> = ({ scores, label }) => (
  <div className="nh-leaderboard">
    <h2>🏆 Top Hunters</h2>
    {scores.length === 0 ? (
      <div className="nh-empty">
        <p>🎮 No scores yet!</p>
        <p>Be the first to hunt!</p>
      </div>
    ) : (
      <ul>
        {scores.map((s, i) => (
          <li key={s.timestamp} className={`nh-lb-item rank-${i + 1}`}>
            <span className="nh-rank">#{i + 1}</span>
            <span className="nh-lb-name">{s.name}</span>
            <span className="nh-lb-score">{s.score} {label}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const NumberHunter: React.FC = () => {
  const [screen, setScreen] = useState<"setup" | "game" | "gameover">("setup");
  const [playerName, setPlayerName] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [target, setTarget] = useState(0);
  const [minRange, setMinRange] = useState(1);
  const [maxRange, setMaxRange] = useState(100);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [guessCount, setGuessCount] = useState(0);
  const [guess, setGuess] = useState("");
  const [hint, setHint] = useState<{ text: string; type: HintType }>({ text: "Make your first guess!", type: "idle" });
  const [badges, setBadges] = useState<GuessBadge[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [finalScore, setFinalScore] = useState(0);

  const loadBoard = useCallback(async () => {
    setLeaderboard(await fetchLeaderboard("hunter:"));
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const newRound = useCallback(() => {
    setTarget(Math.floor(Math.random() * 100) + 1);
    setMinRange(1);
    setMaxRange(100);
    setGuessCount(0);
    setGuess("");
    setBadges([]);
    setHint({ text: "Make your first guess!", type: "idle" });
  }, []);

  const startGame = () => {
    if (!playerName.trim()) { alert("Please enter your name!"); return; }
    setCurrentPlayer(playerName.trim());
    setScore(0);
    setLives(3);
    setStreak(0);
    setScreen("game");
    newRound();
  };

  const handleGuess = useCallback(() => {
    const n = parseInt(guess, 10);
    if (isNaN(n) || n < minRange || n > maxRange) {
      alert(`Enter a number between ${minRange} and ${maxRange}`);
      return;
    }
    const nextCount = guessCount + 1;
    setGuessCount(nextCount);

    if (n === target) {
      setHint({ text: `🎉 CORRECT! It was ${target}!`, type: "correct" });
      const pts = Math.max(100 - (nextCount - 1) * 10, 10);
      setScore(prev => {
        const newStreak = streak + 1;
        setStreak(newStreak);
        return prev + pts + (newStreak >= 3 ? 50 : 0);
      });
      setGuess("");
      setTimeout(newRound, 1500);
    } else if (n > target) {
      setMaxRange(n - 1);
      setHint({ text: "📉 Too HIGH! Try lower...", type: "lower" });
      setBadges(prev => [...prev, { value: n, dir: "lower" }]);
      checkGuessLimit(nextCount);
      setGuess("");
    } else {
      setMinRange(n + 1);
      setHint({ text: "📈 Too LOW! Try higher...", type: "higher" });
      setBadges(prev => [...prev, { value: n, dir: "higher" }]);
      checkGuessLimit(nextCount);
      setGuess("");
    }
  }, [guess, guessCount, minRange, maxRange, target, streak, newRound]);

  const checkGuessLimit = (count: number) => {
    if (count >= 7) {
      setLives(prev => {
        const next = prev - 1;
        setStreak(0);
        if (next <= 0) {
          triggerGameOver();
        } else {
          setHint({ text: `💔 Out of guesses! It was ${target}. Next round!`, type: "idle" });
          setTimeout(newRound, 2000);
        }
        return next;
      });
    }
  };

  const triggerGameOver = useCallback(async () => {
    setScreen("gameover");
    setFinalScore(score);
    await persistScore("hunter:", { name: currentPlayer, score, timestamp: Date.now() });
    await loadBoard();
  }, [score, currentPlayer, loadBoard]);

  const skipNumber = () => {
    setScore(prev => Math.max(0, prev - 10));
    setStreak(0);
    newRound();
  };

  const playAgain = () => {
    setScore(0); setLives(3); setStreak(0);
    setScreen("game");
    newRound();
  };

  const hearts = "❤️".repeat(lives) + "🖤".repeat(3 - lives);
  const rankMsg =
    finalScore >= 500 ? "🏆 LEGENDARY HUNTER!" :
    finalScore >= 300 ? "⭐ EXPERT HUNTER!" :
    finalScore >= 150 ? "👍 SKILLED HUNTER!" :
    finalScore >= 50  ? "😊 GOOD EFFORT!" : "💪 KEEP PRACTICING!";

  return (
    <>
      <style>{CSS}</style>
      <div className="nh-wrap">
        <div className="nh-container">
          <header className="nh-header">
            <h1>🎯 Number Hunter</h1>
            <p>Find the secret number. Speed and accuracy matter!</p>
          </header>

          <div className="nh-body">
            <div className="nh-main">

              {/* SETUP */}
              {screen === "setup" && (
                <div className="nh-setup">
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startGame()}
                    placeholder="Enter your name"
                    maxLength={20}
                  />
                  <button className="nh-btn" onClick={startGame}>Start Hunting!</button>
                </div>
              )}

              {/* GAME */}
              {screen === "game" && (
                <>
                  <div className="nh-stats">
                    <div className="nh-stat-card">
                      <div className="nh-stat-label">Score</div>
                      <div className="nh-stat-value">{score}</div>
                    </div>
                    <div className="nh-stat-card lives">
                      <div className="nh-stat-label">Lives</div>
                      <div className="nh-stat-value">{hearts}</div>
                    </div>
                    <div className="nh-stat-card streak">
                      <div className="nh-stat-label">Streak</div>
                      <div className="nh-stat-value">🔥 {streak}</div>
                    </div>
                  </div>

                  <div className="nh-gamebox">
                    <h2>Find the Number!</h2>
                    <div className="nh-range">{minRange} — {maxRange}</div>
                    <div className={`nh-hint ${hint.type}`}>{hint.text}</div>
                    <div className="nh-input-row">
                      <input
                        type="number"
                        value={guess}
                        onChange={e => setGuess(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleGuess()}
                        min={minRange} max={maxRange}
                        placeholder="?"
                        autoFocus
                      />
                      <button className="nh-btn" onClick={handleGuess}>GUESS</button>
                    </div>
                    <div className="nh-badges">
                      {badges.map((b, i) => (
                        <span key={i} className={`nh-badge ${b.dir}`}>
                          {b.value} {b.dir === "higher" ? "↑" : "↓"}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button className="nh-btn secondary" onClick={skipNumber}>
                    Skip This Number (−10 pts)
                  </button>
                </>
              )}

              {/* GAME OVER */}
              {screen === "gameover" && (
                <div className="nh-gameover">
                  <h2>Game Over!</h2>
                  <p>{rankMsg}</p>
                  <div className="nh-final-score">{finalScore} Points</div>
                  <button className="nh-btn" onClick={playAgain}>Hunt Again!</button>
                </div>
              )}
            </div>

            <aside className="nh-side">
              <Leaderboard scores={leaderboard} label="pts" />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .nh-wrap { min-height:100vh; display:flex; justify-content:center; align-items:center; padding:20px;
    background:linear-gradient(135deg,#0a0f2e,#0d1b4b,#0f2060); font-family:'Segoe UI',sans-serif; }
  .nh-container { background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.4);
    max-width:1000px; width:100%; overflow:hidden; }
  .nh-header { background:linear-gradient(135deg,#d4a574,#c9945b); padding:30px; text-align:center; color:#fff; }
  .nh-header h1 { font-size:2.5em; margin-bottom:8px; text-shadow:2px 2px 4px rgba(0,0,0,.2); }
  .nh-header p { opacity:.9; }
  .nh-body { display:flex; flex-wrap:wrap; }
  .nh-main { flex:1.5; min-width:300px; padding:40px; }
  .nh-side { flex:1; min-width:280px; background:#f8f9fa; padding:30px; border-left:3px solid #e9ecef; }

  .nh-setup { text-align:center; }
  .nh-setup input { display:block; margin:0 auto 16px; padding:14px 20px; font-size:1.1em;
    border:3px solid #667eea; border-radius:10px; width:100%; max-width:300px; transition:.3s;
    background:linear-gradient(135deg,#f5d76e,#ffeaa7); color:#2d3748; }
  .nh-setup input:focus { outline:none; border-color:#764ba2; transform:scale(1.02); }

  .nh-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:28px; }
  .nh-stat-card { background:linear-gradient(135deg,#f5d76e,#ffeaa7); color:#2d3748;
    padding:18px; border-radius:14px; text-align:center; box-shadow:0 4px 14px rgba(245,215,110,.3); }
  .nh-stat-card.lives { background:linear-gradient(135deg,#ffeaa7,#f5d76e); }
  .nh-stat-card.streak { background:linear-gradient(135deg,#f5d76e,#ffeaa7); color:#2d3748; }
  .nh-stat-label { font-size:.85em; opacity:.9; margin-bottom:4px; }
  .nh-stat-value { font-size:2em; font-weight:700; }

  .nh-gamebox { background:linear-gradient(135deg,#f5d76e,#ffeaa7); padding:36px;
    border-radius:15px; margin-bottom:18px; text-align:center; }
  .nh-gamebox h2 { font-size:1.8em; color:#2d3748; margin-bottom:16px; }
  .nh-range { font-size:3em; font-weight:700; color:#d4a574; margin:12px 0;
    text-shadow:2px 2px 4px rgba(0,0,0,.1); }
  .nh-hint { background:#fff; padding:18px 20px; border-radius:10px; margin:16px 0;
    font-size:1.2em; font-weight:700; min-height:56px; display:flex; align-items:center; justify-content:center; }
  .nh-hint.higher { color:#ef4444; border:3px solid #ef4444; }
  .nh-hint.lower  { color:#3b82f6; border:3px solid #3b82f6; }
  .nh-hint.correct{ color:#10b981; border:3px solid #10b981; animation:celebrate .5s ease-in-out; }
  @keyframes celebrate { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }

  .nh-input-row { display:flex; gap:10px; margin:16px 0; }
  .nh-input-row input { flex:1; padding:18px; font-size:1.5em; border:3px solid #d4a574;
    border-radius:10px; text-align:center; font-weight:700; }
  .nh-input-row input:focus { outline:none; border-color:#f5d76e; }

  .nh-badges { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:12px; }
  .nh-badge { padding:8px 16px; border-radius:20px; font-weight:700; font-size:1em; }
  .nh-badge.higher { background:#fee; color:#ef4444; border:2px solid #ef4444; }
  .nh-badge.lower  { background:#eff6ff; color:#3b82f6; border:2px solid #3b82f6; }

  .nh-btn { padding:14px 28px; font-size:1.05em; border:none; border-radius:10px; cursor:pointer;
    font-weight:700; text-transform:uppercase; letter-spacing:1px; width:100%;
    background:linear-gradient(135deg,#f5d76e,#ffeaa7); color:#2d3748;
    box-shadow:0 4px 14px rgba(245,215,110,.4); transition:.3s; }
  .nh-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(245,215,110,.6); }
  .nh-btn.secondary { margin-top:10px; background:linear-gradient(135deg,#ffeaa7,#f5d76e);
    box-shadow:0 4px 14px rgba(245,215,110,.4); }

  .nh-gameover { background:linear-gradient(135deg,#d4a574,#c9945b); padding:40px;
    border-radius:15px; text-align:center; color:#fff; }
  .nh-gameover h2 { font-size:2.4em; margin-bottom:14px; }
  .nh-final-score { font-size:3em; font-weight:700; margin:20px 0; }

  .nh-leaderboard h2 { font-size:1.7em; color:#2d3748; margin-bottom:18px; text-align:center; }
  .nh-leaderboard ul { list-style:none; padding:0; margin:0; }
  .nh-lb-item { background:#fff; padding:13px 18px; margin-bottom:9px; border-radius:10px;
    display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,.05); transition:.3s; }
  .nh-lb-item:hover { transform:translateX(4px); box-shadow:0 4px 14px rgba(0,0,0,.15); }
  .nh-lb-item.rank-1 { background:linear-gradient(135deg,#ffd700,#ffed4e); border:2px solid #ffd700; }
  .nh-lb-item.rank-2 { background:linear-gradient(135deg,#c0c0c0,#e8e8e8); border:2px solid #c0c0c0; }
  .nh-lb-item.rank-3 { background:linear-gradient(135deg,#cd7f32,#e8a87c); border:2px solid #cd7f32; }
  .nh-rank { font-size:1.3em; font-weight:700; color:#d4a574; width:36px; }
  .nh-lb-name { flex:1; font-weight:700; color:#2d3748; }
  .nh-lb-score { font-weight:700; color:#d4a574; }
  .nh-empty { text-align:center; padding:32px 16px; color:#8b7355; }

  @media(max-width:768px) {
    .nh-body { flex-direction:column; }
    .nh-side { border-left:none; border-top:3px solid rgba(212,165,116,0.3); }
    .nh-header h1 { font-size:1.8em; }
    .nh-stats { grid-template-columns:repeat(3,1fr); }
  }
`;

export default NumberHunter;