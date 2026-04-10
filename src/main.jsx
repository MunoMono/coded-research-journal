import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

import '@carbon/styles/css/styles.css'
import '@ibm/plex/css/ibm-plex.min.css'
import './index.scss'

const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
