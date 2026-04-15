import React, { useState, useEffect, useCallback, useRef } from "react";
import { safeStorage as storage } from "./storage";
import { syncGameScore } from "./scoreSync";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = "idle" | "waiting" | "go" | "too-early" | "result";

interface ReactionScore {
  name: string;
  time: number;
  timestamp: number;
}

interface PlayerStats {
  attempts: number;
  bestTime: number | null;
  avgTime: number | null;
  totalTime: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<ReactionScore[]> {
  try {
    const result = await storage.list("score:", true);
    if (!result?.keys?.length) return [];
    const entries: ReactionScore[] = [];
    for (const key of result.keys) {
      try {
        const d = await storage.get(key, true);
        if (d?.value) entries.push(JSON.parse(d.value));
      } catch {}
    }
    return entries.sort((a, b) => a.time - b.time).slice(0, 10);
  } catch { return []; }
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ReactionGame: React.FC = () => {
  const [screen, setScreen] = useState<"setup" | "game">("setup");
  const [playerName, setPlayerName] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [lastTime, setLastTime] = useState<number | null>(null);
  const [stats, setStats] = useState<PlayerStats>({ attempts: 0, bestTime: null, avgTime: null, totalTime: 0 });
  const [leaderboard, setLeaderboard] = useState<ReactionScore[]>([]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const currentPlayerRef = useRef("");

  const loadBoard = useCallback(async () => {
    setLeaderboard(await fetchLeaderboard());
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const initRound = useCallback(() => {
    setGameState("waiting");
    setLastTime(null);
    const wait = 2000 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      setGameState("go");
      startTimeRef.current = Date.now();
    }, wait);
  }, []);

  const startGame = () => {
    if (!playerName.trim()) { alert("Please enter your name!"); return; }
    setCurrentPlayer(playerName.trim());
    currentPlayerRef.current = playerName.trim();
    setScreen("game");
    initRound();
  };

  const handleBoxClick = useCallback(() => {
    if (gameState === "waiting") {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      setGameState("too-early");
      setTimeout(() => initRound(), 1500);
    } else if (gameState === "go") {
      const reactionTime = Date.now() - startTimeRef.current;
      setGameState("result");
      setLastTime(reactionTime);
      setStats(prev => {
        const newTotal = prev.totalTime + reactionTime;
        const newAttempts = prev.attempts + 1;
        const newBest = prev.bestTime === null || reactionTime < prev.bestTime ? reactionTime : prev.bestTime;
        return {
          attempts: newAttempts,
          totalTime: newTotal,
          bestTime: newBest,
          avgTime: Math.round(newTotal / newAttempts),
        };
      });
      const id = `score:${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      void storage.set(id, JSON.stringify({
        name: currentPlayerRef.current,
        time: reactionTime,
        timestamp: Date.now(),
      }), true).then(loadBoard);
      void syncGameScore({
        gameType: 'reaction',
        playerName: currentPlayerRef.current,
        score: reactionTime,
        metadata: { unit: 'ms' },
      });
    }
  }, [gameState, initRound, loadBoard]);

  const playAgain = () => initRound();

  const changeName = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStats({ attempts: 0, bestTime: null, avgTime: null, totalTime: 0 });
    setGameState("idle");
    setScreen("setup");
  };

  const boxClass = `rg-box ${
    gameState === "waiting"   ? "waiting" :
    gameState === "go"        ? "go" :
    gameState === "too-early" ? "too-early" : "idle"
  }`;

  const resultMsg = lastTime === null ? "" :
    lastTime < 200 ? "INCREDIBLE! 🔥" :
    lastTime < 250 ? "AMAZING! ⚡" :
    lastTime < 300 ? "GREAT! 👍" :
    lastTime < 350 ? "GOOD! 😊" : "NICE TRY! 💪";

  return (
    <>
      <style>{CSS}</style>
      <div className="rg-wrap">
        <div className="rg-container">
          <header className="rg-header">
            <h1>⚡ Lightning Reflexes</h1>
            <p>How fast are your reactions? Compete with your classmates!</p>
          </header>

          <div className="rg-body">
            <div className="rg-main">

              {screen === "setup" && (
                <div className="rg-setup">
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startGame()}
                    placeholder="Enter your name"
                    maxLength={20}
                  />
                  <button className="rg-btn primary" onClick={startGame}>Start Playing!</button>
                </div>
              )}

              {screen === "game" && (
                <>
                  {/* Clickable reaction box */}
                  {(gameState === "waiting" || gameState === "go" || gameState === "too-early") && (
                    <div className={boxClass} onClick={handleBoxClick} role="button" tabIndex={0}
                      onKeyDown={e => e.key === " " && handleBoxClick()}>
                      <h2>
                        {gameState === "waiting"   ? "Wait for it..." :
                         gameState === "go"        ? "CLICK NOW!" :
                         "Too Early! 😅"}
                      </h2>
                      <p>
                        {gameState === "waiting"   ? "Get ready to click when it turns GREEN!" :
                         gameState === "go"        ? "⚡ Click as fast as you can!" :
                         "Wait for GREEN! Click to try again."}
                      </p>
                    </div>
                  )}

                  {/* Result display */}
                  {gameState === "result" && lastTime !== null && (
                    <div className="rg-result">
                      <h3>{resultMsg}</h3>
                      <div className="rg-time">{lastTime}ms</div>
                      <div className="rg-stats">
                        <div className="rg-stat-box">
                          <div className="rg-sl">Best</div>
                          <div className="rg-sv">{stats.bestTime !== null ? `${stats.bestTime}ms` : "N/A"}</div>
                        </div>
                        <div className="rg-stat-box">
                          <div className="rg-sl">Average</div>
                          <div className="rg-sv">{stats.avgTime !== null ? `${stats.avgTime}ms` : "N/A"}</div>
                        </div>
                        <div className="rg-stat-box">
                          <div className="rg-sl">Attempts</div>
                          <div className="rg-sv">{stats.attempts}</div>
                        </div>
                      </div>
                      <button className="rg-btn secondary" onClick={playAgain}>Play Again!</button>
                      <button className="rg-btn primary" onClick={changeName}>Change Name</button>
                    </div>
                  )}
                </>
              )}
            </div>

            <aside className="rg-side">
              <div className="rg-leaderboard">
                <h2>🏆 Leaderboard</h2>
                {leaderboard.length === 0 ? (
                  <div className="rg-empty"><p>🎮 No scores yet!</p><p>Be the first to play!</p></div>
                ) : (
                  <ul>
                    {leaderboard.map((s, i) => (
                      <li key={s.timestamp} className={`rg-lb-item rank-${i + 1}`}>
                        <span className="rg-rank">#{i + 1}</span>
                        <span className="rg-lb-name">{s.name}</span>
                        <span className="rg-lb-time">{s.time}ms</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  .rg-wrap { min-height:100vh; display:flex; justify-content:center; align-items:center; padding:20px;
    background:linear-gradient(135deg,#040A0A,#040A0A,#040A0A); font-family:'Segoe UI',sans-serif; overflow-x:hidden; }
  .rg-container { background:#040A0A; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.4);
    max-width:900px; width:100%; overflow:hidden; }
  .rg-header { background:linear-gradient(135deg,#040A0A,#49DC7A,#49DC7A); padding:30px; text-align:center; color:#fff; }
  .rg-header h1 { font-size:2.5em; margin-bottom:8px; text-shadow:2px 2px 4px rgba(0,0,0,.2); }
  .rg-header p { opacity:.9; }
  .rg-body { display:flex; flex-wrap:wrap; }
  .rg-main { flex:1; min-width:300px; padding:40px; background:#ffffff; }
  .rg-side { flex:1; min-width:280px; background:#ffffff; padding:30px; border-left:3px solid rgba(255,255,255,0.24); }

  .rg-setup { text-align:center; }
  .rg-setup input { display:block; margin:0 auto 16px; padding:14px 20px; font-size:1.1em;
    border:2px solid #49DC7A; border-radius:10px; width:100%; max-width:300px; transition:.3s;
    background:#49DC7A; color:#040A0A; }
  .rg-setup input:focus { outline:none; border-color:#22F2EF; transform:scale(1.02); }
  .rg-setup input::placeholder { color:#040A0A; }

  .rg-box { border-radius:15px; padding:60px 40px; text-align:center; cursor:pointer;
    transition:all .3s; border:3px solid rgba(255,255,255,0.24); min-height:280px;
    display:flex; flex-direction:column; justify-content:center; align-items:center; user-select:none; }
  .rg-box.idle    { background:rgba(255,255,255,0.92); }
  .rg-box.waiting { background:linear-gradient(135deg,rgba(201,35,248,0.16),rgba(201,35,248,0.28)); border-color:rgba(201,35,248,0.28); }
  .rg-box.go      { background:linear-gradient(135deg,#49DC7A,#22F2EF); border-color:#49DC7A;
    animation:rg-pulse .5s infinite; }
  .rg-box.too-early { background:linear-gradient(135deg,#C923F8,#C923F8); border-color:#C923F8; }
  @keyframes rg-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
  .rg-box h2 { font-size:2em; margin-bottom:14px; color:#040A0A; }
  .rg-box p  { font-size:1.2em; color:rgba(4,10,10,0.72); line-height:1.6; }

  .rg-result { padding:20px; background:rgba(255,255,255,0.92);
    border-radius:14px; text-align:center; }
  .rg-result h3 { font-size:1.8em; color:#040A0A; margin-bottom:10px; }
  .rg-time { font-size:3em; font-weight:700; color:#49DC7A; text-shadow:2px 2px 4px rgba(0,0,0,.1); margin-bottom:14px; }
  .rg-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px; }
  .rg-stat-box { background:rgba(255,255,255,0.84); padding:14px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,.1); border:1px solid rgba(4,10,10,0.12); }
  .rg-sl { font-size:.85em; color:rgba(4,10,10,0.72); margin-bottom:4px; }
  .rg-sv { font-size:1.5em; font-weight:700; color:#49DC7A; }

  .rg-btn { padding:14px 28px; font-size:1.05em; border:none; border-radius:10px; cursor:pointer;
    font-weight:700; text-transform:uppercase; letter-spacing:1px; width:100%;
    transition:.3s; margin-top:10px; }
  .rg-btn.primary { background:linear-gradient(135deg,#49DC7A,#22F2EF); color:#040A0A;
    box-shadow:0 4px 14px rgba(0,230,118,.4); }
  .rg-btn.primary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,230,118,.6); }
  .rg-btn.secondary { background:linear-gradient(135deg,#49DC7A,#49DC7A); color:#fff; }
  .rg-btn.secondary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(16,185,129,.5); }

  .rg-leaderboard h2 { font-size:1.7em; color:#040A0A; margin-bottom:18px; text-align:center; }
  .rg-leaderboard ul { list-style:none; padding:0; margin:0; }
  .rg-lb-item { background:rgba(255,255,255,0.92); padding:13px 18px; margin-bottom:9px; border-radius:10px;
    display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,.08); transition:.3s;
    border:1px solid rgba(4,10,10,0.12); }
  .rg-lb-item:hover { transform:translateX(4px); background:rgba(255,255,255,0.84); }
  .rg-lb-item.rank-1 { background:linear-gradient(135deg,#C923F8,#C923F8); border:2px solid #C923F8; }
  .rg-lb-item.rank-2 { background:linear-gradient(135deg,rgba(255,255,255,0.8),rgba(255,255,255,0.7)); border:2px solid rgba(255,255,255,0.8); }
  .rg-lb-item.rank-3 { background:linear-gradient(135deg,#49DC7A,#49DC7A); border:2px solid #49DC7A; }
  .rg-rank { font-size:1.3em; font-weight:700; color:#49DC7A; width:36px; }
  .rg-lb-name { flex:1; font-weight:700; color:#040A0A; }
  .rg-lb-time { font-weight:700; color:#040A0A; }
  .rg-empty { text-align:center; padding:32px 16px; color:rgba(255,255,255,0.65); }

  @media(max-width:768px){
    .rg-body { flex-direction:column; }
    .rg-side { border-left:none; border-top:3px solid rgba(255,255,255,0.24); }
    .rg-header h1 { font-size:1.8em; }
    .rg-box { padding:40px 20px; min-height:240px; }
    .rg-stats { grid-template-columns:1fr; }
  }
`;

export default ReactionGame;