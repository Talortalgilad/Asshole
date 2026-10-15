import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/heebo/latin-800.css';
import '@fontsource/heebo/hebrew-500.css';
import '@fontsource/heebo/hebrew-800.css';
import '@fontsource/heebo/hebrew-900.css';
import './index.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// שגיאות אסינכרוניות לא מפילות את ה-UI, אבל חשוב שיהיו בלוג
window.addEventListener('unhandledrejection', (e) => console.error('[ui] unhandled rejection', e.reason));

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
