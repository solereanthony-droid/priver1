import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/caprasimo/400.css';
import '@fontsource-variable/figtree';
import './styles/organic.css';
import './styles/handoff.css';
import './styles/app.css';
import './claude.js';
import App from './app/App.jsx';

createRoot(document.getElementById('root')).render(<App />);
