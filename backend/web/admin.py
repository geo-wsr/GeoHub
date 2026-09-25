from django.contrib import admin

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


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'description')
    list_editable = ('order',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'category',
        'uploader',
        'status',
        'file_ext',
        'file_size',
        'download_count',
        'is_public',
        'created_at',
    )
    list_filter = ('status', 'category', 'is_public', 'file_ext', 'tags')
    list_editable = ('status',)
    search_fields = ('title', 'description', 'original_name')
    date_hierarchy = 'created_at'
    filter_horizontal = ('tags',)
    readonly_fields = (
        'download_count',
        'file_size',
        'created_at',
        'updated_at',
        'reviewed_by',
        'reviewed_at',
    )
    actions = ('approve_selected', 'reject_selected')

    @admin.action(description='通过所选资料（设为已通过）')
    def approve_selected(self, request, queryset):
        from django.utils import timezone

        updated = queryset.update(
            status=Material.Status.APPROVED,
            review_note='',
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f'已通过 {updated} 份资料')

    @admin.action(description='驳回所选资料（理由为默认文案，可在详情页修改）')
    def reject_selected(self, request, queryset):
        from django.utils import timezone

        updated = queryset.update(
            status=Material.Status.REJECTED,
            review_note='后台批量驳回，具体原因请咨询管理员。',
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f'已驳回 {updated} 份资料')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('material', 'author', 'parent', 'short_content', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('content',)
    date_hierarchy = 'created_at'

    @admin.display(description='内容')
    def short_content(self, obj):
        return obj.content[:40]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'material', 'created_at')
    search_fields = ('user__username', 'material__title')


@admin.register(DownloadRecord)
class DownloadRecordAdmin(admin.ModelAdmin):
    list_display = ('user', 'material', 'created_at')
    search_fields = ('user__username', 'material__title')


@admin.register(ForumBoard)
class ForumBoardAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'description')
    list_editable = ('order',)
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'board', 'author', 'views', 'is_pinned', 'is_featured', 'created_at')
    list_filter = ('board', 'is_pinned', 'is_featured', 'tags')
    list_editable = ('is_pinned', 'is_featured')
    search_fields = ('title', 'content')
    date_hierarchy = 'created_at'
    filter_horizontal = ('tags',)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('topic', 'floor', 'author', 'parent', 'short_content', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('content',)
    date_hierarchy = 'created_at'

    @admin.display(description='内容')
    def short_content(self, obj):
        return obj.content[:40]


@admin.register(ReviewLog)
class ReviewLogAdmin(admin.ModelAdmin):
    list_display = ('material', 'action', 'reviewer', 'note', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('material__title', 'note')
    date_hierarchy = 'created_at'


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'kind', 'text', 'is_read', 'created_at')
    list_filter = ('kind', 'is_read', 'created_at')
    search_fields = ('recipient__username', 'text')
