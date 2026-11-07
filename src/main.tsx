import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center', padding: 16 }}>
      <div>
        <h1>Liangshan: 108 Stars</h1>
        <p>Liangshan: 108 Stars — engine in progress</p>
        <p style={{ opacity: 0.7, fontSize: 14 }}>Unofficial, non-commercial fan project. By evilgouki.</p>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
