// Global error listener for production debugging - MUST BE AT THE VERY TOP
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, "at", source, ":", lineno, ":", colno);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 40px; text-align: center; font-family: system-ui, -apple-system, sans-serif; background: #FEF2F2; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 400px; border: 1px solid #FCA5A5;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h2 style="color: #991B1B; margin: 0 0 8px 0; font-size: 20px;">Application Error</h2>
        <p style="color: #7F1D1D; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">${message}</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #1C2B3A; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">Try Reloading</button>
      </div>
    </div>`;
  }
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
