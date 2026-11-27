export function createInitialState(settings = {}) {
  return {
    version: 1, mode: 'welcome', attempts: 0, selection: null,
    sceneHistory: [], textHistory: [], titleTaps: 0, mascotTaps: 0, unlocked: [],
    result: { complimentIndex: 0, titleIndex: 0 }, resultPrankSeen: false,
    settings: { muted: false, reducedMotion: false, ...settings },
  };
}

function unlock(state, id) {
  if (!state.unlocked.includes(id)) state.unlocked = [...state.unlocked, id];
}

export function transition(previous, action) {
  const state = { ...previous, settings: { ...previous.settings }, unlocked: [...previous.unlocked] };
  switch (action.type) {
    case 'continue':
      if (state.mode === 'result') return previous;
      state.mode = 'loop';
      state.attempts += 1;
      state.selection = action.selection ?? previous.selection;
      if (state.selection) {
        state.sceneHistory = [...previous.sceneHistory, state.selection.sceneId].slice(-3);
        state.textHistory = [...previous.textHistory, `${state.selection.sceneId}:${state.selection.textIndex}`].slice(-5);
      }
      if (state.attempts >= 10) unlock(state, 'patient');
      break;
    case 'decline':
      if (state.mode === 'result') return previous;
      state.mode = 'result';
      state.result = action.result ?? { complimentIndex: 0, titleIndex: 0 };
      break;
    case 'restart': return createInitialState(previous.settings);
    case 'toggle-muted': state.settings.muted = !state.settings.muted; break;
    case 'toggle-motion': state.settings.reducedMotion = !state.settings.reducedMotion; break;
    case 'title-tap':
      state.titleTaps = Math.min(5, state.titleTaps + 1);
      if (state.titleTaps === 5) unlock(state, 'title');
      break;
    case 'mascot-tap':
      if (state.mode !== 'result') return previous;
      state.mascotTaps = Math.min(3, state.mascotTaps + 1);
      if (state.mascotTaps === 3) unlock(state, 'mascot');
      break;
    case 'reveal-result-prank':
      if (state.mode !== 'result') return previous;
      state.resultPrankSeen = true;
      unlock(state, 'prank');
      break;
    default: return previous;
  }
  return state;
}

export function normalizeState(value, defaultSettings = {}) {
  const fresh = createInitialState(defaultSettings);
  if (!value || value.version !== 1 || !['welcome', 'loop', 'result'].includes(value.mode)) return fresh;
  if (!Number.isSafeInteger(value.attempts) || value.attempts < 0 || value.attempts > 1e9) return fresh;
  if ((value.mode === 'welcome' && value.attempts !== 0) || (value.mode === 'loop' && value.attempts === 0)) return fresh;
  const nonnegative = (n, limit) => Number.isInteger(n) && n >= 0 ? Math.min(n, limit) : 0;
  const history = (v, limit) => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-limit) : [];
  return {
    ...fresh, mode: value.mode, attempts: value.attempts,
    selection: value.selection && typeof value.selection.sceneId === 'string' ? {
      sceneId: value.selection.sceneId,
      textIndex: nonnegative(value.selection.textIndex, 100),
      buttonIndex: nonnegative(value.selection.buttonIndex, 100),
    } : null,
    sceneHistory: history(value.sceneHistory, 3), textHistory: history(value.textHistory, 5),
    titleTaps: nonnegative(value.titleTaps, 5), mascotTaps: nonnegative(value.mascotTaps, 3),
    unlocked: [...new Set(history(value.unlocked, 4))].filter(id => ['title', 'patient', 'mascot', 'prank'].includes(id)),
    resultPrankSeen: value.mode === 'result' && value.resultPrankSeen === true,
    result: { complimentIndex: nonnegative(value.result?.complimentIndex, 11), titleIndex: nonnegative(value.result?.titleIndex, 5) },
    settings: {
      muted: typeof value.settings?.muted === 'boolean' ? value.settings.muted : fresh.settings.muted,
      reducedMotion: typeof value.settings?.reducedMotion === 'boolean' ? value.settings.reducedMotion : fresh.settings.reducedMotion,
    },
  };
}
