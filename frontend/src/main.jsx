import { StrictMode } from 'react';
import { preload } from 'react-dom';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { HERO_IMAGE_URL } from './lib/product';
import './index.css';

// The home page chunk loads after this script, so the hero's LCP request starts here.
if (window.location.pathname === '/') {
  preload(HERO_IMAGE_URL, { as: 'image', fetchPriority: 'high' });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
