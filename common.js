/* LUXORA shared app logic: demo balance, local history, sounds, transitions and UI. */
(() => {
  'use strict';
  const KEYS = { balance: 'luxora_demo_balance_v1', history: 'luxora_demo_history_v1', snapshots: 'luxora_demo_snapshots_v1', sound: 'luxora_demo_sound_v1', disclaimer: 'luxora_demo_disclaimer_v1', daily: 'luxora_daily_progress_v1' };
  const START_BALANCE = 5000;
  const safeParse = (raw, fallback) => { try { const parsed = JSON.parse(raw); return parsed ?? fallback; } catch { return fallback; } };
  const readHistory = () => safeParse(localStorage.getItem(KEYS.history), []);
  const readSnapshots = () => safeParse(localStorage.getItem(KEYS.snapshots), []);
  const store = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn('Local storage is unavailable', err); } };
  if (localStorage.getItem(KEYS.balance) === null) localStorage.setItem(KEYS.balance, String(START_BALANCE));
  let soundEnabled = localStorage.getItem(KEYS.sound) !== 'false';
  let audioContext = null;
  const format = value => Math.floor(Number(value) || 0).toLocaleString('ru-RU');
  const getBalance = () => Math.max(0, Number(localStorage.getItem(KEYS.balance)) || 0);
  const animateNumber = (el, from, to, duration = 500) => {
    if (!el) return;
    const start = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = format(to); return; }
    const tick = now => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = format(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const updateBalanceDisplays = (oldValue = getBalance(), newValue = getBalance()) => {
    document.querySelectorAll('[data-balance]').forEach(el => animateNumber(el, oldValue, newValue));
  };
  const setBalance = (next, meta = {}) => {
    const old = getBalance();
    const value = Math.max(0, Math.floor(Number(next) || 0));
    localStorage.setItem(KEYS.balance, String(value));
    updateBalanceDisplays(old, value);
    const snapshots = readSnapshots();
    snapshots.push({ time: Date.now(), balance: value });
    store(KEYS.snapshots, snapshots.slice(-120));
    window.dispatchEvent(new CustomEvent('luxora:balance', { detail: { old, value, ...meta } }));
    return value;
  };
  const addBalance = (amount, reason = 'demo-bonus') => setBalance(getBalance() + Math.max(0, Math.floor(Number(amount) || 0)), { reason });
  const spend = amount => {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value || getBalance() < value) return false;
    setBalance(getBalance() - value, { reason: 'game-stake' });
    return true;
  };
  const record = ({ game = 'Игра', stake = 0, payout = 0, multiplier = 0, result = 'neutral', note = '' } = {}) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: Date.now(), game, stake: Math.max(0, Math.floor(stake)), payout: Math.max(0, Math.floor(payout)), net: Math.floor(payout) - Math.floor(stake), multiplier: Number(multiplier) || 0, result, note };
    const history = readHistory(); history.unshift(item); store(KEYS.history, history.slice(0, 100));
    window.dispatchEvent(new CustomEvent('luxora:history', { detail: item }));
    return item;
  };
  const getHistory = () => readHistory();
  const getSnapshots = () => readSnapshots();
  const toast = (message, type = 'info', duration = 2700) => {
    let stack = document.getElementById('toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.id = 'toast-stack'; document.body.appendChild(stack); }
    const node = document.createElement('div'); node.className = `toast ${type === 'success' ? 'good' : type === 'error' ? 'bad' : ''}`; node.textContent = message; stack.appendChild(node);
    window.setTimeout(() => { node.style.transition = 'opacity .25s, transform .25s'; node.style.opacity = '0'; node.style.transform = 'translateX(10px)'; window.setTimeout(() => node.remove(), 280); }, duration);
  };
  const playTone = (kind = 'click') => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioContext ||= new Ctx();
      if (audioContext.state === 'suspended') audioContext.resume();
      const settings = kind === 'win' ? [740, 988, 1175] : kind === 'loss' ? [240, 170] : kind === 'mine' ? [125, 90] : [480];
      settings.forEach((hz, i) => {
        const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
        osc.type = kind === 'mine' || kind === 'loss' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(hz, audioContext.currentTime + i * .075);
        gain.gain.setValueAtTime(.0001, audioContext.currentTime + i * .075); gain.gain.exponentialRampToValueAtTime(kind === 'click' ? .025 : .055, audioContext.currentTime + i * .075 + .015); gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + i * .075 + .19);
        osc.connect(gain); gain.connect(audioContext.destination); osc.start(audioContext.currentTime + i * .075); osc.stop(audioContext.currentTime + i * .075 + .21);
      });
    } catch (err) { /* Audio is optional; autoplay restrictions must not block gameplay. */ }
  };
  const toggleSound = () => {
    soundEnabled = !soundEnabled; localStorage.setItem(KEYS.sound, String(soundEnabled));
    document.querySelectorAll('[data-sound-toggle]').forEach(button => { button.textContent = soundEnabled ? '♫' : '♪'; button.classList.toggle('sound-off', !soundEnabled); button.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук'); });
    toast(soundEnabled ? 'Звук включён' : 'Звук выключен'); playTone('click');
  };
  const confetti = (count = 90) => {
    const canvas = document.createElement('canvas'); canvas.className = 'confetti-layer'; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:190;'; document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d'); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ['#ffd76a', '#9d4edd', '#00e5f2', '#41e6a2', '#fff2c2'];
    const bits = Array.from({ length: Math.min(count, 160) }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .4, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 5, size: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, color: colors[Math.floor(Math.random() * colors.length)], life: 0 }));
    let frame = 0; const draw = () => { ctx.clearRect(0, 0, innerWidth, innerHeight); let alive = false; bits.forEach(b => { b.x += b.vx; b.y += b.vy; b.vy += .035; b.rot += b.vr; b.life++; if (b.y < innerHeight + 20 && b.life < 180) alive = true; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.color; ctx.globalAlpha = Math.max(0, 1 - b.life / 190); ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 1.6); ctx.restore(); }); frame++; if (alive && frame < 190) requestAnimationFrame(draw); else canvas.remove(); };
    requestAnimationFrame(draw);
  };
  const bonus = () => { addBalance(5000, 'free-demo-recharge'); toast('Начислено +5 000 виртуальных монет', 'success'); playTone('win'); };
  const initHeader = () => {
    updateBalanceDisplays(getBalance(), getBalance());
    document.querySelectorAll('[data-demo-bonus]').forEach(button => button.addEventListener('click', bonus));
    document.querySelectorAll('[data-sound-toggle]').forEach(button => { button.textContent = soundEnabled ? '♫' : '♪'; button.classList.toggle('sound-off', !soundEnabled); button.setAttribute('aria-label', soundEnabled ? 'Выключить звук' : 'Включить звук'); button.addEventListener('click', toggleSound); });
    const toggle = document.querySelector('[data-mobile-toggle]'); const nav = document.querySelector('[data-main-nav]');
    if (toggle && nav) toggle.addEventListener('click', () => { nav.classList.toggle('mobile-open'); toggle.setAttribute('aria-expanded', nav.classList.contains('mobile-open') ? 'true' : 'false'); });
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('[data-main-nav] .nav-link').forEach(link => { if (link.getAttribute('href') === current) link.classList.add('active'); });
    document.querySelectorAll('a[href$=".html"]').forEach(link => link.addEventListener('click', event => {
      const href = link.getAttribute('href'); if (!href || href.startsWith('#') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); document.body.classList.add('navigating-away'); window.setTimeout(() => { location.href = href; }, 120);
    }));
  };
  const initLoader = () => { const loader = document.getElementById('site-loader'); if (!loader) return; window.addEventListener('load', () => window.setTimeout(() => loader.classList.add('is-done'), 240)); window.setTimeout(() => loader.classList.add('is-done'), 1400); };
  const initDisclaimer = () => {
    const modal = document.getElementById('disclaimer'); if (!modal) return;
    if (localStorage.getItem(KEYS.disclaimer) !== 'accepted') modal.classList.add('show');
    const button = modal.querySelector('[data-disclaimer-accept]');
    if (button) button.addEventListener('click', () => { localStorage.setItem(KEYS.disclaimer, 'accepted'); modal.classList.remove('show'); playTone('click'); });
  };
  const initParticles = () => {
    const canvas = document.querySelector('[data-particles]'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); let w, h, particles = [], mouse = { x: -500, y: -500 };
    const resize = () => { const ratio = Math.min(devicePixelRatio || 1, 2); w = canvas.clientWidth = innerWidth; h = canvas.clientHeight = innerHeight; canvas.width = w * ratio; canvas.height = h * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); particles = Array.from({ length: Math.min(65, Math.floor(w / 20)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: .6 + Math.random() * 1.7, vy: .12 + Math.random() * .42, vx: (Math.random() - .5) * .18, alpha: .13 + Math.random() * .3, color: Math.random() > .7 ? '#ffd76a' : Math.random() > .5 ? '#9d4edd' : '#00e5f2' })); };
    const draw = () => { ctx.clearRect(0, 0, w, h); particles.forEach(p => { p.y += p.vy; p.x += p.vx; if (p.y > h + 3) { p.y = -4; p.x = Math.random() * w; } if (p.x < -4) p.x = w + 4; if (p.x > w + 4) p.x = -4; const dx = p.x - mouse.x, dy = p.y - mouse.y; const distance = Math.hypot(dx, dy); if (distance < 100 && distance > 0) { p.x += dx / distance * .5; p.y += dy / distance * .5; } ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.shadowBlur = 8; ctx.shadowColor = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; ctx.shadowBlur = 0; requestAnimationFrame(draw); };
    window.addEventListener('resize', resize); window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }); resize(); draw();
  };
  const countUp = (node, to, suffix = '') => { const from = Number(node.dataset.from || 0); const start = performance.now(); const duration = 850; const tick = t => { const p = Math.min(1, (t - start) / duration); const n = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); node.textContent = format(n) + suffix; if (p < 1) requestAnimationFrame(tick); else node.dataset.from = String(to); }; requestAnimationFrame(tick); };

  // Daily challenges award cosmetic XP only. They never add demo coins or
  // depend on a wager, a payout, or a game outcome.
  const DAILY_QUESTS = [
    { id: 'checkin', icon: '☀', title: 'Ежедневный визит', description: 'Зайди в LUXORA сегодня.', reward: 10, href: 'index.html#daily-quests', kind: 'visit' },
    { id: 'explorer', icon: '🧭', title: 'Исследователь', description: 'Открой две разные мини-игры.', reward: 25, href: 'index.html#games', kind: 'games' },
    { id: 'profile', icon: '♙', title: 'Загляни в профиль', description: 'Посети страницу своей статистики.', reward: 15, href: 'profile.html', kind: 'profile' }
  ];
  const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayNumber = key => { const [y,m,d] = String(key || '').split('-').map(Number); return y && m && d ? Math.floor(Date.UTC(y,m-1,d) / 86400000) : 0; };
  const initialDailyState = () => ({ lastSeen: '', streak: 0, bestStreak: 0, xp: 0, activeDays: [], visits: {}, claims: {} });
  const readDailyState = () => {
    const saved = safeParse(localStorage.getItem(KEYS.daily), {});
    return { ...initialDailyState(), ...(saved && typeof saved === 'object' ? saved : {}), visits: saved?.visits || {}, claims: saved?.claims || {}, activeDays: Array.isArray(saved?.activeDays) ? saved.activeDays : [] };
  };
  const writeDailyState = state => { store(KEYS.daily, state); window.dispatchEvent(new CustomEvent('luxora:daily', { detail: getDailyState() })); };
  const getDailyState = () => {
    const state = readDailyState(); const today = todayKey(); const visits = Array.isArray(state.visits[today]) ? state.visits[today] : [];
    const claimed = Array.isArray(state.claims[today]) ? state.claims[today] : [];
    const gamePages = new Set(visits.filter(page => ['mines.html','aviator.html','roulette.html','poker.html','slots.html'].includes(page)));
    const quests = DAILY_QUESTS.map(quest => {
      const complete = quest.kind === 'visit' ? state.lastSeen === today : quest.kind === 'games' ? gamePages.size >= 2 : visits.includes('profile.html');
      return { ...quest, complete, claimed: claimed.includes(quest.id), progress: quest.kind === 'games' ? Math.min(gamePages.size, 2) : complete ? 1 : 0, target: quest.kind === 'games' ? 2 : 1 };
    });
    return { ...state, today, todayVisits: visits, gameCount: gamePages.size, quests, xp: Math.max(0, Number(state.xp) || 0), streak: Math.max(0, Number(state.streak) || 0), bestStreak: Math.max(0, Number(state.bestStreak) || 0) };
  };
  const markDailyVisit = page => {
    const state = readDailyState(); const today = todayKey();
    if (state.lastSeen !== today) {
      const gap = state.lastSeen ? dayNumber(today) - dayNumber(state.lastSeen) : 0;
      state.streak = gap === 1 ? Math.max(0, Number(state.streak) || 0) + 1 : 1;
      state.bestStreak = Math.max(Number(state.bestStreak) || 0, state.streak);
      state.lastSeen = today;
      state.activeDays = [...new Set([...(state.activeDays || []), today])].slice(-30);
      // Keep old daily records bounded; only recent activity is relevant to quests.
      for (const key of Object.keys(state.visits || {})) if (dayNumber(today) - dayNumber(key) > 14) delete state.visits[key];
      for (const key of Object.keys(state.claims || {})) if (dayNumber(today) - dayNumber(key) > 30) delete state.claims[key];
    }
    state.visits[today] = Array.isArray(state.visits[today]) ? state.visits[today] : [];
    if (page && !state.visits[today].includes(page)) state.visits[today].push(page);
    writeDailyState(state);
  };
  const claimDailyQuest = id => {
    const state = readDailyState(); const today = todayKey();
    const visits = Array.isArray(state.visits[today]) ? state.visits[today] : [];
    const gameCount = new Set(visits.filter(page => ['mines.html','aviator.html','roulette.html','poker.html','slots.html'].includes(page))).size;
    const quest = DAILY_QUESTS.find(item => item.id === id); if (!quest) return false;
    const isComplete = quest.kind === 'visit' ? state.lastSeen === today : quest.kind === 'games' ? gameCount >= 2 : visits.includes('profile.html');
    state.claims[today] = Array.isArray(state.claims[today]) ? state.claims[today] : [];
    if (!isComplete || state.claims[today].includes(id)) return false;
    state.claims[today].push(id); state.xp = Math.max(0, Number(state.xp) || 0) + quest.reward;
    writeDailyState(state); toast(`Задание выполнено: +${quest.reward} XP`, 'success'); playTone('win');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches === false) confetti(28);
    return true;
  };
  const makeDailyPanel = () => {
    const panel = document.createElement('section'); panel.id = 'daily-quests'; panel.className = 'daily-panel glass panel section'; panel.setAttribute('aria-labelledby', 'daily-title');
    panel.innerHTML = `<div class="daily-top"><div><div class="eyebrow">Твой ежедневный маршрут</div><h2 id="daily-title">Задания <span class="gradient-text">на сегодня</span></h2><p class="muted daily-lead">Небольшие цели для исследования сайта. Награды — только очки опыта, баланс не меняется.</p></div><a class="btn btn-secondary btn-sm" href="profile.html">Мой профиль ↗</a></div><div class="daily-layout"><div class="streak-card"><div class="streak-flare">✦</div><div class="streak-overline">СЕРИЯ ВИЗИТОВ</div><div class="streak-number"><span id="daily-streak">0</span><small>дней</small><span class="streak-fire">🔥</span></div><div class="streak-sub">Лучшая серия: <strong id="daily-best">0</strong> дн.</div><div class="streak-week" id="daily-week" aria-label="Активность за последние семь дней"></div><div class="streak-foot"><span>⚡ <strong id="daily-xp">0</strong> XP</span><span id="daily-claimed">0 / 3 получено</span></div></div><div class="daily-quest-list" id="daily-quest-list"></div></div>`;
    return panel;
  };
  const renderDailyPanel = () => {
    const existing = document.getElementById('daily-quests'); if (!existing) return;
    const state = getDailyState();
    const streakNode = document.getElementById('daily-streak'); if (!streakNode) return;
    streakNode.textContent = state.streak; document.getElementById('daily-best').textContent = state.bestStreak; document.getElementById('daily-xp').textContent = format(state.xp);
    const claimedCount = state.quests.filter(q => q.claimed).length; document.getElementById('daily-claimed').textContent = `${claimedCount} / ${state.quests.length} получено`;
    const week = document.getElementById('daily-week'); const active = new Set(state.activeDays || []); week.innerHTML = '';
    const today = new Date(); const labels = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    for (let offset = 6; offset >= 0; offset--) { const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset); const key = todayKey(date); const day = document.createElement('div'); day.className = `streak-day ${active.has(key) ? 'is-active' : ''} ${offset === 0 ? 'is-today' : ''}`; day.innerHTML = `<span>${labels[date.getDay()]}</span><i>${active.has(key) ? '✦' : '·'}</i>`; week.appendChild(day); }
    const list = document.getElementById('daily-quest-list'); list.innerHTML = '';
    state.quests.forEach(quest => {
      const row = document.createElement('article'); row.className = `daily-quest ${quest.claimed ? 'is-claimed' : quest.complete ? 'is-complete' : ''}`;
      const pct = Math.round(quest.progress / quest.target * 100);
      let action = quest.claimed ? `<span class="quest-status claimed">✓ Получено</span>` : quest.complete ? `<button class="btn btn-primary btn-sm" type="button" data-quest-claim="${quest.id}">Забрать +${quest.reward} XP</button>` : `<a class="quest-link" href="${quest.href}">${quest.kind === 'profile' ? 'Открыть профиль ↗' : quest.kind === 'games' ? 'Выбрать игру ↗' : 'На главную ↗'}</a>`;
      row.innerHTML = `<div class="quest-icon">${quest.icon}</div><div class="quest-content"><div class="quest-title-row"><strong>${quest.title}</strong><span class="quest-reward">+${quest.reward} XP</span></div><p>${quest.description}</p><div class="quest-progress"><span style="width:${pct}%"></span></div><div class="quest-foot"><span>${quest.progress} / ${quest.target}</span>${action}</div></div>`;
      list.appendChild(row);
    });
  };
  const initDailyQuests = () => {
    const page = location.pathname.split('/').pop() || 'index.html';
    markDailyVisit(page);
    const nav = document.querySelector('[data-main-nav]');
    if (nav && !nav.querySelector('[data-daily-nav]')) { const link = document.createElement('a'); link.className = 'nav-link daily-nav-link'; link.href = 'index.html#daily-quests'; link.textContent = '⚡ Задания'; link.dataset.dailyNav = 'true'; nav.appendChild(link); }
    if (page === 'index.html' || page === '') {
      const hero = document.querySelector('.home-hero'); if (hero && !document.getElementById('daily-quests')) hero.insertAdjacentElement('afterend', makeDailyPanel());
    } else if (page === 'profile.html') {
      const hero = document.querySelector('.page-hero'); if (hero && !document.getElementById('daily-quests')) hero.insertAdjacentElement('afterend', makeDailyPanel());
    }
    document.addEventListener('click', event => { const button = event.target.closest('[data-quest-claim]'); if (!button) return; claimDailyQuest(button.dataset.questClaim); renderDailyPanel(); });
    window.addEventListener('luxora:daily', renderDailyPanel);
    renderDailyPanel();
  };
  document.addEventListener('DOMContentLoaded', () => { initLoader(); initHeader(); initDisclaimer(); initParticles(); initDailyQuests(); });
  window.Luxora = { KEYS, START_BALANCE, format, getBalance, setBalance, addBalance, spend, record, getHistory, getSnapshots, toast, playTone, toggleSound, confetti, bonus, countUp, getDailyState, claimDailyQuest, markDailyVisit };
  window.addEventListener('storage', event => { if (event.key === KEYS.balance) updateBalanceDisplays(Number(event.oldValue) || 0, Number(event.newValue) || 0); });
})();
