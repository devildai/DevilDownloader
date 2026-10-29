// Content script that injects the floating "Download with Devil Downloader" widget onto YouTube video player
(function() {
  const DEVIL_BRIDGE = "http://127.0.0.1:9654";
  let overlayContainer = null;
  let cachedQualities = null;
  let cachedUrl = "";

  function initOverlay() {
    if (document.getElementById("devil-yt-overlay")) return;

    overlayContainer = document.createElement("div");
    overlayContainer.id = "devil-yt-overlay";
    overlayContainer.innerHTML = `
      <div id="devil-btn" class="devil-pill">
        <span class="devil-logo">D</span>
        <span class="devil-text">Download</span>
        <span class="devil-arrow">▾</span>
      </div>
      <div id="devil-dropdown" class="devil-dropdown hidden">
        <div class="devil-header">
          <span class="devil-title" id="devil-video-title">Analyzing video...</span>
        </div>
        <div class="devil-list" id="devil-quality-list">
          <div class="devil-item loading">Fetching available resolutions...</div>
        </div>
        <div class="devil-footer">
          <label class="devil-toggle">
            <input type="checkbox" id="devil-direct-gdrive">
            <span>Stream Direct to Google Drive</span>
          </label>
        </div>
      </div>
    `;

    // Inject styles
    const style = document.createElement("style");
    style.textContent = `
      #devil-yt-overlay {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
      }
      .devil-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(9, 9, 11, 0.9);
        border: 1px solid rgba(239, 68, 68, 0.4);
        backdrop-filter: blur(8px);
        color: #f8fafc;
        padding: 6px 12px;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        transition: all 0.2s ease;
        font-size: 13px;
        font-weight: 700;
      }
      .devil-pill:hover {
        background: rgba(24, 24, 27, 0.98);
        border-color: #ef4444;
        box-shadow: 0 0 14px rgba(239, 68, 68, 0.6);
      }
      .devil-logo {
        background: linear-gradient(135deg, #ef4444, #991b1b);
        color: white;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 900;
        box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
      }
      .devil-dropdown {
        position: absolute;
        top: 36px;
        right: 0;
        width: 250px;
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 10px;
        box-shadow: 0 12px 28px rgba(0,0,0,0.7);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        color: #f8fafc;
      }
      .devil-dropdown.hidden {
        display: none;
      }
      .devil-header {
        padding: 10px 12px;
        background: #141418;
        border-bottom: 1px solid #27272a;
      }
      .devil-title {
        font-size: 12px;
        font-weight: 700;
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .devil-list {
        max-height: 200px;
        overflow-y: auto;
        padding: 4px 0;
      }
      .devil-item {
        padding: 8px 14px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.15s;
      }
      .devil-item:hover {
        background: #18181b;
        color: #ef4444;
      }
      .devil-item.loading {
        cursor: default;
        color: #71717a;
      }
      .devil-ext {
        font-size: 10px;
        color: #a1a1aa;
        background: #27272a;
        padding: 2px 4px;
        border-radius: 3px;
      }
      .devil-footer {
        padding: 8px 12px;
        background: #060608;
        border-top: 1px solid #27272a;
      }
      .devil-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #a1a1aa;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    mountOverlay();

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

  function mountOverlay() {
    const player = document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
    if (player && !player.contains(overlayContainer)) {
      player.appendChild(overlayContainer);
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
        startDownload(q.format_id, toGdrive);
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
    const currentUrl = window.location.href;
    const pageTitle = document.title.replace(" - YouTube", "") || "YouTube Video";

    // If cached for this URL, render immediately
    if (cachedQualities && cachedUrl === currentUrl) {
      renderQualities(pageTitle, cachedQualities);
      return;
    }

    // Immediately show standard resolutions so user is NEVER stuck waiting
    renderQualities(pageTitle, getDefaultPresetQualities());

    // Asynchronously query Devil Downloader backend to enrich with exact dynamic streams
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
        cachedQualities = data.qualities;
        cachedUrl = currentUrl;
        renderQualities(data.title || pageTitle, data.qualities);
      }
    } catch (e) {
      // Keep preset qualities active gracefully without blocking user
    }
  }

  async function startDownload(formatId, toGdrive) {
    try {
      await fetch(`${DEVIL_BRIDGE}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: window.location.href,
          format_id: formatId,
          to_gdrive: toGdrive
        })
      });
      showNotification("Download queued in Devil Downloader!");
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
      background: #ef4444;
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      z-index: 10000000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  setInterval(() => {
    if (window.location.href.includes("watch?v=")) {
      mountOverlay();
      if (!overlayContainer) {
        initOverlay();
      }
      overlayContainer.style.display = "block";
    } else if (overlayContainer) {
      overlayContainer.style.display = "none";
    }
  }, 1000);

  initOverlay();
})();
