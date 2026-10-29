import type { Campus, Snapshot } from '@ieum/contracts';
import { mappedLocations } from '../../../packages/catalog/src/campus';
// A room is a factual installation location, never a claim of public access.
export function installationRooms(snapshot: Snapshot, campus: Campus) {
  const resources = new Map(snapshot.resources.map(r => [r.id, r]));
  const rooms = new Map<string, { buildingId: string; number: string; room: string; equipmentIds: string[]; sourceIds: string[]; existingSpaceId?: string }>();
  const locations = mappedLocations(campus, snapshot);
  for (const location of locations) {
    if (resources.get(location.resourceId)?.kind !== 'equipment' || location.purpose !== 'installation') continue;
    const building = campus.buildings.find(b => b.id === location.buildingId);
    if (!building?.number || !location.room || !/^[A-Z]?\d+(?:-\d+)?[A-Z]?호?$/.test(location.room)) continue;
    const room = location.room.replace(/호$/, '') + '호', key = `${building.id}:${room}`;
    const existing = locations.find(l => l.buildingId === building.id && l.room?.replace(/호$/, '') === room.replace(/호$/, '') && resources.get(l.resourceId)?.kind === 'space');
    const entry = rooms.get(key) ?? { buildingId: building.id, number: building.number, room, equipmentIds: [], sourceIds: [], existingSpaceId: existing?.resourceId };
    entry.equipmentIds = [...new Set([...entry.equipmentIds, location.resourceId])];
    entry.sourceIds = [...new Set([...entry.sourceIds, ...location.sourceIds])];
    rooms.set(key, entry);
  }
  return [...rooms.values()];
}
