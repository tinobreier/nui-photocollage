import { Link } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="landing-container">
      <div className="landing-card">
        <h1>NUI Fotocollage</h1>
        <p>Wähle deinen Gerätetyp</p>
        <div className="landing-buttons">
          <Link to="/phone" className="landing-button">
            <span className="icon">📱</span>
            Smartphone
          </Link>
          <Link to="/tablet" className="landing-button">
            <span className="icon">💻</span>
            Tablet
          </Link>
        </div>
      </div>
    </div>
  )
}

export default App
