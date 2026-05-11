import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import axios from 'axios';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const backendUrl = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:3001' : 'https://flowscope-uaaf.onrender.com');
axios.defaults.baseURL = backendUrl;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
