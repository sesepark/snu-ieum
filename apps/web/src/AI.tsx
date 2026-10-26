import { useEffect, useRef, useState } from 'react';
import type { Filters, GoalProfile, SearchResponse, Snapshot } from '@ieum/contracts';
import { interpret, search } from './client';
const fields: [keyof GoalProfile, string][] = [['problemDomains', '문제 영역'], ['coreTechnologies', '핵심 기술'], ['requiredCapabilities', '필요 역량'], ['expectedOutputs', '예상 산출물'], ['keywords', '키워드']];
export default function AI({ available, snapshot, filters, onResult }: { available: boolean; snapshot: Snapshot; filters: Filters; onResult(result: SearchResponse | null): void }) {
  const [consent, setConsent] = useState(false), [goal, setGoal] = useState(''), [profile, setProfile] = useState<GoalProfile | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''); const sequence = useRef(0);
  useEffect(() => { sequence.current++; setBusy(false); }, [filters]);
  useEffect(() => () => { sequence.current++; }, []);
  async function runInterpret() {
    if (!consent || !available || !goal.trim()) return;
    const id = ++sequence.current; setBusy(true); setMessage('');
    try { const parsed = await interpret(goal, consent); if (sequence.current === id) setProfile(parsed); }
    catch { if (sequence.current === id) { setMessage('AI 해석을 사용할 수 없습니다. 일반 검색을 계속 이용해주세요.'); onResult(null); } }
    finally { if (sequence.current === id) setBusy(false); }
  }
  async function runSearch() {
    if (!consent || !profile || !available) return;
    const id = ++sequence.current; setBusy(true);
    try {
      const q = (filters.q || profile.keywords[0] || profile.problemDomains[0] || '').slice(0, 300);
      const result = await search({ ...filters, q, aiConsent: true, profile }, snapshot);
      if (sequence.current === id) { onResult(result); setMessage(result.message || '수정한 목표 해석으로 자원을 찾았습니다.'); }
    } catch { if (sequence.current === id) { onResult(null); setMessage('일반 검색으로 전환했습니다.'); } }
    finally { if (sequence.current === id) setBusy(false); }
  }
  return <details className="ai-panel"><summary>목표로 좁혀보기 <span>AI · 선택</span></summary><div className="ai-content">
    <p>동의하면 목표와 수정한 해석을 Google Gemini로 전송합니다. 무료 서비스에서는 입력이 제품 개선에 사용될 수 있으므로 민감한 내용은 입력하지 마세요. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">데이터 처리 조건 ↗</a></p>
    {!available && <p className="verification-note">현재 AI를 사용할 수 없습니다. 일반 검색과 지도는 계속 이용할 수 있습니다.</p>}
    <label className="consent"><input type="checkbox" checked={consent} disabled={!available} onChange={event => { sequence.current++; setBusy(false); setConsent(event.target.checked); if (!event.target.checked) { setProfile(null); onResult(null); } }} />목표의 외부 전송과 데이터 처리에 동의합니다.</label>
    <label htmlFor="goal">어떤 프로젝트를 생각하고 있나요?</label><textarea id="goal" value={goal} maxLength={3000} placeholder="예: 생물 데이터를 분석하는 도구를 만들고 싶어요" onChange={event => { sequence.current++; setBusy(false); setGoal(event.target.value); setProfile(null); onResult(null); }} />
    <button className="wide-button" disabled={!consent || !available || !goal.trim() || busy} onClick={runInterpret}>{busy ? '처리 중…' : '목표 해석하기'}</button>
    {profile && <div className="goal-profile"><h3>해석을 확인하고 수정해주세요.</h3><p>여러 항목은 쉼표로 구분합니다.</p>{fields.map(([key, label]) => <label key={key}>{label}<input value={profile[key].join(', ')} maxLength={2000} onChange={event => setProfile({ ...profile, [key]: event.target.value.split(',').map(v => v.trim()).filter(Boolean).slice(0, key === 'keywords' ? 30 : 15) })} /></label>)}<button className="wide-button" disabled={!consent || busy} onClick={runSearch}>해석대로 자원 찾기</button></div>}
    <p className="fine" role="status">{message}</p>
  </div></details>;
}
