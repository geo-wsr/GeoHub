import os

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, F, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import (
    AllowAny,
    IsAdminUser,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .models import (
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
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    CurrentUserSerializer,
    DownloadRecordSerializer,
    FavoriteSerializer,
    ForumBoardSerializer,
    MaterialDetailSerializer,
    MaterialListSerializer,
    MaterialWriteSerializer,
    MyCommentSerializer,
    MyPostSerializer,
    NotificationSerializer,
    PostSerializer,
    TagSerializer,
    TopicDetailSerializer,
    TopicListSerializer,
    TopicWriteSerializer,
    UserBriefSerializer,
)
from .throttles import AuthRateThrottle, UploadRateThrottle

User = get_user_model()


def _material_queryset():
    """带关联预取的资料基础集（不含可见性过滤）。"""
    return Material.objects.select_related('category', 'uploader').prefetch_related('tags')


def public_material_queryset():
    """公开可见的资料：必须公开且审核通过。全站默认只用这一套。"""
    return _material_queryset().filter(is_public=True, status=Material.Status.APPROVED)


def topic_queryset():
    """论坛帖子基础集，列表中额外 annotate 回复数。"""
    return (
        Topic.objects.select_related('board', 'author')
        .prefetch_related('tags')
        .annotate(reply_total=Count('posts', distinct=True))
    )


def notify(recipient, kind, text, url='', actor=None):
    """写一条站内通知；接收人为空或等于触发人时静默跳过。"""
    if recipient is None:
        return
    if actor is not None and recipient.pk == actor.pk:
        return
    Notification.objects.create(
        recipient=recipient,
        actor=actor,
        kind=kind,
        text=text[:200],
        url=url,
    )


class FavoritedIdsContextMixin:
    """把当前用户的收藏 id 集合塞进序列化上下文，避免逐条查询收藏状态。"""

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = getattr(self.request, 'user', None)
        context['favorited_ids'] = (
            set(Favorite.objects.filter(user=user).values_list('material_id', flat=True))
            if user and user.is_authenticated
            else set()
        )
        return context


# --------------------------------------------------------------------------
# 认证
# --------------------------------------------------------------------------


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_view(request):
    """前端启动时调用一次，确保拿到 csrftoken cookie，后续写请求带上它。"""
    return Response({'detail': 'CSRF cookie set'})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def register_view(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    email = (request.data.get('email') or '').strip()
    nickname = (request.data.get('nickname') or '').strip()

    if len(username) < 3:
        return Response({'detail': '用户名至少 3 个字符。'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'detail': '该用户名已被注册。'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except DjangoValidationError as exc:
        return Response({'detail': '；'.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        first_name=nickname,
    )
    login(request, user)
    return Response(
        {'user': CurrentUserSerializer(user).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login_view(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({'detail': '用户名或密码不正确。'}, status=status.HTTP_400_BAD_REQUEST)
    login(request, user)
    return Response({'user': CurrentUserSerializer(user).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': '已退出登录。'})


@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    """未登录返回 200 + user: null，避免前端首次进入就收到 403 报错。"""
    if not request.user.is_authenticated:
        return Response({'user': None})
    return Response({'user': CurrentUserSerializer(request.user).data})


# --------------------------------------------------------------------------
# 分类与标签
# --------------------------------------------------------------------------


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Tag.objects.annotate(material_count=Count('materials'))
        # ?hot=8 取被引用最多的标签，用于首页/侧边栏热门标签
        hot = self.request.query_params.get('hot')
        if hot:
            try:
                limit = max(1, min(int(hot), 30))
            except ValueError:
                limit = 8
            return qs.filter(material_count__gt=0).order_by('-material_count', 'name')[:limit]
        return qs.order_by('name')


# --------------------------------------------------------------------------
# 资料
# --------------------------------------------------------------------------


class MaterialViewSet(FavoritedIdsContextMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        # 注意：这里重写了 get_permissions，会覆盖 @action(permission_classes=...) 的声明，
        # 所以每个需要登录的 action 都必须在本方法里显式列出（download 曾因此漏掉，
        # 导致游客请求进入函数体并抛 500）。
        if self.action == 'review':
            return [IsAdminUser()]
        if self.action in (
            'create',
            'update',
            'partial_update',
            'destroy',
            'favorite',
            'download',
        ):
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def get_throttles(self):
        # 上传/提交走独立的按用户限流，其余请求用全站兜底限流
        if self.action == 'create':
            return [UploadRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        params = self.request.query_params
        user = self.request.user

        # 个人中心「我的上传」：含待审核 / 已驳回，只能看自己的
        if params.get('mine') in ('1', 'true', 'me'):
            if not user.is_authenticated:
                return Material.objects.none()
            qs = _material_queryset().filter(uploader=user)
        # 审核队列：仅管理员可查非公开状态的资料
        elif params.get('status') or params.get('all') in ('1', 'true'):
            if not (user.is_authenticated and user.is_staff):
                qs = public_material_queryset()
            else:
                qs = _material_queryset()
                status_param = params.get('status')
                if status_param:
                    qs = qs.filter(status=status_param)
        else:
            qs = public_material_queryset()
            # 详情与写操作额外放行：管理员看全部，普通用户看自己的（含待审/被驳回），
            # 否则作者根本无法打开、编辑自己被驳回的提交（会 404）。
            if self.action in ('retrieve', 'update', 'partial_update', 'destroy') and (
                user.is_authenticated
            ):
                if user.is_staff:
                    qs = _material_queryset()
                else:
                    qs = _material_queryset().filter(
                        Q(is_public=True, status=Material.Status.APPROVED) | Q(uploader=user)
                    )

        category = params.get('category')
        if category:
            if str(category).isdigit():
                qs = qs.filter(Q(category__slug=category) | Q(category_id=int(category)))
            else:
                qs = qs.filter(category__slug=category)

        tag = params.get('tag')
        if tag:
            qs = qs.filter(tags__name=tag)

        keyword = (params.get('search') or '').strip()
        if keyword:
            qs = qs.filter(
                Q(title__icontains=keyword)
                | Q(description__icontains=keyword)
                | Q(tags__name__icontains=keyword)
                | Q(category__name__icontains=keyword)
            ).distinct()

        ordering = params.get('ordering') or 'new'
        if ordering == 'downloads':
            return qs.order_by('-download_count', '-created_at')
        if ordering == 'favorites':
            return qs.annotate(favorite_total=Count('favorites', distinct=True)).order_by(
                '-favorite_total', '-created_at'
            )
        if ordering == 'oldest':
            return qs.order_by('created_at')
        return qs.order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return MaterialWriteSerializer
        if self.action == 'retrieve':
            return MaterialDetailSerializer
        return MaterialListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # 管理员直传即时通过；普通用户提交进入审核队列
        review_status = (
            Material.Status.APPROVED if request.user.is_staff else Material.Status.PENDING
        )
        material = serializer.save(status=review_status)
        ReviewLog.objects.create(
            material=material,
            reviewer=request.user,
            action=ReviewLog.Action.SUBMITTED,
            note='管理员直接上传' if request.user.is_staff else '提交审核',
        )
        if material.status == Material.Status.PENDING:
            for staff in User.objects.filter(is_staff=True):
                notify(
                    staff,
                    Notification.Kind.MATERIAL_SUBMITTED,
                    f'新资料待审核：《{material.title}》',
                    url='/review',
                    actor=request.user,
                )
        # 回包统一用只读结构，前端拿到的字段与列表页一致
        return Response(
            MaterialDetailSerializer(material, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def _ensure_can_manage(self, material):
        """资料的所有者或管理员才能改动。"""
        user = self.request.user
        if material.uploader_id != user.id and not user.is_staff:
            raise PermissionDenied('只能操作自己上传的资料。')

    def _update_material(self, request, partial):
        material = self.get_object()
        self._ensure_can_manage(material)
        serializer = MaterialWriteSerializer(
            material,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        was_rejected = material.status == Material.Status.REJECTED
        item = serializer.save()
        # 被驳回的资料，作者修改后自动回到待审核队列
        if was_rejected and not request.user.is_staff:
            item.status = Material.Status.PENDING
            item.review_note = ''
            item.reviewed_by = None
            item.reviewed_at = None
            item.save(update_fields=['status', 'review_note', 'reviewed_by', 'reviewed_at'])
            ReviewLog.objects.create(
                material=item,
                reviewer=request.user,
                action=ReviewLog.Action.RESUBMITTED,
                note='作者修改后重新提交',
            )
            for staff in User.objects.filter(is_staff=True):
                notify(
                    staff,
                    Notification.Kind.MATERIAL_SUBMITTED,
                    f'资料重新提交待审核：《{item.title}》',
                    url='/review',
                    actor=request.user,
                )
        return Response(MaterialDetailSerializer(item, context=self.get_serializer_context()).data)

    def update(self, request, *args, **kwargs):
        return self._update_material(request, partial=False)

    def partial_update(self, request, *args, **kwargs):
        return self._update_material(request, partial=True)

    def destroy(self, request, *args, **kwargs):
        material = self.get_object()
        self._ensure_can_manage(material)
        material.file.delete(save=False)
        material.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def review(self, request, pk=None):
        """管理员审核：action=approve 通过 / action=reject 驳回（必须填理由）。"""
        # 待审核资料不在公开查询集里，这里直接从全量取
        material = get_object_or_404(Material, pk=pk)
        decision = (request.data.get('action') or '').strip()
        note = (request.data.get('note') or '').strip()

        if decision == 'approve':
            material.status = Material.Status.APPROVED
            material.review_note = ''
        elif decision == 'reject':
            if not note:
                return Response(
                    {'detail': '驳回必须填写理由。'}, status=status.HTTP_400_BAD_REQUEST
                )
            material.status = Material.Status.REJECTED
            material.review_note = note[:200]
        else:
            return Response(
                {'detail': 'action 只能是 approve 或 reject。'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        material.reviewed_by = request.user
        material.reviewed_at = timezone.now()
        material.save(update_fields=['status', 'review_note', 'reviewed_by', 'reviewed_at'])

        approved = material.status == Material.Status.APPROVED
        ReviewLog.objects.create(
            material=material,
            reviewer=request.user,
            action=ReviewLog.Action.APPROVED if approved else ReviewLog.Action.REJECTED,
            note=material.review_note,
        )
        notify(
            material.uploader,
            Notification.Kind.MATERIAL_APPROVED
            if approved
            else Notification.Kind.MATERIAL_REJECTED,
            f'你的资料《{material.title}》' + ('已通过审核' if approved else '被驳回'),
            url=f'/materials/{material.id}',
            actor=request.user,
        )
        return Response(
            MaterialDetailSerializer(material, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        qs = self.get_queryset()[:8]
        return Response(
            MaterialListSerializer(qs, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=False, methods=['get'])
    def hot(self, request):
        qs = self.get_queryset().order_by('-download_count', '-created_at')[:8]
        return Response(
            MaterialListSerializer(qs, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=['get'])
    def related(self, request, pk=None):
        """相关资料：同分类优先，不足时用最新资料补齐。"""
        material = self.get_object()
        context = self.get_serializer_context()
        same_category = list(
            public_material_queryset().filter(category=material.category).exclude(pk=material.pk)[:4]
        )
        if len(same_category) < 4:
            exclude_ids = [material.pk] + [m.pk for m in same_category]
            same_category += list(
                public_material_queryset().exclude(pk__in=exclude_ids)[: 4 - len(same_category)]
            )
        return Response(MaterialListSerializer(same_category, many=True, context=context).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        """收藏/取消收藏开关，返回最新状态与收藏数。"""
        material = self.get_object()
        favorite, created = Favorite.objects.get_or_create(user=request.user, material=material)
        if not created:
            favorite.delete()
        return Response(
            {'is_favorited': created, 'favorite_count': material.favorites.count()}
        )

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated])
    def download(self, request, pk=None):
        """下载文件并累加下载量（仅登录用户），同时写一条下载记录。"""
        material = self.get_object()
        Material.objects.filter(pk=material.pk).update(
            download_count=F('download_count') + 1
        )
        DownloadRecord.objects.create(user=request.user, material=material)

        if not material.file:
            raise Http404('该资料没有可下载的文件。')
        try:
            file_path = material.file.path
        except NotImplementedError:
            file_path = None
        if not file_path or not os.path.exists(file_path):
            raise Http404('文件不存在或已被移除。')

        return FileResponse(
            open(file_path, 'rb'),
            as_attachment=True,
            filename=material.original_name or os.path.basename(material.file.name),
        )

    @action(
        detail=True,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def comments(self, request, pk=None):
        """资料评论：GET 取一级评论（含回复，时间倒序，可分页），POST 发帖或回复。"""
        material = self.get_object()
        context = self.get_serializer_context()

        if request.method == 'GET':
            qs = (
                material.comments.filter(parent__isnull=True)
                .select_related('author')
                .prefetch_related('replies__author')
                .order_by('-created_at')
            )
            page = self.paginate_queryset(qs)
            if page is not None:
                serializer = CommentSerializer(page, many=True, context=context)
                return self.get_paginated_response(serializer.data)
            return Response(CommentSerializer(qs, many=True, context=context).data)

        if not request.user.is_authenticated:
            return Response({'detail': '请先登录后再评论。'}, status=status.HTTP_401_UNAUTHORIZED)

        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': '评论内容不能为空。'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 1000:
            return Response({'detail': '评论内容不能超过 1000 字。'}, status=status.HTTP_400_BAD_REQUEST)

        parent_id = request.data.get('parent')
        parent = None
        if parent_id:
            parent = get_object_or_404(Comment, pk=parent_id, material=material)
            # 只支持两级：回复"回复"时，挂到其所属的一级评论下
            if parent.parent_id is not None:
                parent = parent.parent

        comment = Comment.objects.create(
            material=material,
            author=request.user,
            parent=parent,
            content=content,
        )
        if parent is not None:
            notify(
                parent.author,
                Notification.Kind.COMMENT_REPLY,
                f'{request.user.first_name or request.user.username} 回复了你在《{material.title}》下的评论',
                url=f'/materials/{material.id}',
                actor=request.user,
            )
        return Response(
            CommentSerializer(comment, context=context).data,
            status=status.HTTP_201_CREATED,
        )


# --------------------------------------------------------------------------
# 评论删除
# --------------------------------------------------------------------------


class CommentViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """评论的编辑与删除：都限作者本人或管理员。"""

    queryset = Comment.objects.select_related('author', 'material')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]

    def _ensure_can_manage(self, comment):
        if comment.author_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('只能修改自己的评论。')

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        self._ensure_can_manage(comment)
        serializer = self.get_serializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        # 记录编辑时间，前端展示"已编辑"
        comment = serializer.save(edited_at=timezone.now())
        return Response(CommentSerializer(comment, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        self._ensure_can_manage(comment)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# 个人中心：收藏 / 评论 / 下载记录
# --------------------------------------------------------------------------


class FavoriteViewSet(FavoritedIdsContextMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Favorite.objects.filter(user=self.request.user)
            .select_related('material__category', 'material__uploader')
            .prefetch_related('material__tags')
        )


class MyCommentViewSet(FavoritedIdsContextMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = MyCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Comment.objects.filter(author=self.request.user)
            .select_related('author', 'material')
            .order_by('-created_at')
        )


class DownloadRecordViewSet(FavoritedIdsContextMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = DownloadRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            DownloadRecord.objects.filter(user=self.request.user)
            .select_related('material__category', 'material__uploader')
            .prefetch_related('material__tags')
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """个人中心统计数字。"""
    user = request.user
    return Response(
        {
            'user': CurrentUserSerializer(user).data,
            'stats': {
                'uploads': Material.objects.filter(uploader=user).count(),
                'pending': Material.objects.filter(
                    uploader=user, status=Material.Status.PENDING
                ).count(),
                'comments': Comment.objects.filter(author=user).count(),
                'favorites': Favorite.objects.filter(user=user).count(),
                'downloads': DownloadRecord.objects.filter(user=user).count(),
                'topics': Topic.objects.filter(author=user).count(),
                'posts': Post.objects.filter(author=user).count(),
                'notifications_unread': Notification.objects.filter(
                    recipient=user, is_read=False
                ).count(),
            },
        }
    )


# --------------------------------------------------------------------------
# 论坛社区
# --------------------------------------------------------------------------


class BoardViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumBoard.objects.all()
    serializer_class = ForumBoardSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class TopicViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        # 注意：重写本方法会覆盖 @action(permission_classes=...)，管理员专属动作必须显式列出，
        # 否则普通登录用户也能调用（置顶/加精曾因此漏判）。
        if self.action in ('pin', 'feature'):
            return [IsAdminUser()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def get_queryset(self):
        qs = topic_queryset()
        params = self.request.query_params

        board = params.get('board')
        if board:
            if str(board).isdigit():
                qs = qs.filter(Q(board__slug=board) | Q(board_id=int(board)))
            else:
                qs = qs.filter(board__slug=board)

        keyword = (params.get('search') or '').strip()
        if keyword:
            qs = qs.filter(
                Q(title__icontains=keyword)
                | Q(content__icontains=keyword)
                | Q(tags__name__icontains=keyword)
            ).distinct()

        ordering = params.get('ordering') or 'new'
        if ordering == 'hot':
            # 热门回复：按回复数排序
            return qs.order_by('-is_pinned', '-reply_total', '-created_at')
        if ordering == 'views':
            return qs.order_by('-is_pinned', '-views', '-created_at')
        # 置顶帖永远排在最前
        return qs.order_by('-is_pinned', '-created_at')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return TopicWriteSerializer
        if self.action == 'retrieve':
            return TopicDetailSerializer
        return TopicListSerializer

    def retrieve(self, request, *args, **kwargs):
        topic = self.get_object()
        # 浏览量自增，用 update 避免顺带改掉 updated_at
        Topic.objects.filter(pk=topic.pk).update(views=F('views') + 1)
        topic.views += 1
        return Response(self.get_serializer(topic).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.save()
        return Response(
            TopicDetailSerializer(topic, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def _ensure_can_manage(self, topic):
        """作者或管理员才能编辑/删除帖子。"""
        user = self.request.user
        if topic.author_id != user.id and not user.is_staff:
            raise PermissionDenied('只能管理自己发布的帖子。')

    def update(self, request, *args, **kwargs):
        topic = self.get_object()
        self._ensure_can_manage(topic)
        serializer = TopicWriteSerializer(
            topic,
            data=request.data,
            partial=kwargs.pop('partial', False),
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TopicDetailSerializer(topic, context=self.get_serializer_context()).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        topic = self.get_object()
        self._ensure_can_manage(topic)
        topic.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def pin(self, request, pk=None):
        """置顶 / 取消置顶，仅管理员。"""
        topic = get_object_or_404(Topic, pk=pk)
        topic.is_pinned = not topic.is_pinned
        topic.save(update_fields=['is_pinned'])
        return Response({'is_pinned': topic.is_pinned})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def feature(self, request, pk=None):
        """加精 / 取消加精，仅管理员。"""
        topic = get_object_or_404(Topic, pk=pk)
        topic.is_featured = not topic.is_featured
        topic.save(update_fields=['is_featured'])
        return Response({'is_featured': topic.is_featured})

    @action(
        detail=True,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticatedOrReadOnly],
    )
    def posts(self, request, pk=None):
        """楼层回复：GET 一级楼层（含二级，按时间正序、分页），POST 发表回复。"""
        topic = self.get_object()
        context = self.get_serializer_context()

        if request.method == 'GET':
            qs = (
                topic.posts.filter(parent__isnull=True)
                .select_related('author')
                .prefetch_related('replies__author')
                .order_by('floor', 'created_at')
            )
            page = self.paginate_queryset(qs)
            data = PostSerializer(
                page if page is not None else qs, many=True, context=context
            ).data
            if page is not None:
                return self.get_paginated_response(data)
            return Response(data)

        if not request.user.is_authenticated:
            return Response({'detail': '请先登录后再回复。'}, status=status.HTTP_401_UNAUTHORIZED)

        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': '回复内容不能为空。'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 1000:
            return Response(
                {'detail': '回复内容不能超过 1000 字。'}, status=status.HTTP_400_BAD_REQUEST
            )

        parent_id = request.data.get('parent')
        parent = None
        floor = None
        if parent_id:
            parent = get_object_or_404(Post, pk=parent_id, topic=topic)
            # 只支持两级：回复"回复"时挂到所属的一级楼层
            if parent.parent_id is not None:
                parent = parent.parent
        else:
            # 一级楼层号 = 现有楼层数 + 1
            floor = topic.posts.filter(parent__isnull=True).count() + 1

        post = Post.objects.create(
            topic=topic,
            author=request.user,
            parent=parent,
            content=content,
            floor=floor,
        )
        # 通知楼主与被打断的楼层作者（给自己发会被 notify 跳过）
        author_name = request.user.first_name or request.user.username
        notify(
            topic.author,
            Notification.Kind.POST_REPLY,
            f'{author_name} 回复了你的帖子《{topic.title}》',
            url=f'/forum/topic/{topic.id}',
            actor=request.user,
        )
        if parent is not None:
            notify(
                parent.author,
                Notification.Kind.POST_REPLY,
                f'{author_name} 回复了你在《{topic.title}》中的楼层',
                url=f'/forum/topic/{topic.id}',
                actor=request.user,
            )
        return Response(PostSerializer(post, context=context).data, status=status.HTTP_201_CREATED)


class PostViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """楼层回复的编辑与删除：作者本人或管理员。"""

    queryset = Post.objects.select_related('author', 'topic')
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated]

    def _ensure_can_manage(self, post):
        if post.author_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('只能修改自己的回复。')

    def update(self, request, *args, **kwargs):
        post = self.get_object()
        self._ensure_can_manage(post)
        serializer = self.get_serializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(edited_at=timezone.now())
        return Response(PostSerializer(post, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        self._ensure_can_manage(post)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyTopicViewSet(viewsets.ReadOnlyModelViewSet):
    """个人中心「我的帖子」。"""

    serializer_class = TopicListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return topic_queryset().filter(author=self.request.user).order_by('-created_at')


class MyPostViewSet(viewsets.ReadOnlyModelViewSet):
    """个人中心「我的回复」。"""

    serializer_class = MyPostSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Post.objects.filter(author=self.request.user)
            .select_related('author', 'topic')
            .order_by('-created_at')
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def search_view(request):
    """全局搜索：同时匹配资料（标题/简介/标签/分类）与论坛帖子（标题/正文/标签）。"""
    keyword = (request.query_params.get('q') or '').strip()
    if not keyword:
        return Response(
            {'query': '', 'material_total': 0, 'topic_total': 0, 'materials': [], 'topics': []}
        )

    materials = (
        public_material_queryset()
        .filter(
            Q(title__icontains=keyword)
            | Q(description__icontains=keyword)
            | Q(tags__name__icontains=keyword)
            | Q(category__name__icontains=keyword)
        )
        .distinct()
    )
    topics = (
        topic_queryset()
        .filter(
            Q(title__icontains=keyword)
            | Q(content__icontains=keyword)
            | Q(tags__name__icontains=keyword)
        )
        .distinct()
    )
    context = {'request': request}
    return Response(
        {
            'query': keyword,
            'material_total': materials.count(),
            'topic_total': topics.count(),
            'materials': MaterialListSerializer(materials[:8], many=True, context=context).data,
            'topics': TopicListSerializer(topics[:8], many=True, context=context).data,
        }
    )


# --------------------------------------------------------------------------
# 站内通知
# --------------------------------------------------------------------------


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """站内通知：列表 + 未读数 + 标记已读。"""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related('actor')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        return Response({'count': self.get_queryset().filter(is_read=False).count()})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'updated': updated})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        item = self.get_object()
        if not item.is_read:
            item.is_read = True
            item.save(update_fields=['is_read'])
        return Response(NotificationSerializer(item).data)
