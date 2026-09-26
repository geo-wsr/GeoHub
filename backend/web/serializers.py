import os

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Attachment,
    Category,
    Comment,
    DownloadRecord,
    Favorite,
    ForumBoard,
    Material,
    Notification,
    Post,
    ReviewLog,
    Tag,
    Topic,
)

User = get_user_model()


def avatar_url_for(user, request=None):
    """头像的绝对地址；未设置头像时返回空串，前端回落成首字母/地球占位图。

    生产环境 MEDIA_URL 指向对象存储（本身就是绝对地址），本地开发是 /media/…，
    所以这里只在必要时用 request 拼成绝对地址。
    """
    profile = getattr(user, 'profile', None)
    avatar = getattr(profile, 'avatar', None)
    if not avatar:
        return ''
    try:
        url = avatar.url
    except ValueError:
        return ''
    if url.startswith('http'):
        return url
    return request.build_absolute_uri(url) if request else url


class UserBriefSerializer(serializers.ModelSerializer):
    """对外暴露的最小用户信息。昵称沿用 Django 的 first_name。"""

    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'display_name', 'avatar_url')

    def get_display_name(self, obj):
        return obj.first_name or obj.username

    def get_avatar_url(self, obj):
        return avatar_url_for(obj, self.context.get('request'))


class CurrentUserSerializer(serializers.ModelSerializer):
    """当前登录用户的完整信息，供头部与个人中心使用。"""

    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'display_name',
            'avatar_url',
            'email',
            'is_staff',
            'date_joined',
        )

    def get_display_name(self, obj):
        return obj.first_name or obj.username

    def get_avatar_url(self, obj):
        return avatar_url_for(obj, self.context.get('request'))


class CategorySerializer(serializers.ModelSerializer):
    material_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'order', 'material_count')

    def get_material_count(self, obj):
        # 只统计公开且已通过审核的资料，避免把待审/被驳回的算进分类计数
        return obj.materials.filter(
            is_public=True, status=Material.Status.APPROVED
        ).count()


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ('id', 'name')


def split_tag_names(tag_names):
    """归一化标签输入：兼容 'a, b' / 'a，b' 写法，去空白、去重、丢掉空串。"""
    cleaned = []
    for raw in tag_names:
        for name in str(raw).replace('，', ',').split(','):
            name = name.strip()
            if name and name not in cleaned:
                cleaned.append(name)
    return cleaned


class ReviewLogSerializer(serializers.ModelSerializer):
    reviewer = UserBriefSerializer(read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = ReviewLog
        fields = ('id', 'action', 'action_display', 'note', 'reviewer', 'created_at')


class NotificationSerializer(serializers.ModelSerializer):
    actor = UserBriefSerializer(read_only=True)
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'kind', 'kind_display', 'text', 'url', 'is_read', 'actor', 'created_at')


class AttachmentSerializer(serializers.ModelSerializer):
    """论坛附件：上传后返回可直接写进 Markdown 的绝对 URL。"""

    url = serializers.SerializerMethodField()
    uploader = UserBriefSerializer(read_only=True)

    class Meta:
        model = Attachment
        fields = (
            'id',
            'file',
            'url',
            'original_name',
            'file_ext',
            'file_size',
            'is_image',
            'uploader',
            'created_at',
        )
        # 元信息由后端根据上传文件推导，不接受前端传入
        read_only_fields = ('original_name', 'file_ext', 'file_size', 'is_image', 'uploader')
        extra_kwargs = {'file': {'write_only': True}}

    def get_url(self, obj):
        # 用绝对 URL：前端可能部署在 GitHub Pages（跨域），相对路径会指错站点
        request = self.context.get('request')
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate_file(self, value):
        ext = os.path.splitext(value.name)[1].lower()
        image_exts = getattr(settings, 'ATTACHMENT_IMAGE_EXTENSIONS', [])
        file_exts = getattr(settings, 'ATTACHMENT_FILE_EXTENSIONS', [])
        allowed = image_exts + file_exts
        if ext not in allowed:
            raise serializers.ValidationError(
                f'不支持的文件格式 {ext or "（无扩展名）"}，仅支持：{"、".join(allowed)}'
            )
        limit_name = (
            'ATTACHMENT_MAX_IMAGE_SIZE' if ext in image_exts else 'ATTACHMENT_MAX_FILE_SIZE'
        )
        limit = getattr(settings, limit_name, 0)
        if limit and value.size > limit:
            raise serializers.ValidationError(f'文件不能超过 {limit / 1024 / 1024:.0f} MB。')
        return value

    def create(self, validated_data):
        uploaded = validated_data['file']
        ext = os.path.splitext(uploaded.name)[1].lower()
        return Attachment.objects.create(
            uploader=self.context['request'].user,
            original_name=uploaded.name,
            file_ext=ext,
            file_size=uploaded.size,
            is_image=ext in getattr(settings, 'ATTACHMENT_IMAGE_EXTENSIONS', []),
            **validated_data,
        )


