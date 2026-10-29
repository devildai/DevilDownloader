# Universal Video Resolver for ANY website (HTML5 Video, HLS/m3u8, MP4, DASH, Embeds, yt-dlp)
import re
import json
import urllib.parse
import yt_dlp
import requests
from bs4 import BeautifulSoup

def get_universal_video_formats(url):
    """
    Universal extractor:
    1. If URL is a direct media file (.mp4, .m3u8, .webm, .mkv), returns direct download option.
    2. Runs generic yt-dlp extractor (supports 1000+ streaming sites).
    3. If yt-dlp doesn't yield streams, parses page HTML for <video src="...">, <source src="...">,
       iframe embeds, and m3u8 playlist regex matches.
    """
    parsed = urllib.parse.urlparse(url)
    lower_path = parsed.path.lower()

    # Direct media links
    if any(lower_path.endswith(ext) for ext in [".mp4", ".m3u8", ".webm", ".mkv", ".mov", ".flv", ".mp3", ".m4a"]):
        fname = parsed.path.split("/")[-1] or "video_stream.mp4"
        return {
            "success": True,
            "title": fname,
            "thumbnail": "",
            "qualities": [
                {
                    "format_id": "direct",
                    "label": "Direct Video Stream",
                    "ext": fname.split(".")[-1],
                    "is_audio_only": False,
                    "direct_url": url
                }
            ]
        }

    # Generic yt-dlp extractor across ANY video website
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info:
                title = info.get('title') or "Web Video"
                raw_formats = info.get('formats', [])
                qualities = []
                seen_res = set()

                qualities.append({
                    "format_id": "bestvideo+bestaudio/best",
                    "label": "Best Available (Highest)",
                    "ext": "mp4",
                    "is_audio_only": False
                })

                for f in sorted(raw_formats, key=lambda x: (x.get('height') or 0), reverse=True):
                    h = f.get('height')
                    if h and h not in seen_res:
                        seen_res.add(h)
                        qualities.append({
                            "format_id": f.get('format_id') or f"bestvideo[height<={h}]+bestaudio/best[height<={h}]",
                            "label": f"{h}p HD",
                            "ext": f.get('ext') or "mp4",
                            "is_audio_only": False
                        })

                qualities.append({
                    "format_id": "bestaudio/best",
                    "label": "Audio Only (MP3/M4A)",
                    "ext": "m4a",
                    "is_audio_only": True
                })

                if len(qualities) > 1:
                    return {
                        "success": True,
                        "title": title,
                        "thumbnail": info.get('thumbnail', ''),
                        "qualities": qualities
                    }
    except Exception:
        pass

    # HTML5 Scraper Fallback: Scrapes video tags, sources, and m3u8 playlists
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=8)
        if resp.status_code == 200:
            html = resp.text
            soup = BeautifulSoup(html, "html.parser")
            page_title = soup.title.string.strip() if soup.title else "Web Video"

            video_urls = []
            # Find <video src="...">
            for v in soup.find_all("video"):
                if v.get("src"):
                    video_urls.append(urllib.parse.urljoin(url, v.get("src")))
                for s in v.find_all("source"):
                    if s.get("src"):
                        video_urls.append(urllib.parse.urljoin(url, s.get("src")))

            # Regex search for m3u8/mp4 URLs in scripts
            matches = re.findall(r'(https?://[^\s"\'<>]+\.(?:m3u8|mp4|webm))', html)
            video_urls.extend(matches)

            unique_urls = list(dict.fromkeys(video_urls))
            if unique_urls:
                qualities = []
                for idx, v_url in enumerate(unique_urls[:5]):
                    ext = v_url.split("?")[0].split(".")[-1]
                    qualities.append({
                        "format_id": "direct",
                        "label": f"Captured Stream #{idx+1} ({ext.upper()})",
                        "ext": ext,
                        "direct_url": v_url,
                        "is_audio_only": False
                    })

                return {
                    "success": True,
                    "title": page_title,
                    "thumbnail": "",
                    "qualities": qualities
                }
    except Exception:
        pass

    # Standard fallback
    return {
        "success": True,
        "title": "Universal Web Video",
        "thumbnail": "",
        "qualities": [
            { "format_id": "bestvideo+bestaudio/best", "label": "Best Quality Video", "ext": "mp4", "is_audio_only": False },
            { "format_id": "bestaudio/best", "label": "Audio Only", "ext": "m4a", "is_audio_only": True }
        ]
    }
