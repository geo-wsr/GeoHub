"""接口层自动化测试。

覆盖四块最容易回归的逻辑：三级权限、资料审核闭环、论坛楼层、编辑与通知。
运行：python manage.py test web
"""

import tempfile
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import (
    Category,
    Comment,
    DownloadRecord,
    ForumBoard,
    Material,
    Notification,
    Post,
    ReviewLog,
    Tag,
    Topic,
)

User = get_user_model()

# 测试产生的上传文件写到临时目录，避免污染项目的 media/
TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix='mywebsite-test-media-')


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class BaseAPITestCase(APITestCase):
    """公共初始数据：管理员、普通用户、另一个用户、分类、板块、一份已通过资料。"""

    def setUp(self):
        # 限流用 LocMemCache，测试间会累积，这里清一次
        cache.clear()

        self.admin = User.objects.create_user(
            'admin01', password='test-pass-2026', is_staff=True
        )
        self.user = User.objects.create_user(
            'student01', password='test-pass-2026', first_name='同学甲'
        )
        self.other = User.objects.create_user('other01', password='test-pass-2026')

        self.category = Category.objects.create(name='自然地理', slug='physical', order=1)
        self.board = ForumBoard.objects.create(name='自然地理', slug='physical', order=1)

        self.file = SimpleUploadedFile('demo.pdf', b'%PDF-1.4 demo', content_type='application/pdf')
        self.approved = Material.objects.create(
            title='已通过的资料',
            category=self.category,
            uploader=self.admin,
            status=Material.Status.APPROVED,
            is_public=True,
            original_name='demo.pdf',
            file_ext='.pdf',
            file_size=13,
            file=self.file,
        )
        self.pending = Material.objects.create(
            title='待审核的资料',
            category=self.category,
            uploader=self.user,
            status=Material.Status.PENDING,
            original_name='demo.pdf',
            file_ext='.pdf',
            file_size=13,
        )

    def login(self, user):
        self.client.force_authenticate(user=user)

    def logout(self):
        self.client.force_authenticate(user=None)


