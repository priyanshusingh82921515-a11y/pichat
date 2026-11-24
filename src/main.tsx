import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({immediate: true});
  } catch {
    // Ignore service worker restrictions in embedded contexts
  }
}

createRoot(document.getElementById('root')!).render(<App />);
