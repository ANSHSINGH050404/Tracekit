import { z } from "zod";

export const RepositoryInfoSchema = z.object({
  root: z.string().min(1),
  branch: z.string().optional(),
  commit: z.string().optional(),
  dirty: z.boolean().optional(),
});

export const RunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const RunSchema = z.object({
  id: z.string().min(1),
  project: z.string().min(1),
  task: z.string().optional(),
  startedAt: z.number().int().nonnegative(),
  finishedAt: z.number().int().nonnegative().optional(),
  status: RunStatusSchema,
  repository: RepositoryInfoSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateRunParamsSchema = z.object({
  id: z.string().optional(),
  project: z.string().min(1),
  task: z.string().optional(),
  startedAt: z.number().int().nonnegative().optional(),
  repository: RepositoryInfoSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});