class AnonymousPermissionTests(BaseAPITestCase):
    """游客只能读，不能下载、评论、发帖。"""

    def test_anonymous_can_browse(self):
        self.assertEqual(self.client.get('/api/materials/').status_code, 200)
        self.assertEqual(self.client.get('/api/topics/').status_code, 200)
        self.assertEqual(self.client.get('/api/boards/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/materials/{self.approved.id}/').status_code, 200)

    def test_anonymous_sees_only_approved_materials(self):
        data = self.client.get('/api/materials/').json()
        ids = [row['id'] for row in data['results']]
        self.assertIn(self.approved.id, ids)
        self.assertNotIn(self.pending.id, ids)

    def test_anonymous_detail_of_pending_material_is_404(self):
        response = self.client.get(f'/api/materials/{self.pending.id}/')
        self.assertEqual(response.status_code, 404)

    def test_anonymous_cannot_download(self):
        response = self.client.get(f'/api/materials/{self.approved.id}/download/')
        # 关键回归点：这里曾经直接 500（AnonymousUser 写下载记录）
        self.assertEqual(response.status_code, 403)

    def test_anonymous_cannot_write(self):
        self.assertEqual(self.client.post('/api/topics/', {'board': self.board.id}).status_code, 403)
        self.assertEqual(
            self.client.post(
                f'/api/materials/{self.approved.id}/comments/', {'content': 'x'}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(f'/api/materials/{self.approved.id}/favorite/').status_code, 403
        )
        self.assertEqual(
            self.client.post(
                f'/api/materials/{self.pending.id}/review/', {'action': 'approve'}
            ).status_code,
            403,
        )


class MaterialReviewFlowTests(BaseAPITestCase):
    """上传审核闭环：提交 → 待审 → 驳回/重提 → 通过。"""

    def submit(self, title='新提交的资料'):
        self.login(self.user)
        payload = {
            'title': title,
            'category': self.category.id,
            'description': '测试用',
            'file': SimpleUploadedFile('new.pdf', b'%PDF-1.4 new', content_type='application/pdf'),
        }
        return self.client.post('/api/materials/', payload, format='multipart')

    def test_user_submission_enters_pending_queue(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], Material.Status.PENDING)

        material = Material.objects.get(pk=response.json()['id'])
        self.assertEqual(material.uploader, self.user)
        self.assertTrue(ReviewLog.objects.filter(material=material, action='submitted').exists())
        # 管理员收到待审通知
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.admin, kind=Notification.Kind.MATERIAL_SUBMITTED
            ).exists()
        )
        # 未通过审核前不在公开列表
        self.logout()
        ids = [row['id'] for row in self.client.get('/api/materials/').json()['results']]
        self.assertNotIn(material.id, ids)

    def test_staff_upload_is_approved_immediately(self):
        self.login(self.admin)
        response = self.client.post(
            '/api/materials/',
            {
                'title': '管理员直传',
                'category': self.category.id,
                'file': SimpleUploadedFile('admin.pdf', b'%PDF-1.4 a', content_type='application/pdf'),
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], Material.Status.APPROVED)

    def test_only_staff_can_review(self):
        self.login(self.user)
        response = self.client.post(
            f'/api/materials/{self.pending.id}/review/', {'action': 'approve'}
        )
        self.assertEqual(response.status_code, 403)

    def test_reject_requires_note(self):
        self.login(self.admin)
        response = self.client.post(
            f'/api/materials/{self.pending.id}/review/', {'action': 'reject'}
        )
        self.assertEqual(response.status_code, 400)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.status, Material.Status.PENDING)

    def test_reject_then_resubmit_then_approve(self):
        self.login(self.admin)
        note = '内容与标题不符，请补充目录。'
        response = self.client.post(
            f'/api/materials/{self.pending.id}/review/',
            {'action': 'reject', 'note': note},
        )
        self.assertEqual(response.status_code, 200)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.status, Material.Status.REJECTED)
        self.assertEqual(self.pending.review_note, note)
        self.assertTrue(
            ReviewLog.objects.filter(material=self.pending, action='rejected').exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.user, kind=Notification.Kind.MATERIAL_REJECTED
            ).exists()
        )

        # 作者修改后自动回到待审核，并清空驳回理由
        self.login(self.user)
        response = self.client.patch(
            f'/api/materials/{self.pending.id}/',
            {'description': '已按意见补充目录'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.pending.refresh_from_db()
        self.assertEqual(self.pending.status, Material.Status.PENDING)
        self.assertEqual(self.pending.review_note, '')
        self.assertTrue(
            ReviewLog.objects.filter(material=self.pending, action='resubmitted').exists()
        )

        # 管理员通过后进入公开列表
        self.login(self.admin)
        self.assertEqual(
            self.client.post(
                f'/api/materials/{self.pending.id}/review/', {'action': 'approve'}
            ).status_code,
            200,
        )
        self.logout()
        ids = [row['id'] for row in self.client.get('/api/materials/').json()['results']]
        self.assertIn(self.pending.id, ids)

    def test_owner_sees_all_statuses_in_mine_queue(self):
        self.login(self.user)
        data = self.client.get('/api/materials/?mine=1').json()
        ids = [row['id'] for row in data['results']]
        self.assertIn(self.pending.id, ids)

    def test_non_staff_cannot_see_full_review_queue(self):
        self.login(self.user)
        data = self.client.get('/api/materials/?status=pending').json()
        ids = [row['id'] for row in data['results']]
        # 普通用户请求审核队列只会拿到公开列表，看不到别人的待审资料
        self.assertNotIn(self.pending.id, ids)

    def test_other_user_cannot_edit_or_delete(self):
        self.login(self.other)
        # 别人的待审资料对他不可见 → 404（不泄露存在性）
        self.assertEqual(
            self.client.patch(
                f'/api/materials/{self.pending.id}/', {'title': '改标题'}, format='json'
            ).status_code,
            404,
        )
        self.assertEqual(self.client.delete(f'/api/materials/{self.pending.id}/').status_code, 404)
        # 公开资料可见但不可改 → 403
        self.assertEqual(
            self.client.patch(
                f'/api/materials/{self.approved.id}/', {'title': '改标题'}, format='json'
            ).status_code,
            403,
        )
        self.assertEqual(self.client.delete(f'/api/materials/{self.approved.id}/').status_code, 403)
        # 管理员可以管理全站资料
        self.login(self.admin)
        self.assertEqual(self.client.delete(f'/api/materials/{self.pending.id}/').status_code, 204)


class DownloadTests(BaseAPITestCase):
    """下载：必须登录，且累加下载量并留下记录。"""

    def test_logged_in_user_can_download(self):
        self.login(self.user)
        response = self.client.get(f'/api/materials/{self.approved.id}/download/')
        self.assertEqual(response.status_code, 200)
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.download_count, 1)
        self.assertTrue(
            DownloadRecord.objects.filter(user=self.user, material=self.approved).exists()
        )


class CommentTests(BaseAPITestCase):
    """评论：登录可发、回复形成两级、可编辑、只能删自己的。"""

    def test_comment_and_reply(self):
        material = self.approved
        self.login(self.user)
        first = self.client.post(
            f'/api/materials/{material.id}/comments/', {'content': '一级评论'}
        )
        self.assertEqual(first.status_code, 201)

        self.login(self.other)
        reply = self.client.post(
            f'/api/materials/{material.id}/comments/',
            {'content': '二级回复', 'parent': first.json()['id']},
            format='json',
        )
        self.assertEqual(reply.status_code, 201)

        # 评论作者收到回复通知
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.user, kind=Notification.Kind.COMMENT_REPLY
            ).exists()
        )

        detail = self.client.get(f'/api/materials/{material.id}/comments/').json()
        self.assertEqual(detail['count'], 1)  # 只统计一级评论
        self.assertEqual(len(detail['results'][0]['replies']), 1)
        self.assertFalse(detail['results'][0]['is_owner'])  # 当前登录的是 other
        self.assertTrue(detail['results'][0]['replies'][0]['is_owner'])

    def test_reply_to_reply_stays_two_levels(self):
        material = self.approved
        self.login(self.user)
        top = self.client.post(
            f'/api/materials/{material.id}/comments/', {'content': '一层'}
        ).json()
        self.login(self.other)
        sub = self.client.post(
            f'/api/materials/{material.id}/comments/',
            {'content': '二层', 'parent': top['id']},
            format='json',
        ).json()
        # 再回复"二级回复"，仍然挂到一级评论下
        again = self.client.post(
            f'/api/materials/{material.id}/comments/',
            {'content': '还是二层', 'parent': sub['id']},
            format='json',
        ).json()
        self.assertEqual(again['parent'], top['id'])

    def test_comment_edit_permission_and_marker(self):
        comment = Comment.objects.create(
            material=self.approved, author=self.user, content='原始内容'
        )
        self.login(self.other)
        self.assertEqual(
            self.client.patch(
                f'/api/comments/{comment.id}/', {'content': '别人改'}, format='json'
            ).status_code,
            403,
        )
        self.login(self.user)
        response = self.client.patch(
            f'/api/comments/{comment.id}/', {'content': '自己改'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['content'], '自己改')
        self.assertIsNotNone(response.json()['edited_at'])


class ForumTests(BaseAPITestCase):
    """论坛：发帖、楼层、置顶精华、权限。"""

    def make_topic(self, author=None, title='楼层测试帖'):
        self.login(author or self.user)
        return self.client.post(
            '/api/topics/',
            {'board': self.board.id, 'title': title, 'content': '这是一个足够长的正文内容。'},
            format='json',
        )

    def test_create_topic_and_floors(self):
        response = self.make_topic()
        self.assertEqual(response.status_code, 201)
        topic_id = response.json()['id']

        first = self.client.post(
            f'/api/topics/{topic_id}/posts/', {'content': '一楼'}, format='json'
        )
        self.assertEqual(first.json()['floor'], 1)

        self.login(self.other)
        second = self.client.post(
            f'/api/topics/{topic_id}/posts/', {'content': '二楼'}, format='json'
        )
        self.assertEqual(second.json()['floor'], 2)

        sub = self.client.post(
            f'/api/topics/{topic_id}/posts/',
            {'content': '回复一楼', 'parent': first.json()['id']},
            format='json',
        )
        self.assertIsNone(sub.json()['floor'])  # 二级回复不占楼层号

        # 楼主收到回复通知
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.user, kind=Notification.Kind.POST_REPLY
            ).exists()
        )

    def test_views_increase_on_detail(self):
        topic_id = self.make_topic().json()['id']
        topic = Topic.objects.get(pk=topic_id)
        self.assertEqual(topic.views, 0)
        self.client.get(f'/api/topics/{topic_id}/')
        topic.refresh_from_db()
        self.assertEqual(topic.views, 1)

    def test_pin_and_feature_require_staff(self):
        topic_id = self.make_topic().json()['id']
        self.assertEqual(self.client.post(f'/api/topics/{topic_id}/pin/').status_code, 403)
        self.login(self.admin)
        self.assertTrue(self.client.post(f'/api/topics/{topic_id}/pin/').json()['is_pinned'])
        self.assertTrue(
            self.client.post(f'/api/topics/{topic_id}/feature/').json()['is_featured']
        )

    def test_pinned_topic_comes_first(self):
        self.make_topic(title='普通讨论帖')
        pinned_id = self.make_topic(title='置顶讨论帖').json()['id']
        self.login(self.admin)
        self.client.post(f'/api/topics/{pinned_id}/pin/')
        self.logout()
        data = self.client.get('/api/topics/').json()
        self.assertEqual(data['results'][0]['id'], pinned_id)
        self.assertTrue(data['results'][0]['is_pinned'])

    def test_topic_edit_and_delete_permission(self):
        topic_id = self.make_topic().json()['id']
        self.login(self.other)
        self.assertEqual(
            self.client.patch(
                f'/api/topics/{topic_id}/', {'title': '改别人的帖'}, format='json'
            ).status_code,
            403,
        )
        self.assertEqual(self.client.delete(f'/api/topics/{topic_id}/').status_code, 403)
        self.login(self.user)
        self.assertEqual(
            self.client.patch(
                f'/api/topics/{topic_id}/', {'title': '作者改标题'}, format='json'
            ).status_code,
            200,
        )

    def test_post_edit_permission(self):
        topic_id = self.make_topic().json()['id']
        post = Post.objects.create(topic_id=topic_id, author=self.user, content='原文', floor=1)
        self.login(self.other)
        self.assertEqual(
            self.client.patch(f'/api/posts/{post.id}/', {'content': '改'}, format='json').status_code,
            403,
        )
        self.login(self.user)
        response = self.client.patch(
            f'/api/posts/{post.id}/', {'content': '改好了'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.json()['edited_at'])


class NotificationTests(BaseAPITestCase):
    """站内通知：未读数与已读标记。"""

    def test_unread_count_and_mark_all_read(self):
        Notification.objects.create(
            recipient=self.user, kind=Notification.Kind.MATERIAL_APPROVED, text='通过'
        )
        Notification.objects.create(
            recipient=self.user, kind=Notification.Kind.MATERIAL_REJECTED, text='驳回'
        )
        self.login(self.user)
        self.assertEqual(self.client.get('/api/notifications/unread_count/').json()['count'], 2)
        self.assertEqual(self.client.post('/api/notifications/mark_all_read/').status_code, 200)
        self.assertEqual(self.client.get('/api/notifications/unread_count/').json()['count'], 0)

    def test_only_own_notifications_visible(self):
        Notification.objects.create(
            recipient=self.other, kind=Notification.Kind.MATERIAL_APPROVED, text='别人的'
        )
        self.login(self.user)
        self.assertEqual(self.client.get('/api/notifications/').json()['count'], 0)


class SearchTests(BaseAPITestCase):
    """全局搜索同时匹配资料与帖子。"""

    def test_category_count_excludes_unapproved(self):
        # 分类计数只应统计"公开且已通过"的资料（setUp 里有 1 份通过 + 1 份待审）
        data = self.client.get('/api/categories/').json()
        row = next(item for item in data if item['id'] == self.category.id)
        self.assertEqual(row['material_count'], 1)

    def test_search_returns_materials_and_topics(self):
        Topic.objects.create(
            board=self.board,
            author=self.user,
            title='关于空间分析的讨论',
            content='内容里也提到空间分析。',
        )
        response = self.client.get('/api/search/?q=空间分析')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(payload['topic_total'], 1)
        self.assertEqual(payload['query'], '空间分析')

    def test_empty_query_returns_empty_result(self):
        payload = self.client.get('/api/search/?q=').json()
        self.assertEqual(payload['material_total'], 0)
        self.assertEqual(payload['topic_total'], 0)


class GitHubOAuthTests(BaseAPITestCase):
    """GitHub 登录接线：确认授权地址、回调路径与 scope 正确。

    回调地址填错是 OAuth 最常见的故障（GitHub 会直接报 redirect_uri_mismatch），
    所以把它固化成测试。这里用的 client_id/secret 是测试占位值，不是真实凭据。
    """

    FAKE_PROVIDERS = {
        'github': {
            'APP': {'client_id': 'test-client-id', 'secret': 'test-secret', 'key': ''},
            'SCOPE': ['user:email'],
        }
    }

    def test_providers_endpoint_exposes_login_url(self):
        payload = self.client.get('/api/auth/providers/').json()
        self.assertFalse(payload['github']['enabled'])  # 测试环境未配置真实凭据
        self.assertTrue(payload['github']['login_url'].endswith('/accounts/github/login/?process=login'))

    @override_settings(SOCIALACCOUNT_PROVIDERS=FAKE_PROVIDERS)
    def test_providers_endpoint_enabled_when_configured(self):
        payload = self.client.get('/api/auth/providers/').json()
        self.assertTrue(payload['github']['enabled'])

    @override_settings(SOCIALACCOUNT_PROVIDERS=FAKE_PROVIDERS)
    def test_login_redirects_to_github_with_correct_callback(self):
        response = self.client.get('/accounts/github/login/?process=login')
        self.assertEqual(response.status_code, 302)

        location = response['Location']
        self.assertIn('github.com/login/oauth/authorize', location)

        params = parse_qs(urlparse(location).query)
        self.assertEqual(params.get('client_id'), ['test-client-id'])
        self.assertEqual(params.get('response_type'), ['code'])
        self.assertEqual(params.get('scope'), ['user:email'])

        # 回调必须是后端的 /accounts/github/login/callback/，
        # 生产环境就会是 https://<后端域名>/accounts/github/login/callback/
        redirect_uri = params.get('redirect_uri', [''])[0]
        self.assertIn('/accounts/github/login/callback/', redirect_uri)


class AttachmentTests(BaseAPITestCase):
    """论坛附件上传：需登录、格式与大小校验、只有本人或管理员能删。"""

    def upload(self, name='pic.png', content=b'png-bytes', content_type='image/png'):
        self.login(self.user)
        return self.client.post(
            '/api/attachments/',
            {'file': SimpleUploadedFile(name, content, content_type=content_type)},
            format='multipart',
        )

    def test_anonymous_cannot_upload(self):
        response = self.client.post(
            '/api/attachments/',
            {'file': SimpleUploadedFile('a.png', b'x', content_type='image/png')},
            format='multipart',
        )
        self.assertEqual(response.status_code, 403)

    def test_upload_image_returns_markdown_ready_url(self):
        response = self.upload()
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data['is_image'])
        self.assertEqual(data['original_name'], 'pic.png')
        # 返回绝对 URL，前端才能直接写进 Markdown（跨域部署也不会指错站点）
        self.assertTrue(data['url'].startswith('http'))
        self.assertIn('/media/attachments/', data['url'])

    def test_non_image_attachment_is_flagged_as_file(self):
        response = self.upload(
            name='notes.pdf', content=b'%PDF-1.4', content_type='application/pdf'
        )
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()['is_image'])

    def test_svg_and_executable_are_rejected(self):
        for name in ('evil.svg', 'evil.exe'):
            response = self.upload(name=name)
            self.assertEqual(response.status_code, 400, f'{name} 不应被接受')

    def test_oversize_image_is_rejected(self):
        response = self.upload(content=b'x' * (5 * 1024 * 1024 + 1))
        self.assertEqual(response.status_code, 400)

    def test_only_owner_or_staff_can_delete(self):
        attachment_id = self.upload().json()['id']
        self.login(self.other)
        self.assertEqual(
            self.client.delete(f'/api/attachments/{attachment_id}/').status_code, 403
        )
        self.login(self.user)
        self.assertEqual(
            self.client.delete(f'/api/attachments/{attachment_id}/').status_code, 204
        )


