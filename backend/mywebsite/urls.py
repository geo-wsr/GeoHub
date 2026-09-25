"""
URL configuration for mywebsite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from web.views import spa_index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('web.api_urls')),
    # django-allauth：第三方登录入口与回调（/accounts/github/login/ 等）
    path('accounts/', include('allauth.urls')),
    # 其余路径交给 Vue SPA 的前端路由
    re_path(r'^(?!static/|media/).*$', spa_index, name='spa'),
]

if settings.DEBUG:
    # 开发环境下由 Django 提供用户上传文件的访问（catch-all 已排除 media/ 前缀）
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
