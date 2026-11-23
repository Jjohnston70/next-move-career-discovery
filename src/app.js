/*
 * Next Move v1.3.0 — private, offline-capable career exploration application.
 *
 * DATA FLOW:
 * User input -> transient JavaScript state -> optional same-device localStorage
 *                                      -> user-initiated JSON/encrypted backup
 *                                      -> user-initiated browser print/PDF
 *
 * No user answers are sent to a server, analytics endpoint, external AI, or log.
 * Console diagnostics describe app operations only, NEVER answers or PII.
 * The exploration ranking is a transparent conversational aid, NOT a validated
 * personality, intelligence, aptitude, or career-fit score.
 */
(function () {
  "use strict";

  const D = window.NM_DATA;
  const VERSION = "1.3.0";
  // Isolated storage namespace for this individual edition.
  const REPORT_TO = ""; // User chooses the email recipient in their mail app.
  const EMAIL_CONFIG = window.NM_CONFIG || { emailApiEnabled: false };
  const STORAGE = "next-move-template-v3";
  const NAV = [
    { id: "home", label: "Basecamp", icon: "⌂", group: "START" },
    { id: "guide", label: "Read this first", icon: "?" },
    { id: "story", label: "1. Where I am", icon: "01", group: "DISCOVER" },
    { id: "interests", label: "2. What sparks me", icon: "02" },
    { id: "workstyle", label: "3. How I work", icon: "03" },
    { id: "values", label: "4. What matters", icon: "04" },
    { id: "thinking", label: "5. Thinking lab", icon: "05" },
    { id: "future", label: "6. Looking ahead", icon: "06" },
    { id: "onet", label: "O*NET interest profile", icon: "◎", group: "EXPLORE" },
    { id: "compass", label: "Interest compass", icon: "✧" },
    { id: "explore", label: "Career possibilities", icon: "↗" },
    { id: "resources", label: "Trusted assessments", icon: "☷" },
    { id: "fieldwork", label: "Real-world tests", icon: "◉", group: "TEST" },
    { id: "report", label: "My field guide", icon: "▤" },
    { id: "share", label: "Finish & share", icon: "✉", group: "SHARE / OPTIONAL" },
    { id: "settings", label: "Privacy & backups", icon: "⚿", group: "CONTROL" }
  ];
  const SECTION_TEXT = {
    story: { eyebrow: "DISCOVER / 01", title: "Where I am", subtitle: "Understand what's working, what's wearing you down, and what is worth carrying forward.", next: "interests" },
    interests: { eyebrow: "DISCOVER / 02", title: "What sparks me", subtitle: "Look for the moments that hold your attention. Nothing has to sound like a career yet.", next: "workstyle" },
    workstyle: { eyebrow: "DISCOVER / 03", title: "How I work", subtitle: "Explore what a good working day looks like. The middle of a scale is a completely valid answer.", next: "values" },
    values: { eyebrow: "DISCOVER / 04", title: "What matters", subtitle: "Define what your next move needs to support: money, autonomy, learning, stability, and life outside work.", next: "thinking" },
    thinking: { eyebrow: "DISCOVER / 05", title: "Thinking lab", subtitle: "Try six real-world scenarios. There is no grading; the goal is to notice how you approach uncertainty and problems.", next: "future" },
    future: { eyebrow: "DISCOVER / 06", title: "Looking ahead", subtitle: "Give yourself permission to be curious about more than one future.", next: "compass" }
  };
  const WORK_STYLE = {
    12: ["Hands-on / physical work", "A blend of physical and desk work", "Computer-based work"],
    13: ["More independent work", "A mix of independent and team work", "Frequent collaboration"],
    14: ["Established methods", "Some structure and some freedom", "Freedom to design the approach"],
    15: ["Predictable routines", "A mix of routine and variety", "New situations often"],
    16: ["Tangible results each day", "Both short and long projects", "Longer projects and goals"],
    17: ["Predictable earnings", "A balance of stability and upside", "More variable earnings potential"]
  };
  const FAMILY_TYPES = ["All", ...new Set(D.lanes.map(x => x.family))];
  const ALL_QUESTIONS = Object.values(D.questions).flat();
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const attr = esc;
  const isoDate = () => new Date().toISOString().slice(0, 10);
  const isText = (v) => typeof v === "string" && v.trim().length > 0;
  const isNumberRating = (v) => Number.isInteger(v) && v >= 1 && v <= 5;
  const safeId = () => (crypto && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  /** In-memory default. No personal responses persist unless user opts in. */
  function freshState() {
    return { schemaVersion: 1, startedAt: new Date().toISOString(), displayName: "Participant", answers: {}, reflections: {},
      thinking: {}, lenses: {}, onetAnswers: {}, pins: [], dismissed: [], experiments: [], resourceNotes: {},
      saveOnDevice: false, demo: false };
  }

  /** Bound all imported/saved data to known primitives and maximum size. */
  function cleanState(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || data.schemaVersion !== 1) {
      throw new Error("This is not a compatible Next Move v1 backup.");
    }
    const clean = freshState();
    // The name is optional. Never use a name to automatically identify or send anything.
    clean.displayName = typeof data.displayName === "string" ? data.displayName.slice(0, 60) : "Participant";
    const limit = (v, max = 8000) => typeof v === "string" ? v.slice(0, max) : "";
    for (const q of ALL_QUESTIONS) {
      const v = (data.answers || {})[q.id];
      if (q.kind === "scale" && isNumberRating(v)) clean.answers[q.id] = v;
      else if (q.kind === "top3" && Array.isArray(v)) clean.answers[q.id] = [...new Set(v.filter(x => D.workValues.includes(x)))].slice(0, 3);
      else if (q.kind === "salary" && v && typeof v === "object") clean.answers[q.id] = { today: limit(v.today, 80), future: limit(v.future, 80) };
      else if (q.kind === "vision" && v && typeof v === "object") clean.answers[q.id] = { future: limit(v.future), firstTest: limit(v.firstTest) };
      else if (["long", "scenario"].includes(q.kind)) clean.answers[q.id] = limit(v);
    }
    for (const r of D.reflections) clean.reflections[r.id] = limit((data.reflections || {})[r.id]);
    for (const lens of D.lenses) {
      const v = (data.lenses || {})[lens.id];
      if (isNumberRating(v)) clean.lenses[lens.id] = v;
    }
    for (const q of D.questions.thinking) {
      const choices = (data.thinking || {})[q.id];
      if (Array.isArray(choices)) clean.thinking[q.id] = [...new Set(choices.filter(t => D.thinkingMoves.some(m => m.id === t)))];
    }
    const validLaneIds = new Set(D.lanes.map(x => x.id));
    clean.pins = [...new Set((Array.isArray(data.pins) ? data.pins : []).filter(x => validLaneIds.has(x)))];
    clean.dismissed = [...new Set((Array.isArray(data.dismissed) ? data.dismissed : []).filter(x => validLaneIds.has(x)))];
    const rawExp = Array.isArray(data.experiments) ? data.experiments.slice(0, 200) : [];
    clean.experiments = rawExp.map((e, i) => ({
      id: limit(e && e.id, 90) || `restored-${i}`,
      title: limit(e && e.title, 160), lane: validLaneIds.has(e && e.lane) ? e.lane : "",
      mode: ["Job shadow", "Interview", "Mini project", "Volunteer", "Workshop", "Other"].includes(e && e.mode) ? e.mode : "Other",
      date: /^\d{4}-\d{2}-\d{2}$/.test(e && e.date) ? e.date : "",
      status: (e && e.status) === "completed" ? "completed" : "planned",
      energy: isNumberRating(e && e.energy) ? e.energy : null,
      curiosity: isNumberRating(e && e.curiosity) ? e.curiosity : null,
      repeat: isNumberRating(e && e.repeat) ? e.repeat : null,
      notes: limit(e && e.notes), next: limit(e && e.next)
    })).filter(e => e.title);
    // Backwards-compatible import: v1.2 backups have no onetAnswers property.
    for (const q of D.onetMini.items) {
      const n = (data.onetAnswers || {})[q.id];
      if (isNumberRating(n)) clean.onetAnswers[q.id] = n;
    }
    for (let i = 0; i < D.resources.length; i++) clean.resourceNotes[i] = limit((data.resourceNotes || {})[i]);
    clean.startedAt = typeof data.startedAt === "string" && data.startedAt.length < 60 ? data.startedAt : clean.startedAt;
    clean.saveOnDevice = data.saveOnDevice === true;
    clean.demo = data.demo === true;
    return clean;
  }

  /** Device storage is optional and unencrypted; handle disabled storage safely. */
  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw && raw.length < 2000000) {
        const v = cleanState(JSON.parse(raw));
        if (v.saveOnDevice) {
          console.info("[Next Move] Restored optional local-device session; no answers logged.");
          return v;
        }
      }
    } catch (error) {
      console.warn("[Next Move] Local-device storage unavailable; continuing in memory only.");
    }
    return null;
  }

  let state = readSaved() || freshState();
  let route = (location.hash || "#home").replace(/^#/, "");
  let ui = { search: "", family: "All", onlyPinned: false, showDismissed: false,
    expanded: new Set(), editExperiment: null, modalOpen: false, draftRatings: {},
    showFullAnswers: false, lastRoute: "home", toastTimer: null,
    shareScope: "summary", shareReady: false, shareConsent: false,
    shareCode: "", sending: false, shareStatus: "", emailDraftPrepared: false, onetPage: 0, onetSearch: "" };
  // Official occupation files are optional, transient, and never uploaded.
  let occupationFiles = { interests: null, occupations: null, zones: null };
  let occupationRows = [];
  let occupationMessage = "";

  function persist() {
    try {
      if (state.saveOnDevice) localStorage.setItem(STORAGE, JSON.stringify(state));
      else {
        // Storage may be unavailable in restrictive or private browser contexts.
        // If saving is off, this is not a user-facing error.
        try { localStorage.removeItem(STORAGE); } catch (ignored) { /* Memory-only mode works. */ }
      }
    } catch (error) {
      state.saveOnDevice = false;
      toast("This browser cannot save on this device. Use a backup file instead.");
      console.warn("[Next Move] Local device save unavailable; no answers logged.");
    }
    const status = $("save-status");
    if (status) status.textContent = state.saveOnDevice ? "Saved on this device" : "In memory only";
  }

  function answered(q) {
    const v = state.answers[q.id];
    if (q.kind === "scale") return isNumberRating(v);
    if (q.kind === "top3") return Array.isArray(v) && v.length === 3;
    if (q.kind === "salary") return !!(v && (isText(v.today) || isText(v.future)));
    if (q.kind === "vision") return !!(v && (isText(v.future) || isText(v.firstTest)));
    return isText(v);
  }
  const countAnswered = () => ALL_QUESTIONS.filter(answered).length;
  const countLenses = () => Object.values(state.lenses).filter(isNumberRating).length;
  const countReflections = () => D.reflections.filter(r => isText(state.reflections[r.id])).length;
  const progressPercent = () => Math.round(100 * countAnswered() / ALL_QUESTIONS.length);
  const getAnswer = (id) => state.answers[id] || "";
  const getObjAnswer = (id) => (state.answers[id] && typeof state.answers[id] === "object" && !Array.isArray(state.answers[id])) ? state.answers[id] : {};
  const getLane = (id) => D.lanes.find(x => x.id === id);
  const lensName = (id) => (D.lenses.find(x => x.id === id) || {}).title || id;

  function toast(message) {
    const old = $("toast"); if (old) old.remove();
    const el = document.createElement("div"); el.className = "toast"; el.id = "toast";
    el.setAttribute("role", "status"); el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => el.remove(), 4300);
  }

  function routeTo(next) {
    if (!NAV.some(x => x.id === next)) next = "home";
    if (route === next) { render(true); return; }
    ui.lastRoute = route;
    location.hash = next;
    // `hashchange` performs render and shifts focus for keyboard users.
  }

  function head(eyebrow, title, subtitle, extra = "") {
    return `<div class="section-head"><div class="section-head-title"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="lead">${esc(subtitle)}</p></div>${extra}</div>`;
  }

  function renderNavigation() {
    let lastGroup = "";
    const html = NAV.map(item => {
      let separator = "";
      if (item.group && item.group !== lastGroup) { lastGroup = item.group; separator = `<div class="nav-kicker">${esc(item.group)}</div>`; }
      return `${separator}<button type="button" class="nav-link" data-route="${item.id}" ${route === item.id ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-name">${esc(item.label)}</span></button>`;
    }).join("");
    $("nav-list").innerHTML = html;
  }

  function renderHome() {
    const count = countAnswered();
    return `<div class="hero"><div class="hero-copy">
      <div class="hero-kicker"><span class="hero-dot"></span> YOUR DIRECTION. YOUR CALL.</div>
      <h1>You don't need to have it <em>all figured out.</em></h1>
      <p class="lead">This is a place to understand what matters to you, explore work you might enjoy, and test possibilities in the real world—without being put in a box.</p>
      <div class="button-row"><button class="btn btn-primary" data-route="${count ? "story" : "story"}">${count ? "Continue discovery" : "Start discovering"} <span aria-hidden="true">↗</span></button><button class="btn btn-ghost" data-route="explore">Browse career ideas</button></div>
      <div class="hero-note">✦ No grades &nbsp; ✦ No career assigned &nbsp; ✦ Your answers stay yours</div><div class="button-row" style="margin-top:12px"><button class="btn btn-ghost" data-route="onet">Complete the O*NET interest profile →</button></div>
      <div class="button-row" style="margin-top:14px"><button class="btn btn-ghost" data-route="guide">New here? Read the 2-minute instructions →</button></div>
    </div></div>
    <div class="overview columns-3">
      <div class="card"><div class="card-icon">◇</div><h3>Discover, don't diagnose</h3><p>Explore your interests, frustrations, skills, thinking habits, and work preferences with no right or wrong answers.</p></div>
      <div class="card"><div class="card-icon">↗</div><h3>Keep your options open</h3><p>Compare many types of work—even ones you have never considered. Your past training is a skill, not a life sentence.</p></div>
      <div class="card"><div class="card-icon">◎</div><h3>Try before you commit</h3><p>Plan low-risk job shadows, conversations, and mini-projects. Track what actually energizes you.</p></div>
    </div>
    <div class="home-grid">
      <div class="card home-next"><div><div class="eyebrow">YOUR PROGRESS</div><h2 style="font-size:27px;margin:8px 0 10px">Small steps count.</h2><p>Answer in any order. Skip anything you don't want to share. You can change your mind later.</p></div>
        <div class="progress-row"><div class="progress-circle" style="--p:${progressPercent()}%"><span>${progressPercent()}%</span></div>
        <div><strong>${count} of 30 questions explored</strong><div class="muted" style="font-size:12px">${countLenses()} of 10 informal interest prompts · ${onetCompleted()} of 30 O*NET activities · ${state.experiments.length} field tests</div></div></div>
        <div class="button-row"><button class="btn btn-primary" data-route="story">Open questionnaire</button><button class="btn" data-route="report">See my field guide</button><button class="btn btn-ghost" data-route="share">Finish & share</button></div>
      </div>
      <div class="card home-next"><div><div class="eyebrow">A NOTE ABOUT OWNERSHIP</div><h2 style="font-size:27px;margin:8px 0 10px">This is for you.</h2><p>Nobody else sees these answers unless you choose to share or export them. No account is required. Nothing gets sent to an AI service.</p><div class="notice"><span class="notice-icon">ⓘ</span><div>By default, your progress is only kept in this open tab. Choose <strong>Save on this device</strong> or download a protected backup to keep it.</div></div></div><button class="btn btn-ghost" data-route="settings">Choose privacy & saving →</button></div>
    </div>`;
  }

  /** In-app user instructions; no outside account or assessment credential is needed. */
  function renderGuide() {
    return `${head("START / YOUR GUIDE", "Read this first", "This is your space to explore what you enjoy and what you want to try. Nobody gets a score or a copy of your answers unless you choose to share.")}
      <div class="info-banner"><strong>There is no right answer.</strong><p>This app does not judge your career, intelligence, or progress. It helps you explore options and learn from real experiences. You can change your answers and your mind whenever you like.</p></div>
      <div class="steps-grid">
        <article class="card step-card"><div class="step-number">01</div><h3>Choose how to save</h3><p>Go to Privacy & backups. By default, closing or refreshing the tab can erase unsaved answers. On your own trusted device you can turn on local saving or download a protected backup.</p><button class="btn" data-route="settings">Privacy & backups</button></article>
        <article class="card step-card"><div class="step-number">02</div><h3>Answer what you want</h3><p>The 30 questions cover experiences, curiosity, work preferences, values, and decisions. Skipping a question is fine. The Thinking Lab has no right or wrong answers.</p><button class="btn" data-route="story">Start the questionnaire</button></article>
        <article class="card step-card"><div class="step-number">03</div><h3>Try the O*NET interest profile</h3><p>The published 30-item Mini Interest Profiler is built into this app. Rate which work activities sound interesting, then review your six interest areas without sharing anything.</p><button class="btn" data-route="onet">Start O*NET profile</button></article>
        <article class="card step-card"><div class="step-number">04</div><h3>Try something small</h3><p>Interview someone, observe a workplace, or test an everyday skill safely. Write down whether the activity energized you and what you learned.</p><button class="btn" data-route="fieldwork">Plan a real-world test</button></article>
        <article class="card step-card"><div class="step-number">05</div><h3>Review your own report</h3><p>The report shows what you've noticed, shortlisted, and tried. You can print or save a PDF. Written answers stay hidden from the printable report unless you reveal them.</p><button class="btn" data-route="report">Open my report</button></article>
        <article class="card step-card"><div class="step-number">06</div><h3>Share only when ready</h3><p>If you would like help from someone you choose, review a short summary or full written report. Only you decide whether to prepare and send the email. Emailing is optional.</p><button class="btn btn-primary" data-route="share">Finish & share</button></article>
      </div>
      <div class="notice" style="margin-top:18px"><span class="notice-icon">ⓘ</span><div><strong>One more thing:</strong> Don't complete this for someone else's approval. The goal is to find useful options and test them—not to commit to a career today. No response is sent to a parent or a business automatically.</div></div>`;
  }

  function renderQuestion(q) {
    const title = `<div class="question-head"><div class="q-number">${String(q.id).padStart(2, "0")}</div><div><h3 id="qtitle-${q.id}">${esc(q.text)}</h3>${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ""}</div></div>`;
    let control = "";
    if (q.kind === "long") {
      control = `<label class="visually-hidden" for="answer-${q.id}">Your answer to question ${q.id}</label><textarea id="answer-${q.id}" data-answer="${q.id}" rows="3" placeholder="What comes to mind? You can leave this blank.">${esc(getAnswer(q.id))}</textarea>`;
    } else if (q.kind === "scale") {
      const value = state.answers[q.id];
      control = `<div class="scale-options" role="group" aria-labelledby="qtitle-${q.id}">${[1,2,3,4,5].map(n => `<button type="button" class="scale-btn" data-rating="${q.id}" data-value="${n}" aria-label="${n} out of 5" aria-pressed="${value === n}">${n}</button>`).join("")}</div><div class="scale-caption"><span>${esc(q.left)}</span><span>${esc(q.right)}</span></div><span class="scale-mid">3 = a mix, it depends, or neither extreme. You can select any answer again to clear it.</span>`;
    } else if (q.kind === "top3") {
      const picks = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
      control = `<div class="chip-grid" role="group" aria-labelledby="qtitle-${q.id}">${D.workValues.map(v => `<button type="button" class="chip" data-value-pick="${attr(v)}" aria-pressed="${picks.includes(v)}" ${picks.length >= 3 && !picks.includes(v) ? "disabled" : ""}>${esc(v)}</button>`).join("")}</div><div class="chip-info" role="status">${picks.length} of 3 selected ${picks.length === 3 ? "· You can change a selection" : "· Choose up to three"}</div>`;
    } else if (q.kind === "salary") {
      const v = getObjAnswer(19);
      control = `<div class="columns-2"><div class="field"><label for="income-today">Comfortable income today (optional)</label><input type="text" id="income-today" data-composite="19" data-part="today" maxlength="80" placeholder="Your own amount or range" value="${attr(v.today || "")}"></div><div class="field"><label for="income-future">Hope to earn in 3 years (optional)</label><input type="text" id="income-future" data-composite="19" data-part="future" maxlength="80" placeholder="Your own target" value="${attr(v.future || "")}"></div></div><div class="field-note">These figures never influence the suggested exploration order.</div>`;
    } else if (q.kind === "scenario") {
      const checks = state.thinking[q.id] || [];
      control = `<div class="scenario-setup">${esc(q.text)}</div><label class="visually-hidden" for="answer-${q.id}">How you would handle scenario ${q.id}</label><textarea rows="4" id="answer-${q.id}" data-answer="${q.id}" placeholder="What would you notice? What would you do? What might change your mind?">${esc(getAnswer(q.id))}</textarea><div class="divider"></div><div class="check-note">Thinking moves I considered (optional self-reflection, not a grade)</div><div class="check-grid">${D.thinkingMoves.map(m => `<label class="checkbox-row"><input type="checkbox" data-think="${q.id}" data-move="${m.id}" ${checks.includes(m.id) ? "checked" : ""}><span>${esc(m.label)}</span></label>`).join("")}</div>`;
    } else if (q.kind === "vision") {
      const v = getObjAnswer(30);
      control = `<label class="field-label" for="vision">My five-year picture</label><textarea id="vision" rows="4" data-composite="30" data-part="future" placeholder="A life that feels like mine might include…">${esc(v.future || "")}</textarea><label class="field-label" for="next-test">One small thing I'd be willing to try this month</label><textarea id="next-test" rows="2" data-composite="30" data-part="firstTest" placeholder="I could try…">${esc(v.firstTest || "")}</textarea>`;
    }
    return `<section class="question" aria-labelledby="qtitle-${q.id}">${title}${control}</section>`;
  }

  function renderDiscovery(section) {
    const meta = SECTION_TEXT[section];
    let html = `${head(meta.eyebrow, meta.title, meta.subtitle)}<div class="question-stack">${D.questions[section].map(renderQuestion).join("")}</div>`;
    if (section === "thinking") {
      html = `${head(meta.eyebrow, meta.title, meta.subtitle)}<div class="notice"><span class="notice-icon">◎</span><div><strong>There is no right-thinking score.</strong> These exercises help you notice whether you seek facts, take action, work with people, consider alternatives, and change plans when new evidence appears. A single answer cannot tell you what kind of thinker you are.</div></div><div class="question-stack">${D.questions.thinking.map(renderQuestion).join("")}</div>`;
    }
    if (section === "future") {
      html += `<section class="reflection-box"><div class="eyebrow">FINAL REFLECTION / OPTIONAL</div><h3>Finish these sentences.</h3><p>These are for you. Leave anything blank that you aren't comfortable answering.</p>${D.reflections.map(r => `<div class="reflection-row"><label for="reflection-${r.id}">${esc(r.text)}</label><textarea id="reflection-${r.id}" rows="2" data-reflection="${r.id}" placeholder="In my own words…">${esc(state.reflections[r.id] || "")}</textarea></div>`).join("")}</section>`;
    }
    const n = D.questions[section].filter(answered).length;
    html += `<div class="sticky-bottom"><div class="quiet" style="font-size:12px">${n} of ${D.questions[section].length} questions explored in this section</div><div class="button-row"><button class="btn btn-ghost" data-route="home">Basecamp</button><button class="btn btn-primary" data-route="${meta.next}">Continue →</button></div></div>`;
    return html;
  }


  /** Mini-IP: six published five-item sums, with 1..5 mapped to 0..4. */
  function onetCompleted() { return D.onetMini.items.filter(q=>isNumberRating(state.onetAnswers[q.id])).length; }
  function onetScores() {
    if (onetCompleted() !== 30) return null;
    const scores = { R:0, I:0, A:0, S:0, E:0, C:0 };
    for (const q of D.onetMini.items) scores[q.area] += state.onetAnswers[q.id]-1;
    return scores;
  }
  const INTEREST_LABELS = {R:"Realistic",I:"Investigative",A:"Artistic",S:"Social",E:"Enterprising",C:"Conventional"};
  // Editorial mapping to existing Next Move idea cards; NOT O*NET career matching.
  const LANE_INTERESTS = {"repair":"RI","buildingtrades":"RC","fleet":"RC","manufacturing":"RC","logistics":"CE","quality":"CI","analysis":"IC","support":"IC","automation":"IA","technicalsales":"ES","teaching":"SA","community":"SE","healthtech":"IR","environment":"RI","creative":"A","marketing":"AE","events":"AE","foodbeyond":"AR","smallbiz":"E","bookkeeping":"C"};
  const ONET_SOURCE_LINKS = {
    interests:"https://www.onetcenter.org/dl_files/database/db_31_0_json/career_interest_types.json",
    occupations:"https://www.onetcenter.org/dl_files/database/db_31_0_json/occupation_data.json",
    zones:"https://www.onetcenter.org/dl_files/database/db_31_0_json/job_zones.json"
  };
  function onetTop() {
    const scores = onetScores();
    if (!scores) return [];
    return Object.keys(scores).sort((a,b)=>scores[b]-scores[a] || "RIASEC".indexOf(a)-"RIASEC".indexOf(b));
  }
  function onetHighestAreas() {
    const scores=onetScores(); if(!scores) return [];
    const max=Math.max(...Object.values(scores));
    if (max===0) return [];
    const leaders=onetTop().filter(k=>scores[k]===max);
    return leaders.length===6 ? [] : leaders;
  }
  function onetHighText() {
    const scores=onetScores(); if(!scores) return "Not completed yet";
    const values=Object.values(scores);
    if (Math.max(...values)===0) return "No interest was expressed in the listed activities; explore other possibilities";
    const leaders=onetHighestAreas();
    if (!leaders.length) return "All six areas scored equally; explore broadly";
    return leaders.map(k=>INTEREST_LABELS[k]).join(" · ");
  }
  function onetStartingPoints() {
    const scores=onetScores(); if(!scores || new Set(Object.values(scores)).size===1) return [];
    const sorted=onetTop();
    // Include at most three highest nonzero areas; illustrative, not official matches.
    const first=sorted.filter(k=>scores[k]>0).slice(0,3);
    return D.lanes.filter(l=>(LANE_INTERESTS[l.id]||"").split("").some(x=>first.includes(x))).slice(0,8);
  }
  function renderOnet() {
    const count=onetCompleted(), scores=onetScores(), rank=onetTop();
    const start=ui.onetPage*6, six=D.onetMini.items.slice(start,start+6);
    const labels=["Strongly dislike","Dislike","Unsure","Like","Strongly like"];
    const bars=scores?`<section class="setting-card" id="onet-results"><div class="eyebrow">COMPLETE / PERSONAL INTEREST PROFILE</div><h2>Your six interest areas</h2>
       <p>Scores range from 0 to 20 per area. Higher scores suggest more interest in these activities, not skill, ability, or job suitability. Ties are normal.</p>
       <div class="bar-list">${rank.map(k=>`<div class="bar-item"><span>${INTEREST_LABELS[k]}</span><div class="bar-track" role="img" aria-label="${INTEREST_LABELS[k]}: ${scores[k]} of 20"><div class="bar-fill" style="width:${scores[k]*5}%"></div></div><strong>${scores[k]}/20</strong></div>`).join("")}</div>
       <p><strong>Interest areas to explore:</strong> ${onetHighText()}.</p>
       <div class="button-row"><button class="btn btn-primary" data-route="explore">Explore career directions</button><button class="btn" data-route="report">View my report</button></div></section>` :
       `<div class="notice"><span class="notice-icon">◎</span><div><strong>Complete all 30 activities to see a profile.</strong> Your partial answers stay local. ${30-count} remaining. No results are calculated or shared until the profile is complete.</div></div>`;
    const officialData=occupationRows.length ? `<section class="setting-card"><div class="eyebrow">OPTIONAL / OFFLINE OCCUPATION BROWSER</div><h3>Browse O*NET occupation descriptions</h3><p>${occupationRows.length} occupational interest profiles loaded locally. These are 31.0 database records you selected. Next Move's exploratory ordering is not an official O*NET match.</p>
       <label class="field-label" for="onet-search">Search occupation title or description</label><input id="onet-search" data-onet-search value="${attr(ui.onetSearch)}" placeholder="Search e.g. mechanic, safety, computer">
       <div id="onet-occupation-list" class="onet-occupation-list"></div></section>`:"";
    const hasScores=Boolean(scores);
    return `${head("EXPLORE / PUBLISHED O*NET ASSESSMENT", "O*NET Mini Interest Profiler", "Thirty real work-activity questions. Your interest profile is calculated right here, privately, without an account or server.")}
       <div class="info-banner"><strong>How to answer</strong><p>Rate whether each activity sounds enjoyable, regardless of your training, pay, or experience. This uses the unchanged <strong>published 2016 Mini-IP question set</strong>. The current O*NET online assessment may use updated questions. Scores use its published 0–20 per-category method, not Next Move's informal interest compass.</p></div>
       <section class="setting-card onet-assessment"><div class="row-between"><div><div class="eyebrow">MY RESPONSES</div><h3>${count}/30 activities rated</h3></div><span class="tag ${count===30?"tag-green":""}">${count===30?"Complete":"Page "+(ui.onetPage+1)+" of 5"}</span></div>
       <div class="onet-progress"><div style="width:${count/30*100}%"></div></div>
       <div class="onet-question-grid">${six.map(q=>`<article class="onet-item"><div class="q-number">${String(q.id).padStart(2,"0")}</div><div class="onet-item-body"><h3 id="onet-question-${q.id}">${esc(q.text)}</h3><div class="onet-options" role="group" aria-labelledby="onet-question-${q.id}">${[1,2,3,4,5].map((n)=>`<button class="onet-option" type="button" data-onet-answer="${q.id}" data-value="${n}" aria-label="${labels[n-1]}" aria-pressed="${state.onetAnswers[q.id]===n}"><span>${n}</span><small>${labels[n-1]}</small></button>`).join("")}</div></div></article>`).join("")}</div>
       <div class="button-row"><button class="btn" data-action="onet-prev" ${ui.onetPage===0?"disabled":""}>Previous six</button><button class="btn btn-primary" data-action="onet-next" ${ui.onetPage===4?"disabled":""}>Next six →</button><button class="btn btn-ghost" data-action="onet-clear">Clear these 30 responses</button></div></section>
       ${bars}
       <section class="setting-card"><div class="eyebrow">OPTIONAL / OFFICIAL OCCUPATION DATA</div><h3>Explore the wider O*NET career database</h3>
       <p>Official O*NET career descriptions and six-area occupation interest profiles can be loaded here <strong>without accounts or API keys</strong>. The database is not bundled with this personal ZIP. Open the public O*NET 31.0 JSON file links below (internet required once). If a browser displays the JSON instead of downloading it, use Save As to save each .json file. Then choose the downloaded files together. Import stays in your browser; no answers are uploaded.</p>
       <div class="button-row"><a class="btn" target="_blank" rel="noopener noreferrer" href="${ONET_SOURCE_LINKS.interests}">1. Download interest profiles ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="${ONET_SOURCE_LINKS.occupations}">2. Download occupations ↗</a><a class="btn btn-ghost" target="_blank" rel="noopener noreferrer" href="${ONET_SOURCE_LINKS.zones}">3. Job zones (optional) ↗</a></div>
       <label class="field-label" for="onet-files" style="display:block;margin-top:15px">Choose the downloaded .json files</label>
       <input id="onet-files" type="file" accept=".json,application/json" multiple>
       <p class="quiet">Source data: O*NET 31.0 Database (August 2026), CC BY 4.0. This offline list does not update automatically. Career ideas are not job openings or guaranteed matches.</p>
       ${occupationMessage?`<div class="notice"><span class="notice-icon">ⓘ</span><div>${esc(occupationMessage)}</div></div>`:""}
       </section>
       ${officialData}
       <section class="setting-card"><div class="eyebrow">SOURCES &amp; LIMITS</div><p>This page incorporates the 2016 Mini-IP question set from the O*NET Career Exploration Tools by USDOL/ETA, under the O*NET Tools Developer License. O*NET® is a trademark of USDOL/ETA. Software presentation and reports are by TNDS; USDOL/ETA has not approved, endorsed, or tested this application.</p><p>We have not modified the published items or their six-category scoring. These interest results are not mental-health measures, aptitude scores, or hiring screens.</p>
       <p><a href="https://www.onetcenter.org/dl_files/Mini-IP.pdf" target="_blank" rel="noopener noreferrer">Published Mini-IP report ↗</a> · <a href="https://www.onetcenter.org/license_toolsdev.html" target="_blank" rel="noopener noreferrer">O*NET Tools Developer License ↗</a> · <a href="https://www.onetcenter.org/license_db.html" target="_blank" rel="noopener noreferrer">O*NET database license ↗</a> · <a href="https://onetinterestprofiler.org/" target="_blank" rel="noopener noreferrer">Current official online profiler ↗</a></p></section>`;
  }

  /** Browser-only import of unmodified O*NET 31.0 JSON data. Never upload it. */
  async function importOccupationFiles(files) {
    if (!files || !files.length) return;
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20000000) throw new Error("One selected file is too large (20 MB limit).");
        const data=JSON.parse(await file.text());
        if (!data || !Array.isArray(data.row) || data.row.length>150000) throw new Error("This is not an O*NET JSON table.");
        if (data.table_id === "career_interest_types") occupationFiles.interests=data.row;
        else if (data.table_id === "occupation_data") occupationFiles.occupations=data.row;
        else if (data.table_id === "job_zones") occupationFiles.zones=data.row;
        else throw new Error(`Unrecognized O*NET data table: ${String(data.table_id).slice(0,60)}`);
      }
      const mapping=new Map();
      for (const r of (occupationFiles.interests||[])) {
        if (!r || r.scale_id!=="OI" || !/^[0-9]{2}-[0-9]{4}\.[0-9]{2}$/.test(r.onetsoc_code||"")) continue;
        const key=Object.entries(INTEREST_LABELS).find(([,name])=>name===r.element_name)?.[0];
        if (!key || !Number.isFinite(r.data_value) || r.data_value<0 || r.data_value>7) continue;
        if (!mapping.has(r.onetsoc_code)) mapping.set(r.onetsoc_code,{});
        mapping.get(r.onetsoc_code)[key]=r.data_value;
      }
      const zones=new Map((occupationFiles.zones||[]).filter(x=>x && /^[0-9]{2}-[0-9]{4}\.[0-9]{2}$/.test(x.onetsoc_code||"")).map(x=>[x.onetsoc_code,x.job_zone]));
      occupationRows=(occupationFiles.occupations||[]).filter(x=>x && mapping.has(x.onetsoc_code) && typeof x.title==="string")
        .map(x=>({ code:x.onetsoc_code, title:x.title.slice(0,150), description:String(x.description||"").slice(0,500), vector:mapping.get(x.onetsoc_code), zone:zones.get(x.onetsoc_code)||null }))
        .filter(x=>Object.keys(x.vector).length===6).slice(0,2000);
      const present=["interests","occupations","zones"].filter(k=>occupationFiles[k]).join(", ");
      occupationMessage=occupationRows.length ? `${occupationRows.length} occupation profiles loaded. Data remains in this tab only.` : `Files recognized: ${present}. Choose both the Career Interest Types and Occupation Data JSON files to browse occupations.`;
      console.info("[Next Move] O*NET occupation files parsed locally; no participant data logged.");
    } catch(err) {
      occupationMessage=err.message || "Could not load the selected O*NET data files.";
      console.warn("[Next Move] Selected occupation file failed validation; no participant data logged.");
    }
    render(false);
  }
  /** Exploration-only sort by six-profile cosine shape (not official O*NET matching). */
  function rankOccupations() {
    const scores=onetScores(), query=ui.onetSearch.trim().toLowerCase();
    const source=occupationRows.filter(x=> !query || `${x.title} ${x.description}`.toLowerCase().includes(query));
    if (!scores) return source.slice(0,20);
    const norm=(v)=>{const len=Math.sqrt(v.reduce((s,n)=>s+n*n,0))||1;return v.map(n=>n/len);};
    const person=norm("RIASEC".split("").map(k=>scores[k]));
    return source.map(x=>{
      const other=norm("RIASEC".split("").map(k=>x.vector[k]));
      const cosine=person.reduce((s,n,i)=>s+n*other[i],0);
      return {x,cosine};
    }).sort((a,b)=>b.cosine-a.cosine || a.x.title.localeCompare(b.x.title)).slice(0,20).map(r=>r.x);
  }
  function updateOccupationList() {
    const el=$("onet-occupation-list"); if(!el) return;
    const rows=rankOccupations();
    el.innerHTML=rows.length ? rows.map(x=>`<article class="onet-career"><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p><div class="button-row"><span class="tag">O*NET ${esc(x.code)}</span>${x.zone?`<span class="tag">Job Zone ${esc(x.zone)}</span>`:""}<a target="_blank" rel="noopener noreferrer" href="https://www.onetonline.org/link/summary/${attr(x.code)}">View official occupation profile ↗</a></div></article>`).join("") : "<p>No occupations match that search.</p>";
  }

  function renderCompass() {
    const top = [...D.lenses].filter(l => isNumberRating(state.lenses[l.id])).sort((a,b) => state.lenses[b.id]-state.lenses[a.id]);
    return `${head("EXPLORE / YOUR CURIOSITY", "Your interest compass", "Give each kind of activity a simple 1–5 interest rating. These original prompts are informal and separate from the research-based O*NET assessment.")}
      <div class="info-banner"><strong>This is a conversation starter, not a personality test.</strong><p>1 = not interesting right now; 3 = unsure or sometimes; 5 = very interesting. You can skip anything. Your responses only change which career examples appear first—nothing is ruled out.</p></div>
      <div class="columns-2">${D.lenses.map(l => `<section class="lens-card"><div class="lens-card-top"><div class="lens-icon" aria-hidden="true">${l.icon}</div><div><h3 id="lens-${l.id}">${esc(l.title)}</h3><p>${esc(l.desc)}</p></div></div><div class="scale-options" role="group" aria-labelledby="lens-${l.id}">${[1,2,3,4,5].map(n => `<button type="button" class="scale-btn" data-lens="${l.id}" data-value="${n}" aria-label="${n} out of 5" aria-pressed="${state.lenses[l.id] === n}">${n}</button>`).join("")}</div><div class="lens-scale"><span>Not for me</span><span>Very interesting</span></div></section>`).join("")}</div>
      ${top.length ? `<div class="notice"><span class="notice-icon">↗</span><div><strong>Currently interesting:</strong> ${top.slice(0,3).map(l=>esc(l.title)).join(" · ")}. This can change with experience.</div></div>` : ""}
      <div class="sticky-bottom"><div class="quiet" style="font-size:12px">${countLenses()} of 10 prompts explored</div><div class="button-row"><button class="btn" data-route="onet">Try the O*NET interest profile</button><button class="btn btn-primary" data-route="explore">Explore careers →</button></div></div>`;
  }

  function laneSignal(lane) {
    const vals = lane.tags.map(t => ({ id: t, value: state.lenses[t] })).filter(x => isNumberRating(x.value));
    const strong = vals.filter(x => x.value >= 4).sort((a,b)=>b.value-a.value);
    const low = vals.filter(x => x.value <= 2).sort((a,b)=>a.value-b.value);
    const avg = vals.length ? vals.reduce((sum,x) => sum+x.value,0) / vals.length : 0;
    // Only for ordering. Never expose this as a fit %, diagnosis, or suitability score.
    return { avg, strong, low, evidence: vals.length };
  }
  function rankedLanes() {
    const enough = countLenses() >= 4;
    return D.lanes.map((lane,index) => ({ lane, index, signal: laneSignal(lane) })).sort((a,b) =>
      enough ? ((b.signal.avg-a.signal.avg) || (b.signal.strong.length-a.signal.strong.length) || (a.index-b.index)) : a.index-b.index);
  }
  function laneReason(lane) {
    const signal = laneSignal(lane);
    if (countLenses() < 4) return "Browse freely. With more interest ratings, this list can be reordered transparently.";
    const names = signal.strong.slice(0,2).map(x=>lensName(x.id).toLowerCase());
    if (names.length) return `Worth exploring because you expressed interest in ${names.join(" and ")}. This is a hypothesis, not a prediction.`;
    if (signal.low.length) return `One possible stretch: you rated ${lensName(signal.low[0].id).toLowerCase()} lower. You can still explore it.`;
    return "One of many paths worth learning about. No single answer determines career fit.";
  }
  function renderLaneCard(lane) {
    const pinned = state.pins.includes(lane.id);
    const dismissed = state.dismissed.includes(lane.id);
    const expanded = ui.expanded.has(lane.id);
    return `<article class="lane-card ${pinned ? "pinned" : ""}" data-lane-card="${lane.id}">
      <div class="lane-topline"><span class="tag">${esc(lane.family)}</span>${pinned ? '<span class="tag tag-green">✓ On my shortlist</span>' : dismissed ? '<span class="tag tag-red">Not for me right now</span>' : ''}</div>
      <div><h3>${esc(lane.name)}</h3><p>${esc(lane.blurb)}</p></div>
      <div class="tag-list">${lane.tags.slice(0,4).map(t=>`<span class="tag">${esc(lensName(t))}</span>`).join("")}</div>
      <div class="lane-reason">${esc(laneReason(lane))}</div>
      <button class="details-toggle" type="button" data-expand="${lane.id}" aria-expanded="${expanded}">${expanded ? "− Less detail" : "+ Roles, watchouts & a first test"}</button>
      ${expanded ? `<div class="lane-extra"><strong>Roles to research</strong><ul>${lane.roles.map(r=>`<li>${esc(r)}</li>`).join("")}</ul><strong>One low-risk test</strong><p>${esc(lane.firstTest)}</p><strong>What could make it a poor fit</strong><p>${esc(lane.watchout)}</p><strong>How to investigate entry</strong><p>${esc(lane.learning)}</p></div>` : ""}
      <div class="button-row"><button class="btn btn-small ${pinned ? "btn-primary" : ""}" data-pin="${lane.id}">${pinned ? "✓ Shortlisted" : "+ Shortlist"}</button><button class="btn btn-small" data-make-test="${lane.id}">Plan a test</button><button class="btn btn-small btn-ghost" data-dismiss="${lane.id}">${dismissed ? "Restore" : "Not for me"}</button></div>
    </article>`;
  }

  function renderLaneList() {
    const el = $("lane-list"); if (!el) return;
    const text = ui.search.trim().toLowerCase();
    const rows = rankedLanes().filter(({lane}) => {
      if (ui.onlyPinned && !state.pins.includes(lane.id)) return false;
      if (!ui.showDismissed && state.dismissed.includes(lane.id)) return false;
      if (ui.family !== "All" && lane.family !== ui.family) return false;
      return !text || [lane.name,lane.family,lane.blurb,...lane.roles,...lane.tags.map(lensName)].join(" ").toLowerCase().includes(text);
    });
    const count = $("lane-count"); if (count) count.textContent = `${rows.length} of ${D.lanes.length} areas shown`;
    el.innerHTML = rows.length ? rows.map(x => renderLaneCard(x.lane)).join("") : `<div class="empty"><div class="empty-icon">◇</div><h3>No areas match those filters.</h3><p>Try clearing the search or changing the category. You are never locked out of any career.</p><button class="btn" data-action="clear-filters">Clear filters</button></div>`;
  }

  function renderExplore() {
    const rated = countLenses();
    const ordered = rankedLanes();
    const shortlist = state.pins.length;
    const suggest = rated >= 4 ? ordered.slice(0, 3).map(x=>x.lane.name).join(" · ") : "";
    return `${head("EXPLORE / MANY DIRECTIONS", "Career possibilities", "No algorithm knows your calling. Use these examples as places to investigate, compare, challenge, and test—not as a list of careers you're allowed to pursue.", `<button class="btn btn-ghost" data-route="compass">Edit interest compass</button>`)}
      <div class="info-banner"><strong>${rated >= 4 ? "Examples currently near the top" : "Browse first. Rate interests only if useful."}</strong><p>${rated >= 4 ? esc(suggest) + ". Sorted by your informal activity-interest ratings only. This does not measure ability, earnings, happiness, or fit." : "Answer at least four optional interest prompts to reorder examples based on the activities you selected. Everything remains available either way."}</p></div>
      ${onetScores()?`<div class="notice" style="margin-bottom:18px"><span class="notice-icon">◎</span><div><strong>From the published O*NET Mini-IP:</strong> your highest-scoring interest area(s): ${onetHighText()}. ${onetStartingPoints().length?`Possible Next Move starting points (editorial examples, not official O*NET matches): ${onetStartingPoints().slice(0,4).map(l=>esc(l.name)).join(" · ")}.`:"There is no single dominant direction; explore the full catalog without a ranked suggestion."} <button class="btn btn-small" data-route="onet">See the full profile</button></div></div>`:""}
      <div class="columns-3" style="margin-bottom:20px"><div class="card"><div class="card-number">SHORTLISTED</div><h2 style="margin:8px 0;font-size:32px">${shortlist}</h2><p>Areas you want to investigate</p></div><div class="card"><div class="card-number">INTEREST PROMPTS</div><h2 style="margin:8px 0;font-size:32px">${rated}/10</h2><p>Used for transparent ordering only</p></div><div class="card"><div class="card-number">REAL-WORLD TESTS</div><h2 style="margin:8px 0;font-size:32px">${state.experiments.length}</h2><p>Plans and experiences logged</p></div></div>
      <div class="explore-controls"><div class="search-wrap"><span class="search-icon" aria-hidden="true">⌕</span><label class="visually-hidden" for="lane-search">Search career areas</label><input id="lane-search" type="text" placeholder="Search careers, skills, roles..." value="${attr(ui.search)}" data-lane-search></div>
      <label class="visually-hidden" for="lane-filter">Career family</label><select id="lane-filter" data-lane-family>${FAMILY_TYPES.map(c=>`<option value="${attr(c)}" ${ui.family===c?"selected":""}>${esc(c)}</option>`).join("")}</select>
      <button class="btn btn-ghost" type="button" data-action="pinned-only" aria-pressed="${ui.onlyPinned}">${ui.onlyPinned?"✓ Shortlisted only":"Show shortlist"}</button>
      <button class="btn btn-ghost" type="button" data-action="show-dismissed" aria-pressed="${ui.showDismissed}">${ui.showDismissed?"Showing all":"Show set-aside"}</button></div>
      <div class="section-announce" id="lane-count" aria-live="polite">${D.lanes.length} areas shown</div><div class="lane-grid" id="lane-list" style="margin-top:13px"></div>
      <div class="notice" style="margin-top:24px"><span class="notice-icon">ⓘ</span><div>Example job titles, tests, and tradeoffs are illustrative, not a current salary survey or certification guide. Before applying or spending money, compare occupation information and local training requirements using the <a target="_blank" rel="noopener noreferrer" href="https://www.bls.gov/ooh/">BLS Occupational Outlook Handbook ↗</a> and <a target="_blank" rel="noopener noreferrer" href="https://www.mynextmove.org/">My Next Move ↗</a>.</div></div>`;
  }

  function renderResources() {
    return `${head("EXPLORE / EVIDENCE", "Trusted assessments", "Use established tools for independent interest, value, and skill exploration. They open in a separate website; their privacy policies apply there.")}
      <div class="notice"><span class="notice-icon">◎</span><div><strong>Two ways to learn:</strong> the published 2016 O*NET Mini Interest Profiler is available inside Next Move with its unchanged questions and scoring. Other independent tools still open on their official websites, where their privacy policies apply. External results are not imported or tracked.</div></div><div class="button-row" style="margin-bottom:20px"><button class="btn btn-primary" data-route="onet">Open the built-in O*NET profiler</button></div>
      <div class="resource-list">${D.resources.map((r,i) => `<article class="resource"><div class="tag">${esc(r.category)}</div><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><a href="${attr(r.url)}" target="_blank" rel="noopener noreferrer">Open official resource ↗</a><label class="field-label" for="resource-${i}" style="display:block;margin-top:14px">What stood out to me? (optional)</label><textarea class="resource-note" id="resource-${i}" data-resource="${i}" rows="2" placeholder="One observation I want to remember…">${esc(state.resourceNotes[i] || "")}</textarea></article>`).join("")}</div>
      <div class="sticky-bottom"><div class="quiet" style="font-size:12px">Your assessment activity on external sites is not imported or monitored.</div><button class="btn btn-primary" data-route="explore">Explore possibilities →</button></div>`;
  }

  function renderFieldwork() {
    const done = state.experiments.filter(x=>x.status==="completed").length;
    return `${head("TEST / GET REAL EVIDENCE", "The field test log", "Short conversations and hands-on experiences help you discover what feels right. Each test can be low-cost and small enough to fit around your current job.", `<button class="btn btn-primary" data-action="add-experiment">+ Plan a new test</button>`)}
    <div class="info-banner"><strong>30-day field guide:</strong><p>Week 1: discover · Week 2: talk to people in three different fields · Week 3: try two small activities · Week 4: reflect and choose the next step. Adjust the schedule to your own pace.</p></div>
    <div class="columns-3" style="margin-bottom:17px"><div class="card"><div class="card-number">PLANNED / TOTAL</div><h2 style="font-size:31px;margin:7px 0">${state.experiments.length}</h2><p>Experiments logged</p></div><div class="card"><div class="card-number">COMPLETED</div><h2 style="font-size:31px;margin:7px 0">${done}</h2><p>Firsthand experiences</p></div><div class="card"><div class="card-number">CAREER IDEAS</div><h2 style="font-size:31px;margin:7px 0">${state.pins.length}</h2><p>Shortlisted areas</p></div></div>
    ${state.experiments.length === 0 ? `<div class="empty"><div class="empty-icon">◎</div><h3>Start with one small experiment.</h3><p>It could be a 20-minute conversation, a job shadow, a free workshop, or a tiny project. The goal is learning, not performing perfectly.</p><button class="btn btn-primary" data-action="add-experiment">Plan my first test</button></div>` : state.experiments.map(renderExperiment).join("")}
    <div class="notice"><span class="notice-icon">ⓘ</span><div>Observe only when authorization or training is required. Do not perform hazardous, licensed, or safety-critical work as an informal career test.</div></div>`;
  }
  function renderExperiment(exp) {
    const lane = getLane(exp.lane);
    const completed = exp.status === "completed";
    return `<article class="experiment-card"><div class="experiment-head"><div><div class="tag-list"><span class="tag ${completed?'tag-green':''}">${completed?'Completed':'Planned'}</span>${exp.mode?`<span class="tag">${esc(exp.mode)}</span>`:''}${exp.date?`<span class="tag">${esc(exp.date)}</span>`:''}</div><h3 style="margin-top:11px">${esc(exp.title)}</h3><p>${lane ? esc(lane.name) : "Open exploration"}</p></div><div class="button-row"><button class="btn btn-small" data-edit-experiment="${attr(exp.id)}">Edit</button><button class="btn btn-small btn-danger" data-delete-experiment="${attr(exp.id)}">Delete</button></div></div>
    ${completed ? `<div class="experiment-scores">${[["energy","Energy"],["curiosity","Curiosity"],["repeat","Would repeat"]].map(([k,n])=>`<div class="score-cell"><strong>${exp[k]||'—'}${exp[k]?'<small>/5</small>':''}</strong><span>${n}</span></div>`).join("")}</div>` : `<div class="meta-row"><span class="tag tag-gold">After the activity, record how it felt</span></div>`}
    ${exp.notes?`<p><strong>What I noticed:</strong> <span class="preserve">${esc(exp.notes)}</span></p>`:''}
    ${exp.next?`<p><strong>Possible next step:</strong> <span class="preserve">${esc(exp.next)}</span></p>`:''}</article>`;
  }

  /** Report: describe stated preferences, never assert psychological traits. */
  function responseSummary(q) {
    const v = state.answers[q.id];
    if (q.kind === "scale") {
      return isNumberRating(v) ? `${v}/5 — ${WORK_STYLE[q.id][v <= 2 ? 0 : v === 3 ? 1 : 2]}` : "";
    }
    if (q.kind === "top3") return Array.isArray(v) ? v.join(" · ") : "";
    if (q.kind === "salary") return v ? `Now: ${v.today || "Not given"} | In 3 years: ${v.future || "Not given"}` : "";
    if (q.kind === "vision") return v ? `${v.future || ""}${v.firstTest ? `\nOne thing to try: ${v.firstTest}` : ""}` : "";
    return typeof v === "string" ? v : "";
  }

  function renderReport() {
    const count = countAnswered();
    const valuePicks = Array.isArray(state.answers[18]) ? state.answers[18] : [];
    const rated = D.lenses.filter(l => isNumberRating(state.lenses[l.id])).sort((a,b) => state.lenses[b.id]-state.lenses[a.id]);
    const topRated = rated.filter(l => state.lenses[l.id] >= 4).slice(0,5);
    const work = D.questions.workstyle.filter(answered);
    const pins = state.pins.map(getLane).filter(Boolean);
    const done = state.experiments.filter(x=>x.status==="completed");
    const checked = D.thinkingMoves.map(m => ({ name: m.label, count: D.questions.thinking.filter(q=>(state.thinking[q.id]||[]).includes(m.id)).length }));
    const activeChecks = checked.filter(c=>c.count>0);
    const roleList = pins.length ? pins.map(l=>`<li><strong>${esc(l.name)}</strong> — ${esc(l.firstTest)}</li>`).join("") : "<li>No areas shortlisted yet. Browse broadly; this is not a deadline.</li>";
    const actionItems = [];
    if (count < 8) actionItems.push("Answer a few questions about the work you've enjoyed and disliked. Skipping is fine.");
    if (countLenses() < 4) actionItems.push("Explore the optional activity-interest compass to help organize career examples.");
    if (pins.length === 0) actionItems.push("Shortlist two or three career areas, including one outside your comfort zone.");
    if (state.experiments.length === 0) actionItems.push("Plan one low-cost conversation, job shadow, or mini-project.");
    else if (done.length === 0) actionItems.push("Complete a planned test and record how it actually felt.");
    else actionItems.push("Compare your completed experiments. Choose one next test based on curiosity and real conditions.");
    if (actionItems.length < 3) actionItems.push("Check training, schedules, and real-world opportunities using official occupation resources.");
    const allAnswers = ui.showFullAnswers ? `<section class="report-section"><h3>My answers (private full view)</h3><p>Only include this section when you intentionally choose it. It may contain personal reflections and income targets.</p>${ALL_QUESTIONS.map(q => {
      const text = responseSummary(q);
      const moves = q.kind === 'scenario' && (state.thinking[q.id]||[]).length ? `<p><em>Thinking moves I marked:</em> ${(state.thinking[q.id]||[]).map(id=>esc((D.thinkingMoves.find(m=>m.id===id)||{}).label||id)).join(" · ")}</p>` : '';
      return text || moves ? `<div class="report-answer"><strong>Q${q.id}. ${esc(q.text)}</strong><p>${esc(text)}</p>${moves}</div>` : '';
    }).join("")}${D.reflections.map(r=>isText(state.reflections[r.id])?`<div class="report-answer"><strong>${esc(r.text)}</strong><p>${esc(state.reflections[r.id])}</p></div>`:"").join("")}</section>` : "";
    return `${head("MY FIELD GUIDE / ALWAYS REVISABLE", "What I'm learning", "This is a snapshot of what you said and tried—not a grade, diagnosis, or promise about a career.")}
      <div class="button-row no-print" style="margin-bottom:18px"><button class="btn btn-primary" data-action="print-report">Print / save PDF</button><button class="btn" data-route="share">Finish & email my results</button><button class="btn" data-action="copy-summary">Copy short summary</button><button class="btn btn-ghost" data-action="toggle-full" aria-pressed="${ui.showFullAnswers}">${ui.showFullAnswers?"✓ Full private answers included":"Include all my answers"}</button></div>
      <div class="report-shell">
      <div class="report-heading"><div class="eyebrow">NEXT MOVE · PERSONAL FIELD GUIDE</div><h2>My next step is a discovery, not a verdict.</h2><p style="margin:5px 0">${count} of 30 questions explored · ${countLenses()} of 10 interest prompts · ${done.length} completed field tests</p>${state.demo?'<span class="tag tag-gold">DEMONSTRATION DATA · NOT REAL ANSWERS</span>':''}</div>
      <section class="report-section"><h3>1. What currently matters most</h3>${valuePicks.length?`<div class="tag-list">${valuePicks.map(x=>`<span class="tag tag-green">${esc(x)}</span>`).join("")}</div>`:'<p>No top values selected yet. Try the “What matters” section.</p>'}<h4>What I want to avoid repeating</h4><p class="preserve">${esc(getAnswer(2)||getAnswer(21)||"Still exploring my deal-breakers and frustrations.")}</p></section>
      <section class="report-section"><h3>2. How I like to work</h3>${work.length?`<ul>${work.map(q=>`<li>${esc(WORK_STYLE[q.id][state.answers[q.id]<=2?0:state.answers[q.id]===3?1:2])} (self-rating ${state.answers[q.id]}/5)</li>`).join("")}</ul>`:'<p>No work-style preferences recorded yet.</p>'}<p class="quiet">These are present-day preferences, not permanent traits or aptitude measurements.</p></section>
      <section class="report-section"><h3>O*NET Mini Interest Profiler (published 2016 form)</h3>${onetScores()?`<p>My highest-scoring interest area(s): ${esc(onetHighText())}. Scores describe interest, not ability or job suitability.</p><div class="bar-list">${onetTop().map(k=>`<div class="bar-item"><span>${INTEREST_LABELS[k]}</span><div class="bar-track"><div class="bar-fill" style="width:${onetScores()[k]*5}%"></div></div><strong>${onetScores()[k]}/20</strong></div>`).join("")}</div>`:`<p>${onetCompleted()} of 30 activity ratings recorded. All 30 are needed for a six-area profile. This is optional.</p>`}<p class="quiet">Items and six-score method from the 2016 O*NET Mini Interest Profiler. The current official online form may differ. TNDS is not endorsed by USDOL/ETA.</p></section>
      <section class="report-section"><h3>3. Activities that draw my curiosity</h3>${rated.length?`<div class="bar-list">${rated.map(l=>`<div class="bar-item"><span>${esc(l.title)}</span><div class="bar-track" role="img" aria-label="${esc(l.title)}: ${state.lenses[l.id]} out of 5"><div class="bar-fill" style="width:${state.lenses[l.id]*20}%"></div></div><strong>${state.lenses[l.id]}/5</strong></div>`).join("")}</div>`:'<p>No activity interests rated yet.</p>'}${topRated.length?`<p>Highest current interests: ${topRated.map(l=>esc(l.title.toLowerCase())).join(" · ")}. These prompts are informal and not O*NET assessment results.</p>`:""}</section>
      <section class="report-section"><h3>4. How I approached problems</h3>${activeChecks.length?`<ul>${activeChecks.map(x=>`<li>${esc(x.name)} — marked in ${x.count} of 6 scenarios</li>`).join("")}</ul>`:'<p>No optional thinking-move reflections recorded yet. Use the Thinking Lab to describe your decisions in your own words.</p>'}<p class="quiet">Self-checked behaviors are not proof of performance or an intelligence score. Try similar problems in the real world to learn more.</p></section>
      <section class="report-section"><h3>5. Career areas I chose to explore</h3><ul>${roleList}</ul><p class="quiet">These are your choices. The app does not choose a career for you.</p></section>
      <section class="report-section"><h3>6. What actual tests have shown</h3>${done.length ? done.map(e=>`<div class="report-answer"><strong>${esc(e.title)}</strong><p>${['energy','curiosity','repeat'].map(k=>`${k}: ${e[k] || 'not rated'}/5`).join(' · ')}</p>${e.notes?`<p class="preserve">${esc(e.notes)}</p>`:''}${e.next?`<p><em>Next:</em> ${esc(e.next)}</p>`:''}</div>`).join("") : '<p>No completed real-world tests yet. Your first experiment can be small and free.</p>'}</section>
      <section class="report-section"><h3>7. My possible next actions</h3><ul>${actionItems.slice(0,4).map(t=>`<li>${esc(t)}</li>`).join("")}</ul>${getObjAnswer(30).firstTest?`<p><strong>A step I named:</strong> ${esc(getObjAnswer(30).firstTest)}</p>`:''}<p class="quiet">This is an editable exploration plan, not an imposed deadline.</p></section>
      ${ui.showFullAnswers && onetCompleted()?`<section class="report-section"><h3>O*NET Mini-IP activity responses (private full view)</h3><p>Only share this section if you want to. 1 = Strongly Dislike, 5 = Strongly Like.</p>${D.onetMini.items.filter(q=>isNumberRating(state.onetAnswers[q.id])).map(q=>`<div class="report-answer"><strong>${q.id}. ${esc(q.text)}</strong><p>Rating: ${state.onetAnswers[q.id]}/5</p></div>`).join("")}</section>`:""}
      ${allAnswers}
      <section class="report-section"><h3>Evidence & boundaries</h3><p>This document is a self-reflection aid. Original interest prompts, optional thinking checks, and career example ordering are not validated psychological tests. The built-in 30-item O*NET Mini-IP uses its published 2016 items and scoring; see <a href="https://www.onetcenter.org/dl_files/Mini-IP.pdf" target="_blank" rel="noopener noreferrer">the source report</a> and <a href="https://www.onetcenter.org/license_toolsdev.html" target="_blank" rel="noopener noreferrer">Developer License</a>. The current online assessment may differ. Check occupational conditions, pay, and training via the <a href="https://www.bls.gov/ooh/" target="_blank" rel="noopener noreferrer">BLS Occupational Outlook Handbook</a>. The results should never be used to make hiring or mental-health decisions.</p><p class="quiet" style="margin-bottom:0">Created in Next Move v${VERSION} · Private by design · Share only if you choose</p></section>
      </div>
      <div class="button-row no-print" style="margin-top:22px"><button class="btn btn-primary" data-route="fieldwork">Plan another test →</button><button class="btn" data-route="settings">Save or back up my work</button><button class="btn btn-primary" data-route="share">Finish & share →</button></div>`;
  }

  /** A compact summary that deliberately excludes salary, reflections, and long written answers. */
  function shortSummary() {
    const values = Array.isArray(state.answers[18]) ? state.answers[18] : [];
    const top = D.lenses.filter(l=>isNumberRating(state.lenses[l.id]) && state.lenses[l.id]>=4)
      .sort((a,b)=>state.lenses[b.id]-state.lenses[a.id]).slice(0,5);
    const pins = state.pins.map(getLane).filter(Boolean).map(x=>x.name);
    const finished = state.experiments.filter(x=>x.status==="completed");
    const work = D.questions.workstyle.filter(answered).map(q=>`${WORK_STYLE[q.id][state.answers[q.id]<=2?0:state.answers[q.id]===3?1:2]} (Q${q.id})`);
    return ["NEXT MOVE — OPTIONAL SHAREABLE SUMMARY", "Personal exploration, not a psychological or vocational diagnosis", "",
      `From: ${state.displayName.trim() || "Participant"}`,
      `Questionnaire: ${countAnswered()} of ${ALL_QUESTIONS.length} questions explored`,
      `O*NET Mini-IP (published 2016): ${onetScores() ? onetHighText()+" | "+onetTop().map(k=>k+"="+onetScores()[k]+"/20").join(", ") : onetCompleted()+"/30 items rated; no profile yet"}`,
      `Work values: ${values.join(", ") || "Still exploring"}`,
      `Preferred work styles: ${work.join("; ") || "Still exploring"}`,
      `Activities I am curious about: ${top.map(x=>x.title).join(", ") || "Still exploring"}`,
      `Career areas I chose to look into: ${pins.join(", ") || "Still exploring"}`,
      `Real-world experiences completed: ${finished.length}`,
      "", "These are my observations. I'd like your help thinking through options, not having a career chosen for me."].join("\n");
  }

  /** Complete plaintext report exported only on user request. This is not an encrypted backup. */
  function fullShareText() {
    const text = [shortSummary(), "", "=== FULL OPTIONAL QUESTIONNAIRE RESPONSES ==="];
    for (const q of ALL_QUESTIONS) {
      text.push(`Q${q.id}. ${q.text}`, responseSummary(q) || "[Skipped / no response]");
      if (q.kind === "scenario") {
        const moves = (state.thinking[q.id] || [])
          .map(id=>(D.thinkingMoves.find(m=>m.id===id)||{}).label).filter(Boolean);
        if (moves.length) text.push(`Thinking moves I noted: ${moves.join("; ")}`);
      }
      text.push("");
    }
    text.push("=== PRIVATE REFLECTIONS (SHARED ONLY BY MY CHOICE) ===");
    for (const r of D.reflections) text.push(r.text, state.reflections[r.id] || "[Skipped]", "");
    text.push("=== INTEREST COMPASS ===");
    for (const l of D.lenses) text.push(`${l.title}: ${state.lenses[l.id] || "not rated"}/5`);
    text.push("", "=== O*NET MINI-IP (PUBLISHED 2016 QUESTION SET) ===");
    text.push(`Items rated: ${onetCompleted()}/30`);
    if (onetScores()) text.push(...onetTop().map(k=>`${INTEREST_LABELS[k]}: ${onetScores()[k]}/20`));
    for (const q of D.onetMini.items) text.push(`${q.id}. ${q.text}`, `Rating 1-5: ${state.onetAnswers[q.id] || "[not answered]"}`);
    text.push("", "=== MY SHORTLIST ===");
    text.push(...(state.pins.map(getLane).filter(Boolean).map(x=>x.name)));
    if(!state.pins.length) text.push("[Nothing shortlisted yet]");
    text.push("", "=== REAL-WORLD EXPERIMENTS ===");
    if(!state.experiments.length) text.push("[No experiments yet]");
    for (const e of state.experiments) {
      text.push(`Title: ${e.title}`, `Status: ${e.status} | Date: ${e.date || "not set"} | Type: ${e.mode}`,
        `Energy: ${e.energy || "not rated"}/5 | Curiosity: ${e.curiosity || "not rated"}/5 | Would repeat: ${e.repeat || "not rated"}/5`,
        `Notes: ${e.notes || "[None]"}`, `Next step: ${e.next || "[None]"}`, "");
    }
    text.push("=== NOTES FROM INDEPENDENT ASSESSMENTS ===");
    D.resources.forEach((r,i)=> { if(isText(state.resourceNotes[i])) text.push(`${r.title}: ${state.resourceNotes[i]}`, ""); });
    text.push("=== IMPORTANT ===", "This report contains personal answers and is not an aptitude, intelligence, or hiring assessment.");
    return text.join("\n");
  }

  function secureEmailAvailable() {
    return EMAIL_CONFIG.emailApiEnabled === true && location.protocol === "https:";
  }

  /** Consent is deliberately not saved, and must be reconfirmed after each share. */
  function canShare() {
    return (countAnswered() > 0 || onetCompleted()>0) && !state.demo && ui.shareReady && ui.shareConsent && !ui.sending;
  }

  function renderShare() {
    const count=countAnswered();
    const hosted=secureEmailAvailable();
    const full=ui.shareScope==="full";
    const preview=full?fullShareText():shortSummary();
    const missing=ALL_QUESTIONS.length-count;
    const sendText=hosted?"Send my results securely to a trusted person":"Prepare email to a trusted person";
    return `${head("FINISH / YOUR CHOICE", "Finish & share", "This is your decision. Review what's included before you share your results with a trusted person. You can skip this step entirely.")}
      ${state.demo?'<div class="notice note-warning"><span class="notice-icon">⚠</span><div>Sharing is disabled while fictional demo data is loaded. Reset the demo before answering for yourself.</div></div>':''}
      <div class="columns-3" style="margin-bottom:18px">
        <div class="card"><div class="card-number">QUESTIONNAIRE</div><h2>${count}/30</h2><p>${missing?`${missing} blank. You can skip questions.`:"All 30 answered."}</p></div>
        <div class="card"><div class="card-number">O*NET MINI-IP</div><h2>${onetCompleted()}/30</h2><p>Published interest assessment, optional.</p></div>
        <div class="card"><div class="card-number">YOUR EXPERIMENTS</div><h2>${state.experiments.filter(e=>e.status==="completed").length}</h2><p>Completed firsthand tests, if any.</p></div>
      </div>
      <section class="setting-card"><div class="eyebrow">STEP 1 / PERSONALIZE</div><h3>Your first name (optional)</h3>
        <p>This name appears in the report and email subject. It is not used to identify you or contact anyone automatically.</p>
        <label class="field-label" for="share-name">Name shown on my report</label>
        <input id="share-name" type="text" data-person-name maxlength="60" autocomplete="off" value="${attr(state.displayName)}" placeholder="Your name">
      </section>
      <section class="setting-card"><div class="eyebrow">STEP 2 / CHOOSE WHAT TO SHARE</div><h3>What your recipient can see</h3>
        <div class="share-choice-grid" role="radiogroup" aria-label="What to share">
          <label class="share-choice"><input type="radio" name="share-scope" data-share-scope value="summary" ${!full?"checked":""}><span><strong>Short summary</strong><small>Work values, preferences, broad interests, and O*NET top interest areas if completed. No salary or private written answers.</small></span></label>
          <label class="share-choice"><input type="radio" name="share-scope" data-share-scope value="full" ${full?"checked":""}><span><strong>Full report</strong><small>Includes all 30 personal questions, 30 O*NET activity ratings if provided, personal reflections, income targets, and experience notes.</small></span></label>
        </div>
        <div class="share-preview-head"><strong>Preview of ${full?"full":"summary"} report</strong><span class="quiet">${preview.length.toLocaleString()} characters</span></div>
        <pre class="share-preview">${esc(preview)}</pre>
        <div class="button-row"><button class="btn" data-action="download-share">Download ${full?"full report":"summary"} as text</button><button class="btn btn-ghost" data-action="print-share">Review printable field guide</button></div>
      </section>
      <section class="setting-card"><div class="eyebrow">STEP 3 / CONFIRM</div><h3>Send only if you want to</h3>
        <label class="checkbox-row"><input type="checkbox" data-share-ready ${ui.shareReady?"checked":""}><span><strong>I'm finished for now.</strong> I reviewed the questions I wanted to answer. Blank questions are okay, and I can return later.</span></label>
        <label class="checkbox-row" style="margin-top:9px"><input type="checkbox" data-share-consent ${ui.shareConsent?"checked":""}><span><strong>I choose to share my ${full?"full personal report":"summary"} with a trusted person.</strong> I understand email is not end-to-end encrypted and may be stored by my email provider and theirs.</span></label>
        ${hosted?`<div class="field" style="margin-top:15px"><label for="share-code">Private sharing code from a trusted person</label><input type="password" id="share-code" data-share-code autocomplete="off" placeholder="Required for secure sending" value="${attr(ui.shareCode)}"><small>The code stays only in this open tab and is never saved or shown in the report. Do not send it in an email.</small></div>
          <p class="quiet">The hosted send service transmits only the report you approved to the configured email provider, addressed to <strong>${REPORT_TO}</strong>. The email service will retain a copy under its policies.</p>`
          : `<div class="notice" style="margin-top:13px"><span class="notice-icon">ⓘ</span><div><strong>Offline email mode:</strong> the button prepares a message addressed to <strong>${REPORT_TO}</strong>, but it cannot send by itself. Open the email draft and press <strong>Send</strong>. For a full report, a text file will download first; you must attach it to the draft.</div></div>`}
        <div class="button-row" style="margin-top:18px"><button class="btn btn-primary" type="button" data-action="share-email" ${!canShare()?"disabled":""}>${ui.sending?"Sending…":sendText}</button><button class="btn btn-ghost" data-route="report">Back to my field guide</button></div>
        ${ui.shareStatus?`<div class="notice share-status" role="status" style="margin-top:14px"><span class="notice-icon">ⓘ</span><div>${esc(ui.shareStatus)}</div></div>`:""}
        ${ui.emailDraftPrepared?`<div class="notice" role="status" style="margin-top:12px"><span class="notice-icon">✉</span><div>The email draft was requested. <strong>Check your email app and press Send.</strong>${full?" Attach the downloaded .txt report first.":""} If nothing opened, use the text download and email it to a trusted person manually.</div></div>`:""}
      </section>
      <div class="notice"><span class="notice-icon">⚿</span><div><strong>No hidden sharing.</strong> Exploring, saving, printing, and viewing this report do not email anyone. Sharing is never required to finish Next Move.</div></div>`;
  }

  function downloadShareText() {
    const slug=(state.displayName.trim()||"participant").toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").slice(0,30);
    const name=`next-move-${slug}-${ui.shareScope}-${isoDate()}.txt`;
    downloadText(name, ui.shareScope==="full"?fullShareText():shortSummary(), "text/plain;charset=utf-8");
    toast("Personal report downloaded. Only share it if you choose.");
  }

  /** Standalone mode: can ONLY open a draft. A mailto link cannot press Send or attach files. */
  function prepareEmailDraft() {
    if(!canShare()) return;
    const full=ui.shareScope==="full";
    if (full) downloadShareText();
    const subject=`Next Move — ${(state.displayName.trim()||"Participant").slice(0,60)}'s career discovery`;
    const body=full
      ? `${shortSummary()}\n\nI chose to share my detailed responses. The full .txt report was downloaded from Next Move. I will attach that file before I send this email.\n\nPlease let me make my own decision about my next steps.`
      : `${shortSummary()}\n\nI'd welcome a conversation about the options I want to explore.`;
    const mailto=`mailto:${REPORT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    ui.emailDraftPrepared=true; ui.shareConsent=false;
    render(false);
    // Email-handler availability varies by operating system/browser; never claim delivery.
    try {
      // A temporary external-protocol link avoids navigating away from the local workbook.
      const a=document.createElement("a"); a.href=mailto; a.target="_blank"; a.rel="noopener noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
    } catch(error) { toast("No email app opened. Download the report and send it manually."); }
    console.info("[Next Move] User requested email draft; no private content logged or transmitted by the app.");
  }

  /** Optional hosted mode: post only after explicit consent and a private code. */
  async function sendSecureEmail() {
    if(!canShare() || !secureEmailAvailable()) return;
    const code=ui.shareCode;
    if(code.length<24) { ui.shareStatus="Enter the private sharing code supplied by someone you trust (24 or more characters)."; render(false); return; }
    const report=ui.shareScope==="full"?fullShareText():shortSummary();
    if(new TextEncoder().encode(report).length>32000) {
      ui.shareStatus="This full report is too long for secure email. Download the text report and use your email app instead.";
      render(false); return;
    }
    ui.sending=true; ui.shareStatus=""; render(false);
    try {
      const response=await fetch("/api/send-results",{
        method:"POST",credentials:"omit",cache:"no-store",
        headers:{"Content-Type":"application/json","X-Next-Move-Code":code},
        body:JSON.stringify({participant:state.displayName.trim()||"Participant",scope:ui.shareScope,report})
      });
      let reply={}; try { reply=await response.json(); } catch(ignored) { /* No data exposed. */ }
      if(!response.ok || !reply.ok) throw new Error(response.status===429?"Too many send attempts. Check the hosted email service with your trusted person.":"Email service could not accept this request. No delivery is confirmed.");
      ui.shareStatus="The email provider accepted the message. This does not confirm inbox delivery. You can ask the recipient to confirm receipt.";
      ui.shareConsent=false; ui.shareReady=false; ui.shareCode="";
      console.info("[Next Move] Consent-based email request accepted by configured provider; no report logged.");
    } catch(error) {
      ui.shareStatus=error.message||"The email service is unavailable. You can download a report and send it through your own email app.";
      console.warn("[Next Move] Consent-based email request did not complete; no report content logged.");
    } finally { ui.sending=false; render(false); }
  }

  function renderSettings() {
    return `${head("CONTROL / YOUR INFORMATION", "Privacy & backups", "You decide where your answers go. This application has no account, analytics, AI submission, or automatic sharing. An optional hosted email service is only used if you explicitly choose Send.")}
    <div class="notice"><span class="notice-icon">⚿</span><div><strong>Your answers belong to you.</strong> They remain in this browser tab unless you explicitly save them on this device or export a file. External assessment links open other websites with their own policies.</div></div>
    <section class="setting-card"><div class="eyebrow">ON THIS DEVICE</div><h3>Remember my progress</h3><p>When enabled, this browser stores an unencrypted copy using localStorage. Anyone with access to this browser profile or device may be able to read it. Best for a private, trusted device.</p>
      <label class="checkbox-row" style="margin:15px 0"><input type="checkbox" data-save-setting ${state.saveOnDevice?'checked':''}><span><strong>${state.saveOnDevice?'Saving is enabled':'Saving is disabled'}</strong> — ${state.saveOnDevice?'Your changes are saved locally as you type.':'Your answers will disappear if you close or refresh this tab unless you export them.'}</span></label>
      <p class="quiet">Disabling saving immediately deletes this app's saved copy from localStorage; it does not delete files you exported earlier.</p></section>
    <section class="setting-card"><div class="eyebrow">MOVE OR BACK UP YOUR WORK</div><h3>Your own backup files</h3><div class="setting-grid">
      <div class="setting-action"><h3>Protected backup</h3><p>Encrypt a backup with AES-GCM using a password you choose. To restore, you'll need that password.</p><button class="btn btn-primary" data-action="export-protected">Download encrypted backup</button></div>
      <div class="setting-action"><h3>Plain JSON backup</h3><p>Useful for transferring or inspecting data, but the entire questionnaire is readable. Store it carefully.</p><button class="btn" data-action="export-plain">Download plain JSON</button></div>
      <div class="setting-action"><h3>Restore a backup</h3><p>Import a protected or plain JSON file. This replaces the current answers after confirmation.</p><button class="btn" data-action="import-file">Choose backup file...</button><input class="visually-hidden" id="backup-file" type="file" accept=".json,.nmove,application/json"></div>
      <div class="setting-action"><h3>Email to a trusted person</h3><p>Choose a safe summary or a full personal report. Nothing is shared unless you review and agree to send it.</p><button class="btn" data-route="share">Finish & share</button></div>
      <div class="setting-action"><h3>Print or save a report</h3><p>View the report first. Detailed question-by-question answers are hidden by default. Review the summary before sharing. Browser printing can save a PDF.</p><button class="btn" data-route="report">Open my report</button></div>
    </div></section>
    <section class="setting-card"><div class="eyebrow">CLEAR OR TEST</div><h3>Start over when you choose</h3><div class="button-row"><button class="btn btn-danger" data-action="reset">Delete all answers in this app</button><button class="btn btn-ghost" data-action="load-demo">Load synthetic demo answers</button></div><p style="margin:13px 0 0">Reset clears this app's local memory and device save. It cannot delete exported files. Demo data is fictional and clearly marked.</p></section>
    <section class="setting-card"><div class="eyebrow">WHAT THIS IS / IS NOT</div><h3>Appropriate use</h3><p>The original self-reflection questions and the informal interest compass are not validated psychological instruments. The separate 2016 O*NET Mini Interest Profiler inside the app is a published vocational-interest assessment. None of these tools is a medical, mental-health, aptitude, intelligence, or job-suitability assessment. It cannot prove job suitability, predict happiness, or determine a person's career. Do not use it to screen job applicants.</p><p>The offline edition never sends answers to a remote service. Hosted email mode transmits the selected report only after consent. Outbound links require an explicit click. Browser storage is not encrypted; protected export files are encrypted in your browser when supported. You can inspect the included code.</p></section>`;
  }

  /** Full view update; section navigation intentionally moves focus to main. */
  function render(moveFocus = false) {
    if (!NAV.some(x=>x.id===route)) route = "home";
    renderNavigation();
    const main = $("main");
    const view = route === "home" ? renderHome()
      : route === "guide" ? renderGuide()
      : SECTION_TEXT[route] ? renderDiscovery(route)
      : route === "onet" ? renderOnet()
      : route === "compass" ? renderCompass()
      : route === "explore" ? renderExplore()
      : route === "resources" ? renderResources()
      : route === "fieldwork" ? renderFieldwork()
      : route === "report" ? renderReport()
      : route === "share" ? renderShare()
      : renderSettings();
    main.innerHTML = (state.demo ? '<div class="notice note-warning no-print"><span class="notice-icon">⚠</span><div><strong>DEMO DATA:</strong> These are fictional answers for testing. Use Privacy & backups → Delete all answers to begin for real.</div></div>' : '') + view;
    $("save-status").textContent = state.saveOnDevice ? "Saved on this device" : "In memory only";
    if (route === "explore") renderLaneList();
    if (route === "onet") updateOccupationList();
    document.title = `Next Move — ${NAV.find(x=>x.id===route).label}`;
    if (moveFocus) { window.scrollTo(0,0); main.focus({ preventScroll: true }); }
  }

  /** Experiment modal: user controls every field; no scheduling or notifications. */
  function openExperiment(id, laneId) {
    const old = state.experiments.find(x=>x.id===id);
    ui.editExperiment = old ? { ...old } : {
      id: safeId(), title: "", lane: laneId || "", mode: "Interview",
      date: "", status: "planned", energy: null, curiosity: null, repeat: null,
      notes: "", next: ""
    };
    if (!old && laneId) {
      const lane = getLane(laneId);
      ui.editExperiment.title = lane ? `Explore ${lane.name}` : "";
      ui.editExperiment.notes = lane ? `Possible test: ${lane.firstTest}` : "";
    }
    ui.modalOpen = true;
    renderExperimentModal();
  }
  function closeModal() {
    ui.modalOpen = false; ui.editExperiment = null;
    $("modal-root").innerHTML = "";
    const focusTo = $("main"); if (focusTo) focusTo.focus({ preventScroll:true });
  }
  function renderExperimentModal() {
    const v = ui.editExperiment;
    if (!ui.modalOpen || !v) return;
    const edited = state.experiments.some(x=>x.id===v.id);
    $("modal-root").innerHTML = `<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="exp-dialog-title" class="modal">
      <div class="experiment-head"><h2 id="exp-dialog-title">${edited?"Edit your experiment":"Plan a small experiment"}</h2><button type="button" class="btn btn-small btn-ghost" data-action="close-modal" aria-label="Close experiment editor">✕ Close</button></div>
      <p>Keep it simple. You can plan a test now and record your reaction later. Optional ratings are only for completed experiences.</p>
      <form id="experiment-form" class="experiment-form" novalidate>
      <div class="field field-wide"><label for="exp-title">What will you try? *</label><input id="exp-title" name="title" type="text" maxlength="160" required placeholder="e.g. Interview a facilities technician" value="${attr(v.title)}"></div>
      <div class="field"><label for="exp-lane">Career area (optional)</label><select id="exp-lane" name="lane"><option value="">Independent curiosity</option>${D.lanes.map(l=>`<option value="${attr(l.id)}" ${v.lane===l.id?'selected':''}>${esc(l.name)}</option>`).join("")}</select></div>
      <div class="field"><label for="exp-mode">Type of test</label><select id="exp-mode" name="mode">${["Interview","Job shadow","Mini project","Volunteer","Workshop","Other"].map(s=>`<option ${v.mode===s?'selected':''}>${s}</option>`).join("")}</select></div>
      <div class="field"><label for="exp-date">Date (optional)</label><input id="exp-date" name="date" type="date" value="${attr(v.date)}"></div>
      <div class="field"><label for="exp-status">Status</label><select id="exp-status" name="status"><option value="planned" ${v.status==='planned'?'selected':''}>Planned</option><option value="completed" ${v.status==='completed'?'selected':''}>Completed</option></select></div>
      <div class="field field-wide"><label for="exp-notes">What did you notice?</label><textarea id="exp-notes" name="notes" rows="3" placeholder="What felt interesting, frustrating, easy, or hard?">${esc(v.notes)}</textarea></div>
      <div class="field field-wide"><label for="exp-next">Possible next step</label><textarea id="exp-next" name="next" rows="2" placeholder="A second experiment, training research, or simply not pursuing this further…">${esc(v.next)}</textarea></div>
      ${[["energy","How energized did I feel?"],["curiosity","How curious was I afterward?"],["repeat","Would I want to do this again?"]].map(([k,label])=>`<div class="field field-wide"><label>${label} (optional)</label><div class="star-scale" role="group" aria-label="${label}">${[1,2,3,4,5].map(n=>`<button class="scale-btn" type="button" data-exp-rating="${k}" data-value="${n}" aria-label="${n} out of 5" aria-pressed="${v[k]===n}">${n}</button>`).join("")}</div></div>`).join("")}
      <div class="form-action"><button type="submit" class="btn btn-primary">${edited?"Save changes":"Save experiment"}</button><button class="btn btn-ghost" type="button" data-action="close-modal">Cancel</button></div>
      </form></section></div>`;
    $("exp-title").focus();
  }

  function saveExperiment(form) {
    const fields = new FormData(form); const v = ui.editExperiment;
    const title = String(fields.get("title")||"").trim();
    if (!title) { toast("Give your experiment a short name first."); $("exp-title").focus(); return; }
    const newExp = { ...v, title: title.slice(0,160), lane: String(fields.get("lane")||""),
      mode: String(fields.get("mode")||"Other"), date: String(fields.get("date")||""),
      status: String(fields.get("status")||"planned"), notes: String(fields.get("notes")||"").slice(0,8000), next: String(fields.get("next")||"").slice(0,8000) };
    const existing = state.experiments.findIndex(x=>x.id===newExp.id);
    if (existing>=0) state.experiments.splice(existing,1,newExp); else state.experiments.unshift(newExp);
    persist(); closeModal(); render(false); toast("Experiment saved in your current session.");
    console.info("[Next Move] Experiment record saved; details not logged.");
  }

  /** Make an export without keeping a second history copy in the application. */
  function exportPayload() { return { ...state, saveOnDevice: false, exportedAt: new Date().toISOString(), appVersion: VERSION }; }
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.info("[Next Move] User-initiated local download created; file contents not logged.");
  }
  function u8ToB64(bytes) { let s=""; const step=8192; for(let i=0;i<bytes.length;i+=step) s+=String.fromCharCode(...bytes.slice(i,i+step)); return btoa(s); }
  function b64ToU8(str) { const s=atob(str); return Uint8Array.from(s, x=>x.charCodeAt(0)); }
  async function deriveKey(passphrase, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
  }
  async function exportProtected() {
    if (!crypto || !crypto.subtle) { toast("Encrypted backup is unavailable here. Use a modern secure browser or plain backup."); return; }
    const pass = window.prompt("Choose a private backup passphrase (12+ characters). You need it to restore the file. It cannot be recovered by this app.");
    if (pass === null) return;
    if (pass.length < 12) { toast("Use at least 12 characters for a protected backup."); return; }
    const confirmPass = window.prompt("Enter that passphrase again to confirm it:");
    if (confirmPass !== pass) { toast("Passphrases did not match. No file was made."); return; }
    try {
      const salt=crypto.getRandomValues(new Uint8Array(16));
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const key=await deriveKey(pass,salt);
      const encoded = new TextEncoder().encode(JSON.stringify(exportPayload()));
      const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, encoded));
      const output = { format: "next-move-encrypted", version:1, kdf:"PBKDF2-SHA256", iterations:250000, cipher:"AES-256-GCM", salt:u8ToB64(salt), iv:u8ToB64(iv), ciphertext:u8ToB64(cipher) };
      downloadText(`next-move-protected-${isoDate()}.nmove`, JSON.stringify(output,null,2), "application/json");
      toast("Protected backup downloaded. Keep the passphrase somewhere safe.");
    } catch(error) { toast("Encryption failed. Try a modern browser or a plain backup."); console.warn("[Next Move] Protected export failed without logging content."); }
  }

  async function importBackupFile(file) {
    if (!file || file.size > 2000000) { toast("Select a Next Move backup under 2 MB."); return; }
    try {
      const raw = await file.text();
      let parsed = JSON.parse(raw);
      if (parsed.format === "next-move-encrypted") {
        if (!crypto || !crypto.subtle) throw new Error("This browser cannot decrypt protected backups.");
        if (parsed.version !== 1 || parsed.iterations !== 250000 || typeof parsed.ciphertext !== "string") throw new Error("Encrypted backup version is unsupported.");
        const pass = window.prompt("Enter the passphrase for this protected backup:");
        if (pass === null) return;
        try {
          const key = await deriveKey(pass,b64ToU8(parsed.salt));
          const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToU8(parsed.iv)},key,b64ToU8(parsed.ciphertext));
          parsed=JSON.parse(new TextDecoder().decode(plain));
        } catch(error) { throw new Error("Could not decrypt. Check the passphrase and file."); }
      }
      const restored = cleanState(parsed);
      if (!window.confirm("Replace your current answers with this backup? Unsaved answers in this tab will be lost.")) return;
      const shouldSave = state.saveOnDevice;  // Local save remains an explicit device choice.
      state = restored; state.saveOnDevice = shouldSave;
      persist(); routeTo("home"); render(false);
      toast("Backup restored. You control whether it is saved on this device.");
      console.info("[Next Move] Backup imported; no answer data logged.");
    } catch(error) { toast(error.message || "This backup could not be opened."); console.warn("[Next Move] Import rejected; content not logged."); }
  }

  /** Fictional demo data is labeled everywhere and never loaded automatically. */
  function loadDemo() {
    if (!window.confirm("Replace the current answers with FICTIONAL demo data? If you want to keep your answers, export a backup first.")) return;
    const keepSave = state.saveOnDevice; state = freshState(); state.saveOnDevice = keepSave; state.demo = true;
    state.answers = {
      1: "I might enjoy making food occasionally, but I don't want restaurant hours or the same kitchen routine.",
      2: "Unpredictable schedules, limited growth, and not enough chances to solve new problems.",
      3: "I liked learning technique, working with my hands, and seeing a finished result.",
      4: "Fixing a bike with a friend; creating a video from scratch.",
      6: "More room to learn and see where my work leads.",
      7: "I watch repair videos and try small creative projects.",
      9: "How things work, tools, and filmmaking.",
      12: 2, 13: 3, 14: 4, 15: 4, 16: 2, 17: 2,
      18: ["Becoming an expert", "Personal freedom and reasonable hours", "Good income"],
      20: "I could try evening study or an apprenticeship if I really enjoy the work.",
      22: "First I'd inspect the order timeline, ask people about handoffs, and test one small process change.",
      26: "I'd watch official safety training, ask an expert, and practice only with permission.",
      28: "Industrial repair, video editing, and IT support.",
      30: { future: "I want useful skills, people I like working with, and time outside work.", firstTest: "Interview an equipment technician." }
    };
    state.lenses = { hands:5, diagnose:5, create:4, people:3, lead:2, systems:4, teach:2, outdoors:3, business:2, tech:4 };
    state.thinking = { 22:["evidence","perspectives","firststep","recheck"], 26:["evidence","firststep","recheck"] };
    state.pins = ["repair","support","creative"];
    state.experiments = [{ id:"synthetic-1", title:"Ask a technician about a workday", lane:"repair", mode:"Interview", date:"", status:"completed", energy:4, curiosity:5, repeat:5, notes:"Sample: I liked hearing how different problems get diagnosed. I want to see the work in person.", next:"Ask if a half-day job shadow is possible." }];
    persist(); routeTo("home"); render(false); toast("Synthetic demo loaded. Reset to start your own journey.");
    console.info("[Next Move] Synthetic demonstration data loaded.");
  }

  function resetAll() {
    if (!window.confirm("Permanently clear the answers in this app and its local device save? Backups already downloaded will not be deleted.")) return;
    try { localStorage.removeItem(STORAGE); } catch(error) { /* Storage was already unavailable. */ }
    state = freshState(); ui.search=""; ui.family="All"; ui.onlyPinned=false;
    ui.showDismissed=false; ui.expanded.clear(); ui.showFullAnswers=false;
    ui.shareReady=false; ui.shareConsent=false; ui.shareCode=""; ui.shareStatus=""; ui.emailDraftPrepared=false;
    routeTo("home"); render(false); toast("App answers cleared. You have a fresh start.");
    console.info("[Next Move] User requested local reset.");
  }

  /** Delegated UI actions; no untrusted answers are interpreted as HTML. */
  document.addEventListener("click", function (event) {
    const navigate = event.target.closest("[data-route]");
    if (navigate) { routeTo(navigate.dataset.route); return; }
    const target = event.target.closest("button[data-onet-answer],button[data-rating],button[data-lens],button[data-value-pick],button[data-pin],button[data-expand],button[data-dismiss],button[data-make-test],button[data-edit-experiment],button[data-delete-experiment],button[data-exp-rating],button[data-action]");
    if (!target) return;
    if (target.dataset.onetAnswer) {
      const qid=Number(target.dataset.onetAnswer), v=Number(target.dataset.value);
      if (qid>=1 && qid<=30 && isNumberRating(v)) {
        if (state.onetAnswers[qid]===v) delete state.onetAnswers[qid]; else state.onetAnswers[qid]=v;
        persist(); const y=window.scrollY; render(false); window.scrollTo(0,y);
      }
    } else if (target.dataset.rating) {
      const qid = target.dataset.rating, v = Number(target.dataset.value);
      if (state.answers[qid] === v) delete state.answers[qid]; else state.answers[qid] = v;
      persist(); const y = window.scrollY; render(false); window.scrollTo(0,y);
    } else if (target.dataset.lens) {
      const id=target.dataset.lens, v=Number(target.dataset.value);
      if (state.lenses[id] === v) delete state.lenses[id]; else state.lenses[id] = v;
      persist(); const y = window.scrollY; render(false); window.scrollTo(0,y);
    } else if (target.dataset.valuePick) {
      const key = target.dataset.valuePick;
      const values = Array.isArray(state.answers[18]) ? [...state.answers[18]] : [];
      const index = values.indexOf(key);
      if (index >= 0) values.splice(index,1); else if (values.length < 3) values.push(key);
      state.answers[18] = values; persist(); const y=window.scrollY; render(false);window.scrollTo(0,y);
    } else if (target.dataset.pin) {
      const id=target.dataset.pin;
      state.pins = state.pins.includes(id) ? state.pins.filter(x=>x!==id) : [...state.pins,id];
      state.dismissed = state.dismissed.filter(x=>x!==id);
      persist(); renderLaneList(); toast(state.pins.includes(id)?"Added to your shortlist.":"Removed from shortlist.");
    } else if (target.dataset.dismiss) {
      const id=target.dataset.dismiss;
      state.dismissed = state.dismissed.includes(id) ? state.dismissed.filter(x=>x!==id) : [...state.dismissed,id];
      if(state.dismissed.includes(id)) state.pins=state.pins.filter(x=>x!==id);
      persist(); renderLaneList();
    } else if (target.dataset.expand) {
      const id=target.dataset.expand;
      if(ui.expanded.has(id)) ui.expanded.delete(id); else ui.expanded.add(id);
      renderLaneList();
    } else if (target.dataset.makeTest) {
      openExperiment(null,target.dataset.makeTest);
    } else if (target.dataset.editExperiment) {
      openExperiment(target.dataset.editExperiment,null);
    } else if (target.dataset.deleteExperiment) {
      const id=target.dataset.deleteExperiment;
      if(window.confirm("Delete this one experiment? This cannot be undone without a backup.")) {
        state.experiments=state.experiments.filter(e=>e.id!==id);
        persist(); render(false); toast("Experiment deleted from this session.");
      }
    } else if (target.dataset.expRating) {
      const k=target.dataset.expRating, v=Number(target.dataset.value);
      ui.editExperiment[k] = ui.editExperiment[k]===v?null:v;
      // Updating all modal controls resets typing only if the user clicked a rating button.
      const form=$("experiment-form");
      const fields = new FormData(form);
      ui.editExperiment.title=String(fields.get("title")||"");
      ui.editExperiment.lane=String(fields.get("lane")||"");
      ui.editExperiment.mode=String(fields.get("mode")||"");
      ui.editExperiment.date=String(fields.get("date")||"");
      ui.editExperiment.status=String(fields.get("status")||"");
      ui.editExperiment.notes=String(fields.get("notes")||"");
      ui.editExperiment.next=String(fields.get("next")||"");
      renderExperimentModal();
    } else if (target.dataset.action) {
      const action = target.dataset.action;
      if (action === "onet-prev") { ui.onetPage=Math.max(0,ui.onetPage-1); render(false); window.scrollTo(0,0); }
      if (action === "onet-next") { ui.onetPage=Math.min(4,ui.onetPage+1); render(false); window.scrollTo(0,0); }
      if (action === "onet-clear" && window.confirm("Clear only the 30 O*NET activity ratings? The rest of your answers will stay.")) { state.onetAnswers={};persist();render(false); }
      if (action === "add-experiment") openExperiment(null,null);
      if (action === "close-modal") closeModal();
      if (action === "clear-filters") { ui.search="";ui.family="All";ui.onlyPinned=false;ui.showDismissed=false;render(false); }
      if (action === "pinned-only") { ui.onlyPinned=!ui.onlyPinned;render(false); }
      if (action === "show-dismissed") { ui.showDismissed=!ui.showDismissed;render(false); }
      if (action === "toggle-full") { ui.showFullAnswers=!ui.showFullAnswers;render(false); }
      if (action === "print-report") window.print();
      if (action === "print-share") { ui.showFullAnswers=false; routeTo("report"); render(false); toast("Review the field guide before printing. Full written answers are hidden by default."); }
      if (action === "download-share") downloadShareText();
      if (action === "share-email") { if (secureEmailAvailable()) sendSecureEmail(); else prepareEmailDraft(); }
      if (action === "copy-summary") {
        if (!navigator.clipboard || !navigator.clipboard.writeText) { toast("Clipboard unavailable. You can print the report instead."); return; }
        navigator.clipboard.writeText(shortSummary()).then(()=>toast("A short, non-sensitive summary was copied."),()=>toast("Clipboard permission denied. Use print instead."));
      }
      if (action === "export-plain") {
        if(window.confirm("Plain JSON is NOT encrypted and includes private answers. Download only if you can keep the file secure.")) {
          downloadText(`next-move-backup-${isoDate()}.json`,JSON.stringify(exportPayload(),null,2),"application/json");
          toast("Plain backup downloaded. Keep it private.");
        }
      }
      if (action === "export-protected") exportProtected();
      if (action === "import-file") $("backup-file").click();
      if (action === "reset") {occupationFiles={interests:null,occupations:null,zones:null};occupationRows=[];occupationMessage="";resetAll();}
      if (action === "load-demo") loadDemo();
    }
  });

  document.addEventListener("input", function (event) {
    const t=event.target;
    if (t.dataset.answer) { state.answers[t.dataset.answer]=t.value.slice(0,8000);persist(); }
    else if (t.hasAttribute("data-person-name")) { state.displayName=t.value.slice(0,60); persist(); }
    else if (t.hasAttribute("data-share-code")) { ui.shareCode=t.value.slice(0,200); }
    else if (t.dataset.reflection) { state.reflections[t.dataset.reflection]=t.value.slice(0,8000);persist(); }
    else if (t.dataset.composite) {
      const id=t.dataset.composite,part=t.dataset.part;
      if(!state.answers[id] || typeof state.answers[id]!=="object") state.answers[id]={};
      state.answers[id][part]=t.value.slice(0,id==='19'?80:8000);persist();
    } else if (t.dataset.resource) { state.resourceNotes[t.dataset.resource]=t.value.slice(0,8000);persist(); }
    else if (t.hasAttribute("data-lane-search")) { ui.search=t.value;renderLaneList(); }
    else if (t.hasAttribute("data-onet-search")) { ui.onetSearch=t.value;updateOccupationList(); }
  });

  document.addEventListener("change", function (event) {
    const t=event.target;
    if(t.hasAttribute("data-person-name")) { ui.shareStatus=""; render(false); }
    else if(t.hasAttribute("data-share-scope")) {
      ui.shareScope=t.value==="full"?"full":"summary";
      ui.shareConsent=false; ui.emailDraftPrepared=false; ui.shareStatus=""; render(false);
    } else if(t.hasAttribute("data-share-ready")) { ui.shareReady=t.checked; ui.shareStatus=""; render(false); }
    else if(t.hasAttribute("data-share-consent")) { ui.shareConsent=t.checked; ui.shareStatus=""; render(false); }
    else if (t.dataset.think) {
      const qid=t.dataset.think,move=t.dataset.move;
      const values = Array.isArray(state.thinking[qid]) ? [...state.thinking[qid]] : [];
      state.thinking[qid] = t.checked ? [...new Set([...values,move])] : values.filter(x=>x!==move);
      persist();
    } else if (t.dataset.laneFamily !== undefined) { ui.family=t.value;renderLaneList(); }
    else if (t.hasAttribute("data-save-setting")) {
      state.saveOnDevice=t.checked;persist();render(false);
      toast(state.saveOnDevice?"Saving on this device is now on.":"Device save deleted; this tab still holds your answers.");
      console.info("[Next Move] Local device save preference changed.");
    } else if (t.id==="onet-files" && t.files && t.files.length) { importOccupationFiles(t.files); t.value=""; }
    else if (t.id==="backup-file" && t.files && t.files[0]) {
      importBackupFile(t.files[0]); t.value="";
    }
  });

  document.addEventListener("submit", function(event) {
    if(event.target.id==="experiment-form") { event.preventDefault();saveExperiment(event.target); }
  });

  document.addEventListener("keydown", function(event) {
    if(event.key==="Escape" && ui.modalOpen) { event.preventDefault();closeModal(); }
    if(event.key==="Tab" && ui.modalOpen) {
      const modal = $("modal-root");
      const focusable = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(el=>el.getClientRects().length);
      if(!focusable.length) return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });

  window.addEventListener("hashchange", function() {
    route=(location.hash||"#home").slice(1);
    render(true);
  });

  /** All outbound links are human-initiated. Initialize with a single local render. */
  if(!NAV.some(x=>x.id===route)) route="home";
  render(false);
  console.info(`[Next Move] v${VERSION} ready. Local-first; no analytics or network requests.`);

  // Narrow, read-only diagnostic surface for reproducible automated smoke testing.
  // Exposes only aggregate counts and route, never questionnaire text or answers.
  if(new URLSearchParams(location.search).has("selftest")) {
    window.NextMoveTest = Object.freeze({
      getCounts: () => ({ questions:ALL_QUESTIONS.length, answered:countAnswered(), lenses:D.lenses.length, lanes:D.lanes.length, experiments:state.experiments.length, route, shareMode:ui.shareScope, secureEmailAvailable:secureEmailAvailable() }),
      getPageHeading: () => document.querySelector("#main h1")?.textContent || "",
      cleanState: (obj) => cleanState(obj),
      summary: () => shortSummary(),
      report: () => fullShareText()
    });
    console.info("[Next Move] Read-only test interface enabled.");
  }
})();
