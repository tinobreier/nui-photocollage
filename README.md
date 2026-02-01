# PhotoCollage Marker Detection

Natural User Interface (NUI) zur gemeinsamen Gestaltung einer Fotocollage, umgesetzt als Web-App. Ermöglicht das mühelose Einbringen von Bildern auf spontane Art und Weise, um eine natürliche Kommunikationssituation unter Kollaborateuren zu erzeugen.  

Zur Erkennung der Sitz-/Stehposition werden AprilTag-Marker verwendet, die von den Smartphones der Kollaborateure kurz eingefangen werden. Playroom sorgt für die Konnektivität.

## Technologien

- **AprilTag WASM** - Marker-Erkennung (tag36h11 Familie; vorkompiliert für schnelle Markerverarbeitung)
- **Comlink** - Web Worker Kommunikation (Kein Blockieren der UI)
- **Playroom** - Cross-Device Kommunikation (WebSocket/WebRTC)


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
(Deploy via `npm run deploy`. Im GitHub muss unter `Settings > Pages` der Branch "playroom" ausgewählt sein.)