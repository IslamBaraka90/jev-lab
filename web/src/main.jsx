import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
