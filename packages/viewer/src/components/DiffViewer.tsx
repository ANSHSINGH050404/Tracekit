import React from "react";

interface DiffViewerProps {
  diff?: string;
  filePath?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, filePath }) => {
  if (!diff) {
    return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No diff available</div>;
  }

  const lines = diff.split("\n");

  return (
    <div className="diff-box">
      {filePath && <div className="diff-header">{filePath}</div>}
      <div>
        {lines.map((line, i) => {
          let lineClass = "diff-line";
          if (line.startsWith("+++") || line.startsWith("---")) {
            lineClass += " diff-header";
          } else if (line.startsWith("@@")) {
            lineClass += " diff-hunk";
          } else if (line.startsWith("+")) {
            lineClass += " diff-add";
          } else if (line.startsWith("-")) {
            lineClass += " diff-del";
          }
          return (
            <div key={i} className={lineClass}>
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
};
