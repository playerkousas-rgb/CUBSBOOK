import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { registerPwa } from './pwa.js';

// 被入口白名單攔截時不啟動主介面，亦不註冊可安裝的 Service Worker。
if (!document.documentElement.hasAttribute('data-store-gated')) {
  registerPwa();
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
