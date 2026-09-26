"""初始化基础数据：五个资料分类、六个论坛板块、各分类常用标签。

用法：
    python manage.py seed_data                     # 创建/更新分类、板块与标签
    python manage.py seed_data --prune-categories  # 额外删除不在清单里的空分类
    python manage.py seed_data --demo              # 追加三份示例资料
    python manage.py seed_data --clear-demo        # 删除示例资料（按标记识别）
"""

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from web.models import Category, ForumBoard, Material, Post, Tag, Topic

User = get_user_model()

# 分类：名称、slug（前端据 slug 映射线性图标）、简介、排序
CATEGORIES = [
    ('自然地理', 'physical', '地质地貌、气象与气候、水文、土壤、生物、自然灾害', 1),
    ('人文地理', 'human', '经济、人口、城市、交通', 2),
    ('GIS遥感', 'gis', '地图学、地理信息系统、遥感技术', 3),
    ('数理基础', 'math', '高等数学、线性代数、概率统计、大学物理等专业基础课', 4),
    ('其他', 'other', '不属于上述分类的资料：工具、模板、杂项等', 5),
]

# 标签：全局共用（资料与帖子都可以挂），这里把各分类下的常用标签先建好
TAGS = [
    # 自然地理
    '地质地貌',
    '气象与气候',
    '水文',
    '土壤',
    '生物',
    '自然灾害',
    # 人文地理
    '经济',
    '人口',
    '城市',
    '交通',
    # GIS 与遥感
    '地图学',
    'GIS',
    '遥感',
    # 数理基础
    '数学',
    '物理',
]

# 论坛板块：前五个与资料分类对应，外加"学习交流"
BOARDS = [
    ('自然地理', 'physical', '地貌、气候、水文、土壤、植被等自然地理话题', 1),
    ('人文地理', 'human', '人口、城市、经济、文化、旅游等人文地理话题', 2),
    ('GIS与遥感', 'gis', '地理信息系统、遥感技术、空间分析与专题制图', 3),
    ('区域地理', 'regional', '中国与世界各区域的地理特征与区域差异', 4),
    ('地质地貌', 'geology', '地质构造、岩石矿物、地貌演化与地质灾害', 5),
    ('学习交流', 'study', '选课、考研、竞赛、软件使用等学习经验交流', 6),
]

DEMO_MARK = '【演示数据】'

DEMO_MATERIALS = [
    {
        'title': '中国自然地理分区概述',
        'category': 'physical',
        'description': (
            '按地形、气候与水文特征梳理中国三大自然区（东部季风区、西北干旱半干旱区、'
            '青藏高寒区）的划分依据与主要差异，附常用分区指标对照。'
        ),
        'tags': ['气象与气候', '水文'],
    },
    {
        'title': 'GIS 空间分析方法整理',
        'category': 'gis',
        'description': (
            '汇总缓冲区分析、叠加分析、网络分析、插值与栅格计算的基本原理与适用场景，'
            '并给出 ArcGIS 中的操作路径与常见坑位。'
        ),
        'tags': ['GIS', '地图学'],
    },
    {
        'title': '板块构造与地貌演化笔记',
        'category': 'physical',
        'description': (
            '从板块边界类型出发，整理挤压、张裂、剪切三种构造背景下对应的地貌组合，'
            '并附典型实例（喜马拉雅、东非大裂谷、圣安地列斯断层）。'
        ),
        'tags': ['地质地貌', '自然灾害'],
    },
]

