// Devil Downloader Pro - IDM Reverse-Engineered Network Sniffer Service Worker
// Implements IDM's dual-tier media interception architecture:
// 1. webRequest response header listener (MIME-type filtering + Content-Disposition + Range header inspection)
// 2. Tab-level media registry tracking active video streams per tab for instant overlay display

const DEVIL_BRIDGE = "http://127.0.0.1:9654";

// Exact MIME patterns reverse-engineered from IDM (IDMGCExt.crx)
const MEDIA_MIME_PATTERNS = [
  "video/",
  "audio/",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
  "application/dash+xml",
  "application/octet-stream"
];

// File extension patterns monitored by IDM
const MEDIA_EXTENSIONS = [
  ".mp4", ".m4v", ".mkv", ".webm", ".avi", ".flv", ".mov", ".wmv",
  ".ts", ".m3u8", ".mpd", ".mp3", ".m4a", ".aac", ".ogg", ".wav", ".torrent"
];

// Active streams registry indexed by tabId
const tabStreams = new Map();

// Tier 1: Intercept network responses before browser renders or downloads
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;

    let contentType = "";
    let contentLength = 0;
    let contentDisposition = "";

    if (details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const name = h.name.toLowerCase();
        if (name === "content-type") contentType = (h.value || "").toLowerCase();
        else if (name === "content-length") contentLength = parseInt(h.value || "0", 10);
        else if (name === "content-disposition") contentDisposition = h.value || "";
      }
    }

    const url = details.url;
    const lowerUrl = url.toLowerCase().split("?")[0];

    // Check if matching IDM's media definitions
    const isMediaMime = MEDIA_MIME_PATTERNS.some(p => contentType.includes(p));
    const isMediaExt = MEDIA_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
    const isAttachment = contentDisposition.toLowerCase().includes("attachment");

    // Don't capture tiny UI audio sprites (< 30KB)
    if (contentLength > 0 && contentLength < 30 * 1024 && !isMediaExt) {
      return;
    }

    if (isMediaMime || isMediaExt) {
      const tabId = details.tabId;
      if (!tabStreams.has(tabId)) {
        tabStreams.set(tabId, []);
      }

      const streamList = tabStreams.get(tabId);
      if (!streamList.some(s => s.url === url)) {
        let label = "Video Stream";
        let ext = "mp4";

        if (lowerUrl.includes(".m3u8") || contentType.includes("mpegurl")) {
          label = "HLS Stream (m3u8)";
          ext = "m3u8";
        } else if (lowerUrl.includes(".mpd") || contentType.includes("dash")) {
          label = "DASH Stream (mpd)";
          ext = "mpd";
        } else if (lowerUrl.endsWith(".torrent")) {
          label = "BitTorrent Payload";
          ext = "torrent";
        } else {
          for (const e of MEDIA_EXTENSIONS) {
            if (lowerUrl.endsWith(e)) {
              ext = e.replace(".", "");
              label = `${ext.toUpperCase()} Stream`;
              break;
            }
          }
        }

        const sizeStr = contentLength > 0 ? ` (${(contentLength / (1024*1024)).toFixed(1)} MB)` : "";

        streamList.push({
          url: url,
          label: `${label}${sizeStr}`,
          ext: ext,
          size: contentLength,
          timestamp: Date.now()
        });

        // Notify content script in the active tab to render the floating download pill
        chrome.tabs.sendMessage(tabId, {
          type: "DEVIL_STREAM_DETECTED",
          streams: streamList
        }).catch(() => {});
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// Clear registry when tab is closed or navigated
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStreams.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabStreams.delete(tabId);
  }
});

// Responding to content script queries
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_TAB_STREAMS" && sender.tab) {
    const list = tabStreams.get(sender.tab.id) || [];
    sendResponse({ streams: list });
    return true;
  }
});

// Intercept browser native downloads (IDM take-over behavior)
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  if (!downloadItem.url || downloadItem.url.startsWith("blob:") || downloadItem.url.startsWith("data:")) {
    return;
  }

  // Cancel Chrome native download and push directly to Devil Downloader engine
  chrome.downloads.cancel(downloadItem.id, () => {
    chrome.downloads.erase({ id: downloadItem.id });
    sendToDevil(downloadItem.url, false);
  });
});

// Context Menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "devil-download",
    title: "Download with Devil Downloader",
    contexts: ["link", "video", "audio", "image"]
  });

  chrome.contextMenus.create({
    id: "devil-gdrive",
    title: "Direct Stream to Google Drive (Zero Disk)",
    contexts: ["link", "video", "audio"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const targetUrl = info.linkUrl || info.srcUrl;
  if (!targetUrl) return;

  if (info.menuItemId === "devil-download") {
    sendToDevil(targetUrl, false);
  } else if (info.menuItemId === "devil-gdrive") {
    sendToDevil(targetUrl, true);
  }
});

async function sendToDevil(url, toGdrive) {
  try {
    await fetch(`${DEVIL_BRIDGE}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, to_gdrive: toGdrive })
    });
  } catch (err) {
    console.warn("Devil Downloader desktop app is not connected:", err);
  }
}
