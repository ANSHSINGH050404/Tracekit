import React, { useState } from "react";
import type { Run, AgentEvent } from "../types.js";
import { Timeline } from "./Timeline.js";
import { EventDetail } from "./EventDetail.js";

interface RunDetailProps {
  run: Run;
  events: AgentEvent[];
  onOpenCompare: () => void;
}

export const RunDetail: React.FC<RunDetailProps> = ({
  run,
  events,
  onOpenCompare,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<AgentEvent | null>(null);

  const durationMs =
    run.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : 0;
  const durationFormatted =
    durationMs < 1000
      ? `${durationMs}ms`
      : `${Math.floor(durationMs / 1000 / 60)}m ${Math.floor(
          (durationMs / 1000) % 60
        )}s`;

  // Compute total tokens across events
  let totalTokens = 0;
  for (const evt of events) {
    if (evt.type === "model.response" && evt.payload?.usage?.totalTokens) {
      totalTokens += evt.payload.usage.totalTokens;
    }
  }

  // Count files changed
  const filesChanged = new Set<string>();
  for (const evt of events) {
    if (evt.type === "file.write" && evt.payload?.path) {
      filesChanged.add(evt.payload.path);
    }
  }

  return (
    <div className="main-view">
      {/* Run Hero Header */}
      <div className="run-hero">
        <div className="hero-top">
          <div className="hero-title-area">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`badge badge-${run.status}`}>{run.status}</span>
              <span style={{ fontSize: 12, color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                {run.id}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                ({run.project})
              </span>
            </div>
            <div className="hero-task">
              {run.task || "Interactive Agent Run"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onOpenCompare}>
              ⚖️ Compare Run
            </button>
          </div>
        </div>

        {/* Repository information */}
        {run.repository && (
          <div className="hero-meta-row">
            <div className="meta-item">
              <span>Branch:</span>
              <strong>{run.repository.branch || "HEAD"}</strong>
            </div>
            {run.repository.commit && (
              <div className="meta-item">
                <span>Commit:</span>
                <code style={{ fontFamily: "var(--font-mono)" }}>
                  {run.repository.commit.slice(0, 7)}
                </code>
              </div>
            )}
            <div className="meta-item">
              <span>Repo State:</span>
              <strong>{run.repository.dirty ? "Dirty" : "Clean"}</strong>
            </div>
          </div>
        )}

        {/* High-level metrics */}
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Duration</span>
            <span className="stat-val">{durationFormatted}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Events</span>
            <span className="stat-val">{events.length}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Files Modified</span>
            <span className="stat-val">{filesChanged.size}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Total Tokens</span>
            <span className="stat-val">
              {totalTokens > 0 ? totalTokens.toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Timeline + Event Detail */}
      <div className="content-split">
        <Timeline
          events={events}
          selectedEventId={selectedEvent?.id ?? null}
          onSelectEvent={(evt) => setSelectedEvent(evt)}
          startTime={run.startedAt}
        />

        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>
    </div>
  );
};
