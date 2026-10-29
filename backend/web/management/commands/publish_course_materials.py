"""发布课程参考 PDF 与试运行公告。

默认从仓库根目录的 docs/reference/visualization 读取四份 PDF：
    python manage.py publish_course_materials

课程文件已经迁入媒体库时可跳过文件处理：
    python manage.py publish_course_materials --metadata-only

首次本地发布后不保留第二份大文件，可使用 --move 将源文件移入媒体库。
"""

from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from web.models import Category, ForumBoard, Material, ReviewLog, Tag, Topic

User = get_user_model()


MATERIALS = (
    {
        'filename': '地理科学导论.pdf',
        'title': '地理科学导论',
        'category': 'other',
        'description': (
            '地理科学专业入门课程参考教材，介绍地理学的研究对象、分支体系、'
            '基本方法与学科发展，适合系统了解地理科学的整体框架。'
        ),
        'tags': ('地理科学', '导论', '课程资料'),
    },
    {
        'filename': '地图学.pdf',
        'title': '地图学',
        'category': 'gis',
        'description': (
            '地图学课程参考教材，涉及地图投影、符号设计、制图综合与地图阅读，'
            '适合地图学学习、复习和教学查阅。'
        ),
        'tags': ('地图学', '课程资料'),
    },
    {
        'filename': '地质学基础与地貌学.pdf',
        'title': '地质学基础与地貌学',
        'category': 'physical',
        'description': (
            '地质学基础与地貌学课程参考教材，涵盖地质作用、岩矿基础、构造演化'
            '与地貌形成，适合自然地理相关课程学习。'
        ),
        'tags': ('地质地貌', '课程资料'),
    },
    {
        'filename': 'Python程序设计与应用.pdf',
        'title': 'Python 程序设计与应用',
        'category': 'other',
        'description': (
            'Python 程序设计课程参考教材，覆盖基础语法、程序结构与常用应用，'
            '适合编程入门及地理数据处理学习。'
        ),
        'tags': ('Python', '程序设计', '课程资料'),
    },
)


ANNOUNCEMENT_TITLE = 'GeoHub 试运行公告：欢迎提出意见与建议'
ANNOUNCEMENT_CONTENT = """# GeoHub 开始试运行

GeoHub 现已进入试运行阶段，资料分享、论坛交流和可视化实验室均已开放。

试运行期间，部分资料、页面与功能仍在持续完善。如果你遇到问题，或对资料分类、检索、下载、论坛体验和可视化实验有任何建议，欢迎在本帖下回复，也可以在相应资料或帖子中留言。

为了便于定位问题，反馈时请尽量说明：

- 使用的设备与浏览器
- 出现问题的页面或操作
- 你期望的改进方式

感谢参与测试，也欢迎分享对课程学习有帮助的资料。
"""


