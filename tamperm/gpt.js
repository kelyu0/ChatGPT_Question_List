// ==UserScript==
// @name         ChatGPT Question Outline
// @namespace    outline-questions-only
// @version      0.0.1
// @description  显示用户问题大纲
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-end
// @noframes
// @downloadURL  https://gist.githubusercontent.com/kelyu0/127e62073216410b10bc3378069c181d/raw/chatgpt-question-outline.user.js
// @updateURL    https://gist.githubusercontent.com/kelyu0/127e62073216410b10bc3378069c181d/raw/chatgpt-question-outline.user.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /** ---------- Shadow DOM 深搜 ---------- */
  function walkAllElements(root = document, out = []) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    let n = walker.currentNode;
    while (n) {
      out.push(n);
      if (n.shadowRoot) walkAllElements(n.shadowRoot, out);
      n = walker.nextNode();
    }
    return out;
  }
  function qsaDeep(selector) {
    const all = walkAllElements();
    const res = [];
    for (const el of all) {
      try { if (el.matches && el.matches(selector)) res.push(el); } catch {}
    }
    return res;
  }

  /** ---------- 工具 ---------- */
  const short = (s, n = 200) => (s && s.length > n ? s.slice(0, n) + '…' : (s || ''));
  const uid = (() => { let i = 0; return () => `cgo-${Date.now()}-${i++}`; })();
  function ensureId(el) { if (!el.getAttribute('data-cgo-id')) el.setAttribute('data-cgo-id', uid()); return el.getAttribute('data-cgo-id'); }
  const checksum = (items) => items.map(it => `${it.id}|${it.text}`).join('\n');

  /** ---------- 只采集“用户问题” ---------- */
  function collectQuestions() {
    let nodes = qsaDeep('div[data-message-author-role="user"]');
    if (nodes.length === 0) {
      const turns = qsaDeep('[data-testid^="conversation-turn"]');
      for (const t of turns) {
        const u = t.querySelector?.('[data-message-author-role="user"]');
        if (u) nodes.push(u);
      }
    }
    return nodes;
  }

  function parseQuestions() {
    const nodes = collectQuestions();
    return nodes.map(n => {
      const id = ensureId(n);
      const txt = (n.innerText || '').trim().replace(/[\n\r]+/g, ' ');
      const hasImg = !!n.querySelector?.('img,picture,video,canvas');
      return {
        id,
        text: short((hasImg ? '[image] ' : '') + txt, 300),
        full: txt
      };
    });
  }

  /** ---------- UI：按钮 ---------- */
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    position: 'fixed', right: '12px', bottom: '12px',
    padding: '8px 10px', borderRadius: '999px',
    border: '1px solid #e2e8f0', background: '#fff', color: '#111',
    font: '13px/1.4 -apple-system,Segoe UI,Roboto,Arial',
    zIndex: 2147483647, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,.08)'
  });
  btn.textContent = 'Outline';
  btn.title = '打开问题大纲';
  btn.addEventListener('click', openPanel);
  document.documentElement.appendChild(btn);

  /** ---------- 全局状态（用于防抖与暂停刷新） ---------- */
  let lastSig = '';
  let pauseUntil = 0;           // 时间戳，早于它不刷新
  let renderTimer = null;       // 渲染节流
  const RENDER_DELAY = 250;     // Mutation 后延迟
  const PAUSE_MS = 1000;        // 用户交互后的暂停时长

  /** ---------- UI：面板（只问题） ---------- */
  function openPanel() {
    if (document.getElementById('qo-panel')) { scheduleRender(true); return; }

    const panel = document.createElement('div');
    panel.id = 'qo-panel';
    Object.assign(panel.style, {
      position: 'fixed', top: '80px', right: '12px',
      width: '360px', maxHeight: '70vh', overflow: 'auto',
      font: '13px/1.4 -apple-system,Segoe UI,Roboto,Arial',
      background: '#fff', color: '#111',
      border: '1px solid #e5e7eb', borderRadius: '12px',
      padding: '8px', zIndex: 2147483647, boxShadow: '0 10px 30px rgba(0,0,0,.15)'
    });

    const style = document.createElement('style');
    style.textContent = `
      .qo-row{ padding:6px 4px; cursor:pointer; border-bottom:1px solid #f1f5f9; }
      .qo-row.oneline{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .qo-hi{ outline:2px solid #60a5fa !important; border-radius:6px !important; }
      .qo-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
      .qo-title{ font-weight:600; }
      .qo-actions{ display:flex; gap:6px; }
      .qo-btn{ padding:2px 8px; border:1px solid #e2e8f0; background:#fff; border-radius:999px; cursor:pointer; }
      .qo-empty{ color:#94a3b8; font-size:12px; padding:6px 0; }
    `;
    document.documentElement.appendChild(style);

    const head = document.createElement('div'); head.className = 'qo-head';
    const title = document.createElement('div'); title.className = 'qo-title'; title.textContent = '问题大纲';
    const actions = document.createElement('div'); actions.className = 'qo-actions';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'qo-btn';
    refreshBtn.textContent = '刷新';
    refreshBtn.onclick = () => render(true); // 强制刷新

    const closeBtn = document.createElement('button');
    closeBtn.className = 'qo-btn';
    closeBtn.textContent = '关闭';
    closeBtn.onclick = () => panel.remove();

    actions.appendChild(refreshBtn); actions.appendChild(closeBtn);
    head.appendChild(title); head.appendChild(actions);

    const list = document.createElement('div'); list.id = 'qo-list';

    panel.appendChild(head);
    panel.appendChild(list);
    document.documentElement.appendChild(panel);

    // ==== 用户交互 → 暂停自动刷新 ====
    const markPause = () => { pauseUntil = Date.now() + PAUSE_MS; };
    panel.addEventListener('mouseenter', markPause, { passive: true });
    panel.addEventListener('wheel', markPause, { passive: true });
    panel.addEventListener('scroll', markPause, { passive: true });
    panel.addEventListener('mousedown', markPause, { passive: true });
    panel.addEventListener('touchstart', markPause, { passive: true });

    render(true); // 初次强制
  }

  /** ---------- 渲染（保留滚动、按需更新） ---------- */
  function render(force = false) {
    const panel = document.getElementById('qo-panel');
    if (!panel) return;

    // 正在交互就跳过非强制刷新
    if (!force && Date.now() < pauseUntil) return;

    const list = document.getElementById('qo-list');
    const prevTop = list ? list.scrollTop : 0;

    const data = parseQuestions();
    const sig = checksum(data);

    if (!force && sig === lastSig) {
      // 数据没变，保持现有列表与滚动
      return;
    }
    lastSig = sig;

    list.innerHTML = '';
    if (!data.length) {
      const empty = document.createElement('div');
      empty.className = 'qo-empty';
      empty.textContent = '未找到问题';
      list.appendChild(empty);
      return;
    }

    data.forEach(it => {
      const row = document.createElement('div');
      row.className = 'qo-row oneline';
      row.textContent = it.text;     // 单行展示
      row.title = it.full;           // 悬停看全量
      row.addEventListener('click', () => {
        const all = walkAllElements();
        const target = all.find(el => el.getAttribute && el.getAttribute('data-cgo-id') === it.id);
        if (!target) return;
        target.style.scrollMarginTop = '90px';
        target.classList.add('qo-hi');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => target.classList.remove('qo-hi'), 1200);
      });
      list.appendChild(row);
    });

    // 恢复滚动位置
    list.scrollTop = prevTop;
  }

  // 渲染节流/合并
  function scheduleRender(force = false) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(force), RENDER_DELAY);
  }

  /** ---------- 监听变化（打开面板时才自动刷新） ---------- */
  const mo = new MutationObserver(() => {
    if (document.getElementById('qo-panel')) scheduleRender(false);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // 切换会话时，如果面板开着，延迟刷新
  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      if (document.getElementById('qo-panel')) setTimeout(() => render(true), 500);
    }
  }, 300);

})();