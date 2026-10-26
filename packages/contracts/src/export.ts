import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { ResourceSchema, SourceSchema, RelationSchema, RecommendationSchema, GoalProfileSchema, SnapshotSchema, GraphNodeSchema, GraphEdgeSchema } from './index.ts';
await mkdir('schemas', { recursive: true });
for (const [name, schema] of Object.entries({ ResourceSchema, SourceSchema, RelationSchema, RecommendationSchema, GoalProfileSchema, SnapshotSchema, GraphNodeSchema, GraphEdgeSchema })) {
  await writeFile(`schemas/${name}.json`, JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n');
}
