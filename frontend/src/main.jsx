import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import './gyeongja.css';
import { NO_AI } from './config';
import { installMockApi } from './demo/mockApi';

if (NO_AI) installMockApi();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
