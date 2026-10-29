// Content script that injects the floating "Download Video" widget on ANY website playing videos
(function() {
  const DEVIL_BRIDGE = "http://127.0.0.1:9654";
  let overlayContainer = null;
  let activeVideoElement = null;

  function initOverlay() {
    if (document.getElementById("devil-universal-overlay")) return;

    overlayContainer = document.createElement("div");
    overlayContainer.id = "devil-universal-overlay";
    overlayContainer.style.display = "none";
    overlayContainer.innerHTML = `
      <div id="devil-btn" class="devil-pill">
        <span class="devil-logo">▼</span>
        <span class="devil-text">Download Video</span>
        <span class="devil-arrow">▾</span>
      </div>
      <div id="devil-dropdown" class="devil-dropdown hidden">
        <div class="devil-header">
          <span class="devil-title" id="devil-video-title">Detected Video Stream</span>
        </div>
        <div class="devil-list" id="devil-quality-list">
          <div class="devil-item loading">Scanning formats...</div>
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
      }
      .devil-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #0d0d10;
        border: 1px solid rgba(226, 199, 146, 0.4);
        color: #f5eedc;
        padding: 7px 14px;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        transition: all 0.2s ease;
        font-size: 13px;
        font-weight: 700;
      }
      .devil-pill:hover {
        background: #181119;
        border-color: #e2c792;
        box-shadow: 0 0 16px rgba(226, 199, 146, 0.35);
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
        top: 40px;
        right: 0;
        width: 270px;
        background: #0d0d10;
        border: 1px solid rgba(226, 199, 146, 0.3);
        border-radius: 10px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.85);
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
        max-height: 220px;
        overflow-y: auto;
        padding: 4px 0;
      }
      .devil-item {
        padding: 9px 14px;
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
        loadQualities();
      }
    });

    document.addEventListener("click", (e) => {
      if (overlayContainer && !overlayContainer.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  // Scan and hook into ANY HTML5 video playing on ANY website
  function trackPlayingVideos() {
    const videos = Array.from(document.querySelectorAll("video"));
    let visibleVideo = null;

    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 120 && rect.top < window.innerHeight && rect.bottom > 0) {
        visibleVideo = v;
        break;
      }
    }

    if (visibleVideo) {
      activeVideoElement = visibleVideo;
      const rect = visibleVideo.getBoundingClientRect();
      if (overlayContainer) {
        overlayContainer.style.display = "block";
        overlayContainer.style.top = `${Math.max(10, rect.top + 16)}px`;
        overlayContainer.style.left = `${Math.max(10, rect.right - 180)}px`;
      }
    } else if (overlayContainer) {
      // If YouTube watch page, stay active on player
      if (window.location.href.includes("youtube.com/watch")) {
        overlayContainer.style.display = "block";
        overlayContainer.style.top = "18px";
        overlayContainer.style.right = "18px";
        overlayContainer.style.left = "auto";
      } else {
        overlayContainer.style.display = "none";
      }
    }
  }

  function renderQualities(title, qualities) {
    const list = document.getElementById("devil-quality-list");
    const titleEl = document.getElementById("devil-video-title");
    titleEl.textContent = title;
    list.innerHTML = "";

    qualities.forEach(q => {
      const item = document.createElement("div");
      item.className = "devil-item";
      item.innerHTML = `
        <span>${q.label}</span>
        <span class="devil-ext">${q.ext.toUpperCase()}</span>
      `;
      item.addEventListener("click", () => {
        const toGdrive = document.getElementById("devil-direct-gdrive").checked;
        const targetUrl = q.direct_url || window.location.href;
        startDownload(targetUrl, q.format_id, toGdrive);
        document.getElementById("devil-dropdown").classList.add("hidden");
      });
      list.appendChild(item);
    });
  }

  function getDefaultPresetQualities() {
    return [
      { format_id: "bestvideo+bestaudio/best", label: "Best Available (Highest)", ext: "mp4" },
      { format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]", label: "1080p (Full HD)", ext: "mp4" },
      { format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]", label: "720p (HD)", ext: "mp4" },
      { format_id: "bestvideo[height<=480]+bestaudio/best[height<=480]", label: "480p (SD)", ext: "mp4" },
      { format_id: "bestaudio/best", label: "Audio Only (MP3 / M4A)", ext: "m4a" }
    ];
  }

  async function loadQualities() {
    const currentUrl = (activeVideoElement && activeVideoElement.src && !activeVideoElement.src.startsWith("blob:")) 
      ? activeVideoElement.src 
      : window.location.href;

    const pageTitle = document.title || "Web Video";
    renderQualities(pageTitle, getDefaultPresetQualities());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(`${DEVIL_BRIDGE}/video-formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (data && data.success && data.qualities && data.qualities.length > 0) {
        renderQualities(data.title || pageTitle, data.qualities);
      }
    } catch (e) {
      // Preserve default resolutions
    }
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
      showNotification("Video queued in Devil Downloader!");
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
  setInterval(trackPlayingVideos, 1000);
})();
