import React, { useState } from "react";
import type { AgentEvent } from "../types.js";
import { DiffViewer } from "./DiffViewer.js";
import { CommandViewer } from "./CommandViewer.js";
import { JsonViewer } from "./JsonViewer.js";

interface EventDetailProps {
  event: AgentEvent | null;
  onClose: () => void;
}

export const EventDetail: React.FC<EventDetailProps> = ({ event, onClose }) => {
  const [tab, setTab] = useState<"details" | "raw">("details");

  if (!event) return null;

  const payload = event.payload ?? {};

  return (
    <div className="detail-pane">
      <div className="detail-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="detail-title">{event.type}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {event.id}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
        <button
          className={`filter-btn ${tab === "details" ? "active" : ""}`}
          onClick={() => setTab("details")}
        >
          Parsed View
        </button>
        <button
          className={`filter-btn ${tab === "raw" ? "active" : ""}`}
          onClick={() => setTab("raw")}
        >
          Raw JSON
        </button>
      </div>

      <div className="detail-body">
        {tab === "raw" ? (
          <JsonViewer data={event} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Timestamp */}
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Recorded at: {new Date(event.timestamp).toLocaleString()} ({event.timestamp})
            </div>

            {/* File Write */}
            {event.type === "file.write" && (
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
                  File: {payload.path}
                </div>
                <DiffViewer diff={payload.diff} filePath={payload.path} />
              </div>
            )}

            {/* File Read */}
            {event.type === "file.read" && (
              <div>
                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
                  Read file: {payload.path} ({payload.size ?? 0} bytes)
                </div>
                {payload.content ? (
                  <pre className="terminal-box">{payload.content}</pre>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    Content hash: {payload.hash ?? "N/A"}
                  </div>
                )}
              </div>
            )}

            {/* Tool Call */}
            {event.type === "tool.call" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-purple)" }}>
                  Tool: {payload.tool}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Call ID: {payload.callId}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Input Arguments:
                </div>
                <JsonViewer data={payload.input} />
              </div>
            )}

            {/* Tool Result */}
            {event.type === "tool.result" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-purple)" }}>
                    Tool: {payload.tool}
                  </div>
                  {payload.duration !== undefined && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {payload.duration}ms
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Call ID: {payload.callId}
                </div>
                {payload.isError && (
                  <div className="badge badge-failed" style={{ alignSelf: "flex-start" }}>
                    Execution Error
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Result Output:
                </div>
                <JsonViewer data={payload.output} />
              </div>
            )}

            {/* Command Events */}
            {event.type === "command.started" && (
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--accent-blue)" }}>
                  $ {payload.command}
                </div>
                {payload.cwd && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    Working directory: {payload.cwd}
                  </div>
                )}
              </div>
            )}

            {(event.type === "command.stdout" || event.type === "command.stderr") && (
              <div className="terminal-box">
                <span className={event.type === "command.stdout" ? "term-stdout" : "term-stderr"}>
                  {payload.data}
                </span>
              </div>
            )}

            {event.type === "command.finished" && (
              <CommandViewer
                command={payload.command}
                exitCode={payload.exitCode}
              />
            )}

            {/* Model Request */}
            {event.type === "model.request" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-cyan)" }}>
                  Model: {payload.model ?? "Unknown"} ({payload.provider ?? "Custom"})
                </div>
                {payload.systemPrompt && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      System Prompt:
                    </div>
                    <pre className="terminal-box">{payload.systemPrompt}</pre>
                  </div>
                )}
                {payload.messages && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      Messages ({payload.messages.length}):
                    </div>
                    <JsonViewer data={payload.messages} />
                  </div>
                )}
              </div>
            )}

            {/* Model Response */}
            {event.type === "model.response" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-cyan)" }}>
                    Model: {payload.model ?? "Response"}
                  </span>
                  {payload.duration !== undefined && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {payload.duration}ms
                    </span>
                  )}
                </div>
                {payload.usage && (
                  <div className="stats-grid" style={{ padding: 0 }}>
                    <div className="stat-box">
                      <span className="stat-label">Prompt Tokens</span>
                      <span className="stat-val">{payload.usage.promptTokens ?? 0}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Completion</span>
                      <span className="stat-val">{payload.usage.completionTokens ?? 0}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Total Tokens</span>
                      <span className="stat-val">{payload.usage.totalTokens ?? 0}</span>
                    </div>
                  </div>
                )}
                {payload.content && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      Generated Text:
                    </div>
                    <pre className="terminal-box" style={{ whiteSpace: "pre-wrap" }}>
                      {payload.content}
                    </pre>
                  </div>
                )}
                {payload.toolCalls && payload.toolCalls.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      Model Tool Calls ({payload.toolCalls.length}):
                    </div>
                    <JsonViewer data={payload.toolCalls} />
                  </div>
                )}
              </div>
            )}

            {/* Git Snapshot */}
            {event.type === "git.snapshot" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <strong>Root:</strong> {payload.root}
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>Branch:</strong> {payload.branch ?? "(none)"}
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>Commit:</strong> <code>{payload.commit?.slice(0, 8) ?? "N/A"}</code>
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>Status:</strong> {payload.dirty ? "Dirty changes present" : "Clean"}
                </div>
                {payload.statusSummary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {payload.statusSummary}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {event.type === "error" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ color: "var(--accent-red)", fontWeight: 600, fontSize: 14 }}>
                  {payload.message}
                </div>
                {payload.stack && (
                  <pre className="terminal-box" style={{ color: "var(--accent-red)" }}>
                    {payload.stack}
                  </pre>
                )}
                {payload.context && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                      Error Context:
                    </div>
                    <JsonViewer data={payload.context} />
                  </div>
                )}
              </div>
            )}

            {/* Fallback for other events */}
            {!["file.write", "file.read", "tool.call", "tool.result", "command.started", "command.stdout", "command.stderr", "command.finished", "model.request", "model.response", "git.snapshot", "error"].includes(event.type) && (
              <JsonViewer data={payload} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
