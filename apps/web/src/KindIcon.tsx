import type { Resource } from '@ieum/contracts';

const paths: Record<Resource['kind'], string> = {
  researcher: 'M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm-7.4 7.6c.6-3.6 3.6-5.6 7.4-5.6s6.8 2 7.4 5.6',
  lab: 'M9.2 3.5h5.6M10.2 3.5v5.4L5 18.1A1.6 1.6 0 0 0 6.4 20.5h11.2a1.6 1.6 0 0 0 1.4-2.4l-5.2-9.2V3.5M7.4 14.5h9.2',
  equipment: 'M4 20h16M7 20v-3h10v3M12 17v-3m-3.5-2.5 6-6m-7.6.6 2.1-2.1 3 3-2.1 2.1zM14 6.5a5.5 5.5 0 0 1 2.8 9.6',
  space: 'M5 20V5.5A1.5 1.5 0 0 1 6.5 4h8A1.5 1.5 0 0 1 16 5.5V20M3 20h18M16 8h3.5v12M12.5 12.5v.01',
};
export default function KindIcon({ kind, size = 18 }: { kind: Resource['kind']; size?: number }) {
  return <svg className={`kind-icon ${kind}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
