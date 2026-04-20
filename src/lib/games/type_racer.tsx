import React, { useState, useEffect, useCallback, useRef } from "react";
import { safeStorage as storage } from "./storage";
import { syncGameScore } from "./scoreSync";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypingScore {
  name: string;
  wpm: number;
  accuracy: number;
  timestamp: number;
}

interface CharState {
  char: string;
  status: "idle" | "correct" | "incorrect" | "current";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEXTS = [
  "The quick brown fox jumps over the lazy dog while the sun sets behind the mountains creating a beautiful orange glow across the sky.",
  "Programming is not just about writing code it is about solving problems and creating solutions that make peoples lives better every single day.",
  "Education opens doors to opportunities that were once thought impossible and helps us understand the world around us in new and exciting ways.",
  "Success comes from hard work dedication and the willingness to never give up even when things get difficult or challenging along the way.",
  "Technology has transformed how we communicate learn and interact with each other making the world feel smaller and more connected than ever before.",
  "Reading expands our imagination teaches us new perspectives and allows us to explore worlds that exist only in the pages of books and stories.",
  "Teamwork makes difficult tasks easier when people collaborate share ideas and support each other towards achieving common goals together.",
  "Practice and persistence are the keys to mastering any skill whether it is playing an instrument coding or learning a new language fluently.",
  "Creativity flourishes when we give ourselves permission to think differently experiment with new ideas and embrace failure as part of learning.",
  "The future belongs to those who believe in their dreams work hard to achieve them and never stop learning and growing throughout their lives.",
];

// ─── Storage ──────────────────────────────────────────────────────────────────

async function fetchLeaderboard(): Promise<TypingScore[]> {
  try {
    const result = await storage.list("typing:", true);
    if (!result?.keys?.length) return [];
    const entries: TypingScore[] = [];
    for (const key of result.keys) {
      try {
        const d = await storage.get(key, true);
        if (d?.value) entries.push(JSON.parse(d.value));
      } catch {}
    }
    return entries.sort((a, b) => b.wpm - a.wpm).slice(0, 10);
  } catch { return []; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCharStates(text: string, typed: string): CharState[] {
  return text.split("").map((char, i) => {
    if (i < typed.length) return { char, status: typed[i] === char ? "correct" : "incorrect" };
    if (i === typed.length) return { char, status: "current" };
    return { char, status: "idle" };
  });
}

function getRaceText(): string {
  const randomText = TEXTS[Math.floor(Math.random() * TEXTS.length)];
  const words = randomText.split(" ");
  // Pick 30–35 words
  const targetCount = Math.floor(Math.random() * 6) + 30; // 30, 31, 32, 33, 34, or 35
  return words.slice(0, Math.min(targetCount, words.length)).join(" ");
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TypeRacer: React.FC = () => {
  const [screen, setScreen] = useState<"setup" | "ready" | "racing" | "gameover">("setup");
  const [playerName, setPlayerName] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [typed, setTyped] = useState("");
  const [charStates, setCharStates] = useState<CharState[]>([]);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(60);
  const [progress, setProgress] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [leaderboard, setLeaderboard] = useState<TypingScore[]>([]);
  const [finalWpm, setFinalWpm] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);
  const [finalCorrect, setFinalCorrect] = useState(0);

  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentPlayerRef = useRef("");

  const loadBoard = useCallback(async () => {
    setLeaderboard(await fetchLeaderboard());
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Keep ref in sync for use inside interval callbacks
  useEffect(() => { currentPlayerRef.current = currentPlayer; }, [currentPlayer]);

  const endRace = useCallback((typedValue: string, text: string) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setScreen("gameover");

    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    let correct = 0;
    for (let i = 0; i < typedValue.length; i++) {
      if (typedValue[i] === text[i]) correct++;
    }
    const finalWpmVal = elapsedMin > 0 ? Math.round(correct / 5 / elapsedMin) : 0;
    const finalAccVal = typedValue.length > 0 ? Math.round((correct / typedValue.length) * 100) : 0;

    setFinalWpm(finalWpmVal);
    setFinalAccuracy(finalAccVal);
    setFinalCorrect(correct);

    const id = `typing:${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    void storage.set(id, JSON.stringify({
      name: currentPlayerRef.current,
      wpm: finalWpmVal,
      accuracy: finalAccVal,
      timestamp: Date.now(),
    }), true).then(loadBoard);
    void syncGameScore({
      gameType: 'typing',
      playerName: currentPlayerRef.current,
      score: finalWpmVal,
      metadata: { accuracy: finalAccVal, correctChars: correct },
    });
  }, [loadBoard]);

  const setupRace = useCallback(() => {
    const text = getRaceText();
    setCurrentText(text);
    setTyped("");
    setCharStates(buildCharStates(text, ""));
    setWpm(0);
    setAccuracy(100);
    setTimeLeft(60);
    setProgress(0);
    setCorrectChars(0);
    setScreen("ready");
  }, []);

  const startGame = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!playerName.trim()) {
      alert("Please enter your name!");
      return;
    }
    
    const trimmedName = playerName.trim();
    setCurrentPlayer(trimmedName);
    currentPlayerRef.current = trimmedName;
    setupRace();
  };

  const beginRace = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    setScreen("racing");
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const left = Math.max(0, 60 - elapsed);
      setTimeLeft(Math.ceil(left));
      if (left <= 0) {
        setTyped(prev => { setCurrentText(text => { endRace(prev, text); return text; }); return prev; });
      }
    }, 100);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (screen !== "racing") return;
    const value = e.target.value;
    setTyped(value);

    let correct = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] === currentText[i]) correct++;
    }
    setCorrectChars(correct);
    setCharStates(buildCharStates(currentText, value));
    setProgress((value.length / currentText.length) * 100);

    const elapsedMin = (Date.now() - startTimeRef.current) / 60000;
    setWpm(elapsedMin > 0 ? Math.round(correct / 5 / elapsedMin) : 0);
    setAccuracy(value.length > 0 ? Math.round((correct / value.length) * 100) : 100);

    if (value === currentText) endRace(value, currentText);
  }, [screen, currentText, endRace]);

  const playAgain = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setTyped("");
    setupRace();
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const msg =
    finalWpm >= 80 ? "🔥 BLAZING FAST!" :
    finalWpm >= 60 ? "⚡ AMAZING SPEED!" :
    finalWpm >= 40 ? "👍 GREAT JOB!" :
    finalWpm >= 20 ? "😊 GOOD START!" : "💪 KEEP PRACTICING!";

  return (
    <>
      <style>{CSS}</style>
      <div className="tr-wrap">
        <div className="tr-container">
          <header className="tr-header">
            <h1>⚡ Type Racer</h1>
            <p>How fast can you type? Challenge your classmates!</p>
          </header>

          <div className="tr-body">
            <div className="tr-main">

              {screen === "setup" && (
                <div className="tr-setup">
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && startGame(e as any)}
                    placeholder="Enter your name"
                    maxLength={20}
                    autoFocus
                  />
                  <button 
                    className="tr-btn" 
                    onClick={startGame}
                    type="button"
                  >
                    START RACE
                  </button>
                </div>
              )}

              {(screen === "ready" || screen === "racing") && (
                <>
                  <div className="tr-stats">
                    <div className="tr-stat"><div className="tr-stat-label">WPM</div><div className="tr-stat-val">{wpm}</div></div>
                    <div className="tr-stat"><div className="tr-stat-label">Accuracy</div><div className="tr-stat-val">{accuracy}%</div></div>
                    <div className="tr-stat"><div className="tr-stat-label">Time</div><div className="tr-stat-val">{timeLeft}</div></div>
                  </div>
                  <div className="tr-progress-bar">
                    <div className="tr-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="tr-text-display">
                    {charStates.map((c, i) => (
                      <span key={i} className={`tr-char ${c.status}`}>{c.char}</span>
                    ))}
                  </div>
                  <input
                    ref={inputRef}
                    className="tr-type-input"
                    value={typed}
                    onChange={handleInput}
                    disabled={screen !== "racing"}
                    placeholder={screen === "ready" ? "Click Begin Race to start..." : "Type here..."}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                  />
                  {screen === "ready" && (
                    <button 
                      className="tr-btn" 
                      onClick={beginRace}
                      type="button"
                    >
                      BEGIN RACE!
                    </button>
                  )}
                </>
              )}

              {screen === "gameover" && (
                <div className="tr-gameover">
                  <h2>{msg}</h2>
                  <div className="tr-go-stats">
                    <div className="tr-go-stat"><div className="tr-go-label">Words Per Minute</div><div className="tr-go-val">{finalWpm}</div></div>
                    <div className="tr-go-stat"><div className="tr-go-label">Accuracy</div><div className="tr-go-val">{finalAccuracy}%</div></div>
                    <div className="tr-go-stat"><div className="tr-go-label">Correct Chars</div><div className="tr-go-val">{finalCorrect}</div></div>
                  </div>
                  <button 
                    className="tr-btn" 
                    onClick={playAgain}
                    type="button"
                  >
                    RACE AGAIN!
                  </button>
                </div>
              )}
            </div>

            <aside className="tr-side">
              <div className="tr-leaderboard">
                <h2>🏆 Top Typists</h2>
                {leaderboard.length === 0 ? (
                  <div className="tr-empty"><p>🎮 No scores yet!</p><p>Be the first to race!</p></div>
                ) : (
                  <ul>
                    {leaderboard.map((s, i) => (
                      <li key={s.timestamp} className={`tr-lb-item rank-${i + 1}`}>
                        <span className="tr-rank">#{i + 1}</span>
                        <span className="tr-lb-name">{s.name}</span>
                        <span className="tr-lb-wpm">{s.wpm} WPM</span>
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
  .tr-wrap { min-height:100vh; display:flex; justify-content:center; align-items:center; padding:20px;
    background:linear-gradient(135deg,#0a0f2e,#0d1b4b,#0f2060); font-family:'Segoe UI',sans-serif; position:relative; }
  .tr-container { background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.4);
    max-width:1000px; width:100%; overflow:hidden; }
  .tr-header { background:linear-gradient(135deg,#1a3a8f,#2563eb,#3b82f6); padding:30px; text-align:center; color:#fff; }
  .tr-header h1 { font-size:2.5em; margin-bottom:8px; text-shadow:2px 2px 4px rgba(0,0,0,.2); }
  .tr-header p { opacity:.9; }
  .tr-body { display:flex; flex-wrap:wrap; }
  .tr-main { flex:2; min-width:300px; padding:40px; }
  .tr-side { flex:1; min-width:280px; background:#f8f9fa; padding:30px; border-left:3px solid #e9ecef; }

  .tr-setup { text-align:center; }
  .tr-setup input { display:block; margin:0 auto 16px; padding:14px 20px; font-size:1.1em;
    border:3px solid #1a3a8f; border-radius:10px; width:100%; max-width:300px; transition:.3s;
    background:#fff; color:#2d3748; }
  .tr-setup input:focus { outline:none; border-color:#2563eb; transform:scale(1.02); }

  .tr-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px; }
  .tr-stat { background:linear-gradient(135deg,#1a3a8f,#2563eb); color:#fff;
    padding:18px; border-radius:14px; text-align:center; box-shadow:0 4px 14px rgba(37,99,235,.3); }
  .tr-stat-label { font-size:.85em; opacity:.9; margin-bottom:4px; }
  .tr-stat-val { font-size:2em; font-weight:700; }

  .tr-progress-bar { background:#0a1640; height:18px; border-radius:10px; overflow:hidden; margin-bottom:20px; }
  .tr-progress-fill { background:linear-gradient(90deg,#2563eb,#60a5fa); height:100%; transition:width .3s; }

  .tr-text-display { background:#f8f9fa; padding:28px; border-radius:14px; margin-bottom:18px;
    min-height:140px; font-size:1.35em; line-height:1.9; letter-spacing:.5px;
    color:#1a3a8f; border:1px solid #e9ecef; }
  .tr-char { transition:all .1s; }
  .tr-char.correct   { color:#10b981; font-weight:700; }
  .tr-char.incorrect { color:#ef4444; background:#fee2e2; font-weight:700; }
  .tr-char.current   { background:#fbbf24; animation:tr-blink .8s infinite; }
  @keyframes tr-blink { 0%,50%{opacity:1} 51%,100%{opacity:.3} }

  .tr-type-input { width:100%; padding:18px 20px; font-size:1.25em; border:3px solid #2563eb;
    border-radius:14px; margin-bottom:16px; font-family:'Courier New',monospace; transition:.3s; }
  .tr-type-input:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 3px rgba(37,99,235,.15); }
  .tr-type-input:disabled { background:#f3f4f6; cursor:not-allowed; }

  .tr-btn { padding:14px 28px; font-size:1.05em; border:none; border-radius:10px; cursor:pointer;
    font-weight:700; text-transform:uppercase; letter-spacing:1px; width:100%;
    background:linear-gradient(135deg,#2563eb,#3b82f6); color:#fff;
    box-shadow:0 4px 14px rgba(37,99,235,.4); transition:.3s; }
  .tr-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 6px 20px rgba(37,99,235,.6); }
  .tr-btn:active { transform:translateY(0); }

  .tr-gameover { background:linear-gradient(135deg,#1a3a8f,#2563eb); padding:40px;
    border-radius:15px; text-align:center; color:#fff; }
  .tr-gameover h2 { font-size:2.3em; margin-bottom:20px; }
  .tr-go-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:24px 0; }
  .tr-go-stat { background:rgba(255,255,255,.2); padding:18px; border-radius:10px; }
  .tr-go-label { font-size:.95em; opacity:.9; }
  .tr-go-val { font-size:2.4em; font-weight:700; margin-top:8px; }

  .tr-leaderboard h2 { font-size:1.7em; color:#2d3748; margin-bottom:18px; text-align:center; }
  .tr-leaderboard ul { list-style:none; padding:0; margin:0; }
  .tr-lb-item { background:#fff; padding:13px 18px; margin-bottom:9px; border-radius:10px;
    display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,.05); transition:.3s;
    border:1px solid #e9ecef; }
  .tr-lb-item:hover { transform:translateX(4px); }
  .tr-lb-item.rank-1 { background:linear-gradient(135deg,#ffd700,#ffed4e); border:2px solid #ffd700; }
  .tr-lb-item.rank-2 { background:linear-gradient(135deg,#c0c0c0,#e8e8e8); border:2px solid #c0c0c0; }
  .tr-lb-item.rank-3 { background:linear-gradient(135deg,#cd7f32,#e8a87c); border:2px solid #cd7f32; }
  .tr-rank { font-size:1.3em; font-weight:700; color:#2563eb; width:36px; }
  .tr-lb-name { flex:1; font-weight:700; color:#2d3748; }
  .tr-lb-wpm { font-weight:700; color:#10b981; }
  .tr-empty { text-align:center; padding:32px 16px; color:#718096; }

  @media(max-width:768px){
    .tr-body { flex-direction:column; }
    .tr-side { border-left:none; border-top:3px solid #e9ecef; }
    .tr-header h1 { font-size:1.8em; }
    .tr-text-display { font-size:1.1em; padding:20px; }
    .tr-go-stats { grid-template-columns:1fr; }
  }
`;

export default TypeRacer;