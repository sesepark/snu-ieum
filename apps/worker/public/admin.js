const el = id => document.getElementById(id);
async function call(path, body) {
  const response = await fetch(`/ops/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${el('token').value}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
}
const operator = () => ({ actor: el('actor').value, reason: el('reason').value });
async function refresh() {
  const data = await call('status'); el('summary').textContent = JSON.stringify({ active: data.active, batches: data.batches, runs: data.runs, revalidation: data.revalidation }, null, 2);
  el('drafts').replaceChildren();
  for (const draft of data.staging) {
    const section = document.createElement('section'); const title = document.createElement('h2'); title.textContent = `${draft.id} · ${draft.status}`;
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(draft.draft, null, 2); section.append(title, pre);
    for (const [status, label] of [['approved', '출처 검토 완료·승인'], ['needs_revision', '수정 요청'], ['rejected', '거부'], ['expired', '만료']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.addEventListener('click', () => perform(async () => { await call('review', { id: draft.id, status, ...operator() }); await refresh(); })); section.append(button);
    }
    el('drafts').append(section);
  }
}
async function perform(action) { try { await action(); el('status').textContent = '완료'; } catch (error) { el('status').textContent = error.message; } }
el('access').addEventListener('submit', event => { event.preventDefault(); perform(refresh); });
el('publish').addEventListener('click', () => perform(async () => { await call('publish', { id: el('staging').value, version: el('version').value, ...operator(), publicDataReviewed: el('reviewed').checked }); await refresh(); }));
el('rollback').addEventListener('click', () => perform(async () => { await call('rollback', { version: el('version').value, ...operator() }); await refresh(); }));
