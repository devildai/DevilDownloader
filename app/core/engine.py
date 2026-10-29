# Core download engines: True BitTorrent Swarm Downloading, Universal Video Extractor, Resumable Multi-part, and Zero-Disk Drive Streaming.
import os
import sys
import time
import json
import uuid
import shutil
import threading
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
import requests
import yt_dlp
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google.oauth2.credentials import Credentials
import libtorrent as lt

class CloudStreamUploader:
    def __init__(self, service, filename, file_size=None, mime_type="application/octet-stream", parent_id=None):
        self.service = service
        self.filename = filename
        self.file_size = file_size
        self.mime_type = mime_type
        self.parent_id = parent_id
        self.uploaded_bytes = 0

    def stream_from_response(self, response_stream, progress_callback=None):
        file_metadata = {'name': self.filename}
        if self.parent_id:
            file_metadata['parents'] = [self.parent_id]

        class IterableStream:
            def __init__(self, resp_iter, parent):
                self.resp_iter = resp_iter
                self.parent = parent
                self._buffer = b""

            def read(self, size=-1):
                chunk = b""
                try:
                    if size <= 0:
                        chunk = next(self.resp_iter)
                    else:
                        while len(self._buffer) < size:
                            data = next(self.resp_iter)
                            self._buffer += data
                        chunk = self._buffer[:size]
                        self._buffer = self._buffer[size:]
                except StopIteration:
                    chunk = self._buffer
                    self._buffer = b""
                
                if chunk:
                    self.parent.uploaded_bytes += len(chunk)
                    if progress_callback:
                        progress_callback(self.parent.uploaded_bytes)
                return chunk

        media = MediaIoBaseUpload(
            IterableStream(response_stream.iter_content(chunk_size=512 * 1024), self),
            mimetype=self.mime_type,
            resumable=True
        )
        file = self.service.files().create(body=file_metadata, media_body=media, fields='id, name, webViewLink').execute()
        return file


class DownloadTask:
    def __init__(self, task_id, url, target_type="local", destination="", to_gdrive=False, gdrive_token=None, speed_limit_kb=0, format_id=None):
        self.id = task_id
        self.url = url
        self.target_type = target_type # "http", "media", "torrent"
        self.destination = destination
        self.to_gdrive = to_gdrive
        self.gdrive_token = gdrive_token
        self.speed_limit_kb = speed_limit_kb
        self.format_id = format_id
        self.status = "queued" # queued, downloading, paused, completed, error
        self.progress = 0.0
        self.speed_str = "0 KB/s"
        self.downloaded_bytes = 0
        self.total_bytes = 0
        self.filename = ""
        self.filepath = ""
        self.error_msg = ""
        self.part_paths = []
        self._cancel_requested = False
        self._pause_requested = False
        self._torrent_handle = None

    def to_dict(self):
        return {
            "id": self.id,
            "url": self.url,
            "target_type": self.target_type,
            "destination": self.destination,
            "to_gdrive": self.to_gdrive,
            "speed_limit_kb": self.speed_limit_kb,
            "status": self.status,
            "progress": round(self.progress, 1),
            "speed_str": self.speed_str,
            "downloaded_bytes": self.downloaded_bytes,
            "total_bytes": self.total_bytes,
            "filename": self.filename,
            "error_msg": self.error_msg
        }


