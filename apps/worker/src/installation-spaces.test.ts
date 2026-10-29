import { expect, it } from 'vitest';
import { parseSnapshot } from '@ieum/catalog';
import snapshotJson from '../../../data/college-draft.json';
import campusJson from '../../../data/campus/campus-draft.json';
import { parseCampus } from '../../../packages/catalog/src/campus';
import { installationRooms } from './installation-spaces';
it('groups shared installations without duplicating existing rooms or inventing unknown locations', () => {
 const snapshot=parseSnapshot(snapshotJson), campus=parseCampus(campusJson,snapshot), rooms=installationRooms(snapshot,campus);
 const cryo=rooms.find(r=>r.number==='139-1' && r.room==='B112호');
 expect(cryo?.existingSpaceId).toBe('space-irf-b112');
 expect(cryo?.equipmentIds).toContain('eq-irf-105');
 expect(cryo?.equipmentIds).toContain('eq-irf-108');
 expect(new Set(rooms.map(r=>`${r.buildingId}:${r.room}`)).size).toBe(rooms.length);
 expect(rooms.flatMap(r=>r.equipmentIds).some(id=>id.startsWith('eq-isrc-'))).toBe(false);
 expect(rooms.every(r=>r.sourceIds.length>0)).toBe(true);
});
