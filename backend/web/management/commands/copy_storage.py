"""把一个对象存储桶里的对象整体搬到另一个桶。

典型用途：Supabase Storage → Filebase（或反过来，或搬到 Cloudflare R2）。
为什么需要它：换存储商时，数据库里存的是**相对路径**（如 materials/xxx.pdf），
只要新桶里有同名对象、且环境变量指向新桶，站点就不用改任何数据。

两端凭据都用环境变量传，互不干扰：

    SRC_S3_ENDPOINT / SRC_S3_REGION / SRC_S3_BUCKET / SRC_S3_KEY / SRC_S3_SECRET
    DST_S3_ENDPOINT / DST_S3_REGION / DST_S3_BUCKET / DST_S3_KEY / DST_S3_SECRET

用法：
    python manage.py copy_storage --dry-run        # 只列出要搬的对象和总量
    python manage.py copy_storage                  # 真正搬迁
    python manage.py copy_storage --prefix avatars # 只搬某个前缀
"""

import os
import tempfile

import boto3
from botocore.config import Config
from django.core.management.base import BaseCommand, CommandError


REQUIRED = {
    'SRC': ('SRC_S3_ENDPOINT', 'SRC_S3_BUCKET', 'SRC_S3_KEY', 'SRC_S3_SECRET'),
    'DST': ('DST_S3_ENDPOINT', 'DST_S3_BUCKET', 'DST_S3_KEY', 'DST_S3_SECRET'),
}


def build_client(prefix):
    """按前缀读环境变量创建 boto3 S3 客户端。"""
    missing = [name for name in REQUIRED[prefix] if not os.environ.get(name)]
    if missing:
        raise CommandError(
            f'缺少环境变量：{"、".join(missing)}。'
            f'（{prefix} 侧需要 endpoint / bucket / key / secret）'
        )
    return boto3.client(
        's3',
        endpoint_url=os.environ[f'{prefix}_S3_ENDPOINT'],
        region_name=os.environ.get(f'{prefix}_S3_REGION', 'auto'),
        aws_access_key_id=os.environ[f'{prefix}_S3_KEY'],
        aws_secret_access_key=os.environ[f'{prefix}_S3_SECRET'],
        # 非 AWS 的 S3 兼容服务（Supabase / Filebase / R2）都要 v4 签名 + path 寻址
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'}),
    )


class Command(BaseCommand):
    help = '把对象存储里的文件从一个桶搬到另一个桶（换存储商时用）'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='只统计，不实际上传')
        parser.add_argument('--prefix', default='', help='只搬指定前缀（如 attachments/）')
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='目标桶已有同名对象时也覆盖（默认跳过同样大小的）',
        )

    def handle(self, *args, **options):
        src = build_client('SRC')
        dst = build_client('DST')
        src_bucket = os.environ['SRC_S3_BUCKET']
        dst_bucket = os.environ['DST_S3_BUCKET']
        dry_run = options['dry_run']
        prefix = options['prefix']

        self.stdout.write(f'源桶：{src_bucket}（{os.environ["SRC_S3_ENDPOINT"]}）')
        self.stdout.write(f'目标桶：{dst_bucket}（{os.environ["DST_S3_ENDPOINT"]}）')

        moved = skipped = failed = 0
        total_bytes = 0
        token = None
        while True:
            params = {'Bucket': src_bucket, 'MaxKeys': 1000}
            if prefix:
                params['Prefix'] = prefix
            if token:
                params['ContinuationToken'] = token
            page = src.list_objects_v2(**params)
            for item in page.get('Contents', []):
                key = item['Key']
                size = item.get('Size', 0)
                if not options['overwrite'] and self._same_size(dst, dst_bucket, key, size):
                    skipped += 1
                    self.stdout.write(f'  跳过（目标已存在）{key}')
                    continue
                if dry_run:
                    moved += 1
                    total_bytes += size
                    self.stdout.write(f'  待搬迁 {key}  {self._human(size)}')
                    continue
                try:
                    self._copy_one(src, dst, src_bucket, dst_bucket, key)
                except Exception as exc:  # noqa: BLE001 —— 单个对象失败不该中断整批
                    failed += 1
                    self.stdout.write(self.style.ERROR(f'  失败 {key}：{exc}'))
                    continue
                moved += 1
                total_bytes += size
                self.stdout.write(f'  已搬迁 {key}  {self._human(size)}')
            if not page.get('IsTruncated'):
                break
            token = page.get('NextContinuationToken')

        verb = '待搬迁' if dry_run else '已搬迁'
        self.stdout.write(
            self.style.SUCCESS(
                f'{verb} {moved} 个对象（{self._human(total_bytes)}），'
                f'跳过 {skipped} 个，失败 {failed} 个'
            )
        )
        if dry_run:
            self.stdout.write('这只是预演，去掉 --dry-run 才会真正上传。')
        elif moved:
            self.stdout.write(
                '搬迁完成。下一步：把 Render 的 AWS_* 环境变量指向新桶并重新部署，'
                '然后打开站点确认文件能正常访问。'
            )

    @staticmethod
    def _same_size(dst, bucket, key, size):
        """目标桶里已有同名且同大小的对象，就认为搬过了。"""
        try:
            head = dst.head_object(Bucket=bucket, Key=key)
        except Exception:  # noqa: BLE001 —— 不存在 / 无权限都当作"需要搬"
            return False
        return head.get('ContentLength') == size

    @staticmethod
    def _copy_one(src, dst, src_bucket, dst_bucket, key):
        """逐个对象搬运：下载到临时文件再上传（大文件也不会吃内存）。"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            src.download_fileobj(src_bucket, key, tmp)
            tmp_path = tmp.name
        try:
            with open(tmp_path, 'rb') as handle:
                dst.upload_fileobj(handle, dst_bucket, key)
        finally:
            os.unlink(tmp_path)

    @staticmethod
    def _human(size):
        if size >= 1024 * 1024:
            return f'{size / 1024 / 1024:.1f} MB'
        if size >= 1024:
            return f'{size / 1024:.0f} KB'
        return f'{size} B'
