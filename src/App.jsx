import './App.css'

function App() {
  const navigate = (route) => {
    window.location.hash = '/' + route
  }

  return (
    <div className="landing-container">
      <div className="landing-card">
        <h1>NUI Fotocollage</h1>
        <p>Wähle deinen Gerätetyp</p>
        <div className="landing-buttons">
          <button onClick={() => navigate('phone')} className="landing-button">
            <span className="icon">📱</span>
            Smartphone
          </button>
          <button onClick={() => navigate('tablet')} className="landing-button">
            <span className="icon">💻</span>
            Tablet
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
