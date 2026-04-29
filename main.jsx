import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './frontend.jsx' // This pulls in your main UI file

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)