# 示例帖子：带楼层回复，用于展示论坛效果
DEMO_TOPICS = [
    {
        'board': 'gis',
        'title': '缓冲区分析和叠加分析的先后顺序会互相影响吗？',
        'content': (
            '做土地利用适宜性评价时，我先做缓冲区再做叠加，和反过来做的结果边界不太一样。\n'
            '想确认一下：这两个操作的顺序在原理上是否会影响结果？如果会，一般建议怎么排？'
        ),
        'tags': ['空间分析', 'ArcGIS'],
        'replies': [
            '会影响。缓冲区本身会改变要素的几何范围，先裁剪还是先缓冲，边界处的结果会差一点。'
            '常规做法是先把所有参与运算的图层统一坐标系和精度，再按"先缓冲、后叠加"的顺序处理。',
            '补充一点：如果数据是栅格的，像元大小和是否对齐也会明显影响结果，建议叠加前先重采样到同一网格。',
        ],
    },
    {
        'board': 'study',
        'title': '自然地理和人文地理期末复习怎么分配时间？',
        'content': (
            '这学期两门课都考，自然地理记的东西多，人文地理更偏理解。\n'
            '想听听大家怎么分配复习时间，以及有没有推荐的真题训练顺序。'
        ),
        'tags': ['复习', '经验'],
        'replies': [
            '先把自然地理的图件和成因链条过一遍，这部分遗忘最快；人文地理可以放在考前两三天集中梳理案例。',
        ],
    },
]


def build_minimal_pdf(title: str, body: str) -> bytes:
    """生成一份结构完整（含正确 xref）的最小 PDF，供演示下载使用。"""
    lines = [title, '', body]
    text_ops = []
    y = 780
    for index, line in enumerate(lines):
        size = 18 if index == 0 else 11
        escaped = line.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')
        text_ops.append(f'BT /F1 {size} Tf 60 {y} Td ({escaped}) Tj ET')
        y -= 26 if index == 0 else 18
    stream = ('\n'.join(text_ops)).encode('utf-8')

    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        (
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
            b'/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>'
        ),
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]

    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for number, body_bytes in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f'{number} 0 obj\n'.encode() + body_bytes + b'\nendobj\n'

    xref_position = len(out)
    total = len(objects) + 1
    out += f'xref\n0 {total}\n'.encode()
    out += b'0000000000 65535 f \n'
    for offset in offsets:
        out += f'{offset:010d} 00000 n \n'.encode()
    out += (
        f'trailer\n<< /Size {total} /Root 1 0 R >>\nstartxref\n{xref_position}\n%%EOF\n'
    ).encode()
    return bytes(out)


