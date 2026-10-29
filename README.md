# Devil Downloader Pro

<div align="center">
  <h3>Next-Generation Multi-Protocol Download Engine with Direct Google Drive Cloud Streaming</h3>
  <p><strong>Crafted with a Premium Black & Cream Glassmorphism Aesthetic</strong></p>
</div>

---

## 🌟 Highlights & Key Features

* **🎨 Luxury Black & Cream Glass UI**: Deep obsidian tones blended with rich cream-gold accents and real-time backdrop blur.
* **⏸ Full IDM Playback Controls**: Dynamic Segmented Pause, Resume, Play, and Cancel with byte-accurate state tracking.
* **⚡ 8-Part Dynamic Acceleration**: Multi-threaded parallel stream acceleration for HTTP/HTTPS connections with dynamic range-slicing.
* **☁ Zero-Disk Google Drive Cloud Stream**: Route downloads straight into your Google Drive via the Drive v3 Resumable API without using a single byte of local hard disk space.
* **🎥 Integrated YouTube & Media Sniffer**: Direct video and audio extraction powered by embedded `yt-dlp` — choose from 1080p, 720p, 480p, or MP3 with instant on-screen presets.
* **🧲 BitTorrent & Magnet Support**: Built-in torrent client handling `.torrent` files and `magnet:` URIs seamlessly.
* **🌐 Chrome Companion Extension (Manifest V3)**: Auto-intercepts browser downloads and injects a floating **`[D] Download ▾`** quality selector directly onto YouTube video players.

---

## 🚀 Quick Start Guide

### 1. Run Devil Downloader
Launch `DevilDownloader.exe` directly from your Desktop or Start Menu:
```powershell
C:\Users\devil\AppData\Local\Programs\DevilDownloader\DevilDownloader.exe
```

### 2. Install the Chrome Companion Extension
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the extension folder:
   ```text
   C:\Users\devil\.gemini\antigravity\scratch\orbit_dm\chrome_extension
   ```
4. Play any video on YouTube — click the **`[D] Download ▾`** pill button to select your desired resolution or check **Stream Direct to Google Drive**.

---

## 📁 Repository Structure

```text
├── app/
│   ├── core/
│   │   ├── engine.py           # Resumable multi-part, torrent & cloud streamer engine
│   │   ├── bridge.py           # Multi-threaded REST & WebSocket communication bridge
│   │   └── media_resolver.py   # Embedded yt-dlp media extraction resolver
│   └── ui/
│       └── index.html          # Black & cream premium glassmorphism interface
├── chrome_extension/
│   ├── manifest.json           # Chrome Manifest V3
│   ├── background.js           # Native download interceptor & context menus
│   ├── content.js              # Floating in-player YouTube resolution dropdown
│   └── popup.html              # Quick link and magnet capture toolbar
├── run_tests.py                # Comprehensive verification & unit test suite
└── main.py                     # Native desktop entry point (pywebview)
```

---

## 🏆 Credits & Acknowledgments

* **[AB Download Manager (amir1376)](https://github.com/amir1376/ab-download-manager)** — Core architectural inspiration and open-source foundation.
* **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Media extraction engine.
* **[libtorrent / torrentp](https://github.com/libtorrent)** — BitTorrent engine.
* **[pywebview](https://pywebview.flowrl.com/)** — Lightweight native desktop renderer.
* **[Google APIs Client Library](https://github.com/googleapis/google-api-python-client)** — Direct chunked cloud stream integration.

---

## 📜 License
Distributed under the Apache-2.0 License.
