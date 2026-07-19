import React from 'react';
import { useNavigate } from 'react-router-dom';
// ✅ FIX: CSS moved here from App.tsx so it only loads on game routes
import '../styles/GamePage.css';
import TypeRacer from '../lib/games/type_racer';
import ReactionGame from '../lib/games/reaction_game';
import MemoryMaster from '../lib/games/memory_master';
import NumberHunter from '../lib/games/number_hunter';

const withBackButton = (GameComponent: React.ComponentType) => {
  return function GamePageWrapper() {
    const navigate = useNavigate();
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => navigate('/games')}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 1000,
            padding: '8px 16px',
            background: 'transparent',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}
        >
          ← Back to Games
        </button>
        <GameComponent />
      </div>
    );
  };
};

export const ReactionGamePage = withBackButton(ReactionGame);
export const TypingGamePage   = withBackButton(TypeRacer);
export const MemoryGamePage   = withBackButton(MemoryMaster);
export const HunterGamePage   = withBackButton(NumberHunter);