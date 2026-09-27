import React from "react";

interface CommandViewerProps {
  command?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
}

export const CommandViewer: React.FC<CommandViewerProps> = ({
  command,
  exitCode,
  stdout,
  stderr,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {command && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-blue)" }}>
          $ {command}
        </div>
      )}
      <div className="terminal-box">
        {stdout && <div className="term-stdout">{stdout}</div>}
        {stderr && <div className="term-stderr">{stderr}</div>}
        {!stdout && !stderr && (
          <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
            (no terminal output recorded)
          </div>
        )}
      </div>
      {exitCode !== undefined && (
        <div style={{ fontSize: 12, color: exitCode === 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
          Exit code: {exitCode}
        </div>
      )}
    </div>
  );
};
