/* «Новичок» — приложение. Чистый JS, без сборки. Состояние в localStorage. */
(function () {
  'use strict';

  var N = window.NOVICHOK;
  var U = N.util;
  var TODAY = N.DEMO_TODAY;
  var STORAGE_KEY = 'novichok-state';
  var WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var ALL_MANAGERS = 'all-managers';

  /* ---------- состояние ---------- */
  function freshState() {
    var init = JSON.parse(JSON.stringify(N.initial));
    return {
      version: N.DATA_VERSION,
      employees: init.employees,
      tasks: init.tasks,
      taskNum: init.taskNum,
      ui: { role: 'newbie', formEmp: init.demoEmployeeId, manager: ALL_MANAGERS, hrDept: 'all', expanded: null }
    };
  }
  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.version !== N.DATA_VERSION || !Array.isArray(s.employees)) return null;
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  }
  function clearSaved() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  var state = load() || freshState();
  function emptyView() { return { formDone: null, formErrors: {}, draft: {}, action: null, actionError: null }; }
  var view = emptyView(); // временное состояние экрана, не сохраняется

  /* ---------- помощники ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) { if (!iso) return '—'; var p = iso.slice(0, 10).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function fmtDateWd(iso) { return fmtDate(iso) + ' (' + WD[U.weekday(iso)] + ')'; }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function nowStamp() {
    var d = new Date();
    return TODAY + 'T' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':' + U.pad(d.getSeconds());
  }
  function emp(id) { for (var i = 0; i < state.employees.length; i++) if (state.employees[i].id === id) return state.employees[i]; return null; }
  function person(id) {
    if (id === N.HR_MANAGER.id) return N.HR_MANAGER;
    for (var i = 0; i < N.MANAGERS.length; i++) if (N.MANAGERS[i].id === id) return N.MANAGERS[i];
    return null;
  }
  function deptName(id) { for (var i = 0; i < N.DEPARTMENTS.length; i++) if (N.DEPARTMENTS[i].id === id) return N.DEPARTMENTS[i].name; return id; }
  function day(e) { return U.dayOfWork(e, TODAY); }
  function isNewbie(e) { var d = day(e); return e.status === 'working' && d >= 1 && d <= 90; }
  function newbies() { return state.employees.filter(isNewbie); }
  function upcoming() { return state.employees.filter(function (e) { return e.status === 'upcoming'; }); }
  function findTask(id) { for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].id === id) return state.tasks[i]; return null; }
  function openTasksOf(e, type) {
    return state.tasks.filter(function (t) { return t.empId === e.id && t.status === 'open' && (!type || t.type === type); });
  }

  /* ---------- статус новичка для HR ---------- */
  function lastTalk(e) { return e.talks.length ? e.talks[e.talks.length - 1] : null; }
  function hrStatus(e) {
    var reasons = N.computeRisk(e, TODAY);
    var talk = lastTalk(e);
    var la = U.lastAnswered(e);
    if (talk && (!la || talk.at >= la.answer.answeredAt)) return { kind: 'talk', label: 'Разговор состоялся', reasons: reasons, talk: talk };
    var hard = reasons.filter(function (r) { return r.code !== 'missed'; });
    if (hard.length) return { kind: 'risk', label: 'Риск', reasons: reasons };
    if (reasons.length) return { kind: 'missed', label: 'Не ответил', reasons: reasons };
    return { kind: 'ok', label: 'В порядке', reasons: [] };
  }
  var STATUS_ORDER = { risk: 0, missed: 1, talk: 2, ok: 3 };

  /* ---------- контрольная точка для формы ---------- */
  function targetPoint(e) {
    var due = e.checkins.filter(function (c) { return c.date <= TODAY; });
    for (var i = due.length - 1; i >= 0; i--) if (!due[i].answer) return due[i];
    var next = e.checkins.filter(function (c) { return c.date > TODAY; })[0];
    return next || e.checkins[e.checkins.length - 1];
  }
  function periodPhrase(dayN) {
    if (dayN <= 7) return 'первая неделя';
    if (dayN <= 30) return 'первый месяц';
    return 'первые два месяца';
  }

  /* ---------- задачи ---------- */
  function createTask(t) {
    state.taskNum += 1;
    t.num = state.taskNum;
    t.id = 't' + t.num;
    t.status = 'open'; t.result = null; t.closedAt = null;
    state.tasks.push(t);
    return t;
  }
  function closeTask(t, status, result) { t.status = status; t.result = result; t.closedAt = nowStamp(); }

  var TASK_TITLES = {
    talk: function () { return 'Поговорить с новичком'; },
    nudge: function (t) { return 'Узнать у новичка, как дела: не ответил на опрос ' + t.point + '-го дня'; },
    mentor: function () { return 'Назначить наставника'; },
    onboard: function () { return 'Подготовить выход: назначить наставника, выдать график на 2 недели'; }
  };
  function taskTitle(t) { return TASK_TITLES[t.type](t); }
  function taskTag(t) {
    if (t.type === 'talk') return t.assigneeId === N.HR_MANAGER.id ? 'Риск ухода · у HR' : 'Риск ухода';
    return { nudge: 'Не ответил', mentor: 'Наставник', onboard: 'Скоро выход' }[t.type];
  }
  function taskDescription(t) {
    var e = emp(t.empId);
    var lines = ['Новичок: ' + e.name + ', ' + e.position + ' (' + deptName(e.deptId) + ').'];
    if (t.type === 'talk') {
      lines.push('День работы: ' + t.dayAtCreation + '.');
      lines.push('Почему:');
      t.reasons.forEach(function (r) { lines.push('— ' + r); });
      if (t.blocker) lines.push('Что мешает (ответ новичка): ' + t.blocker);
      if (t.assigneeId === N.HR_MANAGER.id) lines.push('Задача у HR: новичок отметил «Сложно с руководителем». Руководителю не показывается.');
      lines.push('Что сделать: короткий разговор 1:1, записать итог в задаче.');
    } else if (t.type === 'nudge') {
      lines.push('День работы: ' + t.dayAtCreation + '.');
      lines.push('Контрольная точка ' + t.point + ' дня наступила, ответа нет больше 2 дней.');
      lines.push('Что сделать: спросить лично, как дела, и записать итог.');
    } else if (t.type === 'mentor') {
      lines.push('Дата выхода: ' + fmtDate(e.hireDate) + '. Наставника нет.');
      lines.push('Что сделать: назначить наставника и отметить в задаче.');
    } else {
      lines.push('Дата выхода: ' + fmtDate(e.hireDate) + '.');
      lines.push('Нужно: назначить наставника и выдать график на первые 2 недели.');
    }
    lines.push('', 'Задача создана автоматически инструментом «Новичок».');
    return lines.join('\n');
  }
  function bitrixPayload(t) {
    return {
      fields: {
        TITLE: taskTitle(t) + ' — ' + emp(t.empId).name,
        RESPONSIBLE_ID: person(t.assigneeId).bitrixId,
        DEADLINE: t.deadline + 'T18:00:00+03:00',
        DESCRIPTION: taskDescription(t)
      }
    };
  }

  // «Не ответил» → задача руководителю. Вызывается при загрузке и после изменений.
  function syncNudgeTasks() {
    var changed = false;
    newbies().forEach(function (e) {
      var mp = U.missedPoint(e, TODAY);
      if (!mp) return;
      var exists = state.tasks.some(function (t) { return t.type === 'nudge' && t.empId === e.id && t.point === mp.day; });
      if (exists) return;
      createTask({
        type: 'nudge', empId: e.id, assigneeId: e.managerId, point: mp.day,
        createdAt: nowStamp(), deadline: U.addBusinessDays(TODAY, 1),
        reasons: [], blocker: '', dayAtCreation: day(e)
      });
      changed = true;
    });
    if (changed) save();
  }

  /* ---------- отправка ответа новичка ---------- */
  function submitAnswer(e, a) {
    var cp = targetPoint(e);
    a.answeredAt = nowStamp();
    cp.answer = a;
    openTasksOf(e, 'nudge').forEach(function (t) { closeTask(t, 'done', 'Новичок ответил на опрос'); });
    var created = null;
    if (N.isRiskyAnswer(a)) {
      openTasksOf(e, 'talk').forEach(function (t) { closeTask(t, 'cancelled', 'Заменена новой задачей по свежему ответу'); });
      created = createTask({
        type: 'talk', empId: e.id,
        assigneeId: N.routesToHR(a) ? N.HR_MANAGER.id : e.managerId,
        createdAt: a.answeredAt,
        deadline: U.addBusinessDays(TODAY, 2),
        reasons: N.computeRisk(e, TODAY).map(function (r) { return r.text; }),
        blocker: U.blockerText(a),
        dayAtCreation: day(e)
      });
    }
    save();
    return { empId: e.id, point: cp.day, task: created };
  }

  /* ================= ЭКРАН 1: НОВИЧОК ================= */
  function errHtml(name) { return view.formErrors[name] ? '<p class="err">' + view.formErrors[name] + '</p>' : ''; }

  function scaleField(name, label, hintLo, hintHi) {
    var val = view.draft[name];
    var btns = '';
    for (var i = 1; i <= 5; i++) {
      btns += '<label class="seg__opt"><input type="radio" name="' + name + '" value="' + i + '"' +
        (String(val) === String(i) ? ' checked' : '') + '><span>' + i + '</span></label>';
    }
    return '<fieldset class="q' + (view.formErrors[name] ? ' q--err' : '') + '" id="q-' + name + '">' +
      '<legend>' + label + ' <span class="req" aria-hidden="true">*</span></legend>' +
      '<div class="seg seg--5">' + btns + '</div>' +
      '<div class="seg__hints"><span>' + hintLo + '</span><span>' + hintHi + '</span></div>' +
      errHtml(name) + '</fieldset>';
  }

  function blockersField() {
    var chosen = view.draft.blockers || [];
    var opts = N.topBlockers(state.employees, TODAY, 5).map(function (b) { return { code: b.code, label: b.label }; })
      .concat([N.BLOCKER_OTHER, N.BLOCKER_NONE]);
    var chips = opts.map(function (o) {
      return '<label class="chip' + (o.code === 'none' ? ' chip--none' : '') + '">' +
        '<input type="checkbox" name="blockers" value="' + o.code + '"' + (chosen.indexOf(o.code) !== -1 ? ' checked' : '') + '>' +
        '<span><i class="chip__box" aria-hidden="true"></i>' + esc(o.label) + '</span></label>';
    }).join('');
    var showOther = chosen.indexOf('other') !== -1;
    return '<fieldset class="q' + (view.formErrors.blockers ? ' q--err' : '') + '" id="q-blockers">' +
      '<legend>Что мешает больше всего? <span class="req" aria-hidden="true">*</span> <span class="opt">можно несколько</span></legend>' +
      '<div class="chips">' + chips + '</div>' + errHtml('blockers') +
      '<div class="other' + (view.formErrors.blockerOther ? ' q--err' : '') + '" id="q-blockerOther"' + (showOther ? '' : ' hidden') + '>' +
      '<label for="blockerOther" class="q__label">Что именно?</label>' +
      '<input type="text" id="blockerOther" name="blockerOther" maxlength="200" autocomplete="off" placeholder="Напишите коротко" value="' + esc(view.draft.blockerOther || '') + '">' +
      errHtml('blockerOther') + '</div>' +
      '</fieldset>';
  }

  function renderNewbie() {
    var list = newbies().slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    var e = emp(state.ui.formEmp);
    if (!e || !isNewbie(e)) { e = list[0]; state.ui.formEmp = e ? e.id : null; }
    var opts = list.map(function (x) {
      return '<option value="' + x.id + '"' + (x === e ? ' selected' : '') + '>' + esc(x.name) + ' — ' + esc(deptName(x.deptId)) + ', день ' + day(x) + '</option>';
    }).join('');
    var picker = '<div class="demo-pick"><label for="pick-emp">Демо: чью ссылку открыть</label>' +
      '<select id="pick-emp" data-change="formEmp">' + opts + '</select></div>';
    if (!e) return picker + '<p class="muted">Нет новичков в первых 90 днях.</p>';

    if (view.formDone && view.formDone.empId === e.id) {
      var d = view.formDone;
      var hint;
      if (d.task) {
        var m = person(d.task.assigneeId);
        var toHR = d.task.assigneeId === N.HR_MANAGER.id;
        hint = '<div class="demo-note"><b>Демо:</b> ответ рискованный — создана задача №' + d.task.num +
          ' «Поговорить с новичком», ответственный — ' + esc(m.name) + ' (' + esc(m.position) + ')' +
          (toHR ? '. Новичок отметил «Сложно с руководителем», поэтому руководитель эту задачу не видит' : '') +
          '. <button type="button" class="link" data-action="role" data-role="manager">Открыть задачи →</button></div>';
      } else {
        hint = '<div class="demo-note"><b>Демо:</b> ответ без признаков риска — задача не создавалась.</div>';
      }
      return picker + '<section class="card form-card done">' +
        '<div class="done__icon" aria-hidden="true">✓</div>' +
        '<h1>Спасибо, ответ передан руководителю</h1>' +
        '<p class="muted">Контрольная точка ' + d.point + ' дня.</p>' +
        '<button type="button" class="btn btn--ghost" data-action="form-again">Заполнить ещё раз</button>' +
        '</section>' + hint;
    }

    var cp = targetPoint(e);
    var already = cp.answer ? '<p class="note">По точке ' + cp.day + ' дня уже есть ответ — новый ответ его заменит.</p>' : '';
    var early = cp.date > TODAY ? '<p class="note">Точка ' + cp.day + ' дня наступит ' + fmtDate(cp.date) + ' — для демо можно ответить заранее.</p>' : '';
    var hasErr = Object.keys(view.formErrors).length > 0;
    var dp = view.draft.hasPerson;

    return picker +
      '<section class="card form-card">' +
      '<p class="eyebrow">' + esc(deptName(e.deptId)) + ' · ' + esc(e.position) + ' · день ' + day(e) + '</p>' +
      '<h1>Как вам ' + periodPhrase(cp.day) + ', ' + esc(e.firstName) + '?</h1>' +
      '<p class="muted">4 вопроса, около минуты. Ответы помогают нам вовремя заметить, если что-то идёт не так.</p>' +
      already + early +
      '<form id="checkin" novalidate>' +
      scaleField('clarity', 'Понятно, что от вас ждут?', 'совсем нет', 'полностью') +
      '<fieldset class="q' + (view.formErrors.hasPerson ? ' q--err' : '') + '" id="q-hasPerson">' +
      '<legend>Есть, к кому обратиться с вопросом? <span class="req" aria-hidden="true">*</span></legend>' +
      '<div class="seg seg--2">' +
      '<label class="seg__opt"><input type="radio" name="hasPerson" value="yes"' + (dp === 'yes' ? ' checked' : '') + '><span>Да</span></label>' +
      '<label class="seg__opt"><input type="radio" name="hasPerson" value="no"' + (dp === 'no' ? ' checked' : '') + '><span>Нет</span></label>' +
      '</div>' + errHtml('hasPerson') + '</fieldset>' +
      blockersField() +
      scaleField('stay', 'Видите себя здесь через полгода?', 'точно нет', 'точно да') +
      (hasErr ? '<p class="err err--summary" role="alert">Ответьте на отмеченные вопросы.</p>' : '') +
      '<button type="submit" class="btn btn--primary btn--block">Отправить</button>' +
      '</form></section>';
  }

  function readForm(form) {
    var fd = new FormData(form);
    return {
      clarity: fd.get('clarity'),
      hasPerson: fd.get('hasPerson'),
      blockers: fd.getAll('blockers').map(String),
      blockerOther: (fd.get('blockerOther') || '').toString(),
      stay: fd.get('stay')
    };
  }

  function onSubmitCheckin(form) {
    var d = readForm(form);
    view.draft = d;
    var errs = {};
    if (!d.clarity) errs.clarity = 'Выберите от 1 до 5';
    if (!d.hasPerson) errs.hasPerson = 'Выберите «Да» или «Нет»';
    if (!d.blockers.length) errs.blockers = 'Отметьте хотя бы один вариант — или «Ничего не мешает»';
    else if (d.blockers.indexOf('other') !== -1 && !d.blockerOther.trim()) errs.blockerOther = 'Напишите, что мешает, или снимите «Другое»';
    if (!d.stay) errs.stay = 'Выберите от 1 до 5';
    view.formErrors = errs;
    if (Object.keys(errs).length) {
      render();
      var first = document.getElementById('q-' + Object.keys(errs)[0]);
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var inp = first.querySelector('input'); if (inp) inp.focus({ preventScroll: true });
      }
      return;
    }
    var e = emp(state.ui.formEmp);
    var res = submitAnswer(e, {
      clarity: +d.clarity,
      hasPerson: d.hasPerson === 'yes',
      blockers: d.blockers,
      blockerOther: d.blockers.indexOf('other') !== -1 ? d.blockerOther.trim() : '',
      stay: +d.stay
    });
    if (res.task) state.ui.manager = res.task.assigneeId;
    save();
    view.formDone = res;
    view.draft = {};
    render();
    window.scrollTo(0, 0);
  }

  // Чекбоксы помех: «Ничего не мешает» взаимоисключающий; «Другое» показывает поле
  function onBlockerToggle(input) {
    var form = input.form;
    var boxes = form.querySelectorAll('input[name="blockers"]');
    var i;
    if (input.checked && input.value === 'none') {
      for (i = 0; i < boxes.length; i++) if (boxes[i] !== input) boxes[i].checked = false;
    } else if (input.checked) {
      for (i = 0; i < boxes.length; i++) if (boxes[i].value === 'none') boxes[i].checked = false;
    }
    var otherOn = form.querySelector('input[name="blockers"][value="other"]').checked;
    var wrap = document.getElementById('q-blockerOther');
    wrap.hidden = !otherOn;
    if (otherOn && input.value === 'other' && input.checked) document.getElementById('blockerOther').focus();
    if (!otherOn) clearFieldError('blockerOther');
    var any = false;
    for (i = 0; i < boxes.length; i++) if (boxes[i].checked) any = true;
    if (any) clearFieldError('blockers');
  }
  function clearFieldError(name) {
    if (!view.formErrors[name]) return;
    delete view.formErrors[name];
    var fs = document.getElementById('q-' + name);
    if (fs) { fs.classList.remove('q--err'); var p = fs.querySelector(':scope > .err'); if (p) p.remove(); }
    if (!Object.keys(view.formErrors).length) { var s = document.querySelector('.err--summary'); if (s) s.remove(); }
  }

  /* ================= ЭКРАН 2: ЗАДАЧИ ================= */
  function taskCard(t) {
    var e = emp(t.empId);
    var m = person(t.assigneeId);
    var open = t.status === 'open';
    var overdue = open && t.deadline < TODAY;
    var body = '';

    var dayCell;
    if (t.type === 'talk' || t.type === 'nudge') dayCell = ['День работы', String(t.dayAtCreation)];
    else if (t.type === 'mentor') dayCell = ['День работы', String(day(e)) + ' · выход ' + fmtDate(e.hireDate)];
    else { var left = U.diffDays(e.hireDate, TODAY); dayCell = ['Выход', fmtDateWd(e.hireDate) + (left > 0 ? ' · через ' + left + ' ' + plural(left, 'день', 'дня', 'дней') : '')]; }

    body += '<dl class="meta">' +
      '<div><dt>Кому</dt><dd>' + esc(m.name) + ', ' + esc(m.position) + '</dd></div>' +
      '<div><dt>Срок</dt><dd class="' + (overdue ? 'danger' : '') + '">' + fmtDateWd(t.deadline) + (overdue ? ' · просрочена' : '') + '</dd></div>' +
      '<div><dt>Новичок</dt><dd>' + esc(e.name) + ', ' + esc(e.position.toLowerCase()) + ' · ' + esc(deptName(e.deptId)) + '</dd></div>' +
      '<div><dt>' + dayCell[0] + '</dt><dd>' + esc(dayCell[1]) + '</dd></div>' +
      '</dl>';

    var why;
    if (t.type === 'talk') {
      why = t.reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
      body += '<div class="why"><p class="why__h">Почему</p><ul>' + why + '</ul>' +
        (t.blocker ? '<p class="quote">Что мешает: ' + esc(t.blocker) + '</p>' : '') + '</div>';
    } else if (t.type === 'nudge') {
      body += '<div class="why"><p class="why__h">Почему</p><ul><li>Контрольная точка ' + t.point + ' дня наступила ' +
        fmtDate(U.addDays(e.hireDate, t.point - 1)) + ', ответа нет больше 2 дней.</li><li>Молчание на опросе — частый признак, что человек уже смотрит по сторонам.</li></ul></div>';
    } else if (t.type === 'mentor') {
      body += '<div class="why"><p class="why__h">Почему</p><ul><li>У новичка нет наставника — это фактор риска ранней текучки.</li></ul></div>';
    } else {
      body += '<div class="why"><p class="why__h">Почему</p><ul><li>Без наставника и понятного графика в первые недели новички уходят чаще.</li></ul></div>';
    }

    var actions = '';
    if (open) {
      var act = view.action && view.action.taskId === t.id ? view.action.kind : null;
      var err = view.actionError && act ? '<p class="err">' + esc(view.actionError) + '</p>' : '';
      if (t.type === 'talk' || t.type === 'nudge') {
        if (act === 'talk') {
          actions = '<div class="inline-form"><label for="talk-' + t.id + '">Итог разговора</label>' +
            '<input type="text" id="talk-' + t.id + '" maxlength="200" placeholder="Например: договорились о постоянном графике" autocomplete="off">' + err +
            '<div class="row"><button type="button" class="btn btn--primary" data-action="talk-save" data-task="' + t.id + '">Сохранить и закрыть</button>' +
            '<button type="button" class="btn btn--ghost" data-action="cancel-action">Отмена</button></div></div>';
        } else if (act === 'leave') {
          actions = '<div class="inline-form"><label for="leave-' + t.id + '">Причина ухода</label>' +
            '<select id="leave-' + t.id + '"><option value="">— выберите —</option>' +
            N.REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select>' + err +
            '<div class="row"><button type="button" class="btn btn--danger" data-action="leave-save" data-task="' + t.id + '">Подтвердить уход</button>' +
            '<button type="button" class="btn btn--ghost" data-action="cancel-action">Отмена</button></div></div>';
        } else {
          actions = '<div class="row"><button type="button" class="btn btn--primary" data-action="talk-open" data-task="' + t.id + '">Поговорил</button>' +
            '<button type="button" class="btn btn--ghost" data-action="leave-open" data-task="' + t.id + '">Отметить уход</button></div>';
        }
      } else if (t.type === 'mentor') {
        actions = '<div class="row"><button type="button" class="btn btn--primary" data-action="mentor-done" data-task="' + t.id + '">Наставник назначен</button></div>';
      } else {
        actions = '<div class="row"><button type="button" class="btn btn--primary" data-action="mentor-done" data-task="' + t.id + '">Готово: наставник и график</button></div>';
      }
    } else {
      var resLabel = t.status === 'cancelled' ? 'Отменена' : 'Закрыта';
      actions = '<p class="result"><b>' + resLabel + ' ' + fmtDate(t.closedAt) + ':</b> ' + esc(t.result || '') + '</p>';
    }

    var json = JSON.stringify(bitrixPayload(t), null, 2);
    return '<article class="task card' + (open ? '' : ' task--closed') + '" id="task-' + t.id + '">' +
      '<header class="task__head"><span class="tag tag--' + t.type + (t.assigneeId === N.HR_MANAGER.id ? ' tag--hr' : '') + '">' + taskTag(t) + '</span>' +
      '<span class="task__num">№' + t.num + ' · создана ' + fmtDate(t.createdAt) + '</span></header>' +
      '<h3 class="task__title">' + esc(taskTitle(t)) + '</h3>' +
      body + actions +
      '<details class="json"><summary>JSON для tasks.task.add</summary>' +
      '<p class="muted small">POST https://&lt;портал&gt;.bitrix24.ru/rest/&lt;user&gt;/&lt;webhook&gt;/tasks.task.add — в демо не отправляется.</p>' +
      '<pre><code>' + esc(json) + '</code></pre></details>' +
      '</article>';
  }

  var TYPE_ORDER = { talk: 0, nudge: 1, onboard: 2, mentor: 3 };
  function renderManager() {
    var sel = state.ui.manager;
    if (sel !== ALL_MANAGERS && !person(sel)) sel = state.ui.manager = ALL_MANAGERS;
    var opts = '<optgroup label="Руководители подразделений">' +
      '<option value="' + ALL_MANAGERS + '"' + (sel === ALL_MANAGERS ? ' selected' : '') + '>Все руководители подразделений</option>' +
      N.MANAGERS.map(function (m) {
        return '<option value="' + m.id + '"' + (sel === m.id ? ' selected' : '') + '>' + esc(m.name) + ' — ' + esc(m.position) + '</option>';
      }).join('') + '</optgroup>' +
      '<optgroup label="HR"><option value="' + N.HR_MANAGER.id + '"' + (sel === N.HR_MANAGER.id ? ' selected' : '') + '>' +
      esc(N.HR_MANAGER.name) + ' — ' + esc(N.HR_MANAGER.position) + '</option></optgroup>';
    // Задачи HR руководители не видят, даже в режиме «все руководители»
    var mine = state.tasks.filter(function (t) {
      return sel === ALL_MANAGERS ? t.assigneeId !== N.HR_MANAGER.id : t.assigneeId === sel;
    });
    var open = mine.filter(function (t) { return t.status === 'open'; }).sort(function (a, b) {
      return (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || (a.createdAt < b.createdAt ? 1 : -1);
    });
    var closed = mine.filter(function (t) { return t.status !== 'open'; }).sort(function (a, b) { return a.closedAt < b.closedAt ? 1 : -1; });
    var isHR = sel === N.HR_MANAGER.id;

    return '<div class="screen-head"><div><h1>' + (isHR ? 'Задачи HR' : 'Мои задачи') + '</h1><p class="muted">Битрикс24 (имитация) · сегодня ' + fmtDateWd(TODAY) + '</p></div>' +
      '<div class="field"><label for="pick-mgr">Чьи задачи смотреть</label><select id="pick-mgr" data-change="manager">' + opts + '</select></div></div>' +
      (isHR ? '<p class="note">Сюда приходят задачи, когда новичок отметил «Сложно с руководителем». Руководитель их не видит.</p>' : '') +
      '<p class="section-h">Открытые · ' + open.length + '</p>' +
      (open.length ? open.map(taskCard).join('') : '<p class="empty card">Открытых задач нет.</p>') +
      (closed.length ? '<details class="closed-list"><summary>Закрытые · ' + closed.length + '</summary>' + closed.map(taskCard).join('') + '</details>' : '');
  }

  function onTalkSave(t) {
    var inp = document.getElementById('talk-' + t.id);
    var text = inp ? inp.value.trim() : '';
    if (!text) { view.actionError = 'Напишите итог разговора в одну строку'; render(); focusEl('talk-' + t.id); return; }
    var e = emp(t.empId);
    closeTask(t, 'done', text);
    e.talks.push({ at: t.closedAt, outcome: text });
    view.action = null; view.actionError = null;
    save(); render();
  }
  function onLeaveSave(t) {
    var s = document.getElementById('leave-' + t.id);
    var reason = s ? s.value : '';
    if (!reason) { view.actionError = 'Выберите причину'; render(); focusEl('leave-' + t.id); return; }
    var e = emp(t.empId);
    e.status = 'fired'; e.fireDate = TODAY; e.fireReason = reason;
    state.tasks.forEach(function (x) {
      if (x.empId === e.id && x.status === 'open') closeTask(x, x === t ? 'done' : 'cancelled', x === t ? 'Новичок ушёл: ' + reason.toLowerCase() : 'Новичок ушёл');
    });
    view.action = null; view.actionError = null;
    save(); render();
  }
  function onMentorDone(t) {
    var e = emp(t.empId);
    e.mentor = true;
    closeTask(t, 'done', t.type === 'onboard' ? 'Наставник назначен, график на 2 недели выдан' : 'Наставник назначен');
    save(); render();
  }
  function focusEl(id) { var el = document.getElementById(id); if (el) el.focus(); }

  /* ================= ЭКРАН 3: HR ================= */
  function hrTaskFlag(e) {
    var hrTask = openTasksOf(e, 'talk').filter(function (t) { return t.assigneeId === N.HR_MANAGER.id; })[0];
    return hrTask ? '<span class="hr-flag">задача у HR: причина — руководитель</span>' : '';
  }
  function badge(st, e) {
    var reason = '';
    if (st.kind === 'risk' || st.kind === 'missed') reason = st.reasons.map(function (r) { return r.text; }).join('; ');
    if (st.kind === 'talk') reason = st.talk.outcome;
    return '<span class="badge badge--' + st.kind + '">' + st.label + '</span>' +
      (reason ? '<span class="badge__why">' + esc(reason) + '</span>' : '') + hrTaskFlag(e);
  }

  function historyBlock(e) {
    var st = hrStatus(e);
    var rows = e.checkins.map(function (c) {
      var body;
      if (c.answer) {
        var a = c.answer;
        body = '<ul class="answers">' +
          '<li>Понятно, что ждут: <b>' + a.clarity + ' из 5</b></li>' +
          '<li>Есть, к кому обратиться: <b class="' + (a.hasPerson ? '' : 'danger') + '">' + (a.hasPerson ? 'Да' : 'Нет') + '</b></li>' +
          '<li>Что мешает: <b class="' + ((a.blockers || []).indexOf('boss') !== -1 ? 'danger' : '') + '">' + esc(U.blockerText(a) || '—') + '</b></li>' +
          '<li>Видит себя здесь через полгода: <b class="' + (a.stay <= 2 ? 'danger' : '') + '">' + a.stay + ' из 5</b></li>' +
          '</ul><span class="muted small">Ответ ' + fmtDate(a.answeredAt) + '</span>';
      } else if (c.date > TODAY) {
        body = '<span class="muted">Ещё не наступила</span>';
      } else {
        var late = U.diffDays(TODAY, c.date);
        var isLatest = U.latestDue(e, TODAY) === c;
        body = late > 2
          ? '<span class="danger">' + (isLatest ? 'Не ответил' : 'Пропущена') + ' (прошло ' + late + ' дн.)</span>'
          : '<span class="muted">Ожидает ответа</span>';
      }
      return '<li class="cp"><div class="cp__h">Точка ' + c.day + ' дня · ' + fmtDate(c.date) + '</div>' + body + '</li>';
    }).join('');
    var talks = e.talks.length ? '<div class="talks"><p class="why__h">Разговоры</p><ul>' + e.talks.map(function (t) {
      return '<li>' + fmtDate(t.at) + ' — ' + esc(t.outcome) + '</li>';
    }).join('') + '</ul></div>' : '';
    var reasons = st.reasons.length ? '<div class="talks"><p class="why__h">Факторы риска сейчас</p><ul>' +
      st.reasons.map(function (r) { return '<li>' + esc(r.text) + '</li>'; }).join('') + '</ul></div>' : '';
    var m = person(e.managerId);
    return '<div class="hist">' +
      '<p class="muted small">' + esc(e.position) + ' · выход ' + fmtDate(e.hireDate) + ' · руководитель ' + esc(m.name) +
      ' · наставник: ' + (e.mentor ? 'есть' : '<span class="danger">нет</span>') + '</p>' +
      '<ol class="cps">' + rows + '</ol>' + reasons + talks + '</div>';
  }

  function bars(items) {
    var max = Math.max.apply(null, items.map(function (x) { return x.n; }).concat([1]));
    return '<ul class="bars">' + items.map(function (x) {
      return '<li><span class="bars__label">' + esc(x.label) + '</span>' +
        '<span class="bars__track"><span class="bars__fill" style="width:' + (x.n / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="bars__val">' + x.n + (x.of != null ? '<span class="muted"> из ' + x.of + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }

  function upcomingBlock(dept) {
    var list = upcoming().filter(function (e) { return dept === 'all' || e.deptId === dept; })
      .sort(function (a, b) { return a.hireDate < b.hireDate ? -1 : 1; });
    if (!list.length) return '';
    var rows = list.map(function (e) {
      var left = U.diffDays(e.hireDate, TODAY);
      var prep = state.tasks.filter(function (t) { return t.type === 'onboard' && t.empId === e.id; })[0];
      var prepTxt = prep && prep.status === 'open'
        ? '<span class="badge badge--missed">Подготовка: до ' + fmtDate(prep.deadline) + '</span>'
        : '<span class="badge badge--ok">Наставник и график готовы</span>';
      return '<tr><td>' + esc(e.name) + '<div class="muted small">' + esc(e.position) + '</div></td>' +
        '<td>' + esc(deptName(e.deptId)) + '</td>' +
        '<td class="num">' + fmtDate(e.hireDate) + '<div class="muted small">через ' + left + ' ' + plural(left, 'день', 'дня', 'дней') + '</div></td>' +
        '<td><span class="badge badge--soon">Скоро выход</span>' + prepTxt + '</td></tr>';
    }).join('');
    return '<h2 class="block-h">Скоро выход · ' + list.length + '</h2>' +
      '<div class="card table-wrap"><table class="tbl"><thead><tr><th>Новичок</th><th>Подразделение</th><th class="num">Выход</th><th>Статус</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  }

  function renderHR() {
    var all = newbies();
    var dept = state.ui.hrDept;
    var list = all.filter(function (e) { return dept === 'all' || e.deptId === dept; });
    var withSt = list.map(function (e) { return { e: e, st: hrStatus(e) }; });

    var riskN = 0, overdueN = 0;
    withSt.forEach(function (x) {
      if (x.st.kind === 'risk' || x.st.kind === 'missed') riskN++;
      if (x.st.reasons.some(function (r) { return r.code === 'missed'; })) overdueN++;
    });

    var yearAgo = U.addDays(TODAY, -365);
    var leftAll = state.employees.filter(function (e) {
      return e.status === 'fired' && e.fireDate >= yearAgo && (dept === 'all' || e.deptId === dept);
    });
    var leftEarly = leftAll.filter(U.isEarlyLeaver);
    var share = leftAll.length ? Math.round(leftEarly.length / leftAll.length * 100) : 0;

    var deptOpts = '<option value="all">Все подразделения</option>' + N.DEPARTMENTS.map(function (d) {
      return '<option value="' + d.id + '"' + (dept === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>';
    }).join('');

    var kpis = '<div class="kpis">' +
      kpi(list.length, 'сейчас ' + plural(list.length, 'новичок', 'новичка', 'новичков'), 'в первых 90 днях') +
      kpi(riskN, 'в зоне риска', 'риск или не ответил', riskN ? 'warn' : '') +
      kpi(overdueN, 'точки просрочены', 'нет ответа больше 2 дней', overdueN ? 'warn' : '') +
      kpi(leftEarly.length, 'ушли до 90 дней', 'за 12 мес · ' + share + '% от всех ушедших (' + leftAll.length + ')') +
      '</div>';

    withSt.sort(function (a, b) {
      return (STATUS_ORDER[a.st.kind] - STATUS_ORDER[b.st.kind]) || (day(b.e) - day(a.e));
    });
    var rows = withSt.map(function (x) {
      var e = x.e, exp = state.ui.expanded === e.id;
      return '<tr class="row-click' + (exp ? ' is-open' : '') + '" data-action="expand" data-emp="' + e.id + '" tabindex="0" aria-expanded="' + exp + '">' +
        '<td><span class="caret" aria-hidden="true">' + (exp ? '▾' : '▸') + '</span>' + esc(e.name) + '<div class="muted small">' + esc(e.position) + '</div></td>' +
        '<td>' + esc(deptName(e.deptId)) + '</td>' +
        '<td class="num">' + day(e) + '</td>' +
        '<td>' + badge(x.st, e) + '</td></tr>' +
        (exp ? '<tr class="detail"><td colspan="4">' + historyBlock(e) + '</td></tr>' : '');
    }).join('');

    // Где теряем новичков
    var byDept = N.DEPARTMENTS.filter(function (d) { return dept === 'all' || d.id === dept; }).map(function (d) {
      var of = leftAll.filter(function (e) { return e.deptId === d.id; }).length;
      return { label: d.name, n: leftEarly.filter(function (e) { return e.deptId === d.id; }).length, of: of };
    }).sort(function (a, b) { return b.n - a.n; });
    var byReason = N.REASONS.map(function (r) {
      return { label: r, n: leftEarly.filter(function (e) { return e.fireReason === r; }).length };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });

    var loss = '<section class="card loss"><h2>Где теряем новичков</h2>' +
      '<p class="muted">Ушли до 90 дней за 12 месяцев: <b>' + leftEarly.length + '</b> из ' + leftAll.length + ' ушедших (' + share + '%).</p>' +
      '<div class="loss__grid"><div><h3>По подразделениям</h3>' + bars(byDept) + '</div>' +
      '<div><h3>По причинам (из задач на увольнение)</h3>' + (byReason.length ? bars(byReason) : '<p class="muted">Нет данных</p>') +
      '<p class="fine">Варианты в опросе новичка строятся из этих же причин.</p></div></div>' +
      '<p class="fine">Данные выдуманные. Доля считается от всех ушедших.</p></section>';

    return '<div class="screen-head"><div><h1>Новички в первые 90 дней</h1><p class="muted">Сегодня ' + fmtDateWd(TODAY) + '</p></div>' +
      '<div class="field"><label for="pick-dept">Подразделение</label><select id="pick-dept" data-change="hrDept">' + deptOpts + '</select></div></div>' +
      kpis +
      '<details class="rule card"><summary>Правило риска</summary><p>Новичок в зоне риска, если выполнено хотя бы одно:</p><ul>' +
      '<li>нет наставника;</li><li>в последнем ответе «вижу себя здесь через полгода» — 2 из 5 или ниже;</li>' +
      '<li>в последнем ответе «есть, к кому обратиться» — Нет;</li>' +
      '<li>в последнем ответе отмечено «Сложно с руководителем» — задача уходит HR, а не руководителю;</li>' +
      '<li>контрольная точка (7, 30, 60 день) наступила, а ответа нет больше 2 дней — статус «не ответил», руководителю задача «Узнать, как дела».</li></ul>' +
      '<p class="muted small">Остальные отмеченные помехи сами по себе риском не считаются, но попадают в «Почему» задачи и в историю ответов. ' +
      'Никакого машинного обучения — только эти условия. После разговора статус — «разговор состоялся», пока новичок не ответит на следующую точку.</p></details>' +
      '<div class="card table-wrap"><table class="tbl"><thead><tr><th>Новичок</th><th>Подразделение</th><th class="num">День</th><th>Статус</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4" class="muted">Нет новичков</td></tr>') + '</tbody></table></div>' +
      upcomingBlock(dept) +
      loss;
  }
  function kpi(n, label, sub, mod) {
    return '<div class="kpi' + (mod ? ' kpi--' + mod : '') + '"><div class="kpi__n">' + n + '</div><div class="kpi__l">' + label + '</div><div class="kpi__s">' + sub + '</div></div>';
  }

  /* ---------- рендер ---------- */
  var app = document.getElementById('app');
  function render() {
    var role = state.ui.role;
    var btns = document.querySelectorAll('.roles button');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-role') === role;
      btns[i].classList.toggle('is-active', on);
      btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    app.className = 'container screen-' + role;
    app.innerHTML = role === 'manager' ? renderManager() : role === 'hr' ? renderHR() : renderNewbie();
  }

  /* ---------- события ---------- */
  var resetTimer = null;
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    var t = el.getAttribute('data-task') ? findTask(el.getAttribute('data-task')) : null;
    switch (a) {
      case 'role':
        state.ui.role = el.getAttribute('data-role');
        view.action = null; view.actionError = null;
        save(); render(); window.scrollTo(0, 0);
        break;
      case 'reset':
        // Подтверждение вторым нажатием: confirm() бывает заблокирован (встроенные браузеры, превью)
        if (!el.classList.contains('is-confirm')) {
          el.classList.add('is-confirm');
          el.textContent = 'Точно сбросить?';
          clearTimeout(resetTimer);
          resetTimer = setTimeout(function () { el.classList.remove('is-confirm'); el.textContent = 'Сбросить демо'; }, 4000);
          return;
        }
        clearTimeout(resetTimer);
        el.classList.remove('is-confirm'); el.textContent = 'Сбросить демо';
        clearSaved();
        state = freshState();
        view = emptyView();
        syncNudgeTasks();
        save(); render(); window.scrollTo(0, 0);
        break;
      case 'form-again':
        view.formDone = null; view.formErrors = {}; view.draft = {}; render();
        break;
      case 'talk-open': view.action = { taskId: t.id, kind: 'talk' }; view.actionError = null; render(); focusEl('talk-' + t.id); break;
      case 'leave-open': view.action = { taskId: t.id, kind: 'leave' }; view.actionError = null; render(); focusEl('leave-' + t.id); break;
      case 'cancel-action': view.action = null; view.actionError = null; render(); break;
      case 'talk-save': onTalkSave(t); break;
      case 'leave-save': onLeaveSave(t); break;
      case 'mentor-done': onMentorDone(t); break;
      case 'expand':
        var id = el.getAttribute('data-emp');
        state.ui.expanded = state.ui.expanded === id ? null : id;
        save(); render();
        break;
    }
  });
  document.addEventListener('keydown', function (ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('tr[data-action="expand"]')) {
      ev.preventDefault(); ev.target.click();
    }
    if (ev.key === 'Enter' && ev.target.id && ev.target.id.indexOf('talk-') === 0) {
      ev.preventDefault();
      var t = findTask(ev.target.id.slice(5)); if (t) onTalkSave(t);
    }
  });
  document.addEventListener('change', function (ev) {
    var target = ev.target;
    var key = target.getAttribute && target.getAttribute('data-change');
    if (key) {
      state.ui[key] = target.value;
      if (key === 'formEmp') view = emptyView();
      if (key === 'hrDept') state.ui.expanded = null;
      save(); render();
      return;
    }
    if (target.form && target.form.id === 'checkin') {
      if (target.name === 'blockers') onBlockerToggle(target);
      else clearFieldError(target.name);
    }
  });
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'blockerOther' && ev.target.value.trim()) clearFieldError('blockerOther');
  });
  document.addEventListener('submit', function (ev) {
    if (ev.target.id === 'checkin') { ev.preventDefault(); onSubmitCheckin(ev.target); }
  });

  document.getElementById('demo-date').textContent = 'Демо-дата: ' + fmtDateWd(TODAY);
  syncNudgeTasks();
  render();
})();
