/**
 * Base properties required on every recorded event.
 */
export interface BaseEvent {
  id: string;
  runId: string;
  timestamp: number;
  type: string;
}

export interface AgentStartedPayload {
  task?: string;
  project?: string;
  agent?: {
    name?: string;
    version?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentStartedEvent extends BaseEvent {
  type: "agent.started";
  payload: AgentStartedPayload;
}

export interface AgentFinishedPayload {
  status: "completed" | "failed" | "cancelled";
  duration?: number;
  summary?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentFinishedEvent extends BaseEvent {
  type: "agent.finished";
  payload: AgentFinishedPayload;
}

export interface ModelRequestPayload {
  callId?: string;
  model?: string;
  provider?: string;
  messages?: unknown[];
  systemPrompt?: string;
  tools?: unknown[];
  parameters?: Record<string, unknown>;
}

export interface ModelRequestEvent extends BaseEvent {
  type: "model.request";
  payload: ModelRequestPayload;
}

export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

export interface ModelResponsePayload {
  callId?: string;
  model?: string;
  provider?: string;
  content?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments?: unknown;
  }>;
  usage?: ModelUsage;
  duration?: number;
}

export interface ModelResponseEvent extends BaseEvent {
  type: "model.response";
  payload: ModelResponsePayload;
}

export interface ToolCallPayload {
  callId: string;
  tool: string;
  input: unknown;
}

export interface ToolCallEvent extends BaseEvent {
  type: "tool.call";
  payload: ToolCallPayload;
}

export interface ToolResultPayload {
  callId: string;
  tool: string;
  output: unknown;
  isError?: boolean;
  duration?: number;
}

export interface ToolResultEvent extends BaseEvent {
  type: "tool.result";
  payload: ToolResultPayload;
}

export interface CommandStartedPayload {
  commandId: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface CommandStartedEvent extends BaseEvent {
  type: "command.started";
  payload: CommandStartedPayload;
}

export interface CommandStdoutPayload {
  commandId: string;
  data: string;
}

export interface CommandStdoutEvent extends BaseEvent {
  type: "command.stdout";
  payload: CommandStdoutPayload;
}

export interface CommandStderrPayload {
  commandId: string;
  data: string;
}

export interface CommandStderrEvent extends BaseEvent {
  type: "command.stderr";
  payload: CommandStderrPayload;
}

export interface CommandFinishedPayload {
  commandId: string;
  command?: string;
  exitCode: number | null;
  duration?: number;
}

export interface CommandFinishedEvent extends BaseEvent {
  type: "command.finished";
  payload: CommandFinishedPayload;
}

export interface FileReadPayload {
  path: string;
  content?: string;
  hash?: string;
  size?: number;
}

export interface FileReadEvent extends BaseEvent {
  type: "file.read";
  payload: FileReadPayload;
}

export interface FileWritePayload {
  path: string;
  before?: string | null;
  after?: string;
  diff?: string;
  beforeHash?: string | null;
  afterHash?: string;
}

export interface FileWriteEvent extends BaseEvent {
  type: "file.write";
  payload: FileWritePayload;
}

export interface FileDeletePayload {
  path: string;
  previousHash?: string;
}

export interface FileDeleteEvent extends BaseEvent {
  type: "file.delete";
  payload: FileDeletePayload;
}

export interface GitSnapshotPayload {
  root: string;
  branch?: string;
  commit?: string;
  dirty: boolean;
  statusSummary?: string;
  phase?: "start" | "end" | "checkpoint";
}

export interface GitSnapshotEvent extends BaseEvent {
  type: "git.snapshot";
  payload: GitSnapshotPayload;
}

export interface ErrorPayload {
  message: string;
  name?: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface ErrorEvent extends BaseEvent {
  type: "error";
  payload: ErrorPayload;
}

export interface GenericEvent extends BaseEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export type KnownAgentEvent =
  | AgentStartedEvent
  | AgentFinishedEvent
  | ModelRequestEvent
  | ModelResponseEvent
  | ToolCallEvent
  | ToolResultEvent
  | CommandStartedEvent
  | CommandStdoutEvent
  | CommandStderrEvent
  | CommandFinishedEvent
  | FileReadEvent
  | FileWriteEvent
  | FileDeleteEvent
  | GitSnapshotEvent
  | ErrorEvent;

export type AgentEvent = KnownAgentEvent | GenericEvent;
