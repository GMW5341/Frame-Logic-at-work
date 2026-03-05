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

  // ── API Cost Tracking ──
  var API_COST_KEY = 'fl_api_cost';
  var COST_RATES = {
    'claude-opus-4-20250514': { input: 15, output: 75 },    // $/M tokens
    'claude-sonnet-4-20250514': { input: 3, output: 15 }
  };
  var sessionCost = { inputTokens: 0, outputTokens: 0, calls: 0, cost: 0 };

  function loadApiCost() {
    try { return JSON.parse(localStorage.getItem(API_COST_KEY)) || { inputTokens: 0, outputTokens: 0, calls: 0, cost: 0 }; }
    catch { return { inputTokens: 0, outputTokens: 0, calls: 0, cost: 0 }; }
  }

  function saveApiCost(data) {
    localStorage.setItem(API_COST_KEY, JSON.stringify(data));
  }

  function trackApiUsage(modelId, usage) {
    if (!usage) return;
    var rates = COST_RATES[modelId] || COST_RATES['claude-sonnet-4-20250514'];
    var costDelta = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1000000;

    // 세션
    sessionCost.inputTokens += usage.input_tokens;
    sessionCost.outputTokens += usage.output_tokens;
    sessionCost.calls += 1;
    sessionCost.cost += costDelta;

    // 누적
    var total = loadApiCost();
    total.inputTokens += usage.input_tokens;
    total.outputTokens += usage.output_tokens;
    total.calls += 1;
    total.cost += costDelta;
    saveApiCost(total);

    updateCostDisplay();
  }

  function updateCostDisplay() {
    var total = loadApiCost();
    var sessionEl = $('#api-cost-session');
    var totalEl = $('#api-cost-total');
    var inputEl = $('#api-cost-input-tokens');
    var outputEl = $('#api-cost-output-tokens');
    var callsEl = $('#api-cost-calls');
    if (sessionEl) sessionEl.textContent = '$' + sessionCost.cost.toFixed(4);
    if (totalEl) totalEl.textContent = '$' + total.cost.toFixed(4);
    if (inputEl) inputEl.textContent = total.inputTokens.toLocaleString();
    if (outputEl) outputEl.textContent = total.outputTokens.toLocaleString();
    if (callsEl) callsEl.textContent = total.calls.toLocaleString();
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
    tmp.querySelectorAll('.re-table-cell-selected').forEach(function (el) {
      el.classList.remove('re-table-cell-selected');
    });
    tmp.querySelectorAll('.re-img-handle, .re-img-delete, .re-img-highlight-btn, .re-img-border-btn').forEach(function (el) { el.remove(); });

    // 하이라이트 캔버스 → 이미지로 변환 (내보내기용)
    tmp.querySelectorAll('.re-img-hl-data').forEach(function (canvas) {
      try {
        var dataUrl = canvas.toDataURL('image/png');
        var hlImg = document.createElement('img');
        hlImg.src = dataUrl;
        hlImg.className = 're-img-hl-data';
        hlImg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
        canvas.parentNode.replaceChild(hlImg, canvas);
      } catch (ex) { canvas.remove(); }
    });

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
      '.re-img-wrap{display:inline-block;position:relative}.re-img{max-width:100%;height:auto}' +
      '.re-img-handle,.re-img-delete,.re-img-highlight-btn,.re-img-border-btn{display:none}' +
      '.re-img-hl-data{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1}' +
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
  var MTG_DRAFT_KEY = 'fl_mtg_draft';

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
    var current = sel.value;
    var folders = getMeetingFolders();
    var html = '<option value="">전체 회의</option>';
    Object.keys(folders).sort().forEach(function (f) {
      html += '<option value="' + escapeHtml(f) + '"' + (f === current ? ' selected' : '') + '>' + escapeHtml(f) + ' (' + folders[f] + ')</option>';
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
  function getMtgSectionText(id) {
    var el = $('#' + id);
    return el ? el.textContent.trim() : '';
  }

  function setMtgSectionText(id, text) {
    var el = $('#' + id);
    if (el) el.textContent = text || '';
  }

  function getMeetingData() {
    return {
      id: currentMtgEditId || uid(),
      type: currentMtgType,
      title: $('#mtg-title').value.trim(),
      date: $('#mtg-date').value,
      attendees: $('#mtg-attendees').value.trim(),
      agenda: mtgAgendaItems.slice(),
      notes: getRich('mtg-notes') ? getRich('mtg-notes').getHTML() : '',
      summary: getMtgSectionText('mtg-sec-summary-body'),
      discussion: getMtgSectionText('mtg-sec-discussion-body'),
      decisions: getMtgSectionText('mtg-sec-decisions-body'),
      actions: getMtgSectionText('mtg-sec-actions-body'),
      followup: getMtgSectionText('mtg-sec-followup-body'),
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
    if (item.summary) text += '## 핵심 요약\n' + item.summary + '\n\n';
    if (item.discussion) text += '## 주요 논의 내용\n' + item.discussion + '\n\n';
    if (item.decisions) text += '## 결정 사항\n' + item.decisions + '\n\n';
    if (item.actions) text += '## 액션 아이템\n' + item.actions + '\n\n';
    if (item.followup) text += '## 후속 조치 사항\n' + item.followup + '\n\n';
    var notes = htmlToText(item.notes);
    if (notes) text += '## 수동 메모\n' + notes + '\n';
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
    // 구조화된 섹션 복원
    setMtgSectionText('mtg-sec-summary-body', item.summary || '');
    setMtgSectionText('mtg-sec-discussion-body', item.discussion || '');
    setMtgSectionText('mtg-sec-decisions-body', item.decisions || '');
    setMtgSectionText('mtg-sec-actions-body', item.actions || '');
    setMtgSectionText('mtg-sec-followup-body', item.followup || '');
  }

  function clearMeetingForm() {
    currentMtgEditId = null;
    var titleEl = $('#mtg-title');
    var attendeesEl = $('#mtg-attendees');
    if (titleEl) titleEl.value = '';
    if (attendeesEl) attendeesEl.value = '';
    mtgAgendaItems = [];
    renderAgendaList();
    try {
      if (getRich('mtg-notes')) getRich('mtg-notes').setHTML('');
    } catch (e) { /* rich editor not yet initialized */ }
    // 구조화 섹션 초기화
    setMtgSectionText('mtg-sec-summary-body', '');
    setMtgSectionText('mtg-sec-discussion-body', '');
    setMtgSectionText('mtg-sec-decisions-body', '');
    setMtgSectionText('mtg-sec-actions-body', '');
    setMtgSectionText('mtg-sec-followup-body', '');
    var dateEl = $('#mtg-date');
    if (dateEl) dateEl.value = nowLocalISO();
    var folderEl = $('#mtg-folder');
    if (folderEl) populateFolderSelect('#mtg-folder', '');
    // 녹음 & AI 요약 초기화
    if (typeof mtgRecordings !== 'undefined') {
      mtgRecordings.forEach(function (r) { if (r.url) URL.revokeObjectURL(r.url); });
      mtgRecordings = [];
    }
    var recContainer = $('#mtg-recordings');
    if (recContainer) recContainer.innerHTML = '';
    var aiResult = $('#mtg-ai-result');
    if (aiResult) aiResult.style.display = 'none';
  }

  // ── 회의 임시 저장 (Draft) ──
  function saveMeetingDraft() {
    // 회의 폼이 열려 있을 때만 저장
    if ($('#mtg-form-view').style.display === 'none') return;
    var draft = {
      type: currentMtgType,
      editId: currentMtgEditId,
      title: ($('#mtg-title') && $('#mtg-title').value) || '',
      date: ($('#mtg-date') && $('#mtg-date').value) || '',
      attendees: ($('#mtg-attendees') && $('#mtg-attendees').value) || '',
      agenda: mtgAgendaItems.slice(),
      notes: getRich('mtg-notes') ? getRich('mtg-notes').getHTML() : '',
      summary: getMtgSectionText('mtg-sec-summary-body'),
      discussion: getMtgSectionText('mtg-sec-discussion-body'),
      decisions: getMtgSectionText('mtg-sec-decisions-body'),
      actions: getMtgSectionText('mtg-sec-actions-body'),
      followup: getMtgSectionText('mtg-sec-followup-body'),
      folder: ($('#mtg-folder') && $('#mtg-folder').value) || '',
      savedAt: Date.now()
    };
    // 내용이 있을 때만 저장
    if (draft.title || htmlToText(draft.notes).trim() || draft.summary || draft.agenda.length) {
      localStorage.setItem(MTG_DRAFT_KEY, JSON.stringify(draft));
    }
  }

  function loadMeetingDraft() {
    try {
      var raw = localStorage.getItem(MTG_DRAFT_KEY);
      if (!raw) return null;
      var draft = JSON.parse(raw);
      // 24시간 이상 된 draft는 무시
      if (draft.savedAt && Date.now() - draft.savedAt > 86400000) {
        localStorage.removeItem(MTG_DRAFT_KEY);
        return null;
      }
      return draft;
    } catch (e) { return null; }
  }

  function restoreMeetingDraft(draft) {
    if (!draft) return;
    currentMtgEditId = draft.editId || null;
    showMtgForm(draft.type || 'regular');
    populateFolderSelect('#mtg-folder', draft.folder || '');
    if ($('#mtg-title')) $('#mtg-title').value = draft.title || '';
    if ($('#mtg-date')) $('#mtg-date').value = draft.date || '';
    if ($('#mtg-attendees')) $('#mtg-attendees').value = draft.attendees || '';
    mtgAgendaItems = Array.isArray(draft.agenda) ? draft.agenda.slice() : [];
    renderAgendaList();
    if (getRich('mtg-notes')) getRich('mtg-notes').setHTML(draft.notes || '');
    setMtgSectionText('mtg-sec-summary-body', draft.summary || '');
    setMtgSectionText('mtg-sec-discussion-body', draft.discussion || '');
    setMtgSectionText('mtg-sec-decisions-body', draft.decisions || '');
    setMtgSectionText('mtg-sec-actions-body', draft.actions || '');
    setMtgSectionText('mtg-sec-followup-body', draft.followup || '');
    toast('임시 저장된 회의를 복원했습니다');
  }

  function clearMeetingDraft() {
    localStorage.removeItem(MTG_DRAFT_KEY);
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
      try {
        var type = card.dataset.mtgType;
        if (!type) return;
        clearMeetingDraft();
        clearMeetingForm();
        showMtgForm(type);
      } catch (err) {
        console.error('회의 유형 선택 오류:', err);
        toast('회의 양식 열기 실패: ' + err.message);
      }
    });
  });

  $('#mtg-back').addEventListener('click', function () {
    saveMeetingDraft();
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
    if (!data.title && !htmlToText(data.notes).trim()) { toast('회의명 또는 내용을 입력해주세요'); return; }
    var items = load(MTG_KEY);
    // If editing existing, replace it
    if (currentMtgEditId) {
      items = items.filter(function (i) { return i.id !== currentMtgEditId; });
    }
    items.unshift(data);
    save(MTG_KEY, items);
    clearMeetingDraft();
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
    if (data.summary) { sheetData.push(['핵심 요약']); sheetData.push([data.summary]); sheetData.push([]); }
    if (data.discussion) { sheetData.push(['주요 논의 내용']); sheetData.push([data.discussion]); sheetData.push([]); }
    if (data.decisions) { sheetData.push(['결정 사항']); sheetData.push([data.decisions]); sheetData.push([]); }
    if (data.actions) { sheetData.push(['액션 아이템']); sheetData.push([data.actions]); sheetData.push([]); }
    if (data.followup) { sheetData.push(['후속 조치 사항']); sheetData.push([data.followup]); sheetData.push([]); }
    var notes = htmlToText(data.notes);
    if (notes) { sheetData.push(['수동 메모']); sheetData.push([notes]); }
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
    if (data.summary) html += '<h2>핵심 요약</h2><div>' + escapeHtml(data.summary).replace(/\n/g, '<br>') + '</div>';
    if (data.discussion) html += '<h2>주요 논의 내용</h2><div>' + escapeHtml(data.discussion).replace(/\n/g, '<br>') + '</div>';
    if (data.decisions) html += '<h2>결정 사항</h2><div>' + escapeHtml(data.decisions).replace(/\n/g, '<br>') + '</div>';
    if (data.actions) html += '<h2>액션 아이템</h2><div>' + escapeHtml(data.actions).replace(/\n/g, '<br>') + '</div>';
    if (data.followup) html += '<h2>후속 조치 사항</h2><div>' + escapeHtml(data.followup).replace(/\n/g, '<br>') + '</div>';
    if (data.notes) html += '<h2>수동 메모</h2><div>' + data.notes + '</div>';
    exportAsPDF(data.title || '회의메모', html);
  });

  // ══════════════════════════════════════
  // 3-B. 음성 녹음 & AssemblyAI STT
  // ══════════════════════════════════════
  var mtgMediaRecorder = null;
  var mtgAudioChunks = [];
  var mtgRecordings = []; // { id, blob, url, duration, transcript, transcribing }
  var mtgRecTimerInterval = null;
  var mtgRecStartTime = 0;

  function formatRecTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function updateRecTimer() {
    var elapsed = Math.floor((Date.now() - mtgRecStartTime) / 1000);
    $('#mtg-rec-timer').textContent = formatRecTime(elapsed);
  }

  function renderRecordings() {
    var container = $('#mtg-recordings');
    if (mtgRecordings.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = mtgRecordings.map(function (rec, i) {
      var statusHtml = '';
      if (rec.transcribing) {
        statusHtml = '<span class="mtg-rec-status-badge transcribing">변환 중...</span>';
      } else if (rec.transcript) {
        statusHtml = '<button class="btn btn-small btn-secondary" data-action="view" title="텍스트 원문 보기">📄 원문 보기</button>';
      }
      return '<div class="mtg-rec-item" data-idx="' + i + '">' +
        '<div class="mtg-rec-item-top">' +
          '<span class="mtg-rec-label">#' + (i + 1) + ' (' + formatRecTime(rec.duration) + ')</span>' +
          '<audio controls src="' + rec.url + '"></audio>' +
          (rec.transcript || rec.transcribing ? '' : '<button class="btn btn-small btn-secondary" data-action="stt" title="텍스트 변환">📝 변환</button>') +
          statusHtml +
          '<button class="btn btn-small btn-ghost" data-action="dl" title="다운로드">💾</button>' +
          '<button class="btn btn-small btn-danger" data-action="del" title="삭제">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // AssemblyAI: 오디오 업로드 → 변환 요청 → 폴링으로 결과 수신
  function assemblyUploadAndTranscribe(blob, recIndex) {
    var settings = loadSettings();
    var apiKey = settings.assemblyKey;
    if (!apiKey) {
      toast('설정에서 AssemblyAI API 키를 입력해주세요');
      $('#settings-overlay').classList.add('active');
      return;
    }

    var rec = mtgRecordings[recIndex];
    if (!rec) return;
    rec.transcribing = true;
    renderRecordings();
    $('#mtg-rec-stt-status').textContent = '변환 중...';

    // Step 1: 오디오 파일 업로드
    fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: blob
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw new Error('업로드 실패 (HTTP ' + res.status + '): ' + body);
        });
      }
      return res.json();
    })
    .then(function (uploadData) {
      if (!uploadData || !uploadData.upload_url) {
        throw new Error('업로드 응답에 upload_url이 없습니다');
      }
      // Step 2: 변환 요청 (한국어는 best/conformer-2 모델만 지원)
      return fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: uploadData.upload_url,
          language_code: 'ko',
          speech_models: ['universal-2'],
          speaker_labels: true
        })
      });
    })
    .then(function (res) {
      if (!res.ok) {
        return res.text().then(function (body) {
          throw new Error('변환 요청 실패 (HTTP ' + res.status + '): ' + body);
        });
      }
      return res.json();
    })
    .then(function (transcriptData) {
      // Step 3: 폴링으로 결과 대기
      return assemblyPollResult(apiKey, transcriptData.id);
    })
    .then(function (result) {
      rec.transcribing = false;

      // 발화자별 utterances가 있으면 발화자별로 구성
      if (result.utterances && result.utterances.length > 0) {
        rec.utterances = result.utterances.map(function (u) {
          return { speaker: u.speaker, text: u.text };
        });
        rec.transcript = result.utterances.map(function (u) {
          return '[' + u.speaker + '] ' + u.text;
        }).join('\n');
      } else {
        rec.utterances = null;
        rec.transcript = result.text || '';
      }
      renderRecordings();
      $('#mtg-rec-stt-status').textContent = '';

      if (rec.transcript) {
        toast('텍스트 변환 완료 — "원문 보기"로 확인하세요');
      } else {
        toast('변환 완료 (인식된 텍스트 없음)');
      }
    })
    .catch(function (err) {
      rec.transcribing = false;
      renderRecordings();
      $('#mtg-rec-stt-status').textContent = '';
      console.error('[AssemblyAI] 변환 오류:', err);
      toast('변환 실패: ' + err.message);
    });
  }

  function assemblyPollResult(apiKey, transcriptId) {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      var maxAttempts = 60; // 최대 5분 (5초 간격 × 60회)

      function poll() {
        fetch('https://api.assemblyai.com/v2/transcript/' + transcriptId, {
          headers: { 'Authorization': apiKey }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.status === 'completed') {
            resolve(data);
          } else if (data.status === 'error') {
            reject(new Error(data.error || '변환 오류'));
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              reject(new Error('변환 시간 초과'));
            } else {
              setTimeout(poll, 5000);
            }
          }
        })
        .catch(reject);
      }

      poll();
    });
  }

  // 녹음 시작/중지 토글
  $('#mtg-rec-btn').addEventListener('click', function () {
    var btn = this;

    // 녹음 중지
    if (mtgMediaRecorder && mtgMediaRecorder.state === 'recording') {
      mtgMediaRecorder.stop();
      clearInterval(mtgRecTimerInterval);
      btn.classList.remove('recording');
      btn.textContent = '🎙 녹음 시작';
      $('#mtg-rec-status').textContent = '';
      return;
    }

    // 녹음 시작 - 마이크 권한 요청
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      mtgAudioChunks = [];
      mtgMediaRecorder = new MediaRecorder(stream);

      mtgMediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) mtgAudioChunks.push(e.data);
      };

      mtgMediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(mtgAudioChunks, { type: 'audio/webm' });
        var url = URL.createObjectURL(blob);
        var duration = Math.floor((Date.now() - mtgRecStartTime) / 1000);

        var rec = { id: uid(), blob: blob, url: url, duration: duration, transcript: '', transcribing: false };
        mtgRecordings.push(rec);
        renderRecordings();

        // AssemblyAI 키가 있으면 자동 변환 시작
        var settings = loadSettings();
        if (settings.assemblyKey) {
          assemblyUploadAndTranscribe(blob, mtgRecordings.length - 1);
          toast('녹음 저장 완료 — 텍스트 변환 시작');
        } else {
          toast('녹음이 저장되었습니다 (변환하려면 📝 변환 클릭)');
        }
      };

      mtgMediaRecorder.start(1000);
      mtgRecStartTime = Date.now();
      mtgRecTimerInterval = setInterval(updateRecTimer, 1000);

      btn.classList.add('recording');
      btn.textContent = '⏹ 중지';
      $('#mtg-rec-status').textContent = '● 녹음 중';
      $('#mtg-rec-timer').textContent = '00:00';

      toast('녹음을 시작합니다');
    }).catch(function (err) {
      toast('마이크 접근 실패: ' + err.message);
    });
  });

  // 녹음 목록 - 변환/다운로드/삭제
  $('#mtg-recordings').addEventListener('click', function (e) {
    var item = e.target.closest('.mtg-rec-item');
    if (!item) return;
    var idx = parseInt(item.dataset.idx, 10);
    var rec = mtgRecordings[idx];
    if (!rec) return;

    if (e.target.closest('[data-action="stt"]')) {
      assemblyUploadAndTranscribe(rec.blob, idx);
    }

    if (e.target.closest('[data-action="dl"]')) {
      var a = document.createElement('a');
      a.href = rec.url;
      a.download = 'recording-' + (idx + 1) + '-' + new Date().toISOString().slice(0, 10) + '.webm';
      a.click();
      toast('녹음 파일 다운로드');
    }

    if (e.target.closest('[data-action="view"]')) {
      openTranscriptPopup(rec, idx);
    }

    if (e.target.closest('[data-action="del"]')) {
      URL.revokeObjectURL(rec.url);
      mtgRecordings.splice(idx, 1);
      renderRecordings();
      toast('녹음이 삭제되었습니다');
    }
  });

  // 텍스트 원문 팝업
  function openTranscriptPopup(rec, idx) {
    var content = $('#mtg-transcript-content');
    if (rec.utterances && rec.utterances.length > 0) {
      content.innerHTML = rec.utterances.map(function (u) {
        return '<div class="mtg-utterance"><span class="mtg-speaker">' + escapeHtml(u.speaker) + ':</span> ' + escapeHtml(u.text) + '</div>';
      }).join('');
    } else {
      content.textContent = rec.transcript || '(텍스트 없음)';
    }
    $('#mtg-transcript-overlay').classList.add('active');
  }

  $('#mtg-transcript-close').addEventListener('click', function () {
    $('#mtg-transcript-overlay').classList.remove('active');
  });

  $('#mtg-transcript-overlay').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
  });

  $('#mtg-transcript-copy').addEventListener('click', function () {
    var content = $('#mtg-transcript-content');
    copyToClipboard(content.textContent);
  });

  // 녹음 파일 업로드 → 텍스트 변환
  $('#mtg-upload-btn').addEventListener('click', function () {
    $('#mtg-upload-input').click();
  });

  $('#mtg-upload-input').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    this.value = ''; // 같은 파일 재선택 허용

    var settings = loadSettings();
    if (!settings.assemblyKey) {
      toast('설정에서 AssemblyAI API 키를 입력해주세요');
      $('#settings-overlay').classList.add('active');
      return;
    }

    var url = URL.createObjectURL(file);
    // 오디오 길이 계산
    var audio = new Audio();
    audio.src = url;
    audio.addEventListener('loadedmetadata', function () {
      var duration = Math.floor(audio.duration) || 0;
      var rec = { id: uid(), blob: file, url: url, duration: duration, transcript: '', transcribing: false };
      mtgRecordings.push(rec);
      renderRecordings();
      // 자동 변환 시작
      assemblyUploadAndTranscribe(file, mtgRecordings.length - 1);
      toast('파일 업로드 완료 — 텍스트 변환 시작');
    });
    audio.addEventListener('error', function () {
      // metadata 로드 실패해도 변환은 시도
      var rec = { id: uid(), blob: file, url: url, duration: 0, transcript: '', transcribing: false };
      mtgRecordings.push(rec);
      renderRecordings();
      assemblyUploadAndTranscribe(file, mtgRecordings.length - 1);
      toast('파일 업로드 완료 — 텍스트 변환 시작');
    });
  });

  // ══════════════════════════════════════
  // 3-C. AI 요약
  // ══════════════════════════════════════
  // 섹션 복사 버튼
  $$('.mtg-sec-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = $(('#' + btn.dataset.target));
      if (target && target.textContent.trim()) copyToClipboard(target.textContent);
    });
  });

  // AI 회의록 분석 → 각 섹션에 자동 배치
  $('#mtg-ai-summary').addEventListener('click', function () {
    var settings = loadSettings();
    if (!settings.apiKey) {
      toast('설정에서 API 키를 입력해주세요');
      $('#settings-overlay').classList.add('active');
      return;
    }

    // 녹음 텍스트 수집
    var recTexts = mtgRecordings.filter(function (r) { return r.transcript; })
      .map(function (r, i) { return '[녹음 #' + (i + 1) + '] ' + r.transcript; }).join('\n');

    // 수동 메모
    var manualNotes = getRich('mtg-notes') ? htmlToText(getRich('mtg-notes').getHTML()).trim() : '';

    var textContent = '';
    var data = getMeetingData();
    if (data.title) textContent += '회의명: ' + data.title + '\n';
    if (data.date) textContent += '일시: ' + formatDate(data.date) + '\n';
    if (data.attendees) textContent += '참석자: ' + data.attendees + '\n';
    if (data.agenda && data.agenda.length) {
      textContent += '안건: ' + data.agenda.join(', ') + '\n';
    }
    if (recTexts) textContent += '\n## 음성 녹음 텍스트\n' + recTexts;
    if (manualNotes) textContent += '\n\n## 수동 메모\n' + manualNotes;

    if (!recTexts && !manualNotes) {
      toast('분석할 녹음 텍스트 또는 메모가 없습니다');
      return;
    }

    var btn = $('#mtg-ai-summary');
    btn.disabled = true;
    btn.innerHTML = '<span class="mtg-ai-spinner"></span> AI 분석 중...';

    // 섹션에 로딩 상태 표시
    var sectionIds = ['mtg-sec-summary', 'mtg-sec-discussion', 'mtg-sec-decisions', 'mtg-sec-actions', 'mtg-sec-followup'];
    sectionIds.forEach(function (id) {
      var sec = $('#' + id);
      if (sec) sec.classList.add('mtg-analyzing');
      var body = $('#' + id + '-body');
      if (body && !body.textContent.trim()) body.setAttribute('data-placeholder', '분석 중...');
    });

    var systemPrompt = '당신은 회의 내용을 구조적으로 분석하는 전문 비서입니다. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력하세요.';
    var userPrompt = '아래 회의 내용을 분석하여 다음 JSON 형식으로 응답해주세요:\n\n' +
      '```json\n{\n' +
      '  "summary": "핵심 요약 (3줄 이내)",\n' +
      '  "discussion": "주요 논의 내용 (불릿 포인트, 줄바꿈으로 구분)",\n' +
      '  "decisions": "결정 사항 (없으면 빈 문자열)",\n' +
      '  "actions": "액션 아이템 (담당자-할일-기한, 줄바꿈으로 구분)",\n' +
      '  "followup": "후속 조치 사항 (줄바꿈으로 구분)"\n' +
      '}\n```\n\n' +
      '각 항목은 마크다운 없이 순수 텍스트로 작성하세요. 불릿은 "• "로 시작하세요.\n\n---\n\n' + textContent;

    var modelId = 'claude-sonnet-4-20250514';
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error && d.error.message || 'API 오류'); });
      return res.json();
    })
    .then(function (respData) {
      trackApiUsage(modelId, respData.usage);
      var raw = respData.content[0].text.trim();
      // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
      var jsonStr = raw;
      var jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      // { 부터 } 까지 추출
      var braceStart = jsonStr.indexOf('{');
      var braceEnd = jsonStr.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd !== -1) {
        jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
      }

      var parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        // JSON 파싱 실패 시 전체 텍스트를 핵심 요약에 넣기
        $('#mtg-sec-summary-body').textContent = raw;
        toast('AI 분석 완료 (구조 파싱 실패, 원문 표시)');
        return;
      }

      // 각 섹션에 배치
      $('#mtg-sec-summary-body').textContent = parsed.summary || '';
      $('#mtg-sec-discussion-body').textContent = parsed.discussion || '';
      $('#mtg-sec-decisions-body').textContent = parsed.decisions || '';
      $('#mtg-sec-actions-body').textContent = parsed.actions || '';
      $('#mtg-sec-followup-body').textContent = parsed.followup || '';

      toast('AI 회의록 분석이 완료되었습니다');
    })
    .catch(function (err) {
      toast('분석 실패: ' + err.message);
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = '🤖 AI 회의록 분석';
      // 로딩 상태 해제
      sectionIds.forEach(function (id) {
        var sec = $('#' + id);
        if (sec) sec.classList.remove('mtg-analyzing');
        var body = $('#' + id + '-body');
        if (body && body.getAttribute('data-placeholder') === '분석 중...') {
          body.setAttribute('data-placeholder', 'AI 분석 후 자동 입력됩니다');
        }
      });
    });
  });

  // ── AI 프롬프트 기본값 ──
  var DEFAULT_JNL_PROMPT =
    '당신은 전략기획팀의 업무일지 작성을 돕는 AI 어시스턴트입니다.\n' +
    '간결하고 실무적인 한국어로 답변하세요.\n' +
    '구체적인 액션 아이템과 인사이트를 중심으로 작성하세요.';

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
        model: 'claude-opus-4-20250514',
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
      trackApiUsage('claude-opus-4-20250514', data.usage);
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
      populateFolderFilter();
      renderMeetingList($('#mtg-folder-filter').value);
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
    $('#setting-assembly-key').value = settings.assemblyKey || '';
    $('#setting-ai-prompt').value = settings.aiPrompt || DEFAULT_AI_PROMPT;
    $('#setting-jnl-prompt').value = settings.jnlPrompt || DEFAULT_JNL_PROMPT;
    $('#api-key-status').textContent = settings.apiKey ? '키가 설정되어 있습니다' : '';
    updateCostDisplay();
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
    var assemblyKey = $('#setting-assembly-key').value.trim();
    var prompt = $('#setting-ai-prompt').value.trim();
    var jnlPrompt = $('#setting-jnl-prompt').value.trim();
    var settings = loadSettings();
    settings.apiKey = key;
    settings.assemblyKey = assemblyKey;
    settings.aiPrompt = prompt || '';
    settings.jnlPrompt = jnlPrompt || '';
    saveSettingsData(settings);
    $('#api-key-status').textContent = key ? '키가 저장되었습니다' : '';
    toast('설정이 저장되었습니다');
  });

  $('#settings-reset-prompt').addEventListener('click', function () {
    $('#setting-ai-prompt').value = DEFAULT_AI_PROMPT;
    toast('회의 분류 프롬프트를 기본값으로 되돌렸습니다');
  });

  $('#settings-reset-jnl-prompt').addEventListener('click', function () {
    $('#setting-jnl-prompt').value = DEFAULT_JNL_PROMPT;
    toast('업무일지 프롬프트를 기본값으로 되돌렸습니다');
  });

  $('#api-cost-reset').addEventListener('click', function () {
    saveApiCost({ inputTokens: 0, outputTokens: 0, calls: 0, cost: 0 });
    updateCostDisplay();
    toast('누적 사용량이 초기화되었습니다');
  });

  $('#settings-clear-key').addEventListener('click', function () {
    var settings = loadSettings();
    settings.apiKey = '';
    settings.assemblyKey = '';
    saveSettingsData(settings);
    $('#setting-api-key').value = '';
    $('#setting-assembly-key').value = '';
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
      getHTML: function () {
        // 저장 전에 하이라이트 캔버스를 img data URL로 변환
        editor.querySelectorAll('canvas.re-img-hl-data').forEach(function (c) {
          try {
            var dataUrl = c.toDataURL('image/png');
            var img = document.createElement('img');
            img.src = dataUrl;
            img.className = 're-img-hl-data';
            c.parentNode.replaceChild(img, c);
          } catch (ex) { c.remove(); }
        });
        return editor.innerHTML === '<br>' ? '' : editor.innerHTML;
      },
      setHTML: function (html) {
        editor.innerHTML = html || '';
        wrapBareImages(editor);
        restoreHighlightCanvases(editor);
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
  function buildImgButtons(wrapper) {
    // 하이라이트 버튼
    if (!wrapper.querySelector('.re-img-highlight-btn')) {
      var hlBtn = document.createElement('button');
      hlBtn.className = 're-img-highlight-btn';
      hlBtn.textContent = '🖍';
      hlBtn.title = '하이라이트 그리기';
      wrapper.appendChild(hlBtn);
    }
    // 테두리 버튼
    if (!wrapper.querySelector('.re-img-border-btn')) {
      var brBtn = document.createElement('button');
      brBtn.className = 're-img-border-btn';
      brBtn.textContent = '▢';
      brBtn.title = '테두리 설정';
      wrapper.appendChild(brBtn);
    }
    // 삭제 버튼
    if (!wrapper.querySelector('.re-img-delete')) {
      var del = document.createElement('button');
      del.className = 're-img-delete';
      del.textContent = '✕';
      del.title = '이미지 삭제';
      wrapper.appendChild(del);
    }
  }

  function wrapBareImages(editor) {
    editor.querySelectorAll('img').forEach(function (img) {
      if (img.closest('.re-img-wrap')) return;
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
      buildImgButtons(wrapper);
      // 기존 하이라이트 캔버스가 있으면 보존
    });
  }

  // 저장된 하이라이트 img를 다시 canvas로 복원 (편집 가능하게)
  function restoreHighlightCanvases(editor) {
    editor.querySelectorAll('img.re-img-hl-data').forEach(function (img) {
      var wrapper = img.closest('.re-img-wrap');
      if (!wrapper) { img.remove(); return; }
      var canvas = document.createElement('canvas');
      canvas.className = 're-img-hl-data';
      var srcImg = new Image();
      srcImg.onload = function () {
        canvas.width = srcImg.naturalWidth;
        canvas.height = srcImg.naturalHeight;
        canvas.getContext('2d').drawImage(srcImg, 0, 0);
      };
      srcImg.src = img.src;
      img.parentNode.replaceChild(canvas, img);
    });
    // 기존 이미지에도 버튼 보장
    editor.querySelectorAll('.re-img-wrap').forEach(function (wrap) {
      buildImgButtons(wrap);
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
      buildImgButtons(wrapper);

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

  // ── 이미지 하이라이트 (드로잉 오버레이) ──
  var activeImgHighlight = null; // { overlay, canvas, ctx, wrapper }

  function openImgHighlight(wrapper) {
    closeImgHighlight();
    var img = wrapper.querySelector('.re-img');
    if (!img) return;

    var overlay = document.createElement('div');
    overlay.className = 're-img-hl-overlay';

    var toolbar = document.createElement('div');
    toolbar.className = 're-img-hl-toolbar';
    toolbar.innerHTML =
      '<span class="re-img-hl-title">하이라이트</span>' +
      '<div class="re-img-hl-colors">' +
        '<button class="re-img-hl-color active" data-hlc="rgba(255,235,59,0.4)" style="background:rgba(255,235,59,0.7)" title="노랑"></button>' +
        '<button class="re-img-hl-color" data-hlc="rgba(76,175,80,0.35)" style="background:rgba(76,175,80,0.6)" title="초록"></button>' +
        '<button class="re-img-hl-color" data-hlc="rgba(244,67,54,0.35)" style="background:rgba(244,67,54,0.6)" title="빨강"></button>' +
        '<button class="re-img-hl-color" data-hlc="rgba(33,150,243,0.35)" style="background:rgba(33,150,243,0.6)" title="파랑"></button>' +
        '<button class="re-img-hl-color" data-hlc="rgba(156,39,176,0.35)" style="background:rgba(156,39,176,0.6)" title="보라"></button>' +
      '</div>' +
      '<label class="re-img-hl-size-label">굵기</label>' +
      '<input type="range" class="re-img-hl-size" min="5" max="40" value="18">' +
      '<button class="re-img-hl-btn" data-hlact="clear" title="전체 지우기">🗑 지우기</button>' +
      '<button class="re-img-hl-btn re-img-hl-done" data-hlact="done">✓ 완료</button>';

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 're-img-hl-canvas-wrap';

    var imgClone = document.createElement('img');
    imgClone.src = img.src;
    imgClone.className = 're-img-hl-preview';
    canvasWrap.appendChild(imgClone);

    var canvas = document.createElement('canvas');
    canvas.className = 're-img-hl-canvas';
    canvasWrap.appendChild(canvas);

    overlay.appendChild(toolbar);
    overlay.appendChild(canvasWrap);
    document.body.appendChild(overlay);

    // 기존 하이라이트 캔버스 데이터 로드
    var existingCanvas = wrapper.querySelector('.re-img-hl-data');

    imgClone.onload = function () {
      canvas.width = imgClone.naturalWidth;
      canvas.height = imgClone.naturalHeight;
      var ctx = canvas.getContext('2d');

      // 기존 하이라이트 복원
      if (existingCanvas) {
        var oldImg = new Image();
        oldImg.onload = function () { ctx.drawImage(oldImg, 0, 0); };
        oldImg.src = existingCanvas.toDataURL();
      }

      activeImgHighlight = { overlay: overlay, canvas: canvas, ctx: ctx, wrapper: wrapper, color: 'rgba(255,235,59,0.4)', size: 18 };
      initHighlightDraw(canvas, ctx, canvasWrap);
    };

    // 색상 선택
    toolbar.addEventListener('click', function (e) {
      var colorBtn = e.target.closest('[data-hlc]');
      var actBtn = e.target.closest('[data-hlact]');
      if (colorBtn) {
        toolbar.querySelectorAll('.re-img-hl-color').forEach(function (b) { b.classList.remove('active'); });
        colorBtn.classList.add('active');
        if (activeImgHighlight) activeImgHighlight.color = colorBtn.dataset.hlc;
      } else if (actBtn) {
        if (actBtn.dataset.hlact === 'clear') {
          var ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
        } else if (actBtn.dataset.hlact === 'done') {
          saveHighlightToImage();
        }
      }
    });

    // 굵기 슬라이더
    toolbar.querySelector('.re-img-hl-size').addEventListener('input', function (e) {
      if (activeImgHighlight) activeImgHighlight.size = parseInt(e.target.value, 10);
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) saveHighlightToImage();
    });
  }

  function initHighlightDraw(canvas, ctx, wrap) {
    var drawing = false;
    var lastX, lastY;

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
      };
    }

    canvas.addEventListener('mousedown', function (e) {
      if (!activeImgHighlight) return;
      drawing = true;
      var p = getPos(e);
      lastX = p.x;
      lastY = p.y;
    });

    canvas.addEventListener('mousemove', function (e) {
      if (!drawing || !activeImgHighlight) return;
      var p = getPos(e);
      ctx.beginPath();
      ctx.strokeStyle = activeImgHighlight.color;
      ctx.lineWidth = activeImgHighlight.size * (canvas.width / canvas.getBoundingClientRect().width);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    });

    var stopDraw = function () { drawing = false; };
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
  }

  function saveHighlightToImage() {
    if (!activeImgHighlight) return;
    var canvas = activeImgHighlight.canvas;
    var wrapper = activeImgHighlight.wrapper;
    var editor = wrapper.closest('.rich-editable');
    if (editor) saveSnapshot(editor);

    // 캔버스에 그려진 내용이 있는지 확인
    var ctx = canvas.getContext('2d');
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var hasContent = false;
    for (var i = 3; i < data.length; i += 4) {
      if (data[i] > 0) { hasContent = true; break; }
    }

    // 기존 하이라이트 캔버스 제거
    var old = wrapper.querySelector('.re-img-hl-data');
    if (old) old.remove();

    if (hasContent) {
      // 하이라이트 데이터를 wrapper 안에 캔버스로 저장
      var savedCanvas = document.createElement('canvas');
      savedCanvas.className = 're-img-hl-data';
      savedCanvas.width = canvas.width;
      savedCanvas.height = canvas.height;
      savedCanvas.getContext('2d').drawImage(canvas, 0, 0);
      wrapper.appendChild(savedCanvas);
    }

    if (editor) saveSnapshotAndNotify(editor);
    closeImgHighlight();
  }

  function closeImgHighlight() {
    if (activeImgHighlight) {
      activeImgHighlight.overlay.remove();
      activeImgHighlight = null;
    }
  }

  // ── 이미지 테두리 설정 ──
  var activeImgBorderPicker = null;

  function openImgBorderPicker(wrapper) {
    closeImgBorderPicker();
    var img = wrapper.querySelector('.re-img');
    if (!img) return;

    var picker = document.createElement('div');
    picker.className = 're-img-border-picker';

    // 현재 상태 읽기
    var curWidth = parseInt(wrapper.dataset.borderWidth, 10) || 0;
    var curColor = wrapper.dataset.borderColor || '';
    var curRadius = parseInt(wrapper.dataset.borderRadius, 10) || 0;
    var curStyle = wrapper.dataset.borderStyle || 'solid';

    picker.innerHTML =
      '<div class="re-img-bp-title">이미지 테두리</div>' +
      '<div class="re-img-bp-section">' +
        '<label>두께</label>' +
        '<div class="re-img-bp-row">' +
          '<button class="re-img-bp-thick' + (curWidth === 0 ? ' active' : '') + '" data-bw="0">없음</button>' +
          '<button class="re-img-bp-thick' + (curWidth === 2 ? ' active' : '') + '" data-bw="2">얇게</button>' +
          '<button class="re-img-bp-thick' + (curWidth === 4 ? ' active' : '') + '" data-bw="4">보통</button>' +
          '<button class="re-img-bp-thick' + (curWidth === 6 ? ' active' : '') + '" data-bw="6">굵게</button>' +
        '</div>' +
      '</div>' +
      '<div class="re-img-bp-section">' +
        '<label>스타일</label>' +
        '<div class="re-img-bp-row">' +
          '<button class="re-img-bp-style' + (curStyle === 'solid' ? ' active' : '') + '" data-bs="solid">실선</button>' +
          '<button class="re-img-bp-style' + (curStyle === 'dashed' ? ' active' : '') + '" data-bs="dashed">점선</button>' +
          '<button class="re-img-bp-style' + (curStyle === 'double' ? ' active' : '') + '" data-bs="double">이중선</button>' +
        '</div>' +
      '</div>' +
      '<div class="re-img-bp-section">' +
        '<label>색상</label>' +
        '<div class="re-img-bp-colors">' +
          '<button class="re-img-bp-color" data-bc="#333" style="background:#333"></button>' +
          '<button class="re-img-bp-color" data-bc="#3b82f6" style="background:#3b82f6"></button>' +
          '<button class="re-img-bp-color" data-bc="#ef4444" style="background:#ef4444"></button>' +
          '<button class="re-img-bp-color" data-bc="#22c55e" style="background:#22c55e"></button>' +
          '<button class="re-img-bp-color" data-bc="#f59e0b" style="background:#f59e0b"></button>' +
          '<button class="re-img-bp-color" data-bc="#a855f7" style="background:#a855f7"></button>' +
          '<button class="re-img-bp-color" data-bc="#fff" style="background:#fff;border:1px solid #ccc"></button>' +
        '</div>' +
      '</div>' +
      '<div class="re-img-bp-section">' +
        '<label>둥글기</label>' +
        '<input type="range" class="re-img-bp-radius" min="0" max="50" value="' + curRadius + '">' +
      '</div>';

    function applyBorder() {
      var w = parseInt(wrapper.dataset.borderWidth, 10) || 0;
      var c = wrapper.dataset.borderColor || '#333';
      var r = parseInt(wrapper.dataset.borderRadius, 10) || 0;
      var s = wrapper.dataset.borderStyle || 'solid';
      if (w > 0) {
        img.style.border = w + 'px ' + s + ' ' + c;
      } else {
        img.style.border = 'none';
      }
      img.style.borderRadius = r > 0 ? r + 'px' : '';
    }

    picker.addEventListener('click', function (e) {
      var bw = e.target.closest('[data-bw]');
      var bs = e.target.closest('[data-bs]');
      var bc = e.target.closest('[data-bc]');
      if (bw) {
        wrapper.dataset.borderWidth = bw.dataset.bw;
        picker.querySelectorAll('.re-img-bp-thick').forEach(function (b) { b.classList.remove('active'); });
        bw.classList.add('active');
        if (!wrapper.dataset.borderColor) wrapper.dataset.borderColor = '#333';
        applyBorder();
      } else if (bs) {
        wrapper.dataset.borderStyle = bs.dataset.bs;
        picker.querySelectorAll('.re-img-bp-style').forEach(function (b) { b.classList.remove('active'); });
        bs.classList.add('active');
        applyBorder();
      } else if (bc) {
        wrapper.dataset.borderColor = bc.dataset.bc;
        applyBorder();
      }
    });

    picker.querySelector('.re-img-bp-radius').addEventListener('input', function (e) {
      wrapper.dataset.borderRadius = e.target.value;
      applyBorder();
    });

    var rect = wrapper.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 6) + 'px';
    picker.style.left = rect.left + 'px';
    picker.style.zIndex = '10000';
    document.body.appendChild(picker);
    activeImgBorderPicker = picker;

    requestAnimationFrame(function () {
      var pr = picker.getBoundingClientRect();
      if (pr.right > window.innerWidth) picker.style.left = (window.innerWidth - pr.width - 8) + 'px';
      if (pr.bottom > window.innerHeight) picker.style.top = (rect.top - pr.height - 6) + 'px';
    });

    setTimeout(function () {
      document.addEventListener('mousedown', closeImgBorderPickerOutside);
    }, 0);
  }

  function closeImgBorderPickerOutside(e) {
    if (activeImgBorderPicker && !activeImgBorderPicker.contains(e.target) && !e.target.closest('.re-img-border-btn')) {
      closeImgBorderPicker();
    }
  }

  function closeImgBorderPicker() {
    if (activeImgBorderPicker) {
      activeImgBorderPicker.remove();
      activeImgBorderPicker = null;
      document.removeEventListener('mousedown', closeImgBorderPickerOutside);
    }
  }

  // 이미지 버튼 클릭 핸들러 (전역 위임)
  document.addEventListener('click', function (e) {
    if (e.target.closest('.re-img-highlight-btn')) {
      e.preventDefault();
      e.stopPropagation();
      var wrap = e.target.closest('.re-img-wrap');
      if (wrap) openImgHighlight(wrap);
    }
    if (e.target.closest('.re-img-border-btn')) {
      e.preventDefault();
      e.stopPropagation();
      var wrap2 = e.target.closest('.re-img-wrap');
      if (wrap2) openImgBorderPicker(wrap2);
    }
  });

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

    // 드래그 중 삽입 위치 커서 표시
    var dropCaret = document.createElement('span');
    dropCaret.className = 're-img-drop-caret';

    function removeDropCaret() { if (dropCaret.parentNode) dropCaret.remove(); }

    function getCaretRange(x, y) {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
      if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(x, y);
        if (pos) { var r = document.createRange(); r.setStart(pos.offsetNode, pos.offset); r.collapse(true); return r; }
      }
      return null;
    }

    document.addEventListener('dragover', function (e) {
      if (!dragging) return;
      var editor = dragging.editor;
      if (!editor.contains(e.target) && e.target !== editor) { removeDropCaret(); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // 삽입 위치에 캐럿 바 표시
      var range = getCaretRange(e.clientX, e.clientY);
      if (range && editor.contains(range.startContainer)) {
        removeDropCaret();
        range.insertNode(dropCaret);
      }
    });

    document.addEventListener('dragleave', function (e) {
      if (!dragging) return;
      if (e.target === dragging.editor || !dragging.editor.contains(e.relatedTarget)) {
        removeDropCaret();
      }
    });

    document.addEventListener('drop', function (e) {
      if (!dragging) return;
      e.preventDefault();
      removeDropCaret();
      var editor = dragging.editor;
      var wrap = dragging.wrapper;
      saveSnapshot(editor);

      // 캐럿 위치에 삽입
      var caretRange = getCaretRange(e.clientX, e.clientY);

      // 먼저 기존 위치에서 제거
      wrap.remove();

      if (caretRange && editor.contains(caretRange.startContainer)) {
        caretRange.insertNode(wrap);
      } else {
        editor.appendChild(wrap);
      }

      wrap.classList.remove('dragging-img');
      saveSnapshotAndNotify(editor);
      dragging = null;
    });

    document.addEventListener('dragend', function () {
      removeDropCaret();
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
  // 7.5  할 일 목록 탭
  // ══════════════════════════════════════
  var TASKS_KEY = 'fl_tasks';
  var STAGE_LABELS = { todo: '진행 전', in_progress: '진행 중', review: '검토', done: '완료' };

  function loadTasks() {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveTasks(list) { localStorage.setItem(TASKS_KEY, JSON.stringify(list)); }

  function getTaskDate() {
    return $('#task-date').value || new Date().toISOString().slice(0, 10);
  }
  function setTaskDate(d) {
    $('#task-date').value = d;
    renderTaskList();
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  // 초기 날짜 설정
  (function () {
    $('#task-date').value = todayStr();
  })();

  function getTasksForDate(date) {
    var all = loadTasks();
    return all.filter(function (t) { return t.date === date; });
  }

  // 마감일 뱃지 HTML
  function dueBadgeHtml(task) {
    if (!task.dueDate) return '';
    var today = todayStr();
    var overdue = !task.done && task.stage !== 'done' && task.dueDate < today;
    return '<span class="task-due' + (overdue ? ' task-overdue' : '') + '">' + task.dueDate + '</span>';
  }

  // 단계 뱃지 HTML
  function stageBadgeHtml(stage) {
    var s = stage || 'todo';
    return '<span class="task-stage-badge task-stage-' + s + '">' + (STAGE_LABELS[s] || s) + '</span>';
  }

  function renderTaskList() {
    var date = getTaskDate();
    var allTasks = loadTasks();
    var tasks = allTasks.filter(function (t) { return t.date === date; });
    var showDone = $('#task-show-done').checked;
    var container = $('#task-list');

    // 진행률 업데이트 (done 단계 기준)
    var total = tasks.length;
    var done = tasks.filter(function (t) { return t.done || t.stage === 'done'; }).length;
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    $('#task-progress-fill').style.width = pct + '%';
    $('#task-progress-text').textContent = done + '/' + total + ' (' + pct + '%)';

    if (tasks.length === 0) {
      container.innerHTML = '<div class="task-empty">할 일이 없습니다. 새 할 일을 추가해보세요!</div>';
      return;
    }

    // 우선순위 순서 정렬: urgent > high > normal, 미완료 먼저
    var priorityOrder = { urgent: 0, high: 1, normal: 2 };
    var stageOrder = { in_progress: 0, review: 1, todo: 2, done: 3 };
    var sorted = tasks.slice().sort(function (a, b) {
      var da = (a.done || a.stage === 'done') ? 1 : 0;
      var db = (b.done || b.stage === 'done') ? 1 : 0;
      if (da !== db) return da - db;
      var sa = stageOrder[a.stage] !== undefined ? stageOrder[a.stage] : 2;
      var sb = stageOrder[b.stage] !== undefined ? stageOrder[b.stage] : 2;
      if (sa !== sb) return sa - sb;
      var pa = priorityOrder[a.priority] || 2;
      var pb = priorityOrder[b.priority] || 2;
      if (pa !== pb) return pa - pb;
      return (a.order || 0) - (b.order || 0);
    });

    var html = '';
    sorted.forEach(function (task) {
      var isDone = task.done || task.stage === 'done';
      if (!showDone && isDone) return;
      var priClass = 'task-pri-' + (task.priority || 'normal');
      var doneClass = isDone ? ' task-item-done' : '';
      var priLabel = task.priority === 'urgent' ? '\uD83D\uDD34' : task.priority === 'high' ? '\uD83D\uDFE0' : '';

      html += '<div class="task-item' + doneClass + '" data-id="' + task.id + '" draggable="true">' +
        '<div class="task-item-left">' +
          '<input type="checkbox" class="task-check" data-id="' + task.id + '"' + (isDone ? ' checked' : '') + '>' +
          '<span class="task-pri-dot ' + priClass + '">' + priLabel + '</span>' +
        '</div>' +
        '<div class="task-item-center">' +
          '<span class="task-item-text" data-id="' + task.id + '">' + escapeHtml(task.text) + '</span>' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            stageBadgeHtml(task.stage) +
            dueBadgeHtml(task) +
            (task.memo ? '<span class="task-item-memo">' + escapeHtml(task.memo) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="task-item-right">' +
          '<button class="task-action-btn" data-action="edit" data-id="' + task.id + '" title="편집">✏</button>' +
          '<button class="task-action-btn" data-action="copy-tomorrow" data-id="' + task.id + '" title="내일로 복사">➡</button>' +
          '<button class="task-action-btn task-del-btn" data-action="del" data-id="' + task.id + '" title="삭제">✕</button>' +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    // ── 드래그 정렬 ──
    var dragItem = null;
    container.querySelectorAll('.task-item').forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        dragItem = item;
        item.classList.add('task-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('task-dragging');
        dragItem = null;
        var items = container.querySelectorAll('.task-item');
        var allT = loadTasks();
        items.forEach(function (el, idx) {
          var t = allT.find(function (x) { return x.id === el.dataset.id; });
          if (t) t.order = idx;
        });
        saveTasks(allT);
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (!dragItem || dragItem === item) return;
        var rect = item.getBoundingClientRect();
        var mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          container.insertBefore(dragItem, item);
        } else {
          container.insertBefore(dragItem, item.nextSibling);
        }
      });
    });
  }

  // 새 할 일 추가
  function addTask() {
    var input = $('#task-add-input');
    var text = input.value.trim();
    if (!text) return;
    var priority = $('#task-add-priority').value;
    var stage = $('#task-add-stage').value;
    var dueDate = $('#task-add-due').value || '';
    var date = getTaskDate();
    var all = loadTasks();
    var dateItems = all.filter(function (t) { return t.date === date; });
    all.push({
      id: 'task-' + uid(),
      text: text,
      date: date,
      priority: priority,
      stage: stage,
      dueDate: dueDate,
      done: false,
      memo: '',
      order: dateItems.length,
      createdAt: new Date().toISOString()
    });
    saveTasks(all);
    input.value = '';
    $('#task-add-priority').value = 'normal';
    $('#task-add-stage').value = 'todo';
    $('#task-add-due').value = '';
    renderTaskList();
  }

  $('#task-add-btn').addEventListener('click', addTask);
  $('#task-add-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addTask(); }
  });

  // 날짜 이동
  $('#task-date').addEventListener('change', renderTaskList);
  $('#task-prev-day').addEventListener('click', function () {
    var d = new Date($('#task-date').value || new Date());
    d.setDate(d.getDate() - 1);
    setTaskDate(d.toISOString().slice(0, 10));
  });
  $('#task-next-day').addEventListener('click', function () {
    var d = new Date($('#task-date').value || new Date());
    d.setDate(d.getDate() + 1);
    setTaskDate(d.toISOString().slice(0, 10));
  });
  $('#task-today').addEventListener('click', function () {
    setTaskDate(todayStr());
  });

  // 완료 체크 / 삭제 / 편집 / 내일로 복사
  $('#task-list').addEventListener('change', function (e) {
    if (e.target.classList.contains('task-check')) {
      var id = e.target.dataset.id;
      var all = loadTasks();
      var t = all.find(function (x) { return x.id === id; });
      if (t) {
        var checked = e.target.checked;
        t.done = checked;
        t.stage = checked ? 'done' : 'todo';
        saveTasks(all);
        renderTaskList();
      }
    }
  });

  $('#task-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.task-action-btn');
    if (!btn) return;
    var action = btn.dataset.action;
    var id = btn.dataset.id;
    var all = loadTasks();

    if (action === 'del') {
      saveTasks(all.filter(function (x) { return x.id !== id; }));
      renderTaskList();
      toast('삭제되었습니다');
    } else if (action === 'copy-tomorrow') {
      var t = all.find(function (x) { return x.id === id; });
      if (t) {
        var tmr = new Date(t.date);
        tmr.setDate(tmr.getDate() + 1);
        var tDate = tmr.toISOString().slice(0, 10);
        all.push({
          id: 'task-' + uid(),
          text: t.text,
          date: tDate,
          priority: t.priority,
          stage: t.stage === 'done' ? 'todo' : t.stage,
          dueDate: t.dueDate || '',
          done: false,
          memo: t.memo,
          order: all.filter(function (x) { return x.date === tDate; }).length,
          createdAt: new Date().toISOString()
        });
        saveTasks(all);
        toast('내일(' + tDate + ')으로 복사되었습니다');
      }
    } else if (action === 'edit') {
      openTaskEditDialog(id);
    }
  });

  // 텍스트 클릭 → 빠른 인라인 편집
  $('#task-list').addEventListener('dblclick', function (e) {
    var textEl = e.target.closest('.task-item-text');
    if (!textEl) return;
    var id = textEl.dataset.id;
    var all = loadTasks();
    var t = all.find(function (x) { return x.id === id; });
    if (!t) return;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-inline-edit';
    input.value = t.text;
    textEl.replaceWith(input);
    input.focus();
    input.select();
    function save() {
      var nv = input.value.trim();
      if (nv && nv !== t.text) {
        t.text = nv;
        saveTasks(all);
      }
      renderTaskList();
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); save(); }
      if (ev.key === 'Escape') { renderTaskList(); }
    });
  });

  // 편집 다이얼로그
  function openTaskEditDialog(id) {
    var all = loadTasks();
    var t = all.find(function (x) { return x.id === id; });
    if (!t) return;

    var overlay = document.createElement('div');
    overlay.className = 'jnl-link-overlay';
    var dialog = document.createElement('div');
    dialog.className = 'jnl-link-dialog';
    dialog.style.width = '420px';

    function stageOpt(val, label) {
      return '<option value="' + val + '"' + ((t.stage || 'todo') === val ? ' selected' : '') + '>' + label + '</option>';
    }

    dialog.innerHTML =
      '<div class="jnl-link-title">할 일 편집</div>' +
      '<label style="font-size:0.8rem;color:var(--text-muted);margin-bottom:2px;display:block">할 일</label>' +
      '<input type="text" class="jnl-link-input" id="task-edit-text" value="' + escapeHtml(t.text) + '">' +
      '<label style="font-size:0.8rem;color:var(--text-muted);margin-bottom:2px;display:block">메모</label>' +
      '<textarea class="jnl-link-input" id="task-edit-memo" rows="3" style="resize:vertical">' + escapeHtml(t.memo || '') + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        '<div style="flex:1"><label style="font-size:0.8rem;color:var(--text-muted)">우선순위</label>' +
          '<select class="task-priority-select" id="task-edit-priority" style="width:100%">' +
            '<option value="normal"' + (t.priority === 'normal' ? ' selected' : '') + '>보통</option>' +
            '<option value="high"' + (t.priority === 'high' ? ' selected' : '') + '>높음</option>' +
            '<option value="urgent"' + (t.priority === 'urgent' ? ' selected' : '') + '>긴급</option>' +
          '</select></div>' +
        '<div style="flex:1"><label style="font-size:0.8rem;color:var(--text-muted)">진행 단계</label>' +
          '<select class="task-stage-select" id="task-edit-stage" style="width:100%">' +
            stageOpt('todo', '진행 전') +
            stageOpt('in_progress', '진행 중') +
            stageOpt('review', '검토') +
            stageOpt('done', '완료') +
          '</select></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:8px">' +
        '<div style="flex:1"><label style="font-size:0.8rem;color:var(--text-muted)">날짜</label>' +
          '<input type="date" class="jnl-link-input" id="task-edit-date" value="' + t.date + '" style="margin-bottom:0"></div>' +
        '<div style="flex:1"><label style="font-size:0.8rem;color:var(--text-muted)">마감일</label>' +
          '<input type="date" class="jnl-link-input" id="task-edit-due" value="' + (t.dueDate || '') + '" style="margin-bottom:0"></div>' +
      '</div>' +
      '<div class="jnl-link-btns">' +
        '<button class="btn btn-small btn-ghost" id="task-edit-cancel">취소</button>' +
        '<button class="btn btn-small btn-primary" id="task-edit-save">저장</button>' +
      '</div>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector('#task-edit-text').focus();

    function doClose() { if (overlay.parentNode) overlay.remove(); }
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) doClose(); });
    dialog.querySelector('#task-edit-cancel').addEventListener('click', doClose);

    dialog.querySelector('#task-edit-save').addEventListener('click', function () {
      var nText = dialog.querySelector('#task-edit-text').value.trim();
      if (!nText) return;
      t.text = nText;
      t.memo = dialog.querySelector('#task-edit-memo').value.trim();
      t.priority = dialog.querySelector('#task-edit-priority').value;
      t.stage = dialog.querySelector('#task-edit-stage').value;
      t.date = dialog.querySelector('#task-edit-date').value;
      t.dueDate = dialog.querySelector('#task-edit-due').value || '';
      t.done = t.stage === 'done';
      saveTasks(all);
      doClose();
      renderTaskList();
      toast('수정되었습니다');
    });

    dialog.querySelector('#task-edit-text').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); dialog.querySelector('#task-edit-save').click(); }
      if (ev.key === 'Escape') doClose();
    });
  }

  // 완료 항목 보기 토글
  $('#task-show-done').addEventListener('change', renderTaskList);

  // ── 뷰 토글 (일간 / 히스토리) ──
  document.querySelectorAll('.task-view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.task-view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var view = btn.dataset.view;
      $('#task-daily-view').style.display = view === 'daily' ? '' : 'none';
      $('#task-history-view').style.display = view === 'history' ? '' : 'none';
      if (view === 'history') renderTaskHistory();
    });
  });

  // ── 히스토리 뷰 렌더링 ──
  function renderTaskHistory() {
    var all = loadTasks();
    var search = ($('#task-history-search').value || '').trim().toLowerCase();
    var stageFilter = $('#task-history-stage-filter').value;

    // 필터링
    var filtered = all.filter(function (t) {
      if (stageFilter !== 'all') {
        var ts = t.stage || (t.done ? 'done' : 'todo');
        if (ts !== stageFilter) return false;
      }
      if (search && t.text.toLowerCase().indexOf(search) === -1 &&
          (t.memo || '').toLowerCase().indexOf(search) === -1) return false;
      return true;
    });

    // 날짜별 그룹핑 (최신 날짜 먼저)
    var groups = {};
    filtered.forEach(function (t) {
      var d = t.date || 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    var dates = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });

    var container = $('#task-history-list');
    if (dates.length === 0) {
      container.innerHTML = '<div class="task-history-empty">일치하는 항목이 없습니다.</div>';
      return;
    }

    var html = '';
    dates.forEach(function (date) {
      var items = groups[date];
      html += '<div class="task-history-date-group">';
      html += '<div class="task-history-date-header">' + date + ' (' + items.length + '건)</div>';
      items.forEach(function (task) {
        var isDone = task.done || task.stage === 'done';
        html += '<div class="task-history-item' + (isDone ? ' task-history-item-done' : '') + '" data-id="' + task.id + '">' +
          stageBadgeHtml(task.stage || (task.done ? 'done' : 'todo')) +
          '<span class="task-history-item-text">' + escapeHtml(task.text) + '</span>' +
          dueBadgeHtml(task) +
        '</div>';
      });
      html += '</div>';
    });

    container.innerHTML = html;

    // 히스토리 아이템 클릭 → 편집 다이얼로그
    container.querySelectorAll('.task-history-item').forEach(function (el) {
      el.addEventListener('click', function () {
        openTaskEditDialog(el.dataset.id);
      });
    });
  }

  // 히스토리 필터 이벤트
  $('#task-history-search').addEventListener('input', renderTaskHistory);
  $('#task-history-stage-filter').addEventListener('change', renderTaskHistory);

  // ══════════════════════════════════════
  // 7.8  도식화 탭 (AI 시각화)
  // ══════════════════════════════════════
  var DG_KEY = 'fl_diagrams';
  var dgLastCode = '';
  var dgLastPrompt = '';

  // Mermaid 초기화 (AI가 Mermaid 코드를 생성할 때 사용)
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true }
    });
  }

  function loadDiagrams() {
    try { return JSON.parse(localStorage.getItem(DG_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveDiagrams(list) { localStorage.setItem(DG_KEY, JSON.stringify(list)); }

  // ── 렌더링 ──
  function renderDgResult(code, targetEl) {
    // Mermaid 코드인지 HTML인지 자동 판별
    var trimmed = code.trim();
    var isMermaid = /^(graph |flowchart |sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie |mindmap|journey|gitGraph)/m.test(trimmed);

    if (isMermaid && typeof mermaid !== 'undefined') {
      var elId = 'dg-m-' + Date.now();
      mermaid.render(elId, trimmed).then(function (result) {
        targetEl.innerHTML = '<div class="dg-rendered-svg">' + result.svg + '</div>';
      }).catch(function () {
        renderDgHtml(trimmed, targetEl);
      });
    } else {
      renderDgHtml(trimmed, targetEl);
    }
  }

  function renderDgHtml(html, targetEl) {
    var iframe = document.createElement('iframe');
    iframe.className = 'dg-html-iframe';
    iframe.sandbox = 'allow-scripts';
    targetEl.innerHTML = '';
    targetEl.appendChild(iframe);
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#1a1a2e;line-height:1.5}</style></head><body>' + html + '</body></html>');
    doc.close();
    iframe.onload = function () {
      try {
        var h = Math.min(800, Math.max(250, doc.body.scrollHeight + 50));
        iframe.style.height = h + 'px';
      } catch (e) {}
    };
    setTimeout(function () {
      try {
        var h = Math.min(800, Math.max(250, doc.body.scrollHeight + 50));
        iframe.style.height = h + 'px';
      } catch (e) {}
    }, 500);
  }

  // ── 워크스페이스 데이터 수집 ──
  function collectDgContext() {
    var parts = [];
    if ($('#dg-ai-use-journal').checked) {
      var jItems = (function () { try { return JSON.parse(localStorage.getItem('fl_journal')) || []; } catch (e) { return []; } })();
      if (jItems.length > 0) {
        var cols = (function () { try { return JSON.parse(localStorage.getItem('fl_journal_columns')); } catch (e) { return null; } })();
        var jText = jItems.slice(0, 20).map(function (e) {
          return Object.keys(e).filter(function (k) { return k !== 'id' && k !== 'attachments' && e[k]; })
            .map(function (k) {
              var v = e[k] || '';
              if (typeof v === 'string' && v.indexOf('<') !== -1) v = v.replace(/<[^>]+>/g, '').trim();
              var label = k;
              if (cols) { var c = cols.find(function (x) { return x.key === k; }); if (c) label = c.label; }
              return label + ': ' + v;
            }).join(' | ');
        }).join('\n');
        parts.push('\uC5C5\uBB34\uC77C\uC9C0 \uB370\uC774\uD130 (' + jItems.length + '\uAC74):\n' + jText);
      }
    }
    if ($('#dg-ai-use-meeting').checked) {
      var mItems = (function () { try { return JSON.parse(localStorage.getItem('fl_meetings')) || []; } catch (e) { return []; } })();
      if (mItems.length > 0) {
        var mText = mItems.slice(0, 10).map(function (m) {
          var content = (m.content || '').replace(/<[^>]+>/g, '').substring(0, 500);
          return '\uC81C\uBAA9: ' + (m.title || '') + '\n' + content;
        }).join('\n---\n');
        parts.push('\uD68C\uC758\uB85D (' + mItems.length + '\uAC74):\n' + mText);
      }
    }
    if ($('#dg-ai-use-context').checked) {
      var cItems = (function () { try { return JSON.parse(localStorage.getItem('fl_contexts')) || []; } catch (e) { return []; } })();
      if (cItems.length > 0) {
        var cText = cItems.slice(0, 5).map(function (c) {
          var content = (c.content || '').replace(/<[^>]+>/g, '').substring(0, 500);
          return '\uC81C\uBAA9: ' + (c.title || '') + '\n' + content;
        }).join('\n---\n');
        parts.push('AI \uCEE8\uD14D\uC2A4\uD2B8 (' + cItems.length + '\uAC74):\n' + cText);
      }
    }
    if ($('#dg-ai-use-tasks').checked) {
      var tItems = (function () { try { return JSON.parse(localStorage.getItem('fl_tasks')) || []; } catch (e) { return []; } })();
      if (tItems.length > 0) {
        var tText = tItems.slice(0, 30).map(function (t) {
          return (t.done ? '\u2705' : '\u2B1C') + ' [' + (t.priority || 'normal') + '] ' + t.text + ' (' + t.date + ')';
        }).join('\n');
        parts.push('\uD560 \uC77C \uBAA9\uB85D (' + tItems.length + '\uAC74):\n' + tText);
      }
    }
    return parts.join('\n\n');
  }

  // ── 고품질 시스템 프롬프트 ──
  var DG_SYSTEM_PROMPT =
    '\uB2F9\uC2E0\uC740 \uC804\uBB38\uC801\uC778 \uC815\uBCF4 \uC2DC\uAC01\uD654 \uB514\uC790\uC774\uB108\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uC758 \uC694\uCCAD\uC744 \uC544\uB984\uB2F5\uACE0 \uC804\uBB38\uC801\uC778 \uB2E4\uC774\uC5B4\uADF8\uB7A8/\uCC28\uD2B8/\uC2DC\uAC01\uD654\uB85C \uBCC0\uD658\uD569\uB2C8\uB2E4.\n\n' +
    '\uADDC\uCE59:\n' +
    '1. \uC21C\uC218 HTML+\uC778\uB77C\uC778 CSS+\uC778\uB77C\uC778 SVG\uB9CC \uC0AC\uC6A9. \uC678\uBD80 \uB77C\uC774\uBE0C\uB7EC\uB9AC/\uD3F0\uD2B8/\uC774\uBBF8\uC9C0 \uC808\uB300 \uBD88\uAC00.\n' +
    '2. \uBAA8\uB358 CSS \uC0AC\uC6A9: flexbox, grid, linear-gradient, border-radius, box-shadow, \uBC18\uC751\uD615.\n' +
    '3. \uC804\uBB38\uC801 \uCEEC\uB7EC \uD314\uB808\uD2B8: \uC870\uD654\uB85C\uC6B4 \uC0C9\uC0C1 \uC870\uD569. \uBC30\uACBD #f8f9fa~#fff, \uAC15\uC870\uC0C9 \uD30C\uB780/\uBCF4\uB77C/\uCD08\uB85D \uACC4\uC5F4.\n' +
    '4. \uD55C\uAE00 \uC0AC\uC6A9. \uD0C0\uC774\uD2C0, \uB808\uC774\uBE14, \uC124\uBA85 \uBAA8\uB450 \uD55C\uAE00.\n' +
    '5. SVG \uC544\uC774\uCF58/\uB3C4\uD615\uC744 \uC801\uADF9 \uD65C\uC6A9\uD558\uC5EC \uC2DC\uAC01\uC801 \uD488\uC9C8\uC744 \uB192\uC774\uC138\uC694.\n' +
    '6. \uCDA9\uBD84\uD55C \uD06C\uAE30\uB85C \uB9CC\uB4DC\uC138\uC694. \uC791\uAC8C \uB9CC\uB4E4\uC9C0 \uB9C8\uC138\uC694.\n' +
    '7. <html>, <head>, <body> \uD0DC\uADF8 \uC5C6\uC774 body \uC548\uC5D0 \uB4E4\uC5B4\uAC08 \uCF54\uB4DC\uB9CC \uCD9C\uB825.\n' +
    '8. \uBD80\uAC00 \uC124\uBA85/\uC8FC\uC11D \uC5C6\uC774 \uCF54\uB4DC\uB9CC \uCD9C\uB825.\n' +
    '9. \uCF54\uB4DC \uBE14\uB85D(\u0060\u0060\u0060) \uC5C6\uC774 \uC21C\uC218 HTML\uB9CC \uCD9C\uB825.';

  // ── 템플릿 프롬프트 ──
  var DG_TPL_PROMPTS = {
    workflow: '\uC5C5\uBB34 \uD504\uB85C\uC138\uC2A4 \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uD654\uC0B4\uD45C\uB85C \uC5F0\uACB0\uB41C \uB2E8\uACC4\uBCC4 \uD50C\uB85C\uC6B0\uCC28\uD2B8. \uAC01 \uB2E8\uACC4\uB294 \uB465\uADFC \uC0C1\uC790\uB85C \uD45C\uD604.',
    process: '\uBE44\uC988\uB2C8\uC2A4 \uD504\uB85C\uC138\uC2A4 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uBC88\uD638\uAC00 \uB9E4\uACA8\uC9C4 \uB2E8\uACC4\uBCC4 \uD504\uB85C\uC138\uC2A4 \uCE74\uB4DC\uC640 \uD654\uC0B4\uD45C.',
    timeline: '\uD0C0\uC784\uB77C\uC778 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uC218\uD3C9 \uB610\uB294 \uC218\uC9C1 \uD0C0\uC784\uB77C\uC778\uC73C\uB85C \uB0A0\uC9DC/\uC774\uBCA4\uD2B8\uB97C \uD45C\uC2DC.',
    orgchart: '\uC870\uC9C1\uB3C4/\uACC4\uCE35 \uAD6C\uC870 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uD2B8\uB9AC \uAD6C\uC870\uB85C \uC0C1\uD558 \uAD00\uACC4\uB97C \uD45C\uD604.',
    comparison: '\uBE44\uAD50 \uBD84\uC11D\uD45C\uB97C \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uC544\uC774\uD15C\uB4E4\uC744 \uB098\uB780\uD788 \uB193\uACE0 \uD56D\uBAA9\uBCC4\uB85C \uBE44\uAD50\uD558\uB294 \uCE74\uB4DC \uB808\uC774\uC544\uC6C3.',
    mindmap: '\uB9C8\uC778\uB4DC\uB9F5\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uC911\uC559 \uC8FC\uC81C\uC5D0\uC11C \uBC29\uC0AC\uD615\uC73C\uB85C \uD558\uC704 \uAC00\uC9C0\uAC00 \uD37C\uC838\uB098\uAC00\uB294 \uAD6C\uC870.',
    funnel: '\uD37C\uB110 \uCC28\uD2B8\uB97C \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. \uC704\uC5D0\uC11C \uC544\uB798\uB85C \uC880\uC544\uC9C0\uB294 \uB2E8\uACC4\uBCC4 \uD37C\uB110.',
    swot: 'SWOT \uBD84\uC11D \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694. 2x2 \uADF8\uB9AC\uB4DC\uB85C S/W/O/T \uAC01 \uC601\uC5ED.'
  };

  // ── 템플릿 버튼 클릭 ──
  document.querySelectorAll('.dg-tpl-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tpl = btn.dataset.tpl;
      var prompt = DG_TPL_PROMPTS[tpl] || '';
      var textarea = $('#dg-ai-prompt');
      textarea.value = prompt;
      textarea.focus();
      // 이미 체크된 데이터가 있으면 바로 생성, 아니면 프롬프트만 채움
    });
  });

  // ── AI 생성 ──
  function dgGenerate(promptText, isRefine) {
    if (!promptText) { toast('\uC124\uBA85\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
    var btn = $('#dg-ai-generate');
    btn.disabled = true;
    btn.textContent = '\u2728 \uC0DD\uC131 \uC911...';

    var ctx = collectDgContext();
    var userMsg = promptText;
    if (ctx) userMsg += '\n\n\uCC38\uACE0 \uB370\uC774\uD130:\n' + ctx;
    if (isRefine && dgLastCode) {
      userMsg = '\uC774\uC804 \uACB0\uACFC\uB97C \uC218\uC815\uD574\uC8FC\uC138\uC694.\n\uC218\uC815 \uC694\uCCAD: ' + promptText + '\n\n\uC774\uC804 HTML \uCF54\uB4DC:\n' + dgLastCode;
    }

    callClaudeAPI(DG_SYSTEM_PROMPT, userMsg, true).then(function (text) {
      dgLastCode = text.trim().replace(/^```(?:html|svg|mermaid)?\n?/i, '').replace(/\n?```$/i, '').trim();
      dgLastPrompt = promptText;
      var preview = $('#dg-result-preview');
      renderDgResult(dgLastCode, preview);
      $('#dg-result-card').style.display = '';
      $('#dg-result-title').textContent = isRefine ? '\uC218\uC815\uB41C \uACB0\uACFC' : '\uC0DD\uC131 \uACB0\uACFC';
      $('#dg-refine-panel').style.display = 'none';
      toast('\uB2E4\uC774\uC5B4\uADF8\uB7A8\uC774 \uC0DD\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    }).catch(function (err) {
      toast('AI \uC624\uB958: ' + err.message);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = '\u2728 AI \uC0DD\uC131';
    });
  }

  $('#dg-ai-generate').addEventListener('click', function () {
    dgGenerate($('#dg-ai-prompt').value.trim(), false);
  });
  $('#dg-ai-prompt').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dgGenerate(this.value.trim(), false);
    }
  });

  // ── 수정 요청 ──
  $('#dg-refine').addEventListener('click', function () {
    var panel = $('#dg-refine-panel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
    if (panel.style.display !== 'none') $('#dg-refine-input').focus();
  });
  $('#dg-refine-go').addEventListener('click', function () {
    dgGenerate($('#dg-refine-input').value.trim(), true);
  });
  $('#dg-refine-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      dgGenerate(this.value.trim(), true);
    }
  });

  // ── 저장 ──
  $('#dg-save').addEventListener('click', function () {
    if (!dgLastCode) { toast('\uBA3C\uC800 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC744 \uC0DD\uC131\uD574\uC8FC\uC138\uC694'); return; }
    var name = prompt('\uB2E4\uC774\uC5B4\uADF8\uB7A8 \uC774\uB984:');
    if (!name) return;
    var diagrams = loadDiagrams();
    diagrams.unshift({
      id: 'dg-' + uid(),
      name: name.trim(),
      code: dgLastCode,
      prompt: dgLastPrompt,
      createdAt: new Date().toISOString()
    });
    saveDiagrams(diagrams);
    updateGalleryCount();
    toast('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
  });

  // ── 갤러리 ──
  function updateGalleryCount() {
    var d = loadDiagrams();
    $('#dg-gallery-count').textContent = d.length;
  }

  function renderGallery() {
    var diagrams = loadDiagrams();
    var list = $('#dg-gallery-list');
    if (diagrams.length === 0) {
      list.innerHTML = '<div class="dg-gallery-empty">\uC800\uC7A5\uB41C \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
      return;
    }
    list.innerHTML = diagrams.map(function (d) {
      var dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('ko-KR') : '';
      return '<div class="dg-gallery-item" data-id="' + d.id + '">' +
        '<div class="dg-gallery-item-info">' +
          '<span class="dg-gallery-item-name">' + escapeHtml(d.name) + '</span>' +
          '<span class="dg-gallery-item-meta">' + dateStr + (d.prompt ? ' \xB7 ' + escapeHtml(d.prompt.substring(0, 40)) : '') + '</span>' +
        '</div>' +
        '<div class="dg-gallery-item-actions">' +
          '<button class="btn btn-small btn-ghost" data-action="load" data-id="' + d.id + '">\uC5F4\uAE30</button>' +
          '<button class="btn btn-small btn-danger" data-action="del" data-id="' + d.id + '">\uC0AD\uC81C</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  $('#dg-gallery-toggle').addEventListener('click', function () {
    var panel = $('#dg-gallery-panel');
    var vis = panel.style.display !== 'none';
    panel.style.display = vis ? 'none' : '';
    if (!vis) renderGallery();
  });
  $('#dg-gallery-close').addEventListener('click', function () { $('#dg-gallery-panel').style.display = 'none'; });

  $('#dg-gallery-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;
    var diagrams = loadDiagrams();
    if (action === 'del') {
      saveDiagrams(diagrams.filter(function (d) { return d.id !== id; }));
      updateGalleryCount();
      renderGallery();
      toast('\uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } else if (action === 'load') {
      var dg = diagrams.find(function (d) { return d.id === id; });
      if (!dg) return;
      dgLastCode = dg.code;
      dgLastPrompt = dg.prompt || '';
      renderDgResult(dg.code, $('#dg-result-preview'));
      $('#dg-result-card').style.display = '';
      $('#dg-result-title').textContent = dg.name;
      $('#dg-gallery-panel').style.display = 'none';
      if (dg.prompt) $('#dg-ai-prompt').value = dg.prompt;
      toast('"' + dg.name + '" \uB85C\uB4DC\uB428');
    }
  });

  // ── 이미지 저장 (PNG / JPEG) ──
  function exportDgImage(format) {
    var preview = $('#dg-result-preview');
    var svgEl = preview.querySelector('.dg-rendered-svg svg');
    var mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    var ext = format === 'jpeg' ? '.jpg' : '.png';
    var fname = 'diagram-' + new Date().toISOString().slice(0, 10) + ext;

    if (svgEl) {
      // SVG → Canvas → PNG/JPEG
      var svgData = new XMLSerializer().serializeToString(svgEl);
      var blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.width * 2; c.height = img.height * 2;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = fname;
          a.click();
          toast(format.toUpperCase() + ' \uC800\uC7A5 \uC644\uB8CC');
        }, mimeType, 0.95);
        URL.revokeObjectURL(url);
      };
      img.src = url;
      return;
    }

    // HTML(iframe) → html2canvas\uB85C \uCEA1\uCC98
    if (dgLastCode) {
      if (typeof html2canvas === 'undefined') {
        toast('html2canvas \uB85C\uB529 \uC911\u2026 \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694');
        return;
      }
      var container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;color:#1a1a2e;line-height:1.5;z-index:-1';
      container.innerHTML = dgLastCode;
      document.body.appendChild(container);
      toast('\uC774\uBBF8\uC9C0 \uBCC0\uD658 \uC911\u2026');
      html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(function (canvas) {
        canvas.toBlob(function (b) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = fname;
          a.click();
          toast(format.toUpperCase() + ' \uC800\uC7A5 \uC644\uB8CC');
        }, mimeType, 0.95);
        document.body.removeChild(container);
      }).catch(function () {
        document.body.removeChild(container);
        toast('\uC774\uBBF8\uC9C0 \uBCC0\uD658\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
      });
    } else {
      toast('\uC800\uC7A5\uD560 \uB2E4\uC774\uC5B4\uADF8\uB7A8\uC774 \uC5C6\uC2B5\uB2C8\uB2E4');
    }
  }

  $('#dg-export-png').addEventListener('click', function () { exportDgImage('png'); });
  $('#dg-export-jpeg').addEventListener('click', function () { exportDgImage('jpeg'); });

  // 초기화
  updateGalleryCount();

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

  // ── 칼럼 설정 시스템 ──
  var JNL_COLS_KEY = 'fl_journal_cols';
  var DEFAULT_JNL_COLUMNS = [
    { key: 'category', label: '구분', type: 'text', filterable: 'select' },
    { key: 'item', label: '항목', type: 'text', filterable: 'select' },
    { key: 'subitem', label: '세부 항목', type: 'text', filterable: 'select' },
    { key: 'date', label: '날짜', type: 'date', filterable: 'input' },
    { key: 'feedback', label: '피드백 및 결정', type: 'longtext', filterable: 'input' },
    { key: 'note', label: '느낀 점 및 수행해야 할 사항', type: 'longtext', filterable: 'input' },
    { key: 'ref', label: '레퍼런스', type: 'longtext', filterable: 'input' }
  ];

  function loadJnlColumns() {
    try {
      var cols = JSON.parse(localStorage.getItem(JNL_COLS_KEY));
      return (cols && cols.length > 0) ? cols : DEFAULT_JNL_COLUMNS.map(function (c) { return JSON.parse(JSON.stringify(c)); });
    } catch (e) { return DEFAULT_JNL_COLUMNS.map(function (c) { return JSON.parse(JSON.stringify(c)); }); }
  }

  function saveJnlColumns(cols) {
    localStorage.setItem(JNL_COLS_KEY, JSON.stringify(cols));
  }

  function getNextJnlNumber() {
    var items = load(JNL_KEY);
    var cols = loadJnlColumns();
    // 첫 번째 칼럼을 자동 번호로 사용
    var firstKey = cols[0] ? cols[0].key : 'category';
    var maxNum = 0;
    items.forEach(function (e) {
      var n = parseInt(e[firstKey], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    });
    return maxNum + 1;
  }

  function clearJnlForm() {
    currentJnlEditId = null;
    var cols = loadJnlColumns();
    cols.forEach(function (col) {
      var el = $('#jnl-' + col.key);
      if (!el) return;
      if (col.key === cols[0].key) el.value = getNextJnlNumber();
      else if (col.type === 'date') el.value = new Date().toISOString().slice(0, 10);
      else el.value = '';
    });
    $('#jnl-form-title-label').textContent = '새 항목 추가';
    jnlAttachments = [];
    renderJnlAttachList();
  }

  // ── 리치 텍스트 유틸리티 ──
  function sanitizeJnlHtml(html) {
    if (!html) return '';
    var temp = document.createElement('div');
    temp.innerHTML = html;
    var dangerous = temp.querySelectorAll('script, style, iframe, form, object, embed, applet');
    for (var i = 0; i < dangerous.length; i++) dangerous[i].remove();
    var all = temp.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var attrs = all[i].attributes;
      for (var j = attrs.length - 1; j >= 0; j--) {
        if (attrs[j].name.toLowerCase().indexOf('on') === 0) all[i].removeAttribute(attrs[j].name);
      }
      if (all[i].hasAttribute('href') && all[i].getAttribute('href').trim().toLowerCase().indexOf('javascript:') === 0) {
        all[i].removeAttribute('href');
      }
    }
    return temp.innerHTML;
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|li|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  function plainTextToHtml(text) {
    if (!text) return '';
    if (text.indexOf('<') !== -1) return text; // already HTML
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function insertJnlImage(editorDiv, file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      editorDiv.focus();
      var img = document.createElement('img');
      img.src = ev.target.result;
      img.className = 'jnl-rich-img';
      var sel = window.getSelection();
      if (sel.rangeCount > 0 && editorDiv.contains(sel.anchorNode)) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorDiv.appendChild(img);
      }
    };
    reader.readAsDataURL(file);
  }

  function insertJnlFileTag(editorDiv, file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      editorDiv.focus();
      var fileStore = loadJnlFiles();
      var fid = 'rf-' + uid();
      fileStore[fid] = { name: file.name, size: file.size, type: file.type, dataUrl: ev.target.result };
      saveJnlFiles(fileStore);
      var tag = document.createElement('a');
      tag.className = 'jnl-inline-file';
      tag.href = '#';
      tag.dataset.fileId = fid;
      tag.contentEditable = 'false';
      tag.textContent = '\uD83D\uDCCE ' + file.name;
      var sel = window.getSelection();
      if (sel.rangeCount > 0 && editorDiv.contains(sel.anchorNode)) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(tag);
        var space = document.createTextNode(' ');
        range.setStartAfter(tag);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        editorDiv.appendChild(tag);
        editorDiv.appendChild(document.createTextNode(' '));
      }
    };
    reader.readAsDataURL(file);
  }

  function openJnlLinkDialog(editorDiv) {
    var sel = window.getSelection();
    var savedRange = null, selectedText = '';
    if (sel.rangeCount > 0 && editorDiv.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      selectedText = sel.toString().trim();
    }
    var overlay = document.createElement('div');
    overlay.className = 'jnl-link-overlay';
    var dialog = document.createElement('div');
    dialog.className = 'jnl-link-dialog';
    dialog.innerHTML =
      '<div class="jnl-link-title">\uB9C1\uD06C \uC0BD\uC785</div>' +
      '<input type="text" class="jnl-link-input" placeholder="\uD45C\uC2DC \uD14D\uC2A4\uD2B8" value="' + escapeHtml(selectedText) + '">' +
      '<input type="text" class="jnl-link-input jnl-link-url" placeholder="URL (\uC608: https://...)">' +
      '<div class="jnl-link-btns">' +
        '<button class="btn btn-small btn-ghost jnl-link-cancel">\uCDE8\uC18C</button>' +
        '<button class="btn btn-small btn-primary jnl-link-ok">\uD655\uC778</button>' +
      '</div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    var textInput = dialog.querySelector('input:first-of-type');
    var urlInput = dialog.querySelector('.jnl-link-url');
    urlInput.focus();

    function doClose() { if (overlay.parentNode) overlay.remove(); }
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) doClose(); });
    dialog.querySelector('.jnl-link-cancel').addEventListener('click', doClose);

    function doSave() {
      var url = urlInput.value.trim();
      var text = textInput.value.trim() || url;
      if (!url) { urlInput.focus(); return; }
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) url = 'https://' + url;
      var a = document.createElement('a');
      a.href = url; a.textContent = text;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      editorDiv.focus();
      if (savedRange && editorDiv.contains(savedRange.startContainer)) {
        var newSel = window.getSelection();
        savedRange.deleteContents();
        savedRange.insertNode(a);
        savedRange.setStartAfter(a);
        savedRange.collapse(true);
        newSel.removeAllRanges();
        newSel.addRange(savedRange);
      } else {
        editorDiv.appendChild(a);
      }
      doClose();
    }
    dialog.querySelector('.jnl-link-ok').addEventListener('click', doSave);
    urlInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') doSave();
      if (ev.key === 'Escape') doClose();
    });
  }

  // ── 셀 단위 AI ──
  var _jnlSuppressBlur = false;

  function runCellAI(entryId, fieldKey, action, customPrompt) {
    var items = load(JNL_KEY);
    var entry = items.find(function (i) { return i.id === entryId; });
    if (!entry) return Promise.reject(new Error('항목 없음'));
    var cols = loadJnlColumns();
    var col = cols.find(function (c) { return c.key === fieldKey; });
    var colLabel = col ? col.label : fieldKey;
    var cellVal = entry[fieldKey] || '';
    if (col && col.type === 'longtext') cellVal = htmlToPlainText(cellVal);

    var entryText = jnlEntryToText(entry);
    var contextItems = items.slice(0, 10).filter(function (i) { return i.id !== entryId; }).slice(0, 5);
    var contextText = contextItems.map(function (c) { return jnlEntryToText(c); }).join('\n---\n');

    var systemPrompt = '당신은 전략기획팀의 업무일지 작성을 돕는 AI 어시스턴트입니다. 간결하고 실무적인 한국어로 답변하세요.';
    var userMsg = '';

    if (action === 'fill') {
      if (cellVal) return Promise.resolve(null);
      userMsg = '아래 업무일지 행의 "' + colLabel + '" 칸이 비어있습니다. 적절한 내용을 작성해주세요.\n\n' +
        '현재 행:\n' + entryText + '\n\n참고 항목:\n' + contextText +
        '\n\n"' + colLabel + '" 칸에 들어갈 내용만 작성하세요. 부가 설명 없이 내용만 출력하세요.';
    } else if (action === 'improve') {
      if (!cellVal) return Promise.resolve(null);
      userMsg = '아래 업무일지 행의 "' + colLabel + '" 칸 내용을 개선해주세요.\n\n현재 값: ' + cellVal +
        '\n\n전체 행:\n' + entryText + '\n\n참고 항목:\n' + contextText +
        '\n\n개선된 "' + colLabel + '" 내용만 출력하세요. 부가 설명 없이 내용만 출력하세요.';
    } else if (action === 'custom') {
      userMsg = (customPrompt || '') + '\n\n대상 칸: "' + colLabel + '"\n현재 값: ' + (cellVal || '(비어있음)') +
        '\n\n전체 행:\n' + entryText + '\n\n참고 항목:\n' + contextText +
        '\n\n"' + colLabel + '" 칸에 들어갈 결과만 출력하세요. 부가 설명 없이 내용만 출력하세요.';
    } else {
      return Promise.resolve(null);
    }

    return callClaudeAPI(systemPrompt, userMsg).then(function (text) {
      return text.trim();
    });
  }

  function getJnlData() {
    var cols = loadJnlColumns();
    var fileStore = loadJnlFiles();
    var attachIds = jnlAttachments.map(function (f) {
      fileStore[f.id] = { name: f.name, size: f.size, type: f.type, dataUrl: f.dataUrl };
      return f.id;
    });
    saveJnlFiles(fileStore);

    var data = {
      id: currentJnlEditId || uid(),
      attachments: attachIds,
      createdAt: new Date().toISOString()
    };
    cols.forEach(function (col) {
      var el = $('#jnl-' + col.key);
      data[col.key] = el ? el.value.trim() : '';
    });
    return data;
  }

  function loadJnlToForm(entry) {
    var cols = loadJnlColumns();
    currentJnlEditId = entry.id;
    showJnlForm();
    cols.forEach(function (col) {
      var el = $('#jnl-' + col.key);
      if (el) el.value = entry[col.key] || '';
    });
    $('#jnl-form-title-label').textContent = '항목 수정';

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
    var cols = loadJnlColumns();
    var firstKey = cols[0] ? cols[0].key : 'category';
    var cats = {};
    items.forEach(function (e) {
      if (e[firstKey]) cats[e[firstKey]] = true;
    });
    return Object.keys(cats).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function populateJnlCategoryFilter() {
    var sel = $('#jnl-filter-category');
    var cols = loadJnlColumns();
    var firstLabel = cols[0] ? cols[0].label : '구분';
    var cats = getJnlCategories();
    var current = sel.value;
    var html = '<option value="">전체 ' + escapeHtml(firstLabel) + '</option>';
    cats.forEach(function (c) {
      html += '<option value="' + escapeHtml(c) + '"' + (c === current ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
    });
    sel.innerHTML = html;
  }

  // 칼럼 필터 상태 (동적)
  var jnlColFilters = {};

  function naturalSort(a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }

  function populateJnlColFilters() {
    var items = load(JNL_KEY);
    var cols = loadJnlColumns();
    cols.forEach(function (col) {
      if (col.filterable === 'select') {
        var vals = {};
        items.forEach(function (e) { if (e[col.key]) vals[e[col.key]] = true; });
        var sel = document.querySelector('.jnl-col-filter[data-field="' + col.key + '"]');
        if (!sel) return;
        var current = sel.value;
        var html = '<option value="">전체</option>';
        Object.keys(vals).sort(naturalSort).forEach(function (v) {
          html += '<option value="' + escapeHtml(v) + '"' + (v === current ? ' selected' : '') + '>' + escapeHtml(v) + '</option>';
        });
        sel.innerHTML = html;
      }
    });
  }

  function getFilteredJnlItems() {
    var items = load(JNL_KEY);
    var cols = loadJnlColumns();
    var search = ($('#jnl-search').value || '').toLowerCase();
    var firstKey = cols[0] ? cols[0].key : 'category';
    var filterCat = $('#jnl-filter-category').value;

    if (filterCat) {
      items = items.filter(function (e) { return e[firstKey] === filterCat; });
    }

    // 칼럼별 필터 적용
    cols.forEach(function (col) {
      if (!jnlColFilters[col.key]) return;
      if (col.filterable === 'select') {
        items = items.filter(function (e) { return (e[col.key] || '') === jnlColFilters[col.key]; });
      } else if (col.filterable === 'input') {
        var kw = jnlColFilters[col.key].toLowerCase();
        items = items.filter(function (e) {
          var val = col.type === 'date' ? formatJnlDate(e[col.key]) :
            col.type === 'longtext' ? htmlToPlainText(e[col.key] || '') : (e[col.key] || '');
          return val.toLowerCase().indexOf(kw) !== -1;
        });
      }
    });

    if (search) {
      items = items.filter(function (e) {
        return cols.some(function (col) {
          var sv = col.type === 'longtext' ? htmlToPlainText(e[col.key] || '') : (e[col.key] || '');
          return sv.toLowerCase().indexOf(search) !== -1;
        });
      });
    }

    // 첫 번째 칼럼(숫자) 내림차순 정렬
    items.sort(function (a, b) {
      var na = parseInt(a[firstKey], 10);
      var nb = parseInt(b[firstKey], 10);
      var aIsNum = !isNaN(na);
      var bIsNum = !isNaN(nb);
      if (aIsNum && bIsNum) return nb - na;
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return (b[firstKey] || '').localeCompare(a[firstKey] || '', 'ko');
    });

    return items;
  }

  // 동적 thead 렌더링 (칼럼 헤더 + 필터 행)
  function renderJnlHeader() {
    var cols = loadJnlColumns();
    var thead = $('#jnl-thead');
    // 헤더 행
    var headerHtml = '<tr class="jnl-header-row">';
    cols.forEach(function (col) {
      headerHtml += '<th>' + escapeHtml(col.label) + '</th>';
    });
    headerHtml += '<th style="width:50px">작업</th></tr>';
    // 필터 행
    var filterHtml = '<tr class="jnl-filter-header">';
    cols.forEach(function (col) {
      if (col.filterable === 'select') {
        filterHtml += '<th><select class="jnl-col-filter" data-field="' + col.key + '"><option value="">전체</option></select></th>';
      } else if (col.filterable === 'input') {
        filterHtml += '<th><input class="jnl-col-filter-input" data-field="' + col.key + '" placeholder="검색..." type="text"></th>';
      } else {
        filterHtml += '<th></th>';
      }
    });
    filterHtml += '<th></th></tr>';
    thead.innerHTML = headerHtml + filterHtml;

    // 필터 이벤트 바인딩
    thead.querySelectorAll('.jnl-col-filter').forEach(function (sel) {
      sel.addEventListener('change', function () {
        jnlColFilters[sel.dataset.field] = sel.value;
        renderJnlTable();
      });
    });
    thead.querySelectorAll('.jnl-col-filter-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        jnlColFilters[inp.dataset.field] = inp.value.trim();
        renderJnlTable();
      });
    });

    // 기존 필터 값 복원
    Object.keys(jnlColFilters).forEach(function (key) {
      if (!jnlColFilters[key]) return;
      var el = thead.querySelector('[data-field="' + key + '"]');
      if (el) el.value = jnlColFilters[key];
    });
  }

  function renderJnlCellContent(col, entry, isFirst) {
    var val = entry[col.key] || '';
    if (isFirst) return '<span class="jnl-category-badge">' + escapeHtml(val || '-') + '</span>';
    if (col.type === 'date') return escapeHtml(formatJnlDate(val));
    if (col.type === 'longtext') {
      var html = val;
      if (html && html.indexOf('<') === -1) html = escapeHtml(html).replace(/\n/g, '<br>');
      return '<div class="jnl-cell-text jnl-rich-content">' + sanitizeJnlHtml(html) + '</div>';
    }
    return escapeHtml(val);
  }

  function renderJnlTable() {
    var cols = loadJnlColumns();
    var items = getFilteredJnlItems();
    var tbody = $('#jnl-tbody');
    var colCount = cols.length + 1; // +1 for actions column

    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="' + colCount + '" class="jnl-empty">' +
        (load(JNL_KEY).length === 0 ? '업무일지 항목이 없습니다. 새 항목을 추가하거나 Excel/CSV 파일을 업로드하세요.' : '검색 결과가 없습니다.') +
        '</td></tr>';
      return;
    }

    var fileStore = loadJnlFiles();
    var firstKey = cols[0] ? cols[0].key : '';
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
      var cells = cols.map(function (col, idx) {
        var val = e[col.key] || '';
        var extra = '';
        if (col.type === 'date') extra = ' data-raw="' + escapeHtml(val) + '"';
        var isFirst = (idx === 0);
        // 마지막 칼럼에 첨부파일 표시
        if (idx === cols.length - 1) {
          var content = renderJnlCellContent(col, e, isFirst);
          return '<td class="jnl-editable" data-field="' + col.key + '"' + extra + '>' + content + attachHtml + '</td>';
        }
        return '<td class="jnl-editable" data-field="' + col.key + '"' + extra + '>' + renderJnlCellContent(col, e, isFirst) + '</td>';
      }).join('');
      return '<tr data-id="' + e.id + '">' + cells +
        '<td class="jnl-td-actions">' +
          '<button class="btn btn-small btn-danger" data-action="delete" title="삭제">✕</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // -- Event listeners --
  $('#jnl-new').addEventListener('click', function () {
    var cols = loadJnlColumns();
    var items = load(JNL_KEY);
    var newEntry = {
      id: uid(),
      attachments: [],
      createdAt: new Date().toISOString()
    };
    cols.forEach(function (col, idx) {
      if (idx === 0) newEntry[col.key] = String(getNextJnlNumber());
      else if (col.type === 'date') newEntry[col.key] = new Date().toISOString().slice(0, 10);
      else newEntry[col.key] = '';
    });
    items.unshift(newEntry);
    save(JNL_KEY, items);
    renderJnlTable();
    populateJnlCategoryFilter();
    populateJnlColFilters();
    toast('새 항목이 추가되었습니다. 셀을 클릭하여 편집하세요.');
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
    var cols = loadJnlColumns();
    var hasValue = cols.some(function (col) { return !!data[col.key]; });
    if (!hasValue) {
      toast('하나 이상의 값을 입력해주세요');
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
    populateJnlColFilters();
    showJnlList();
    toast('업무일지가 저장되었습니다');
  });

  $('#jnl-search').addEventListener('input', function () { renderJnlTable(); });
  $('#jnl-filter-category').addEventListener('change', function () { renderJnlTable(); });

  // 인라인 편집 상태: { id, field } 또는 null
  var jnlEditing = null;
  var jnlSaving = false;

  function renderJnlCellContentByField(field, entry) {
    var cols = loadJnlColumns();
    var col = cols.find(function (c) { return c.key === field; });
    if (!col) return escapeHtml(entry[field] || '');
    var isFirst = cols[0] && cols[0].key === field;
    return renderJnlCellContent(col, entry, isFirst);
  }

  function commitJnlEdit(skipRender) {
    if (jnlSaving || !jnlEditing) return;
    jnlSaving = true;

    var editId = jnlEditing.id;
    var editField = jnlEditing.field;
    jnlEditing = null;

    var td = document.querySelector('#jnl-tbody tr[data-id="' + editId + '"] td[data-field="' + editField + '"]');
    if (!td) { jnlSaving = false; return; }

    td.classList.remove('jnl-editing');

    // contentEditable (리치 텍스트) 또는 일반 input/textarea
    var richEditor = td.querySelector('.jnl-cell-rich-editor');
    var input = td.querySelector('.jnl-cell-input, .jnl-cell-textarea');
    var newVal;
    if (richEditor) {
      newVal = richEditor.innerHTML.trim();
      if (newVal === '<br>' || newVal === '<div><br></div>' || newVal === '<p><br></p>') newVal = '';
    } else if (input) {
      newVal = input.value.trim();
    } else {
      jnlSaving = false; return;
    }

    var items = load(JNL_KEY);
    var entry = items.find(function (i) { return i.id === editId; });
    if (entry) {
      var changed = entry[editField] !== newVal;
      entry[editField] = newVal;
      if (changed) {
        save(JNL_KEY, items);
        populateJnlCategoryFilter();
        populateJnlColFilters();
      }
      td.innerHTML = renderJnlCellContentByField(editField, entry);
      var cols = loadJnlColumns();
      var col = cols.find(function (c) { return c.key === editField; });
      if (col && col.type === 'date') td.dataset.raw = newVal;
    }

    jnlSaving = false;
    var cols2 = loadJnlColumns();
    if (!skipRender && cols2[0] && editField === cols2[0].key) {
      renderJnlTable();
    }
  }

  function moveToNextCell(td) {
    var nextTd = td.nextElementSibling;
    while (nextTd && !nextTd.classList.contains('jnl-editable')) {
      nextTd = nextTd.nextElementSibling;
    }
    if (nextTd) {
      var nextTr = nextTd.closest('tr[data-id]');
      if (nextTr) startJnlEdit(nextTd, nextTr.dataset.id, nextTd.dataset.field);
    }
  }

  function bindSimpleEditKeys(inputEl, td, id, field, col, currentVal) {
    inputEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        commitJnlEdit();
      } else if (ev.key === 'Escape') {
        jnlEditing = null;
        td.classList.remove('jnl-editing');
        td.innerHTML = renderJnlCellContentByField(field, { });
        var items = load(JNL_KEY);
        var e = items.find(function (i) { return i.id === id; });
        if (e) td.innerHTML = renderJnlCellContentByField(field, e);
        if (col && col.type === 'date') td.dataset.raw = currentVal;
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        commitJnlEdit(true);
        moveToNextCell(td);
      }
    });
    inputEl.addEventListener('blur', function () {
      setTimeout(function () {
        if (_jnlSuppressBlur) return;
        if (jnlEditing && jnlEditing.id === id && jnlEditing.field === field) {
          if (td.contains(document.activeElement)) return;
          commitJnlEdit();
        }
      }, 150);
    });
  }

  function startJnlEdit(td, id, field) {
    var items = load(JNL_KEY);
    var entry = items.find(function (i) { return i.id === id; });
    if (!entry) return;

    var cols = loadJnlColumns();
    var col = cols.find(function (c) { return c.key === field; });

    jnlEditing = { id: id, field: field };
    td.classList.add('jnl-editing');
    var currentVal = entry[field] || '';

    if (col && col.type === 'date') {
      // 날짜 입력
      td.innerHTML = '<input type="date" class="jnl-cell-input" value="' + escapeHtml(currentVal) + '">';
      var dateEl = td.querySelector('.jnl-cell-input');
      dateEl.focus();
      bindSimpleEditKeys(dateEl, td, id, field, col, currentVal);
    } else if (col && col.type === 'longtext') {
      // ── 리치 텍스트 편집 ──
      td.innerHTML = '';
      var toolbar = document.createElement('div');
      toolbar.className = 'jnl-rich-toolbar';
      toolbar.innerHTML =
        '<button type="button" class="jnl-rich-btn" data-cmd="bold" title="굵게 Ctrl+B"><b>B</b></button>' +
        '<button type="button" class="jnl-rich-btn" data-cmd="underline" title="밑줄 Ctrl+U"><u>U</u></button>' +
        '<button type="button" class="jnl-rich-btn" data-cmd="italic" title="기울임 Ctrl+I"><i>I</i></button>' +
        '<span class="jnl-rich-sep"></span>' +
        '<button type="button" class="jnl-rich-btn" data-action="link" title="링크">\uD83D\uDD17</button>' +
        '<button type="button" class="jnl-rich-btn" data-action="image" title="이미지">\uD83D\uDDBC</button>' +
        '<button type="button" class="jnl-rich-btn" data-action="file" title="파일 첨부">\uD83D\uDCCE</button>' +
        '<span class="jnl-rich-sep"></span>' +
        '<button type="button" class="jnl-rich-btn jnl-rich-ai" data-action="ai" title="AI">\uD83E\uDD16</button>' +
        '<span style="flex:1"></span>' +
        '<button type="button" class="jnl-rich-btn jnl-rich-save" data-action="save" title="저장 Ctrl+Enter">\u2713</button>' +
        '<button type="button" class="jnl-rich-btn jnl-rich-cancel" data-action="cancel" title="취소 Esc">\u2715</button>';

      var editorDiv = document.createElement('div');
      editorDiv.className = 'jnl-cell-rich-editor';
      editorDiv.contentEditable = 'true';
      var htmlVal = currentVal;
      if (htmlVal && htmlVal.indexOf('<') === -1) htmlVal = escapeHtml(htmlVal).replace(/\n/g, '<br>');
      editorDiv.innerHTML = htmlVal;

      td.appendChild(toolbar);
      td.appendChild(editorDiv);
      editorDiv.focus();

      // 툴바 mousedown → 에디터 blur 방지
      toolbar.addEventListener('mousedown', function (ev) {
        if (ev.target.closest('.jnl-rich-btn')) ev.preventDefault();
      });

      toolbar.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.jnl-rich-btn');
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        var cmd = btn.dataset.cmd;
        var action = btn.dataset.action;
        if (cmd) {
          editorDiv.focus();
          document.execCommand(cmd, false, null);
        } else if (action === 'link') {
          openJnlLinkDialog(editorDiv);
        } else if (action === 'image') {
          _jnlSuppressBlur = true;
          var inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*';
          inp.addEventListener('change', function () {
            _jnlSuppressBlur = false;
            if (inp.files && inp.files[0]) insertJnlImage(editorDiv, inp.files[0]);
            editorDiv.focus();
          });
          inp.click();
          setTimeout(function () { _jnlSuppressBlur = false; }, 60000);
        } else if (action === 'file') {
          _jnlSuppressBlur = true;
          var inp = document.createElement('input');
          inp.type = 'file';
          inp.addEventListener('change', function () {
            _jnlSuppressBlur = false;
            if (inp.files && inp.files[0]) insertJnlFileTag(editorDiv, inp.files[0]);
            editorDiv.focus();
          });
          inp.click();
          setTimeout(function () { _jnlSuppressBlur = false; }, 60000);
        } else if (action === 'ai') {
          showCellAiMenu(btn, id, field, editorDiv);
        } else if (action === 'save') {
          commitJnlEdit();
        } else if (action === 'cancel') {
          jnlEditing = null;
          td.classList.remove('jnl-editing');
          td.innerHTML = renderJnlCellContentByField(field, entry);
        }
      });

      // 키보드 단축키
      editorDiv.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') {
          jnlEditing = null;
          td.classList.remove('jnl-editing');
          td.innerHTML = renderJnlCellContentByField(field, entry);
        } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          commitJnlEdit();
        } else if (ev.key === 'Tab') {
          ev.preventDefault();
          commitJnlEdit(true);
          moveToNextCell(td);
        }
      });

      // 이미지 붙여넣기
      editorDiv.addEventListener('paste', function (ev) {
        var clipItems = (ev.clipboardData || ev.originalEvent.clipboardData).items;
        for (var pi = 0; pi < clipItems.length; pi++) {
          if (clipItems[pi].type.indexOf('image') !== -1) {
            ev.preventDefault();
            insertJnlImage(editorDiv, clipItems[pi].getAsFile());
            return;
          }
        }
      });

      // blur → 저장
      editorDiv.addEventListener('blur', function () {
        setTimeout(function () {
          if (_jnlSuppressBlur) return;
          if (jnlEditing && jnlEditing.id === id && jnlEditing.field === field) {
            if (td.contains(document.activeElement)) return;
            commitJnlEdit();
          }
        }, 250);
      });
    } else {
      // ── 짧은 텍스트 + AI 버튼 ──
      var wrap = document.createElement('div');
      wrap.className = 'jnl-text-edit-wrap';
      wrap.innerHTML = '<input type="text" class="jnl-cell-input" value="' + escapeHtml(currentVal) + '">' +
        '<button type="button" class="jnl-cell-ai-btn" title="AI">\uD83E\uDD16</button>';
      td.innerHTML = '';
      td.appendChild(wrap);
      var inputEl = wrap.querySelector('.jnl-cell-input');
      inputEl.focus();

      wrap.querySelector('.jnl-cell-ai-btn').addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      wrap.querySelector('.jnl-cell-ai-btn').addEventListener('click', function (ev) {
        ev.stopPropagation();
        showCellAiMenu(ev.target, id, field, null, inputEl);
      });

      bindSimpleEditKeys(inputEl, td, id, field, col, currentVal);
    }
  }

  // ── 셀 AI 메뉴 ──
  function showCellAiMenu(anchorEl, entryId, fieldKey, editorDiv, inputEl) {
    var existing = document.querySelector('.jnl-ai-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'jnl-ai-menu';
    menu.innerHTML =
      '<button data-ai-action="fill">\u2728 AI \uCC44\uC6B0\uAE30</button>' +
      '<button data-ai-action="improve">\uD83D\uDD0D AI \uAC1C\uC120</button>' +
      '<button data-ai-action="custom">\u270D \uC9C1\uC811 \uC785\uB825</button>';

    var rect = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '9999';
    document.body.appendChild(menu);

    function closeMenu() {
      if (menu.parentNode) menu.remove();
      document.removeEventListener('mousedown', outsideHandler);
    }
    function outsideHandler(ev) {
      if (!menu.contains(ev.target)) closeMenu();
    }
    setTimeout(function () { document.addEventListener('mousedown', outsideHandler); }, 50);

    menu.addEventListener('click', function (ev) {
      var action = ev.target.dataset.aiAction;
      if (!action) return;

      if (action === 'custom') {
        // 커스텀 프롬프트 입력
        menu.innerHTML =
          '<input type="text" class="jnl-ai-custom-input" placeholder="\uC608: \uC601\uC5B4\uB85C \uBC88\uC5ED\uD574\uC918">' +
          '<button class="btn btn-small btn-primary jnl-ai-custom-go">\uC2E4\uD589</button>';
        var cInput = menu.querySelector('.jnl-ai-custom-input');
        cInput.focus();
        cInput.addEventListener('keydown', function (kev) {
          if (kev.key === 'Enter') menu.querySelector('.jnl-ai-custom-go').click();
          if (kev.key === 'Escape') closeMenu();
        });
        menu.querySelector('.jnl-ai-custom-go').addEventListener('click', function () {
          var prompt = cInput.value.trim();
          if (!prompt) return;
          closeMenu();
          applyCellAI(entryId, fieldKey, 'custom', editorDiv, inputEl, prompt);
        });
        return;
      }

      closeMenu();
      applyCellAI(entryId, fieldKey, action, editorDiv, inputEl);
    });
  }

  function applyCellAI(entryId, fieldKey, action, editorDiv, inputEl, customPrompt) {
    toast('AI 처리 중...');
    runCellAI(entryId, fieldKey, action, customPrompt).then(function (result) {
      if (!result) { toast('AI 결과 없음'); return; }
      // 결과를 셀에 적용
      var items = load(JNL_KEY);
      var target = items.find(function (i) { return i.id === entryId; });
      if (!target) return;

      var cols = loadJnlColumns();
      var col = cols.find(function (c) { return c.key === fieldKey; });
      var isRich = col && col.type === 'longtext';

      if (isRich) {
        target[fieldKey] = result.replace(/\n/g, '<br>');
      } else {
        target[fieldKey] = result;
      }
      save(JNL_KEY, items);

      // 현재 편집 중이면 에디터에 반영, 아니면 테이블 리렌더
      if (jnlEditing && jnlEditing.id === entryId && jnlEditing.field === fieldKey) {
        if (editorDiv) {
          editorDiv.innerHTML = target[fieldKey];
        } else if (inputEl) {
          inputEl.value = target[fieldKey];
        }
      } else {
        renderJnlTable();
      }
      populateJnlCategoryFilter();
      populateJnlColFilters();
      toast('AI 결과가 적용되었습니다');
    }).catch(function (err) {
      toast('AI 오류: ' + err.message);
    });
  }

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

    // 인라인 파일 태그 (리치 텍스트 내 파일)
    var inlineFile = e.target.closest('.jnl-inline-file');
    if (inlineFile) {
      e.preventDefault();
      var fid2 = inlineFile.dataset.fileId;
      var fs2 = loadJnlFiles();
      var f2 = fs2[fid2];
      if (f2) downloadJnlFile(f2);
      return;
    }

    // 리치 컨텐츠 내 링크 클릭 (뷰 모드에서만)
    var richLink = e.target.closest('.jnl-rich-content a[href]');
    if (richLink && !e.target.closest('.jnl-editing')) {
      e.preventDefault();
      window.open(richLink.href, '_blank', 'noopener');
      return;
    }

    // 이미 편집 중인 input/textarea/contentEditable 클릭은 무시
    if (e.target.closest('.jnl-cell-input, .jnl-cell-textarea, .jnl-cell-rich-editor, .jnl-rich-toolbar, .jnl-text-edit-wrap')) return;

    var tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    var id = tr.dataset.id;

    if (e.target.closest('[data-action="delete"]')) {
      // 편집 중이면 취소
      jnlEditing = null;
      var items = load(JNL_KEY);
      var delEntry = items.find(function (i) { return i.id === id; });
      if (delEntry && delEntry.attachments && delEntry.attachments.length > 0) {
        var fileStore = loadJnlFiles();
        delEntry.attachments.forEach(function (fid) { delete fileStore[fid]; });
        saveJnlFiles(fileStore);
      }
      save(JNL_KEY, items.filter(function (i) { return i.id !== id; }));
      renderJnlTable();
      populateJnlCategoryFilter();
      populateJnlColFilters();
      toast('삭제되었습니다');
      return;
    }

    // 인라인 편집: 셀 클릭
    var td = e.target.closest('.jnl-editable');
    if (!td) return;
    var field = td.dataset.field;

    // 같은 셀 재클릭은 무시
    if (jnlEditing && jnlEditing.id === id && jnlEditing.field === field) return;

    // 이전 편집 저장
    if (jnlEditing) {
      commitJnlEdit(true);
    }

    startJnlEdit(td, id, field);
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

  // -- Excel Export (동적 칼럼) --
  $('#jnl-export-excel').addEventListener('click', function () {
    var items = load(JNL_KEY);
    if (items.length === 0) { toast('내보낼 데이터가 없습니다'); return; }
    var cols = loadJnlColumns();
    var fileStore = loadJnlFiles();
    var headers = cols.map(function (c) { return c.label; });
    headers.push('첨부파일');
    var sheetData = [headers];
    items.forEach(function (e) {
      var attachNames = (e.attachments || []).map(function (fid) {
        var f = fileStore[fid];
        return f ? f.name : '';
      }).filter(Boolean).join(', ');
      var row = cols.map(function (c) { var v = e[c.key] || ''; return c.type === 'longtext' ? htmlToPlainText(v) : v; });
      row.push(attachNames);
      sheetData.push(row);
    });
    exportAsExcel('업무일지_전략기획팀', sheetData);
  });

  // -- CSV Export (동적 칼럼) --
  $('#jnl-export-csv').addEventListener('click', function () {
    var items = load(JNL_KEY);
    if (items.length === 0) { toast('내보낼 데이터가 없습니다'); return; }
    var cols = loadJnlColumns();
    var fileStore = loadJnlFiles();
    var headers = cols.map(function (c) { return c.label; });
    headers.push('첨부파일');
    var rows = [headers.join(',')];
    items.forEach(function (e) {
      var attachNames = (e.attachments || []).map(function (fid) {
        var f = fileStore[fid];
        return f ? f.name : '';
      }).filter(Boolean).join('; ');
      var row = cols.map(function (c) { var v = e[c.key] || ''; return c.type === 'longtext' ? htmlToPlainText(v) : v; });
      row.push(attachNames);
      row = row.map(function (cell) {
        if (cell.indexOf(',') !== -1 || cell.indexOf('"') !== -1 || cell.indexOf('\n') !== -1) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      });
      rows.push(row.join(','));
    });
    var csvContent = '\uFEFF' + rows.join('\r\n');
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

        // 동적 칼럼 기반 임포트
        var cols = loadJnlColumns();
        var headerRow = rows[0].map(function (h) { return (h || '').toString().trim(); });
        var colMap = {};

        // 현재 칼럼의 label로 매핑 시도
        cols.forEach(function (col) {
          headerRow.forEach(function (h, i) {
            if (h === col.label || h === col.key) colMap[col.key] = i;
          });
        });

        // 기존 한글 헤더 호환
        var knownAliases = {
          '세부항목': 'subitem', '피드백': 'feedback', '느낀 점': 'note',
          '수행해야 할 사항': 'note', '참고': 'ref'
        };
        headerRow.forEach(function (h, i) {
          if (knownAliases[h]) {
            var key = knownAliases[h];
            if (colMap[key] === undefined) colMap[key] = i;
          }
        });

        // Fallback: 위치 기반 매핑
        var useFallback = Object.keys(colMap).length === 0;
        if (useFallback) {
          cols.forEach(function (col, idx) {
            colMap[col.key] = idx;
          });
        }

        var startRow = useFallback ? 0 : 1;
        var items = load(JNL_KEY);
        var importCount = 0;

        for (var r = startRow; r < rows.length; r++) {
          var row = rows[r];
          if (!row || row.length === 0) continue;
          var hasData = row.some(function (cell) { return cell !== undefined && cell !== null && cell.toString().trim() !== ''; });
          if (!hasData) continue;

          var entry = { id: uid(), createdAt: new Date().toISOString() };
          cols.forEach(function (col) {
            var idx = colMap[col.key];
            var rawVal = idx !== undefined ? row[idx] : undefined;
            if (col.type === 'date') {
              entry[col.key] = rawVal !== undefined ? formatExcelDate(rawVal) : '';
            } else {
              entry[col.key] = rawVal !== undefined ? (rawVal || '').toString().trim() : '';
            }
          });

          // 최소 하나의 값이 있는 경우에만 추가
          var hasValue = cols.some(function (col) { return !!entry[col.key]; });
          if (hasValue) {
            items.push(entry);
            importCount++;
          }
        }

        save(JNL_KEY, items);
        renderJnlTable();
        populateJnlCategoryFilter();
        populateJnlColFilters();
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

  // ══════════════════════════════════════
  // 9. 업무일지 AI 기능
  // ══════════════════════════════════════

  function callClaudeAPI(systemPrompt, userMessage, useOpus) {
    var settings = loadSettings();
    if (!settings.apiKey) {
      toast('설정에서 API 키를 입력해주세요');
      $('#settings-overlay').classList.add('active');
      return Promise.reject(new Error('API 키 없음'));
    }
    var modelId = useOpus ? 'claude-opus-4-20250514' : 'claude-sonnet-4-20250514';
    // 업무일지 커스텀 시스템 프롬프트 적용
    var finalSystem = systemPrompt;
    if (settings.jnlPrompt) {
      finalSystem = settings.jnlPrompt + '\n\n' + systemPrompt;
    }
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 2048,
        system: finalSystem,
        messages: [{ role: 'user', content: userMessage }]
      })
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error && d.error.message || 'API 오류'); });
      return res.json();
    }).then(function (data) {
      trackApiUsage(modelId, data.usage);
      return data.content[0].text;
    });
  }

  function jnlEntryToText(e) {
    var cols = loadJnlColumns();
    var parts = [];
    cols.forEach(function (col) {
      var val = e[col.key];
      if (!val) return;
      if (col.type === 'date') val = formatJnlDate(val);
      else if (col.type === 'longtext') val = htmlToPlainText(val);
      parts.push(col.label + ': ' + val);
    });
    return parts.join('\n');
  }

  function showJnlAiPanel(title, content) {
    var panel = $('#jnl-ai-panel');
    $('#jnl-ai-panel-title').textContent = title;
    $('#jnl-ai-panel-body').innerHTML = content;
    panel.style.display = '';
  }

  function formatAiResponse(text) {
    // 간단한 마크다운 변환
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n## (.+)/g, '\n<h3 class="jnl-ai-h3">$1</h3>')
      .replace(/\n### (.+)/g, '\n<h4 class="jnl-ai-h4">$1</h4>')
      .replace(/\n- /g, '\n• ')
      .replace(/\n\d+\. /g, function (m) { return '\n' + m.trim() + ' '; })
      .replace(/\n/g, '<br>');
  }

  // AI 패널 닫기
  $('#jnl-ai-panel-close').addEventListener('click', function () {
    $('#jnl-ai-panel').style.display = 'none';
  });

  // (셀 단위 AI 기능은 startJnlEdit 내 showCellAiMenu로 이동됨)

  // ── 전체 데이터 AI 요약 ──
  $('#jnl-ai-summary').addEventListener('click', function () {
    var items = getFilteredJnlItems();
    if (items.length === 0) { toast('분석할 데이터가 없습니다'); return; }

    var btn = this;
    btn.disabled = true;
    btn.textContent = '⏳ 분석 중...';

    var allText = items.map(function (e, i) {
      return (i + 1) + '. ' + jnlEntryToText(e);
    }).join('\n\n');

    var systemPrompt = '당신은 전략기획팀의 업무 분석 전문가입니다. 한국어로 간결하게 답변하세요.';
    var userMsg = '아래 업무일지 데이터(' + items.length + '건)를 분석하여 종합 요약을 작성해주세요.\n\n' +
      '포함할 내용:\n' +
      '1. **전체 요약**: 주요 업무 흐름과 핵심 성과\n' +
      '2. **주요 업무 카테고리**: 분야별 정리\n' +
      '3. **미해결 사항**: 아직 완료되지 않은 것들\n' +
      '4. **핵심 인사이트**: 패턴이나 주목할 점\n\n' +
      '데이터:\n' + allText;

    callClaudeAPI(systemPrompt, userMsg, true).then(function (text) {
      showJnlAiPanel('🤖 AI 업무 요약 (' + items.length + '건 분석)', formatAiResponse(text));
    }).catch(function (err) {
      toast('AI 오류: ' + err.message);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = '🤖 AI 요약';
    });
  });

  // ── 전체 데이터 AI 리포트 ──
  $('#jnl-ai-report').addEventListener('click', function () {
    var items = getFilteredJnlItems();
    if (items.length === 0) { toast('분석할 데이터가 없습니다'); return; }

    var btn = this;
    btn.disabled = true;
    btn.textContent = '⏳ 생성 중...';

    var allText = items.map(function (e, i) {
      return (i + 1) + '. ' + jnlEntryToText(e);
    }).join('\n\n');

    var today = new Date().toISOString().slice(0, 10);
    var systemPrompt = '당신은 전략기획팀의 업무 보고서 작성 전문가입니다. 한국어로 공식적이고 간결한 보고서를 작성하세요.';
    var userMsg = '아래 업무일지 데이터를 기반으로 업무 리포트를 작성해주세요.\n' +
      '작성일: ' + today + '\n\n' +
      '포함할 섹션:\n' +
      '1. **기간 및 개요**: 데이터 기간, 총 업무 건수\n' +
      '2. **주요 성과**: 완료된 핵심 업무\n' +
      '3. **진행 중인 업무**: 현재 진행 상황\n' +
      '4. **피드백 및 결정사항 요약**: 중요 의사결정\n' +
      '5. **다음 주기 과제**: 향후 수행해야 할 사항\n' +
      '6. **리스크 및 제안**: 주의점과 개선 제안\n\n' +
      '데이터:\n' + allText;

    callClaudeAPI(systemPrompt, userMsg, true).then(function (text) {
      showJnlAiPanel('📋 AI 업무 리포트 (' + today + ')', formatAiResponse(text));
    }).catch(function (err) {
      toast('AI 오류: ' + err.message);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = '📋 AI 리포트';
    });
  });

  // ══════════════════════════════════════
  // 10. 칼럼 관리 패널 UI
  // ══════════════════════════════════════

  function renderJnlColList() {
    var cols = loadJnlColumns();
    var list = $('#jnl-col-list');
    list.innerHTML = cols.map(function (col, idx) {
      var typeLabels = { text: '텍스트', longtext: '긴 텍스트', date: '날짜', select: '선택형' };
      return '<div class="jnl-col-item" data-idx="' + idx + '" draggable="true">' +
        '<span class="jnl-col-drag" title="드래그하여 순서 변경">⠿</span>' +
        '<div class="jnl-col-label"><input type="text" value="' + escapeHtml(col.label) + '" data-col-idx="' + idx + '" class="jnl-col-rename"></div>' +
        '<span class="jnl-col-type">' + (typeLabels[col.type] || col.type) + '</span>' +
        '<button class="jnl-col-del" data-col-idx="' + idx + '" title="삭제">✕</button>' +
      '</div>';
    }).join('');

    // 이름 변경 이벤트
    list.querySelectorAll('.jnl-col-rename').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(inp.dataset.colIdx, 10);
        var cols = loadJnlColumns();
        var newLabel = inp.value.trim();
        if (!newLabel) { inp.value = cols[idx].label; return; }
        cols[idx].label = newLabel;
        saveJnlColumns(cols);
        refreshJnlView();
      });
    });

    // 삭제 이벤트
    list.querySelectorAll('.jnl-col-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.colIdx, 10);
        var cols = loadJnlColumns();
        if (cols.length <= 1) { toast('최소 1개의 칼럼이 필요합니다'); return; }
        cols.splice(idx, 1);
        saveJnlColumns(cols);
        renderJnlColList();
        refreshJnlView();
      });
    });

    // 드래그 앤 드롭 순서 변경
    var dragIdx = null;
    list.querySelectorAll('.jnl-col-item').forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        dragIdx = parseInt(item.dataset.idx, 10);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('dragging');
        list.querySelectorAll('.jnl-col-item').forEach(function (el) { el.classList.remove('drag-over'); });
        dragIdx = null;
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.jnl-col-item').forEach(function (el) { el.classList.remove('drag-over'); });
        item.classList.add('drag-over');
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        var dropIdx = parseInt(item.dataset.idx, 10);
        if (dragIdx === null || dragIdx === dropIdx) return;
        var cols = loadJnlColumns();
        var moved = cols.splice(dragIdx, 1)[0];
        cols.splice(dropIdx, 0, moved);
        saveJnlColumns(cols);
        renderJnlColList();
        refreshJnlView();
      });
    });
  }

  function refreshJnlView() {
    renderJnlHeader();
    populateJnlCategoryFilter();
    populateJnlColFilters();
    renderJnlTable();
  }

  // 칼럼 관리 패널 열기/닫기
  $('#jnl-col-manage').addEventListener('click', function () {
    var panel = $('#jnl-col-panel');
    var visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : '';
    if (!visible) renderJnlColList();
  });

  $('#jnl-col-panel-close').addEventListener('click', function () {
    $('#jnl-col-panel').style.display = 'none';
  });

  // 새 칼럼 추가
  $('#jnl-col-add').addEventListener('click', function () {
    var labelInput = $('#jnl-col-new-label');
    var typeSelect = $('#jnl-col-new-type');
    var label = labelInput.value.trim();
    if (!label) { toast('칼럼 이름을 입력해주세요'); return; }

    var cols = loadJnlColumns();
    // key 생성: label을 간단한 영문 키로 변환
    var key = 'col_' + Date.now();
    var type = typeSelect.value;
    var filterable = (type === 'text' || type === 'select') ? 'select' : 'input';

    cols.push({ key: key, label: label, type: type, filterable: filterable });
    saveJnlColumns(cols);

    labelInput.value = '';
    renderJnlColList();
    refreshJnlView();
    toast('"' + label + '" 칼럼이 추가되었습니다');
  });

  // 기본값 복원
  $('#jnl-col-reset').addEventListener('click', function () {
    if (!confirm('칼럼 설정을 기본값으로 복원하시겠습니까?')) return;
    localStorage.removeItem(JNL_COLS_KEY);
    renderJnlColList();
    refreshJnlView();
    toast('칼럼이 기본값으로 복원되었습니다');
  });

  // ══════════════════════════════════════
  // 11. 포스트잇 메모 (자유 배치 드래그)
  // ══════════════════════════════════════
  var STICKY_KEY = 'fl_sticky_notes';
  var STICKY_VIS_KEY = 'fl_sticky_visible';
  var stickyColors = ['#fff9c4', '#c8e6c9', '#bbdefb', '#f8bbd0', '#ffe0b2', '#e1bee7'];
  var stickyZBase = 8100;
  var stickyZTop = stickyZBase;

  function loadStickies() {
    try { return JSON.parse(localStorage.getItem(STICKY_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveStickies(list) { localStorage.setItem(STICKY_KEY, JSON.stringify(list)); }
  function isStickyVisible() { return localStorage.getItem(STICKY_VIS_KEY) !== 'false'; }
  function setStickyVisible(v) { localStorage.setItem(STICKY_VIS_KEY, v ? 'true' : 'false'); }

  function clampPos(x, y, w, h) {
    var vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(0, Math.min(x, vw - Math.min(w, 60))),
      y: Math.max(0, Math.min(y, vh - 30))
    };
  }

  function renderAllStickies() {
    var container = $('#sticky-container');
    container.innerHTML = '';
    var notes = loadStickies();
    var visible = isStickyVisible();
    notes.forEach(function (n, i) { createStickyEl(n, i, container, visible); });
  }

  function createStickyEl(note, idx, container, visible) {
    var el = document.createElement('div');
    el.className = 'sticky-float-note' + (note.minimized ? ' sticky-minimized' : '');
    el.dataset.idx = idx;
    var bg = note.color || stickyColors[idx % stickyColors.length];
    el.style.background = bg;
    el.style.left = (note.x || 100 + idx * 30) + 'px';
    el.style.top = (note.y || 100 + idx * 30) + 'px';
    el.style.width = (note.w || 220) + 'px';
    el.style.zIndex = stickyZBase + idx;
    if (!visible) el.style.display = 'none';

    el.innerHTML =
      '<div class="sticky-float-header" data-drag="header">' +
        '<span class="sticky-float-title">\uD83D\uDCCC</span>' +
        '<div class="sticky-float-btns">' +
          '<button class="sticky-fbtn" data-action="color" title="색상 변경">\uD83C\uDFA8</button>' +
          '<button class="sticky-fbtn" data-action="minimize" title="최소화">\u2500</button>' +
          '<button class="sticky-fbtn" data-action="add" title="새 메모">+</button>' +
          '<button class="sticky-fbtn sticky-fbtn-del" data-action="del" title="삭제">\u2715</button>' +
        '</div>' +
      '</div>' +
      '<div class="sticky-float-body">' +
        '<div class="sticky-float-text" contenteditable="true">' + sanitizeJnlHtml(note.text || '') + '</div>' +
      '</div>' +
      '<div class="sticky-float-resize" data-drag="resize"></div>';

    container.appendChild(el);

    // ── 드래그 이동 ──
    var header = el.querySelector('[data-drag="header"]');
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDragTouch, { passive: false });

    function startDrag(e) {
      if (e.target.closest('.sticky-fbtn')) return;
      e.preventDefault();
      bringToFront(el, idx);
      var startX = e.clientX, startY = e.clientY;
      var origLeft = el.offsetLeft, origTop = el.offsetTop;
      function onMove(ev) {
        var dx = ev.clientX - startX, dy = ev.clientY - startY;
        var p = clampPos(origLeft + dx, origTop + dy, el.offsetWidth, el.offsetHeight);
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveStickyPos(idx, el);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function startDragTouch(e) {
      if (e.target.closest('.sticky-fbtn')) return;
      e.preventDefault();
      bringToFront(el, idx);
      var t = e.touches[0];
      var startX = t.clientX, startY = t.clientY;
      var origLeft = el.offsetLeft, origTop = el.offsetTop;
      function onMove(ev) {
        var ct = ev.touches[0];
        var dx = ct.clientX - startX, dy = ct.clientY - startY;
        var p = clampPos(origLeft + dx, origTop + dy, el.offsetWidth, el.offsetHeight);
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
      }
      function onEnd() {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        saveStickyPos(idx, el);
      }
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    // ── 리사이즈 ──
    var resizeHandle = el.querySelector('[data-drag="resize"]');
    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResizeTouch, { passive: false });

    function startResize(e) {
      e.preventDefault();
      e.stopPropagation();
      bringToFront(el, idx);
      var startX = e.clientX, startW = el.offsetWidth;
      function onMove(ev) {
        var nw = Math.max(160, startW + (ev.clientX - startX));
        el.style.width = nw + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveStickyPos(idx, el);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    function startResizeTouch(e) {
      e.preventDefault();
      e.stopPropagation();
      bringToFront(el, idx);
      var t = e.touches[0];
      var startX = t.clientX, startW = el.offsetWidth;
      function onMove(ev) {
        var ct = ev.touches[0];
        var nw = Math.max(160, startW + (ct.clientX - startX));
        el.style.width = nw + 'px';
      }
      function onEnd() {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        saveStickyPos(idx, el);
      }
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    // ── 포커스 시 맨 앞으로 ──
    el.addEventListener('mousedown', function () { bringToFront(el, idx); });

    // ── 텍스트 편집 blur → 저장 ──
    var textEl = el.querySelector('.sticky-float-text');
    textEl.addEventListener('blur', function () {
      var notes = loadStickies();
      if (notes[idx]) { notes[idx].text = textEl.innerHTML; saveStickies(notes); }
    });

    // ── 버튼 동작 ──
    el.querySelectorAll('.sticky-fbtn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var action = btn.dataset.action;
        var notes = loadStickies();
        if (action === 'del') {
          if (notes.length > 0) {
            notes.splice(idx, 1);
            saveStickies(notes);
            renderAllStickies();
          }
        } else if (action === 'color') {
          if (notes[idx]) {
            var curColor = notes[idx].color || stickyColors[idx % stickyColors.length];
            var ci = stickyColors.indexOf(curColor);
            notes[idx].color = stickyColors[(ci + 1) % stickyColors.length];
            saveStickies(notes);
            el.style.background = notes[idx].color;
          }
        } else if (action === 'minimize') {
          if (notes[idx]) {
            notes[idx].minimized = !notes[idx].minimized;
            saveStickies(notes);
            el.classList.toggle('sticky-minimized', notes[idx].minimized);
          }
        } else if (action === 'add') {
          addStickyNote();
        }
      });
    });
  }

  function bringToFront(el) {
    stickyZTop++;
    el.style.zIndex = stickyZTop;
  }

  function saveStickyPos(idx, el) {
    var notes = loadStickies();
    if (!notes[idx]) return;
    notes[idx].x = el.offsetLeft;
    notes[idx].y = el.offsetTop;
    notes[idx].w = el.offsetWidth;
    saveStickies(notes);
  }

  function addStickyNote() {
    var notes = loadStickies();
    var offset = notes.length * 25;
    var cx = Math.min(window.innerWidth - 260, 200 + offset);
    var cy = Math.min(window.innerHeight - 200, 120 + offset);
    notes.push({
      text: '',
      x: cx, y: cy, w: 220,
      color: stickyColors[notes.length % stickyColors.length],
      minimized: false,
      createdAt: new Date().toISOString()
    });
    saveStickies(notes);
    setStickyVisible(true);
    renderAllStickies();
    // 새 메모에 포커스
    var allNotes = document.querySelectorAll('.sticky-float-note');
    var last = allNotes[allNotes.length - 1];
    if (last) {
      bringToFront(last);
      var txt = last.querySelector('.sticky-float-text');
      if (txt) txt.focus();
    }
  }

  // ── 토글 버튼 (좌클릭=토글, 우클릭=새 메모) ──
  var _stickyClickTimer = null;
  $('#sticky-toggle').addEventListener('click', function () {
    // 싱글 클릭 → 토글
    var notes = loadStickies();
    if (notes.length === 0) {
      addStickyNote();
      return;
    }
    var vis = isStickyVisible();
    setStickyVisible(!vis);
    var allEls = document.querySelectorAll('.sticky-float-note');
    allEls.forEach(function (n) { n.style.display = vis ? 'none' : ''; });
  });

  $('#sticky-toggle').addEventListener('dblclick', function (e) {
    e.preventDefault();
    addStickyNote();
  });

  $('#sticky-toggle').addEventListener('contextmenu', function (e) {
    e.preventDefault();
    addStickyNote();
  });

  // ── 회의 Draft 자동 저장 (뒤로가기/탭 전환/페이지 이탈) ──
  window.addEventListener('beforeunload', function () {
    saveMeetingDraft();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      saveMeetingDraft();
    }
  });

  // 탭 전환 시에도 draft 저장
  $$('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      saveMeetingDraft();
    });
  });

  // ── Init ──
  function init() {
    renderContextList();
    renderIdeaBoard();
    renderMeetingList();
    renderAgendaList();
    renderProposalList();
    populateFolderFilter();
    renderTaskList();
    renderJnlHeader();
    renderJnlTable();
    populateJnlCategoryFilter();
    populateJnlColFilters();
    renderAllStickies();

    // 임시 저장된 회의 draft 복원
    var draft = loadMeetingDraft();
    if (draft) {
      // 회의 탭에 draft 복원 알림 표시
      var restoreBar = document.createElement('div');
      restoreBar.id = 'mtg-draft-bar';
      restoreBar.className = 'mtg-draft-bar';
      restoreBar.innerHTML = '<span>임시 저장된 회의가 있습니다</span>' +
        '<button class="btn btn-primary btn-small" id="mtg-draft-restore">이어서 작성</button>' +
        '<button class="btn btn-ghost btn-small" id="mtg-draft-discard">삭제</button>';
      var typeSelect = $('#mtg-type-select');
      typeSelect.insertBefore(restoreBar, typeSelect.firstChild);

      $('#mtg-draft-restore').addEventListener('click', function () {
        restoreBar.remove();
        restoreMeetingDraft(draft);
      });
      $('#mtg-draft-discard').addEventListener('click', function () {
        clearMeetingDraft();
        restoreBar.remove();
        toast('임시 저장이 삭제되었습니다');
      });
    }
  }

  init();
})();