class ExternalMaterialTests(BaseAPITestCase):
    """外链资料：文件放在前端静态站/CDN，后端只存地址，下载走 302，不占对象存储。"""

    URL = '/api/materials/'

    def test_admin_can_create_external_material(self):
        self.login(self.admin)
        response = self.client.post(
            self.URL,
            {
                'title': '外链资料示例',
                'category': self.category.id,
                'description': '讲义放在前端静态站',
                'source_url': 'https://www.bnugeohub.cn/materials/demo-slides.pdf',
                'is_public': 'true',
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201)
        material = Material.objects.get(title='外链资料示例')
        self.assertFalse(material.file)  # 没有真实文件
        self.assertEqual(material.file_ext, '.pdf')  # 扩展名从 URL 推断
        self.assertTrue(response.json()['is_external'])

    def test_download_redirects_to_source_url_and_counts(self):
        self.login(self.user)
        material = Material.objects.create(
            title='外链资料',
            category=self.category,
            uploader=self.admin,
            status=Material.Status.APPROVED,
            is_public=True,
            source_url='https://www.bnugeohub.cn/materials/demo.pdf',
            file_ext='.pdf',
        )
        response = self.client.get(f'/api/materials/{material.id}/download/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response['Location'], 'https://www.bnugeohub.cn/materials/demo.pdf'
        )
        material.refresh_from_db()
        self.assertEqual(material.download_count, 1)
        self.assertTrue(DownloadRecord.objects.filter(material=material).exists())

    def test_requires_file_or_source_url(self):
        self.login(self.admin)
        response = self.client.post(
            self.URL,
            {'title': '既没文件也没外链', 'category': self.category.id},
            format='multipart',
        )
        self.assertEqual(response.status_code, 400)


class TagCategoryTests(BaseAPITestCase):
    """标签按分类过滤：上传页与资料库侧栏据此联动。"""

    def setUp(self):
        super().setUp()
        self.gis = Category.objects.create(name='GIS遥感', slug='gis', order=2)
        Tag.objects.create(name='遥感', category=self.gis)
        Tag.objects.create(name='地图学', category=self.gis)
        Tag.objects.create(name='水文', category=self.category)

    def test_filter_by_category(self):
        data = self.client.get('/api/tags/?category=gis').json()
        self.assertEqual(sorted(item['name'] for item in data), ['地图学', '遥感'])
        self.assertTrue(all(item['category_slug'] == 'gis' for item in data))

    def test_without_filter_returns_everything(self):
        names = [item['name'] for item in self.client.get('/api/tags/').json()]
        self.assertIn('水文', names)
        self.assertIn('遥感', names)


class AvatarTests(BaseAPITestCase):
    """自定义头像：登录才能改、格式与大小受限、删除后回落成占位图。"""

    URL = '/api/profile/avatar/'

    def upload(self, name='avatar.png', content=b'x' * 1024):
        image = SimpleUploadedFile(name, content, content_type='image/png')
        return self.client.post(self.URL, {'file': image}, format='multipart')

    def test_anonymous_cannot_upload(self):
        self.logout()
        self.assertEqual(self.upload().status_code, 403)

    def test_upload_and_delete_avatar(self):
        self.login(self.user)
        response = self.upload()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['user']['avatar_url'])

        # 评论 / 帖子里的用户摘要同样带上头像
        Comment.objects.create(
            material=self.approved, author=self.user, content='顶一个'
        )
        comments = self.client.get(f'/api/materials/{self.approved.id}/comments/')
        self.assertTrue(comments.json()['results'][0]['author']['avatar_url'])

        deleted = self.client.delete(self.URL)
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(deleted.json()['user']['avatar_url'], '')

    def test_rejects_wrong_extension(self):
        self.login(self.user)
        self.assertEqual(self.upload(name='avatar.svg').status_code, 400)

    def test_rejects_oversize_avatar(self):
        self.login(self.user)
        big = b'x' * (2 * 1024 * 1024 + 1)
        self.assertEqual(self.upload(content=big).status_code, 400)