class DownloadManagerEngine:
    def __init__(self, default_download_dir=None):
        if not default_download_dir:
            self.default_download_dir = os.path.join(os.path.expanduser("~"), "Downloads")
        else:
            self.default_download_dir = default_download_dir

        os.makedirs(self.default_download_dir, exist_ok=True)
        self.tasks = {}
        self.gdrive_credentials_cache = None
        self._lock = threading.Lock()

        # Initialize global BitTorrent session
        self.lt_session = lt.session({'listen_interfaces': '0.0.0.0:6881'})

    def set_gdrive_token(self, token_data):
        try:
            if isinstance(token_data, str):
                token_data = json.loads(token_data)
            self.gdrive_credentials_cache = token_data
            return True
        except Exception:
            return False

    def detect_task_type(self, url):
        url_lower = url.lower()
        if url_lower.startswith("magnet:") or url_lower.endswith(".torrent") or "torrent" in url_lower:
            return "torrent"
        # Known streaming platforms or video URLs
        media_indicators = ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "instagram.com", "twitter.com", "x.com", "facebook.com", "dailymotion.com", ".m3u8", ".mp4"]
        if any(d in url_lower for d in media_indicators):
            return "media"
        return "http"

    def add_task(self, url, destination=None, to_gdrive=False, speed_limit_kb=0, format_id=None):
        task_id = str(uuid.uuid4())[:8]
        target_type = self.detect_task_type(url)
        dest = destination if destination else self.default_download_dir

        task = DownloadTask(
            task_id=task_id,
            url=url,
            target_type=target_type,
            destination=dest,
            to_gdrive=to_gdrive,
            gdrive_token=self.gdrive_credentials_cache,
            speed_limit_kb=speed_limit_kb,
            format_id=format_id
        )

        with self._lock:
            self.tasks[task_id] = task

        self._start_task_thread(task)
        return task.to_dict()

    def _start_task_thread(self, task):
        task._cancel_requested = False
        task._pause_requested = False
        thread = threading.Thread(target=self._run_task_worker, args=(task,), daemon=True)
        thread.start()

    def pause_task(self, task_id):
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                if task.status == "downloading":
                    task._pause_requested = True
                    if task._torrent_handle:
                        task._torrent_handle.pause()
                    task.status = "paused"
                    task.speed_str = "Paused"
                    return True
        return False

    def resume_task(self, task_id):
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                if task.status in ("paused", "error"):
                    if task._torrent_handle:
                        task._torrent_handle.resume()
                        task.status = "downloading"
                    else:
                        task.status = "queued"
                        task.error_msg = ""
                        self._start_task_thread(task)
                    return True
        return False

    def cancel_task(self, task_id):
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task._cancel_requested = True
                if task._torrent_handle:
                    self.lt_session.remove_torrent(task._torrent_handle)
                    task._torrent_handle = None
                task.status = "cancelled"
                task.speed_str = "Cancelled"
                return True
        return False

    def delete_task(self, task_id, delete_disk_file=True):
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                self.cancel_task(task_id)

                # Wipe intermediate .part chunks
                if hasattr(task, 'part_paths'):
                    for p in task.part_paths:
                        if os.path.exists(p):
                            try: os.remove(p)
                            except: pass

                # Wipe complete downloaded file on disk if requested
                if delete_disk_file and task.filepath and os.path.exists(task.filepath):
                    try:
                        if os.path.isdir(task.filepath):
                            shutil.rmtree(task.filepath, ignore_errors=True)
                        else:
                            os.remove(task.filepath)
                    except Exception as e:
                        print(f"Error removing {task.filepath}: {e}")

                del self.tasks[task_id]
                return True
        return False

    def get_all_tasks(self):
        with self._lock:
            return [task.to_dict() for task in self.tasks.values()]

    def _run_task_worker(self, task):
        try:
            task.status = "downloading"
            if task.to_gdrive and task.gdrive_token:
                self._download_direct_to_gdrive(task)
            elif task.target_type == "media":
                self._download_media_universal(task)
            elif task.target_type == "torrent":
                self._download_torrent_swarm(task)
            else:
                self._download_http_multipart(task)
        except Exception as e:
            if not task._pause_requested and not task._cancel_requested:
                task.status = "error"
                task.error_msg = str(e)

    def _download_torrent_swarm(self, task):
        """Downloads actual files from BitTorrent swarm using libtorrent."""
        task.filename = "Fetching Torrent Metadata..."
        params = lt.add_torrent_params()
        params.save_path = task.destination

        # If HTTP URL to .torrent file, download file first to parse metadata
        if task.url.startswith("http://") or task.url.startswith("https://"):
            torrent_temp = os.path.join(task.destination, f"temp_{task.id}.torrent")
            r = requests.get(task.url, timeout=15)
            with open(torrent_temp, "wb") as f:
                f.write(r.content)
            info = lt.torrent_info(torrent_temp)
            params.ti = info
            try: os.remove(torrent_temp)
            except: pass
        elif task.url.startswith("magnet:"):
            params = lt.parse_magnet_uri(task.url)
            params.save_path = task.destination
        elif os.path.exists(task.url):
            info = lt.torrent_info(task.url)
            params.ti = info

        handle = self.lt_session.add_torrent(params)
        task._torrent_handle = handle

        # Wait for metadata resolution
        while not handle.has_metadata():
            if task._cancel_requested:
                self.lt_session.remove_torrent(handle)
                return
            time.sleep(0.5)

        ti = handle.torrent_info()
        task.filename = ti.name()
        task.filepath = os.path.join(task.destination, ti.name())
        task.total_bytes = ti.total_size()

        # Swarm Download loop
        while not task._cancel_requested:
            s = handle.status()
            task.downloaded_bytes = s.total_done
            if task.total_bytes > 0:
                task.progress = min(100.0, (s.total_done / task.total_bytes) * 100.0)

            speed_mb = s.download_rate / (1024 * 1024)
            task.speed_str = f"{speed_mb:.2f} MB/s ({s.num_peers} peers)"

            if s.is_seeding or s.progress >= 1.0:
                task.progress = 100.0
                task.status = "completed"
                task.speed_str = "Seeding/Finished"
                break

            time.sleep(1)

    def _download_media_universal(self, task):
        def ytdl_hook(d):
            if task._pause_requested or task._cancel_requested:
                raise Exception("Cancelled")
            if d.get('status') == 'downloading':
                task.downloaded_bytes = d.get('downloaded_bytes', 0)
                task.total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                if task.total_bytes > 0:
                    task.progress = (task.downloaded_bytes / task.total_bytes) * 100.0
                spd = d.get('speed') or 0
                task.speed_str = f"{(spd / (1024*1024)):.2f} MB/s" if spd else "Downloading"
                fn = d.get('filename', '')
                if fn:
                    task.filename = os.path.basename(fn)
                    task.filepath = fn
            elif d.get('status') == 'finished':
                task.progress = 100.0
                task.status = "completed"
                task.speed_str = "Finished"

        ydl_opts = {
            'outtmpl': os.path.join(task.destination, '%(title)s.%(ext)s'),
            'progress_hooks': [ytdl_hook],
            'quiet': True,
            'no_warnings': True
        }
        if task.format_id and task.format_id != "direct":
            ydl_opts['format'] = task.format_id

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([task.url])

    def _download_direct_to_gdrive(self, task):
        creds = Credentials.from_authorized_user_info(task.gdrive_token)
        service = build('drive', 'v3', credentials=creds)

        head = requests.head(task.url, allow_redirects=True, timeout=15)
        content_len = int(head.headers.get('content-length', 0))
        task.total_bytes = content_len

        fname = os.path.basename(urllib.parse.urlparse(head.url).path)
        if not fname or "." not in fname:
            fname = f"download_{task.id}.bin"
        task.filename = fname

        start_time = time.time()
        last_logged = start_time
        bytes_at_last_log = 0

        def progress_cb(current_bytes):
            nonlocal last_logged, bytes_at_last_log
            if task._pause_requested or task._cancel_requested:
                raise Exception("Task paused/cancelled")
            task.downloaded_bytes = current_bytes
            if task.total_bytes > 0:
                task.progress = min(100.0, (current_bytes / task.total_bytes) * 100.0)
            now = time.time()
            elapsed = now - last_logged
            if elapsed >= 0.75:
                speed_bps = (current_bytes - bytes_at_last_log) / elapsed
                task.speed_str = f"{(speed_bps / (1024*1024)):.2f} MB/s -> GDrive"
                last_logged = now
                bytes_at_last_log = current_bytes

        uploader = CloudStreamUploader(service, task.filename, file_size=content_len)
        resp = requests.get(task.url, stream=True, timeout=30)
        resp.raise_for_status()
        uploader.stream_from_response(resp, progress_callback=progress_cb)
        task.progress = 100.0
        task.status = "completed"
        task.speed_str = "Uploaded to Drive"

    def _download_http_multipart(self, task, num_parts=8):
        head = requests.head(task.url, allow_redirects=True, timeout=15)
        task.total_bytes = int(head.headers.get('content-length', 0))
        fname = os.path.basename(urllib.parse.urlparse(head.url).path)
        if not fname or "." not in fname:
            fname = f"download_{task.id}.bin"
        task.filename = fname
        dest_filepath = os.path.join(task.destination, fname)
        task.filepath = dest_filepath

        accept_ranges = "bytes" in head.headers.get("accept-ranges", "").lower()
        if not accept_ranges or task.total_bytes <= 0:
            self._download_single_stream(task, dest_filepath)
            return

        part_size = task.total_bytes // num_parts
        part_ranges = []
        task.part_paths = []
        for i in range(num_parts):
            start = i * part_size
            end = (start + part_size - 1) if i < (num_parts - 1) else (task.total_bytes - 1)
            part_path = f"{dest_filepath}.part{i}"
            part_ranges.append((start, end, part_path))
            task.part_paths.append(part_path)

        part_progress = [0] * num_parts
        for i, (start, end, part_path) in enumerate(part_ranges):
            if os.path.exists(part_path):
                part_progress[i] = os.path.getsize(part_path)

        start_time = time.time()
        last_logged = start_time
        bytes_at_last_log = sum(part_progress)

        def download_part(index, start, end, part_path):
            existing = 0
            if os.path.exists(part_path):
                existing = os.path.getsize(part_path)

            if existing >= (end - start + 1):
                part_progress[index] = existing
                return

            part_start = start + existing
            headers = {"Range": f"bytes={part_start}-{end}"}

            with requests.get(task.url, headers=headers, stream=True, timeout=20) as r:
                if r.status_code in (200, 206):
                    mode = "ab" if existing > 0 else "wb"
                    with open(part_path, mode) as f:
                        for chunk in r.iter_content(chunk_size=64 * 1024):
                            if task._pause_requested or task._cancel_requested:
                                return
                            if chunk:
                                f.write(chunk)
                                part_progress[index] += len(chunk)
                                total_dl = sum(part_progress)
                                task.downloaded_bytes = total_dl
                                task.progress = min(100.0, (total_dl / task.total_bytes) * 100.0)

        def speed_monitor():
            nonlocal last_logged, bytes_at_last_log
            while task.status == "downloading" and not task._pause_requested and not task._cancel_requested:
                time.sleep(0.5)
                now = time.time()
                elapsed = now - last_logged
                if elapsed > 0:
                    current_bytes = sum(part_progress)
                    speed_bps = (current_bytes - bytes_at_last_log) / elapsed
                    task.speed_str = f"{(speed_bps / (1024 * 1024)):.2f} MB/s"
                    last_logged = now
                    bytes_at_last_log = current_bytes

        monitor_thread = threading.Thread(target=speed_monitor, daemon=True)
        monitor_thread.start()

        with ThreadPoolExecutor(max_workers=num_parts) as executor:
            futures = [executor.submit(download_part, i, s, e, p) for i, (s, e, p) in enumerate(part_ranges)]
            for fut in futures:
                fut.result()

        if task._pause_requested:
            task.status = "paused"
            task.speed_str = "Paused"
            return

        if task._cancel_requested:
            for _, _, part_path in part_ranges:
                if os.path.exists(part_path):
                    os.remove(part_path)
            return

        task.speed_str = "Merging parts..."
        with open(dest_filepath, "wb") as final_file:
            for _, _, part_path in part_ranges:
                if os.path.exists(part_path):
                    with open(part_path, "rb") as pf:
                        while chunk := pf.read(1024 * 1024):
                            final_file.write(chunk)
                    os.remove(part_path)

        task.progress = 100.0
        task.status = "completed"
        task.speed_str = "Done"

    def _download_single_stream(self, task, dest_filepath):
        with requests.get(task.url, stream=True, timeout=20) as r:
            r.raise_for_status()
            with open(dest_filepath, "wb") as f:
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    if task._pause_requested or task._cancel_requested:
                        return
                    if chunk:
                        f.write(chunk)
                        task.downloaded_bytes += len(chunk)
                        if task.total_bytes > 0:
                            task.progress = (task.downloaded_bytes / task.total_bytes) * 100.0
        task.progress = 100.0
        task.status = "completed"
        task.speed_str = "Done"
