# Threaded HTTPServer with video sniffer and task deletion
import json
from socketserver import ThreadingMixIn
from http.server import HTTPServer, BaseHTTPRequestHandler
from app.core.media_resolver import get_universal_video_formats

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class BridgeHandler(BaseHTTPRequestHandler):
    engine = None

    def _set_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/status':
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            tasks = self.engine.get_all_tasks() if self.engine else []
            self.wfile.write(json.dumps({"status": "active", "tasks": tasks}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except Exception:
            data = {}

        if self.path == '/video-formats':
            try:
                url = data.get('url')
                if not url:
                    raise ValueError("URL is required")

                result = get_universal_video_formats(url)
                self.send_response(200)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))

        elif self.path == '/download':
            try:
                url = data.get('url')
                to_gdrive = data.get('to_gdrive', False)
                speed_limit = data.get('speed_limit_kb', 0)
                format_id = data.get('format_id')
                if not url:
                    raise ValueError("URL is required")

                task = self.engine.add_task(url=url, to_gdrive=to_gdrive, speed_limit_kb=speed_limit, format_id=format_id)
                self.send_response(200)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "task": task}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self._set_cors()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))

        elif self.path == '/pause':
            task_id = data.get('id')
            success = self.engine.pause_task(task_id) if (self.engine and task_id) else False
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode('utf-8'))

        elif self.path == '/resume':
            task_id = data.get('id')
            success = self.engine.resume_task(task_id) if (self.engine and task_id) else False
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode('utf-8'))

        elif self.path == '/cancel':
            task_id = data.get('id')
            success = self.engine.cancel_task(task_id) if (self.engine and task_id) else False
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode('utf-8'))

        elif self.path == '/delete':
            task_id = data.get('id')
            delete_disk = data.get('delete_disk_file', True)
            success = self.engine.delete_task(task_id, delete_disk_file=delete_disk) if (self.engine and task_id) else False
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def start_bridge_server(engine, host='127.0.0.1', port=9654):
    import threading
    BridgeHandler.engine = engine
    httpd = ThreadedHTTPServer((host, port), BridgeHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    return httpd
