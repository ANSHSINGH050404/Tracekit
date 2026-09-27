import { describe, it, expect } from "vitest";
import {
  validateEvent,
  safeValidateEvent,
  BaseEventSchema,
} from "../src/events/schemas.js";

describe("Event Validation", () => {
  it("validates a standard known event (valid event)", () => {
    const validStarted = {
      id: "evt_1",
      runId: "run_100",
      timestamp: Date.now(),
      type: "agent.started",
      payload: {
        task: "Fix login button",
        project: "my-app",
      },
    };

    const result = safeValidateEvent(validStarted);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("agent.started");
      expect(result.data.runId).toBe("run_100");
    }
  });

  it("fails when missing runId (missing runId)", () => {
    const missingRunId = {
      id: "evt_1",
      timestamp: Date.now(),
      type: "agent.started",
      payload: {},
    };

    const result = safeValidateEvent(missingRunId);
    expect(result.success).toBe(false);
    expect(() => validateEvent(missingRunId)).toThrow();
  });

  it("fails when payload is invalid for a known event (invalid event)", () => {
    const invalidFinished = {
      id: "evt_2",
      runId: "run_100",
      timestamp: Date.now(),
      type: "agent.finished",
      payload: {
        // status is an enum: completed, failed, cancelled
        status: "invalid_status_value",
      },
    };

    const result = safeValidateEvent(invalidFinished);
    expect(result.success).toBe(false);
  });

  it("supports extensible unknown event types matching BaseEvent (unknown event)", () => {
    const customEvent = {
      id: "evt_custom",
      runId: "run_100",
      timestamp: Date.now(),
      type: "custom.agent.event",
      payload: {
        foo: "bar",
        count: 42,
      },
    };

    const result = safeValidateEvent(customEvent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("custom.agent.event");
    }
  });

  it("validates tool call and result schemas", () => {
    const toolCall = {
      id: "call_1",
      runId: "run_1",
      timestamp: Date.now(),
      type: "tool.call",
      payload: {
        callId: "c1",
        tool: "read_file",
        input: { path: "foo.txt" },
      },
    };
    expect(safeValidateEvent(toolCall).success).toBe(true);

    const toolResult = {
      id: "call_2",
      runId: "run_1",
      timestamp: Date.now(),
      type: "tool.result",
      payload: {
        callId: "c1",
        tool: "read_file",
        output: "content",
        isError: false,
        duration: 12,
      },
    };
    expect(safeValidateEvent(toolResult).success).toBe(true);
  });
});