class Command(BaseCommand):
    help = '发布四份课程参考 PDF，并创建一条置顶试运行公告'

    def add_arguments(self, parser):
        parser.add_argument(
            '--source',
            type=Path,
            help='PDF 源目录，默认 docs/reference/visualization',
        )
        parser.add_argument(
            '--move',
            action='store_true',
            help='文件成功写入媒体库后删除源文件，避免本地保留重复副本',
        )
        parser.add_argument(
            '--metadata-only',
            action='store_true',
            help='只更新资料元数据，不读取或写入 PDF 文件',
        )

    def handle(self, *args, **options):
        source_dir = options['source'] or (
            Path(settings.BASE_DIR).parent / 'docs' / 'reference' / 'visualization'
        )
        if not options['metadata_only'] and not source_dir.is_dir():
            raise CommandError(f'PDF 源目录不存在：{source_dir}')

        uploader = (
            User.objects.filter(is_superuser=True).order_by('id').first()
            or User.objects.filter(is_staff=True).order_by('id').first()
        )
        if uploader is None:
            raise CommandError('数据库中没有可用的管理员账号。')

        with transaction.atomic():
            other_category = self.ensure_category(
                '其他',
                'other',
                '不属于上述分类的资料：工具、模板、杂项等',
                5,
            )
            self.ensure_category(
                '自然地理',
                'physical',
                '地质地貌、气象与气候、水文、土壤、生物、自然灾害',
                1,
            )
            self.ensure_category(
                'GIS遥感',
                'gis',
                '地图学、地理信息系统、遥感技术',
                3,
            )
            self.ensure_board(
                '学习交流',
                'study',
                '选课、考研、竞赛、软件使用等学习经验交流',
                6,
            )

            for item in MATERIALS:
                self.publish_material(
                    item,
                    source_dir,
                    uploader,
                    move=options['move'],
                    metadata_only=options['metadata_only'],
                )

            self.publish_announcement(uploader)

        self.stdout.write(
            self.style.SUCCESS(
                f'发布完成：新增/更新 {len(MATERIALS)} 份资料，并置顶试运行公告；'
                f'“其他”分类当前有 {other_category.materials.count()} 份资料。'
            )
        )

    def ensure_category(self, name, slug, description, order):
        category, created = Category.objects.get_or_create(
            slug=slug,
            defaults={
                'name': name,
                'description': description,
                'order': order,
            },
        )
        action = '新建' if created else '使用'
        self.stdout.write(f'{action}资料分类：{category.name}（{category.slug}）')
        return category

    def ensure_board(self, name, slug, description, order):
        board, created = ForumBoard.objects.get_or_create(
            slug=slug,
            defaults={
                'name': name,
                'description': description,
                'order': order,
            },
        )
        action = '新建' if created else '使用'
        self.stdout.write(f'{action}论坛板块：{board.name}（{board.slug}）')
        return board

    def publish_material(self, item, source_dir, uploader, *, move, metadata_only):
        category = Category.objects.get(slug=item['category'])
        source = source_dir / item['filename']
        material = Material.objects.filter(title=item['title']).first()
        created = material is None

        if material is None:
            material = Material(
                title=item['title'],
                uploader=uploader,
                is_public=True,
            )

        material.category = category
        material.description = item['description']
        material.status = Material.Status.APPROVED
        material.review_note = ''
        material.reviewed_by = uploader
        material.reviewed_at = timezone.now()
        material.is_public = True

        stored_file_exists = bool(
            material.file and material.file.storage.exists(material.file.name)
        )
        if not metadata_only and not stored_file_exists:
            if not source.is_file():
                raise CommandError(f'缺少课程 PDF：{source}')
            material.original_name = source.name
            material.file_ext = source.suffix.lower()
            material.file_size = source.stat().st_size
            with source.open('rb') as handle:
                material.file.save(source.name, File(handle), save=False)
            material.save()
        else:
            if not material.original_name:
                material.original_name = source.name
            if not material.file_ext:
                material.file_ext = '.pdf'
            if not material.file_size and material.file and stored_file_exists:
                material.file_size = material.file.size
            material.save()

        tag_names = item['tags']
        tags = [
            Tag.objects.update_or_create(
                name=name,
                defaults={
                    # “课程资料”会跨分类复用，保持为通用标签；
                    # 其余标签跟随资料所属分类。
                    'category': None if name == '课程资料' else category,
                },
            )[0]
            for name in tag_names
        ]
        material.tags.set(tags)
        ReviewLog.objects.get_or_create(
            material=material,
            action=ReviewLog.Action.SUBMITTED,
            note='管理员直接发布课程参考教材',
            defaults={'reviewer': uploader},
        )

        if move and source.is_file() and stored_file_exists:
            source.unlink()
        elif move and source.is_file() and not metadata_only:
            source.unlink()

        action = '新增' if created else '更新'
        self.stdout.write(
            f'{action}资料：{material.title} → {category.name}'
            f'（{material.file_size / 1024 / 1024:.2f} MB）'
        )
        return material

    def publish_announcement(self, uploader):
        board = ForumBoard.objects.get(slug='study')
        topic, created = Topic.objects.get_or_create(
            title=ANNOUNCEMENT_TITLE,
            defaults={
                'board': board,
                'author': uploader,
                'content': ANNOUNCEMENT_CONTENT,
                'is_pinned': True,
            },
        )
        topic.board = board
        topic.author = uploader
        topic.content = ANNOUNCEMENT_CONTENT
        topic.is_pinned = True
        topic.save(
            update_fields=['board', 'author', 'content', 'is_pinned', 'updated_at']
        )
        topic.tags.set(
            [
                Tag.objects.get_or_create(name=name)[0]
                for name in ('公告', '试运行', '意见反馈')
            ]
        )
        action = '新增' if created else '更新'
        self.stdout.write(f'{action}置顶公告：{topic.title}')
        return topic
