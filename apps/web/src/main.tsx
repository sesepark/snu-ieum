import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { parseSnapshot, graph } from '@ieum/catalog';
import seed from '../../../data/prototype.json';
import Map from './Map';
const s = parseSnapshot(seed);
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
function Prototype() { const [view, setView] = React.useState<'2d' | '3d'>('2d'); return <main style={{ height: '100vh' }}><h1>서울대 이음 · 지도 시제품</h1><button onClick={() => setView(view === '2d' ? '3d' : '2d')}>2D / 3D 전환</button><div style={{ height: '80vh', position: 'relative' }}><Map graph={graph(s, { q: '', kinds: [], departmentIds: [] })} departments={s.departments} view={view} highlighted={new Set()} searching={false} onSelect={() => {}} onFallback={() => setView('2d')} /></div></main>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><HashRouter><Prototype /></HashRouter></QueryClientProvider></React.StrictMode>);
