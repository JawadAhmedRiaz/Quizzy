import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
      style={{ width: "54px", height: "30px" }}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
    >
      <div
        className="toggleWrapper"
        style={{
          width: "90px",
          height: "50px",
          transform: "scale(0.6)",
          transformOrigin: "center center",
          flexShrink: 0,
        }}
      >
        <input
          type="checkbox"
          className="input"
          id="theme-toggle-switch"
          checked={isDark}
          onChange={toggleTheme}
        />
        <label htmlFor="theme-toggle-switch" className="toggle">
          <span className="toggle__handler">
            <span className="crater crater--1" />
            <span className="crater crater--2" />
            <span className="crater crater--3" />
          </span>
          <div className="star star--1" />
          <div className="star star--2" />
          <div className="star star--3" />
          <div className="star star--4" />
          <div className="star star--5" />
          <div className="star star--6" />
        </label>
      </div>
    </div>
  );
}
