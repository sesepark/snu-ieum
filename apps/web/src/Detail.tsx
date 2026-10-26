import { useEffect, useRef } from 'react';
import type { Snapshot, Resource } from '@ieum/contracts';
export const kindLabels: Record<Resource['kind'], string> = { researcher: '교수', lab: '연구실', equipment: '장비', space: '공간' };
export function SourceLinks({ snapshot, ids }: { snapshot: Snapshot; ids: string[] }) {
  return <ul className="source-list">{snapshot.sources.filter(s => ids.includes(s.id)).map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a><span>{source.organization} · 확인 {source.lastVerifiedAt.slice(0, 10)}</span></li>)}</ul>;
}
export default function Detail({ resource, snapshot, verificationRequired, onClose, onSelect, children }: { resource: Resource; snapshot: Snapshot; verificationRequired: boolean; onClose(): void; onSelect(id: string): void; children?: React.ReactNode }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [resource.id]);
  const department = snapshot.departments.find(d => d.id === resource.departmentId);
  const relations = snapshot.relations.filter(e => e.from === resource.id || e.to === resource.id);
  return <aside className="detail-panel" aria-label="선택 자원 상세">
    <div className="panel-top"><span className={`kind-pill ${resource.kind}`}>{kindLabels[resource.kind]}</span><button className="icon-button" onClick={onClose} aria-label="상세 닫기">×</button></div>
    <h2 tabIndex={-1} ref={title}>{resource.name}</h2><p className="eyebrow">{department?.name}</p><p className="resource-summary">{resource.summary}</p>
    <div className="keywords">{resource.keywords.map(word => <span key={word}>{word}</span>)}</div>
    {verificationRequired && <p className="verification-note">공식 페이지 확인 필요 · 이용 조건과 최신 정보는 원문에서 확인해주세요.</p>}
    <section><h3>공식 출처 <span>{resource.sourceIds.length}</span></h3><SourceLinks snapshot={snapshot} ids={resource.sourceIds} /><p className="fine">마지막 확인 {resource.lastVerifiedAt.slice(0, 10)}</p></section>
    <section><h3>직접 연결 <span>{relations.length}</span></h3>{relations.length ? <ul className="related-list">{relations.map(edge => {
      const other = snapshot.resources.find(r => r.id === (edge.from === resource.id ? edge.to : edge.from));
      return other ? <li key={edge.id}><button onClick={() => onSelect(other.id)}><span>{edge.label}</span><strong>{other.name}</strong><span aria-hidden="true">→</span></button><SourceLinks snapshot={snapshot} ids={edge.sourceIds} /></li> : null;
    })}</ul> : <p className="muted">공식 근거를 확인한 연결이 아직 없습니다.</p>}</section>
    {children}
  </aside>;
}
