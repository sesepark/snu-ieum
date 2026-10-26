import { z } from 'zod';
export const Id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const Text = z.string().trim().min(1).max(2000);
const DateTime = z.iso.datetime({ offset: true });
export const ManifestSchema = z.strictObject({
  version: Id, generatedAt: DateTime, publication: z.enum(['prototype', 'approved']),
  reviewedBy: Text.optional(), reviewedAt: DateTime.optional(), selectionReason: Text,
  schemaVersion: z.literal(1)
}).superRefine((m, ctx) => {
  if (m.publication === 'approved' && (!m.reviewedBy || !m.reviewedAt)) ctx.addIssue({ code: 'custom', message: 'Human review required for publication' });
});
