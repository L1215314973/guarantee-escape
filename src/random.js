import { scenes } from './content.js';

export const randomIndex = (length, rng = Math.random) => Math.min(length - 1, Math.max(0, Math.floor(rng() * length)));

export function pickScene(context, rng = Math.random, pool = scenes) {
  if (!pool.length) throw new Error('至少需要一个套娃场景');
  let recent = [...(context.sceneHistory ?? [])];
  let available = pool.filter(scene => !recent.includes(scene.id));
  while (!available.length && recent.length) {
    recent.shift();
    available = pool.filter(scene => !recent.includes(scene.id));
  }
  // 初期更多软萌场景；后续逐渐加入假报错和荒诞反转。
  const weighted = available.flatMap(scene => {
    const gentle = ['shy', 'cat', 'talk', 'kindness'].includes(scene.id);
    return Array((context.attempts < 3 && gentle) || scene.id === 'queue' ? 3 : 1).fill(scene);
  });
  const chosen = weighted[randomIndex(weighted.length, rng)];
  let texts = chosen.lines.map((_, i) => i).filter(i => !(context.textHistory ?? []).includes(`${chosen.id}:${i}`));
  if (!texts.length) texts = chosen.lines.map((_, i) => i);
  return { sceneId: chosen.id, textIndex: texts[randomIndex(texts.length, rng)], buttonIndex: randomIndex(chosen.buttons.length, rng) };
}

export function pickResult(attempts, rng = Math.random) {
  const start = attempts === 0 ? 0 : attempts >= 10 ? 6 : 3;
  const end = attempts === 0 ? 6 : attempts >= 10 ? 12 : 10;
  return { complimentIndex: start + randomIndex(end - start, rng), titleIndex: attempts >= 10 ? 4 + randomIndex(2, rng) : randomIndex(4, rng) };
}
