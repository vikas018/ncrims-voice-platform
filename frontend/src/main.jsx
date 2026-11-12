import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Theme: default to light; honor a saved toggle choice. Setting data-theme
// explicitly also stops the OS dark-mode preference from overriding us.
document.documentElement.setAttribute('data-theme', localStorage.getItem('ncrims_theme') || 'light');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
