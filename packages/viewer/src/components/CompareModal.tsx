import React, { useState, useEffect } from "react";
import type { Run, RunComparison } from "../types.js";
import { fetchComparison } from "../api.js";

interface CompareModalProps {
  runs: Run[];
  currentRunId: string;
  onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  runs,
  currentRunId,
  onClose,
}) => {
  const otherRuns = runs.filter((r) => r.id !== currentRunId);
  const [targetRunId, setTargetRunId] = useState<string>(
    otherRuns[0]?.id || ""
  );
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetRunId) return;
    setLoading(true);
    setError(null);
    fetchComparison(currentRunId, targetRunId)
      .then((data) => {
        setComparison(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentRunId, targetRunId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ fontWeight: 600, fontSize: 16 }}>Run Comparison</div>
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

        <div className="modal-body">
          {otherRuns.length === 0 ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>
              Need at least two recorded runs to compare. Record another run to see factual comparison!
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Compare against:</span>
                <select
                  value={targetRunId}
                  onChange={(e) => setTargetRunId(e.target.value)}
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {otherRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} - {r.task ? r.task.slice(0, 30) : r.project}
                    </option>
                  ))}
                </select>
              </div>

              {loading && <div style={{ color: "var(--text-secondary)" }}>Loading metrics...</div>}
              {error && <div style={{ color: "var(--accent-red)" }}>{error}</div>}

              {comparison && !loading && (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: "25%" }}>Metric</th>
                      <th style={{ width: "37.5%" }}>
                        Run A ({comparison.runA.runId})
                      </th>
                      <th style={{ width: "37.5%" }}>
                        Run B ({comparison.runB.runId})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Task</td>
                      <td>{comparison.runA.task || "(none)"}</td>
                      <td>{comparison.runB.task || "(none)"}</td>
                    </tr>
                    <tr>
                      <td>Status</td>
                      <td>
                        <span className={`badge badge-${comparison.runA.status}`}>
                          {comparison.runA.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${comparison.runB.status}`}>
                          {comparison.runB.status}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Duration</td>
                      <td><strong>{comparison.runA.durationFormatted}</strong></td>
                      <td><strong>{comparison.runB.durationFormatted}</strong></td>
                    </tr>
                    <tr>
                      <td>Total Events</td>
                      <td>{comparison.runA.eventCount}</td>
                      <td>{comparison.runB.eventCount}</td>
                    </tr>
                    <tr>
                      <td>Tool Calls</td>
                      <td>{comparison.runA.toolCallsCount}</td>
                      <td>{comparison.runB.toolCallsCount}</td>
                    </tr>
                    <tr>
                      <td>Commands</td>
                      <td>{comparison.runA.commandsCount}</td>
                      <td>{comparison.runB.commandsCount}</td>
                    </tr>
                    <tr>
                      <td>Files Changed</td>
                      <td>{comparison.runA.filesChangedCount}</td>
                      <td>{comparison.runB.filesChangedCount}</td>
                    </tr>
                    <tr>
                      <td>Tokens</td>
                      <td>
                        {comparison.runA.totalTokens > 0
                          ? comparison.runA.totalTokens.toLocaleString()
                          : "N/A"}
                      </td>
                      <td>
                        {comparison.runB.totalTokens > 0
                          ? comparison.runB.totalTokens.toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td>Errors</td>
                      <td>{comparison.runA.errorCount}</td>
                      <td>{comparison.runB.errorCount}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
