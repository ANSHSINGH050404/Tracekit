import React, { useState } from "react";
import type { Run } from "../types.js";

interface RunListProps {
  runs: Run[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onRefresh: () => void;
}

export const RunList: React.FC<RunListProps> = ({
  runs,
  selectedRunId,
  onSelectRun,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRuns = runs.filter((run) => {
    const matchId = run.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTask = (run.task || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchProject = (run.project || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchId || matchTask || matchProject;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>Recorded Runs ({runs.length})</span>
          <button
            onClick={onRefresh}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent-blue)",
              cursor: "pointer",
              fontSize: 13,
            }}
            title="Refresh runs"
          >
            ↻
          </button>
        </div>
        <input
          type="text"
          placeholder="Search by task, id, project..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="runs-list">
        {filteredRuns.length === 0 ? (
          <div className="empty-state" style={{ padding: 24, textAlign: "center" }}>
            <span>No runs found</span>
          </div>
        ) : (
          filteredRuns.map((run) => {
            const isSelected = selectedRunId === run.id;
            const durationMs =
              run.finishedAt && run.startedAt ? run.finishedAt - run.startedAt : 0;
            const durationFormatted =
              durationMs < 1000
                ? `${durationMs}ms`
                : `${Math.floor(durationMs / 1000 / 60)}m ${Math.floor(
                    (durationMs / 1000) % 60
                  )}s`;

            const dateFormatted = new Date(run.startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={run.id}
                className={`run-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelectRun(run.id)}
              >
                <div className="run-card-header">
                  <span className="run-id">{run.id}</span>
                  <span className={`badge badge-${run.status}`}>{run.status}</span>
                </div>
                <div className="run-task" title={run.task || "Untitled Task"}>
                  {run.task || "Untitled Task"}
                </div>
                <div className="run-card-footer">
                  <span>{run.project}</span>
                  <span>
                    {durationFormatted} • {dateFormatted}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
