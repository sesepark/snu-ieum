import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { parseUrl, useExplore } from './state';
useExplore.getState().restore(parseUrl(window.location.hash.split('?')[1] || '', useExplore.getState().view));
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><HashRouter><App /></HashRouter></QueryClientProvider></React.StrictMode>);
