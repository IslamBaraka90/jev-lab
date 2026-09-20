import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { startAnalytics } from './lib/analytics.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/pages.css';
import './styles/site.css';
import './styles/demo.css';
import './styles/runtime.css';
import './styles/presenter.css';
import './styles/benchmark.css';
import './styles/home.css';

// Measures the published site only; a clone, a preview build or a fork reports nothing.
startAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
