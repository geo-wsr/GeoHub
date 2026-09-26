from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import api

router = DefaultRouter()
router.register('categories', api.CategoryViewSet, basename='category')
router.register('tags', api.TagViewSet, basename='tag')
router.register('materials', api.MaterialViewSet, basename='material')
router.register('comments', api.CommentViewSet, basename='comment')
router.register('favorites', api.FavoriteViewSet, basename='favorite')
router.register('my-comments', api.MyCommentViewSet, basename='my-comment')
router.register('downloads', api.DownloadRecordViewSet, basename='download')
router.register('boards', api.BoardViewSet, basename='board')
router.register('topics', api.TopicViewSet, basename='topic')
router.register('posts', api.PostViewSet, basename='post')
router.register('my-topics', api.MyTopicViewSet, basename='my-topic')
router.register('my-posts', api.MyPostViewSet, basename='my-post')
router.register('notifications', api.NotificationViewSet, basename='notification')
router.register('attachments', api.AttachmentViewSet, basename='attachment')

# 认证与个人中心用函数视图，写在 router 之前保证优先匹配
urlpatterns = [
    path('auth/csrf/', api.csrf_view, name='auth-csrf'),
    path('auth/register/', api.register_view, name='auth-register'),
    path('auth/login/', api.login_view, name='auth-login'),
    path('auth/logout/', api.logout_view, name='auth-logout'),
    path('auth/me/', api.me_view, name='auth-me'),
    path('auth/providers/', api.auth_providers, name='auth-providers'),
    path('profile/', api.profile_view, name='profile'),
    path('profile/avatar/', api.profile_avatar_view, name='profile-avatar'),
    path('search/', api.search_view, name='search'),
    path('', include(router.urls)),
]
