import { useAuth } from "@workspace/replit-auth-web";
import "./LoginPage.css";

interface Props {
  onContinueAsGuest: (firstName: string, surname: string, gender: string) => void;
}

function CyberButton({
  children,
  onClick,
  height = 75,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  height?: number;
}) {
  return (
    <div className="cyber-btn-wrapper">
      <button
        type="button"
        onClick={onClick}
        style={{ height: `${height}px`, minHeight: `${height}px` }}
      >
        <span className="cyber-btn-label">{children}</span>
        <div className="cyber-btn-clip">
          <div className="cyber-btn-corner cyber-btn-corner-lt" />
          <div className="cyber-btn-corner cyber-btn-corner-rb" />
          <div className="cyber-btn-corner cyber-btn-corner-rt" />
          <div className="cyber-btn-corner cyber-btn-corner-lb" />
        </div>
        <span className="cyber-btn-arrow cyber-btn-arrow-right" />
        <span className="cyber-btn-arrow cyber-btn-arrow-left" />
      </button>
    </div>
  );
}

export function LoginPage({ onContinueAsGuest }: Props) {
  const { openAuthModal, openRegisterModal } = useAuth();

  return (
    <div className="login-stage">
      {/* Ambient light blooms */}
      <div className="login-ambient-glow" />
      <div className="login-ambient-glow-secondary" />

      {/* QUIZZY text behind the glass */}
      <div className="login-quizzy-bg-wrapper">
        <h1
          className="login-quizzy-text"
          style={{
            transform: "translateY(-36%) scale(1.61, 1.53)",
            transformOrigin: "center center",
          }}
        >
          QUIZZY
        </h1>
      </div>

      {/* Center glass card */}
      <div className="login-glass-square">
        <div className="login-card-top-content">
          <p className="login-card-desc">
            READY TO LOCK IN? NOTHING IS IMPOSSIBLE! LET'S GO.
          </p>
        </div>

        <div className="login-card-actions">
          <CyberButton height={75} onClick={openAuthModal}>
            Login to your account
          </CyberButton>
          <CyberButton height={75} onClick={openRegisterModal}>
            Register with us
          </CyberButton>
        </div>
      </div>
    </div>
  );
}
