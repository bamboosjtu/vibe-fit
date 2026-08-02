# VibeFit Design System

> Version: v1
> Scope: pwa/frontend
> Purpose: 统一 VibeFit H5/PWA UI 视觉、组件和交互状态。

---

## 1. Design Language

关键词：

- 清爽；
- 专业；
- 运动科技；
- 高信息密度但低认知负担。

视觉目标：

用户在健身过程中，3 秒内理解：

1. 今天训练什么；
2. 当前动作是什么；
3. 下一步需要点击什么。

---

## 2. Color Tokens

### Brand

```css
--vf-primary: #05A978;
--vf-primary-light: #35C79B;
--vf-primary-dark: #078763;
```

用途：

- 完成按钮；
- 当前训练状态；
- 进度条；
- 已完成组。

### Secondary

```css
--vf-secondary: #06B6D4;
```

用途：

- 辅助信息；
- 卡片强调。

### Status

成功：

```css
--vf-success: #10B981;
```

警告：

```css
--vf-warning: #F59E0B;
```

错误：

```css
--vf-error: #EF4444;
```

---

## 3. Background

页面背景：

```css
#FFFFFF
```

卡片背景：

```css
#FFFFFF
```

分割线：

```css
#E5E7EB
```

文本：

Primary:

```css
#1F2937
```

Secondary:

```css
#6B7280
```

Disabled:

```css
#9CA3AF
```

---

## 4. Typography

字体：

```text
Display: var(--font-display)
Body: var(--font-body)
```

### 标题

页面标题：

- 20-24px
- font-weight 800/900

训练名称：

- 22-28px
- font-weight 900

动作名称：

- 15-16px
- font-weight 800

### 数据

训练计时：

- 使用 tabular number；
- 16-20px；
- font-weight 900。

重量、次数：

- 14-16px；
- font-weight 800。

---

## 5. Spacing

基础单位：4px。

推荐间距：

| Token | px |
|-|-:|
| xs |4|
| sm |8|
| md |12|
| lg |16|
| xl |24|
| xxl |32|

页面左右 padding：

```text
16px mobile
24px tablet
```

---

## 6. Radius

按钮：

```text
8px
```

输入框：

```text
8-10px
```

训练卡片：

```text
12px
```

大弹窗：

```text
24px
```

---

## 7. Shadows

普通卡片：

```css
0 10px 30px rgba(15,23,42,0.06)
```

浮层：

```css
0 14px 32px rgba(15,23,42,0.14)
```

禁止：

- 大面积强阴影；
- 影响阅读的浮雕效果。

---

## 8. Button System

### Primary Button

用途：

- 开始训练；
- 完成记录；
- 结束训练。

属性：

```text
height: 48px
radius: 8px
background: brand green
```

### Secondary Button

用途：

- 暂停；
- 继续；
- 跳过。

### Text Action

用途：

- 添加组；
- 复制上组。

视觉权重最低。

---

## 9. Card System

### Exercise Card

结构：

```text
Header
 ├ artwork
 ├ name
 ├ muscle tag
 ├ completion
 └ menu

Body
 ├ set table
 ├ rest timer
 └ auxiliary actions
```

尺寸：

- radius 7-12px；
- padding 12px；
- border 1px divider。

---

## 10. Training States

### Session State

```text
idle
running
paused
completed
```

颜色：

|状态|颜色|
|-|-|
|running|green|
|paused|orange|
|completed|green/light|
|idle|gray|

---

## 11. Set Row States

### Completed

表现：

- 绿色组号；
- 绿色完成按钮；
- 浅绿色背景。

### Current

表现：

- 强调输入框；
- 明确下一步操作。

### Future

表现：

- 普通输入框；
- 不使用禁用状态。

---

## 12. Exercise Artwork

动作图片必须通过映射管理：

```ts
exerciseId -> asset
```

禁止：

- 组件中写文件路径；
- 根据中文名称拼接图片地址。

资源要求：

- SVG 优先；
- PNG sprite 次之；
- 风格统一。

展示尺寸：

```text
64-72px
```

---

## 13. Timer Components

### Training Timer

位置：顶部。

显示：

```text
HH:MM:SS
```

来源：

```text
elapsedSeconds + runningSince
```

### Rest Timer

位置：动作卡片内部。

显示：

```text
MM:SS
```

来源：

```text
endsAt - now
```

禁止：

```text
setInterval decrement state
```

作为真实计时来源。

---

## 14. Bottom Action Bar

位置：

底部导航上方固定。

高度：

```text
64-72px
```

按钮：

- 左侧次操作；
- 右侧主操作。

必须考虑：

- iOS Safe Area；
- 最后一项内容不被遮挡。

---

## 15. Form Controls

输入框：

高度：

```text
36-40px
```

重量：

- 支持小数。

次数：

- 整数。

数字输入：

- 居中显示；
- 使用 tabular number。

---

## 16. Responsive Rules

主要测试尺寸：

```text
375x812
390x844
430x932
```

禁止：

- 横向滚动；
- 内容覆盖固定栏；
- 动作名称被强制截断到无法识别。

---

## 17. Accessibility

所有主要交互必须：

- 有 aria-label；
- 有 keyboard focus；
- 有明确按钮语义。

禁止：

```tsx
<Box onClick={...}/>
```

作为主要操作。

使用：

```tsx
<Button />
<IconButton />
```

---

## 18. Component Ownership

组件负责：

- UI 展示；
- 用户交互事件。

Store/domain 负责：

- 状态变化；
- 时间计算；
- 持久化。

禁止：

- 训练状态放组件 useState；
- 业务计时写在 JSX；
- 组件直接操作数据库。

---

## 19. UI Review Checklist

提交 UI 修改前检查：

- [ ] 是否符合 ui-brief？
- [ ] 是否使用 Design Token？
- [ ] 是否新增重复颜色？
- [ ] 是否新增硬编码尺寸？
- [ ] 是否支持空状态？
- [ ] 是否支持 loading？
- [ ] 是否支持异常状态？
- [ ] 是否支持恢复训练？
- [ ] 是否支持手机单手操作？
