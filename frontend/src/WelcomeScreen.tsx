import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="welcome-container">
      <ThemeToggle style={{ position: "absolute", top: 20, right: 30, zIndex: 20 }} />
      <div className="welcome-background">
        <div className="glow-spot spot-1"></div>
        <div className="glow-spot spot-2"></div>
      </div>
      
      <button 
        className="welcome-btn" 
        onClick={() => navigate("/login")}
        aria-label="Entrar no AltDesk"
      >
        <span>Entrar</span>
        <ArrowRight size={20} />
      </button>

      <style>{`
        .welcome-container {
          height: 100vh;
          width: 100vw;
          background: var(--bg-primary);
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s;
        }

        .welcome-background {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .glow-spot {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: pulse 8s infinite alternate;
        }

        .spot-1 {
          width: 400px;
          height: 400px;
          background: var(--accent);
          top: -100px;
          left: -100px;
        }

        .spot-2 {
          width: 500px;
          height: 500px;
          background: var(--accent-hover);
          bottom: -150px;
          right: -150px;
          animation-delay: -4s;
        }

        .welcome-btn {
          position: absolute;
          bottom: 40px;
          right: 40px;
          z-index: 10;
          background: rgba(0, 168, 132, 0.1);
          border: 1px solid rgba(0, 168, 132, 0.3);
          color: var(--accent);
          padding: 16px 32px;
          border-radius: 50px;
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
        }

        .welcome-btn:hover {
          background: var(--accent);
          color: #fff;
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 10px 40px rgba(0, 168, 132, 0.4);
          border-color: var(--accent);
        }

        .welcome-btn:active {
          transform: translateY(-2px) scale(0.98);
        }

        .welcome-btn span {
          letter-spacing: 0.5px;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.1; }
          100% { transform: scale(1.3); opacity: 0.2; }
        }

        @media (max-width: 768px) {
          .welcome-btn {
            bottom: 30px;
            right: 30px;
            padding: 14px 28px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
