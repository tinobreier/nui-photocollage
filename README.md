# PhotoCollage Marker Detection

Web-App zur Erkennung von AprilTag-Markern. Ein Tablet zeigt Marker an, Phones erkennen diese und senden ihre Position zurück.

## Technologien

- **AprilTag WASM** - Marker-Erkennung (tag36h11 Familie)
- **Comlink** - Web Worker Kommunikation
- **Playroom** - Cross-Device Kommunikation (WebSocket/WebRTC)

## Projektstruktur

```
PhotoCollage-Marker/
├── index.html                 # Landing Page
├── phone/index.html           # Phone: Kamera + Marker-Erkennung
├── tablet/index.html          # Tablet: Marker-Anzeige + Glow-Feedback
├── src/
│   ├── phone.js               # Kamera, Detection Loop, UI
│   ├── tablet.js              # Marker Display, Glow-Effekte
│   ├── playroom-communication.js  # Playroom RPC Wrapper
│   └── marker-config.js       # Marker ID → Position Mapping
├── lib/
│   ├── apriltag.js            # WASM Wrapper (Web Worker)
│   ├── apriltag_wasm.js       # WASM Glue Code
│   └── apriltag_wasm.wasm     # AprilTag Detector
└── assets/markers/            # Marker PNGs (ID 0-7)
```

## Marker-Positionen

| ID | Position |
|----|----------|
| 0 | Top-Left |
| 1 | Top-Center |
| 2 | Top-Right |
| 3 | Right-Center |
| 4 | Bottom-Right |
| 5 | Bottom-Center |
| 6 | Bottom-Left |
| 7 | Left-Center |

## Nutzung

Statischen Server lokal starten zum Testen:
```bash
python -m http.server 8080
```

Im Browser:
- **Tablet:** `http://localhost:8080/tablet/`
- **Phone:** `http://localhost:8080/phone/`

Beide verbinden sich automatisch über Playroom (gleicher Room Code).

## Deployment

Kompatibel mit GitHub Pages (kein Backend nötig; TBC).
