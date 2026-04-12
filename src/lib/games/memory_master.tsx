import React, { useState, useEffect, useCallback, useRef } from "react";
import { safeStorage as storage } from "./storage";
import { syncGameScore } from "./scoreSync";

// ─── Types ────────────────────────────────────────────────────────────────────

type Color = "red" | "blue" | "green" | "yellow";

interface ScoreEntry {
  name: string;
  level: number;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS: Color[] = ["red", "blue", "green", "yellow"];
const COLOR_EMOJI: Record<Color, string> = { red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡" };
const FREQUENCIES: Record<Color, number> = { red: 261.63, blue: 329.63, green: 392.0, yellow: 493.88 };

// ─── Storage ──────────────────────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<ScoreEntry[]> {
  try {
    const result = await storage.list("memory:", true);
    if (!result?.keys?.length) return [];
    const entries: ScoreEntry[] = [];
    for (const key of result.keys) {
      try {
        const d = await storage.get(key, true);
        if (d?.value) entries.push(JSON.parse(d.value));
      } catch {}
    }
    return entries.sort((a, b) => b.level - a.level).slice(0, 10);
  } catch { return []; }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function createAudioCtx(): AudioContext {
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
  return new Ctx() as AudioContext;
}

function playTone(ctx: AudioContext, freq: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Main Component ───────────────────────────────────────────────────────────

const MemoryMaster: React.FC = () => {
  const [screen, setScreen] = useState<"setup" | "game" | "gameover">("setup");
  const [playerName, setPlayerName] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState("Ready to test your memory?");
  const [activeColor, setActiveColor] = useState<Color | null>(null);
  const [buttonsEnabled, setButtonsEnabled] = useState(false);
  const [startEnabled, setStartEnabled] = useState(true);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [finalLevel, setFinalLevel] = useState(0);

  // Use refs for mutable game state that doesn't need re-renders
  const sequenceRef = useRef<Color[]>([]);
  const playerSeqRef = useRef<Color[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const isPlayerTurnRef = useRef(false);

  const loadBoard = useCallback(async () => {
    setLeaderboard(await fetchLeaderboard());
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const getAudio = (): AudioContext => {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioCtx();
    return audioCtxRef.current;
  };

  const flash = useCallback(async (color: Color) => {
    setActiveColor(color);
    playTone(getAudio(), FREQUENCIES[color]);
    await sleep(400);
    setActiveColor(null);
  }, []);

  const playSequence = useCallback(async (seq: Color[]) => {
    isPlayingRef.current = true;
    setButtonsEnabled(false);
    setStatus("Watch carefully!");
    for (const color of seq) {
      await sleep(500);
      await flash(color);
    }
    await sleep(500);
    isPlayingRef.current = false;
    isPlayerTurnRef.current = true;
    setButtonsEnabled(true);
    setStatus("Your turn! Repeat the sequence.");
  }, [flash]);

  const startGame = () => {
    if (!playerName.trim()) { alert("Please enter your name!"); return; }
    setCurrentPlayer(playerName.trim());
    sequenceRef.current = [];
    setLevel(0);
    setScreen("game");
    setStartEnabled(true);
    setStatus("Ready to test your memory?");
  };

  const nextLevel = useCallback(async () => {
    if (isPlayingRef.current) return;
    const nextColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const newSeq = [...sequenceRef.current, nextColor];
    sequenceRef.current = newSeq;
    playerSeqRef.current = [];
    isPlayerTurnRef.current = false;
    setLevel(prev => prev + 1);
    setStartEnabled(false);
    await playSequence(newSeq);
  }, [playSequence]);

  const handleColorClick = useCallback(async (color: Color) => {
    if (!isPlayerTurnRef.current || isPlayingRef.current) return;
    void flash(color);
    const newPlayerSeq = [...playerSeqRef.current, color];
    playerSeqRef.current = newPlayerSeq;
    const idx = newPlayerSeq.length - 1;

    if (newPlayerSeq[idx] !== sequenceRef.current[idx]) {
      // Wrong — game over
      isPlayerTurnRef.current = false;
      setButtonsEnabled(false);
      const fl = sequenceRef.current.length - 1; // level reached
      setFinalLevel(fl);
      try {
        const id = `memory:${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await storage.set(id, JSON.stringify({ name: currentPlayer, level: fl, timestamp: Date.now() }), true);
        void syncGameScore({
          gameType: 'memory',
          playerName: currentPlayer,
          score: fl,
          metadata: { level: fl },
        });
        await loadBoard();
      } catch {}
      setScreen("gameover");
      return;
    }

    if (newPlayerSeq.length === sequenceRef.current.length) {
      isPlayerTurnRef.current = false;
      setButtonsEnabled(false);
      setStatus("Perfect! Get ready for the next level...");
      setTimeout(() => {
        setStartEnabled(true);
        setStatus("Ready for the next challenge?");
      }, 1000);
    }
  }, [currentPlayer, flash, loadBoard]);

  const playAgain = () => {
    sequenceRef.current = [];
    playerSeqRef.current = [];
    setLevel(0);
    setFinalLevel(0);
    setScreen("game");
    setButtonsEnabled(false);
    setStartEnabled(true);
    setStatus("Ready to test your memory?");
  };

  const rankMsg =
    finalLevel >= 20 ? "🔥 LEGENDARY! You're a memory master!" :
    finalLevel >= 15 ? "🌟 INCREDIBLE! Amazing memory!" :
    finalLevel >= 10 ? "⭐ GREAT JOB! Impressive!" :
    finalLevel >= 5  ? "👍 NICE! Good effort!" : "💪 Keep practicing!";

  return (
    <>
      <style>{CSS}</style>
      <div className="mm-wrap">
        <div className="mm-container">
          <header className="mm-header">
            <h1>🧠 Memory Master</h1>
            <p>Remember the sequence and repeat it back!</p>
          </header>

          <div className="mm-body">
            <div className="mm-main">

              {screen === "setup" && (
                <div className="mm-setup">
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startGame()}
                    placeholder="Enter your name"
                    maxLength={20}
                  />
                  <button className="mm-btn" onClick={startGame}>Start Game!</button>
                </div>
              )}

              {screen === "game" && (
                <>
                  <div className="mm-score-box">
                    <div className="mm-score-label">Current Level</div>
                    <div className="mm-score-value">{level}</div>
                  </div>
                  <div className="mm-status">{status}</div>
                  <div className="mm-grid">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        className={`mm-color-btn ${color} ${activeColor === color ? "active" : ""} ${!buttonsEnabled ? "disabled" : ""}`}
                        onClick={() => handleColorClick(color)}
                        disabled={!buttonsEnabled}
                      >
                        {COLOR_EMOJI[color]}
                      </button>
                    ))}
                  </div>
                  <button
                    className="mm-btn"
                    onClick={nextLevel}
                    disabled={!startEnabled}
                  >
                    {level === 0 ? "Start Level 1" : `Start Level ${level + 1}`}
                  </button>
                </>
              )}

              {screen === "gameover" && (
                <div className="mm-gameover">
                  <h2>Game Over!</h2>
                  <p>{rankMsg}</p>
                  <div className="mm-final">Level {finalLevel}</div>
                  <button className="mm-btn" onClick={playAgain}>Play Again</button>
                </div>
              )}
            </div>

            <aside className="mm-side">
              <div className="mm-leaderboard">
                <h2>🏆 High Scores</h2>
                {leaderboard.length === 0 ? (
                  <div className="mm-empty"><p>🎮 No scores yet!</p><p>Be the first!</p></div>
                ) : (
                  <ul>
                    {leaderboard.map((s, i) => (
                      <li key={s.timestamp} className={`mm-lb-item rank-${i + 1}`}>
                        <span className="mm-rank">#{i + 1}</span>
                        <span className="mm-lb-name">{s.name}</span>
                        <span className="mm-lb-score">Level {s.level}</span>
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
  .mm-wrap { min-height:100vh; display:flex; justify-content:center; align-items:center; padding:20px;
    background:linear-gradient(135deg,#0a0f2e,#0d1b4b,#0f2060); font-family:'Segoe UI',sans-serif; }
  .mm-container { background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.4);
    max-width:1000px; width:100%; overflow:hidden; }
  .mm-header { background:linear-gradient(135deg,#667eea,#764ba2); padding:30px; text-align:center; color:#fff; }
  .mm-header h1 { font-size:2.5em; margin-bottom:8px; text-shadow:2px 2px 4px rgba(0,0,0,.2); }
  .mm-header p { opacity:.9; }
  .mm-body { display:flex; flex-wrap:wrap; }
  .mm-main { flex:1; min-width:300px; padding:40px; }
  .mm-side { flex:1; min-width:280px; background:#f8f9fa; padding:30px; border-left:3px solid #e9ecef; }

  .mm-setup { text-align:center; }
  .mm-setup input { display:block; margin:0 auto 16px; padding:14px 20px; font-size:1.1em;
    border:3px solid #667eea; border-radius:10px; width:100%; max-width:300px; transition:.3s;
    background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; }
  .mm-setup input:focus { outline:none; border-color:#764ba2; transform:scale(1.02); }

  .mm-score-box { text-align:center; padding:20px; background:linear-gradient(135deg,#ffecd2,#fcb69f);
    border-radius:14px; margin-bottom:20px; }
  .mm-score-label { font-size:1.1em; color:#2d3748; margin-bottom:6px; font-weight:600; }
  .mm-score-value { font-size:3em; font-weight:700; color:#667eea; }

  .mm-status { text-align:center; padding:14px; background:#e6f7ff; border-radius:10px;
    margin-bottom:20px; font-size:1.15em; font-weight:700; color:#1890ff; }

  .mm-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px; }
  .mm-color-btn { aspect-ratio:1; border:none; border-radius:14px; cursor:pointer;
    font-size:2em; box-shadow:0 4px 14px rgba(0,0,0,.2); transition:.2s; }
  .mm-color-btn.red    { background:linear-gradient(135deg,#ff6b6b,#ee5a6f); }
  .mm-color-btn.blue   { background:linear-gradient(135deg,#4facfe,#00f2fe); }
  .mm-color-btn.green  { background:linear-gradient(135deg,#43e97b,#38f9d7); }
  .mm-color-btn.yellow { background:linear-gradient(135deg,#ffd89b,#ffb347); }
  .mm-color-btn.active { transform:scale(1.1); filter:brightness(1.5); box-shadow:0 0 28px rgba(255,255,255,.8); }
  .mm-color-btn.disabled { opacity:.5; cursor:not-allowed; }
  .mm-color-btn:not(.disabled):hover { transform:scale(1.04); }

  .mm-btn { padding:14px 28px; font-size:1.05em; border:none; border-radius:10px; cursor:pointer;
    font-weight:700; text-transform:uppercase; letter-spacing:1px; width:100%;
    background:linear-gradient(135deg,#667eea,#764ba2); color:#fff;
    box-shadow:0 4px 14px rgba(102,126,234,.4); transition:.3s; }
  .mm-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 6px 20px rgba(102,126,234,.6); }
  .mm-btn:disabled { opacity:.5; cursor:not-allowed; }

  .mm-gameover { background:linear-gradient(135deg,#667eea,#764ba2); padding:36px;
    border-radius:15px; text-align:center; color:#fff; }
  .mm-gameover h2 { font-size:2em; margin-bottom:12px; }
  .mm-final { font-size:3em; font-weight:700; margin:18px 0; }

  .mm-leaderboard h2 { font-size:1.7em; color:#2d3748; margin-bottom:18px; text-align:center; }
  .mm-leaderboard ul { list-style:none; padding:0; margin:0; }
  .mm-lb-item { background:#fff; padding:13px 18px; margin-bottom:9px; border-radius:10px;
    display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,.05); transition:.3s; }
  .mm-lb-item:hover { transform:translateX(4px); }
  .mm-lb-item.rank-1 { background:linear-gradient(135deg,#ffd700,#ffed4e); border:2px solid #ffd700; }
  .mm-lb-item.rank-2 { background:linear-gradient(135deg,#c0c0c0,#e8e8e8); border:2px solid #c0c0c0; }
  .mm-lb-item.rank-3 { background:linear-gradient(135deg,#cd7f32,#e8a87c); border:2px solid #cd7f32; }
  .mm-rank { font-size:1.3em; font-weight:700; color:#667eea; width:36px; }
  .mm-lb-name { flex:1; font-weight:700; color:#2d3748; }
  .mm-lb-score { font-weight:700; color:#667eea; }
  .mm-empty { text-align:center; padding:32px 16px; color:#718096; }

  @media(max-width:768px){
    .mm-body { flex-direction:column; }
    .mm-side { border-left:none; border-top:3px solid #e9ecef; }
    .mm-header h1 { font-size:1.8em; }
  }
`;

export default MemoryMaster;