class MaterialListSerializer(serializers.ModelSerializer):
    """列表/卡片用的资料结构。简介不截断，由前端用 CSS 行数裁剪。"""

    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    uploader = UserBriefSerializer(read_only=True)
    favorite_count = serializers.IntegerField(source='favorites.count', read_only=True)
    comment_count = serializers.IntegerField(source='comments.count', read_only=True)
    is_favorited = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Material
        fields = (
            'id',
            'title',
            'description',
            'category',
            'tags',
            'uploader',
            'file_ext',
            'file_size',
            'download_count',
            'favorite_count',
            'comment_count',
            'status',
            'status_display',
            'review_note',
            'created_at',
            'is_favorited',
            'is_owner',
        )

    def get_is_favorited(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or not user.is_authenticated:
            return False
        # 视图层已用 prefetch 预取当前用户的收藏，避免 N+1
        favorited_ids = self.context.get('favorited_ids')
        if favorited_ids is not None:
            return obj.id in favorited_ids
        return obj.favorites.filter(user=user).exists()

    def get_is_owner(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return bool(user and user.is_authenticated and obj.uploader_id == user.id)


class MaterialDetailSerializer(MaterialListSerializer):
    original_name = serializers.CharField(read_only=True)
    download_url = serializers.SerializerMethodField()
    review_logs = ReviewLogSerializer(many=True, read_only=True)

    class Meta(MaterialListSerializer.Meta):
        fields = MaterialListSerializer.Meta.fields + (
            'original_name',
            'download_url',
            'review_logs',
        )

    def get_download_url(self, obj):
        return f'/api/materials/{obj.id}/download/'


class MaterialWriteSerializer(serializers.ModelSerializer):
    """上传/编辑资料。标签用字符串数组传入，后端负责 get_or_create。"""

    tags = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Material
        fields = ('id', 'title', 'category', 'description', 'tags', 'file', 'is_public')
        extra_kwargs = {'file': {'required': True}}

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('标题至少 2 个字符。')
        return value

    def validate(self, attrs):
        # DRF 的 BooleanField 在 multipart 表单里缺失时会被判定为 False
        # （default_empty_html = False）。这里显式补默认值，
        # 否则前端上传的资料会直接变成"非公开"而在列表里消失。
        if 'is_public' not in self.initial_data:
            attrs['is_public'] = True
        return attrs

    def validate_file(self, value):
        ext = os.path.splitext(value.name)[1].lower()
        allowed = getattr(settings, 'MATERIAL_ALLOWED_EXTENSIONS', [])
        if ext not in allowed:
            raise serializers.ValidationError(
                f'不支持的文件格式 {ext or "（无扩展名）"}，仅支持：{"、".join(allowed)}'
            )
        max_size = getattr(settings, 'MATERIAL_MAX_UPLOAD_SIZE', 0)
        if max_size and value.size > max_size:
            limit_mb = max_size / 1024 / 1024
            raise serializers.ValidationError(f'文件不能超过 {limit_mb:.0f} MB。')
        return value

    def _sync_tags(self, instance, tag_names):
        cleaned = split_tag_names(tag_names)
        if not cleaned:
            instance.tags.clear()
            return
        tags = [Tag.objects.get_or_create(name=name)[0] for name in cleaned]
        instance.tags.set(tags)

    def create(self, validated_data):
        tag_names = validated_data.pop('tags', [])
        uploaded = validated_data['file']
        material = Material.objects.create(
            uploader=self.context['request'].user,
            original_name=uploaded.name,
            file_ext=os.path.splitext(uploaded.name)[1].lower(),
            file_size=uploaded.size,
            **validated_data,
        )
        self._sync_tags(material, tag_names)
        return material

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags', None)
        new_file = validated_data.get('file')
        for field, value in validated_data.items():
            setattr(instance, field, value)
        # 替换文件时同步刷新冗余的原始文件名 / 扩展名 / 大小
        if new_file is not None:
            instance.original_name = new_file.name
            instance.file_ext = os.path.splitext(new_file.name)[1].lower()
            instance.file_size = new_file.size
        instance.save()
        if tag_names is not None:
            self._sync_tags(instance, tag_names)
        return instance


class CommentSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    has_replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            'id',
            'material',
            'author',
            'parent',
            'content',
            'created_at',
            'edited_at',
            'replies',
            'has_replies',
            'is_owner',
        )
        read_only_fields = ('material', 'parent', 'edited_at')

    def get_replies(self, obj):
        # 仅一级评论内联回复，回复本身不再嵌套，保证两级结构
        if obj.parent_id is not None:
            return []
        children = [c for c in obj.replies.all()]
        return CommentSerializer(children, many=True, context=self.context).data

    def get_has_replies(self, obj):
        return obj.parent_id is None and obj.replies.exists()

    def get_is_owner(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        return bool(user and user.is_authenticated and obj.author_id == user.id)

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('评论内容不能为空。')
        return value


class FavoriteSerializer(serializers.ModelSerializer):
    material = MaterialListSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'material', 'created_at')


class MyCommentSerializer(CommentSerializer):
    """个人中心的评论列表：把资料 id 换成 {id, title}，便于直接跳转。"""

    material = serializers.SerializerMethodField()

    def get_material(self, obj):
        return {'id': obj.material_id, 'title': obj.material.title}


class DownloadRecordSerializer(serializers.ModelSerializer):
    material = MaterialListSerializer(read_only=True)

    class Meta:
        model = DownloadRecord
        fields = ('id', 'material', 'created_at')


# --------------------------------------------------------------------------
# 论坛社区
# --------------------------------------------------------------------------


class ForumBoardSerializer(serializers.ModelSerializer):
    topic_count = serializers.IntegerField(source='topics.count', read_only=True)

    class Meta:
        model = ForumBoard
        fields = ('id', 'name', 'slug', 'description', 'order', 'topic_count')


class PostSerializer(serializers.ModelSerializer):
    """楼层回复。一级回复带 floor，二级回复内联在 replies 中。"""

    author = UserBriefSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            'id',
            'topic',
            'author',
            'parent',
            'content',
            'floor',
            'created_at',
            'edited_at',
            'replies',
            'is_owner',
        )
        read_only_fields = ('topic', 'parent', 'floor', 'edited_at')

    def get_replies(self, obj):
        # 仅一级回复内联二级回复，保持两级结构
        if obj.parent_id is not None:
            return []
        children = obj.replies.order_by('created_at')
        return PostSerializer(children, many=True, context=self.context).data

    def get_is_owner(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        return bool(user and user.is_authenticated and obj.author_id == user.id)


class MyPostSerializer(PostSerializer):
    """个人中心「我的回复」：把帖子 id 换成 {id, title}，便于跳转。"""

    topic = serializers.SerializerMethodField()

    def get_topic(self, obj):
        return {'id': obj.topic_id, 'title': obj.topic.title}


class TopicListSerializer(serializers.ModelSerializer):
    """帖子卡片：标题、作者、时间、回复数、浏览量、内容摘要。"""

    board = ForumBoardSerializer(read_only=True)
    author = UserBriefSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    reply_count = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    is_pinned = serializers.BooleanField(read_only=True)
    is_featured = serializers.BooleanField(read_only=True)

    class Meta:
        model = Topic
        fields = (
            'id',
            'title',
            'board',
            'author',
            'tags',
            'views',
            'reply_count',
            'summary',
            'created_at',
            'is_owner',
            'is_pinned',
            'is_featured',
        )

    def get_reply_count(self, obj):
        # 列表视图会 annotate(reply_total)，这里做一次兼容回落
        annotated = getattr(obj, 'reply_total', None)
        return annotated if annotated is not None else obj.posts.count()

    def get_summary(self, obj):
        text = ' '.join(obj.content.split())
        return text[:90] + ('…' if len(text) > 90 else '')

    def get_is_owner(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        return bool(user and user.is_authenticated and obj.author_id == user.id)


class TopicDetailSerializer(TopicListSerializer):
    class Meta(TopicListSerializer.Meta):
        fields = TopicListSerializer.Meta.fields + ('content',)


class TopicWriteSerializer(serializers.ModelSerializer):
    """发帖/编辑帖子：标签按名称传入，后端 get_or_create。"""

    tags = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Topic
        fields = ('id', 'board', 'title', 'content', 'tags')

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 4:
            raise serializers.ValidationError('标题至少 4 个字符。')
        return value

    def validate_content(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError('正文至少 10 个字符，请把问题描述清楚。')
        # 与前端 maxlength 对齐：Markdown 源码上限，避免超长内容拖垮渲染
        if len(value) > 5000:
            raise serializers.ValidationError('正文不能超过 5000 个字符。')
        return value

    def _sync_tags(self, instance, tag_names):
        cleaned = split_tag_names(tag_names)
        if not cleaned:
            instance.tags.clear()
            return
        instance.tags.set([Tag.objects.get_or_create(name=name)[0] for name in cleaned])

    def create(self, validated_data):
        tag_names = validated_data.pop('tags', [])
        topic = Topic.objects.create(author=self.context['request'].user, **validated_data)
        self._sync_tags(topic, tag_names)
        return topic

    def update(self, instance, validated_data):
        tag_names = validated_data.pop('tags', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if tag_names is not None:
            self._sync_tags(instance, tag_names)
        return instance
