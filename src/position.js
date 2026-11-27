const clamp = (n, min, max) => Math.max(min, Math.min(n, Math.max(min, max)));
const unit = rng => clamp(Number(rng()) || 0, 0, 1);

export function computeSafeArea(viewport, insets = {}, toolbarRect = null) {
  const x = insets.left ?? 16;
  const y = Math.max(insets.top ?? 16, toolbarRect ? toolbarRect.bottom + 16 : 0);
  return { x, y, width: Math.max(0, viewport.width - x - (insets.right ?? 16)), height: Math.max(0, viewport.height - y - (insets.bottom ?? 16)) };
}

function candidates(size, area, rng) {
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  const rangeX = Math.max(0, area.width - width);
  const rangeY = Math.max(0, area.height - height);
  return Array.from({ length: 24 }, () => ({ x: area.x + unit(rng) * rangeX, y: area.y + unit(rng) * rangeY, width, height }));
}

export function choosePosition(cardSize, safeArea, previousCenter = null, rng = Math.random) {
  const points = candidates(cardSize, safeArea, rng);
  const center = p => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
  const distance = p => previousCenter ? Math.hypot(center(p).x - previousCenter.x, center(p).y - previousCenter.y) : 0;
  const reach = Math.hypot(Math.max(0, safeArea.width - cardSize.width), Math.max(0, safeArea.height - cardSize.height));
  const far = previousCenter ? points.filter(p => distance(p) >= Math.min(140, reach * 0.35)) : points;
  const point = far.length ? far[Math.min(far.length - 1, Math.floor(unit(rng) * far.length))] : points.reduce((a, b) => distance(a) > distance(b) ? a : b);
  return { ...point, canMove: reach > 2 };
}

export function overlaps(a, b, gap = 12) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function chooseFloatingPosition(size, area, occupiedRects, rng = Math.random) {
  if (size.width > area.width || size.height > area.height) return { needsReservedSpace: true };
  // DOMRect 的 width/height 不是自有可枚举属性，需要显式读取。
  const box = { width: size.width, height: size.height };
  const points = candidates(box, area, rng);
  const right = area.x + area.width - size.width;
  const bottom = area.y + area.height - size.height;
  points.push({ x: area.x, y: bottom, ...box }, { x: right, y: bottom, ...box }, { x: area.x, y: area.y, ...box }, { x: right, y: area.y, ...box });
  const available = points.filter(point => occupiedRects.every(rect => !overlaps(point, rect)));
  return available.length ? { ...available[Math.min(available.length - 1, Math.floor(unit(rng) * available.length))], needsReservedSpace: false } : { needsReservedSpace: true };
}
