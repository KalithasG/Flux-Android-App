import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite HMR WebSocket errors in the AI Studio environment
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const isBenignError = (msg: any) => {
  if (typeof msg !== 'string') return false;
  return msg.includes('[vite] failed to connect to websocket') ||
         msg.includes('WebSocket closed without opened') ||
         msg.includes('failed to connect to websocket');
};

console.error = (...args) => {
  if (args[0] && isBenignError(args[0])) return;
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  if (args[0] && isBenignError(args[0])) return;
  originalConsoleWarn.apply(console, args);
};

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (
    event.reason.message === 'WebSocket closed without opened' ||
    (typeof event.reason === 'string' && event.reason.includes('WebSocket closed without opened')) ||
    (event.reason.message && event.reason.message.includes('failed to connect to websocket'))
  )) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

window.addEventListener('error', (event) => {
  if (event.message && (
    event.message.includes('WebSocket closed without opened') ||
    event.message.includes('failed to connect to websocket')
  )) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
