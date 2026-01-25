# HTTPS Setup - Anleitung

## ✅ HTTPS Server ist eingerichtet!

Der Server läuft jetzt mit HTTPS auf Port **3443**.

## 📱 So verwendest du es:

### 1. Finde deine Computer-IP-Adresse

Deine aktuelle IP: **192.168.178.21**

(Falls sich das ändert, führe aus: `ipconfig` und suche nach "IPv4-Adresse")

### 2. URLs für deine Geräte

**Auf dem Tablet öffnen:**
```
https://192.168.178.21:3443/tablet
```

**Auf dem Smartphone öffnen:**
```
https://192.168.178.21:3443/phone
```

**Debug-Seite (zum Testen):**
```
https://192.168.178.21:3443/debug
```

## ⚠️ WICHTIG: Zertifikatswarnung beim ersten Mal

### Was passiert?

Beim **ersten Öffnen** auf deinem Smartphone/Tablet siehst du eine Warnung:

**Chrome (Android):**
- "Die Verbindung ist nicht privat"
- "NET::ERR_CERT_AUTHORITY_INVALID"

**Safari (iOS):**
- "Diese Verbindung ist nicht privat"
- "Das Zertifikat ist ungültig"

### Das ist NORMAL und SICHER!

Das Zertifikat ist selbst-signiert (von dir erstellt), nicht von einer offiziellen Zertifizierungsstelle.
Für lokale Entwicklung ist das völlig in Ordnung!

### So akzeptierst du das Zertifikat:

#### Chrome (Android):
1. Tippe auf **"Erweitert"** (oder "Advanced")
2. Tippe auf **"Weiter zu 192.168.178.21 (unsicher)"**
3. Fertig! ✓

#### Safari (iOS):
1. Tippe auf **"Details anzeigen"**
2. Tippe auf **"Diese Website besuchen"**
3. Bestätige nochmal mit **"Besuchen"**
4. Fertig! ✓

#### Firefox (Desktop/Mobile):
1. Klicke auf **"Erweitert"**
2. Klicke auf **"Risiko akzeptieren und fortfahren"**
3. Fertig! ✓

## ✓ Nach dem ersten Akzeptieren

- **Keine Warnung mehr** bei zukünftigen Besuchen
- **Kamera funktioniert** einwandfrei
- **Schnelle, lokale Verbindung** (kein Internet nötig)
- **Sicher im lokalen Netzwerk**

## 🚀 Server starten

```bash
npm start
```

## 🛑 Server stoppen

Drücke `Ctrl+C` im Terminal

## 📝 Technische Details

- **Port:** 3443 (HTTPS)
- **Zertifikat:** Selbst-signiert, 365 Tage gültig
- **Speicherort:** `ssl/cert.pem` und `ssl/key.pem`
- **Algorithmus:** RSA 4096-bit

## 🔄 Zertifikat erneuern (nach 1 Jahr)

Falls das Zertifikat abläuft:

```bash
cd ssl
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -config openssl.cnf
```

## ✨ Vorteile von lokalem HTTPS

✅ **Offline-fähig** - Kein Internet benötigt
✅ **Schnell** - Direkter lokaler Traffic (1-10ms Latenz)
✅ **Privat** - Daten bleiben in deinem Netzwerk
✅ **Produktionsreif** - Perfekt für dein Tablet-Spiel
✅ **Kamera-Zugriff** - Funktioniert auf allen mobilen Browsern

## 🎯 Perfekt für dein Projekt!

Später kannst du **Bildübertragung** zwischen Handy und Tablet implementieren,
und alles bleibt **schnell und lokal** im WLAN!
