from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """统一分页：默认每页 12 条，允许前端用 ?page_size= 调整，上限 48。"""

    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 48
