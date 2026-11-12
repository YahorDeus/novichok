/* «Новичок» — демо-данные.
 * Генератор с фиксированным seed: при каждом запуске получаются одни и те же люди и ответы.
 * Все имена выдуманные. «Сегодня» для демо зафиксировано (DEMO_TODAY), чтобы дни работы
 * и просрочки не «уезжали» со временем.
 */
(function () {
  'use strict';

  var DEMO_TODAY = '2026-11-12';
  var SEED = 20261112;
  var DATA_VERSION = 5;

  /* ---------- случайные числа с seed ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(SEED);
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function wpick(pairs) {
    var total = 0, i;
    for (i = 0; i < pairs.length; i++) total += pairs[i][1];
    var r = rnd() * total;
    for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r < 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------- даты (ISO 'YYYY-MM-DD', считаем в UTC) ---------- */
  function toDays(iso) {
    var p = iso.slice(0, 10).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5);
  }
  function fromDays(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function addDays(iso, n) { return fromDays(toDays(iso) + n); }
  function diffDays(a, b) { return toDays(a) - toDays(b); }
  function weekday(iso) { return new Date(toDays(iso) * 864e5).getUTCDay(); }
  function isWorkday(iso) { var w = weekday(iso); return w !== 0 && w !== 6; }
  function addBusinessDays(iso, n) {
    var step = n < 0 ? -1 : 1, left = Math.abs(n), d = iso;
    while (left > 0) { d = addDays(d, step); if (isWorkday(d)) left--; }
    return d;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(iso, h, m) { return iso + 'T' + pad(h) + ':' + pad(m) + ':00'; }

  /* ---------- справочники ---------- */
  var DEPARTMENTS = [
    { id: 'wh', name: 'Склад', weight: 34, positions: [['Кладовщик', 3], ['Комплектовщик', 4], ['Грузчик', 2], ['Водитель погрузчика', 1]] },
    { id: 's1', name: 'Магазин №1', weight: 16, positions: [['Продавец-консультант', 4], ['Кассир', 2], ['Старший продавец', 1]] },
    { id: 's2', name: 'Магазин №2', weight: 15, positions: [['Продавец-консультант', 4], ['Кассир', 2], ['Старший продавец', 1]] },
    { id: 's3', name: 'Магазин №3', weight: 13, positions: [['Продавец-консультант', 4], ['Кассир', 2], ['Старший продавец', 1]] },
    { id: 'sales', name: 'Отдел продаж', weight: 12, positions: [['Менеджер по продажам', 4], ['Менеджер по работе с клиентами', 2]] },
    { id: 'office', name: 'Офис', weight: 10, positions: [['Бухгалтер', 2], ['Специалист по закупкам', 2], ['Офис-менеджер', 1], ['Маркетолог', 1]] }
  ];

  // Руководители подразделений (выдуманные). bitrixId — как был бы ID пользователя в Битрикс24.
  var MANAGERS = [
    { id: 'm-wh', deptId: 'wh', name: 'Сергей Ветлугин', position: 'Начальник склада', bitrixId: 14 },
    { id: 'm-s1', deptId: 's1', name: 'Ольга Сафронова', position: 'Директор магазина №1', bitrixId: 21 },
    { id: 'm-s2', deptId: 's2', name: 'Марина Колесникова', position: 'Директор магазина №2', bitrixId: 22 },
    { id: 'm-s3', deptId: 's3', name: 'Андрей Камышин', position: 'Директор магазина №3', bitrixId: 23 },
    { id: 'm-sales', deptId: 'sales', name: 'Татьяна Ремезова', position: 'Руководитель отдела продаж', bitrixId: 30 },
    { id: 'm-office', deptId: 'office', name: 'Елена Брусникина', position: 'Руководитель офиса', bitrixId: 35 }
  ];
  // HR-менеджер: получает задачи, когда новичку «сложно с руководителем».
  var HR_MANAGER = { id: 'hr', deptId: null, name: 'Ирина Солнцева', position: 'HR-менеджер', bitrixId: 7 };

  // Причины увольнения — как в задачах на увольнение в Битрикс24.
  var REASONS = [
    'График',
    'Зарплата не такая, как обещали',
    'Не хватает обучения / непонятны обязанности',
    'Не сложилось с коллективом',
    'Сложно с руководителем',
    'Тяжёлая нагрузка',
    'Нашёл другую работу',
    'Личные причины'
  ];

  // Помехи для опроса новичка: те же причины, но от лица новичка.
  // «Нашёл другую работу» и «Личные причины» — не помехи, в опрос не попадают.
  var BLOCKERS = [
    { code: 'schedule', reason: 'График', label: 'Неудобный или меняющийся график' },
    { code: 'pay', reason: 'Зарплата не такая, как обещали', label: 'Зарплата не такая, как обещали' },
    { code: 'training', reason: 'Не хватает обучения / непонятны обязанности', label: 'Не хватает обучения, непонятно, что от меня ждут' },
    { code: 'team', reason: 'Не сложилось с коллективом', label: 'Не складываются отношения в коллективе' },
    { code: 'boss', reason: 'Сложно с руководителем', label: 'Сложно с руководителем' },
    { code: 'load', reason: 'Тяжёлая нагрузка', label: 'Слишком тяжёлая нагрузка' }
  ];
  var BLOCKER_OTHER = { code: 'other', label: 'Другое' };
  var BLOCKER_NONE = { code: 'none', label: 'Ничего не мешает' };

  function blockerLabel(code) {
    if (code === 'other') return BLOCKER_OTHER.label;
    if (code === 'none') return BLOCKER_NONE.label;
    for (var i = 0; i < BLOCKERS.length; i++) if (BLOCKERS[i].code === code) return BLOCKERS[i].label;
    return code;
  }
  // Текст «что мешает» для задачи и истории: «Неудобный график; Другое: «…»»
  function blockerText(a) {
    if (!a || !a.blockers || !a.blockers.length) return '';
    return a.blockers.map(function (c) {
      return c === 'other' ? 'Другое: «' + (a.blockerOther || '') + '»' : blockerLabel(c);
    }).join('; ');
  }
  function hasRealBlocker(a) {
    return !!(a && a.blockers && a.blockers.some(function (c) { return c !== 'none'; }));
  }

  function isEarlyLeaver(e) { return e.status === 'fired' && diffDays(e.fireDate, e.hireDate) < 90; }

  // Самые частые причины ранних уходов (до 90 дней) за 12 месяцев, только «помехи».
  // Порядок — по частоте, при равенстве — по порядку в справочнике.
  function topBlockers(employees, today, n) {
    var yearAgo = addDays(today, -365);
    var counts = {};
    employees.forEach(function (e) {
      if (isEarlyLeaver(e) && e.fireDate >= yearAgo) counts[e.fireReason] = (counts[e.fireReason] || 0) + 1;
    });
    return BLOCKERS.map(function (b, i) { return { code: b.code, label: b.label, reason: b.reason, count: counts[b.reason] || 0, i: i }; })
      .filter(function (b) { return b.count > 0; })
      .sort(function (a, b) { return (b.count - a.count) || (a.i - b.i); })
      .slice(0, n || 5);
  }

  var MALE = ['Артём', 'Максим', 'Иван', 'Дмитрий', 'Никита', 'Егор', 'Кирилл', 'Илья', 'Роман', 'Тимур',
    'Глеб', 'Арсений', 'Степан', 'Матвей', 'Денис', 'Павел', 'Олег', 'Ярослав', 'Фёдор', 'Руслан'];
  var FEMALE = ['Анна', 'Мария', 'Дарья', 'Полина', 'Алина', 'Виктория', 'Ксения', 'Екатерина', 'Софья', 'Вероника',
    'Ульяна', 'Елизавета', 'Арина', 'Таисия', 'Милена', 'Злата', 'Яна', 'Варвара', 'Кристина', 'Надежда'];
  var SURNAMES = ['Белозёров', 'Тихонравов', 'Ларионов', 'Кудрявцев', 'Ермолин', 'Зотов', 'Савельев', 'Мальцев',
    'Горшков', 'Щукин', 'Лапин', 'Вершинин', 'Рябинин', 'Сорокин', 'Куликов', 'Наумов', 'Фомин', 'Голованов',
    'Стрельцов', 'Дроздов', 'Журавлёв', 'Карпов', 'Полозов', 'Ухтомцев', 'Березин', 'Ситников', 'Лыков',
    'Бобров', 'Мухин', 'Абрамцев', 'Глинский', 'Ольховский', 'Седых', 'Черных'];

  function femSurname(s) {
    if (/(ский|цкий)$/.test(s)) return s.replace(/ий$/, 'ая');
    if (/(ов|ев|ёв|ин)$/.test(s)) return s + 'а';
    return s; // Седых, Черных — не склоняются
  }
  var usedNames = {};
  function makeName() {
    for (;;) {
      var female = rnd() < 0.45;
      var first = female ? pick(FEMALE) : pick(MALE);
      var sur = pick(SURNAMES);
      var full = first + ' ' + (female ? femSurname(sur) : sur);
      if (!usedNames[full]) { usedNames[full] = 1; return { name: full, first: first, female: female }; }
    }
  }

  /* ---------- сотрудники ---------- */
  var HIRES_TOTAL = 120;
  var ACTIVE_NEW = 27;      // сейчас в первых 90 днях
  var LATE_LEAVERS = 30;    // ушли после 90 дней
  var UPCOMING = 3;         // выходят через 3–5 дней

  // Причины ранних уходов (15 человек). Распределение задано здесь, а опрос новичка
  // считает частоты из получившейся истории (topBlockers).
  var EARLY_REASON_POOL = [
    'График', 'График', 'График', 'График',
    'Зарплата не такая, как обещали', 'Зарплата не такая, как обещали', 'Зарплата не такая, как обещали',
    'Не хватает обучения / непонятны обязанности', 'Не хватает обучения / непонятны обязанности', 'Не хватает обучения / непонятны обязанности',
    'Сложно с руководителем', 'Сложно с руководителем',
    'Не сложилось с коллективом',
    'Нашёл другую работу',
    'Личные причины'
  ];
  var lateReasons = [['Нашёл другую работу', 5], ['Личные причины', 3], ['Зарплата не такая, как обещали', 2],
    ['График', 2], ['Тяжёлая нагрузка', 2], ['Не сложилось с коллективом', 1], ['Сложно с руководителем', 1]];

  var deptPairs = DEPARTMENTS.map(function (d) { return [d, d.weight]; });
  function managerOf(deptId) { for (var i = 0; i < MANAGERS.length; i++) if (MANAGERS[i].deptId === deptId) return MANAGERS[i]; }

  function makeEmployee(idx, hireDate, mentor) {
    var dept = wpick(deptPairs);
    var n = makeName();
    return {
      id: 'e' + (101 + idx), name: n.name, firstName: n.first, female: n.female,
      deptId: dept.id, position: wpick(dept.positions), managerId: managerOf(dept.id).id,
      hireDate: hireDate, mentor: mentor, status: 'working',
      fireDate: null, fireReason: null, checkins: [], talks: []
    };
  }

  var employees = [];
  for (var i = 0; i < HIRES_TOTAL; i++) {
    var isActive = i < ACTIVE_NEW;
    var hireAgo;
    if (isActive) {
      var tenure = Math.min(88, Math.max(2, 2 + Math.round(i * 86 / (ACTIVE_NEW - 1)) + ri(-1, 1)));
      hireAgo = tenure - 1;
    } else {
      hireAgo = ri(92, 364);
    }
    employees.push(makeEmployee(i, addDays(DEMO_TODAY, -hireAgo), isActive ? rnd() < 0.62 : rnd() < 0.6));
  }

  var active = employees.slice(0, ACTIVE_NEW);
  var history = employees.slice(ACTIVE_NEW);

  // Ранние уходы: чаще склад/магазины и без наставника
  var scored = history.map(function (e) {
    var bias = (e.deptId === 'wh' || /^s\d$/.test(e.deptId)) ? 0.35 : 0;
    if (!e.mentor) bias += 0.45;
    return { e: e, s: rnd() + bias };
  }).sort(function (a, b) { return b.s - a.s; });

  var earlyPool = shuffle(EARLY_REASON_POOL.slice());
  scored.slice(0, earlyPool.length).forEach(function (x, k) {
    var e = x.e;
    e.status = 'fired';
    e.fireDate = addDays(e.hireDate, ri(4, 86));
    e.fireReason = earlyPool[k];
  });
  var lateCandidates = shuffle(scored.slice(earlyPool.length).map(function (x) { return x.e; })
    .filter(function (e) { return diffDays(DEMO_TODAY, e.hireDate) >= 120; }));
  lateCandidates.slice(0, LATE_LEAVERS).forEach(function (e) {
    e.status = 'fired';
    e.fireDate = addDays(e.hireDate, ri(91, diffDays(DEMO_TODAY, e.hireDate) - 1));
    e.fireReason = wpick(lateReasons);
  });

  /* ---------- контрольные точки ---------- */
  var POINTS = [7, 30, 60];
  var OTHER_TEXTS = [
    'Далеко добираться после закрытия магазина',
    'Касса зависает, а спросить некого',
    'Непонятно, как считается премия',
    'Нет шкафчика для вещей, всё ношу с собой'
  ];
  // Помехи в сгенерированных ответах (без «сложно с руководителем» — его показывает сценарий 2)
  var SEED_BLOCKERS = ['schedule', 'pay', 'training', 'team', 'load'];

  function pointDate(e, day) { return addDays(e.hireDate, day - 1); }
  function dayOfWork(e, today) { return diffDays(today || DEMO_TODAY, e.hireDate) + 1; }

  function genBlockers(profile) {
    if (profile === 'ok') return rnd() < 0.7 ? { blockers: ['none'] } : { blockers: [pick(['training', 'load'])] };
    if (profile === 'quiet' && rnd() < 0.5) return { blockers: ['none'] };
    var list = shuffle(SEED_BLOCKERS.slice()).slice(0, profile === 'shaky' ? ri(1, 2) : 1);
    var res = { blockers: list };
    if (profile === 'shaky' && rnd() < 0.3) { list.push('other'); res.blockerOther = pick(OTHER_TEXTS); }
    return res;
  }
  function genAnswer(profile, idx) {
    var a;
    if (profile === 'ok') a = { clarity: ri(4, 5), hasPerson: rnd() < 0.95, stay: ri(4, 5) };
    else if (profile === 'shaky') a = { clarity: ri(2, 3), hasPerson: idx === 0 ? rnd() < 0.7 : rnd() < 0.45, stay: idx === 0 ? ri(3, 4) : ri(1, 3) };
    else a = { clarity: ri(3, 4), hasPerson: rnd() < 0.8, stay: ri(3, 4) };
    var b = genBlockers(profile);
    a.blockers = b.blockers;
    a.blockerOther = b.blockerOther || '';
    return a;
  }

  var profiles = {};
  active.forEach(function (e) {
    var profile = wpick([['ok', 52], ['shaky', 33], ['quiet', 15]]);
    profiles[e.id] = profile;
    var answerProb = profile === 'ok' ? 0.85 : profile === 'shaky' ? 0.75 : 0.35;
    var tenure = dayOfWork(e);
    e.checkins = POINTS.map(function (p, idx) {
      var date = pointDate(e, p);
      var cp = { day: p, date: date, answer: null };
      if (tenure < p) return cp;
      var since = tenure - p;
      if (since <= 2 && rnd() < 0.6) return cp;
      if (rnd() < answerProb) {
        var a = genAnswer(profile, idx);
        a.answeredAt = stamp(addDays(date, Math.min(since, ri(0, 2))), ri(9, 20), ri(0, 59));
        cp.answer = a;
      }
      return cp;
    });
  });

  // Демо-новичок для основного сценария: 31-й день, с наставником, на 7-й день всё было хорошо,
  // точка 30 дня наступила вчера и ещё не заполнена.
  var demo = active.slice().sort(function (a, b) {
    return Math.abs(dayOfWork(a) - 31) - Math.abs(dayOfWork(b) - 31);
  })[0];
  demo.mentor = true;
  demo.hireDate = addDays(DEMO_TODAY, -30);
  demo.checkins = POINTS.map(function (p) { return { day: p, date: pointDate(demo, p), answer: null }; });
  demo.checkins[0].answer = { clarity: 4, hasPerson: true, stay: 4, blockers: ['none'], blockerOther: '',
    answeredAt: stamp(addDays(demo.checkins[0].date, 1), 18, 40) };

  // «Не ответил» в исходных данных — ровно у двух новичков, с самой свежей просрочкой.
  // Остальным с просроченной последней точкой дописываем ответ.
  var NUDGE_SEED = 2;
  var overdue = [];
  active.forEach(function (e) {
    if (e === demo) return;
    var due = latestDue(e, DEMO_TODAY);
    if (!due) return;
    var since = diffDays(DEMO_TODAY, due.date);
    if (since > 2) overdue.push({ e: e, due: due, since: since });
  });
  overdue.sort(function (a, b) { return a.since - b.since; });
  var missedSeed = [];
  overdue.forEach(function (x, k) {
    if (k < NUDGE_SEED) { x.due.answer = null; missedSeed.push(x); return; }
    if (!x.due.answer) {
      var a = genAnswer(profiles[x.e.id], POINTS.indexOf(x.due.day));
      a.answeredAt = stamp(addDays(x.due.date, ri(0, 2)), ri(9, 20), ri(0, 59));
      x.due.answer = a;
    }
  });

  /* ---------- будущие приёмы: выход через 3–5 дней ---------- */
  var upcoming = [];
  [4, 5, 4].forEach(function (offset, k) {
    var e = makeEmployee(HIRES_TOTAL + k, addDays(DEMO_TODAY, offset), false);
    e.status = 'upcoming';
    e.checkins = POINTS.map(function (p) { return { day: p, date: pointDate(e, p), answer: null }; });
    upcoming.push(e);
    employees.push(e);
  });

  /* ---------- правило риска (общее для генератора и приложения) ---------- */
  function lastAnswered(e) {
    for (var i = e.checkins.length - 1; i >= 0; i--) if (e.checkins[i].answer) return e.checkins[i];
    return null;
  }
  function latestDue(e, today) {
    for (var i = e.checkins.length - 1; i >= 0; i--) if (e.checkins[i].date <= today) return e.checkins[i];
    return null;
  }
  function missedPoint(e, today) {
    var due = latestDue(e, today);
    if (due && !due.answer && diffDays(today, due.date) > 2) return due;
    return null;
  }
  function computeRisk(e, today) {
    today = today || DEMO_TODAY;
    var r = [];
    if (!e.mentor) r.push({ code: 'mentor', text: 'Нет наставника' });
    var la = lastAnswered(e);
    if (la && la.answer.stay <= 2) {
      r.push({ code: 'stay', text: 'Видит себя здесь через полгода: ' + la.answer.stay + ' из 5 (точка ' + la.day + ' дня)' });
    }
    if (la && la.answer.hasPerson === false) {
      r.push({ code: 'noone', text: 'Не к кому обратиться с вопросом (точка ' + la.day + ' дня)' });
    }
    if (la && la.answer.blockers && la.answer.blockers.indexOf('boss') !== -1) {
      r.push({ code: 'boss', text: 'Отмечено «Сложно с руководителем» (точка ' + la.day + ' дня)' });
    }
    var mp = missedPoint(e, today);
    if (mp) r.push({ code: 'missed', text: 'Не ответил на точку ' + mp.day + ' дня (прошло ' + diffDays(today, mp.date) + ' дн.)' });
    return r;
  }
  function isRiskyAnswer(a) {
    return a.stay <= 2 || a.hasPerson === false || (a.blockers || []).indexOf('boss') !== -1;
  }
  // Если новичку сложно с руководителем — задача идёт HR, а не руководителю
  function routesToHR(a) { return (a.blockers || []).indexOf('boss') !== -1; }

  /* ---------- задачи (имитация Битрикс24) ---------- */
  var tasks = [];
  var taskNum = 1040;
  function newTask(t) {
    t.id = 't' + (++taskNum); t.num = taskNum;
    t.status = t.status || 'open'; t.result = t.result || null; t.closedAt = t.closedAt || null;
    tasks.push(t); return t;
  }

  var talkOutcomes = [
    'Договорились о стабильном графике на месяц вперёд — остаётся',
    'Разобрали норму сборки, наставник покажет приёмы — остаётся',
    'Объяснил, как считается премия, вопрос снят'
  ];
  var outcomeIdx = 0;
  var weekAgo = addDays(DEMO_TODAY, -7);

  active.forEach(function (e) {
    // Работающим без наставника — «Назначить наставника» на завтра
    if (!e.mentor) {
      newTask({
        type: 'mentor', empId: e.id, assigneeId: e.managerId,
        createdAt: stamp(DEMO_TODAY, 9, 0), deadline: addBusinessDays(DEMO_TODAY, 1),
        reasons: ['Нет наставника'], blocker: '', dayAtCreation: dayOfWork(e)
      });
    }
    var la = lastAnswered(e);
    if (la && isRiskyAnswer(la.answer)) {
      var created = la.answer.answeredAt.slice(0, 10);
      var snapshot = { mentor: e.mentor, checkins: e.checkins.filter(function (c) { return c.day <= la.day; }) };
      var t = newTask({
        type: 'talk', empId: e.id, assigneeId: routesToHR(la.answer) ? HR_MANAGER.id : e.managerId,
        createdAt: la.answer.answeredAt, deadline: addBusinessDays(created, 2),
        reasons: computeRisk(snapshot, created).map(function (x) { return x.text; }),
        blocker: blockerText(la.answer), dayAtCreation: diffDays(created, e.hireDate) + 1
      });
      // старые задачи уже отработаны руководителем
      if (created < weekAgo) {
        var at = stamp(addBusinessDays(created, 1), 16, 15);
        var outcome = talkOutcomes[outcomeIdx++ % talkOutcomes.length];
        t.status = 'done'; t.result = outcome; t.closedAt = at;
        e.talks.push({ at: at, outcome: outcome });
      }
    }
  });

  missedSeed.forEach(function (x) {
    var created = addDays(x.due.date, 3);
    newTask({
      type: 'nudge', empId: x.e.id, assigneeId: x.e.managerId, point: x.due.day,
      createdAt: stamp(created, 9, 0), deadline: addBusinessDays(created, 1),
      reasons: [], blocker: '', dayAtCreation: diffDays(created, x.e.hireDate) + 1
    });
  });

  upcoming.forEach(function (e) {
    newTask({
      type: 'onboard', empId: e.id, assigneeId: e.managerId,
      createdAt: stamp(addDays(DEMO_TODAY, -1), 10, 0), deadline: addBusinessDays(e.hireDate, -1),
      reasons: [], blocker: '', dayAtCreation: 0
    });
  });

  /* ---------- проверка ---------- */
  var hired = employees.filter(function (e) { return e.status !== 'upcoming'; });
  var fired = employees.filter(function (e) { return e.status === 'fired'; });
  var early = fired.filter(isEarlyLeaver);
  var inFirst90 = employees.filter(function (e) { return e.status === 'working' && dayOfWork(e) <= 90; });
  var byType = {};
  tasks.forEach(function (t) { var k = t.type + (t.status === 'open' ? '' : ' (закрыта)'); byType[k] = (byType[k] || 0) + 1; });
  if (typeof console !== 'undefined') {
    console.info('[Новичок] данные: наймов за 12 мес — ' + hired.length +
      ', скоро выход — ' + upcoming.length +
      ', сейчас в первых 90 днях — ' + inFirst90.length +
      ', уволено — ' + fired.length +
      ', из них до 90 дней — ' + early.length +
      ' (' + Math.round(early.length / fired.length * 100) + '% от всех ушедших)');
    console.info('[Новичок] варианты «что мешает»: ' + topBlockers(employees, DEMO_TODAY, 5).map(function (b) {
      return b.label + ' (' + b.count + ')';
    }).join(', '));
    console.info('[Новичок] задачи: ' + JSON.stringify(byType));
  }

  window.NOVICHOK = {
    DEMO_TODAY: DEMO_TODAY,
    DATA_VERSION: DATA_VERSION,
    DEPARTMENTS: DEPARTMENTS.map(function (d) { return { id: d.id, name: d.name }; }),
    MANAGERS: MANAGERS,
    HR_MANAGER: HR_MANAGER,
    REASONS: REASONS,
    BLOCKERS: BLOCKERS,
    BLOCKER_OTHER: BLOCKER_OTHER,
    BLOCKER_NONE: BLOCKER_NONE,
    POINTS: POINTS,
    initial: { employees: employees, tasks: tasks, taskNum: taskNum, demoEmployeeId: demo.id },
    util: {
      toDays: toDays, addDays: addDays, diffDays: diffDays, weekday: weekday,
      addBusinessDays: addBusinessDays, pad: pad, dayOfWork: dayOfWork,
      lastAnswered: lastAnswered, latestDue: latestDue, missedPoint: missedPoint,
      blockerLabel: blockerLabel, blockerText: blockerText, hasRealBlocker: hasRealBlocker,
      isEarlyLeaver: isEarlyLeaver
    },
    topBlockers: topBlockers,
    computeRisk: computeRisk,
    isRiskyAnswer: isRiskyAnswer,
    routesToHR: routesToHR
  };
})();
