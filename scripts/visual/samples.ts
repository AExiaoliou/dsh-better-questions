import type { BetterQuestion } from '../../src/shared/model'

// Recreates the reference admin wireframe with the v2 vocabulary.
const sidebar = `type: frame
variant: browser
width: 1100
label: app.example.com
children:
  - type: row
    gap: 0
    height: 560
    children:
      - type: column
        width: 200
        padding: 12
        variant: filled
        children:
          - type: row
            gap: 8
            children:
              - {type: avatar, width: 24}
              - {type: heading}
          - type: nav
            active: 0
            icons: [home, grid, chart, users, folder, settings]
      - type: column
        width: fill
        gap: 0
        children:
          - type: row
            padding: 12
            children:
              - {type: tabs, items: [概览, 项目, 报表, 设置], width: fill}
              - {type: icon, icon: mail}
              - {type: icon, icon: bell}
              - {type: avatar, width: 28}
          - {type: divider}
          - type: row
            padding: 16
            gap: 16
            height: fill
            children:
              - type: column
                width: fill
                children:
                  - {type: heading, label: 工作台}
                  - type: grid
                    columns: 3
                    children:
                      - {type: box, variant: selected, children: [{type: icon, icon: dashboard, width: 22}, {type: text, lines: 2}]}
                      - {type: box, children: [{type: icon, icon: image, width: 22}, {type: text, lines: 2}]}
                      - {type: box, children: [{type: icon, icon: file, width: 22}, {type: text, lines: 2}]}
                  - type: grid
                    columns: 2
                    children:
                      - {type: box, variant: card, children: [{type: heading}, {type: image, height: 110}]}
                      - {type: box, variant: card, children: [{type: heading}, {type: text, lines: 4}, {type: button, variant: primary, label: 查看详情}]}
                      - {type: box, variant: card, children: [{type: chart, variant: line, height: 110}]}
                      - {type: box, variant: card, children: [{type: table, columns: 3, rows: 3}]}
              - type: column
                width: 240
                children:
                  - {type: box, label: 待办, children: [{type: list, count: 3, variant: media}]}
                  - type: box
                    label: 通知
                    children:
                      - {type: toggle, checked: true, label: 邮件提醒}
                      - {type: toggle, label: 短信提醒}
                      - {type: checkbox, checked: true, label: 每周汇总}
`
const topnav = `type: frame
variant: browser
width: 1100
children:
  - type: row
    padding: 14
    children:
      - {type: icon, icon: globe, width: 22}
      - {type: heading, label: Brand}
      - {type: spacer}
      - {type: tabs, items: [首页, 产品, 方案, 价格], variant: pills}
      - {type: spacer}
      - {type: input, icon: search, label: 搜索, width: 200}
      - {type: button, variant: primary, label: 登录}
  - {type: divider}
  - type: column
    padding: 24
    gap: 20
    children:
      - type: box
        variant: filled
        height: 200
        padding: 28
        justify: center
        align: start
        children:
          - {type: heading, label: 更快地交付你的产品}
          - {type: text, lines: 2, width: 420}
          - type: row
            children: [{type: button, variant: primary, label: 开始使用}, {type: button, label: 了解更多}]
      - type: grid
        columns: 3
        gap: 16
        children:
          - {type: box, variant: card, children: [{type: image, height: 120}, {type: heading}, {type: text, lines: 2}]}
          - {type: box, variant: card, children: [{type: image, height: 120}, {type: heading}, {type: text, lines: 2}]}
          - {type: box, variant: card, children: [{type: image, height: 120}, {type: heading}, {type: text, lines: 2}]}
`
const mobile = `type: frame
variant: mobile
children:
  - type: column
    padding: 16
    children:
      - type: row
        children: [{type: icon, icon: menu}, {type: heading, label: 消息, width: fill}, {type: avatar, label: 王, width: 30}]
      - {type: input, icon: search, label: 搜索联系人}
      - {type: tabs, items: [全部, 未读, 群组], active: 1}
      - {type: list, variant: media, count: 6}
      - {type: spacer}
      - {type: button, variant: primary, label: 新建会话, width: fill}
`
const fluid = `type: row
children:
  - {type: box, label: 导航, width: 160}
  - type: column
    width: fill
    children:
      - {type: box, label: 工具栏, height: 48}
      - {type: box, label: 内容区, height: 180}
`
export const samples: BetterQuestion[] = [{
  id: 'layout', header: '布局偏好', question: '你更倾向于哪种页面布局', type: 'layout', multi_select: false,
  options: [
    { label: '左右分栏布局', description: '侧边导航 + 主内容工作区，适合中后台管理系统与工具台', recommended: true, proto: sidebar },
    { label: '上下通栏布局', description: '顶部全局导航 + 下方自适应内容流，适合门户、展示型与轻量应用', proto: topnav },
    { label: '移动端', description: '单列信息流', proto: mobile },
    { label: '旧语法', description: 'v1 兼容的流式布局', proto: fluid },
  ],
}]
