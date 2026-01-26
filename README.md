# PhotoCollage Marker Detection

Natural User Interface (NUI) zur gemeinsamen Gestaltung einer Fotocollage, umgesetzt als Web-App. Ermöglicht das mühelose Einbringen von Bildern auf spontane Art und Weise, um eine natürliche Kommunikationssituation unter Kollaborateuren zu erzeugen.  

Zur Erkennung der Sitz-/Stehposition werden AprilTag-Marker verwendet, die von den Smartphones der Kollaborateure kurz eingefangen werden.

## Technologien

- **AprilTag WASM** - Marker-Erkennung (tag36h11 Familie; vorkompiliert für schnelle Markerverarbeitung)
- **Comlink** - Web Worker Kommunikation (Kein Blockieren der UI)
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
Beide verbinden sich automatisch über Playroom (gleicher Room Code).

Lokales Testen: `npm run dev -- --host`

Hosting: https://tinobreier.github.io/nui-photocollage/