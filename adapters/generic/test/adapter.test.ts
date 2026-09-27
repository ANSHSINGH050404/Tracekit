import { describe, it, expect, vi } from "vitest";
import { GenericAgentAdapter } from "../src/generic-adapter.js";
import type { AgentEvent } from "@tracekit/core";

describe("Generic Agent Adapter", () => {
  it("emits events to registered listeners when started", async () => {
    const adapter = new GenericAgentAdapter("test-adapter");
    await adapter.start();

    const listener = vi.fn();
    adapter.onEvent(listener);

    const testEvent: AgentEvent = {
      id: "evt_adapter",
      runId: "run_adapter",
      timestamp: Date.now(),
      type: "tool.call",
      payload: { callId: "c1", tool: "test", input: {} },
    };

    adapter.emitEvent(testEvent);

    expect(listener).toHaveBeenCalledWith(testEvent);

    await adapter.stop();
  });

  it("does not emit events when stopped", async () => {
    const adapter = new GenericAgentAdapter("test-adapter");
    const listener = vi.fn();
    adapter.onEvent(listener);

    adapter.emitEvent({
      id: "evt_1",
      runId: "run_1",
      timestamp: Date.now(),
      type: "agent.started",
      payload: {},
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
