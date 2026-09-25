from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect

# Vite 构建产物目录
DIST_DIR = Path(settings.BASE_DIR).parent / 'frontend' / 'dist'

# 未构建前端时，前台指向 Vite 开发服务器
DEV_SERVER_URL = 'http://127.0.0.1:5173/'


def spa_index(request, *args, **kwargs):
    """前台入口：已构建则返回 dist/index.html，否则跳转到 Vite 开发服务器。"""
    index_file = DIST_DIR / 'index.html'
    if index_file.exists():
        return HttpResponse(
            index_file.read_text(encoding='utf-8'),
            content_type='text/html; charset=utf-8',
        )
    return HttpResponseRedirect(DEV_SERVER_URL)
