import { readFile } from 'node:fs/promises';
import { SnapshotSchema } from '@ieum/contracts';
import { launchCheck } from './launch.ts';
const [snapshotPath, evidencePath] = process.argv.slice(2);
if (!snapshotPath || !evidencePath) throw new Error('Usage: release.ts <approved-snapshot.json> <launch-evidence.json>');
const snapshot = SnapshotSchema.parse(JSON.parse(await readFile(snapshotPath, 'utf8')));
const result = launchCheck(snapshot, JSON.parse(await readFile(evidencePath, 'utf8')));
console.log(JSON.stringify(result, null, 2));
if (!result.ready) process.exitCode = 1;
