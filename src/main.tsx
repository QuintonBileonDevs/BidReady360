import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerPWA } from './pwa';

console.log("BidReady360 build gate-v2 2026-10-25");

registerPWA();

createRoot(document.getElementById('root')!).render(<App />);
