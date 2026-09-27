import React, { useState, useEffect } from "react";
import type { Run, AgentEvent } from "./types.js";
import { fetchRuns, fetchRunEvents } from "./api.js";
import { RunList } from "./components/RunList.js";
import { RunDetail } from "./components/RunDetail.js";
import { CompareModal } from "./components/CompareModal.js";

export const App: React.FC = () => {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const data = await fetchRuns();
      setRuns(data);
      if (data.length > 0 && !selectedRunId) {
        setSelectedRunId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load runs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setEvents([]);
      return;
    }
    fetchRunEvents(selectedRunId)
      .then((evts) => {
        setEvents(evts);
      })
      .catch((err) => {
        console.error(`Failed to load events for run ${selectedRunId}`, err);
      });
  }, [selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Global Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">⚡</div>
          <div className="brand-title">Tracekit</div>
          <span className="brand-subtitle">Agent Replay Inspector</span>
        </div>
        <div className="header-actions">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Local-first Agent Observability
          </span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="app-layout">
        <RunList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={(id) => setSelectedRunId(id)}
          onRefresh={loadRuns}
        />

        {selectedRun ? (
          <RunDetail
            run={selectedRun}
            events={events}
            onOpenCompare={() => setIsCompareOpen(true)}
          />
        ) : (
          <div className="empty-state">
            {loading ? (
              <span>Loading runs...</span>
            ) : (
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--text-primary)" }}>No runs recorded yet</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Start an agent recording using <code>Replay.start(...)</code> to inspect runs here.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compare Modal */}
      {isCompareOpen && selectedRunId && (
        <CompareModal
          runs={runs}
          currentRunId={selectedRunId}
          onClose={() => setIsCompareOpen(false)}
        />
      )}
    </div>
  );
};
