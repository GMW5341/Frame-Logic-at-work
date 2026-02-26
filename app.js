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
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
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
      function () { toast('클립보드에 복사되었습니다'); },
      function () { toast('복사에 실패했습니다'); }
    );
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function nowLocalISO() {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function setDatetimeNow(inputId) {
    $(inputId).value = nowLocalISO();
  }

  // ── Live Clock ──
  function updateClocks() {
    var now = new Date();
    var str = now.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    }) + ' ' + now.toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    $$('[data-clock]').forEach(function (el) {
      el.textContent = str;
    });
  }
  updateClocks();
  setInterval(updateClocks, 1000);

  // ── Tab Navigation ──
  var tabBtns = $$('.tab-btn');
  var tabPanels = $$('.tab-panel');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      $('#tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ══════════════════════════════════════
  // 1. AI 컨텍스트 탭
  // ══════════════════════════════════════
  var CTX_KEY = 'fl_contexts';

  function showCtxList() {
    $('#ctx-list-view').style.display = '';
    $('#ctx-form-view').style.display = 'none';
  }

  function showCtxForm() {
    $('#ctx-list-view').style.display = 'none';
    $('#ctx-form-view').style.display = '';
  }

  function clearContextForm() {
    $('#ctx-project').value = '';
    $('#ctx-background').value = '';
    $('#ctx-goal').value = '';
    $('#ctx-constraints').value = '';
    $('#ctx-reference').value = '';
    setDatetimeNow('#ctx-datetime');
  }

  function buildContextPrompt() {
    var project = $('#ctx-project').value.trim();
    var background = $('#ctx-background').value.trim();
    var goal = $('#ctx-goal').value.trim();
    var constraints = $('#ctx-constraints').value.trim();
    var reference = $('#ctx-reference').value.trim();
    var prompt = '';
    if (project) prompt += '## 프로젝트: ' + project + '\n\n';
    if (background) prompt += '## 배경\n' + background + '\n\n';
    if (goal) prompt += '## 목표\n' + goal + '\n\n';
    if (constraints) prompt += '## 제약 조건\n' + constraints + '\n\n';
    if (reference) prompt += '## 참고 자료\n' + reference + '\n';
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
      createdAt: $('#ctx-datetime').value || new Date().toISOString()
    };
  }

  function loadContextToForm(item) {
    showCtxForm();
    $('#ctx-project').value = item.project || '';
    $('#ctx-background').value = item.background || '';
    $('#ctx-goal').value = item.goal || '';
    $('#ctx-constraints').value = item.constraints || '';
    $('#ctx-reference').value = item.reference || '';
    // Load saved datetime
    if (item.createdAt) {
      var d = new Date(item.createdAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('#ctx-datetime').value = d.toISOString().slice(0, 16);
    }
  }

  function renderContextList() {
    var items = load(CTX_KEY);
    var ul = $('#ctx-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 컨텍스트가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(function (item) {
      return '<li class="saved-item" data-id="' + item.id + '">' +
        '<div class="saved-item-info" data-action="load">' +
          '<div class="saved-item-title">' + escapeHtml(item.project || '(제목 없음)') + '</div>' +
          '<div class="saved-item-date">' + formatDate(item.createdAt) + '</div>' +
        '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  $('#ctx-new').addEventListener('click', function () {
    clearContextForm();
    showCtxForm();
  });

  $('#ctx-back').addEventListener('click', function () {
    showCtxList();
  });

  $('#ctx-copy').addEventListener('click', function () {
    var text = buildContextPrompt();
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#ctx-save').addEventListener('click', function () {
    var data = getContextData();
    if (!data.project && !data.background && !data.goal) {
      toast('최소 한 가지 항목을 입력해주세요');
      return;
    }
    var items = load(CTX_KEY);
    items.unshift(data);
    save(CTX_KEY, items);
    renderContextList();
    showCtxList();
    toast('컨텍스트가 저장되었습니다');
  });

  $('#ctx-clear').addEventListener('click', function () {
    clearContextForm();
    toast('초기화되었습니다');
  });

  $('#ctx-items').addEventListener('click', function (e) {
    var li = e.target.closest('.saved-item');
    if (!li) return;
    var id = li.dataset.id;
    var items = load(CTX_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(CTX_KEY, items.filter(function (i) { return i.id !== id; }));
      renderContextList();
      toast('삭제되었습니다');
    } else {
      var item = items.find(function (i) { return i.id === id; });
      if (item) { loadContextToForm(item); toast('불러왔습니다'); }
    }
  });

  // ══════════════════════════════════════
  // 2. 아이디어 보드 탭
  // ══════════════════════════════════════
  var IDEA_KEY = 'fl_ideas';

  function showIdeaList() {
    $('#idea-list-view').style.display = '';
    $('#idea-form-view').style.display = 'none';
  }

  function showIdeaForm() {
    $('#idea-list-view').style.display = 'none';
    $('#idea-form-view').style.display = '';
  }

  function clearIdeaForm() {
    $('#idea-title').value = '';
    $('#idea-detail').value = '';
    $('#idea-tags').value = '';
    setDatetimeNow('#idea-datetime');
  }

  function getIdeaData() {
    return {
      id: uid(),
      title: $('#idea-title').value.trim(),
      detail: $('#idea-detail').value.trim(),
      tags: $('#idea-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      createdAt: $('#idea-datetime').value || new Date().toISOString()
    };
  }

  function loadIdeaToForm(item) {
    showIdeaForm();
    $('#idea-title').value = item.title || '';
    $('#idea-detail').value = item.detail || '';
    $('#idea-tags').value = (item.tags || []).join(', ');
    if (item.createdAt) {
      var d = new Date(item.createdAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('#idea-datetime').value = d.toISOString().slice(0, 16);
    }
  }

  function renderIdeaBoard(filter) {
    var items = load(IDEA_KEY);
    if (filter) {
      var q = filter.toLowerCase();
      items = items.filter(function (i) {
        return i.title.toLowerCase().includes(q) ||
          (i.detail && i.detail.toLowerCase().includes(q)) ||
          i.tags.some(function (t) { return t.toLowerCase().includes(q); });
      });
    }
    var board = $('#idea-board');
    if (items.length === 0) {
      board.innerHTML = '<div class="empty-state">아이디어를 추가해보세요</div>';
      return;
    }
    board.innerHTML = items.map(function (item) {
      return '<div class="idea-card" data-id="' + item.id + '">' +
        '<div class="idea-card-header">' +
          '<div class="idea-card-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="idea-card-actions">' +
            '<button class="btn btn-small btn-secondary" data-action="edit" title="편집">✎</button>' +
            '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
          '</div>' +
        '</div>' +
        (item.detail ? '<div class="idea-card-detail">' + escapeHtml(item.detail) + '</div>' : '') +
        '<div class="idea-card-footer">' +
          '<div class="idea-tags">' + (item.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
          '<div class="idea-card-date">' + formatDate(item.createdAt) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  $('#idea-new').addEventListener('click', function () {
    clearIdeaForm();
    showIdeaForm();
  });

  $('#idea-back').addEventListener('click', function () {
    showIdeaList();
  });

  $('#idea-add').addEventListener('click', function () {
    var data = getIdeaData();
    if (!data.title) { toast('아이디어 제목을 입력해주세요'); return; }
    var items = load(IDEA_KEY);
    items.unshift(data);
    save(IDEA_KEY, items);
    clearIdeaForm();
    renderIdeaBoard($('#idea-search').value);
    showIdeaList();
    toast('아이디어가 저장되었습니다');
  });

  $('#idea-form-clear').addEventListener('click', function () {
    clearIdeaForm();
    toast('초기화되었습니다');
  });

  $('#idea-search').addEventListener('input', function (e) {
    renderIdeaBoard(e.target.value);
  });

  $('#idea-board').addEventListener('click', function (e) {
    var card = e.target.closest('.idea-card');
    if (!card) return;
    var id = card.dataset.id;

    if (e.target.closest('[data-action="delete"]')) {
      var items = load(IDEA_KEY).filter(function (i) { return i.id !== id; });
      save(IDEA_KEY, items);
      renderIdeaBoard($('#idea-search').value);
      toast('삭제되었습니다');
    } else if (e.target.closest('[data-action="edit"]')) {
      var item = load(IDEA_KEY).find(function (i) { return i.id === id; });
      if (item) {
        // Remove old, user will re-save
        var filtered = load(IDEA_KEY).filter(function (i) { return i.id !== id; });
        save(IDEA_KEY, filtered);
        loadIdeaToForm(item);
        toast('편집 모드');
      }
    }
  });

  // ══════════════════════════════════════
  // 3. 회의 메모 탭
  // ══════════════════════════════════════
  var MTG_KEY = 'fl_meetings';

  var MTG_TYPE_LABELS = {
    regular: '📅 정기 회의',
    brainstorm: '🧠 브레인스토밍',
    sprint: '🏃 스프린트 리뷰',
    decision: '⚖️ 의사결정',
    kickoff: '🚀 킥오프',
    oneone: '👥 1:1 미팅'
  };

  var currentMtgType = '';
  var mtgAgendaItems = [];

  function showMtgTypeSelect() {
    $('#mtg-type-select').style.display = '';
    $('#mtg-form-view').style.display = 'none';
  }

  function showMtgForm(type) {
    currentMtgType = type;
    $('#mtg-type-select').style.display = 'none';
    $('#mtg-form-view').style.display = '';
    $('#mtg-type-badge').textContent = MTG_TYPE_LABELS[type] || type;
  }

  function renderAgendaList() {
    var container = $('#mtg-agenda-list');
    if (mtgAgendaItems.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);padding:4px 0;">아래에서 안건을 추가하세요</div>';
      return;
    }
    container.innerHTML = mtgAgendaItems.map(function (text, i) {
      return '<div class="mtg-agenda-item" data-idx="' + i + '">' +
        '<span class="mtg-agenda-num">' + (i + 1) + '.</span>' +
        '<span>' + escapeHtml(text) + '</span>' +
        '<button class="btn btn-small btn-danger mtg-agenda-remove" title="삭제">✕</button>' +
      '</div>';
    }).join('');
  }

  function addAgendaItem(text) {
    if (!text) return;
    mtgAgendaItems.push(text);
    renderAgendaList();
  }

  function getMeetingData() {
    return {
      id: uid(),
      type: currentMtgType,
      title: $('#mtg-title').value.trim(),
      date: $('#mtg-date').value,
      attendees: $('#mtg-attendees').value.trim(),
      agenda: mtgAgendaItems.slice(),
      notes: $('#mtg-notes').value.trim(),
      decisions: $('#mtg-decisions').value.trim(),
      actions: $('#mtg-actions').value.trim(),
      createdAt: new Date().toISOString()
    };
  }

  function buildMeetingText(item) {
    var text = '';
    if (item.title) text += '# ' + item.title + '\n';
    var typeLabel = MTG_TYPE_LABELS[item.type] || '';
    if (typeLabel) text += '유형: ' + typeLabel + '\n';
    if (item.date) text += '일시: ' + formatDate(item.date) + '\n';
    if (item.attendees) text += '참석자: ' + item.attendees + '\n';
    text += '\n';
    var agendaArr = item.agenda;
    if (agendaArr && agendaArr.length > 0) {
      text += '## 안건\n';
      agendaArr.forEach(function (a, i) { text += (i + 1) + '. ' + a + '\n'; });
      text += '\n';
    }
    if (item.notes) text += '## 회의 내용\n' + item.notes + '\n\n';
    if (item.decisions) text += '## 결정 사항\n' + item.decisions + '\n\n';
    if (item.actions) text += '## 액션 플랜\n' + item.actions + '\n';
    return text.trim();
  }

  function loadMeetingToForm(item) {
    showMtgForm(item.type || 'regular');
    $('#mtg-title').value = item.title || '';
    $('#mtg-date').value = item.date || '';
    $('#mtg-attendees').value = item.attendees || '';
    if (Array.isArray(item.agenda)) {
      mtgAgendaItems = item.agenda.slice();
    } else if (item.agenda) {
      mtgAgendaItems = item.agenda.split('\n').filter(Boolean);
    } else {
      mtgAgendaItems = [];
    }
    renderAgendaList();
    $('#mtg-notes').value = item.notes || '';
    $('#mtg-decisions').value = item.decisions || '';
    $('#mtg-actions').value = item.actions || '';
  }

  function clearMeetingForm() {
    $('#mtg-title').value = '';
    $('#mtg-attendees').value = '';
    mtgAgendaItems = [];
    renderAgendaList();
    $('#mtg-notes').value = '';
    $('#mtg-decisions').value = '';
    $('#mtg-actions').value = '';
    setDatetimeNow('#mtg-date');
  }

  function renderMeetingList() {
    var items = load(MTG_KEY);
    var ul = $('#mtg-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 회의 메모가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(function (item) {
      var typeBadge = MTG_TYPE_LABELS[item.type] || '';
      return '<li class="saved-item" data-id="' + item.id + '">' +
        '<div class="saved-item-info" data-action="load">' +
          '<div class="saved-item-title">' + escapeHtml(item.title || '(제목 없음)') +
            (typeBadge ? ' <span class="tag" style="margin-left:6px">' + escapeHtml(typeBadge) + '</span>' : '') +
          '</div>' +
          '<div class="saved-item-date">' + formatDate(item.date || item.createdAt) + '</div>' +
        '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  $$('.mtg-type-card').forEach(function (card) {
    card.addEventListener('click', function () {
      clearMeetingForm();
      showMtgForm(card.dataset.mtgType);
    });
  });

  $('#mtg-back').addEventListener('click', function () {
    showMtgTypeSelect();
  });

  $('#mtg-agenda-add-btn').addEventListener('click', function () {
    var input = $('#mtg-agenda-input');
    addAgendaItem(input.value.trim());
    input.value = '';
    input.focus();
  });

  $('#mtg-agenda-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAgendaItem(this.value.trim());
      this.value = '';
    }
  });

  $('#mtg-agenda-list').addEventListener('click', function (e) {
    if (e.target.closest('.mtg-agenda-remove')) {
      var item = e.target.closest('.mtg-agenda-item');
      var idx = parseInt(item.dataset.idx, 10);
      mtgAgendaItems.splice(idx, 1);
      renderAgendaList();
    }
  });

  $('#mtg-save').addEventListener('click', function () {
    var data = getMeetingData();
    if (!data.title && !data.notes) { toast('회의명 또는 내용을 입력해주세요'); return; }
    var items = load(MTG_KEY);
    items.unshift(data);
    save(MTG_KEY, items);
    renderMeetingList();
    showMtgTypeSelect();
    toast('회의 메모가 저장되었습니다');
  });

  $('#mtg-copy').addEventListener('click', function () {
    var data = getMeetingData();
    var text = buildMeetingText(data);
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#mtg-clear').addEventListener('click', function () {
    clearMeetingForm();
    toast('초기화되었습니다');
  });

  $('#mtg-items').addEventListener('click', function (e) {
    var li = e.target.closest('.saved-item');
    if (!li) return;
    var id = li.dataset.id;
    var items = load(MTG_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(MTG_KEY, items.filter(function (i) { return i.id !== id; }));
      renderMeetingList();
      toast('삭제되었습니다');
    } else {
      var item = items.find(function (i) { return i.id === id; });
      if (item) { loadMeetingToForm(item); toast('불러왔습니다'); }
    }
  });

  // ══════════════════════════════════════
  // 4. 제언 템플릿 탭 (동적 항목)
  // ══════════════════════════════════════
  var PROP_KEY = 'fl_proposals';

  function showPropList() {
    $('#prop-list-view').style.display = '';
    $('#prop-form-view').style.display = 'none';
  }

  function showPropForm() {
    $('#prop-list-view').style.display = 'none';
    $('#prop-form-view').style.display = '';
  }

  function addProposalField(label, value) {
    var container = $('#prop-fields');
    var fieldId = 'pf-' + uid();
    var div = document.createElement('div');
    div.className = 'prop-field-item';
    div.dataset.fieldId = fieldId;
    div.innerHTML =
      '<div class="prop-field-header">' +
        '<input type="text" class="prop-field-label" placeholder="항목명 (예: 배경, 대상, 기대효과...)" value="' + escapeHtml(label || '') + '">' +
        '<button class="btn btn-small btn-danger prop-field-remove" title="삭제">✕</button>' +
      '</div>' +
      '<textarea class="prop-field-value" rows="3" placeholder="내용을 입력하세요">' + escapeHtml(value || '') + '</textarea>';
    container.appendChild(div);
  }

  function getProposalData() {
    var fields = [];
    $$('.prop-field-item').forEach(function (el) {
      var label = el.querySelector('.prop-field-label').value.trim();
      var value = el.querySelector('.prop-field-value').value.trim();
      if (label || value) {
        fields.push({ label: label, value: value });
      }
    });
    return {
      id: uid(),
      title: $('#prop-title').value.trim(),
      fields: fields,
      createdAt: $('#prop-datetime').value || new Date().toISOString()
    };
  }

  function buildProposalText(item) {
    var text = '';
    if (item.title) text += '# ' + item.title + '\n\n';
    if (item.fields) {
      item.fields.forEach(function (f) {
        if (f.label && f.value) {
          text += '## ' + f.label + '\n' + f.value + '\n\n';
        } else if (f.value) {
          text += f.value + '\n\n';
        } else if (f.label) {
          text += '## ' + f.label + '\n\n';
        }
      });
    }
    return text.trim();
  }

  function loadProposalToForm(item) {
    showPropForm();
    $('#prop-title').value = item.title || '';
    $('#prop-fields').innerHTML = '';
    if (item.fields && item.fields.length > 0) {
      item.fields.forEach(function (f) {
        addProposalField(f.label, f.value);
      });
    }
    if (item.createdAt) {
      var d = new Date(item.createdAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('#prop-datetime').value = d.toISOString().slice(0, 16);
    }
  }

  function clearProposalForm() {
    $('#prop-title').value = '';
    $('#prop-fields').innerHTML = '';
    setDatetimeNow('#prop-datetime');
  }

  function renderProposalList() {
    var items = load(PROP_KEY);
    var ul = $('#prop-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 제언서가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(function (item) {
      return '<li class="saved-item" data-id="' + item.id + '">' +
        '<div class="saved-item-info" data-action="load">' +
          '<div class="saved-item-title">' + escapeHtml(item.title || '(제목 없음)') + '</div>' +
          '<div class="saved-item-date">' + formatDate(item.createdAt) + '</div>' +
        '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  $('#prop-new').addEventListener('click', function () {
    clearProposalForm();
    showPropForm();
  });

  $('#prop-back').addEventListener('click', function () {
    showPropList();
  });

  $('#prop-add-field').addEventListener('click', function () {
    addProposalField('', '');
  });

  $('#prop-fields').addEventListener('click', function (e) {
    if (e.target.closest('.prop-field-remove')) {
      e.target.closest('.prop-field-item').remove();
    }
  });

  $('#prop-copy').addEventListener('click', function () {
    var data = getProposalData();
    var text = buildProposalText(data);
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#prop-save').addEventListener('click', function () {
    var data = getProposalData();
    if (!data.title && data.fields.length === 0) { toast('제목 또는 항목을 입력해주세요'); return; }
    var items = load(PROP_KEY);
    items.unshift(data);
    save(PROP_KEY, items);
    renderProposalList();
    showPropList();
    toast('제언서가 저장되었습니다');
  });

  $('#prop-clear').addEventListener('click', function () {
    clearProposalForm();
    toast('초기화되었습니다');
  });

  $('#prop-items').addEventListener('click', function (e) {
    var li = e.target.closest('.saved-item');
    if (!li) return;
    var id = li.dataset.id;
    var items = load(PROP_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(PROP_KEY, items.filter(function (i) { return i.id !== id; }));
      renderProposalList();
      toast('삭제되었습니다');
    } else {
      var item = items.find(function (i) { return i.id === id; });
      if (item) { loadProposalToForm(item); toast('불러왔습니다'); }
    }
  });

  // ══════════════════════════════════════
  // 5. 프레젠테이션 모드
  // ══════════════════════════════════════
  var presSlides = [];
  var presIndex = 0;

  function buildPresSlides(data) {
    var slides = [];
    slides.push({
      type: 'title',
      title: data.title || '(제목 없음)',
      subtitle: formatDate(new Date().toISOString())
    });
    if (data.fields) {
      data.fields.forEach(function (f) {
        if (f.label || f.value) {
          slides.push({
            type: 'content',
            heading: f.label || '',
            body: f.value || ''
          });
        }
      });
    }
    return slides;
  }

  function renderPresSlide() {
    var slide = presSlides[presIndex];
    var stage = $('#pres-stage');
    if (slide.type === 'title') {
      stage.innerHTML =
        '<div class="pres-slide pres-slide-title">' +
          '<h1>' + escapeHtml(slide.title) + '</h1>' +
          '<div class="pres-subtitle">' + escapeHtml(slide.subtitle) + '</div>' +
        '</div>';
    } else {
      stage.innerHTML =
        '<div class="pres-slide pres-slide-content">' +
          (slide.heading ? '<h2>' + escapeHtml(slide.heading) + '</h2>' : '') +
          '<div class="pres-body">' + escapeHtml(slide.body) + '</div>' +
        '</div>';
    }
    $('#pres-page-info').textContent = (presIndex + 1) + ' / ' + presSlides.length;
    $('#pres-prev').disabled = presIndex === 0;
    $('#pres-next').disabled = presIndex === presSlides.length - 1;
  }

  function openPresentation(data) {
    presSlides = buildPresSlides(data);
    if (presSlides.length === 0) { toast('내용을 입력해주세요'); return; }
    presIndex = 0;
    $('#pres-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderPresSlide();
  }

  function closePresentation() {
    $('#pres-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }

  $('#prop-present').addEventListener('click', function () {
    var data = getProposalData();
    if (!data.title && data.fields.length === 0) {
      toast('제언서 내용을 입력해주세요');
      return;
    }
    openPresentation(data);
  });

  $('#pres-close').addEventListener('click', closePresentation);

  $('#pres-prev').addEventListener('click', function () {
    if (presIndex > 0) { presIndex--; renderPresSlide(); }
  });

  $('#pres-next').addEventListener('click', function () {
    if (presIndex < presSlides.length - 1) { presIndex++; renderPresSlide(); }
  });

  document.addEventListener('keydown', function (e) {
    if (!$('#pres-overlay').classList.contains('active')) return;
    if (e.key === 'Escape') { closePresentation(); }
    else if (e.key === 'ArrowLeft') { if (presIndex > 0) { presIndex--; renderPresSlide(); } }
    else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      if (presIndex < presSlides.length - 1) { presIndex++; renderPresSlide(); }
    }
  });

  // ── Init ──
  function init() {
    renderContextList();
    renderIdeaBoard();
    renderMeetingList();
    renderAgendaList();
    renderProposalList();
  }

  init();
})();
