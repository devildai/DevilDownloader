# Devil Downloader Pro

<div align="center">
  <h3>Next-Generation Multi-Protocol Download Engine with Direct Google Drive Cloud Streaming</h3>
  <p><strong>Crafted with a Luxury Obsidian & Cream Aesthetic</strong></p>
</div>

---

## 🌟 Highlights & Key Features

* **🎨 Luxury Aesthetic**: Deep obsidian tones blended with rich cream-gold accents and real-time backdrop blur.
* **⏸ Full IDM Playback Controls**: Dynamic Segmented Pause, Resume, Play, and Cancel with byte-accurate state tracking.
* **⚡ 8-Part Dynamic Acceleration**: Multi-threaded parallel stream acceleration for HTTP/HTTPS connections with dynamic range-slicing.
* **☁ Zero-Disk Google Drive Cloud Stream**: Route downloads straight into your Google Drive via the Drive v3 Resumable API without using local hard disk space.
* **🎥 Universal Video Sniffer**: Direct video and audio extraction across any website (HTML5, YouTube, Vimeo, embeds) with on-screen quality presets.
* **🧲 BitTorrent Swarm Engine**: Built-in torrent client handling `.torrent` files and `magnet:` URIs via libtorrent swarm connectivity.
* **🌐 Chrome Companion Extension (Manifest V3)**: Auto-intercepts browser downloads and injects a floating in-player quality selector on any website.

---

## 🚀 Quick Start Guide

### 1. Download & Install
Download the latest portable release package (`DevilDownloader-v2.0.0-windows-x64.zip`) from the **[Releases](https://github.com/devildai/DevilDownloader/releases)** page.
Extract the archive and run:
```text
DevilDownloader.exe
```

### 2. Install the Chrome Companion Extension
1. Download `DevilDownloader-ChromeExtension.zip` from **[Releases](https://github.com/devildai/DevilDownloader/releases)** and unzip it into a folder.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the unzipped extension folder.
5. Play any video on any website — click the floating **`[▼] Download Video`** button to download or stream to Google Drive.

---

## 📁 Repository Structure

```text
├── app/
│   ├── core/
│   │   ├── engine.py           # Resumable multi-part, torrent & cloud streamer engine
│   │   ├── bridge.py           # Multi-threaded REST & WebSocket communication bridge
│   │   └── media_resolver.py   # Universal video sniffer & stream extractor
│   └── ui/
│       └── index.html          # Obsidian & cream user interface
├── chrome_extension/
│   ├── manifest.json           # Chrome Manifest V3
│   ├── background.js           # Native download interceptor & context menus
│   ├── content.js              # Universal floating video grabber overlay
│   └── popup.html              # Quick link and magnet capture toolbar
├── run_tests.py                # Comprehensive verification & unit test suite
└── main.py                     # Native desktop entry point (pywebview)
```

---

## 🏆 Credits & Acknowledgments

* **[AB Download Manager (amir1376)](https://github.com/amir1376/ab-download-manager)** — Core architectural inspiration and open-source foundation.
* **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Media extraction engine.
* **[libtorrent](https://github.com/libtorrent)** — BitTorrent engine.
* **[pywebview](https://pywebview.flowrl.com/)** — Lightweight native desktop renderer.
* **[Google APIs Client Library](https://github.com/googleapis/google-api-python-client)** — Direct chunked cloud stream integration.

---

## 📜 License
Distributed under the Apache-2.0 License.
