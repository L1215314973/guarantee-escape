import { scenes, compliments, titles, eggDefinitions, resultPrank } from './content.js';
import { createInitialState, transition } from './state.js';
import { pickScene, pickResult } from './random.js';
import { computeSafeArea, choosePosition, chooseFloatingPosition } from './position.js';
import { loadState, saveState } from './storage.js';
import * as audio from './audio.js';

const $ = selector => document.querySelector(selector);
const card = $('#card');
const playground = $('#playground');
const floating = $('#prank-float');
const dialog = $('#prank-dialog');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let state = loadState(storage, { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
let busy = false;
let lastCenter = null;
let prankTimer;
let toastTimer;
let confettiTimer;
let resizeFrame;
let cardAnimation;
let floatingAvailable = false;
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lineBreaks = text => escape(text).replace(/\n/g, '<br>');
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function envelope() {
  return '<div class="envelope-art" aria-hidden="true"><span class="envelope-paper"><i class="paper-line"></i><i class="paper-heart">♡</i></span><span class="envelope-base"></span><span class="envelope-seal">♡</span><span class="art-spark">✧</span><span class="art-spark two">✦</span></div>';
}

function mascot() {
  return '<button class="mascot-button" data-action="mascot-tap" aria-label="戳戳小团子"><span class="cloud-mascot" aria-hidden="true"><i class="mascot-eyes"></i><i class="mascot-smile"></i><i class="mascot-blush"></i></span></button>';
}

function actionButtons(continueLabel, declineLabel) {
  return `<div class="card-actions"><button class="button button-primary" data-action="continue">${escape(continueLabel)}</button><button class="button button-secondary" data-action="decline"><span class="mini-heart" aria-hidden="true">♡</span>${escape(declineLabel)}</button></div>`;
}

function applySettings() {
  const settings = state.settings;
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.body.classList.toggle('motion-enabled', !settings.reducedMotion);
  for (const [id, pressed, label] of [
    ['#sound-toggle', settings.muted, settings.muted ? '开启音效' : '关闭音效'],
    ['#motion-toggle', settings.reducedMotion, settings.reducedMotion ? '开启动效' : '减弱动效'],
  ]) {
    const button = $(id);
    button.setAttribute('aria-pressed', String(pressed));
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  audio.setMuted(settings.muted);
}

function updateNumbers() {
  $('#attempt-count').textContent = String(state.attempts).padStart(2, '0');
}

function cancelPrank() {
  clearTimeout(prankTimer);
  prankTimer = undefined;
  floatingAvailable = false;
  floating.hidden = true;
  if (dialog.open) dialog.close();
}

async function render({ initial = false, centered = false } = {}) {
  cardAnimation?.cancel();
  document.body.classList.toggle('is-result', state.mode === 'result');
  applySettings();
  updateNumbers();
  $('#restart-button').hidden = state.mode === 'welcome';
  card.className = 'promise-card';
  if (state.mode === 'welcome') {
    card.innerHTML = `<div class="card-content"><span class="eyebrow">一份不太正经的保证书</span>${envelope()}<h1 class="card-heading" id="card-title" tabindex="-1">你确定，<br>要看保证书吗？</h1><p class="card-description">本人在此郑重承诺……<br>等等，这份文件好像有自己的想法。</p><p class="card-detail">保密等级：超级害羞</p></div>${actionButtons('我要看看', '算啦，相信你')}`;
    $('#stage-caption').textContent = '一场关于信任的小小考验';
    $('#footer-hint').textContent = '认真是假的，可爱是真的。';
  } else if (state.mode === 'loop') {
    let scene = scenes.find(item => item.id === state.selection?.sceneId);
    if (!scene) {
      state = { ...state, selection: pickScene(state) };
      scene = scenes.find(item => item.id === state.selection.sceneId);
      persist();
    }
    const selection = state.selection;
    const line = scene.lines[selection.textIndex % scene.lines.length];
    const buttons = scene.buttons[selection.buttonIndex % scene.buttons.length];
    const art = scene.mascot === 'cat' ? '<span class="scene-emoji" role="img" aria-label="小猫">🐱</span>' : scene.mascot === 'heart' ? '<span class="scene-emoji" role="img" aria-label="爱心">💌</span>' : envelope();
    const extra = scene.effect === 'loading' ? '<div class="scene-progress" aria-hidden="true"><span></span></div>' : scene.effect === 'glitch' ? '<p class="fake-error">ERROR: TOO_CUTE_TO_OPEN</p>' : '<p class="card-detail">这份文件正在努力装作不存在</p>';
    card.innerHTML = `<div class="card-content"><span class="eyebrow">${escape(scene.label)}</span><div class="scene-art">${art}</div><h1 class="card-heading" id="card-title" tabindex="-1">${lineBreaks(scene.title)}</h1><p class="card-description">${escape(line)}</p>${extra}</div>${actionButtons(...buttons)}`;
    card.classList.add(`effect-${scene.effect}`);
    $('#stage-caption').textContent = '你一点击，它又偷偷溜走了';
    $('#footer-hint').textContent = '随时可以不看，夸夸已经准备好啦。';
  } else {
    card.classList.add('result-card');
    const title = titles[state.result.titleIndex];
    const compliment = compliments[state.result.complimentIndex];
    card.innerHTML = `<div class="card-content"><span class="eyebrow">善良已收到，温柔已签收</span>${mascot()}<h1 class="card-heading" id="card-title" tabindex="-1">${escape(title)}</h1><p class="card-description">${escape(compliment)}</p></div>`;
    $('#stage-caption').textContent = '谢谢你，给它一个温柔的台阶';
    $('#footer-hint').textContent = '今天的温柔，已经被好好收藏。';
    updateNumbers();
  }
  await frame();
  layout({ centered: centered || (initial && state.mode === 'welcome') });
  card.classList.add('ready');
  if (!state.settings.reducedMotion) cardAnimation = card.animate([
    { opacity: 0, transform: 'translateY(9px) scale(.97)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' },
  ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  if (!initial) $('#card-title').focus({ preventScroll: true });
  $('#announcement').textContent = `${$('#card-title').textContent}。本轮尝试查看 ${state.attempts} 次。`;
  if (state.mode === 'result') schedulePrank();
}

function layout({ centered = false, resizing = false } = {}) {
  const stageRect = playground.getBoundingClientRect();
  const area = computeSafeArea({ width: stageRect.width, height: stageRect.height }, { top: 12, left: 16, right: 16, bottom: 16 });
  card.style.maxHeight = `${area.height}px`;
  const rect = card.getBoundingClientRect();
  let position;
  if (centered) {
    position = { x: area.x + (area.width - rect.width) / 2, y: area.y + (area.height - rect.height) / 2 };
  } else if (resizing) {
    position = {
      x: Math.max(area.x, Math.min(parseFloat(card.style.left) || area.x, area.x + area.width - rect.width)),
      y: Math.max(area.y, Math.min(parseFloat(card.style.top) || area.y, area.y + area.height - rect.height)),
    };
  } else position = choosePosition(rect, area, lastCenter);
  card.style.left = `${position.x}px`;
  card.style.top = `${position.y}px`;
  lastCenter = { x: position.x + rect.width / 2, y: position.y + rect.height / 2 };
  if (floatingAvailable) positionFloating();
}

function schedulePrank() {
  clearTimeout(prankTimer);
  if (floatingAvailable) return;
  const [min, max] = resultPrank.delayRangeMs;
  const delay = state.resultPrankSeen ? 0 : min + Math.random() * (max - min);
  prankTimer = setTimeout(() => {
    if (state.mode !== 'result') return;
    floatingAvailable = true;
    $('#prank-float-label').textContent = resultPrank.buttonLabel;
    floating.hidden = false;
    positionFloating();
  }, delay);
}

function positionFloating() {
  const rect = floating.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const footer = $('.site-footer').getBoundingClientRect();
  const stage = playground.getBoundingClientRect();
  const area = computeSafeArea({ width: document.documentElement.clientWidth, height: window.innerHeight }, { left: 16, right: 16, top: stage.top, bottom: Math.max(16, window.innerHeight - footer.top + 12) });
  const occupied = [{ x: cardRect.left, y: cardRect.top, width: cardRect.width, height: cardRect.height }];
  const position = chooseFloatingPosition(rect, area, occupied);
  if (position.needsReservedSpace) {
    // 极短视口预留底部浮窗行，先缩短主区域再测量，按钮不覆盖结算。
    playground.style.bottom = `${Math.max(142, window.innerHeight - area.y - area.height + rect.height + 30)}px`;
    const stageRect = playground.getBoundingClientRect();
    card.style.maxHeight = `${Math.max(70, stageRect.height - 28)}px`;
    card.style.top = '12px';
    floating.style.left = `${Math.max(16, (window.innerWidth - rect.width) / 2)}px`;
    floating.style.top = `${area.y + area.height - rect.height}px`;
  } else {
    floating.style.left = `${position.x}px`;
    floating.style.top = `${position.y}px`;
  }
}

function persist() { saveState(storage, state); }

function showToast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}

function updateState(action) {
  const oldEggs = state.unlocked;
  state = transition(state, action);
  persist();
  updateNumbers();
  const found = state.unlocked.find(id => !oldEggs.includes(id));
  if (found) {
    const egg = eggDefinitions.find(item => item.id === found);
    const message = found === 'mascot' ? '摸摸头专家：你的温柔，比小团子的脸颊还软。' : `发现彩蛋 · ${egg.name}`;
    showToast(message);
  }
}

function celebrate() {
  if (state.settings.reducedMotion) return;
  clearTimeout(confettiTimer);
  const container = $('#confetti');
  container.replaceChildren();
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-bit';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * .6}s`;
    piece.style.setProperty('--drift', `${Math.random() * 140 - 70}px`);
    piece.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);
    container.append(piece);
  }
  confettiTimer = setTimeout(() => container.replaceChildren(), 3300);
}

async function handleChoice(type) {
  if (busy || (state.mode === 'result' && type !== 'restart')) return;
  busy = true;
  audio.enableAfterGesture();
  cancelPrank();
  playground.style.bottom = '';
  card.querySelectorAll('button').forEach(button => button.disabled = true);
  const duration = state.settings.reducedMotion ? 0 : 90;
  if (duration) {
    card.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)' }], { duration, fill: 'forwards' });
    await sleep(duration);
  }
  if (type === 'continue') updateState({ type, selection: pickScene(state) });
  else if (type === 'decline') updateState({ type, result: pickResult(state.attempts) });
  else {
    clearTimeout(confettiTimer);
    $('#confetti').replaceChildren();
    updateState({ type: 'restart' });
    lastCenter = null;
  }
  // 取消旧卡片上尚未结束的动画，避免残留 fill:forwards 使新内容透明。
  card.getAnimations().forEach(animation => animation.cancel());
  await render({ centered: type === 'restart' });
  const scene = scenes.find(item => item.id === state.selection?.sceneId);
  audio.playEffect(type === 'decline' ? 'success' : scene?.effect === 'glitch' ? 'error' : 'move');
  if (type === 'decline') celebrate();
  await sleep(state.settings.reducedMotion ? 110 : 220);
  busy = false;
}

function openPrank() {
  if (state.mode !== 'result' || !floatingAvailable) return;
  audio.enableAfterGesture();
  updateState({ type: 'reveal-result-prank' });
  const heading = $('#prank-title');
  heading.textContent = resultPrank.message;
  const emoji = $('#prank-emoji');
  const image = $('#prank-image');
  emoji.textContent = resultPrank.fallbackEmoji;
  emoji.hidden = false;
  image.hidden = true;
  image.alt = resultPrank.imageAlt;
  image.onload = () => { image.hidden = false; emoji.hidden = true; };
  image.onerror = () => { image.hidden = true; emoji.hidden = false; };
  if (resultPrank.imageSrc.trim()) image.src = new URL(resultPrank.imageSrc, document.baseURI).href;
  else image.removeAttribute('src');
  if (!dialog.open) dialog.showModal();
  audio.playEffect('prank');
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const type = target.dataset.action;
  if (['continue', 'decline', 'restart'].includes(type)) handleChoice(type);
  else if (type === 'mascot-tap' && !busy) { audio.enableAfterGesture(); updateState({ type }); audio.playEffect('click'); }
});
$('#brand').addEventListener('click', () => { updateState({ type: 'title-tap' }); });
$('#sound-toggle').addEventListener('click', () => {
  updateState({ type: 'toggle-muted' }); applySettings();
  if (!state.settings.muted) { audio.enableAfterGesture(); setTimeout(() => audio.playEffect('click'), 20); }
  showToast(state.settings.muted ? '音效已关闭，安静地可爱。' : '音效已开启，小声地皮一下。');
});
$('#motion-toggle').addEventListener('click', () => {
  updateState({ type: 'toggle-motion' }); applySettings();
  if (state.settings.reducedMotion) { card.getAnimations().forEach(animation => animation.cancel()); $('#confetti').replaceChildren(); }
  showToast(state.settings.reducedMotion ? '动效已减弱，换位照常。' : '动效已开启，准备蹦跶。');
});
$('#restart-button').addEventListener('click', () => handleChoice('restart'));
floating.addEventListener('click', openPrank);
$('#prank-close').addEventListener('click', () => dialog.close());
$('#prank-forgive').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { if (!floating.hidden) floating.focus({ preventScroll: true }); });
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => layout({ resizing: true }));
});
window.visualViewport?.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => layout({ resizing: true }));
});
window.addEventListener('pagehide', () => { clearTimeout(prankTimer); clearTimeout(toastTimer); clearTimeout(confettiTimer); });
window.addEventListener('pageshow', event => { if (event.persisted && state.mode === 'result') schedulePrank(); });

await render({ initial: true });
