import os
import uuid

from django.conf import settings
from django.db import models


def material_upload_path(instance, filename):
    """资料文件落盘路径：用随机名避免重名与非法字符，原始文件名另存字段。"""
    ext = os.path.splitext(filename)[1].lower()
    return f'materials/{uuid.uuid4().hex}{ext}'


def avatar_upload_path(instance, filename):
    """头像落盘路径：同样用随机名，避免重名与中文/特殊字符。"""
    ext = os.path.splitext(filename)[1].lower() or '.png'
    return f'avatars/{uuid.uuid4().hex}{ext}'


class Category(models.Model):
    """资料分类。slug 用 ASCII，前端据此映射线性图标。"""

    name = models.CharField('名称', max_length=40, unique=True)
    slug = models.SlugField('标识', max_length=40, unique=True)
    description = models.CharField('简介', max_length=200, blank=True)
    order = models.PositiveIntegerField('排序', default=0)

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ('order', 'id')

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField('名称', max_length=30, unique=True)
    # 归属分类：上传/筛选时「选中某分类只显示它下面的标签」靠这个字段；
    # 为空表示通用标签（历史数据与用户自建标签都落在这里）
    category = models.ForeignKey(
        'Category',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='tags',
        verbose_name='所属分类',
    )

    class Meta:
        verbose_name = '标签'
        verbose_name_plural = '标签'
        ordering = ('name',)

    def __str__(self):
        return self.name


class Material(models.Model):
    """学习资料。文件大小与扩展名在上传时冗余存储，避免每次读盘。"""

    class Status(models.TextChoices):
        PENDING = 'pending', '待审核'
        APPROVED = 'approved', '已通过'
        REJECTED = 'rejected', '已驳回'

    title = models.CharField('标题', max_length=200)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='materials',
        verbose_name='分类',
    )
    description = models.TextField('内容简介', blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='materials', verbose_name='标签')
    # 文件本体：可以留空 —— 外链资料把文件放在 CDN/静态站，只在这里存地址
    file = models.FileField('文件', upload_to=material_upload_path, blank=True)
    # 外链地址：填了它就不往对象存储放文件，下载时后端 302 跳过去（不占后端空间）
    source_url = models.URLField(
        '外链地址',
        max_length=500,
        blank=True,
        help_text='文件放在外部（如前端静态站/CDN）时填这里，下载会直接跳转',
    )
    original_name = models.CharField('原始文件名', max_length=255, blank=True)
    file_ext = models.CharField('扩展名', max_length=10, blank=True)
    file_size = models.PositiveBigIntegerField('文件大小(字节)', default=0)
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='materials',
        verbose_name='上传者',
    )
    download_count = models.PositiveIntegerField('下载量', default=0)
    is_public = models.BooleanField('公开', default=True)

    # —— 上传审核：普通用户提交后为 pending，仅 approved 会出现在公开列表 ——
    status = models.CharField(
        '审核状态',
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    review_note = models.CharField('驳回理由', max_length=200, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_materials',
        verbose_name='审核人',
    )
    reviewed_at = models.DateTimeField('审核时间', null=True, blank=True)

    created_at = models.DateTimeField('上传时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '资料'
        verbose_name_plural = '资料'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('-created_at',)),
            models.Index(fields=('-download_count',)),
            models.Index(fields=('status', '-created_at')),
        ]

    def __str__(self):
        return self.title


class Comment(models.Model):
    """资料评论。parent 为空是一级评论，否则是回复（仅支持两级）。"""

    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='资料',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='作者',
    )
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies',
        verbose_name='回复对象',
    )
    content = models.TextField('内容', max_length=1000)
    created_at = models.DateTimeField('发布时间', auto_now_add=True)
    edited_at = models.DateTimeField('编辑时间', null=True, blank=True)

    class Meta:
        verbose_name = '评论'
        verbose_name_plural = '评论'
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.author}：{self.content[:20]}'


class Favorite(models.Model):
    """收藏关系，同一用户对同一资料只能收藏一次。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favorites',
        verbose_name='用户',
    )
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name='favorites',
        verbose_name='资料',
    )
    created_at = models.DateTimeField('收藏时间', auto_now_add=True)

    class Meta:
        verbose_name = '收藏'
        verbose_name_plural = '收藏'
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(fields=('user', 'material'), name='uniq_favorite_user_material'),
        ]

    def __str__(self):
        return f'{self.user} ★ {self.material}'


class DownloadRecord(models.Model):
    """下载记录，仅登录用户会留下记录，用于个人中心的下载历史。"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='downloads',
        verbose_name='用户',
    )
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name='downloads',
        verbose_name='资料',
    )
    created_at = models.DateTimeField('下载时间', auto_now_add=True)

    class Meta:
        verbose_name = '下载记录'
        verbose_name_plural = '下载记录'
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user} ↓ {self.material}'


# --------------------------------------------------------------------------
# 论坛社区
# --------------------------------------------------------------------------


class ForumBoard(models.Model):
    """论坛板块，与资料分类一一对应，另加"学习交流"。slug 用 ASCII 供前端映射图标。"""

    name = models.CharField('板块名称', max_length=40, unique=True)
    slug = models.SlugField('标识', max_length=40, unique=True)
    description = models.CharField('简介', max_length=200, blank=True)
    order = models.PositiveIntegerField('排序', default=0)

    class Meta:
        verbose_name = '论坛板块'
        verbose_name_plural = '论坛板块'
        ordering = ('order', 'id')

    def __str__(self):
        return self.name


