import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error listener for production debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, "at", source, ":", lineno, ":", colno);
  // If the app is blank, we can at least show something
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif;">
      <h2 style="color: #DC2626;">Application Failed to Load</h2>
      <p style="color: #475569;">${message}</p>
      <button onclick="window.location.reload()" style="padding: 8px 16px; background: #1C2B3A; color: white; border: none; border-radius: 8px; cursor: pointer;">Reload</button>
    </div>`;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
