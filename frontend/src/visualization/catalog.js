import physicalImage from './artifacts/atmosphere-first-viewport-desktop.png'
import physicalImageDark from './artifacts/atmosphere-dark-preview.png'
import humanImage from './artifacts/feature-shots/01-single-center.png'
import humanImageDark from './artifacts/von-thunen-dark-preview.png'
import gisImage from './artifacts/fit-1440x900.png'
import gisImageDark from './artifacts/dijkstra-dark-preview.png'

/**
 * 可视化实验室目录。
 * 后续新增实验时，在对应板块的 labs 数组中追加条目即可；
 * 门户、路由入口和卡片布局都由这份数据生成。
 */
export const LAB_GROUPS = [
  {
    key: 'physical',
    title: '自然地理',
    english: 'PHYSICAL GEOGRAPHY',
    icon: 'globe',
    description: '从大气运动到地表过程，把自然系统中的力、能量与空间关系变成可调参数。',
    labs: [
      {
        id: 'atmosphere',
        title: '大气水平运动受力',
        subtitle: '四力平衡与风场',
        description:
          '调节气压梯度、纬度、曲率与摩擦，观察气压梯度力、地转偏向力、惯性离心力和摩擦力如何合成平衡风。',
        image: physicalImage,
        imageDark: physicalImageDark,
        imageAlt: '大气水平运动受力实验室的风场与力矢量界面',
        tags: ['四力合成', '地转风', '梯度风'],
      },
    ],
  },
  {
    key: 'human',
    title: '人文地理',
    english: 'HUMAN GEOGRAPHY',
    icon: 'building',
    description: '把区位、成本、市场与人的选择放进同一模型，观察人类活动如何塑造空间格局。',
    labs: [
      {
        id: 'von-thunen',
        title: '杜能环',
        subtitle: '农业区位交互实验室',
        description:
          '编辑作物、市场与交通条件，在地租曲线和农业圈层的同步变化中理解距离如何决定土地利用。',
        image: humanImage,
        imageDark: humanImageDark,
        imageAlt: '杜能环实验室的农业圈层、市场与地租曲线界面',
        tags: ['地租', '农业区位', '交通'],
      },
    ],
  },
  {
    key: 'gis',
    title: '地信',
    english: 'GEOGRAPHIC INFORMATION SCIENCE',
    icon: 'map',
    description: '用网络、算法与空间数据理解可达性和空间联系，把计算过程变成可以追踪的图。',
    labs: [
      {
        id: 'dijkstra',
        title: 'Dijkstra 最短路径',
        subtitle: '网络分析算法实验室',
        description:
          '编辑加权图并设置起终点，逐事件观察优先队列、距离表与松弛过程，再由前驱表回溯最短路径。',
        image: gisImage,
        imageDark: gisImageDark,
        imageAlt: 'Dijkstra 最短路径实验室的图网络、状态表和优先队列界面',
        tags: ['网络分析', '最短路径', '优先队列'],
      },
    ],
  },
]