class Topic(models.Model):
    """论坛主帖。回复数等统计走实时计算，避免冗余字段漂移。"""

    board = models.ForeignKey(
        ForumBoard,
        on_delete=models.PROTECT,
        related_name='topics',
        verbose_name='板块',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='topics',
        verbose_name='作者',
    )
    title = models.CharField('标题', max_length=200)
    content = models.TextField('正文')
    tags = models.ManyToManyField(Tag, blank=True, related_name='topics', verbose_name='标签')
    views = models.PositiveIntegerField('浏览量', default=0)
    is_pinned = models.BooleanField('置顶', default=False)
    is_featured = models.BooleanField('精华', default=False)
    created_at = models.DateTimeField('发布时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '论坛帖子'
        verbose_name_plural = '论坛帖子'
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('-created_at',)),
            models.Index(fields=('board', '-created_at')),
        ]

    def __str__(self):
        return self.title


class Post(models.Model):
    """楼层回复。floor 为一级回复的楼层号，二级回复 floor 为空。"""

    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name='posts',
        verbose_name='帖子',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forum_posts',
        verbose_name='作者',
    )
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies',
        verbose_name='回复对象',
    )
    content = models.TextField('内容', max_length=1000)
    floor = models.PositiveIntegerField('楼层', null=True, blank=True)
    created_at = models.DateTimeField('发布时间', auto_now_add=True)
    edited_at = models.DateTimeField('编辑时间', null=True, blank=True)

    class Meta:
        verbose_name = '论坛回复'
        verbose_name_plural = '论坛回复'
        ordering = ('created_at', 'id')

    def __str__(self):
        return f'#{self.floor or "-"} {self.content[:20]}'


def attachment_upload_path(instance, filename):
    """附件落盘路径：随机名 + 原扩展名，避免重名与路径穿越。"""
    ext = os.path.splitext(filename)[1].lower()
    return f'attachments/{uuid.uuid4().hex}{ext}'


class Attachment(models.Model):
    """论坛附件/图片。

    设计取舍：**不建外键**——上传后返回 URL，由 Markdown 正文引用
    （`![名](url)` / `[名](url)`），这样一条附件可以被多个帖子复用，
    正文编辑也不会牵连附件表。代价是需要时可另做孤儿文件清理。
    """

    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='上传者',
    )
    file = models.FileField('文件', upload_to=attachment_upload_path)
    original_name = models.CharField('原始文件名', max_length=255, blank=True)
    file_ext = models.CharField('扩展名', max_length=10, blank=True)
    file_size = models.PositiveBigIntegerField('文件大小(字节)', default=0)
    is_image = models.BooleanField('是图片', default=False)
    created_at = models.DateTimeField('上传时间', auto_now_add=True)

    class Meta:
        verbose_name = '论坛附件'
        verbose_name_plural = '论坛附件'
        ordering = ('-created_at',)

    def __str__(self):
        return self.original_name or self.file.name


# --------------------------------------------------------------------------
# 审核流水与站内通知
# --------------------------------------------------------------------------


class ReviewLog(models.Model):
    """资料审核流水：提交、通过、驳回、重新提交各留一条记录。"""

    class Action(models.TextChoices):
        SUBMITTED = 'submitted', '提交审核'
        APPROVED = 'approved', '审核通过'
        REJECTED = 'rejected', '审核驳回'
        RESUBMITTED = 'resubmitted', '重新提交'

    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name='review_logs',
        verbose_name='资料',
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='review_logs',
        verbose_name='操作人',
    )
    action = models.CharField('动作', max_length=16, choices=Action.choices)
    note = models.CharField('说明', max_length=200, blank=True)
    created_at = models.DateTimeField('时间', auto_now_add=True)

    class Meta:
        verbose_name = '审核流水'
        verbose_name_plural = '审核流水'
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.material_id} {self.get_action_display()}'


class Notification(models.Model):
    """站内通知：审核结果、评论回复、楼层回复。"""

    class Kind(models.TextChoices):
        MATERIAL_SUBMITTED = 'material_submitted', '资料待审'
        MATERIAL_APPROVED = 'material_approved', '资料通过'
        MATERIAL_REJECTED = 'material_rejected', '资料驳回'
        COMMENT_REPLY = 'comment_reply', '评论回复'
        POST_REPLY = 'post_reply', '帖子回复'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='接收人',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sent_notifications',
        verbose_name='触发人',
    )
    kind = models.CharField('类型', max_length=24, choices=Kind.choices)
    text = models.CharField('内容', max_length=200)
    url = models.CharField('跳转地址', max_length=200, blank=True)
    is_read = models.BooleanField('已读', default=False)
    created_at = models.DateTimeField('时间', auto_now_add=True)

    class Meta:
        verbose_name = '站内通知'
        verbose_name_plural = '站内通知'
        ordering = ('-created_at',)
        indexes = [models.Index(fields=('recipient', 'is_read', '-created_at'))]

    def __str__(self):
        return f'{self.recipient} · {self.get_kind_display()}'


class UserProfile(models.Model):
    """用户扩展信息：目前只存自定义头像。

    Django 自带的 User 表没有头像字段，用一对一扩展表挂上去，
    不动 auth 表结构（也方便以后加签名、主页等字段）。
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name='用户',
    )
    avatar = models.ImageField(
        '头像',
        upload_to=avatar_upload_path,
        blank=True,
        null=True,
    )
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '用户资料'
        verbose_name_plural = '用户资料'

    def __str__(self):
        return f'{self.user} 的资料'
