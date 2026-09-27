import { z } from "zod";
import type { AgentEvent } from "./types.js";

export const BaseEventSchema = z.object({
  id: z.string().min(1, "Event id is required"),
  runId: z.string().min(1, "runId is required"),
  timestamp: z.number().int().nonnegative(),
  type: z.string().min(1, "Event type is required"),
});

export const AgentStartedPayloadSchema = z.object({
  task: z.string().optional(),
  project: z.string().optional(),
  agent: z
    .object({
      name: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("agent.started"),
  payload: AgentStartedPayloadSchema,
});

export const AgentFinishedPayloadSchema = z.object({
  status: z.enum(["completed", "failed", "cancelled"]),
  duration: z.number().nonnegative().optional(),
  summary: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentFinishedEventSchema = BaseEventSchema.extend({
  type: z.literal("agent.finished"),
  payload: AgentFinishedPayloadSchema,
});

export const ModelRequestPayloadSchema = z.object({
  callId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.unknown()).optional(),
  parameters: z.record(z.unknown()).optional(),
});

export const ModelRequestEventSchema = BaseEventSchema.extend({
  type: z.literal("model.request"),
  payload: ModelRequestPayloadSchema,
});

export const ModelUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
  cost: z.number().nonnegative().optional(),
});

export const ModelResponsePayloadSchema = z.object({
  callId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  content: z.string().optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.unknown().optional(),
      })
    )
    .optional(),
  usage: ModelUsageSchema.optional(),
  duration: z.number().nonnegative().optional(),
});

export const ModelResponseEventSchema = BaseEventSchema.extend({
  type: z.literal("model.response"),
  payload: ModelResponsePayloadSchema,
});

export const ToolCallPayloadSchema = z.object({
  callId: z.string().min(1),
  tool: z.string().min(1),
  input: z.unknown(),
});

export const ToolCallEventSchema = BaseEventSchema.extend({
  type: z.literal("tool.call"),
  payload: ToolCallPayloadSchema,
});

export const ToolResultPayloadSchema = z.object({
  callId: z.string().min(1),
  tool: z.string().min(1),
  output: z.unknown(),
  isError: z.boolean().optional(),
  duration: z.number().nonnegative().optional(),
});

export const ToolResultEventSchema = BaseEventSchema.extend({
  type: z.literal("tool.result"),
  payload: ToolResultPayloadSchema,
});

export const CommandStartedPayloadSchema = z.object({
  commandId: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export const CommandStartedEventSchema = BaseEventSchema.extend({
  type: z.literal("command.started"),
  payload: CommandStartedPayloadSchema,
});

export const CommandStdoutPayloadSchema = z.object({
  commandId: z.string().min(1),
  data: z.string(),
});

export const CommandStdoutEventSchema = BaseEventSchema.extend({
  type: z.literal("command.stdout"),
  payload: CommandStdoutPayloadSchema,
});

export const CommandStderrPayloadSchema = z.object({
  commandId: z.string().min(1),
  data: z.string(),
});

export const CommandStderrEventSchema = BaseEventSchema.extend({
  type: z.literal("command.stderr"),
  payload: CommandStderrPayloadSchema,
});

export const CommandFinishedPayloadSchema = z.object({
  commandId: z.string().min(1),
  command: z.string().optional(),
  exitCode: z.number().int().nullable(),
  duration: z.number().nonnegative().optional(),
});

export const CommandFinishedEventSchema = BaseEventSchema.extend({
  type: z.literal("command.finished"),
  payload: CommandFinishedPayloadSchema,
});

export const FileReadPayloadSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  hash: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export const FileReadEventSchema = BaseEventSchema.extend({
  type: z.literal("file.read"),
  payload: FileReadPayloadSchema,
});

export const FileWritePayloadSchema = z.object({
  path: z.string().min(1),
  before: z.string().nullable().optional(),
  after: z.string().optional(),
  diff: z.string().optional(),
  beforeHash: z.string().nullable().optional(),
  afterHash: z.string().optional(),
});

export const FileWriteEventSchema = BaseEventSchema.extend({
  type: z.literal("file.write"),
  payload: FileWritePayloadSchema,
});

export const FileDeletePayloadSchema = z.object({
  path: z.string().min(1),
  previousHash: z.string().optional(),
});

export const FileDeleteEventSchema = BaseEventSchema.extend({
  type: z.literal("file.delete"),
  payload: FileDeletePayloadSchema,
});

export const GitSnapshotPayloadSchema = z.object({
  root: z.string().min(1),
  branch: z.string().optional(),
  commit: z.string().optional(),
  dirty: z.boolean(),
  statusSummary: z.string().optional(),
  phase: z.enum(["start", "end", "checkpoint"]).optional(),
});

export const GitSnapshotEventSchema = BaseEventSchema.extend({
  type: z.literal("git.snapshot"),
  payload: GitSnapshotPayloadSchema,
});

export const ErrorPayloadSchema = z.object({
  message: z.string().min(1),
  name: z.string().optional(),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export const ErrorEventSchema = BaseEventSchema.extend({
  type: z.literal("error"),
  payload: ErrorPayloadSchema,
});

export const GenericEventSchema = BaseEventSchema.extend({
  payload: z.record(z.unknown()).optional(),
});

export const KnownEventSchemas: Record<string, z.ZodType<any>> = {
  "agent.started": AgentStartedEventSchema,
  "agent.finished": AgentFinishedEventSchema,
  "model.request": ModelRequestEventSchema,
  "model.response": ModelResponseEventSchema,
  "tool.call": ToolCallEventSchema,
  "tool.result": ToolResultEventSchema,
  "command.started": CommandStartedEventSchema,
  "command.stdout": CommandStdoutEventSchema,
  "command.stderr": CommandStderrEventSchema,
  "command.finished": CommandFinishedEventSchema,
  "file.read": FileReadEventSchema,
  "file.write": FileWriteEventSchema,
  "file.delete": FileDeleteEventSchema,
  "git.snapshot": GitSnapshotEventSchema,
  "error": ErrorEventSchema,
};

/**
 * Validates an event against known event schemas or generic extensible event schema.
 * Throws ZodError if invalid or missing base fields.
 */
export function validateEvent(data: unknown): AgentEvent {
  // First ensure base fields are valid
  const base = BaseEventSchema.parse(data);
  const specificSchema = KnownEventSchemas[base.type];
  if (specificSchema) {
    return specificSchema.parse(data) as AgentEvent;
  }
  return GenericEventSchema.parse(data) as AgentEvent;
}

/**
 * Safe validation returning result object.
 */
export function safeValidateEvent(
  data: unknown
): { success: true; data: AgentEvent } | { success: false; error: z.ZodError } {
  try {
    const validated = validateEvent(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err };
    }
    const genericZodError = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: err instanceof Error ? err.message : String(err),
      },
    ]);
    return { success: false, error: genericZodError };
  }
}