class Command(BaseCommand):
    help = '初始化资料分类，可选生成/清理示例资料'

    def add_arguments(self, parser):
        parser.add_argument('--demo', action='store_true', help='同时生成三份示例资料')
        parser.add_argument('--clear-demo', action='store_true', help='删除示例资料')
        parser.add_argument(
            '--prune-categories',
            action='store_true',
            help='删除不在清单里的分类（只删没有任何资料的，避免误伤）',
        )

    def handle(self, *args, **options):
        if options['clear_demo']:
            self.clear_demo()
            return

        self.sync_categories()
        self.sync_boards()
        self.sync_tags()
        if options['prune_categories']:
            self.prune_categories()
        if options['demo']:
            self.create_demo()

    def sync_categories(self):
        for name, slug, description, order in CATEGORIES:
            category, created = Category.objects.update_or_create(
                slug=slug,
                defaults={'name': name, 'description': description, 'order': order},
            )
            flag = '新建' if created else '更新'
            self.stdout.write(f'  {flag}分类：{category.name}（{category.slug}）')
        self.stdout.write(self.style.SUCCESS(f'分类就绪，共 {Category.objects.count()} 个'))

    def sync_tags(self):
        created_count = 0
        for name in TAGS:
            _, created = Tag.objects.get_or_create(name=name)
            created_count += int(created)
        self.stdout.write(
            self.style.SUCCESS(
                f'标签就绪：本次新建 {created_count} 个，共 {Tag.objects.count()} 个'
            )
        )

    def prune_categories(self):
        """删除已不在清单里的分类。

        只删「没有任何资料」的分类：有资料的会被保留并打印出来，
        提醒维护者先决定这些资料迁到哪个分类，避免误删造成资料失去归类。
        """
        keep = {slug for _, slug, _, _ in CATEGORIES}
        removed, kept = [], []
        for category in Category.objects.exclude(slug__in=keep):
            count = category.materials.count()
            if count:
                kept.append(f'{category.name}（{count} 份资料）')
                continue
            removed.append(category.name)
            category.delete()
        if removed:
            self.stdout.write(self.style.WARNING(f'已删除空分类：{"、".join(removed)}'))
        if kept:
            self.stdout.write(
                self.style.WARNING(f'这些分类还有资料，已保留：{"、".join(kept)}')
            )
        if not removed and not kept:
            self.stdout.write('没有需要清理的分类。')

    def sync_boards(self):
        for name, slug, description, order in BOARDS:
            board, created = ForumBoard.objects.update_or_create(
                slug=slug,
                defaults={'name': name, 'description': description, 'order': order},
            )
            flag = '新建' if created else '更新'
            self.stdout.write(f'  {flag}板块：{board.name}（{board.slug}）')
        self.stdout.write(self.style.SUCCESS(f'板块就绪，共 {ForumBoard.objects.count()} 个'))

    def pick_uploader(self):
        return (
            User.objects.filter(is_superuser=True).order_by('id').first()
            or User.objects.order_by('id').first()
        )

    def create_demo(self):
        uploader = self.pick_uploader()
        if uploader is None:
            self.stderr.write('数据库中没有用户，先创建用户再生成示例资料。')
            return

        for item in DEMO_MATERIALS:
            title = f'{DEMO_MARK}{item["title"]}'
            if Material.objects.filter(title=title).exists():
                self.stdout.write(f'  已存在，跳过：{title}')
                continue
            category = Category.objects.get(slug=item['category'])
            # PDF 用内置 Helvetica 字体，无法渲染中文，演示文件正文统一用 ASCII
            pdf_bytes = build_minimal_pdf(
                f'mywebsite demo - {item["category"]}',
                'Generated demo file for upload/download testing.\n'
                f'Category slug: {item["category"]}\n'
                'Upload real material from the site to replace it.',
            )
            material = Material(
                title=title,
                category=category,
                description=item['description'],
                uploader=uploader,
                original_name=f'{item["title"]}.pdf',
                file_ext='.pdf',
                file_size=len(pdf_bytes),
                # 演示数据由管理员生成，直接置为已通过
                status=Material.Status.APPROVED,
            )
            material.file.save(f'demo-{item["category"]}.pdf', ContentFile(pdf_bytes), save=False)
            material.save()
            material.tags.set(
                [Tag.objects.get_or_create(name=name)[0] for name in item['tags']]
            )
            self.stdout.write(f'  新增示例资料：{material.title}（{material.file_size} 字节）')
        self.stdout.write(self.style.SUCCESS(f'示例资料就绪，共 {Material.objects.count()} 份'))

        self.create_demo_topics(uploader)

    def create_demo_topics(self, uploader):
        created_any = False
        for item in DEMO_TOPICS:
            title = f'{DEMO_MARK}{item["title"]}'
            if Topic.objects.filter(title=title).exists():
                self.stdout.write(f'  已存在，跳过帖子：{title}')
                continue
            topic = Topic.objects.create(
                board=ForumBoard.objects.get(slug=item['board']),
                author=uploader,
                title=title,
                content=item['content'],
            )
            topic.tags.set([Tag.objects.get_or_create(name=name)[0] for name in item['tags']])
            for index, reply in enumerate(item['replies'], start=1):
                Post.objects.create(
                    topic=topic,
                    author=uploader,
                    content=reply,
                    floor=index,
                )
            created_any = True
            self.stdout.write(f'  新增示例帖子：{topic.title}（{len(item["replies"])} 层回复）')
        if created_any:
            self.stdout.write(
                self.style.SUCCESS(f'示例帖子就绪，共 {Topic.objects.count()} 个主题')
            )

    def clear_demo(self):
        queryset = Material.objects.filter(title__startswith=DEMO_MARK)
        count = queryset.count()
        for material in queryset:
            material.file.delete(save=False)
        queryset.delete()
        topic_count = Topic.objects.filter(title__startswith=DEMO_MARK).count()
        Topic.objects.filter(title__startswith=DEMO_MARK).delete()
        self.stdout.write(
            self.style.SUCCESS(f'已删除 {count} 份示例资料、{topic_count} 个示例帖子')
        )
