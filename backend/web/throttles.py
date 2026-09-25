# 接口限流。
# 开发环境给得宽松，避免正常调试被拦；上线时把 settings 里的 DEFAULT_THROTTLE_RATES 调小即可。
# 注意：限流计数走 Django 默认的 LocMemCache，多进程部署需换成 Redis 等共享缓存才准确。

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class BurstRateThrottle(UserRateThrottle):
    # 全站兜底限流：登录用户按用户维度，匿名按 IP 维度
    scope = 'burst'


class AuthRateThrottle(AnonRateThrottle):
    # 登录 / 注册按 IP 限流，用于阻挡暴力破解与批量注册
    scope = 'auth'


class UploadRateThrottle(UserRateThrottle):
    # 资料上传 / 提交按用户限流
    scope = 'upload'
