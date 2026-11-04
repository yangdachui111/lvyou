(() => {
  "use strict";

  const app = document.getElementById("app");
  const STORAGE_KEY = "ai-travel-demo-work:v1";
  const PLACES = ["青岛", "大理", "厦门", "成都", "杭州", "敦煌"];
  const PLACE_ICONS = ["🌊", "⛰", "⛵", "🐼", "🌿", "🏜"];
  const DATES = Array.from({ length: 12 }, (_, i) => `2024-${String(5 + Math.floor(i / 6)).padStart(2, "0")}-${String(3 + (i % 6) * 2).padStart(2, "0")}`);
  const SCENES = [
    "linear-gradient(145deg,#f7b18b,#6e9d8a)", "linear-gradient(150deg,#f4d49b,#668f89)",
    "linear-gradient(145deg,#a9cfd0,#547969)", "linear-gradient(150deg,#e7aa84,#839a78)",
    "linear-gradient(145deg,#d5c39c,#8f705c)", "linear-gradient(150deg,#efc3ae,#6f9f91)"
  ];
  const COMMANDS = ["剪短当前段落", "延长当前段落", "换音乐", "调整段落顺序", "突出人物", "修改当前段落标题", "重做当前段落"];
  const CONTENT_FOCUS = ["突出人物", "风景", "美食", "完整行程"];
  const ATMOSPHERES = ["温暖纪念", "轻松治愈", "自然旅行"];
  const PACES = ["舒缓", "自然", "轻快"];
  const EXCLUSIONS = ["自拍", "重复镜头", "严重抖动", "指定人物"];
  const DEFAULT_TRIP_DAYS = [
    { id: "day-1", day: 1, label: "第 1 天", date: "2024-05-03", place: "青岛", event: "抵达" },
    { id: "day-2", day: 2, label: "第 2 天", date: "2024-05-05", place: "青岛", event: "酒店入住" },
    { id: "day-3", day: 3, label: "第 3 天", date: "2024-05-07", place: "杭州", event: "夜游" },
    { id: "day-4", day: 4, label: "第 4 天", date: "2024-05-09", place: "杭州", event: "西湖" },
    { id: "day-5", day: 5, label: "第 5 天", date: "2024-05-11", place: "厦门", event: "午餐" },
    { id: "day-6", day: 6, label: "第 6 天", date: "2024-05-13", place: "大理", event: "日落" }
  ];
  const DEFAULT_PEOPLE = [
    { id: "person-1", name: "人物 A", icon: "👩" },
    { id: "person-2", name: "人物 B", icon: "🧑" },
    { id: "person-3", name: "人物 C", icon: "👧" }
  ];
  const MEDIA = Array.from({ length: 216 }, (_, i) => ({
    id: `media-${i + 1}`, index: i + 1, type: i < 168 ? "photo" : "video",
    date: DATES[i % DATES.length], place: PLACES[Math.floor(i / 6) % PLACES.length],
    duration: i < 168 ? 0 : 55 + (i % 8) * 9, scene: i % 6,
    orientation: i % 3 ? "portrait" : "landscape", safe: i % 2 === 0,
    person: i % 7 === 0 ? "妈妈" : i % 11 === 0 ? "阿宁" : null
  }));
  const RECOMMENDED = [...MEDIA.slice(0, 72), ...MEDIA.slice(168, 192)].map(x => x.id);
  let simTimer = null;
  let playTimer = null;
  let lastPlayerSave = 0;

function freshTrip() {
    return {
      timeline: DEFAULT_TRIP_DAYS.map(day => ({ ...day })),
      people: DEFAULT_PEOPLE.map(person => ({ ...person })),
      keyPersonId: null,
      mediaStatus: {},
      recoveredMediaIds: []
    };
  }

  const freshState = () => ({
    page: "home", projectName: "我的旅行回忆", selected: [], pickerError: "",
    analysis: null, mapPlace: "", mapChoice: "", trip: freshTrip(),
    setup: { duration: 60, style: "温暖纪念", contentFocus: ["完整行程"], atmosphere: "温暖纪念", pace: "自然", keyPerson: null, importantEvents: [], exclusions: [], input: "", result: "", error: "" },
    structure: null, structureExpanded: [], preview: null, draft: null, versions: [], versionSeq: 0, undoAvailable: false,
    player: { position: 0, playing: false, selectedCard: "", selectedSegment: "", expanded: [] },
    pending: null, proposal: null, assistantInput: "", assistantError: "", exportRun: null,
    modal: null, selectedVersion: null, message: ""
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const loaded = JSON.parse(raw);
      const base = freshState();
      const merged = Object.assign({}, base, loaded);
      merged.setup = Object.assign({}, base.setup, loaded.setup || {});
      merged.setup.contentFocus = Array.isArray(loaded.setup?.contentFocus) ? loaded.setup.contentFocus.filter(x => CONTENT_FOCUS.includes(x)).slice(0, 2) : base.setup.contentFocus;
      merged.setup.importantEvents = Array.isArray(loaded.setup?.importantEvents) ? loaded.setup.importantEvents : [];
      merged.setup.exclusions = Array.isArray(loaded.setup?.exclusions) ? loaded.setup.exclusions.filter(x => EXCLUSIONS.includes(x)) : [];
      const loadedTrip = loaded.trip || {};
      merged.trip = Object.assign(freshTrip(), loadedTrip);
      merged.trip.timeline = DEFAULT_TRIP_DAYS.map(day => Object.assign({}, day, (loadedTrip.timeline || []).find(x => x.id === day.id) || {}));
      merged.trip.people = DEFAULT_PEOPLE.map(person => Object.assign({}, person, (loadedTrip.people || []).find(x => x.id === person.id) || {}));
      merged.trip.mediaStatus = Object.assign({}, loadedTrip.mediaStatus || {});
      merged.trip.recoveredMediaIds = Array.isArray(loadedTrip.recoveredMediaIds) ? loadedTrip.recoveredMediaIds : [];
      if (!loaded.trip && merged.setup.keyPerson) {
        merged.trip.people[0].name = merged.setup.keyPerson;
        merged.trip.keyPersonId = "person-1";
      }
      merged.setup.keyPerson = merged.trip.people.find(person => person.id === merged.trip.keyPersonId)?.name || null;
      merged.structureExpanded = Array.isArray(loaded.structureExpanded) ? loaded.structureExpanded : [];
      merged.player = Object.assign({}, base.player, loaded.player || {}, { playing: false });
      return merged;
    } catch (error) {
      const state = freshState();
      state.message = "本地项目状态无法读取，已安全打开首页。";
      return state;
    }
  }

  let state = loadState();

  function save() {
    try {
      const saved = JSON.parse(JSON.stringify(state));
      saved.player.playing = false;
      saved.modal = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      state.message = "更改暂未保存，刷新可能丢失。";
    }
  }

  function go(page) {
    clearInterval(simTimer);
    state.page = page;
    location.hash = page;
    save();
    render();
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function graphemes(value) {
    const text = String(value || "").trim();
    if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter("zh-CN", { granularity: "grapheme" }).segment(text)].length;
    return Array.from(text).length;
  }

  function formatSeconds(seconds) {
    const value = Math.max(0, Math.round(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  }

  function formatDuration(seconds) {
    return seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : ""}` : `${seconds}秒`;
  }

  function selectedItems() {
    const ids = new Set(state.selected);
    return MEDIA.filter(item => ids.has(item.id));
  }

  function summary(items = selectedItems()) {
    const photo = items.filter(x => x.type === "photo").length;
    const video = items.length - photo;
    return { photo, video, total: items.length, seconds: items.reduce((sum, x) => sum + x.duration, 0) };
  }

  function summaryHTML(data = summary()) {
    return `<div class="summary" aria-label="素材精确统计">
      <div class="metric"><strong>${data.total}</strong><span>全部</span></div>
      <div class="metric"><strong>${data.photo}</strong><span>照片</span></div>
      <div class="metric"><strong>${data.video}</strong><span>视频</span></div>
      <div class="metric"><strong>${formatDuration(data.seconds)}</strong><span>视频时长</span></div>
    </div>`;
  }

  function simLabel(text = "") {
    return `<div class="label">模拟 AI / 演示素材 / 模拟导出，不上传文件、不生成真实视频${text ? ` · ${text}` : ""}</div>`;
  }

  function header(title, back, right = "") {
    return `<header class="topbar">${back ? `<button class="icon-btn" onclick="UI.go('${back}')" aria-label="返回">‹</button>` : "<span></span>"}<h1>${title}</h1>${right || "<span></span>"}</header>`;
  }

  function shell(title, back, body, bottom = "", extra = "") {
    return `<section class="screen ${extra}">${header(title, back)}<div class="scroll ${bottom ? "" : "no-action"}">${state.message ? `<div class="notice error">${esc(state.message)}</div>` : ""}${body}</div>${bottom ? `<div class="bottom">${bottom}</div>` : ""}</section>`;
  }

  let renderedPage = null;
  let viewRenderSequence = 0;

  function captureViewState(page) {
    const scroll = app.querySelector(".scroll");
    const active = document.activeElement;
    const view = {
      page,
      scrollTop: scroll ? scroll.scrollTop : 0,
      focusId: active && app.contains(active) ? active.id : "",
      selection: null
    };
    if (view.focusId && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
      try {
        if (typeof active.selectionStart === "number" && typeof active.selectionEnd === "number") {
          view.selection = { start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection || "none" };
        }
      } catch (error) {
        view.selection = null;
      }
    }
    return view;
  }

  function renderPage(page, html) {
    const view = renderedPage === page ? captureViewState(page) : null;
    const sequence = ++viewRenderSequence;
    app.innerHTML = html;
    renderedPage = page;
    if (!view) return;
    requestAnimationFrame(() => {
      if (sequence !== viewRenderSequence || renderedPage !== view.page || state.page !== view.page) return;
      const scroll = app.querySelector(".scroll");
      if (scroll) scroll.scrollTop = view.scrollTop;
      if (view.focusId) {
        const focusTarget = document.getElementById(view.focusId);
        if (focusTarget && app.contains(focusTarget)) {
          try {
            focusTarget.focus({ preventScroll: true });
            if (view.selection && typeof focusTarget.setSelectionRange === "function") {
              focusTarget.setSelectionRange(view.selection.start, view.selection.end, view.selection.direction);
            }
          } catch (error) {
            // The focused element may no longer support focus or text selection.
          }
        }
      }
      if (scroll) scroll.scrollTop = view.scrollTop;
    });
  }

  function sceneStyle(index) { return `--scene:${SCENES[index % SCENES.length]}`; }

  function renderHome() {
    app.innerHTML = `<section class="screen"><div class="scroll no-action" style="padding-top:48px">
      <p class="eyebrow">拾光旅记 · 本地交互原型</p><h1 class="hero-title">把一路风景，<br>剪成一封时光来信</h1>
      <p class="lead">用本地演示素材体验从 AI 理解旅行，到完成 60 秒纪念短片的完整旅程。</p>
      ${state.message ? `<div class="notice error">${esc(state.message)}</div>` : ""}
      <article class="card postcard"><div class="cover"></div><div class="row"><div><b>夏日环海旅行</b><div class="muted">60 秒 · 温暖纪念 · 已完成</div></div><span class="tag">演示项目</span></div><button class="btn sage" style="width:100%;margin-top:14px" onclick="UI.openDemo()">打开现有演示草稿</button></article>
      <button class="btn primary" onclick="UI.newProject()">＋ 新建旅行视频</button>
      <p class="muted center" style="margin-top:16px">全程离线演示 · 不读取或上传你的文件</p>
    </div></section>`;
  }

  function pickerNotice(s) {
    if (!s.total) return state.pickerError ? `<div class="notice error">请至少选择一项素材后继续。</div>` : `<div class="notice">请选择素材，推荐 50–200 项。</div>`;
    const warnings = [];
    if (s.total < 50 || s.total > 200) warnings.push("项目总数建议为 50 至 200 项");
    if (s.seconds > 3600) warnings.push("视频总时长建议不超过 60 分钟");
    return warnings.length ? `<div class="notice">${warnings.join("；")}。此建议不阻断演示流程。</div>` : `<div class="notice ok">✓ 已处于推荐范围：50–200 项，视频不超过 60 分钟。</div>`;
  }

  function renderPicker() {
    const s = summary();
    const selected = new Set(state.selected);
    const body = `${simLabel("共 216 个固定演示素材")}
      <div class="sticky-summary">${summaryHTML(s)}${pickerNotice(s)}<div class="actions"><button class="btn small sage" onclick="UI.recommend()">一键选择推荐素材</button><button class="btn small ghost" onclick="UI.clearMedia()">清空</button></div></div>
      <div class="section-title"><h2>全部素材</h2><span>168 张照片 · 48 个视频</span></div>
      <div class="media-grid">${MEDIA.map(item => `<button class="media ${selected.has(item.id) ? "on" : ""}" onclick="UI.toggleMedia('${item.id}')" aria-pressed="${selected.has(item.id)}" aria-label="${item.place} ${item.date} ${item.type === "photo" ? "照片" : "视频"}"><span class="check">${selected.has(item.id) ? "✓" : ""}</span><span class="thumb" style="${sceneStyle(item.scene)}">${PLACE_ICONS[PLACES.indexOf(item.place)]}</span><span class="meta"><span>${item.type === "photo" ? "照片" : `视频 ${item.duration}s`}</span><span>#${item.index}</span></span></button>`).join("")}</div>`;
    renderPage("picker", shell("选择旅行素材", "home", body, `<button class="btn primary" onclick="UI.continuePicker()">检查已选素材 · ${s.total} 项</button>`));
  }

  function groupBy(items, key) {
    return items.reduce((map, item) => { (map[item[key]] ||= []).push(item); return map; }, {});
  }

  function mini(item) {
    return `<span class="mini-thumb" style="${sceneStyle(item.scene)}" title="${item.place} ${item.date} ${item.type === "photo" ? "照片" : "视频"}">${PLACE_ICONS[PLACES.indexOf(item.place)]}</span>`;
  }

  function renderChecker() {
    const items = selectedItems();
    const groups = groupBy(items, "date");
    const body = `${simLabel("日期与缩略图来自固定元数据")}
      <p class="eyebrow">分析前确认</p><h2 style="margin:0">这趟旅程的素材范围</h2>${summaryHTML(summary(items))}
      <div class="section-title"><h2>按日期检查</h2><span>${Object.keys(groups).length} 天</span></div>
      ${Object.keys(groups).sort().map(date => `<section class="date-row"><h3>${date.replaceAll("-", ".")} · ${groups[date].length} 项</h3><div class="thumb-strip">${groups[date].map(mini).join("")}</div></section>`).join("")}`;
    app.innerHTML = shell("素材检查", "picker", body, `<button class="btn primary" onclick="UI.startAnalysis()">确认，开始模拟 AI 分析</button>`);
  }

  function ensureRun(key, duration) {
    if (!state[key]) {
      state[key] = { startedAt: Date.now(), duration, progress: 0, completed: false };
      save();
    }
    const run = state[key];
    const derived = Math.min(100, Math.floor((Date.now() - run.startedAt) / run.duration * 100));
    run.progress = Math.max(run.progress || 0, derived);
    run.completed = run.progress >= 100;
    return run;
  }

  function startProgress(key, duration, renderer, done) {
    clearInterval(simTimer);
    const run = ensureRun(key, duration);
    if (run.completed) return;
    simTimer = setInterval(() => {
      const old = run.progress;
      const derived = Math.min(100, Math.floor((Date.now() - run.startedAt) / run.duration * 100));
      run.progress = Math.max(old, derived);
      run.completed = run.progress >= 100;
      save();
      renderer();
      if (run.completed) { clearInterval(simTimer); if (done) done(); }
    }, 250);
  }

  function progressBody(run, title, note, stages) {
    const doneCount = run.completed ? stages.length : Math.min(stages.length, Math.floor(run.progress / 25) + 1);
    return `${simLabel(note)}<p class="eyebrow center">${run.completed ? "已完成" : "请稍候"}</p><h2 class="center" style="margin:0">${title}</h2>
      <div class="progress-ring" style="--p:${run.progress}" role="progressbar" aria-label="${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${run.progress}"><strong>${run.progress}%</strong></div>
      <ul class="stage-list">${stages.map((stage, i) => `<li class="${i < doneCount ? "done" : ""}">${stage}</li>`).join("")}</ul>`;
  }

  function renderAnalysis() {
    const run = ensureRun("analysis", 8000);
    const body = progressBody(run, run.completed ? "素材理解完成" : "正在读懂这趟旅行", "不执行真实 AI 分析，进度与结果均为确定性模拟", ["地点识别", "人物识别", "画面质量识别", "高光候选识别"])
      + (run.completed ? `<div class="card"><b>固定分析结果</b><p class="muted">识别到 ${new Set(selectedItems().map(x => x.place)).size} 个地点、3 位演示人物和 8 个高光候选。相同素材始终得到相同结果。</p></div>` : "");
    app.innerHTML = shell("模拟素材分析", "checker", body, run.completed ? `<button class="btn primary" onclick="UI.go('map')">查看旅行地图</button>` : `<button class="btn primary" disabled>分析进行中 · 最长 8 秒</button>`);
    startProgress("analysis", 8000, renderAnalysis);
  }

  function placeData() {
    return Object.entries(groupBy(selectedItems(), "place")).map(([place, items]) => ({ place, items, first: items.map(x => x.date).sort()[0], last: items.map(x => x.date).sort().at(-1) }));
  }

  function keyPersonName() {
    return state.trip.people.find(person => person.id === state.trip.keyPersonId)?.name || null;
  }

  function representativeMedia() {
    const items = selectedItems();
    return (items.length ? items : MEDIA).slice(0, 4);
  }

  function renderMap() {
    const places = placeData();
    if (!state.mapPlace || !places.some(x => x.place === state.mapPlace)) state.mapPlace = places[0]?.place || "青岛";
    const current = places.find(x => x.place === state.mapPlace) || places[0];
    const coords = [[22, 28], [65, 22], [43, 58], [76, 62], [15, 68], [48, 16]];
    const statusLabels = { normal: "普通", keep: "必须保留", avoid: "不要使用" };
    const lowQuality = (selectedItems().length ? selectedItems() : MEDIA).filter((_, i) => i % 9 === 4).slice(0, 2);
    const body = `${simLabel("旅行素材地图为确定性本地模拟；人物、事件和素材标记只保存在浏览器")}
      <div class="row"><div><p class="eyebrow">旅行素材地图</p><h2 style="margin:0">先确认行程，再标记重要回忆</h2></div><span class="tag">可编辑</span></div>
      <div class="section-title"><h2>地点概览</h2><span>点击图钉查看素材</span></div>
      <div class="map" aria-label="手绘旅行路线地图">${places.map((p, i) => `<button class="pin ${p.place === state.mapPlace ? "on" : ""}" style="left:${coords[i][0]}%;top:${coords[i][1]}%" onclick="UI.selectPlace('${p.place}')"><span>${p.place}</span></button>`).join("")}</div>
      ${current ? `<article class="card"><div class="row"><h3 style="margin:0">${current.place}</h3><span class="tag">${current.items.length} 项素材</span></div><p class="muted">${current.first} 至 ${current.last}</p><div class="thumb-strip">${current.items.map(mini).join("")}</div></article>` : ""}
      <div class="section-title"><h2>行程时间线</h2><span>事件名称可编辑</span></div>
      <div class="trip-timeline">${state.trip.timeline.map(day => `<article class="timeline-day"><div class="day-dot">${day.day}</div><div class="day-copy"><b>${day.label || `第 ${day.day} 天`}</b><span>${day.date} · ${day.place}</span><label for="event-${day.id}">当日事件</label><input id="event-${day.id}" class="field compact" maxlength="20" value="${esc(day.event)}" onchange="UI.editTripEvent('${day.id}',this.value)" aria-label="第 ${day.day} 天事件名称"></div></article>`).join("")}</div>
      <div class="section-title"><h2>主要人物</h2><span>编辑称呼 · 最多重点 1 位</span></div>
      <div class="map-people">${state.trip.people.map(person => `<article class="map-person ${state.trip.keyPersonId === person.id ? "on" : ""}"><span class="avatar">${person.icon}</span><label for="name-${person.id}">${person.name}</label><input id="name-${person.id}" class="field compact" maxlength="12" value="${esc(person.name)}" onchange="UI.renamePerson('${person.id}',this.value)" aria-label="编辑${person.name}的称呼"><button class="btn small ${state.trip.keyPersonId === person.id ? "primary" : "ghost"}" onclick="UI.setKeyPerson('${person.id}')">${state.trip.keyPersonId === person.id ? "★ 重点人物" : "设为重点"}</button></article>`).join("")}</div>
      <div class="section-title"><h2>内容分类摘要</h2><span>演示计数</span></div>
      <div class="category-summary"><span><b>28</b>人物互动</span><span><b>35</b>风景</span><span><b>16</b>美食</span><span><b>9</b>交通</span></div>
      <div class="section-title"><h2>代表素材处理</h2><span>点击循环设置</span></div>
      <div class="material-list">${representativeMedia().map(item => { const status = state.trip.mediaStatus[item.id] || "normal"; return `<article class="material-item"><span class="mini-thumb" style="${sceneStyle(item.scene)}">${PLACE_ICONS[PLACES.indexOf(item.place)]}</span><div><b>${item.place} · #${item.index}</b><span>${item.type === "photo" ? "照片" : "视频"}</span></div><button class="material-status ${status}" onclick="UI.cycleMediaStatus('${item.id}')" aria-label="${item.place}素材当前为${statusLabels[status]}，点击更改">${statusLabels[status]}</button></article>`; }).join("")}</div>
      <div class="section-title"><h2>低质量/重复素材</h2><span>AI 建议不使用</span></div>
      <div class="quality-list">${lowQuality.map((item, i) => { const recovered = state.trip.recoveredMediaIds.includes(item.id); return `<article class="material-item ${recovered ? "recovered" : ""}"><span class="mini-thumb" style="${sceneStyle(item.scene)}">${PLACE_ICONS[PLACES.indexOf(item.place)]}</span><div><b>${i ? "相似重复" : "轻微抖动"}</b><span>${recovered ? "已恢复为普通素材" : `${item.place} · #${item.index}`}</span></div><button class="btn small ${recovered ? "sage" : "ghost"}" onclick="UI.restoreMedia('${item.id}')" ${recovered ? "disabled" : ""}>${recovered ? "已恢复" : "恢复使用"}</button></article>`; }).join("")}</div>
      <p class="muted">确认与跳过都会保存当前人物称呼、事件和素材标记，并进入剪辑意图页。</p>`;
    renderPage("map", shell("旅行素材地图", "analysis", body, `<div class="actions"><button class="btn ghost" onclick="UI.finishMap('skip')">跳过</button><button class="btn primary" onclick="UI.finishMap('confirm')">确认素材地图</button></div>`));
  }

  function renderSetup() {
    const setup = state.setup;
    const person = keyPersonName();
    const selectedEvents = new Set(setup.importantEvents);
    const body = `${simLabel("初始意图用于整条视频；草稿生成后才提供七类 AI 后期修改命令")}
      <p class="eyebrow">整片初步想法</p><h2 style="margin:0">你希望这条旅行视频怎么讲？</h2><p class="muted">内容重点最多选 2 项，其余项目均为单选或可选。</p>
      <div class="section-title"><h2>1. 内容重点</h2><span>最多 2 项</span></div>
      <div class="chips">${CONTENT_FOCUS.map(item => `<button class="chip ${setup.contentFocus.includes(item) ? "on" : ""}" aria-pressed="${setup.contentFocus.includes(item)}" onclick="UI.toggleContentFocus('${item}')">${item}</button>`).join("")}</div>
      <div class="section-title"><h2>2. 氛围</h2><span>单选</span></div>
      <div class="chips">${ATMOSPHERES.map(item => `<button class="chip ${setup.atmosphere === item ? "on" : ""}" aria-pressed="${setup.atmosphere === item}" onclick="UI.chooseSetup('atmosphere','${item}')">${item}</button>`).join("")}</div>
      <div class="section-title"><h2>3. 节奏</h2><span>单选</span></div>
      <div class="chips">${PACES.map(item => `<button class="chip ${setup.pace === item ? "on" : ""}" aria-pressed="${setup.pace === item}" onclick="UI.chooseSetup('pace','${item}')">${item}</button>`).join("")}</div>
      <div class="section-title"><h2>4. 重要人物</h2><span>来自素材地图 · 可不选</span></div>
      ${person ? `<article class="card compact-card"><div class="row"><div><b>★ ${esc(person)}</b><div class="muted">素材地图标注的重点人物</div></div><button class="btn small ghost" onclick="UI.setKeyPerson(null)">不设重点</button></div></article>` : `<div class="notice">暂未选择重点人物，可返回素材地图设置。</div>`}
      <div class="section-title"><h2>5. 重要事件</h2><span>可多选</span></div>
      <div class="chips">${state.trip.timeline.map(day => `<button class="chip ${selectedEvents.has(day.id) ? "on" : ""}" aria-pressed="${selectedEvents.has(day.id)}" onclick="UI.toggleSetupList('importantEvents','${day.id}')">${esc(day.event)}</button>`).join("")}</div>
      <div class="section-title"><h2>6. 不要出现</h2><span>可多选</span></div>
      <div class="chips">${EXCLUSIONS.map(item => `<button class="chip ${setup.exclusions.includes(item) ? "on" : ""}" aria-pressed="${setup.exclusions.includes(item)}" onclick="UI.toggleSetupList('exclusions','${item}')">${item}</button>`).join("")}</div>
      <div class="section-title"><h2>7. 自然语言补充</h2><span>可不填 · 最多 200 字符</span></div>
      <textarea id="setupInput" class="field intent-textarea" maxlength="200" oninput="UI.captureIntent(this.value)" placeholder="这是第一次带父母去云南，多保留妈妈看到雪山和全家吃饭的画面，少用自拍。" aria-label="整条视频想法">${esc(setup.input)}</textarea>
      ${setup.error ? `<div class="notice error">${esc(setup.error)}</div>` : ""}`;
    renderPage("setup", shell("剪辑意图", "map", body, `<button class="btn primary" onclick="UI.completeSetup()">生成剪辑说明</button>`));
  }

  const STRATEGIES = [
    ["✦", "叙事策略", "唯一高光置于首位，其余按真实行程展开。"],
    ["♫", "配乐策略", "整片使用一首符合所选氛围的本地预设音乐。"],
    ["◉", "原声策略", "高光与重要人物互动优先保留现场声音。"],
    ["▣", "画面策略", "横屏素材在安全裁切与柔化背景中二选一。"],
    ["字", "文字策略", "片头标题、地点日期和必要语音字幕。"]
  ];

  function renderBrief() {
    const person = keyPersonName();
    const events = state.trip.timeline.filter(day => state.setup.importantEvents.includes(day.id)).map(day => day.event);
    const settings = [
      ["内容重点", state.setup.contentFocus.join("、") || "完整行程"],
      ["氛围", state.setup.atmosphere], ["节奏", state.setup.pace],
      ["重要人物", person || "未选择"], ["重要事件", events.join("、") || "未选择"],
      ["排除项", state.setup.exclusions.join("、") || "无"], ["自然语言要求", state.setup.input || "未补充"]
    ];
    const body = `${simLabel("剪辑策略与结果来自本地固定规则")}
      <p class="eyebrow">生成前确认</p><h2 style="margin:0 0 12px">你的 60 秒旅行故事</h2>${summaryHTML()}
      <article class="card"><div class="row"><b>最新剪辑设置</b><span class="tag">60 秒</span></div><div class="brief-grid">${settings.map(([label, value]) => `<div><span>${label}</span><b>${esc(value)}</b></div>`).join("")}</div></article>
      <article class="card"><b>剪辑策略</b>${STRATEGIES.map(s => `<div class="strategy"><span class="ico">${s[0]}</span><div><b>${s[1]}</b><p>${s[2]}</p></div></div>`).join("")}</article>`;
    app.innerHTML = shell("剪辑说明", "setup", body, `<button class="btn primary" onclick="UI.prepareStructure()">确认剪辑说明</button>`);
  }

  function sectionDetails(group, index, kind) {
    const items = group?.items || representativeMedia();
    const roles = ["交代抵达", "推进旅程", "人物回忆", "推进旅程", "情绪收尾"];
    const selectedEvent = state.trip.timeline.find(day => state.setup.importantEvents.includes(day.id) && day.place === group?.place)
      || state.trip.timeline.find(day => state.setup.importantEvents.includes(day.id));
    const person = keyPersonName();
    return {
      narrativeRole: kind === "highlight" ? "高光钩子" : roles[Math.min(index, roles.length - 1)],
      contentFocus: state.setup.contentFocus.length ? state.setup.contentFocus.slice() : ["完整行程"],
      mediaCount: Math.max(2, Math.min(items.length, kind === "highlight" ? 5 : 12)),
      photoCount: items.filter(item => item.type === "photo").length,
      videoCount: items.filter(item => item.type === "video").length,
      scenes: items.slice(0, 3).map(item => item.scene),
      keyMoment: [person && (kind === "highlight" || index % 2 === 0) ? `重点人物：${person}` : "未安排重点人物", selectedEvent ? `重要事件：${selectedEvent.event}` : "未指定重要事件"],
      soundPlan: kind === "highlight" ? "保留现场笑声" : index % 2 ? "音乐主导" : "保留环境声",
      textPlan: kind === "highlight" ? "开场标题" : index % 2 ? "地点日期 · 必要字幕" : "无文字",
      reason: kind === "highlight" ? "用最有情绪的画面快速建立观看期待。" : `兼顾${state.setup.contentFocus.join("与") || "完整行程"}，让行程衔接自然。`
    };
  }

  function makeStructure() {
    const items = selectedItems();
    const groups = placeData().sort((a, b) => a.first.localeCompare(b.first) || items.find(x => x.place === a.place).index - items.find(x => x.place === b.place).index).slice(0, 6);
    const sourceGroups = groups.length ? groups : [{ place: "青岛", first: "2024-05-03", items: MEDIA.slice(0, 6) }];
    const count = Math.max(1, sourceGroups.length);
    const base = Math.floor(52 / count), remainder = 52 % count;
    const journey = sourceGroups.map((g, i) => ({ id: `journey-${i + 1}`, kind: "journey", title: `${g.place} · 途中拾光`, place: g.place, date: g.first, duration: base + (i < remainder ? 1 : 0), ...sectionDetails(g, i, "journey") }));
    const first = sourceGroups[0];
    return [{ id: "highlight", kind: "highlight", title: "高光 · 海风吹来的那一刻", place: first.place, date: first.first, duration: 8, ...sectionDetails(first, 0, "highlight") }, ...journey];
  }

  function enrichStructure() {
    const groups = placeData();
    state.structure = state.structure.map((section, i) => {
      const group = groups.find(item => item.place === section.place) || groups[0];
      return Object.assign({}, section, sectionDetails(group, Math.max(0, i - 1), section.kind));
    });
  }

  function renderStructure() {
    if (!state.structure) state.structure = makeStructure();
    enrichStructure();
    const total = state.structure.reduce((sum, x) => sum + x.duration, 0);
    const body = `${simLabel("故事组织与选择理由为确定性本地模拟")}
      <div class="row"><div><p class="eyebrow">故事结构</p><h2 style="margin:0">先看高光，再走一遍旅程</h2></div><span class="tag">合计 ${total} 秒</span></div>
      <div style="margin-top:16px">${state.structure.map((section, i) => { const expanded = state.structureExpanded.includes(section.id); return `<article class="card story ${section.kind === "highlight" ? "highlight" : ""}"><div class="story-head"><span class="story-num">${i + 1}</span><div class="story-main"><h3>${esc(section.title)}</h3><div class="sub">${section.place} · ${section.date} · 预计 ${section.duration} 秒</div></div>${section.kind === "highlight" ? `<button class="btn small ghost" onclick="UI.lockHighlight()">🔒 首位</button>` : `<div class="move"><button onclick="UI.moveSection(${i},-1)" ${i === 1 ? "disabled" : ""} aria-label="上移段落">↑</button><button onclick="UI.moveSection(${i},1)" ${i === state.structure.length - 1 ? "disabled" : ""} aria-label="下移段落">↓</button></div>`}</div>
        <div class="story-summary"><span>${esc(section.narrativeRole)}</span>${section.contentFocus.map(focus => `<span>${esc(focus)}</span>`).join("")}<span>${section.mediaCount} 项素材</span></div>
        <div class="story-preview">${section.scenes.map(scene => `<span class="story-thumb" style="${sceneStyle(scene)}" aria-hidden="true"></span>`).join("")}<div><b>${section.photoCount} 张照片 + ${section.videoCount} 段视频</b><span>照片/视频混合编排</span></div></div>
        <button class="detail-toggle" onclick="UI.toggleStructureDetail('${section.id}')">${expanded ? "收起" : "查看详情"}</button>
        ${expanded ? `<div class="story-detail"><dl><dt>叙事作用</dt><dd>${esc(section.narrativeRole)}</dd><dt>内容重点</dt><dd>${section.contentFocus.map(esc).join(" / ")}</dd><dt>代表素材</dt><dd>${section.mediaCount} 项，照片与视频混合</dd><dt>人物 / 事件</dt><dd>${section.keyMoment.map(esc).join("；")}</dd><dt>预计时长</dt><dd>${section.duration} 秒</dd><dt>声音计划</dt><dd>${esc(section.soundPlan)}</dd><dt>文字计划</dt><dd>${esc(section.textPlan)}</dd><dt>AI 选择理由</dt><dd>${esc(section.reason)}</dd></dl></div>` : ""}</article>`; }).join("")}</div>
      ${state.message ? `<div class="notice">${esc(state.message)}</div>` : ""}`;
    renderPage("structure", shell("故事结构", "brief", body, `<button class="btn primary" onclick="UI.startPreview()">生成低清草稿</button>`));
  }

  function renderPreview() {
    const run = ensureRun("preview", 10000);
    const body = progressBody(run, "正在生成低清草稿", "仅模拟生成，不进行真实视频编码", ["素材挑选", "结构组织", "配乐", "合成"])
      + `<div class="notice">真实产品预计需要 3–5 分钟；本演示将在 10 秒内完成。</div>`;
    app.innerHTML = shell("模拟草稿生成", "structure", body, `<button class="btn primary" disabled>正在生成低清预览</button>`);
    startProgress("preview", 10000, renderPreview, () => { ensureDraft(); setTimeout(() => go("draft"), 120); });
    if (run.completed) { ensureDraft(); setTimeout(() => go("draft"), 120); }
  }

  function draftFromStructure() {
    const structure = state.structure || makeStructure();
    return {
      id: "main-draft", music: "温暖纪念 · 岛屿晚风", total: 60,
      cards: structure.map((section, i) => {
        const first = Math.max(1, Math.floor(section.duration / 2));
        const second = section.duration - first;
        const segments = second > 0 ? [first, second] : [first];
        return { id: section.id, kind: section.kind, title: section.title, place: section.place, date: section.date,
          segments: segments.map((duration, j) => ({ id: `${section.id}-seg-${j + 1}`, title: j ? "抵达与回望" : "沿途一瞬", duration, originalAudio: section.kind === "highlight" && j === 0, layout: (i + j) % 2 ? "安全裁切" : "柔化背景" })) };
      })
    };
  }

  function snapshot(summaryText, scope = "局部", operation = "修改") {
    state.versionSeq += 1;
    state.versions.push({ id: `v${state.versionSeq}`, sequence: state.versionSeq, time: Date.now(), summary: summaryText, scope, operation, snapshot: JSON.parse(JSON.stringify(state.draft)) });
    if (state.versions.length > 20) state.versions = state.versions.slice(-20);
    state.undoAvailable = operation !== "初始版本" && operation !== "撤销";
    save();
  }

  function ensureDraft() {
    if (!state.draft) {
      state.draft = draftFromStructure();
      state.versions = [];
      state.versionSeq = 0;
      snapshot("AI 低清草稿生成完成", "完整", "初始版本");
    } else if (!state.draft.id) state.draft = draftFromStructure();
    if (!state.player.selectedCard) state.player.selectedCard = state.draft.cards[0].id;
  }

  function openDemo() {
    state = freshState();
    state.projectName = "夏日环海旅行";
    state.selected = RECOMMENDED.slice();
    state.trip.people[0].name = "妈妈";
    state.trip.keyPersonId = "person-1";
    state.setup.keyPerson = "妈妈";
    state.setup.contentFocus = ["突出人物", "完整行程"];
    state.setup.importantEvents = ["day-1", "day-6"];
    state.setup.exclusions = ["重复镜头"];
    state.structure = makeStructure();
    state.draft = draftFromStructure();
    state.player.selectedCard = state.draft.cards[0].id;
    snapshot("固定演示草稿", "完整", "初始版本");
    go("draft");
  }

  function cardRanges() {
    let cursor = 0;
    return state.draft.cards.map(card => { const start = cursor; const duration = card.segments.reduce((s, x) => s + x.duration, 0); cursor += duration; return { card, start, end: cursor }; });
  }

  function currentRange() {
    const ranges = cardRanges();
    return ranges.find(r => state.player.position >= r.start && (state.player.position < r.end || r.end === 60)) || ranges.at(-1);
  }

  function renderDraft() {
    ensureDraft();
    const range = currentRange();
    state.player.selectedCard = range.card.id;
    const scene = PLACES.indexOf(range.card.place) + Math.floor(state.player.position / 5);
    const suggestions = [`让“${range.card.title}”更紧凑`, `修改当前段落标题`, range.card.kind === "highlight" ? "延长当前段落" : "重做当前段落"].slice(0, 3);
    const cards = state.draft.cards.map((card, i) => renderStoryCard(card, i, range.card.id)).join("");
    const body = `${simLabel("播放器轮播固定旅行画面，不加载真实视频")}
      <div class="player" id="player"><div id="playerScene" class="player-scene" style="${sceneStyle(scene)}"></div><div class="player-copy"><h2 id="playerTitle">${esc(range.card.title)}</h2><div id="playerPlace">${range.card.place} · ${range.card.date}${state.player.position < 4 ? " · 片头标题" : ""}</div></div><div class="player-controls"><button class="play" onclick="UI.togglePlay()" id="playButton" aria-label="${state.player.playing ? "暂停" : "播放"}">${state.player.playing ? "Ⅱ" : "▶"}</button><input id="seek" class="seek" type="range" min="0" max="60" step="0.1" value="${state.player.position}" oninput="UI.seek(this.value)" aria-label="播放位置"><span class="time" id="playerTime">${formatSeconds(state.player.position)} / 1:00</span></div></div>
      <div class="rule-row"><span class="rule">♫ ${esc(state.draft.music)}</span><span class="rule">高光保留原声</span><span class="rule">必要字幕已开</span><span class="rule">9:16</span></div>
      <div class="actions"><button class="btn small ghost" onclick="UI.undo()" ${state.undoAvailable ? "" : "disabled"}>↶ 撤销</button><button class="btn small ghost" onclick="UI.openHistory()">版本 ${state.versions.length}</button><button class="btn small sage" onclick="UI.go('export-settings')">导出</button></div>
      <div class="section-title"><h2>故事卡</h2><span>选卡跳转 · 展开编辑</span></div>${cards}
      ${state.proposal ? renderProposal(state.proposal) : ""}`;
    renderPage("draft", `<section class="screen">${header("主草稿", "home")}<div class="scroll" style="padding-bottom:146px">${body}</div><div class="assistant"><div class="suggestions">${suggestions.map(s => `<button onclick="UI.fillAssistant('${esc(s)}')">${esc(s)}</button>`).join("")}</div><div class="assistant-row"><input id="assistantInput" class="field" maxlength="260" value="${esc(state.assistantInput)}" placeholder="用七类指令修改当前段落" aria-label="AI 修改指令"><button class="send" onclick="UI.submitAssistant()">发送</button></div>${state.assistantError ? `<div class="muted" style="color:var(--danger)">${esc(state.assistantError)}</div>` : ""}</div>${renderModal()}</section>`);
    if (state.player.playing) startPlayer();
  }

  function pendingCard(card) {
    if (!state.pending || state.pending.cardId !== card.id) return card;
    return { ...card, title: state.pending.title ?? card.title, segments: (state.pending.order || card.segments.map(x => x.id)).map(id => {
      const original = card.segments.find(x => x.id === id);
      return { ...original, duration: state.pending.durations?.[id] ?? original.duration };
    }) };
  }

  function renderStoryCard(original, index, currentId) {
    const card = pendingCard(original);
    const expanded = state.player.expanded.includes(card.id);
    const total = card.segments.reduce((s, x) => s + x.duration, 0);
    const originalTotal = original.segments.reduce((s, x) => s + x.duration, 0);
    const delta = total - originalTotal;
    return `<article class="card story ${card.kind === "highlight" ? "highlight" : ""} ${card.id === currentId ? "current" : ""}" onclick="UI.selectCard('${card.id}')"><div class="story-head"><span class="story-num">${index + 1}</span><div class="story-main"><h3>${esc(card.title)}</h3><div class="sub">${card.place} · ${card.date} · ${total} 秒</div></div><button class="btn small ghost" onclick="event.stopPropagation();UI.expandCard('${card.id}')">${expanded ? "收起" : "编辑"}</button></div>
      ${expanded ? `<div class="timeline" onclick="event.stopPropagation()"><label class="muted">段落标题（1–30 字符）</label><input id="title-${card.id}" class="field" value="${esc(card.title)}" onchange="UI.editTitle('${card.id}',this.value)">${card.segments.map((seg, i) => `<div class="segment ${state.player.selectedSegment === seg.id ? "on" : ""}" onclick="UI.selectSegment('${card.id}','${seg.id}')"><div><b>${i + 1}. ${seg.title}</b><div class="sub">${seg.duration} 秒 · ${seg.layout}${seg.originalAudio ? " · 保留原声" : ""}</div></div><div class="seg-actions"><button onclick="event.stopPropagation();UI.adjustSegment('${card.id}','${seg.id}',-1)" aria-label="缩短片段">−</button><button onclick="event.stopPropagation();UI.adjustSegment('${card.id}','${seg.id}',1)" aria-label="延长片段">＋</button><button onclick="event.stopPropagation();UI.moveSegment('${card.id}','${seg.id}',-1)" aria-label="片段上移">↑</button><button onclick="event.stopPropagation();UI.moveSegment('${card.id}','${seg.id}',1)" aria-label="片段下移">↓</button></div></div>`).join("")}
      ${state.pending?.cardId === card.id ? `<div class="pending">待应用修改 · 整片相对 60 秒偏差：${delta >= 0 ? "+" : ""}${delta} 秒<div class="actions" style="margin-top:8px"><button class="btn small ghost" onclick="UI.cancelPending()">取消</button><button class="btn small sage" onclick="UI.applyPending()">应用修改</button></div></div>` : ""}</div>` : ""}</article>`;
  }

  function renderProposal(p) {
    return `<article class="card proposal"><p class="eyebrow">修改前确认 · ${p.classification === "local" ? "局部修改" : "全局修改"}</p><h3 style="margin:0">${esc(p.command)}</h3><dl><dt>影响范围</dt><dd>${esc(p.scope)}</dd><dt>修改目标</dt><dd>${esc(p.target)}</dd><dt>预期结果</dt><dd>${esc(p.result)}</dd></dl><div class="actions"><button class="btn ghost" onclick="UI.cancelProposal()">取消</button><button class="btn primary" onclick="UI.applyProposal()" ${p.disabled ? "disabled" : ""}>确认应用</button></div></article>`;
  }

  function renderModal() {
    if (state.modal !== "history") return "";
    const versions = [...state.versions].reverse();
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="版本历史"><div class="sheet"><div class="row"><div><p class="eyebrow">最多保留 20 个版本</p><h2 style="margin:0">版本历史</h2></div><button class="icon-btn" onclick="UI.closeHistory()" aria-label="关闭">×</button></div><p class="muted">按创建时间倒序；选择版本不会立即改变草稿。</p>${versions.map((v, i) => `<button class="version ${i === 0 ? "current" : ""}" onclick="UI.chooseVersion('${v.id}')"><b>${v.operation} · ${v.scope}</b><div class="muted">${new Date(v.time).toLocaleString("zh-CN")} · ${esc(v.summary)}</div></button>`).join("")}${state.selectedVersion ? `<div class="notice">已选择 ${state.selectedVersion}，确认后恢复完整草稿快照。</div><div class="actions"><button class="btn ghost" onclick="UI.cancelRestore()">取消</button><button class="btn primary" onclick="UI.restoreVersion()">确认恢复</button></div>` : ""}</div></div>`;
  }

  function renderExportSettings() {
    const body = `${simLabel("固定参数，仅模拟导出")}
      <p class="eyebrow">导出前确认</p><h2 style="margin:0 0 16px">高清旅行纪念片</h2>
      <article class="card">${[["画幅", "9:16 竖屏"], ["分辨率", "1080 × 1920 像素"], ["时长", "60 秒"], ["配乐", state.draft.music], ["必要字幕", "开启"]].map(row => `<div class="strategy"><span class="ico">✓</span><div><b>${row[0]}</b><p>${esc(row[1])}</p></div></div>`).join("")}</article><div class="notice">模拟导出不会生成、保存或提供下载任何真实视频文件。</div>`;
    app.innerHTML = shell("导出设置", "draft", body, `<button class="btn primary" onclick="UI.startExport()">确认，开始模拟导出</button>`);
  }

  function renderExport() {
    const run = ensureRun("exportRun", 5000);
    if (run.completed) {
      app.innerHTML = `<section class="screen"><div class="scroll no-action"><div class="success"><div class="success-mark">✓</div><p class="eyebrow">模拟导出完成</p><h2>旅行故事已准备好</h2><p class="lead">这是成功状态演示，没有创建真实视频文件。</p>${simLabel("成功状态也是模拟结果")}<div class="actions"><button class="btn primary" onclick="UI.go('home')">返回项目首页</button><button class="btn sage" onclick="UI.go('draft')">查看主草稿</button></div></div></div></section>`;
      return;
    }
    const body = progressBody(run, "正在模拟高清导出", "模拟导出，不创建、不保存真实视频", ["检查画面", "合成字幕", "整理声音", "完成封装"]);
    app.innerHTML = shell("模拟导出", "export-settings", body, `<button class="btn primary" disabled>模拟导出进行中 · 约 5 秒</button>`);
    startProgress("exportRun", 5000, renderExport);
  }

  function render() {
    clearInterval(simTimer);
    clearInterval(playTimer);
    const pages = { home: renderHome, picker: renderPicker, checker: renderChecker, analysis: renderAnalysis, map: renderMap, setup: renderSetup, brief: renderBrief, structure: renderStructure, preview: renderPreview, draft: renderDraft, "export-settings": renderExportSettings, export: renderExport };
    const page = pages[state.page] ? state.page : "home";
    pages[page]();
    if (renderedPage !== page) renderedPage = page;
  }

  function recognize(text) {
    const value = text.trim();
    const tests = [
      ["剪短当前段落", /(剪短|缩短).*当前段落/], ["延长当前段落", /延长.*当前段落/], ["换音乐", /(换音乐|更换音乐)/],
      ["调整段落顺序", /(调整|交换).*段落顺序/], ["突出人物", /(突出人物|多放人物)/],
      ["修改当前段落标题", /修改.*当前段落标题/], ["重做当前段落", /重做.*当前段落/]
    ];
    const matches = tests.filter(x => x[1].test(value));
    return matches.length === 1 ? matches[0][0] : null;
  }

  function proposalFor(command, raw) {
    const local = ["剪短当前段落", "延长当前段落", "修改当前段落标题", "重做当前段落"].includes(command);
    const card = state.draft.cards.find(x => x.id === state.player.selectedCard) || state.draft.cards[0];
    const map = {
      "剪短当前段落": ["片段时长", "当前片段缩短 1 秒，同卡片段自动补偿，整片仍为 60 秒"],
      "延长当前段落": ["片段时长", "当前片段延长 1 秒，同卡片段自动补偿，整片仍为 60 秒"],
      "换音乐": ["统一音乐", "整片切换为本地固定温暖纪念备选音乐"],
      "调整段落顺序": ["整体顺序", "交换前两个非高光段落，高光仍固定首位"],
      "突出人物": ["人物片段", state.setup.keyPerson ? `至少两个段落增强“${state.setup.keyPerson}”画面` : "尚未标注重点人物，当前无法应用"],
      "修改当前段落标题": ["段落标题", `将“${card.title}”改为新的固定旅行标题`],
      "重做当前段落": ["片段顺序", "仅轮转当前故事卡内片段，时长不变"]
    };
    return { command, raw, classification: local ? "local" : "global", scope: local ? `仅“${card.title}”` : command === "调整段落顺序" ? "两个行程段落" : "整个 60 秒草稿", target: map[command][0], result: map[command][1], disabled: command === "突出人物" && !state.setup.keyPerson, cardId: card.id };
  }

  const UI = {
    go,
    newProject() { state = freshState(); save(); go("picker"); },
    openDemo,
    toggleMedia(id) { const set = new Set(state.selected); set.has(id) ? set.delete(id) : set.add(id); state.selected = MEDIA.filter(x => set.has(x.id)).map(x => x.id); state.pickerError = ""; save(); renderPicker(); },
    recommend() { state.selected = RECOMMENDED.slice(); state.pickerError = ""; save(); renderPicker(); },
    clearMedia() { state.selected = []; state.pickerError = ""; save(); renderPicker(); },
    continuePicker() { if (!state.selected.length) { state.pickerError = "empty"; save(); renderPicker(); return; } go("checker"); },
    startAnalysis() { state.analysis = null; go("analysis"); },
    selectPlace(place) { state.mapPlace = place; save(); renderMap(); },
    editTripEvent(id, value) { const next = value.trim(); if (!next || graphemes(next) > 20) { state.message = "事件名称应为 1 至 20 个字符。"; renderMap(); return; } const day = state.trip.timeline.find(item => item.id === id); if (day) day.event = next; state.message = "事件名称已保存。"; save(); renderMap(); },
    renamePerson(id, value) { const next = value.trim(); if (!next || graphemes(next) > 12) { state.message = "人物称呼应为 1 至 12 个字符。"; renderMap(); return; } const person = state.trip.people.find(item => item.id === id); if (person) person.name = next; state.setup.keyPerson = keyPersonName(); state.message = `人物称呼已保存为“${next}”。`; save(); renderMap(); },
    setKeyPerson(id) { state.trip.keyPersonId = id && state.trip.keyPersonId !== id ? id : null; state.setup.keyPerson = keyPersonName(); state.message = state.setup.keyPerson ? `已将“${state.setup.keyPerson}”设为唯一重点人物。` : "已取消重点人物。"; save(); state.page === "setup" ? renderSetup() : renderMap(); },
    cycleMediaStatus(id) { const order = ["normal", "keep", "avoid"]; const current = state.trip.mediaStatus[id] || "normal"; state.trip.mediaStatus[id] = order[(order.indexOf(current) + 1) % order.length]; save(); renderMap(); },
    restoreMedia(id) { if (!state.trip.recoveredMediaIds.includes(id)) state.trip.recoveredMediaIds.push(id); state.trip.mediaStatus[id] = "normal"; state.message = "素材已恢复使用，并设为普通。"; save(); renderMap(); },
    finishMap(choice) { state.mapChoice = choice; state.setup.keyPerson = keyPersonName(); save(); go("setup"); },
    toggleContentFocus(item) { const current = state.setup.contentFocus.slice(); const index = current.indexOf(item); if (index >= 0) { if (current.length === 1) state.setup.error = "请至少保留一项内容重点。"; else { current.splice(index, 1); state.setup.error = ""; } } else if (current.length >= 2) state.setup.error = "内容重点最多选择 2 项。"; else { current.push(item); state.setup.error = ""; } state.setup.contentFocus = current; save(); renderSetup(); },
    chooseSetup(key, value) { state.setup[key] = value; if (key === "atmosphere") state.setup.style = value; state.setup.error = ""; save(); renderSetup(); },
    toggleSetupList(key, value) { const set = new Set(state.setup[key]); set.has(value) ? set.delete(value) : set.add(value); state.setup[key] = [...set]; state.setup.error = ""; save(); renderSetup(); },
    captureIntent(value) { state.setup.input = value; state.setup.error = ""; save(); },
    completeSetup() { const input = document.getElementById("setupInput")?.value ?? state.setup.input; const count = graphemes(input); if (count > 200) { state.setup.error = "自然语言补充最多输入 200 个字符。"; save(); renderSetup(); return; } state.setup.input = input.trim(); state.setup.keyPerson = keyPersonName(); state.setup.error = ""; save(); go("brief"); },
    prepareStructure() { if (!state.structure) state.structure = makeStructure(); save(); go("structure"); },
    lockHighlight() { state.message = "高光段落必须位于首位，不能移动。"; save(); renderStructure(); },
    moveSection(index, direction) { const target = index + direction; if (index === 0 || target <= 0) { UI.lockHighlight(); return; } if (target >= state.structure.length) return; const [moved] = state.structure.splice(index, 1); state.structure.splice(target, 0, moved); state.message = "段落顺序已保存。"; save(); renderStructure(); },
    toggleStructureDetail(id) { const set = new Set(state.structureExpanded); set.has(id) ? set.delete(id) : set.add(id); state.structureExpanded = [...set]; save(); renderStructure(); },
    startPreview() { state.preview = null; state.draft = null; state.versions = []; go("preview"); },
    togglePlay() { state.player.playing = !state.player.playing; save(); renderDraft(); },
    seek(value) { state.player.position = Math.min(60, Math.max(0, Number(value))); state.player.playing = false; save(); renderDraft(); },
    selectCard(id) { const range = cardRanges().find(x => x.card.id === id); if (range) { state.player.position = range.start; state.player.selectedCard = id; state.player.playing = false; save(); renderDraft(); } },
    expandCard(id) { const set = new Set(state.player.expanded); set.has(id) ? set.delete(id) : set.add(id); state.player.expanded = [...set]; state.player.selectedCard = id; save(); renderDraft(); },
    selectSegment(cardId, segmentId) { state.player.selectedCard = cardId; state.player.selectedSegment = segmentId; save(); renderDraft(); },
    editTitle(cardId, value) { const count = graphemes(value); if (count < 1 || count > 30) { state.assistantError = "标题应为 1 至 30 个 Unicode 字符。"; renderDraft(); return; } const card = state.draft.cards.find(x => x.id === cardId); state.pending = state.pending?.cardId === cardId ? state.pending : { cardId }; state.pending.title = value.trim(); state.assistantError = ""; save(); renderDraft(); },
    adjustSegment(cardId, segmentId, delta) { const card = pendingCard(state.draft.cards.find(x => x.id === cardId)); const seg = card.segments.find(x => x.id === segmentId); const next = Math.max(1, Math.min(60, seg.duration + delta)); state.pending = state.pending?.cardId === cardId ? state.pending : { cardId }; state.pending.durations ||= {}; state.pending.durations[segmentId] = next; state.player.selectedSegment = segmentId; save(); renderDraft(); },
    moveSegment(cardId, segmentId, direction) { const card = pendingCard(state.draft.cards.find(x => x.id === cardId)); const order = card.segments.map(x => x.id); const from = order.indexOf(segmentId), to = from + direction; if (to < 0 || to >= order.length) return; order.splice(to, 0, order.splice(from, 1)[0]); state.pending = state.pending?.cardId === cardId ? state.pending : { cardId }; state.pending.order = order; save(); renderDraft(); },
    cancelPending() { state.pending = null; save(); renderDraft(); },
    applyPending() { const p = state.pending; if (!p) return; const index = state.draft.cards.findIndex(x => x.id === p.cardId); const original = state.draft.cards[index]; let next = pendingCard(original); const oldTotal = original.segments.reduce((s, x) => s + x.duration, 0); const nextTotal = next.segments.reduce((s, x) => s + x.duration, 0); const delta = nextTotal - oldTotal; if (delta !== 0) { const selected = state.player.selectedSegment; const compensate = next.segments.find(x => x.id !== selected && x.duration - delta >= 1 && x.duration - delta <= 60); if (!compensate) { state.assistantError = "同卡其他片段没有足够补偿空间，无法保持整片 60 秒。"; renderDraft(); return; } compensate.duration -= delta; } state.draft.cards[index] = next; state.pending = null; state.assistantError = ""; snapshot("应用故事卡标题、时长或顺序修改", "局部", "故事卡编辑"); renderDraft(); },
    fillAssistant(text) { state.assistantInput = text.includes("更紧凑") ? "剪短当前段落" : text; save(); renderDraft(); setTimeout(() => document.getElementById("assistantInput")?.focus(), 0); },
    submitAssistant() { const raw = document.getElementById("assistantInput").value; state.assistantInput = raw; const count = graphemes(raw); if (!count) state.assistantError = "输入不能为空。"; else if (count > 200) state.assistantError = "最多输入 200 个 Unicode 字符。"; else { const command = recognize(raw); if (!command) state.assistantError = `仅支持：${COMMANDS.join("、")}。`; else { state.assistantError = ""; state.proposal = proposalFor(command, raw); } } save(); renderDraft(); },
    cancelProposal() { state.proposal = null; save(); renderDraft(); },
    applyProposal() { const p = state.proposal; if (!p || p.disabled) return; const index = state.draft.cards.findIndex(x => x.id === p.cardId); const card = state.draft.cards[index]; if (p.command === "调整段落顺序" && state.draft.cards.length > 2) [state.draft.cards[1], state.draft.cards[2]] = [state.draft.cards[2], state.draft.cards[1]];
      else if (p.command === "换音乐") state.draft.music = state.draft.music.includes("岛屿晚风") ? "温暖纪念 · 一路花开" : "温暖纪念 · 岛屿晚风";
      else if (p.command === "修改当前段落标题") { const named = p.raw.split(/[：:]/)[1]?.trim(); card.title = named && graphemes(named) <= 30 ? named : `${card.place} · 值得记住的一天`; }
      else if (p.command === "重做当前段落") card.segments.push(card.segments.shift());
      else if ((p.command === "剪短当前段落" || p.command === "延长当前段落") && card.segments.length > 1) { const amount = p.command === "剪短当前段落" ? -1 : 1; if (card.segments[0].duration + amount >= 1 && card.segments[1].duration - amount >= 1) { card.segments[0].duration += amount; card.segments[1].duration -= amount; } }
      else if (p.command === "突出人物") { state.draft.cards.slice(0, 2).forEach(c => c.segments[0].title = `${state.setup.keyPerson}的旅行瞬间`); }
      state.proposal = null; state.assistantInput = ""; snapshot(`模拟 AI：${p.command}`, p.classification === "local" ? "局部" : "全局", "AI 修改"); renderDraft(); },
    undo() { if (!state.undoAvailable || state.versions.length < 2) return; const previous = state.versions[state.versions.length - 2]; state.draft = JSON.parse(JSON.stringify(previous.snapshot)); state.undoAvailable = false; snapshot("撤销最近一次成功修改", "完整", "撤销"); state.undoAvailable = false; save(); renderDraft(); },
    openHistory() { state.modal = "history"; state.selectedVersion = null; renderDraft(); },
    closeHistory() { state.modal = null; state.selectedVersion = null; renderDraft(); },
    chooseVersion(id) { state.selectedVersion = id; renderDraft(); },
    cancelRestore() { state.selectedVersion = null; renderDraft(); },
    restoreVersion() { const version = state.versions.find(x => x.id === state.selectedVersion); if (!version) return; state.draft = JSON.parse(JSON.stringify(version.snapshot)); state.modal = null; state.selectedVersion = null; snapshot(`恢复历史版本 ${version.id}`, "完整", "历史恢复"); renderDraft(); },
    startExport() { state.exportRun = null; go("export"); }
  };

  function startPlayer() {
    clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (!state.player.playing || state.page !== "draft") return;
      state.player.position = Math.min(60, state.player.position + 0.25);
      if (state.player.position >= 60) state.player.playing = false;
      updatePlayerDOM();
      if (Date.now() - lastPlayerSave > 1500 || !state.player.playing) { lastPlayerSave = Date.now(); save(); }
      if (!state.player.playing) { clearInterval(playTimer); renderDraft(); }
    }, 250);
  }

  function updatePlayerDOM() {
    const range = currentRange();
    if (!range) return;
    state.player.selectedCard = range.card.id;
    const seek = document.getElementById("seek"), time = document.getElementById("playerTime"), title = document.getElementById("playerTitle"), place = document.getElementById("playerPlace"), scene = document.getElementById("playerScene");
    if (seek) seek.value = state.player.position;
    if (time) time.textContent = `${formatSeconds(state.player.position)} / 1:00`;
    if (title) title.textContent = range.card.title;
    if (place) place.textContent = `${range.card.place} · ${range.card.date}${state.player.position < 4 ? " · 片头标题" : ""}`;
    if (scene) scene.style.setProperty("--scene", SCENES[(PLACES.indexOf(range.card.place) + Math.floor(state.player.position / 5)) % SCENES.length]);
    document.querySelectorAll(".story").forEach((el, i) => el.classList.toggle("current", state.draft.cards[i]?.id === range.card.id));
  }

  window.UI = UI;
  if (location.hash && state.page === "home") {
    const requested = location.hash.slice(1);
    if (["home", "picker", "checker", "analysis", "map", "setup", "brief", "structure", "preview", "draft", "export-settings", "export"].includes(requested)) state.page = requested;
  }
  render();
})();
