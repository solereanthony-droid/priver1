import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/caprasimo/400.css';
import '@fontsource-variable/figtree';
import './styles/organic.css';
import './styles/app.css';
import './claude.js';
import App from './app/logic.js';

createRoot(document.getElementById('root')).render(<App />);

// Mode hors ligne (build de production uniquement).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
