# GitHub 第三方登录的适配器：与现有三级权限体系衔接，且不授予任何管理权限。
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings


class GitHubSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    1. 第三方登录用户一律是普通用户（不因 GitHub 身份获得 staff/superuser）；
    2. 授权完成后跳回前端站点的回调页，由前端再拉一次 /api/auth/me/ 落地登录态。
    """

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        user.is_staff = False
        user.is_superuser = False
        if not user.first_name:
            user.first_name = (data.get('name') or data.get('login') or '')[:150]
        return user

    def get_login_redirect_url(self, request, **kwargs):
        return f'{settings.FRONTEND_URL}/oauth/callback'

    def get_connect_redirect_url(self, request, socialaccount):
        return f'{settings.FRONTEND_URL}/me'