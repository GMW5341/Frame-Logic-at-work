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

  function htmlToText(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || '';
  }

  function nowLocalISO() {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function setDatetimeNow(inputId) {
    $(inputId).value = nowLocalISO();
  }

  // ── Settings ──
  var SETTINGS_KEY = 'fl_settings';
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveSettingsData(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
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

  function switchTab(tabName) {
    tabBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    tabPanels.forEach(function (p) { p.classList.remove('active'); });
    var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
    var panel = $('#tab-' + tabName);
    if (panel) panel.classList.add('active');
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });

  // ── File Export ──
  function exportAsExcel(filename, sheetData) {
    if (typeof XLSX === 'undefined') { toast('Excel 라이브러리를 로드하지 못했습니다'); return; }
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename + '.xlsx');
    toast('Excel 파일이 다운로드되었습니다');
  }

  // HTML 내보내기 전처리: 표 열 너비를 비율로 변환, 에디터 전용 요소 제거
  function prepareExportHTML(htmlContent) {
    var tmp = document.createElement('div');
    tmp.innerHTML = htmlContent;

    // 에디터 전용 요소 제거
    tmp.querySelectorAll('.re-img-handle, .re-img-delete, .re-table-cell-selected').forEach(function (el) {
      el.classList.remove('re-table-cell-selected');
    });
    tmp.querySelectorAll('.re-img-handle, .re-img-delete').forEach(function (el) { el.remove(); });

    // 표 열 너비 px → % 변환
    tmp.querySelectorAll('.re-table').forEach(function (table) {
      var firstRow = table.querySelector('tr');
      if (!firstRow) return;
      var cells = firstRow.children;
      var widths = [];
      var totalPx = 0;
      var hasPxWidth = false;
      for (var i = 0; i < cells.length; i++) {
        var w = parseInt(cells[i].style.width, 10);
        if (w > 0) {
          widths.push(w);
          totalPx += w;
          hasPxWidth = true;
        } else {
          widths.push(0);
        }
      }
      if (hasPxWidth && totalPx > 0) {
        // 첫 행의 너비를 %로 변환, 나머지 행도 동일하게
        table.querySelectorAll('tr').forEach(function (tr) {
          for (var j = 0; j < tr.children.length; j++) {
            if (widths[j] > 0) {
              tr.children[j].style.width = Math.round((widths[j] / totalPx) * 100) + '%';
            } else {
              tr.children[j].style.width = '';
            }
          }
        });
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';
      }
    });

    return tmp.innerHTML;
  }

  function exportAsPDF(title, htmlContent) {
    htmlContent = prepareExportHTML(htmlContent);
    var w = window.open('', '_blank');
    if (!w) { toast('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return; }
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif;padding:40px 60px;color:#333;max-width:800px;margin:0 auto}' +
      'h1{font-size:22px;margin-bottom:8px;color:#1a1d27}' +
      'h2{font-size:16px;color:#3b6fdb;margin-top:24px;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}' +
      'p,div{font-size:14px;line-height:1.8}' +
      '.meta{font-size:12px;color:#888;margin-bottom:20px}' +
      'pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.8}' +
      /* 표 스타일 */
      '.re-table{border-collapse:collapse;margin:12px 0;font-size:13px;max-width:100%}' +
      '.re-table th,.re-table td{border:1px solid #d1d5db;padding:8px 10px;text-align:left;vertical-align:top;line-height:1.5;word-wrap:break-word}' +
      '.re-table th{background:#f3f4f6;font-weight:600}' +
      /* 표 테두리 프리셋 */
      '.re-table.border-none th,.re-table.border-none td{border:none!important}' +
      '.re-table.border-outer{border:1px solid var(--tbc,#d1d5db)}.re-table.border-outer th,.re-table.border-outer td{border:none!important}' +
      '.re-table.border-horiz th,.re-table.border-horiz td{border-left:none!important;border-right:none!important;border-top:1px solid var(--tbc,#d1d5db);border-bottom:1px solid var(--tbc,#d1d5db)}' +
      '.re-table.border-vert th,.re-table.border-vert td{border-top:none!important;border-bottom:none!important;border-left:1px solid var(--tbc,#d1d5db);border-right:1px solid var(--tbc,#d1d5db)}' +
      '.re-table.border-header th,.re-table.border-header td{border:none!important}.re-table.border-header thead tr{border-bottom:2px solid var(--tbc,#d1d5db)}' +
      '.re-table.border-thick th,.re-table.border-thick td{border:2px solid var(--tbc,#d1d5db)!important}' +
      '.re-table.border-dashed th,.re-table.border-dashed td{border:1px dashed var(--tbc,#d1d5db)!important}' +
      '.re-table.custom-border-color th,.re-table.custom-border-color td{border-color:var(--table-border-color)!important}' +
      /* 이미지 */
      '.re-img-wrap{display:inline-block}.re-img{max-width:100%;height:auto}' +
      '.re-img-handle,.re-img-delete{display:none}' +
      /* 링크 */
      'a{color:#3b6fdb;text-decoration:underline}' +
      '@media print{body{padding:20px}a{color:#3b6fdb!important}}' +
      '</style></head><body>' +
      htmlContent +
      '<script>window.onload=function(){window.print()}<\/script>' +
      '</body></html>'
    );
    w.document.close();
  }

  // ══════════════════════════════════════
  // 1. AI 컨텍스트 탭
  // ══════════════════════════════════════
  var CTX_KEY = 'fl_contexts';
  var currentCtxEditId = null;

  function showCtxList() {
    $('#ctx-list-view').style.display = '';
    $('#ctx-form-view').style.display = 'none';
  }

  function showCtxForm() {
    $('#ctx-list-view').style.display = 'none';
    $('#ctx-form-view').style.display = '';
  }

  function clearContextForm() {
    currentCtxEditId = null;
    $('#ctx-project').value = '';
    if (getRich('ctx-background')) getRich('ctx-background').setHTML('');
    if (getRich('ctx-goal')) getRich('ctx-goal').setHTML('');
    if (getRich('ctx-constraints')) getRich('ctx-constraints').setHTML('');
    if (getRich('ctx-reference')) getRich('ctx-reference').setHTML('');
    setDatetimeNow('#ctx-datetime');
  }

  function buildContextPrompt() {
    var project = $('#ctx-project').value.trim();
    var background = getRich('ctx-background') ? getRich('ctx-background').getText().trim() : '';
    var goal = getRich('ctx-goal') ? getRich('ctx-goal').getText().trim() : '';
    var constraints = getRich('ctx-constraints') ? getRich('ctx-constraints').getText().trim() : '';
    var reference = getRich('ctx-reference') ? getRich('ctx-reference').getText().trim() : '';
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
      id: currentCtxEditId || uid(),
      project: $('#ctx-project').value.trim(),
      background: getRich('ctx-background') ? getRich('ctx-background').getHTML() : '',
      goal: getRich('ctx-goal') ? getRich('ctx-goal').getHTML() : '',
      constraints: getRich('ctx-constraints') ? getRich('ctx-constraints').getHTML() : '',
      reference: getRich('ctx-reference') ? getRich('ctx-reference').getHTML() : '',
      createdAt: $('#ctx-datetime').value || new Date().toISOString()
    };
  }

  function loadContextToForm(item) {
    currentCtxEditId = item.id;
    showCtxForm();
    $('#ctx-project').value = item.project || '';
    if (getRich('ctx-background')) getRich('ctx-background').setHTML(item.background || '');
    if (getRich('ctx-goal')) getRich('ctx-goal').setHTML(item.goal || '');
    if (getRich('ctx-constraints')) getRich('ctx-constraints').setHTML(item.constraints || '');
    if (getRich('ctx-reference')) getRich('ctx-reference').setHTML(item.reference || '');
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

  $('#ctx-new').addEventListener('click', function () { clearContextForm(); showCtxForm(); });
  $('#ctx-back').addEventListener('click', function () { showCtxList(); });

  $('#ctx-copy').addEventListener('click', function () {
    var text = buildContextPrompt();
    if (!text) { toast('내용을 입력해주세요'); return; }
    copyToClipboard(text);
  });

  $('#ctx-save').addEventListener('click', function () {
    var data = getContextData();
    if (!data.project && !htmlToText(data.background).trim() && !htmlToText(data.goal).trim()) {
      toast('최소 한 가지 항목을 입력해주세요'); return;
    }
    var items = load(CTX_KEY);
    if (currentCtxEditId) {
      items = items.filter(function (i) { return i.id !== currentCtxEditId; });
    }
    items.unshift(data);
    save(CTX_KEY, items);
    currentCtxEditId = null;
    renderContextList();
    showCtxList();
    toast('컨텍스트가 저장되었습니다');
  });

  $('#ctx-clear').addEventListener('click', function () { clearContextForm(); toast('초기화되었습니다'); });

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
  var currentIdeaEditId = null;
  var currentIdeaSource = null; // { meetingId, meetingTitle }

  function showIdeaList() {
    $('#idea-list-view').style.display = '';
    $('#idea-form-view').style.display = 'none';
  }

  function showIdeaForm() {
    $('#idea-list-view').style.display = 'none';
    $('#idea-form-view').style.display = '';
  }

  function clearIdeaForm() {
    currentIdeaEditId = null;
    $('#idea-title').value = '';
    if (getRich('idea-detail')) getRich('idea-detail').setHTML('');
    $('#idea-tags').value = '';
    setDatetimeNow('#idea-datetime');
    currentIdeaSource = null;
    $('#idea-source-link').style.display = 'none';
  }

  function showIdeaSourceLink(title) {
    $('#idea-source-link').style.display = '';
    $('#idea-source-text').textContent = title + '에서 생성됨';
  }

  function getIdeaData() {
    var data = {
      id: currentIdeaEditId || uid(),
      title: $('#idea-title').value.trim(),
      detail: getRich('idea-detail') ? getRich('idea-detail').getHTML() : '',
      tags: $('#idea-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      createdAt: $('#idea-datetime').value || new Date().toISOString()
    };
    if (currentIdeaSource) {
      data.sourceMeetingId = currentIdeaSource.meetingId;
      data.sourceMeetingTitle = currentIdeaSource.meetingTitle;
    }
    return data;
  }

  function loadIdeaToForm(item) {
    currentIdeaEditId = item.id;
    showIdeaForm();
    $('#idea-title').value = item.title || '';
    if (getRich('idea-detail')) getRich('idea-detail').setHTML(item.detail || '');
    $('#idea-tags').value = (item.tags || []).join(', ');
    if (item.createdAt) {
      var d = new Date(item.createdAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('#idea-datetime').value = d.toISOString().slice(0, 16);
    }
    if (item.sourceMeetingTitle) {
      currentIdeaSource = { meetingId: item.sourceMeetingId, meetingTitle: item.sourceMeetingTitle };
      showIdeaSourceLink(item.sourceMeetingTitle);
    } else {
      currentIdeaSource = null;
      $('#idea-source-link').style.display = 'none';
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
      var sourceTag = item.sourceMeetingTitle
        ? '<span class="tag" style="background:rgba(22,163,74,0.1);color:#16a34a">📋 ' + escapeHtml(item.sourceMeetingTitle) + '</span>'
        : '';
      return '<div class="idea-card" data-id="' + item.id + '">' +
        '<div class="idea-card-header">' +
          '<div class="idea-card-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="idea-card-actions">' +
            '<button class="btn btn-small btn-secondary" data-action="edit" title="편집">✎</button>' +
            '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
          '</div>' +
        '</div>' +
        (item.detail ? '<div class="idea-card-detail">' + escapeHtml(htmlToText(item.detail).slice(0, 200)) + '</div>' : '') +
        '<div class="idea-card-footer">' +
          '<div class="idea-tags">' +
            sourceTag +
            (item.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') +
          '</div>' +
          '<div class="idea-card-date">' + formatDate(item.createdAt) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  $('#idea-new').addEventListener('click', function () { clearIdeaForm(); showIdeaForm(); });
  $('#idea-back').addEventListener('click', function () { showIdeaList(); });

  $('#idea-add').addEventListener('click', function () {
    var data = getIdeaData();
    if (!data.title) { toast('아이디어 제목을 입력해주세요'); return; }
    var items = load(IDEA_KEY);
    if (currentIdeaEditId) {
      items = items.filter(function (i) { return i.id !== currentIdeaEditId; });
    }
    items.unshift(data);
    save(IDEA_KEY, items);
    clearIdeaForm();
    renderIdeaBoard($('#idea-search').value);
    showIdeaList();
    toast('아이디어가 저장되었습니다');
  });

  $('#idea-form-clear').addEventListener('click', function () { clearIdeaForm(); toast('초기화되었습니다'); });

  $('#idea-search').addEventListener('input', function (e) { renderIdeaBoard(e.target.value); });

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
        loadIdeaToForm(item);
        toast('편집 모드');
      }
    }
  });

  // Idea → Proposal
  $('#idea-to-proposal').addEventListener('click', function () {
    var title = $('#idea-title').value.trim();
    var detail = getRich('idea-detail') ? getRich('idea-detail').getText().trim() : '';
    if (!title) { toast('아이디어 제목을 입력해주세요'); return; }

    // First save the idea if not empty
    var ideaData = getIdeaData();
    var ideas = load(IDEA_KEY);
    ideas.unshift(ideaData);
    save(IDEA_KEY, ideas);
    renderIdeaBoard();

    // Switch to proposal tab and pre-fill
    switchTab('proposal');
    clearProposalForm();
    showPropForm();
    $('#prop-title').value = title;
    addProposalField('아이디어 배경', detail);

    currentPropSource = { ideaId: ideaData.id, ideaTitle: title };
    showPropSourceLink(title);

    toast('문서 작성 화면으로 이동했습니다');
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
  var currentMtgEditId = null;

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

  // -- Folder helpers --
  function getMeetingFolders() {
    var meetings = load(MTG_KEY);
    var folders = {};
    meetings.forEach(function (m) {
      if (m.folder) {
        if (!folders[m.folder]) folders[m.folder] = 0;
        folders[m.folder]++;
      }
    });
    return folders;
  }

  function populateFolderSelect(selectId, currentValue) {
    var sel = $(selectId);
    var folders = Object.keys(getMeetingFolders());
    var html = '<option value="">미분류</option>';
    folders.sort().forEach(function (f) {
      html += '<option value="' + escapeHtml(f) + '"' + (f === currentValue ? ' selected' : '') + '>' + escapeHtml(f) + '</option>';
    });
    sel.innerHTML = html;
  }

  function populateFolderFilter() {
    var sel = $('#mtg-folder-filter');
    var folders = getMeetingFolders();
    var html = '<option value="">전체 회의</option>';
    Object.keys(folders).sort().forEach(function (f) {
      html += '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + ' (' + folders[f] + ')</option>';
    });
    sel.innerHTML = html;
  }

  $('#mtg-folder-add-btn').addEventListener('click', function () {
    var input = $('#mtg-folder-new');
    var name = input.value.trim();
    if (!name) return;
    input.value = '';
    // Add to select and choose it
    var sel = $('#mtg-folder');
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    opt.selected = true;
    sel.appendChild(opt);
    toast('폴더 "' + name + '" 추가됨');
  });

  // -- Agenda items --
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

  // -- Data --
  function getMeetingData() {
    return {
      id: currentMtgEditId || uid(),
      type: currentMtgType,
      title: $('#mtg-title').value.trim(),
      date: $('#mtg-date').value,
      attendees: $('#mtg-attendees').value.trim(),
      agenda: mtgAgendaItems.slice(),
      notes: getRich('mtg-notes') ? getRich('mtg-notes').getHTML() : '',
      decisions: getRich('mtg-decisions') ? getRich('mtg-decisions').getHTML() : '',
      actions: getRich('mtg-actions') ? getRich('mtg-actions').getHTML() : '',
      folder: $('#mtg-folder').value || '',
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
    if (item.folder) text += '폴더: ' + item.folder + '\n';
    text += '\n';
    if (item.agenda && item.agenda.length > 0) {
      text += '## 안건\n';
      item.agenda.forEach(function (a, i) { text += (i + 1) + '. ' + a + '\n'; });
      text += '\n';
    }
    var notes = htmlToText(item.notes);
    var decisions = htmlToText(item.decisions);
    var actions = htmlToText(item.actions);
    if (notes) text += '## 회의 내용\n' + notes + '\n\n';
    if (decisions) text += '## 결정 사항\n' + decisions + '\n\n';
    if (actions) text += '## 액션 플랜\n' + actions + '\n';
    return text.trim();
  }

  function loadMeetingToForm(item) {
    currentMtgEditId = item.id;
    showMtgForm(item.type || 'regular');
    populateFolderSelect('#mtg-folder', item.folder || '');
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
    if (getRich('mtg-notes')) getRich('mtg-notes').setHTML(item.notes || '');
    if (getRich('mtg-decisions')) getRich('mtg-decisions').setHTML(item.decisions || '');
    if (getRich('mtg-actions')) getRich('mtg-actions').setHTML(item.actions || '');
  }

  function clearMeetingForm() {
    currentMtgEditId = null;
    $('#mtg-title').value = '';
    $('#mtg-attendees').value = '';
    mtgAgendaItems = [];
    renderAgendaList();
    if (getRich('mtg-notes')) getRich('mtg-notes').setHTML('');
    if (getRich('mtg-decisions')) getRich('mtg-decisions').setHTML('');
    if (getRich('mtg-actions')) getRich('mtg-actions').setHTML('');
    setDatetimeNow('#mtg-date');
    populateFolderSelect('#mtg-folder', '');
  }

  function renderMeetingItem(item) {
    var typeBadge = MTG_TYPE_LABELS[item.type] || '';
    return '<div class="saved-item" data-id="' + item.id + '">' +
      '<div class="saved-item-info" data-action="load">' +
        '<div class="saved-item-title">' + escapeHtml(item.title || '(제목 없음)') +
          (typeBadge ? ' <span class="tag" style="margin-left:6px">' + escapeHtml(typeBadge) + '</span>' : '') +
        '</div>' +
        '<div class="saved-item-date">' + formatDate(item.date || item.createdAt) + '</div>' +
      '</div>' +
      '<div class="saved-item-actions">' +
        '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
      '</div>' +
    '</div>';
  }

  function renderMeetingList(filterFolder) {
    var items = load(MTG_KEY);
    var container = $('#mtg-items');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">저장된 회의 메모가 없습니다</div>';
      populateFolderFilter();
      return;
    }

    if (filterFolder) {
      items = items.filter(function (m) { return (m.folder || '') === filterFolder; });
    }

    var hasFolders = items.some(function (m) { return m.folder; });

    if (!hasFolders || filterFolder) {
      container.innerHTML = items.map(renderMeetingItem).join('');
    } else {
      // Group by folder
      var groups = {};
      var order = [];
      items.forEach(function (m) {
        var f = m.folder || '미분류';
        if (!groups[f]) { groups[f] = []; order.push(f); }
        groups[f].push(m);
      });
      // Sort: named folders first, 미분류 last
      order.sort(function (a, b) {
        if (a === '미분류') return 1;
        if (b === '미분류') return -1;
        return a.localeCompare(b, 'ko');
      });

      var html = '';
      order.forEach(function (folder) {
        html += '<div class="folder-group">' +
          '<div class="folder-header">' +
            '<span class="folder-name">📁 ' + escapeHtml(folder) + '</span>' +
            '<span class="folder-count">' + groups[folder].length + '</span>' +
          '</div>' +
          '<div class="folder-items">' +
            groups[folder].map(renderMeetingItem).join('') +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
    }

    populateFolderFilter();
  }

  // -- Event listeners --
  $$('.mtg-type-card').forEach(function (card) {
    card.addEventListener('click', function () {
      clearMeetingForm();
      showMtgForm(card.dataset.mtgType);
    });
  });

  $('#mtg-back').addEventListener('click', function () { showMtgTypeSelect(); });

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
    if (!data.title && !htmlToText(data.notes).trim()) { toast('회의명 또는 내용을 입력해주세요'); return; }
    var items = load(MTG_KEY);
    // If editing existing, replace it
    if (currentMtgEditId) {
      items = items.filter(function (i) { return i.id !== currentMtgEditId; });
    }
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

  $('#mtg-clear').addEventListener('click', function () { clearMeetingForm(); toast('초기화되었습니다'); });

  $('#mtg-folder-filter').addEventListener('change', function () {
    renderMeetingList(this.value);
  });

  $('#mtg-items').addEventListener('click', function (e) {
    var item = e.target.closest('.saved-item');
    if (!item) return;
    var id = item.dataset.id;
    var items = load(MTG_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      save(MTG_KEY, items.filter(function (i) { return i.id !== id; }));
      renderMeetingList($('#mtg-folder-filter').value);
      toast('삭제되었습니다');
    } else {
      var found = items.find(function (i) { return i.id === id; });
      if (found) { loadMeetingToForm(found); toast('불러왔습니다'); }
    }
  });

  // Meeting → Idea
  $('#mtg-to-idea').addEventListener('click', function () {
    var title = $('#mtg-title').value.trim();
    var notes = getRich('mtg-notes') ? getRich('mtg-notes').getText().trim() : '';
    var decisions = getRich('mtg-decisions') ? getRich('mtg-decisions').getText().trim() : '';
    if (!title && !notes) { toast('회의 내용을 입력해주세요'); return; }

    // Save meeting first if needed
    var meetingData = getMeetingData();
    if (!currentMtgEditId) {
      var mtgs = load(MTG_KEY);
      mtgs.unshift(meetingData);
      save(MTG_KEY, mtgs);
      renderMeetingList();
    }

    // Switch to idea tab and pre-fill
    switchTab('ideas');
    clearIdeaForm();
    showIdeaForm();
    $('#idea-title').value = title + ' - 회의 아이디어';
    var detail = '';
    if (notes) detail += '<b>회의 내용</b><br>' + escapeHtml(notes) + '<br><br>';
    if (decisions) detail += '<b>결정 사항</b><br>' + escapeHtml(decisions);
    if (getRich('idea-detail')) getRich('idea-detail').setHTML(detail);
    $('#idea-tags').value = MTG_TYPE_LABELS[currentMtgType] ? currentMtgType : '';

    currentIdeaSource = { meetingId: meetingData.id, meetingTitle: title };
    showIdeaSourceLink(title);

    toast('아이디어 작성 화면으로 이동했습니다');
  });

  // Meeting → Excel
  $('#mtg-export-excel').addEventListener('click', function () {
    var data = getMeetingData();
    if (!data.title && !data.notes) { toast('내용을 입력해주세요'); return; }
    var sheetData = [
      ['회의 메모'],
      [],
      ['회의명', data.title || ''],
      ['유형', MTG_TYPE_LABELS[data.type] || ''],
      ['일시', data.date ? formatDate(data.date) : ''],
      ['참석자', data.attendees || ''],
      ['폴더', data.folder || '미분류'],
      []
    ];
    if (data.agenda && data.agenda.length) {
      sheetData.push(['안건']);
      data.agenda.forEach(function (a, i) { sheetData.push([(i + 1) + '. ' + a]); });
      sheetData.push([]);
    }
    sheetData.push(['회의 내용']);
    sheetData.push([htmlToText(data.notes) || '']);
    sheetData.push([]);
    sheetData.push(['결정 사항']);
    sheetData.push([htmlToText(data.decisions) || '']);
    sheetData.push([]);
    sheetData.push(['액션 플랜']);
    sheetData.push([htmlToText(data.actions) || '']);
    exportAsExcel(data.title || '회의메모', sheetData);
  });

  // Meeting → PDF
  $('#mtg-export-pdf').addEventListener('click', function () {
    var data = getMeetingData();
    if (!data.title && !data.notes) { toast('내용을 입력해주세요'); return; }
    var html = '<h1>' + escapeHtml(data.title || '(제목 없음)') + '</h1>';
    html += '<div class="meta">';
    if (data.type) html += escapeHtml(MTG_TYPE_LABELS[data.type] || '') + ' | ';
    if (data.date) html += escapeHtml(formatDate(data.date)) + ' | ';
    if (data.attendees) html += '참석: ' + escapeHtml(data.attendees);
    html += '</div>';
    if (data.agenda && data.agenda.length) {
      html += '<h2>안건</h2><div>';
      data.agenda.forEach(function (a, i) { html += (i + 1) + '. ' + escapeHtml(a) + '<br>'; });
      html += '</div>';
    }
    if (data.notes) html += '<h2>회의 내용</h2><div>' + data.notes + '</div>';
    if (data.decisions) html += '<h2>결정 사항</h2><div>' + data.decisions + '</div>';
    if (data.actions) html += '<h2>액션 플랜</h2><div>' + data.actions + '</div>';
    exportAsPDF(data.title || '회의메모', html);
  });

  // ── AI 자동 분류 ──
  var DEFAULT_AI_PROMPT =
    '아래 회의 목록을 분석하여 주제별 폴더로 분류해주세요.\n\n' +
    '규칙:\n' +
    '- 2~5개의 의미 있는 폴더명을 만들어주세요\n' +
    '- 폴더명은 간결하게 (2~4글자)\n' +
    '- JSON 배열로만 응답: [{"index": 0, "folder": "폴더명"}, ...]\n' +
    '- 다른 설명 없이 JSON만 출력\n\n' +
    '회의 목록:\n{{meetings}}';

  $('#mtg-ai-classify').addEventListener('click', function () {
    var settings = loadSettings();
    if (!settings.apiKey) {
      toast('설정에서 API 키를 입력해주세요');
      $('#settings-overlay').classList.add('active');
      return;
    }

    var meetings = load(MTG_KEY);
    if (meetings.length === 0) { toast('분류할 회의가 없습니다'); return; }

    var btn = $('#mtg-ai-classify');
    btn.disabled = true;
    btn.textContent = '분류 중...';

    var meetingList = meetings.map(function (m, i) {
      return JSON.stringify({
        index: i,
        title: m.title || '',
        type: MTG_TYPE_LABELS[m.type] || '',
        notes: (m.notes || '').slice(0, 200)
      });
    }).join('\n');

    // 사용자 커스텀 프롬프트 또는 기본 프롬프트 사용
    var promptTemplate = settings.aiPrompt || DEFAULT_AI_PROMPT;
    var finalPrompt = promptTemplate.replace('{{meetings}}', meetingList);

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: finalPrompt
        }]
      })
    })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error && d.error.message || 'API 오류'); });
      return res.json();
    })
    .then(function (data) {
      var text = data.content[0].text;
      var jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 응답 파싱 실패');

      var classifications = JSON.parse(jsonMatch[0]);
      classifications.forEach(function (c) {
        if (typeof c.index === 'number' && c.folder && meetings[c.index]) {
          meetings[c.index].folder = c.folder;
        }
      });

      save(MTG_KEY, meetings);
      renderMeetingList();
      toast('AI 분류가 완료되었습니다!');
    })
    .catch(function (err) {
      toast('분류 실패: ' + err.message);
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = '🤖 AI 자동 분류';
    });
  });

  // ══════════════════════════════════════
  // 4. 브리핑 양식 탭 (동적 항목)
  // ══════════════════════════════════════
  var PROP_KEY = 'fl_proposals';
  var currentPropEditId = null;
  var currentPropSource = null; // { ideaId, ideaTitle }

  function showPropList() {
    $('#prop-list-view').style.display = '';
    $('#prop-form-view').style.display = 'none';
  }

  function showPropForm() {
    $('#prop-list-view').style.display = 'none';
    $('#prop-form-view').style.display = '';
  }

  function showPropSourceLink(title) {
    $('#prop-source-link').style.display = '';
    $('#prop-source-text').textContent = title + '에서 생성됨';
  }

  function addProposalField(label, value) {
    var container = $('#prop-fields');
    var fieldId = 'pf-' + uid();
    var div = document.createElement('div');
    div.className = 'prop-field-item';
    div.dataset.fieldId = fieldId;
    div.draggable = true;
    div.innerHTML =
      '<div class="prop-field-header">' +
        '<span class="prop-field-drag" title="드래그하여 순서 변경">⠿</span>' +
        '<input type="text" class="prop-field-label" placeholder="항목명 (예: 배경, 대상, 기대효과...)" value="' + escapeHtml(label || '') + '">' +
        '<button class="btn btn-small btn-danger prop-field-remove" title="삭제">✕</button>' +
      '</div>' +
      '<textarea class="prop-field-value" rows="3" placeholder="내용을 입력하세요" data-rich></textarea>';
    container.appendChild(div);
    // 리치 에디터 초기화
    var ta = div.querySelector('.prop-field-value');
    var re = createRichEditor(ta);
    if (value) re.setHTML(value);
  }

  // -- Drag & Drop for proposal fields --
  (function () {
    var dragEl = null;
    var container = $('#prop-fields');

    container.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.prop-field-item');
      if (!item) return;
      // 표 셀 내부에서 시작된 드래그는 무시 (셀 다중 선택과 충돌 방지)
      if (e.target.closest('.re-table')) { e.preventDefault(); return; }
      dragEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    container.addEventListener('dragend', function (e) {
      if (dragEl) {
        dragEl.classList.remove('dragging');
        dragEl = null;
      }
      $$('.prop-field-item.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
    });

    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var target = e.target.closest('.prop-field-item');
      if (!target || target === dragEl) return;
      $$('.prop-field-item.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
      target.classList.add('drag-over');
    });

    container.addEventListener('dragleave', function (e) {
      var target = e.target.closest('.prop-field-item');
      if (target) target.classList.remove('drag-over');
    });

    container.addEventListener('drop', function (e) {
      e.preventDefault();
      var target = e.target.closest('.prop-field-item');
      if (!target || !dragEl || target === dragEl) return;
      target.classList.remove('drag-over');
      // Insert before or after based on position
      var rect = target.getBoundingClientRect();
      var midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        container.insertBefore(dragEl, target);
      } else {
        container.insertBefore(dragEl, target.nextSibling);
      }
    });
  })();

  function getProposalData() {
    var fields = [];
    $$('.prop-field-item').forEach(function (el) {
      var label = el.querySelector('.prop-field-label').value.trim();
      var editable = el.querySelector('.rich-editable');
      var value = editable ? editable.innerHTML : '';
      if (value === '<br>') value = '';
      if (label || value) {
        fields.push({ label: label, value: value });
      }
    });
    var data = {
      id: currentPropEditId || uid(),
      title: $('#prop-title').value.trim(),
      fields: fields,
      createdAt: $('#prop-datetime').value || new Date().toISOString()
    };
    if (currentPropSource) {
      data.sourceIdeaId = currentPropSource.ideaId;
      data.sourceIdeaTitle = currentPropSource.ideaTitle;
    }
    return data;
  }

  function buildProposalText(item) {
    var text = '';
    if (item.title) text += '# ' + item.title + '\n\n';
    if (item.fields) {
      item.fields.forEach(function (f) {
        var val = htmlToText(f.value);
        if (f.label && val) text += '## ' + f.label + '\n' + val + '\n\n';
        else if (val) text += val + '\n\n';
        else if (f.label) text += '## ' + f.label + '\n\n';
      });
    }
    return text.trim();
  }

  function loadProposalToForm(item) {
    currentPropEditId = item.id;
    showPropForm();
    $('#prop-title').value = item.title || '';
    $('#prop-fields').innerHTML = '';
    if (item.fields && item.fields.length > 0) {
      item.fields.forEach(function (f) { addProposalField(f.label, f.value); });
    }
    if (item.createdAt) {
      var d = new Date(item.createdAt);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      $('#prop-datetime').value = d.toISOString().slice(0, 16);
    }
    if (item.sourceIdeaTitle) {
      currentPropSource = { ideaId: item.sourceIdeaId, ideaTitle: item.sourceIdeaTitle };
      showPropSourceLink(item.sourceIdeaTitle);
    } else {
      currentPropSource = null;
      $('#prop-source-link').style.display = 'none';
    }
  }

  function clearProposalForm() {
    currentPropEditId = null;
    $('#prop-title').value = '';
    $('#prop-fields').innerHTML = '';
    setDatetimeNow('#prop-datetime');
    currentPropSource = null;
    $('#prop-source-link').style.display = 'none';
  }

  function renderProposalList() {
    var items = load(PROP_KEY);
    var ul = $('#prop-items');
    if (items.length === 0) {
      ul.innerHTML = '<li class="empty-state">저장된 문서가 없습니다</li>';
      return;
    }
    ul.innerHTML = items.map(function (item) {
      var sourceTag = item.sourceIdeaTitle
        ? ' <span class="tag" style="background:rgba(22,163,74,0.1);color:#16a34a;margin-left:6px">💡 ' + escapeHtml(item.sourceIdeaTitle) + '</span>'
        : '';
      return '<li class="saved-item" data-id="' + item.id + '">' +
        '<div class="saved-item-info" data-action="load">' +
          '<div class="saved-item-title">' + escapeHtml(item.title || '(제목 없음)') + sourceTag + '</div>' +
          '<div class="saved-item-date">' + formatDate(item.createdAt) + '</div>' +
        '</div>' +
        '<div class="saved-item-actions">' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  $('#prop-new').addEventListener('click', function () { clearProposalForm(); showPropForm(); });
  $('#prop-back').addEventListener('click', function () { showPropList(); });
  $('#prop-add-field').addEventListener('click', function () { addProposalField('', ''); });

  $('#prop-fields').addEventListener('click', function (e) {
    if (e.target.closest('.prop-field-remove')) { e.target.closest('.prop-field-item').remove(); }
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
    if (currentPropEditId) {
      items = items.filter(function (i) { return i.id !== currentPropEditId; });
    }
    items.unshift(data);
    save(PROP_KEY, items);
    currentPropEditId = null;
    renderProposalList();
    showPropList();
    toast('문서가 저장되었습니다');
  });

  $('#prop-clear').addEventListener('click', function () { clearProposalForm(); toast('초기화되었습니다'); });

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

  // Proposal → Excel
  $('#prop-export-excel').addEventListener('click', function () {
    var data = getProposalData();
    if (!data.title && data.fields.length === 0) { toast('내용을 입력해주세요'); return; }
    var sheetData = [['문서'], [], ['제목', data.title || '']];
    if (data.fields) {
      data.fields.forEach(function (f) {
        sheetData.push([]);
        sheetData.push([f.label || '']);
        sheetData.push([htmlToText(f.value) || '']);
      });
    }
    exportAsExcel(data.title || '문서', sheetData);
  });

  // Proposal → PDF
  $('#prop-export-pdf').addEventListener('click', function () {
    var data = getProposalData();
    if (!data.title && data.fields.length === 0) { toast('내용을 입력해주세요'); return; }
    var html = '<h1>' + escapeHtml(data.title || '(제목 없음)') + '</h1>';
    html += '<div class="meta">' + escapeHtml(formatDate(data.createdAt)) + '</div>';
    if (data.fields) {
      data.fields.forEach(function (f) {
        if (f.label) html += '<h2>' + escapeHtml(f.label) + '</h2>';
        if (f.value) html += '<div>' + f.value + '</div>';
      });
    }
    exportAsPDF(data.title || '문서', html);
  });

  // ══════════════════════════════════════
  // 5. 프레젠테이션 모드
  // ══════════════════════════════════════
  var presSlides = [];
  var presIndex = 0;

  function buildPresSlides(data) {
    var slides = [];
    slides.push({ type: 'title', title: data.title || '(제목 없음)', subtitle: formatDate(new Date().toISOString()) });
    if (data.fields) {
      data.fields.forEach(function (f) {
        if (f.label || f.value) { slides.push({ type: 'content', heading: f.label || '', body: f.value || '' }); }
      });
    }
    return slides;
  }

  function renderPresSlide() {
    var slide = presSlides[presIndex];
    var stage = $('#pres-stage');
    if (slide.type === 'title') {
      stage.innerHTML = '<div class="pres-slide pres-slide-title"><h1>' + escapeHtml(slide.title) + '</h1><div class="pres-subtitle">' + escapeHtml(slide.subtitle) + '</div></div>';
    } else {
      var exportedBody = prepareExportHTML(slide.body);
      stage.innerHTML = '<div class="pres-slide pres-slide-content">' + (slide.heading ? '<h2>' + escapeHtml(slide.heading) + '</h2>' : '') + '<div class="pres-body">' + exportedBody + '</div></div>';
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
    if (!data.title && data.fields.length === 0) { toast('문서 내용을 입력해주세요'); return; }
    openPresentation(data);
  });

  $('#pres-close').addEventListener('click', closePresentation);
  $('#pres-prev').addEventListener('click', function () { if (presIndex > 0) { presIndex--; renderPresSlide(); } });
  $('#pres-next').addEventListener('click', function () { if (presIndex < presSlides.length - 1) { presIndex++; renderPresSlide(); } });

  document.addEventListener('keydown', function (e) {
    if (!$('#pres-overlay').classList.contains('active')) return;
    if (e.key === 'Escape') closePresentation();
    else if (e.key === 'ArrowLeft') { if (presIndex > 0) { presIndex--; renderPresSlide(); } }
    else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      if (presIndex < presSlides.length - 1) { presIndex++; renderPresSlide(); }
    }
  });

  // ══════════════════════════════════════
  // 6. 설정 UI
  // ══════════════════════════════════════
  $('#open-settings').addEventListener('click', function () {
    var settings = loadSettings();
    $('#setting-api-key').value = settings.apiKey || '';
    $('#setting-ai-prompt').value = settings.aiPrompt || DEFAULT_AI_PROMPT;
    $('#api-key-status').textContent = settings.apiKey ? '키가 설정되어 있습니다' : '';
    $('#settings-overlay').classList.add('active');
  });

  $('#settings-close').addEventListener('click', function () {
    $('#settings-overlay').classList.remove('active');
  });

  $('#settings-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
  });

  $('#settings-save').addEventListener('click', function () {
    var key = $('#setting-api-key').value.trim();
    var prompt = $('#setting-ai-prompt').value.trim();
    var settings = loadSettings();
    settings.apiKey = key;
    settings.aiPrompt = prompt || '';
    saveSettingsData(settings);
    $('#api-key-status').textContent = key ? '키가 저장되었습니다' : '';
    toast('설정이 저장되었습니다');
  });

  $('#settings-reset-prompt').addEventListener('click', function () {
    $('#setting-ai-prompt').value = DEFAULT_AI_PROMPT;
    toast('기본 프롬프트로 되돌렸습니다');
  });

  $('#settings-clear-key').addEventListener('click', function () {
    var settings = loadSettings();
    settings.apiKey = '';
    saveSettingsData(settings);
    $('#setting-api-key').value = '';
    $('#api-key-status').textContent = '';
    toast('API 키가 삭제되었습니다');
  });

  // ══════════════════════════════════════
  // 7. 리치 에디터 (볼드, 밑줄, 리스트, 이미지, 그리기)
  // ══════════════════════════════════════
  var richEditors = {};
  var activeRichEditor = null; // 그리기 삽입 대상

  // ── Undo/Redo 시스템 ──
  var undoMap = {}; // id → { stack: [], pointer: -1 }
  var UNDO_LIMIT = 80;

  function getUndoState(editorEl) {
    var id = editorEl.dataset.undoId;
    if (!id) { id = 're-undo-' + uid(); editorEl.dataset.undoId = id; }
    if (!undoMap[id]) undoMap[id] = { stack: [], pointer: -1 };
    return undoMap[id];
  }

  function saveSnapshot(editorEl) {
    var state = getUndoState(editorEl);
    var html = editorEl.innerHTML;
    // 현재 포인터 이후 스택 잘라냄 (redo 분기 제거)
    if (state.pointer < state.stack.length - 1) {
      state.stack = state.stack.slice(0, state.pointer + 1);
    }
    // 중복 저장 방지
    if (state.stack.length > 0 && state.stack[state.pointer] === html) return;
    state.stack.push(html);
    if (state.stack.length > UNDO_LIMIT) state.stack.shift();
    state.pointer = state.stack.length - 1;
  }

  function editorUndo(editorEl) {
    var state = getUndoState(editorEl);
    if (state.pointer <= 0) return false;
    state.pointer--;
    editorEl.innerHTML = state.stack[state.pointer];
    wrapBareImages(editorEl);
    return true;
  }

  function editorRedo(editorEl) {
    var state = getUndoState(editorEl);
    if (state.pointer >= state.stack.length - 1) return false;
    state.pointer++;
    editorEl.innerHTML = state.stack[state.pointer];
    wrapBareImages(editorEl);
    return true;
  }

  // 외부에서 undo 후 스냅샷 저장 + 버튼 갱신 트리거
  function saveSnapshotAndNotify(editorEl) {
    saveSnapshot(editorEl);
    editorEl.dispatchEvent(new Event('undo-update'));
  }

  function createRichEditor(textarea) {
    var id = textarea.id || ('re-' + uid());
    textarea.style.display = 'none';

    var wrapper = document.createElement('div');
    wrapper.className = 'rich-editor';

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'rich-toolbar';
    toolbar.innerHTML =
      '<button type="button" class="rich-btn rich-undo-btn" data-action="undo" title="되돌리기 (Ctrl+Z)" disabled>↩</button>' +
      '<button type="button" class="rich-btn rich-redo-btn" data-action="redo" title="다시실행 (Ctrl+Shift+Z)" disabled>↪</button>' +
      '<span class="rich-sep"></span>' +
      '<button type="button" class="rich-btn" data-cmd="bold" title="볼드 (Ctrl+B)"><b>B</b></button>' +
      '<button type="button" class="rich-btn" data-cmd="underline" title="밑줄 (Ctrl+U)"><u>U</u></button>' +
      '<span class="rich-sep"></span>' +
      '<button type="button" class="rich-btn" data-cmd="insertOrderedList" title="번호 목록">1.</button>' +
      '<button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="점 목록">-</button>' +
      '<button type="button" class="rich-btn" data-cmd="indent" title="들여쓰기 (Tab)">→</button>' +
      '<button type="button" class="rich-btn" data-cmd="outdent" title="내어쓰기 (Shift+Tab)">←</button>' +
      '<span class="rich-sep"></span>' +
      '<button type="button" class="rich-btn" data-action="image" title="이미지 첨부">🖼</button>' +
      '<button type="button" class="rich-btn" data-action="draw" title="그리기">✏</button>' +
      '<button type="button" class="rich-btn" data-action="link" title="링크 삽입 (Ctrl+K)">🔗</button>' +
      '<span class="rich-sep"></span>' +
      '<button type="button" class="rich-btn" data-action="table" title="표 삽입">▦</button>' +
      '<span class="rich-sep table-border-sep" style="display:none"></span>' +
      '<button type="button" class="rich-btn table-border-btn" data-action="table-border" title="표 테두리" style="display:none;width:auto;padding:0 6px;font-size:0.75rem;">┃테두리</button>';

    // Editable area
    var editor = document.createElement('div');
    editor.className = 'rich-editable';
    editor.contentEditable = 'true';
    editor.style.minHeight = (parseInt(textarea.rows, 10) || 4) * 24 + 'px';
    editor.setAttribute('data-placeholder', textarea.placeholder || '');

    wrapper.appendChild(toolbar);
    wrapper.appendChild(editor);
    textarea.parentNode.insertBefore(wrapper, textarea);

    // Toolbar click
    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('.rich-btn');
      if (!btn) return;
      e.preventDefault();
      var cmd = btn.dataset.cmd;
      var action = btn.dataset.action;
      if (cmd) {
        // 표 셀 2개 이상 다중 선택 시에만 일괄 적용 (1개면 브라우저 텍스트 선택 존중)
        if (tableSel.cells.length > 1 && tableSel.table && editor.contains(tableSel.table)) {
          applyFormatToSelectedCells(cmd, editor);
        } else {
          editor.focus();
          document.execCommand(cmd, false, null);
        }
      } else if (action === 'image') {
        // 파일 선택으로 이미지 추가
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', function () {
          if (input.files && input.files[0]) {
            insertImageFile(editor, input.files[0]);
          }
        });
        input.click();
      } else if (action === 'draw') {
        activeRichEditor = editor;
        openDrawCanvas();
      } else if (action === 'link') {
        openLinkDialog(editor);
      } else if (action === 'table') {
        openTablePicker(btn, editor);
      } else if (action === 'table-border') {
        openTableBorderPicker(btn, editor);
      } else if (action === 'undo') {
        editorUndo(editor);
        updateUndoButtons();
      } else if (action === 'redo') {
        editorRedo(editor);
        updateUndoButtons();
      }
    });

    // Undo/Redo 버튼 상태 업데이트
    var undoBtn = toolbar.querySelector('.rich-undo-btn');
    var redoBtn = toolbar.querySelector('.rich-redo-btn');
    function updateUndoButtons() {
      var state = getUndoState(editor);
      undoBtn.disabled = state.pointer <= 0;
      redoBtn.disabled = state.pointer >= state.stack.length - 1;
    }

    // 초기 스냅샷
    saveSnapshot(editor);

    // 외부 DOM 변경 후 버튼 갱신 이벤트
    editor.addEventListener('undo-update', updateUndoButtons);

    // 입력 변경 시 디바운스 스냅샷
    var inputTimer = null;
    editor.addEventListener('input', function () {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(function () {
        saveSnapshot(editor);
        updateUndoButtons();
      }, 500);
    });

    // Ctrl+Z / Ctrl+Shift+Z / 서식 단축키 처리
    editor.addEventListener('keydown', function (e) {
      var isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      // Undo / Redo
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        editorUndo(editor);
        updateUndoButtons();
        return;
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        editorRedo(editor);
        updateUndoButtons();
        return;
      }

      // Ctrl+K → 링크 삽입
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        openLinkDialog(editor);
        return;
      }

      // 셀 2개 이상 다중 선택 시에만 서식 단축키 가로채기
      if (tableSel.cells.length > 1 && tableSel.table && editor.contains(tableSel.table)) {
        var formatMap = { b: 'bold', u: 'underline', i: 'italic' };
        var fmt = formatMap[e.key.toLowerCase()];
        if (fmt) {
          e.preventDefault();
          applyFormatToSelectedCells(fmt, editor);
        }
      }
    });

    // 표 포커스 시 테두리 버튼 표시
    var borderBtn = toolbar.querySelector('.table-border-btn');
    var borderSep = toolbar.querySelector('.table-border-sep');
    editor.addEventListener('focus', showBorderBtnIfTable, true);
    editor.addEventListener('click', showBorderBtnIfTable);
    editor.addEventListener('blur', function () {
      setTimeout(function () {
        if (!editor.contains(document.activeElement) &&
            !document.querySelector('.table-border-picker')) {
          borderBtn.style.display = 'none';
          borderSep.style.display = 'none';
        }
      }, 200);
    }, true);

    function showBorderBtnIfTable() {
      var sel = window.getSelection();
      var node = sel && sel.anchorNode;
      var inTable = node && (node.nodeType === 1 ? node : node.parentElement);
      if (inTable && inTable.closest && inTable.closest('.re-table')) {
        borderBtn.style.display = '';
        borderSep.style.display = '';
      } else if (!document.querySelector('.table-border-picker')) {
        borderBtn.style.display = 'none';
        borderSep.style.display = 'none';
      }
    }

    // 표 컨텍스트 메뉴 (우클릭)
    editor.addEventListener('contextmenu', function (e) {
      var td = e.target.closest('td, th');
      if (td && td.closest('.re-table')) {
        e.preventDefault();
        showTableContextMenu(td, editor, e);
      }
    });

    // 표 셀 다중 선택 (좌클릭 드래그)
    initTableCellSelection(editor);

    // 하이퍼링크 핸들러
    initLinkHandlers(editor);

    // Paste images
    editor.addEventListener('paste', function (e) {
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          var file = items[i].getAsFile();
          insertImageFile(editor, file);
          return;
        }
      }
    });

    // Tab key for indent/outdent
    editor.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          document.execCommand('outdent', false, null);
        } else {
          document.execCommand('indent', false, null);
        }
      }
    });

    var re = {
      editor: editor,
      getHTML: function () { return editor.innerHTML === '<br>' ? '' : editor.innerHTML; },
      setHTML: function (html) {
        editor.innerHTML = html || '';
        wrapBareImages(editor);
        // 초기 콘텐츠를 undo 스택 시작점으로 저장
        var state = getUndoState(editor);
        state.stack = [editor.innerHTML];
        state.pointer = 0;
      },
      getText: function () { return editor.innerText || ''; }
    };
    richEditors[id] = re;
    return re;
  }

  // ── 하이퍼링크 삽입/편집 ──
  var activeLinkDialog = null;
  var activeLinkTooltip = null;

  function getSavedRange() {
    var sel = window.getSelection();
    if (sel.rangeCount > 0) return sel.getRangeAt(0).cloneRange();
    return null;
  }

  function restoreRange(range) {
    if (!range) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function getParentAnchor(editor) {
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    if (!node) return null;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    var a = el.closest('a');
    return (a && editor.contains(a)) ? a : null;
  }

  function openLinkDialog(editor, existingAnchor) {
    closeLinkDialog();
    var savedRange = getSavedRange();
    var sel = window.getSelection();
    var selectedText = sel ? sel.toString().trim() : '';

    var overlay = document.createElement('div');
    overlay.className = 're-link-overlay';

    var dialog = document.createElement('div');
    dialog.className = 're-link-dialog';

    var isEdit = !!existingAnchor;
    var currentUrl = isEdit ? existingAnchor.href : '';
    var currentText = isEdit ? existingAnchor.textContent : selectedText;

    dialog.innerHTML =
      '<div class="re-link-title">' + (isEdit ? '링크 수정' : '링크 삽입') + '</div>' +
      '<label class="re-link-label">표시 텍스트</label>' +
      '<input type="text" class="re-link-input" id="re-link-text" placeholder="링크에 표시될 텍스트" value="' + escapeHtml(currentText) + '">' +
      '<label class="re-link-label">URL</label>' +
      '<input type="text" class="re-link-input" id="re-link-url" placeholder="https://example.com" value="' + escapeHtml(currentUrl) + '">' +
      '<div class="re-link-actions">' +
        (isEdit ? '<button type="button" class="btn btn-small btn-danger re-link-remove">링크 제거</button>' : '') +
        '<button type="button" class="btn btn-small re-link-cancel">취소</button>' +
        '<button type="button" class="btn btn-small btn-primary re-link-save">' + (isEdit ? '수정' : '삽입') + '</button>' +
      '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    activeLinkDialog = overlay;

    var urlInput = dialog.querySelector('#re-link-url');
    var textInput = dialog.querySelector('#re-link-text');
    setTimeout(function () { urlInput.focus(); }, 50);

    // URL 입력 시 텍스트가 비어있으면 자동 채움
    urlInput.addEventListener('input', function () {
      if (!textInput.value.trim() || textInput.value === textInput.dataset.autoFilled) {
        textInput.value = urlInput.value;
        textInput.dataset.autoFilled = urlInput.value;
      }
    });

    function doSave() {
      var url = urlInput.value.trim();
      var text = textInput.value.trim() || url;
      if (!url) { urlInput.focus(); return; }

      // 프로토콜 없으면 추가
      if (url && !/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
        url = 'https://' + url;
      }

      saveSnapshot(editor);

      if (isEdit && existingAnchor) {
        existingAnchor.href = url;
        existingAnchor.textContent = text;
      } else {
        restoreRange(savedRange);
        var a = document.createElement('a');
        a.href = url;
        a.textContent = text;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        // 선택 영역이 있으면 교체, 없으면 삽입
        var newSel = window.getSelection();
        if (newSel.rangeCount > 0) {
          var range = newSel.getRangeAt(0);
          if (editor.contains(range.startContainer)) {
            range.deleteContents();
            range.insertNode(a);
            range.setStartAfter(a);
            range.collapse(true);
            newSel.removeAllRanges();
            newSel.addRange(range);
          } else {
            editor.focus();
            editor.appendChild(a);
          }
        } else {
          editor.focus();
          editor.appendChild(a);
        }
      }

      saveSnapshotAndNotify(editor);
      closeLinkDialog();
    }

    dialog.querySelector('.re-link-save').addEventListener('click', doSave);
    dialog.querySelector('.re-link-cancel').addEventListener('click', closeLinkDialog);

    if (isEdit) {
      dialog.querySelector('.re-link-remove').addEventListener('click', function () {
        saveSnapshot(editor);
        var textNode = document.createTextNode(existingAnchor.textContent);
        existingAnchor.parentNode.replaceChild(textNode, existingAnchor);
        saveSnapshotAndNotify(editor);
        closeLinkDialog();
      });
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLinkDialog();
    });

    // Enter로 저장
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSave(); }
      if (e.key === 'Escape') { closeLinkDialog(); }
    });
  }

  function closeLinkDialog() {
    if (activeLinkDialog) {
      activeLinkDialog.remove();
      activeLinkDialog = null;
    }
  }

  // 링크 호버 툴팁
  function showLinkTooltip(anchor, editor) {
    hideLinkTooltip();
    var tip = document.createElement('div');
    tip.className = 're-link-tooltip';
    var url = anchor.href || '';
    tip.innerHTML =
      '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" class="re-link-tip-url">' + escapeHtml(url.length > 50 ? url.slice(0, 50) + '…' : url) + '</a>' +
      '<button type="button" class="re-link-tip-btn" data-tip-act="edit" title="수정">✎</button>' +
      '<button type="button" class="re-link-tip-btn" data-tip-act="remove" title="링크 제거">✕</button>';

    tip.addEventListener('click', function (e) {
      var act = e.target.closest('[data-tip-act]');
      if (!act) return;
      if (act.dataset.tipAct === 'edit') {
        openLinkDialog(editor, anchor);
      } else if (act.dataset.tipAct === 'remove') {
        saveSnapshot(editor);
        var textNode = document.createTextNode(anchor.textContent);
        anchor.parentNode.replaceChild(textNode, anchor);
        saveSnapshotAndNotify(editor);
      }
      hideLinkTooltip();
    });

    var rect = anchor.getBoundingClientRect();
    tip.style.position = 'fixed';
    tip.style.top = (rect.bottom + 4) + 'px';
    tip.style.left = rect.left + 'px';
    tip.style.zIndex = '10000';
    document.body.appendChild(tip);
    activeLinkTooltip = tip;

    requestAnimationFrame(function () {
      var tr = tip.getBoundingClientRect();
      if (tr.right > window.innerWidth) tip.style.left = (window.innerWidth - tr.width - 8) + 'px';
      if (tr.bottom > window.innerHeight) tip.style.top = (rect.top - tr.height - 4) + 'px';
    });
  }

  function hideLinkTooltip() {
    if (activeLinkTooltip) {
      activeLinkTooltip.remove();
      activeLinkTooltip = null;
    }
  }

  // 에디터 내 링크 클릭 처리 (각 에디터 초기화 시 바인딩)
  function initLinkHandlers(editor) {
    editor.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && editor.contains(a)) {
        e.preventDefault();
        showLinkTooltip(a, editor);
      } else if (!e.target.closest('.re-link-tooltip')) {
        hideLinkTooltip();
      }
    });

    // URL 붙여넣기 시 자동 링크화
    editor.addEventListener('paste', function (e) {
      // 이미지 붙여넣기가 우선
      var items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) return; // 이미지 핸들러에 위임
      }

      var text = (e.clipboardData || e.originalEvent.clipboardData).getData('text/plain');
      if (text && /^https?:\/\/\S+$/i.test(text.trim())) {
        var sel = window.getSelection();
        var selectedText = sel ? sel.toString().trim() : '';
        // 텍스트 선택 상태에서 URL 붙여넣기 → 선택 텍스트를 링크로
        if (selectedText) {
          e.preventDefault();
          saveSnapshot(editor);
          var a = document.createElement('a');
          a.href = text.trim();
          a.textContent = selectedText;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          var range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(a);
          range.setStartAfter(a);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          saveSnapshotAndNotify(editor);
        }
        // 선택 없이 URL만 붙여넣기 → 브라우저 기본 (plain text로 삽입)
      }
    });
  }

  // ── 표 셀 다중 선택 ──
  var tableSel = { active: false, table: null, startCell: null, cells: [] };

  function getCellPos(cell) {
    var row = cell.parentElement;
    var table = cell.closest('.re-table');
    var allRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var ri = allRows.indexOf(row);
    var ci = Array.prototype.indexOf.call(row.children, cell);
    return { row: ri, col: ci };
  }

  function clearCellSelection() {
    document.querySelectorAll('.re-table-cell-selected').forEach(function (c) {
      c.classList.remove('re-table-cell-selected');
    });
    tableSel.cells = [];
  }

  function selectCellRange(table, startCell, endCell) {
    clearCellSelection();
    var s = getCellPos(startCell);
    var e = getCellPos(endCell);
    var minR = Math.min(s.row, e.row), maxR = Math.max(s.row, e.row);
    var minC = Math.min(s.col, e.col), maxC = Math.max(s.col, e.col);
    var allRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var selected = [];
    for (var r = minR; r <= maxR; r++) {
      if (!allRows[r]) continue;
      for (var c = minC; c <= maxC; c++) {
        var cell = allRows[r].children[c];
        if (cell) {
          cell.classList.add('re-table-cell-selected');
          selected.push(cell);
        }
      }
    }
    tableSel.cells = selected;
  }

  function getSelectionBounds() {
    if (tableSel.cells.length === 0) return null;
    var rows = [], cols = [];
    tableSel.cells.forEach(function (c) {
      var p = getCellPos(c);
      if (rows.indexOf(p.row) === -1) rows.push(p.row);
      if (cols.indexOf(p.col) === -1) cols.push(p.col);
    });
    rows.sort(function(a,b){return a-b;});
    cols.sort(function(a,b){return a-b;});
    return { rows: rows, cols: cols };
  }

  // 선택된 셀들에 서식(bold, underline 등) 일괄 적용
  function applyFormatToSelectedCells(cmd, editor) {
    if (tableSel.cells.length === 0) return;
    saveSnapshot(editor);
    var sel = window.getSelection();
    tableSel.cells.forEach(function (cell) {
      // 셀 전체 내용을 선택한 뒤 execCommand 적용
      var range = document.createRange();
      range.selectNodeContents(cell);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand(cmd, false, null);
    });
    // 선택 해제 후 셀 하이라이트 복원
    sel.removeAllRanges();
    tableSel.cells.forEach(function (c) {
      c.classList.add('re-table-cell-selected');
    });
    saveSnapshotAndNotify(editor);
  }

  function initTableCellSelection(editor) {
    var selecting = false;
    var disabledDraggable = null; // 임시 비활성화한 draggable 요소

    editor.addEventListener('mousedown', function (e) {
      // 우클릭(button=2)은 기존 선택 유지 (컨텍스트 메뉴용)
      if (e.button === 2) return;

      var cell = e.target.closest('td, th');
      if (!cell || !cell.closest('.re-table')) {
        // 표 밖 클릭 → 선택 해제
        if (!e.target.closest('.table-ctx-menu')) {
          clearCellSelection();
          tableSel.active = false;
          tableSel.table = null;
        }
        return;
      }

      // 리사이즈 중이면 무시
      var table = cell.closest('.re-table');
      var rect = cell.getBoundingClientRect();
      var nearEdge = Math.abs(e.clientX - rect.right) <= 6 || Math.abs(e.clientY - rect.bottom) <= 6 ||
                     Math.abs(e.clientX - rect.left) <= 6 || Math.abs(e.clientY - rect.top) <= 6;
      if (nearEdge) return;

      // 상위 draggable 일시 비활성화 (항목 드래그 충돌 방지)
      var draggableParent = cell.closest('[draggable="true"]');
      if (draggableParent && draggableParent !== table) {
        draggableParent.setAttribute('draggable', 'false');
        disabledDraggable = draggableParent;
      }

      hideTableContextMenu();
      clearCellSelection();
      tableSel.active = true;
      tableSel.table = table;
      tableSel.startCell = cell;
      cell.classList.add('re-table-cell-selected');
      tableSel.cells = [cell];
      selecting = true;
    });

    editor.addEventListener('mousemove', function (e) {
      if (!selecting || !tableSel.table) return;
      var cell = e.target.closest('td, th');
      if (!cell || cell.closest('.re-table') !== tableSel.table) return;
      e.preventDefault();
      selectCellRange(tableSel.table, tableSel.startCell, cell);
    });

    var stopSelecting = function () {
      selecting = false;
      // draggable 복원
      if (disabledDraggable) {
        disabledDraggable.setAttribute('draggable', 'true');
        disabledDraggable = null;
      }
    };
    editor.addEventListener('mouseup', stopSelecting);
    document.addEventListener('mouseup', stopSelecting);
  }

  // ── 표 삽입 그리드 피커 ──
  var activeTablePicker = null;

  function openTablePicker(anchorBtn, editor) {
    closeTablePicker();
    var picker = document.createElement('div');
    picker.className = 'table-picker';
    var maxR = 8, maxC = 8;
    var label = document.createElement('div');
    label.className = 'table-picker-label';
    label.textContent = '행 × 열 선택';
    picker.appendChild(label);

    var grid = document.createElement('div');
    grid.className = 'table-picker-grid';
    grid.style.gridTemplateColumns = 'repeat(' + maxC + ', 1fr)';

    for (var r = 1; r <= maxR; r++) {
      for (var c = 1; c <= maxC; c++) {
        var cell = document.createElement('div');
        cell.className = 'table-picker-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        grid.appendChild(cell);
      }
    }
    picker.appendChild(grid);

    grid.addEventListener('mouseover', function (e) {
      var t = e.target.closest('.table-picker-cell');
      if (!t) return;
      var hr = +t.dataset.row, hc = +t.dataset.col;
      label.textContent = hr + ' × ' + hc;
      grid.querySelectorAll('.table-picker-cell').forEach(function (c) {
        c.classList.toggle('highlight', +c.dataset.row <= hr && +c.dataset.col <= hc);
      });
    });

    grid.addEventListener('click', function (e) {
      var t = e.target.closest('.table-picker-cell');
      if (!t) return;
      insertTable(editor, +t.dataset.row, +t.dataset.col);
      closeTablePicker();
    });

    // 위치 지정
    var rect = anchorBtn.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.zIndex = '9999';
    document.body.appendChild(picker);
    activeTablePicker = picker;

    // 바깥 클릭 닫기
    setTimeout(function () {
      document.addEventListener('mousedown', closePickerOutside);
    }, 0);
  }

  function closePickerOutside(e) {
    if (activeTablePicker && !activeTablePicker.contains(e.target)) {
      closeTablePicker();
    }
  }

  function closeTablePicker() {
    if (activeTablePicker) {
      activeTablePicker.remove();
      activeTablePicker = null;
      document.removeEventListener('mousedown', closePickerOutside);
    }
  }

  // ── 표 테두리 설정 피커 ──
  var activeBorderPicker = null;

  var borderPresets = [
    { id: '',              label: '전체 테두리',   icon: '▦' },
    { id: 'border-none',   label: '테두리 없음',   icon: '▢' },
    { id: 'border-outer',  label: '바깥만',        icon: '□' },
    { id: 'border-horiz',  label: '가로만',        icon: '━' },
    { id: 'border-vert',   label: '세로만',        icon: '┃' },
    { id: 'border-header', label: '헤더 구분만',    icon: '▔' },
    { id: 'border-thick',  label: '굵은 테두리',   icon: '▣' },
    { id: 'border-dashed', label: '점선 테두리',   icon: '┈' }
  ];

  function getActiveTable(editor) {
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (el && el.closest) {
      var t = el.closest('.re-table');
      if (t && editor.contains(t)) return t;
    }
    // fallback: 선택된 셀이 있으면 그 표
    if (tableSel.table && editor.contains(tableSel.table)) return tableSel.table;
    return editor.querySelector('.re-table');
  }

  function openTableBorderPicker(btn, editor) {
    closeTableBorderPicker();
    var table = getActiveTable(editor);
    if (!table) return;

    var picker = document.createElement('div');
    picker.className = 'table-border-picker';

    // 현재 적용된 프리셋 감지
    var current = '';
    borderPresets.forEach(function (p) {
      if (p.id && table.classList.contains(p.id)) current = p.id;
    });

    borderPresets.forEach(function (p) {
      var item = document.createElement('button');
      item.className = 'table-border-item' + (current === p.id ? ' active' : '');
      item.dataset.borderId = p.id;
      item.innerHTML = '<span class="table-border-icon">' + p.icon + '</span>' +
                        '<span class="table-border-label">' + p.label + '</span>';
      picker.appendChild(item);
    });

    // 커스텀 색상 선택
    var colorSection = document.createElement('div');
    colorSection.className = 'table-border-color-section';
    colorSection.innerHTML =
      '<span class="table-border-color-title">테두리 색상</span>' +
      '<div class="table-border-colors">' +
        '<button class="table-border-color-btn" data-bcolor="" title="기본" style="background:var(--border);border:1px solid var(--border)"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#3b82f6" title="파랑" style="background:#3b82f6"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#ef4444" title="빨강" style="background:#ef4444"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#22c55e" title="초록" style="background:#22c55e"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#a855f7" title="보라" style="background:#a855f7"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#f59e0b" title="주황" style="background:#f59e0b"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#6b7280" title="회색" style="background:#6b7280"></button>' +
        '<button class="table-border-color-btn" data-bcolor="#1f2937" title="진한" style="background:#1f2937"></button>' +
      '</div>';
    picker.appendChild(colorSection);

    picker.addEventListener('click', function (e) {
      var item = e.target.closest('.table-border-item');
      var colorBtn = e.target.closest('[data-bcolor]');
      if (item) {
        saveSnapshot(editor);
        var bid = item.dataset.borderId;
        // 기존 border 클래스 모두 제거
        borderPresets.forEach(function (p) {
          if (p.id) table.classList.remove(p.id);
        });
        if (bid) table.classList.add(bid);
        // active 표시 업데이트
        picker.querySelectorAll('.table-border-item').forEach(function (i) {
          i.classList.toggle('active', i.dataset.borderId === bid);
        });
        saveSnapshotAndNotify(editor);
      } else if (colorBtn) {
        saveSnapshot(editor);
        var color = colorBtn.dataset.bcolor;
        if (color) {
          table.style.setProperty('--table-border-color', color);
          table.classList.add('custom-border-color');
        } else {
          table.style.removeProperty('--table-border-color');
          table.classList.remove('custom-border-color');
        }
        saveSnapshotAndNotify(editor);
      }
    });

    var rect = btn.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.zIndex = '9999';
    document.body.appendChild(picker);
    activeBorderPicker = picker;

    requestAnimationFrame(function () {
      var pr = picker.getBoundingClientRect();
      if (pr.right > window.innerWidth) {
        picker.style.left = (window.innerWidth - pr.width - 8) + 'px';
      }
    });

    setTimeout(function () {
      document.addEventListener('mousedown', closeBorderPickerOutside);
    }, 0);
  }

  function closeBorderPickerOutside(e) {
    if (activeBorderPicker && !activeBorderPicker.contains(e.target) && !e.target.closest('.table-border-btn')) {
      closeTableBorderPicker();
    }
  }

  function closeTableBorderPicker() {
    if (activeBorderPicker) {
      activeBorderPicker.remove();
      activeBorderPicker = null;
      document.removeEventListener('mousedown', closeBorderPickerOutside);
    }
  }

  function insertTable(editor, rows, cols) {
    var html = '<table class="re-table" contenteditable="false">';
    html += '<thead><tr>';
    for (var c = 0; c < cols; c++) {
      html += '<th contenteditable="true">제목</th>';
    }
    html += '</tr></thead><tbody>';
    for (var r = 0; r < rows - 1; r++) {
      html += '<tr>';
      for (var c2 = 0; c2 < cols; c2++) {
        html += '<td contenteditable="true"></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    editor.focus();
    document.execCommand('insertHTML', false, html);
  }

  // ── 표 컨텍스트 메뉴 ──
  var tableCtx = null;

  function showTableContextMenu(cell, editor, evt) {
    hideTableContextMenu();
    var table = cell.closest('.re-table');
    if (!table) return;

    // 우클릭한 셀이 선택 범위에 없으면, 기존 선택을 유지하되 cell 정보만 갱신
    if (tableSel.cells.length > 0 && tableSel.cells.indexOf(cell) === -1) {
      // 선택 범위 밖 우클릭 → 기존 선택 해제하고 단일 셀로
      clearCellSelection();
      cell.classList.add('re-table-cell-selected');
      tableSel.cells = [cell];
      tableSel.table = table;
    } else if (tableSel.cells.length === 0) {
      cell.classList.add('re-table-cell-selected');
      tableSel.cells = [cell];
      tableSel.table = table;
    }

    // 선택 범위 정보
    var bounds = getSelectionBounds();
    var rowCount = bounds ? bounds.rows.length : 1;
    var colCount = bounds ? bounds.cols.length : 1;
    var rowLabel = rowCount > 1 ? rowCount + '개 행 삭제' : '행 삭제';
    var colLabel = colCount > 1 ? colCount + '개 열 삭제' : '열 삭제';
    var selCount = tableSel.cells.length;
    var colorLabel = selCount > 1 ? '선택 셀 배경색 (' + selCount + '개)' : '셀 배경색';

    var menu = document.createElement('div');
    menu.className = 'table-ctx-menu';
    menu.innerHTML =
      '<div class="table-ctx-section">' +
        '<span class="table-ctx-title">행</span>' +
        '<button class="table-ctx-btn" data-act="add-row-above">↑ 위에 추가</button>' +
        '<button class="table-ctx-btn" data-act="add-row-below">↓ 아래에 추가</button>' +
        '<button class="table-ctx-btn table-ctx-danger" data-act="del-row">🗑 ' + rowLabel + '</button>' +
      '</div>' +
      '<div class="table-ctx-section">' +
        '<span class="table-ctx-title">열</span>' +
        '<button class="table-ctx-btn" data-act="add-col-left">← 왼쪽에 추가</button>' +
        '<button class="table-ctx-btn" data-act="add-col-right">→ 오른쪽에 추가</button>' +
        '<button class="table-ctx-btn table-ctx-danger" data-act="del-col">🗑 ' + colLabel + '</button>' +
      '</div>' +
      '<div class="table-ctx-section">' +
        '<span class="table-ctx-title">' + colorLabel + '</span>' +
        '<div class="table-ctx-colors">' +
          '<button class="table-ctx-color" data-color="" title="없음" style="background:#fff;border:1px solid #ccc"></button>' +
          '<button class="table-ctx-color" data-color="#e8f0fe" title="파랑" style="background:#e8f0fe"></button>' +
          '<button class="table-ctx-color" data-color="#fce8e6" title="빨강" style="background:#fce8e6"></button>' +
          '<button class="table-ctx-color" data-color="#e6f4ea" title="초록" style="background:#e6f4ea"></button>' +
          '<button class="table-ctx-color" data-color="#fef7e0" title="노랑" style="background:#fef7e0"></button>' +
          '<button class="table-ctx-color" data-color="#f3e8fd" title="보라" style="background:#f3e8fd"></button>' +
          '<button class="table-ctx-color" data-color="#e8eaed" title="회색" style="background:#e8eaed"></button>' +
          '<button class="table-ctx-color" data-color="#1a1a2e" title="어두운" style="background:#1a1a2e"></button>' +
        '</div>' +
      '</div>' +
      '<div class="table-ctx-section">' +
        '<button class="table-ctx-btn table-ctx-danger" data-act="del-table">🗑 표 전체 삭제</button>' +
      '</div>';

    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      var colorBtn = e.target.closest('[data-color]');
      if (btn) {
        handleTableAction(btn.dataset.act, cell, table, editor);
        hideTableContextMenu();
      } else if (colorBtn) {
        // 선택된 셀들에 일괄 적용
        saveSnapshot(editor);
        var color = colorBtn.dataset.color || '';
        if (tableSel.cells.length > 0) {
          tableSel.cells.forEach(function (c) { c.style.backgroundColor = color; });
        } else {
          cell.style.backgroundColor = color;
        }
        saveSnapshotAndNotify(editor);
        hideTableContextMenu();
      }
    });

    // 우클릭 위치 또는 셀 위치에 메뉴 배치
    var posX = evt ? evt.clientX : cell.getBoundingClientRect().left;
    var posY = evt ? evt.clientY : cell.getBoundingClientRect().bottom + 4;
    menu.style.position = 'fixed';
    menu.style.top = posY + 'px';
    menu.style.left = posX + 'px';
    menu.style.zIndex = '9999';
    document.body.appendChild(menu);
    tableCtx = menu;

    // 뷰포트 밖으로 나가면 조정
    requestAnimationFrame(function () {
      var mr = menu.getBoundingClientRect();
      if (mr.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - mr.width - 8) + 'px';
      }
      if (mr.bottom > window.innerHeight) {
        menu.style.top = (posY - mr.height - 4) + 'px';
      }
    });

    setTimeout(function () {
      document.addEventListener('mousedown', closeCtxOutside);
    }, 0);
  }

  function closeCtxOutside(e) {
    if (tableCtx && !tableCtx.contains(e.target) && !e.target.closest('.re-table')) {
      hideTableContextMenu();
    }
  }

  function hideTableContextMenu() {
    if (tableCtx) {
      tableCtx.remove();
      tableCtx = null;
      document.removeEventListener('mousedown', closeCtxOutside);
    }
  }

  function handleTableAction(act, cell, table, editor) {
    saveSnapshot(editor); // undo 지점 저장
    var row = cell.parentElement;
    var tbody = table.querySelector('tbody');
    var thead = table.querySelector('thead');
    var colIndex = Array.prototype.indexOf.call(row.children, cell);
    var colCount = row.children.length;
    var bounds = getSelectionBounds();

    switch (act) {
      case 'add-row-above': {
        var newRow = createTableRow(colCount, 'td');
        row.parentElement.insertBefore(newRow, row);
        if (row.parentElement === thead && tbody) {
          tbody.insertBefore(newRow, tbody.firstChild);
        }
        break;
      }
      case 'add-row-below': {
        var newRow2 = createTableRow(colCount, 'td');
        if (row.parentElement === thead) {
          if (tbody) tbody.insertBefore(newRow2, tbody.firstChild);
          else { var nb = document.createElement('tbody'); nb.appendChild(newRow2); table.appendChild(nb); }
        } else {
          row.parentElement.insertBefore(newRow2, row.nextSibling);
        }
        break;
      }
      case 'del-row': {
        var allRows = Array.prototype.slice.call(table.querySelectorAll('tr'));
        var delRows = bounds ? bounds.rows : [allRows.indexOf(row)];
        // 전부 삭제하면 표 자체 제거
        if (delRows.length >= allRows.length) { table.remove(); clearCellSelection(); break; }
        // 뒤에서부터 삭제 (인덱스 꼬임 방지)
        delRows.sort(function(a,b){return b-a;}).forEach(function (ri) {
          if (allRows[ri]) allRows[ri].remove();
        });
        clearCellSelection();
        break;
      }
      case 'add-col-left':
        addColumn(table, colIndex);
        break;
      case 'add-col-right':
        addColumn(table, colIndex + 1);
        break;
      case 'del-col': {
        var delCols = bounds ? bounds.cols : [colIndex];
        var totalCols = row.children.length;
        if (delCols.length >= totalCols) { table.remove(); clearCellSelection(); break; }
        // 뒤에서부터 삭제
        delCols.sort(function(a,b){return b-a;}).forEach(function (ci) {
          table.querySelectorAll('tr').forEach(function (tr) {
            if (tr.children[ci]) tr.children[ci].remove();
          });
        });
        clearCellSelection();
        break;
      }
      case 'del-table':
        table.remove();
        clearCellSelection();
        break;
    }
    saveSnapshotAndNotify(editor);
  }

  function createTableRow(colCount, tag) {
    var tr = document.createElement('tr');
    for (var i = 0; i < colCount; i++) {
      var cell = document.createElement(tag || 'td');
      cell.contentEditable = 'true';
      tr.appendChild(cell);
    }
    return tr;
  }

  function addColumn(table, atIndex) {
    table.querySelectorAll('tr').forEach(function (tr) {
      var isHead = tr.parentElement.tagName === 'THEAD';
      var cell = document.createElement(isHead ? 'th' : 'td');
      cell.contentEditable = 'true';
      if (isHead) cell.textContent = '제목';
      if (atIndex >= tr.children.length) {
        tr.appendChild(cell);
      } else {
        tr.insertBefore(cell, tr.children[atIndex]);
      }
    });
  }

  // ── 표 열 너비 / 행 높이 드래그 리사이즈 ──
  (function () {
    var EDGE = 6; // 경계 감지 거리 (px)
    var resizeState = null;

    // 표가 삽입될 때 table-layout: fixed + 초기 너비 설정
    function initTableLayout(table) {
      if (table.dataset.layoutInit) return;
      table.dataset.layoutInit = '1';
      table.style.tableLayout = 'fixed';
      var firstRow = table.querySelector('tr');
      if (!firstRow) return;
      var cells = firstRow.children;
      var totalW = table.offsetWidth;
      var colW = Math.floor(totalW / cells.length);
      for (var i = 0; i < cells.length; i++) {
        cells[i].style.width = colW + 'px';
      }
    }

    // 셀 경계 감지: 오른쪽 경계 → col-resize, 아래쪽 경계 → row-resize
    function detectEdge(cell, e) {
      var rect = cell.getBoundingClientRect();
      var nearRight = Math.abs(e.clientX - rect.right) <= EDGE;
      var nearBottom = Math.abs(e.clientY - rect.bottom) <= EDGE;
      var nearLeft = Math.abs(e.clientX - rect.left) <= EDGE;
      var nearTop = Math.abs(e.clientY - rect.top) <= EDGE;

      // 오른쪽 경계
      if (nearRight) return { type: 'col', side: 'right', cell: cell };
      // 왼쪽 경계 (첫 열이 아닌 경우 → 왼쪽 셀의 오른쪽 경계)
      if (nearLeft) {
        var idx = Array.prototype.indexOf.call(cell.parentElement.children, cell);
        if (idx > 0) {
          return { type: 'col', side: 'right', cell: cell.parentElement.children[idx - 1] };
        }
      }
      // 아래쪽 경계
      if (nearBottom) return { type: 'row', side: 'bottom', cell: cell };
      // 위쪽 경계 (첫 행이 아닌 경우 → 위 행의 같은 열)
      if (nearTop) {
        var row = cell.parentElement;
        var prevRow = row.previousElementSibling;
        if (!prevRow && row.parentElement.tagName === 'TBODY') {
          var thead = row.closest('table').querySelector('thead');
          if (thead) prevRow = thead.querySelector('tr:last-child');
        }
        if (prevRow) {
          var ci = Array.prototype.indexOf.call(row.children, cell);
          var prevCell = prevRow.children[ci];
          if (prevCell) return { type: 'row', side: 'bottom', cell: prevCell };
        }
      }
      return null;
    }

    // mousemove on document: 커서 모양 변경
    document.addEventListener('mousemove', function (e) {
      if (resizeState) {
        handleDrag(e);
        return;
      }
      var cell = e.target.closest && e.target.closest('td, th');
      if (!cell || !cell.closest('.re-table')) {
        return;
      }
      var edge = detectEdge(cell, e);
      if (edge) {
        cell.closest('.re-table').style.cursor = edge.type === 'col' ? 'col-resize' : 'row-resize';
      } else {
        cell.closest('.re-table').style.cursor = '';
      }
    });

    // mousedown: 리사이즈 시작
    document.addEventListener('mousedown', function (e) {
      var cell = e.target.closest && e.target.closest('td, th');
      if (!cell || !cell.closest('.re-table')) return;

      var edge = detectEdge(cell, e);
      if (!edge) return;

      e.preventDefault();
      e.stopPropagation();

      var table = cell.closest('.re-table');
      initTableLayout(table);

      var targetCell = edge.cell;
      var colIdx = Array.prototype.indexOf.call(targetCell.parentElement.children, targetCell);

      if (edge.type === 'col') {
        // 첫 행의 해당 열 셀에서 현재 너비 가져오기
        var firstRow = table.querySelector('tr');
        var refCell = firstRow.children[colIdx];
        resizeState = {
          type: 'col',
          table: table,
          colIdx: colIdx,
          startX: e.clientX,
          startW: refCell.offsetWidth
        };
      } else {
        // row resize
        var targetRow = targetCell.parentElement;
        resizeState = {
          type: 'row',
          table: table,
          row: targetRow,
          startY: e.clientY,
          startH: targetRow.offsetHeight
        };
      }

      // 리사이즈 가이드라인 표시
      var line = document.createElement('div');
      line.className = 'table-resize-line table-resize-line-' + resizeState.type;
      document.body.appendChild(line);
      resizeState.line = line;
      updateGuideLine(e);

      document.body.style.cursor = resizeState.type === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    });

    function updateGuideLine(e) {
      if (!resizeState || !resizeState.line) return;
      var line = resizeState.line;
      var tableRect = resizeState.table.getBoundingClientRect();
      if (resizeState.type === 'col') {
        line.style.left = e.clientX + 'px';
        line.style.top = tableRect.top + 'px';
        line.style.height = tableRect.height + 'px';
      } else {
        line.style.top = e.clientY + 'px';
        line.style.left = tableRect.left + 'px';
        line.style.width = tableRect.width + 'px';
      }
    }

    function handleDrag(e) {
      if (!resizeState) return;
      e.preventDefault();
      updateGuideLine(e);

      if (resizeState.type === 'col') {
        var dx = e.clientX - resizeState.startX;
        var newW = Math.max(30, resizeState.startW + dx);
        // 해당 열의 모든 셀 너비 설정
        resizeState.table.querySelectorAll('tr').forEach(function (tr) {
          var cell = tr.children[resizeState.colIdx];
          if (cell) cell.style.width = newW + 'px';
        });
      } else {
        var dy = e.clientY - resizeState.startY;
        var newH = Math.max(24, resizeState.startH + dy);
        // 해당 행의 높이 설정
        resizeState.row.style.height = newH + 'px';
        Array.prototype.forEach.call(resizeState.row.children, function (cell) {
          cell.style.height = newH + 'px';
        });
      }
    }

    // mouseup: 리사이즈 종료
    document.addEventListener('mouseup', function () {
      if (!resizeState) return;
      if (resizeState.line) resizeState.line.remove();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizeState = null;
    });
  })();

  // 저장된 HTML 로드 시 bare <img>를 re-img-wrap으로 감싸기
  function wrapBareImages(editor) {
    editor.querySelectorAll('img').forEach(function (img) {
      if (img.closest('.re-img-wrap')) return; // 이미 래핑됨
      img.className = 're-img';
      var wrapper = document.createElement('span');
      wrapper.className = 're-img-wrap';
      wrapper.contentEditable = 'false';
      wrapper.setAttribute('draggable', 'true');
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      var handles = ['nw','ne','sw','se'];
      handles.forEach(function (pos) {
        var h = document.createElement('span');
        h.className = 're-img-handle re-img-handle-' + pos;
        h.dataset.handle = pos;
        wrapper.appendChild(h);
      });
      var del = document.createElement('button');
      del.className = 're-img-delete';
      del.textContent = '✕';
      del.title = '이미지 삭제';
      wrapper.appendChild(del);
    });
  }

  function insertImageFile(editor, file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      editor.focus();
      var wrapper = document.createElement('span');
      wrapper.className = 're-img-wrap';
      wrapper.contentEditable = 'false';
      wrapper.setAttribute('draggable', 'true');
      var img = document.createElement('img');
      img.src = ev.target.result;
      img.className = 're-img';
      wrapper.appendChild(img);
      // 리사이즈 핸들
      var handles = ['nw','ne','sw','se'];
      handles.forEach(function (pos) {
        var h = document.createElement('span');
        h.className = 're-img-handle re-img-handle-' + pos;
        h.dataset.handle = pos;
        wrapper.appendChild(h);
      });
      // 삭제 버튼
      var del = document.createElement('button');
      del.className = 're-img-delete';
      del.textContent = '✕';
      del.title = '이미지 삭제';
      wrapper.appendChild(del);

      var sel = window.getSelection();
      if (sel.rangeCount > 0) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrapper);
        range.setStartAfter(wrapper);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editor.appendChild(wrapper);
      }
    };
    reader.readAsDataURL(file);
  }

  // ── 이미지 리사이즈 & 드래그 ──
  (function () {
    var resizing = null; // { wrapper, startX, startY, startW, startH, handle }
    var dragging = null; // { wrapper, editor, ghost, offsetX, offsetY }

    // 이미지 선택 토글
    document.addEventListener('click', function (e) {
      var wrap = e.target.closest('.re-img-wrap');
      // 이전 선택 해제
      document.querySelectorAll('.re-img-wrap.selected').forEach(function (w) {
        if (w !== wrap) w.classList.remove('selected');
      });
      if (wrap) {
        wrap.classList.add('selected');
      }
    });

    // 삭제 버튼
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('re-img-delete')) {
        e.preventDefault();
        e.stopPropagation();
        var wrap = e.target.closest('.re-img-wrap');
        if (wrap) wrap.remove();
      }
    });

    // 리사이즈 시작
    document.addEventListener('mousedown', function (e) {
      var handle = e.target.closest('.re-img-handle');
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      var wrapper = handle.closest('.re-img-wrap');
      var img = wrapper.querySelector('.re-img');
      resizing = {
        wrapper: wrapper,
        img: img,
        startX: e.clientX,
        startY: e.clientY,
        startW: img.offsetWidth,
        startH: img.offsetHeight,
        handle: handle.dataset.handle,
        ratio: img.offsetWidth / img.offsetHeight
      };
      wrapper.classList.add('resizing');
    });

    document.addEventListener('mousemove', function (e) {
      if (!resizing) return;
      e.preventDefault();
      var dx = e.clientX - resizing.startX;
      var dy = e.clientY - resizing.startY;
      var newW, newH;
      var h = resizing.handle;

      if (h === 'se') { newW = resizing.startW + dx; }
      else if (h === 'sw') { newW = resizing.startW - dx; }
      else if (h === 'ne') { newW = resizing.startW + dx; }
      else if (h === 'nw') { newW = resizing.startW - dx; }

      newW = Math.max(40, newW);
      newH = newW / resizing.ratio;

      resizing.img.style.width = newW + 'px';
      resizing.img.style.height = newH + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (resizing) {
        resizing.wrapper.classList.remove('resizing');
        resizing = null;
      }
    });

    // 드래그 이동 (에디터 내 위치 변경)
    document.addEventListener('dragstart', function (e) {
      // 표 셀 드래그 중이면 이미지 드래그 무시
      if (e.target.closest('.re-table')) { e.preventDefault(); return; }
      var wrap = e.target.closest('.re-img-wrap');
      if (!wrap) return;
      var editor = wrap.closest('.rich-editable');
      if (!editor) return;

      dragging = { wrapper: wrap, editor: editor };
      wrap.classList.add('dragging-img');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 're-img-drag');
    });

    document.addEventListener('dragover', function (e) {
      if (!dragging) return;
      var editor = dragging.editor;
      if (!editor.contains(e.target) && e.target !== editor) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    document.addEventListener('drop', function (e) {
      if (!dragging) return;
      e.preventDefault();
      var editor = dragging.editor;
      var wrap = dragging.wrapper;

      // 캐럿 위치에 삽입
      var caretRange = null;
      if (document.caretRangeFromPoint) {
        caretRange = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          caretRange = document.createRange();
          caretRange.setStart(pos.offsetNode, pos.offset);
          caretRange.collapse(true);
        }
      }

      // 먼저 기존 위치에서 제거
      wrap.remove();

      if (caretRange && editor.contains(caretRange.startContainer)) {
        caretRange.insertNode(wrap);
      } else {
        editor.appendChild(wrap);
      }

      wrap.classList.remove('dragging-img');
      dragging = null;
    });

    document.addEventListener('dragend', function () {
      if (dragging) {
        dragging.wrapper.classList.remove('dragging-img');
        dragging = null;
      }
    });
  })();

  // 그리기 캔버스
  function openDrawCanvas() {
    var overlay = $('#draw-overlay');
    var canvas = $('#draw-canvas');
    var ctx = canvas.getContext('2d');

    // Reset canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var drawing = false;
    var erasing = false;

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var touch = e.touches ? e.touches[0] : e;
      return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    function startDraw(e) {
      drawing = true;
      var pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function moveDraw(e) {
      if (!drawing) return;
      e.preventDefault();
      var pos = getPos(e);
      ctx.lineWidth = parseInt($('#draw-size').value, 10);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (erasing) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = $('#draw-color').value;
      }
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    function stopDraw() { drawing = false; }

    canvas.onmousedown = startDraw;
    canvas.onmousemove = moveDraw;
    canvas.onmouseup = stopDraw;
    canvas.onmouseleave = stopDraw;
    canvas.ontouchstart = startDraw;
    canvas.ontouchmove = moveDraw;
    canvas.ontouchend = stopDraw;

    $('#draw-eraser').onclick = function () {
      erasing = !erasing;
      this.textContent = erasing ? '펜' : '지우개';
    };

    $('#draw-clear').onclick = function () {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    $('#draw-insert').onclick = function () {
      if (activeRichEditor) {
        var dataUrl = canvas.toDataURL('image/png');
        activeRichEditor.focus();
        document.execCommand('insertImage', false, dataUrl);
      }
      closeDrawCanvas();
    };

    $('#draw-cancel').onclick = closeDrawCanvas;
    $('#draw-close').onclick = closeDrawCanvas;

    overlay.classList.add('active');
    erasing = false;
    $('#draw-eraser').textContent = '지우개';
  }

  function closeDrawCanvas() {
    $('#draw-overlay').classList.remove('active');
    activeRichEditor = null;
  }

  $('#draw-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeDrawCanvas();
  });

  // Initialize all rich editors on static textareas
  $$('textarea[data-rich]').forEach(function (ta) {
    createRichEditor(ta);
  });

  // Helper to get rich editor by original textarea ID
  function getRich(id) {
    return richEditors[id.replace('#', '')];
  }

  // ══════════════════════════════════════
  // 8. 업무일지 탭
  // ══════════════════════════════════════
  var JNL_KEY = 'fl_journal';
  var JNL_FILES_KEY = 'fl_journal_files';
  var currentJnlEditId = null;
  var jnlAttachments = []; // { id, name, size, type, dataUrl }

  function loadJnlFiles() {
    try { return JSON.parse(localStorage.getItem(JNL_FILES_KEY)) || {}; }
    catch { return {}; }
  }

  function saveJnlFiles(data) {
    localStorage.setItem(JNL_FILES_KEY, JSON.stringify(data));
  }

  function getFileIcon(type, name) {
    if (type && type.startsWith('image/')) return '🖼';
    if (type === 'application/pdf' || (name && name.endsWith('.pdf'))) return '📕';
    if (type && (type.includes('spreadsheet') || type.includes('excel')) || (name && /\.xlsx?$/.test(name))) return '📊';
    if (type && (type.includes('word') || type.includes('document')) || (name && /\.docx?$/.test(name))) return '📄';
    if (type && type.includes('presentation') || (name && /\.pptx?$/.test(name))) return '📙';
    return '📎';
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderJnlAttachList() {
    var container = $('#jnl-attach-list');
    if (jnlAttachments.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = jnlAttachments.map(function (f, i) {
      var isImage = f.type && f.type.startsWith('image/');
      var preview = isImage ? '<img class="jnl-attach-preview" src="' + f.dataUrl + '" alt="' + escapeHtml(f.name) + '">' : '';
      return '<div class="jnl-attach-item" data-idx="' + i + '">' +
        preview +
        '<span class="jnl-attach-icon">' + getFileIcon(f.type, f.name) + '</span>' +
        '<span class="jnl-attach-name" title="' + escapeHtml(f.name) + '">' + escapeHtml(f.name) + '</span>' +
        '<span class="jnl-attach-size">' + formatFileSize(f.size) + '</span>' +
        '<div class="jnl-attach-actions">' +
          '<button class="btn btn-small btn-secondary" data-action="download" title="다운로드">⬇</button>' +
          '<button class="btn btn-small btn-danger" data-action="remove" title="삭제">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  var DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  function formatJnlDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var day = DAY_NAMES[d.getDay()];
    return mm + '.' + dd + '(' + day + ')';
  }

  function showJnlList() {
    $('#jnl-list-view').style.display = '';
    $('#jnl-form-view').style.display = 'none';
  }

  function showJnlForm() {
    $('#jnl-list-view').style.display = 'none';
    $('#jnl-form-view').style.display = '';
  }

  function clearJnlForm() {
    currentJnlEditId = null;
    $('#jnl-category').value = '';
    $('#jnl-item').value = '';
    $('#jnl-subitem').value = '';
    $('#jnl-date').value = new Date().toISOString().slice(0, 10);
    $('#jnl-feedback').value = '';
    $('#jnl-note').value = '';
    $('#jnl-ref').value = '';
    $('#jnl-form-title-label').textContent = '새 항목 추가';
    jnlAttachments = [];
    renderJnlAttachList();
  }

  function getJnlData() {
    // Save attachments to separate storage keyed by file ID
    var fileStore = loadJnlFiles();
    var attachIds = jnlAttachments.map(function (f) {
      fileStore[f.id] = { name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl };
      return f.id;
    });
    saveJnlFiles(fileStore);

    return {
      id: currentJnlEditId || uid(),
      category: $('#jnl-category').value.trim(),
      item: $('#jnl-item').value.trim(),
      subitem: $('#jnl-subitem').value.trim(),
      date: $('#jnl-date').value,
      feedback: $('#jnl-feedback').value.trim(),
      note: $('#jnl-note').value.trim(),
      ref: $('#jnl-ref').value.trim(),
      attachments: attachIds,
      createdAt: new Date().toISOString()
    };
  }

  function loadJnlToForm(entry) {
    currentJnlEditId = entry.id;
    showJnlForm();
    $('#jnl-category').value = entry.category || '';
    $('#jnl-item').value = entry.item || '';
    $('#jnl-subitem').value = entry.subitem || '';
    $('#jnl-date').value = entry.date || '';
    $('#jnl-feedback').value = entry.feedback || '';
    $('#jnl-note').value = entry.note || '';
    $('#jnl-ref').value = entry.ref || '';
    $('#jnl-form-title-label').textContent = '항목 수정';

    // Restore attachments
    jnlAttachments = [];
    if (entry.attachments && entry.attachments.length > 0) {
      var fileStore = loadJnlFiles();
      entry.attachments.forEach(function (fid) {
        var f = fileStore[fid];
        if (f) {
          jnlAttachments.push({ id: fid, name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl });
        }
      });
    }
    renderJnlAttachList();
  }

  function getJnlCategories() {
    var items = load(JNL_KEY);
    var cats = {};
    items.forEach(function (e) {
      if (e.category) cats[e.category] = true;
    });
    return Object.keys(cats).sort();
  }

  function populateJnlCategoryFilter() {
    var sel = $('#jnl-filter-category');
    var cats = getJnlCategories();
    var current = sel.value;
    var html = '<option value="">전체 구분</option>';
    cats.forEach(function (c) {
      html += '<option value="' + escapeHtml(c) + '"' + (c === current ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
    });
    sel.innerHTML = html;
  }

  function renderJnlTable() {
    var items = load(JNL_KEY);
    var search = ($('#jnl-search').value || '').toLowerCase();
    var filterCat = $('#jnl-filter-category').value;

    if (filterCat) {
      items = items.filter(function (e) { return e.category === filterCat; });
    }

    if (search) {
      items = items.filter(function (e) {
        return (e.category || '').toLowerCase().includes(search) ||
          (e.item || '').toLowerCase().includes(search) ||
          (e.subitem || '').toLowerCase().includes(search) ||
          (e.feedback || '').toLowerCase().includes(search) ||
          (e.note || '').toLowerCase().includes(search) ||
          (e.ref || '').toLowerCase().includes(search);
      });
    }

    var tbody = $('#jnl-tbody');

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="jnl-empty">' +
        (load(JNL_KEY).length === 0 ? '업무일지 항목이 없습니다. 새 항목을 추가하거나 Excel/CSV 파일을 업로드하세요.' : '검색 결과가 없습니다.') +
        '</td></tr>';
      return;
    }

    var fileStore = loadJnlFiles();
    tbody.innerHTML = items.map(function (e) {
      var attachHtml = '';
      if (e.attachments && e.attachments.length > 0) {
        attachHtml = '<div class="jnl-cell-attachments">' +
          e.attachments.map(function (fid) {
            var f = fileStore[fid];
            if (!f) return '';
            return '<a class="jnl-cell-attach-tag" data-file-id="' + fid + '" title="' + escapeHtml(f.name) + '">' +
              getFileIcon(f.type, f.name) + ' <span>' + escapeHtml(f.name) + '</span></a>';
          }).join('') +
        '</div>';
      }
      return '<tr data-id="' + e.id + '">' +
        '<td><span class="jnl-category-badge">' + escapeHtml(e.category || '-') + '</span></td>' +
        '<td>' + escapeHtml(e.item || '-') + '</td>' +
        '<td>' + escapeHtml(e.subitem || '-') + '</td>' +
        '<td>' + escapeHtml(formatJnlDate(e.date)) + '</td>' +
        '<td><div class="jnl-cell-text">' + escapeHtml(e.feedback || '') + '</div></td>' +
        '<td><div class="jnl-cell-text">' + escapeHtml(e.note || '') + '</div></td>' +
        '<td><div class="jnl-cell-ref">' + escapeHtml(e.ref || '') + '</div>' + attachHtml + '</td>' +
        '<td class="jnl-td-actions">' +
          '<button class="btn btn-small btn-secondary" data-action="edit" title="수정">✎</button> ' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // -- Event listeners --
  $('#jnl-new').addEventListener('click', function () {
    clearJnlForm();
    showJnlForm();
  });

  $('#jnl-back').addEventListener('click', function () {
    showJnlList();
  });

  $('#jnl-form-clear').addEventListener('click', function () {
    clearJnlForm();
    toast('초기화되었습니다');
  });

  $('#jnl-save').addEventListener('click', function () {
    var data = getJnlData();
    if (!data.category && !data.item && !data.subitem) {
      toast('구분, 항목, 세부 항목 중 하나 이상 입력해주세요');
      return;
    }
    var items = load(JNL_KEY);
    if (currentJnlEditId) {
      items = items.filter(function (i) { return i.id !== currentJnlEditId; });
    }
    items.unshift(data);
    save(JNL_KEY, items);
    currentJnlEditId = null;
    renderJnlTable();
    populateJnlCategoryFilter();
    showJnlList();
    toast('업무일지가 저장되었습니다');
  });

  $('#jnl-search').addEventListener('input', function () { renderJnlTable(); });
  $('#jnl-filter-category').addEventListener('change', function () { renderJnlTable(); });

  $('#jnl-tbody').addEventListener('click', function (e) {
    // File download from table
    var attachTag = e.target.closest('.jnl-cell-attach-tag');
    if (attachTag) {
      e.preventDefault();
      var fid = attachTag.dataset.fileId;
      var fileStore = loadJnlFiles();
      var f = fileStore[fid];
      if (f) downloadJnlFile(f);
      return;
    }

    var tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    var id = tr.dataset.id;
    var items = load(JNL_KEY);
    if (e.target.closest('[data-action="delete"]')) {
      // Clean up attached files
      var delEntry = items.find(function (i) { return i.id === id; });
      if (delEntry && delEntry.attachments && delEntry.attachments.length > 0) {
        var fileStore = loadJnlFiles();
        delEntry.attachments.forEach(function (fid) { delete fileStore[fid]; });
        saveJnlFiles(fileStore);
      }
      save(JNL_KEY, items.filter(function (i) { return i.id !== id; }));
      renderJnlTable();
      populateJnlCategoryFilter();
      toast('삭제되었습니다');
    } else if (e.target.closest('[data-action="edit"]')) {
      var entry = items.find(function (i) { return i.id === id; });
      if (entry) {
        loadJnlToForm(entry);
        toast('편집 모드');
      }
    }
  });

  // -- File Attach Events --
  $('#jnl-attach-btn').addEventListener('click', function () {
    $('#jnl-attach-input').click();
  });

  $('#jnl-attach-input').addEventListener('change', function (e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';

    var maxSize = 5 * 1024 * 1024; // 5MB
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        if (file.size > maxSize) {
          toast(file.name + ': 5MB 초과 (건너뜀)');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          jnlAttachments.push({
            id: 'af-' + uid(),
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: ev.target.result
          });
          renderJnlAttachList();
        };
        reader.readAsDataURL(file);
      })(files[i]);
    }
  });

  $('#jnl-attach-list').addEventListener('click', function (e) {
    var item = e.target.closest('.jnl-attach-item');
    if (!item) return;
    var idx = parseInt(item.dataset.idx, 10);

    if (e.target.closest('[data-action="remove"]')) {
      jnlAttachments.splice(idx, 1);
      renderJnlAttachList();
      toast('첨부 파일 제거됨');
    } else if (e.target.closest('[data-action="download"]')) {
      var f = jnlAttachments[idx];
      if (f) downloadJnlFile(f);
    }
  });

  function downloadJnlFile(f) {
    var link = document.createElement('a');
    link.href = f.dataUrl;
    link.download = f.name;
    link.click();
    toast(f.name + ' 다운로드');
  }

  // -- Excel Export --
  $('#jnl-export-excel').addEventListener('click', function () {
    var items = load(JNL_KEY);
    if (items.length === 0) { toast('내보낼 데이터가 없습니다'); return; }
    var fileStore = loadJnlFiles();
    var sheetData = [['구분', '항목', '세부 항목', '날짜', '피드백 및 결정', '느낀 점 및 수행해야 할 사항', '레퍼런스', '첨부파일']];
    items.forEach(function (e) {
      var attachNames = (e.attachments || []).map(function (fid) {
        var f = fileStore[fid];
        return f ? f.name : '';
      }).filter(Boolean).join(', ');
      sheetData.push([
        e.category || '',
        e.item || '',
        e.subitem || '',
        e.date || '',
        e.feedback || '',
        e.note || '',
        e.ref || '',
        attachNames
      ]);
    });
    exportAsExcel('업무일지_전략기획팀', sheetData);
  });

  // -- CSV Export --
  $('#jnl-export-csv').addEventListener('click', function () {
    var items = load(JNL_KEY);
    if (items.length === 0) { toast('내보낼 데이터가 없습니다'); return; }
    var fileStore = loadJnlFiles();
    var headers = ['구분', '항목', '세부 항목', '날짜', '피드백 및 결정', '느낀 점 및 수행해야 할 사항', '레퍼런스', '첨부파일'];
    var rows = [headers.join(',')];
    items.forEach(function (e) {
      var attachNames = (e.attachments || []).map(function (fid) {
        var f = fileStore[fid];
        return f ? f.name : '';
      }).filter(Boolean).join('; ');
      var row = [
        e.category || '',
        e.item || '',
        e.subitem || '',
        e.date || '',
        e.feedback || '',
        e.note || '',
        e.ref || '',
        attachNames
      ].map(function (cell) {
        // CSV escape: wrap in quotes if contains comma, quote, or newline
        if (cell.indexOf(',') !== -1 || cell.indexOf('"') !== -1 || cell.indexOf('\n') !== -1) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      });
      rows.push(row.join(','));
    });
    var csvContent = '\uFEFF' + rows.join('\r\n'); // BOM for Korean encoding
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '업무일지_전략기획팀.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('CSV 파일이 다운로드되었습니다');
  });

  // -- Excel/CSV Import --
  $('#jnl-import-excel').addEventListener('click', function () {
    $('#jnl-file-input').click();
  });

  $('#jnl-file-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // reset for re-upload

    var isCSV = file.name.toLowerCase().endsWith('.csv');

    if (typeof XLSX === 'undefined') {
      toast('Excel 라이브러리를 로드하지 못했습니다');
      return;
    }

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var workbook;
        if (isCSV) {
          workbook = XLSX.read(ev.target.result, { type: 'string' });
        } else {
          var data = new Uint8Array(ev.target.result);
          workbook = XLSX.read(data, { type: 'array' });
        }
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          toast('데이터가 없거나 형식이 올바르지 않습니다');
          return;
        }

        // Try to find header row
        var headerRow = rows[0].map(function (h) { return (h || '').toString().trim(); });
        var colMap = {};
        var knownHeaders = {
          '구분': 'category',
          '항목': 'item',
          '세부 항목': 'subitem',
          '세부항목': 'subitem',
          '날짜': 'date',
          '피드백 및 결정': 'feedback',
          '피드백': 'feedback',
          '느낀 점 및 수행해야 할 사항': 'note',
          '느낀 점': 'note',
          '수행해야 할 사항': 'note',
          '레퍼런스': 'ref',
          '참고': 'ref'
        };

        headerRow.forEach(function (h, i) {
          if (knownHeaders[h]) colMap[knownHeaders[h]] = i;
        });

        // Fallback: if no known headers found, use positional mapping
        var useFallback = Object.keys(colMap).length === 0;
        if (useFallback) {
          colMap = { category: 0, item: 1, subitem: 2, date: 3, feedback: 4, note: 5, ref: 6 };
        }

        var startRow = useFallback ? 0 : 1;
        var items = load(JNL_KEY);
        var importCount = 0;

        for (var r = startRow; r < rows.length; r++) {
          var row = rows[r];
          if (!row || row.length === 0) continue;
          // Skip entirely empty rows
          var hasData = row.some(function (cell) { return cell !== undefined && cell !== null && cell.toString().trim() !== ''; });
          if (!hasData) continue;

          var entry = {
            id: uid(),
            category: (row[colMap.category] || '').toString().trim(),
            item: (row[colMap.item] || '').toString().trim(),
            subitem: colMap.subitem !== undefined ? (row[colMap.subitem] || '').toString().trim() : '',
            date: colMap.date !== undefined ? formatExcelDate(row[colMap.date]) : '',
            feedback: colMap.feedback !== undefined ? (row[colMap.feedback] || '').toString().trim() : '',
            note: colMap.note !== undefined ? (row[colMap.note] || '').toString().trim() : '',
            ref: colMap.ref !== undefined ? (row[colMap.ref] || '').toString().trim() : '',
            createdAt: new Date().toISOString()
          };

          if (entry.category || entry.item || entry.subitem) {
            items.push(entry);
            importCount++;
          }
        }

        save(JNL_KEY, items);
        renderJnlTable();
        populateJnlCategoryFilter();
        toast(importCount + '개 항목을 업로드했습니다');
      } catch (err) {
        toast('파일 읽기 실패: ' + err.message);
      }
    };

    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });

  function formatExcelDate(value) {
    if (!value) return '';
    // If it's a number (Excel serial date), convert
    if (typeof value === 'number') {
      var d = new Date((value - 25569) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    // If it's a string, try to parse it
    var str = value.toString().trim();
    // Try ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    // Try Korean format 2024년 3월 15일
    var koMatch = str.match(/(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})/);
    if (koMatch) {
      return koMatch[1] + '-' + koMatch[2].padStart(2, '0') + '-' + koMatch[3].padStart(2, '0');
    }
    return str;
  }

  // ── Init ──
  function init() {
    renderContextList();
    renderIdeaBoard();
    renderMeetingList();
    renderAgendaList();
    renderProposalList();
    populateFolderFilter();
    renderJnlTable();
    populateJnlCategoryFilter();
  }

  init();
})();
