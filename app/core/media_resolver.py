# Extract available video formats/qualities dynamically
import json
import yt_dlp

def get_video_formats(url):
    """Fetches video title, thumbnail, and clean list of available resolutions/formats using yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', 'Unknown Title')
            duration = info.get('duration_string', '')
            thumbnail = info.get('thumbnail', '')
            raw_formats = info.get('formats', [])

            # Filter unique video resolutions (1080p, 720p, 480p, 360p, 144p, and Audio-only)
            qualities = []
            seen_res = set()

            # Always add "Best Available"
            qualities.append({
                "format_id": "bestvideo+bestaudio/best",
                "label": "Best Available (Highest)",
                "ext": "mp4",
                "is_audio_only": False
            })

            # Check individual progressive & adaptive streams
            for f in sorted(raw_formats, key=lambda x: (x.get('height') or 0), reverse=True):
                h = f.get('height')
                vcodec = f.get('vcodec', 'none')
                if h and vcodec != 'none' and h not in seen_res:
                    seen_res.add(h)
                    fps = f.get('fps')
                    fps_str = f" {fps}fps" if fps and fps > 30 else ""
                    qualities.append({
                        "format_id": f"bestvideo[height<={h}]+bestaudio/best[height<={h}]",
                        "label": f"{h}p{fps_str}",
                        "ext": "mp4",
                        "height": h,
                        "is_audio_only": False
                    })

            # Add Audio Only (MP3 / M4A)
            qualities.append({
                "format_id": "bestaudio/best",
                "label": "Audio Only (M4A / MP3)",
                "ext": "m4a",
                "is_audio_only": True
            })

            return {
                "success": True,
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "qualities": qualities
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
