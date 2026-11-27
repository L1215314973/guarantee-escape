// 图片准备好后放进 assets/，再把 imageSrc 改为 "assets/prank.png"。
// 路径相对于 index.html。未配置或图片不存在时，自动显示表情。
export const resultPrank = {
  buttonLabel: '保证书在这里',
  message: '骗你的，其实什么也没有',
  fallbackEmoji: '🤪',
  imageSrc:  "assets/prank.png",
  imageAlt: '一张有点欠揍的搞怪图片',
  delayRangeMs: [200, 400],
};
