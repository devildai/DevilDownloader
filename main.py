# Devil Downloader - Main Entry Point with Premium Glass Design & IDM Controls
import os
import sys
import webview
from app.core.engine import DownloadManagerEngine
from app.core.bridge import start_bridge_server

class JsApi:
    def __init__(self, engine):
        self.engine = engine

    def get_tasks(self):
        return self.engine.get_all_tasks()

    def add_download(self, url, to_gdrive=False, speed_limit_kb=0, format_id=None):
        return self.engine.add_task(url=url, to_gdrive=to_gdrive, speed_limit_kb=speed_limit_kb, format_id=format_id)

    def pause_task(self, task_id):
        return self.engine.pause_task(task_id)

    def resume_task(self, task_id):
        return self.engine.resume_task(task_id)

    def cancel_task(self, task_id):
        return self.engine.cancel_task(task_id)

    def delete_task(self, task_id):
        return self.engine.delete_task(task_id)

    def set_drive_token(self, token_json_str):
        return self.engine.set_gdrive_token(token_json_str)

def get_html_content():
    if hasattr(sys, '_MEIPASS'):
        bundle_dir = sys._MEIPASS
    else:
        bundle_dir = os.path.dirname(os.path.abspath(__file__))

    html_path = os.path.join(bundle_dir, "app", "ui", "index.html")
    if not os.path.exists(html_path):
        html_path = os.path.join(bundle_dir, "ui", "index.html")

    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()

    return "<h1>Devil Downloader</h1>"

def main():
    engine = DownloadManagerEngine()
    start_bridge_server(engine, host='127.0.0.1', port=9654)

    html_content = get_html_content()
    api = JsApi(engine)

    window = webview.create_window(
        title="Devil Downloader",
        html=html_content,
        js_api=api,
        width=1040,
        height=700,
        min_size=(840, 520)
    )
    webview.start()

if __name__ == "__main__":
    main()
