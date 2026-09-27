import React, { useState } from "react";

interface JsonViewerProps {
  data: unknown;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const formatted = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleCopy}
        className="btn"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          fontSize: 11,
          padding: "3px 8px",
          zIndex: 10,
        }}
      >
        {copied ? "✓ Copied" : "Copy JSON"}
      </button>
      <pre className="json-box">{formatted}</pre>
    </div>
  );
};
