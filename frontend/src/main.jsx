import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import './gyeongja.css';
import { DEMO } from './config';
import { installMockApi } from './demo/mockApi';

if (DEMO) installMockApi();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
