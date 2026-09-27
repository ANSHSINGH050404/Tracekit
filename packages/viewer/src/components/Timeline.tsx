import React, { useState } from "react";
import type { AgentEvent } from "../types.js";

interface TimelineProps {
  events: AgentEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: AgentEvent) => void;
  startTime: number;
}

export const Timeline: React.FC<TimelineProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  startTime,
}) => {
  const [filter, setFilter] = useState<string>("all");

  const getEventIcon = (type: string, payload?: any) => {
    switch (type) {
      case "agent.started":
        return "🚀";
      case "agent.finished":
        return payload?.status === "completed" ? "🏁" : "🛑";
      case "model.request":
        return "🤖";
      case "model.response":
        return "💬";
      case "tool.call":
        return "🛠️";
      case "tool.result":
        return payload?.isError ? "⚠️" : "✓";
      case "command.started":
        return "💻";
      case "command.stdout":
      case "command.stderr":
        return "📝";
      case "command.finished":
        return payload?.exitCode === 0 ? "✓" : "✗";
      case "file.read":
        return "📖";
      case "file.write":
        return "✏️";
      case "file.delete":
        return "🗑️";
      case "git.snapshot":
        return "🐙";
      case "error":
        return "❌";
      default:
        return "⚡";
    }
  };

  const getEventSummary = (event: AgentEvent): string => {
    const payload = event.payload ?? {};
    switch (event.type) {
      case "agent.started":
        return payload.task ? `Task: ${payload.task}` : "Agent started run";
      case "agent.finished":
        return `Run finished with status: ${payload.status || "completed"}`;
      case "model.request":
        return `Request to ${payload.model ?? "model"}`;
      case "model.response": {
        const tokens = payload.usage?.totalTokens ? ` (${payload.usage.totalTokens} tokens)` : "";
        return `Model response${tokens}`;
      }
      case "tool.call":
        return `Tool: ${payload.tool}`;
      case "tool.result": {
        const duration = payload.duration !== undefined ? ` [${payload.duration}ms]` : "";
        return payload.isError ? `Tool failed: ${payload.tool}` : `Tool result: ${payload.tool}${duration}`;
      }
      case "command.started":
        return `$ ${payload.command}`;
      case "command.stdout":
        return payload.data?.slice(0, 80) ?? "stdout";
      case "command.stderr":
        return payload.data?.slice(0, 80) ?? "stderr";
      case "command.finished": {
        const status = payload.exitCode === 0 ? "succeeded" : `failed (exit ${payload.exitCode})`;
        const dur = payload.duration !== undefined ? ` in ${payload.duration}ms` : "";
        return `Command ${payload.command || ""} ${status}${dur}`;
      }
      case "file.read":
        return `Read ${payload.path}`;
      case "file.write":
        return `Write to ${payload.path}`;
      case "file.delete":
        return `Deleted ${payload.path}`;
      case "git.snapshot":
        return `Git snapshot (${payload.phase || "state"}): ${payload.branch || "HEAD"} - ${payload.dirty ? "dirty" : "clean"}`;
      case "error":
        return payload.message || "Error occurred";
      default:
        return event.type;
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "tools") return e.type.startsWith("tool.");
    if (filter === "commands") return e.type.startsWith("command.");
    if (filter === "files") return e.type.startsWith("file.");
    if (filter === "models") return e.type.startsWith("model.");
    if (filter === "errors") return e.type === "error" || e.payload?.isError || e.payload?.exitCode > 0;
    return true;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Category filter pills */}
      <div className="filter-bar">
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>Filter:</span>
        {[
          { id: "all", label: `All (${events.length})` },
          { id: "tools", label: "Tools" },
          { id: "commands", label: "Commands" },
          { id: "files", label: "Files" },
          { id: "models", label: "Model" },
          { id: "errors", label: "Errors" },
        ].map((f) => (
          <button
            key={f.id}
            className={`filter-btn ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline entries */}
      <div className="timeline-pane">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <span>No events matching the selected filter</span>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isSelected = selectedEventId === evt.id;
            const offsetSec = Math.max(0, (evt.timestamp - startTime) / 1000).toFixed(1);

            return (
              <div key={evt.id} className="timeline-item">
                <div className="timeline-icon">
                  {getEventIcon(evt.type, evt.payload)}
                </div>
                <div
                  className={`timeline-card ${isSelected ? "active" : ""}`}
                  onClick={() => onSelectEvent(evt)}
                >
                  <div className="card-header-row">
                    <span className="card-type-label">
                      {evt.type}
                    </span>
                    <span className="card-time">+{offsetSec}s</span>
                  </div>
                  <div className="card-desc">
                    {getEventSummary(evt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
