// ===== Frame Logic — AI 워크스페이스 =====

(function () {
  'use strict';

  // ── Utility ──
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => toast('클립보드에 복사되었습니다'),
      () => toast('복사에 실패했습니다')
    );
  }

  // ── Tab Navigation ──
  const tabBtns = $$('.tab-btn');
  const tabPanels = $$('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ══════════════════════════════════════
  // 1. AI 컨텍스트 탭
  // ══════════════════════════════════════
  const CTX_KEY = 'fl_contexts';

  function buildContextPrompt() {
    const project = $('#ctx-project').value.trim();
    const background = $('#ctx-background').value.trim();
    const goal = $('#ctx-goal').value.trim();
    const constraints = $('#ctx-constraints').value.trim();
    const reference = $('#ctx-reference').value.trim();

    let prompt = '';
    if (project) prompt += `## 프로젝트: ${project}\n\n`;
    if (background) prompt += `## 배경\n${background}\n\n`;
    if (goal) prompt += `## 목표\n${goal}\n\n`;
    if (constraints) prompt += `## 제약 조건\n${constraints}\n\n`;
    if (reference) prompt += `## 참고 자료\n${reference}\n`;
    return prompt.trim();
  }

  function getContextData() {
    return {
      id: uid(),
      project: $('#ctx-project').value.trim(),
      background: $('#ctx-background').value.trim(),
      goal: $('#ctx-goal').value.trim(),
      constraints: $('#ctx-constraints').value.trim(),
      reference: $('#ctx-reference').value.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function loadContextToForm(item) {
    $('#ctx-project').value = item.project || '';
    $('#ctx-background').value = item.background || '';
    $('#ctx-goal').value = item.goal || '';
    $('#ctx-constraints').value = item.constraints || '';
    $('#ctx-reference').value = item.reference || '';
  }

  function clearContextForm() {
    $('#ctx-project').value = '';
    $('#ctx-background').value = '';
    $('#ctx-goal').value = '';
    $('#ctx-constraints').value = '';
    $('#ctx-reference').value = '';
  }

  function renderContextList() {
    const items = load(CTX_KEY);
    const ul = $('#ctx-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 컨텍스트가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(item => `
      <li class="saved-item" data-id="${item.id}">
        <div class="saved-item-info" data-action="load">
          <div class="saved-item-title">${escapeHtml(item.project || '(제목 없음)')}</div>
          <div class="saved-item-date">${formatDate(item.createdAt)}</div>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>
        </div>
      </li>
    `).join('');
  }

  $('#ctx-copy').addEventListener('click', () => {
    const text = buildContextPrompt();
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#ctx-save').addEventListener('click', () => {
    const data = getContextData();
    if (!data.project && !data.background && !data.goal) {
      toast('최소 한 가지 항목을 입력해주세요');
      return;
    }
    const items = load(CTX_KEY);
    items.unshift(data);
    save(CTX_KEY, items);
    renderContextList();
    toast('컨텍스트가 저장되었습니다');
  });

  $('#ctx-clear').addEventListener('click', () => {
    clearContextForm();
    toast('초기화되었습니다');
  });

  $('#ctx-items').addEventListener('click', (e) => {
    const li = e.target.closest('.saved-item');
    if (!li) return;
    const id = li.dataset.id;
    const items = load(CTX_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(CTX_KEY, items.filter(i => i.id !== id));
      renderContextList();
      toast('삭제되었습니다');
    } else {
      const item = items.find(i => i.id === id);
      if (item) { loadContextToForm(item); toast('불러왔습니다'); }
    }
  });

  // ══════════════════════════════════════
  // 2. 아이디어 보드 탭
  // ══════════════════════════════════════
  const IDEA_KEY = 'fl_ideas';

  function getIdeaData() {
    return {
      id: uid(),
      title: $('#idea-title').value.trim(),
      detail: $('#idea-detail').value.trim(),
      tags: $('#idea-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString()
    };
  }

  function clearIdeaForm() {
    $('#idea-title').value = '';
    $('#idea-detail').value = '';
    $('#idea-tags').value = '';
  }

  function renderIdeaBoard(filter) {
    let items = load(IDEA_KEY);
    if (filter) {
      const q = filter.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.detail && i.detail.toLowerCase().includes(q)) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    const board = $('#idea-board');
    if (items.length === 0) {
      board.innerHTML = '<div class="empty-state">아이디어를 추가해보세요</div>';
      return;
    }
    board.innerHTML = items.map(item => `
      <div class="idea-card" data-id="${item.id}">
        <div class="idea-card-header">
          <div class="idea-card-title">${escapeHtml(item.title)}</div>
          <button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>
        </div>
        ${item.detail ? `<div class="idea-card-detail">${escapeHtml(item.detail)}</div>` : ''}
        <div class="idea-card-footer">
          <div class="idea-tags">${item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="idea-card-date">${formatDate(item.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  $('#idea-add').addEventListener('click', () => {
    const data = getIdeaData();
    if (!data.title) { toast('아이디어 제목을 입력해주세요'); return; }
    const items = load(IDEA_KEY);
    items.unshift(data);
    save(IDEA_KEY, items);
    clearIdeaForm();
    renderIdeaBoard($('#idea-search').value);
    toast('아이디어가 추가되었습니다');
  });

  $('#idea-search').addEventListener('input', (e) => {
    renderIdeaBoard(e.target.value);
  });

  $('#idea-board').addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="delete"]')) return;
    const card = e.target.closest('.idea-card');
    if (!card) return;
    const items = load(IDEA_KEY).filter(i => i.id !== card.dataset.id);
    save(IDEA_KEY, items);
    renderIdeaBoard($('#idea-search').value);
    toast('삭제되었습니다');
  });

  // ══════════════════════════════════════
  // 3. 회의 메모 탭
  // ══════════════════════════════════════
  const MTG_KEY = 'fl_meetings';

  function getMeetingData() {
    return {
      id: uid(),
      title: $('#mtg-title').value.trim(),
      date: $('#mtg-date').value,
      attendees: $('#mtg-attendees').value.trim(),
      agenda: $('#mtg-agenda').value.trim(),
      notes: $('#mtg-notes').value.trim(),
      decisions: $('#mtg-decisions').value.trim(),
      actions: $('#mtg-actions').value.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function buildMeetingText(item) {
    let text = '';
    if (item.title) text += `# ${item.title}\n`;
    if (item.date) text += `일시: ${formatDate(item.date)}\n`;
    if (item.attendees) text += `참석자: ${item.attendees}\n`;
    text += '\n';
    if (item.agenda) text += `## 안건\n${item.agenda}\n\n`;
    if (item.notes) text += `## 회의 내용\n${item.notes}\n\n`;
    if (item.decisions) text += `## 결정 사항\n${item.decisions}\n\n`;
    if (item.actions) text += `## 액션 아이템\n${item.actions}\n`;
    return text.trim();
  }

  function loadMeetingToForm(item) {
    $('#mtg-title').value = item.title || '';
    $('#mtg-date').value = item.date || '';
    $('#mtg-attendees').value = item.attendees || '';
    $('#mtg-agenda').value = item.agenda || '';
    $('#mtg-notes').value = item.notes || '';
    $('#mtg-decisions').value = item.decisions || '';
    $('#mtg-actions').value = item.actions || '';
  }

  function clearMeetingForm() {
    $('#mtg-title').value = '';
    $('#mtg-date').value = '';
    $('#mtg-attendees').value = '';
    $('#mtg-agenda').value = '';
    $('#mtg-notes').value = '';
    $('#mtg-decisions').value = '';
    $('#mtg-actions').value = '';
  }

  function renderMeetingList() {
    const items = load(MTG_KEY);
    const ul = $('#mtg-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 회의 메모가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(item => `
      <li class="saved-item" data-id="${item.id}">
        <div class="saved-item-info" data-action="load">
          <div class="saved-item-title">${escapeHtml(item.title || '(제목 없음)')}</div>
          <div class="saved-item-date">${formatDate(item.date || item.createdAt)}</div>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>
        </div>
      </li>
    `).join('');
  }

  $('#mtg-save').addEventListener('click', () => {
    const data = getMeetingData();
    if (!data.title && !data.notes) { toast('회의명 또는 내용을 입력해주세요'); return; }
    const items = load(MTG_KEY);
    items.unshift(data);
    save(MTG_KEY, items);
    renderMeetingList();
    toast('회의 메모가 저장되었습니다');
  });

  $('#mtg-copy').addEventListener('click', () => {
    const data = getMeetingData();
    const text = buildMeetingText(data);
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#mtg-clear').addEventListener('click', () => {
    clearMeetingForm();
    toast('초기화되었습니다');
  });

  $('#mtg-items').addEventListener('click', (e) => {
    const li = e.target.closest('.saved-item');
    if (!li) return;
    const id = li.dataset.id;
    const items = load(MTG_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(MTG_KEY, items.filter(i => i.id !== id));
      renderMeetingList();
      toast('삭제되었습니다');
    } else {
      const item = items.find(i => i.id === id);
      if (item) { loadMeetingToForm(item); toast('불러왔습니다'); }
    }
  });

  // ══════════════════════════════════════
  // 4. 제언 템플릿 탭
  // ══════════════════════════════════════
  const PROP_KEY = 'fl_proposals';

  function getProposalData() {
    return {
      id: uid(),
      title: $('#prop-title').value.trim(),
      to: $('#prop-to').value.trim(),
      problem: $('#prop-problem').value.trim(),
      suggestion: $('#prop-suggestion').value.trim(),
      benefit: $('#prop-benefit').value.trim(),
      risk: $('#prop-risk').value.trim(),
      next: $('#prop-next').value.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function buildProposalText(item) {
    let text = '';
    if (item.title) text += `# ${item.title}\n\n`;
    if (item.to) text += `대상: ${item.to}\n\n`;
    if (item.problem) text += `## 현재 문제 / 배경\n${item.problem}\n\n`;
    if (item.suggestion) text += `## 제안 내용\n${item.suggestion}\n\n`;
    if (item.benefit) text += `## 기대 효과\n${item.benefit}\n\n`;
    if (item.risk) text += `## 리스크 / 고려 사항\n${item.risk}\n\n`;
    if (item.next) text += `## 다음 단계\n${item.next}\n`;
    return text.trim();
  }

  function loadProposalToForm(item) {
    $('#prop-title').value = item.title || '';
    $('#prop-to').value = item.to || '';
    $('#prop-problem').value = item.problem || '';
    $('#prop-suggestion').value = item.suggestion || '';
    $('#prop-benefit').value = item.benefit || '';
    $('#prop-risk').value = item.risk || '';
    $('#prop-next').value = item.next || '';
  }

  function clearProposalForm() {
    $('#prop-title').value = '';
    $('#prop-to').value = '';
    $('#prop-problem').value = '';
    $('#prop-suggestion').value = '';
    $('#prop-benefit').value = '';
    $('#prop-risk').value = '';
    $('#prop-next').value = '';
  }

  function renderProposalList() {
    const items = load(PROP_KEY);
    const ul = $('#prop-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 제언서가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(item => `
      <li class="saved-item" data-id="${item.id}">
        <div class="saved-item-info" data-action="load">
          <div class="saved-item-title">${escapeHtml(item.title || '(제목 없음)')}</div>
          <div class="saved-item-date">${formatDate(item.createdAt)}</div>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>
        </div>
      </li>
    `).join('');
  }

  $('#prop-copy').addEventListener('click', () => {
    const data = getProposalData();
    const text = buildProposalText(data);
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#prop-save').addEventListener('click', () => {
    const data = getProposalData();
    if (!data.title && !data.suggestion) { toast('제목 또는 제안 내용을 입력해주세요'); return; }
    const items = load(PROP_KEY);
    items.unshift(data);
    save(PROP_KEY, items);
    renderProposalList();
    toast('제언서가 저장되었습니다');
  });

  $('#prop-clear').addEventListener('click', () => {
    clearProposalForm();
    toast('초기화되었습니다');
  });

  $('#prop-items').addEventListener('click', (e) => {
    const li = e.target.closest('.saved-item');
    if (!li) return;
    const id = li.dataset.id;
    const items = load(PROP_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(PROP_KEY, items.filter(i => i.id !== id));
      renderProposalList();
      toast('삭제되었습니다');
    } else {
      const item = items.find(i => i.id === id);
      if (item) { loadProposalToForm(item); toast('불러왔습니다'); }
    }
  });

  // ── HTML Escape ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  function init() {
    // Set default meeting datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    $('#mtg-date').value = now.toISOString().slice(0, 16);

    renderContextList();
    renderIdeaBoard();
    renderMeetingList();
    renderProposalList();
  }

  init();
})();
