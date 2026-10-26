import type { Snapshot, Resource } from '@ieum/contracts';
import { useExplore } from './state';
import { SourceLinks } from './Detail';
export default function Relations({ snapshot, resource }: { snapshot: Snapshot; resource: Resource }) {
  const { depth, focusOnly, evidence, setFocusOnly, setEvidence, expand } = useExplore();
  const documents = snapshot.evidence.filter(e => e.resourceIds.includes(resource.id));
  return <>
    <section><h3>지도에서 관계 탐색</h3><div className="relation-actions"><button aria-pressed={focusOnly && depth === 1} onClick={() => useExplore.setState({ depth: 1, focusOnly: true })}>직접 연결만</button><button aria-pressed={focusOnly && depth === 2} onClick={expand}>2단계 확장</button><button aria-pressed={!focusOnly} onClick={() => setFocusOnly(false)}>전체 지도</button></div><p className="fine">공식 근거가 있는 연결만 펼칩니다. 연구 주제의 유사성을 실제 협업 관계로 표시하지 않습니다.</p></section>
    <section><h3>논문·학위논문 근거 <span>{documents.length}</span></h3>{documents.length ? <><ul className="evidence-list">{documents.map(document => <li key={document.id}><span className="fine">{document.kind === 'thesis' ? '학위논문' : '논문'}</span><strong>{document.title}</strong><SourceLinks snapshot={snapshot} ids={document.sourceIds} /></li>)}</ul><button className="wide-button" aria-pressed={evidence} onClick={() => { setEvidence(!evidence); if (!evidence) setFocusOnly(true); }}>{evidence ? '지도에서 논문 근거 접기' : '지도에 논문 근거 펼치기'}</button></> : <p className="muted">검수된 논문 근거가 아직 없습니다. 연구실과 교수의 관계는 위 공식 소개 페이지에서 확인할 수 있습니다.</p>}</section>
  </>;
}
