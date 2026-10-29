// Devil Downloader Pro - IDM-Style Floating Video Panel & Quality Selector
(function() {
  const DEVIL_BRIDGE = "http://127.0.0.1:9654";
  let overlayContainer = null;
  let detectedStreams = [];

  function initOverlay() {
    if (document.getElementById("devil-universal-overlay")) return;

    overlayContainer = document.createElement("div");
    overlayContainer.id = "devil-universal-overlay";
    overlayContainer.style.display = "none";
    overlayContainer.innerHTML = `
      <div id="devil-btn" class="devil-pill">
        <span class="devil-logo">▼</span>
        <span class="devil-text">Download This Video</span>
        <span class="devil-arrow">▾</span>
      </div>
      <div id="devil-dropdown" class="devil-dropdown hidden">
        <div class="devil-header">
          <span class="devil-title" id="devil-video-title">Captured Video Streams</span>
        </div>
        <div class="devil-list" id="devil-quality-list">
          <div class="devil-item loading">Detecting streams...</div>
        </div>
        <div class="devil-footer">
          <label class="devil-toggle">
            <input type="checkbox" id="devil-direct-gdrive">
            <span>Stream Direct to Google Drive</span>
          </label>
        </div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #devil-universal-overlay {
        position: fixed;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
        top: 24px;
        right: 24px;
      }
      .devil-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #0d0d10;
        border: 1px solid rgba(226, 199, 146, 0.45);
        color: #f5eedc;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.85);
        transition: all 0.2s ease;
        font-size: 13px;
        font-weight: 700;
      }
      .devil-pill:hover {
        background: #181119;
        border-color: #e2c792;
        box-shadow: 0 0 18px rgba(226, 199, 146, 0.4);
        transform: translateY(-1px);
      }
      .devil-logo {
        background: linear-gradient(135deg, #e11d48, #be123c);
        color: #f5eedc;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 900;
        border: 1px solid rgba(226, 199, 146, 0.3);
      }
      .devil-dropdown {
        position: absolute;
        top: 44px;
        right: 0;
        width: 290px;
        background: #0d0d10;
        border: 1px solid rgba(226, 199, 146, 0.3);
        border-radius: 10px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.9);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        color: #f5eedc;
      }
      .devil-dropdown.hidden {
        display: none;
      }
      .devil-header {
        padding: 10px 14px;
        background: #18181f;
        border-bottom: 1px solid rgba(245, 238, 220, 0.1);
      }
      .devil-title {
        font-size: 12px;
        font-weight: 700;
        color: #f5eedc;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .devil-list {
        max-height: 240px;
        overflow-y: auto;
        padding: 4px 0;
      }
      .devil-item {
        padding: 10px 14px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.15s;
        color: #f5eedc;
      }
      .devil-item:hover {
        background: rgba(226, 199, 146, 0.15);
        color: #e2c792;
      }
      .devil-item.loading {
        cursor: default;
        color: #a1a1aa;
      }
      .devil-ext {
        font-size: 10px;
        color: #e2c792;
        background: #1c1c24;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
      }
      .devil-footer {
        padding: 10px 14px;
        background: #070709;
        border-top: 1px solid rgba(245, 238, 220, 0.1);
      }
      .devil-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #c5beae;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlayContainer);

    const btn = overlayContainer.querySelector("#devil-btn");
    const dropdown = overlayContainer.querySelector("#devil-dropdown");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
      if (!dropdown.classList.contains("hidden")) {
        renderStreamDropdown();
      }
    });

    document.addEventListener("click", (e) => {
      if (overlayContainer && !overlayContainer.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  // Receive network-sniffed media notifications from background service worker (IDM Tier 1)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "DEVIL_STREAM_DETECTED" && msg.streams) {
      detectedStreams = msg.streams;
      showOverlay();
    }
  });

  // Query background for existing streams on page load
  chrome.runtime.sendMessage({ type: "GET_TAB_STREAMS" }, (resp) => {
    if (resp && resp.streams && resp.streams.length > 0) {
      detectedStreams = resp.streams;
      showOverlay();
    }
  });

  // Track HTML5 video element playback (IDM Tier 2)
  function scanMediaTags() {
    const videos = Array.from(document.querySelectorAll("video"));
    for (const v of videos) {
      const src = v.currentSrc || v.src;
      if (src && !src.startsWith("blob:") && !src.startsWith("data:")) {
        if (!detectedStreams.some(s => s.url === src)) {
          detectedStreams.push({
            url: src,
            label: `HTML5 Video (${v.videoWidth || "Auto"}x${v.videoHeight || ""})`,
            ext: "mp4"
          });
          showOverlay();
        }
      }
    }

    // Always active on YouTube, Vimeo, Dailymotion, TikTok watch pages
    const isKnownPlatform = ["youtube.com/watch", "vimeo.com", "tiktok.com", "dailymotion.com"].some(p => window.location.href.includes(p));
    if (isKnownPlatform) {
      showOverlay();
    }
  }

  function showOverlay() {
    if (!overlayContainer) initOverlay();
    overlayContainer.style.display = "block";
  }

  function renderStreamDropdown() {
    const list = document.getElementById("devil-quality-list");
    const titleEl = document.getElementById("devil-video-title");
    titleEl.textContent = document.title.replace(" - YouTube", "") || "Detected Video";
    list.innerHTML = "";

    // If we have network-sniffed streams, show them first
    if (detectedStreams.length > 0) {
      detectedStreams.forEach(stream => {
        const item = document.createElement("div");
        item.className = "devil-item";
        item.innerHTML = `
          <span>${stream.label}</span>
          <span class="devil-ext">${stream.ext.toUpperCase()}</span>
        `;
        item.addEventListener("click", () => {
          const toGdrive = document.getElementById("devil-direct-gdrive").checked;
          startDownload(stream.url, "direct", toGdrive);
          document.getElementById("devil-dropdown").classList.add("hidden");
        });
        list.appendChild(item);
      });
    }

    // Also include Universal yt-dlp dynamic resolutions
    const presets = [
      { format_id: "bestvideo+bestaudio/best", label: "Best Available (Highest)", ext: "mp4" },
      { format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]", label: "1080p Full HD", ext: "mp4" },
      { format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]", label: "720p HD", ext: "mp4" },
      { format_id: "bestaudio/best", label: "Audio Only (MP3)", ext: "m4a" }
    ];

    presets.forEach(p => {
      const item = document.createElement("div");
      item.className = "devil-item";
      item.innerHTML = `
        <span>${p.label}</span>
        <span class="devil-ext">${p.ext.toUpperCase()}</span>
      `;
      item.addEventListener("click", () => {
        const toGdrive = document.getElementById("devil-direct-gdrive").checked;
        startDownload(window.location.href, p.format_id, toGdrive);
        document.getElementById("devil-dropdown").classList.add("hidden");
      });
      list.appendChild(item);
    });
  }

  async function startDownload(url, formatId, toGdrive) {
    try {
      await fetch(`${DEVIL_BRIDGE}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url,
          format_id: formatId,
          to_gdrive: toGdrive
        })
      });
      showNotification("Download started in Devil Downloader!");
    } catch (e) {
      alert("Unable to communicate with Devil Downloader app. Please ensure it is running.");
    }
  }

  function showNotification(msg) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0d0d10;
      border: 1px solid #e2c792;
      color: #f5eedc;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      z-index: 2147483647;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  initOverlay();
  setInterval(scanMediaTags, 1500);
})();
