// Background service worker for Devil Downloader Chrome Interceptor
const DEVIL_BRIDGE_URL = "http://127.0.0.1:9654";

// Intercept browser native downloads
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

// Context Menu: "Download with Devil Downloader" and "Direct Stream to Google Drive"
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
    await fetch(`${DEVIL_BRIDGE_URL}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url, to_gdrive: toGdrive })
    });
  } catch (err) {
    console.warn("Devil Downloader desktop application is not running on 127.0.0.1:9654:", err);
  }
}
