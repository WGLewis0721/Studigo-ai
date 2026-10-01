/* A stand-in for the Studigo study room, just enough of it for the companion to
   live in: the five pages, a scripted Coach, a short quiz, flashcards, Plan and
   Cram. Everything here is sample content. No model, no network, no accounts. */
(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const C = () => window.Companion;

  /* ---------- the same icon set as components/mode-glyph.tsx ---------- */
  const GLYPHS = {
    materials: '<rect x="3.5" y="4.5" width="10" height="13" rx="2"/><path d="M6.5 2.5h8a2 2 0 0 1 2 2V14"/><path d="M6.5 9h4M6.5 12h4"/>',
    coach: '<circle cx="10" cy="8" r="4.5"/><path d="M3.5 17.5c1.2-2.6 3.6-4 6.5-4s5.3 1.4 6.5 4"/><path d="M8.3 7.4h.01M11.7 7.4h.01"/>',
    quiz: '<circle cx="10" cy="10" r="6.5"/><path d="m7.2 10.2 1.9 1.9 3.8-4"/>',
    plan: '<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/><path d="M7 12h2"/>',
    mastery: '<path d="M3.5 16.5h13"/><path d="M5.5 16.5V11M10 16.5V6.5M14.5 16.5V9"/>'
  };
  const glyph = (name, size) => `<svg class="modeGlyph" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`;

  /* ---------- the room (as in components/room/workspace.tsx) ---------- */
  const MODES = {
    materials: { name: "Materials", copy: "Everything this room knows.", sub: "Your files" },
    coach: { name: "Coach", copy: "Ask, learn and practice in one place.", sub: "Practice and apply" },
    quiz: { name: "Quiz", copy: "Practice exactly what is testable.", sub: "5 questions" },
    cards: { name: "Cards", copy: "Drill the terms until they stick.", sub: "Drill terms" },
    weak: { name: "Weak areas", copy: "Where to focus next.", sub: "Focus next" },
    test: { name: "Test", copy: "Rehearse the whole test.", sub: "Full length" },
    plan: { name: "Plan", copy: "A little each day.", sub: "Day by day" },
    cram: { name: "Cram", copy: "Make limited time count.", sub: "Short on time" },
    mastery: { name: "Mastery", copy: "Find weak spots before test day.", sub: "How ready" }
  };
  const GROUPS = [
    { name: "Coach", icon: "coach", tone: "coach", modes: ["coach"] },
    { name: "Practice", icon: "quiz", tone: "quiz", modes: ["quiz", "cards", "test"] },
    { name: "Progress", icon: "mastery", tone: "mastery", modes: ["mastery", "weak"] },
    { name: "Plan", icon: "plan", tone: "plan", modes: ["plan", "cram"] },
    { name: "Materials", icon: "materials", tone: "materials", modes: ["materials"] }
  ];
  const TOPICS = [
    { title: "Matter and Its Properties", objective: "Describe matter by the properties you can observe and measure." },
    { title: "Physical Changes and Changes of State", objective: "Tell physical changes from chemical ones and name each change of state." },
    { title: "Heat and Temperature", objective: "Explain how heat moves and what temperature measures." },
    { title: "Electricity and Simple Circuits", objective: "Trace the path of current through a simple circuit." },
    { title: "Mixtures and Solutions", objective: "Separate a mixture and say what makes a solution." },
    { title: "Forces and Motion", objective: "Predict how balanced and unbalanced forces change motion." },
    { title: "Energy and Its Forms", objective: "Follow energy as it changes from one form to another." },
    { title: "The Scientific Method", objective: "Plan a fair test with one variable." }
  ].map((topic, index) => Object.assign(topic, { id: "t" + index, right: 0, seen: 0 }));
  const SOURCE = "Science study guide (sample)";

  const COACH_SET = [
    {
      q: "Picture a metal spoon and a wooden spoon left in hot soup. The metal one gets hot fast and the wooden one stays cool. Which **property of matter** explains the difference?",
      accept: /conduct/i,
      yes: "**Yes.** That is thermal conductivity. Metal lets heat travel through it quickly; wood does not.",
      hint: "Think about how easily heat can travel through each material. There is a word for that.",
      simpler: "Some materials let heat pass through them easily. Others block it. What do we call how well a material lets heat pass?",
      example: "A metal pan handle burns your hand, but a pan with a wooden handle is safe to hold. Same stove, different material.",
      reveal: "The property is **thermal conductivity**: how well a material lets heat pass through it."
    },
    {
      q: "You squash a 10 g ball of clay flat. What is its **mass** now, and why?",
      accept: /\b10\b|same|no change|not change|doesn.?t change|stays|still/i,
      yes: "**Right.** Still 10 g. Changing the shape does not add or remove matter, so the mass stays the same.",
      hint: "Did you add any clay, or take any away?",
      simpler: "Mass is how much stuff is in an object. Does squashing clay change how much clay there is?",
      example: "Tear a sheet of paper into pieces and weigh all the pieces together: the same mass as the whole sheet.",
      reveal: "It is still **10 g**. The shape changed; the amount of matter did not."
    },
    {
      q: "Ice melts into water. Is that a **physical** change or a **chemical** change? How do you know?",
      accept: /physical/i,
      yes: "**Exactly.** It is physical: it is still water, and you can freeze it back into ice.",
      hint: "Ask yourself: is it still the same substance afterward?",
      simpler: "If a change makes a new substance, it is chemical. If it is the same stuff in a new form, it is physical. Which one is melting?",
      example: "Melting butter is physical (it is still butter). Burning toast is chemical (the black part is a new substance).",
      reveal: "It is a **physical** change. Water is still water, just in a different state."
    }
  ];
  const COMMANDS = ["Make it simpler", "Give me a hint", "Show me an example", "Challenge me"];
  const LEARN_STARTERS = [
    { id: "how", label: "How Learn works", text: "How does Learn work?" },
    { id: "explain", label: "Explain this topic", text: "Explain this topic simply." },
    { id: "guide", label: "What's in my guide?", text: "What does the study guide say I need to know?" },
    { id: "terms", label: "Key terms", text: "What are the key terms I need to know? Give each one a short definition." }
  ];
  const LEARN_ANSWERS = {
    how: { kind: "guide", text: "**Learn answers your questions from your own materials.**\n\n## What Learn does\n- Answers from your study guide and notes, and shows the page each answer came from\n- Explains ideas and key terms until they make sense\n- Says so when something is not in your materials, instead of guessing\n- Never grades you and never changes your mastery\n\n## How Coach is different\n- Coach asks you questions and checks your answers\n- Coach is where your mastery is earned\n- Learn first when a term is unclear, then Coach to practice it" },
    explain: { page: 2, text: "**Matter is anything that has mass and takes up space.**\n\n## The idea\n- You describe matter by its properties, such as color, texture, mass and volume\n- A physical property can be observed without changing what the substance is\n\n## Why it matters\n- Properties are how you tell one substance from another" },
    guide: { page: 1, text: "**Your guide lists four things to know for this topic.**\n\n## From the guide\n- Define matter, mass and volume\n- Tell physical properties from chemical properties\n- Name the three common states of matter\n- Explain why mass stays the same when shape changes" },
    terms: { page: 2, text: "**Five key terms.**\n\n## Key terms\n- **Matter**: anything that has mass and takes up space\n- **Mass**: the amount of matter in an object\n- **Volume**: the space an object takes up\n- **Physical property**: something you can observe without changing the substance\n- **State of matter**: solid, liquid or gas" }
  };

  const QUIZ = [
    { kind: "multiple_choice", topic: 1, prompt: "Which change of state happens when a liquid turns into a gas?", choices: ["Melting", "Evaporation", "Condensation", "Freezing"], answer: 1,
      right: "Evaporation is a liquid turning into a gas.", wrong: "A liquid turning into a gas is evaporation. Condensation runs the other way: gas to liquid.", page: 4 },
    { kind: "true_false", topic: 0, prompt: "Squashing a ball of clay flat does not change its mass.", choices: ["True", "False"], answer: 0,
      right: "Mass is the amount of matter. Changing the shape adds none and removes none.", wrong: "It is true. Mass is the amount of matter, and squashing clay adds none and removes none.", page: 2 },
    { kind: "multiple_choice", topic: 3, prompt: "A bulb in a simple circuit goes out when you open the switch. Why?", choices: ["The battery is empty", "The path for the current is broken", "The bulb gets too hot", "The wires get shorter"], answer: 1,
      right: "An open switch breaks the loop, so current cannot flow.", wrong: "Opening the switch breaks the loop. Current only flows around a complete path.", page: 7 },
    { kind: "fill_blank", topic: 2, prompt: "Heat always flows from a warmer object to a ____ one.", accept: /^(cooler|colder|cool|cold)$/i, expected: "cooler",
      right: "Heat moves from warmer to cooler until both reach the same temperature.", wrong: "Heat moves from warmer to cooler, never the other way on its own.", page: 5 },
    { kind: "multiple_choice", topic: 0, prompt: "Which of these is a physical property you can observe without changing the substance?", choices: ["Flammability", "Color", "Ability to rust", "Reacting with acid"], answer: 1,
      right: "You can see color without changing what the substance is.", wrong: "Color is the physical property here. The others only show up when the substance changes into something new.", page: 2 }
  ];
  const KIND_LABELS = { multiple_choice: "Multiple choice", true_false: "True or false", fill_blank: "Fill in the blank" };
  const CONFIDENCE = [{ value: 1, label: "Guessing" }, { value: 2, label: "Fairly sure" }, { value: 3, label: "Confident" }];
  const CARDS = [
    { front: "Matter", back: "Anything that has mass and takes up space." },
    { front: "Evaporation", back: "A liquid changing into a gas." },
    { front: "Conductor", back: "A material that lets heat or electric current pass through it easily." },
    { front: "Physical change", back: "A change in form or state that does not make a new substance." },
    { front: "Closed circuit", back: "A complete loop that lets electric current flow." }
  ];
  const RATINGS = [{ value: 1, label: "Missed it", hint: "See it again shortly" }, { value: 2, label: "Hard", hint: "Soon" }, { value: 3, label: "Got it", hint: "Later" }];
  const NOT_YET = "Not practiced yet. Understanding has not been measured.";
  const CRAM = {
    15: [[3, 6], [1, 6], ["Rapid recall", 3, "Flashcards on the terms you have seen."]],
    30: [[3, 6], [1, 6], [2, 7], ["Check your weakest topic", 8, "Five questions on the topic that needs the most work."], ["Rapid recall", 3, "Flashcards on the terms you have seen."]],
    60: [[3, 8], [1, 8], [2, 8], [0, 8], [4, 8], ["Check your weakest topic", 12, "Five questions on the topic that needs the most work."], ["Rapid recall", 8, "Flashcards on the terms you have seen."]],
    120: [[3, 12], [1, 12], [2, 12], [0, 12], [4, 12], [5, 12], [6, 12], [7, 12], ["Check your weakest topic", 14, "Five questions on the topic that needs the most work."], ["Rapid recall", 10, "Flashcards on the terms you have seen."]]
  };

  const S = {
    mode: "coach", coachView: "chat", chatMode: "coach", topic: 0, messages: [], busy: false,
    coach: { i: 0, tries: 0, started: false }, quiz: null, quizDone: null, cards: { index: 0, flipped: false, done: false },
    cramMinutes: 30, testNote: false
  };
  /** The room being shown. Onboarding and Home set its name and color. */
  const ROOM = { title: "Science", tone: "teal", test: "Oct 7" };
  /** Pages where the companion has a job, so he comes out to his window. Elsewhere he stays in his seat. */
  const JOB_MODES = ["coach", "quiz", "cards", "test"];
  let screen, ws, frame, chips, surface, tabs;

  /* ---------- rich text (bold, headings, bullets) ---------- */
  const inline = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  function rich(text) {
    let html = "", list = false;
    const close = () => { if (list) { html += "</ul>"; list = false; } };
    text.split("\n").forEach((line) => {
      if (line.startsWith("## ")) { close(); html += `<h4>${inline(line.slice(3))}</h4>`; }
      else if (line.startsWith("- ")) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inline(line.slice(2))}</li>`; }
      else if (line.trim()) { close(); html += `<p>${inline(line)}</p>`; }
      else close();
    });
    close();
    return `<div class="richText">${html}</div>`;
  }
  const cite = (page) => `<div class="sourceStack"><a class="sourceChipLink" href="#" data-act="noop" title="Open ${SOURCE}"><i>1</i><span class="sourceChipName">${SOURCE}</span><span class="sourceChipPage">page ${page}</span></a></div>`;
  const mark = () => '<span class="studigoMascot"><img src="assets/mark.jpg" alt=""></span>';

  /* ---------- header, chips, tab bar ---------- */
  const groupOf = (mode) => GROUPS.find((group) => group.modes.includes(mode));
  const headTone = () => (S.mode === "coach" ? (S.chatMode === "learn" && S.coachView === "chat" ? "ask" : "coach") : S.mode);
  function headHTML(group) {
    let middle;
    if (S.mode === "coach" && S.coachView === "chat") {
      middle = `<div class="chatModes" role="group" aria-label="How Studigo helps">
        <button type="button" data-tone="coach" aria-pressed="${S.chatMode === "coach"}" data-act="chatmode" data-v="coach"><strong>Coach</strong><small>Practice and apply</small></button>
        <button type="button" data-tone="ask" aria-pressed="${S.chatMode === "learn"}" data-act="chatmode" data-v="learn"><strong>Learn</strong><small>Facts, with sources</small></button></div>`;
    } else if (S.mode === "coach") {
      middle = '<div class="mhTitle"><h2>Topics</h2><p>Pick one to learn it or be coached on it.</p></div>';
    } else if (group.modes.length > 1) {
      middle = `<div class="chatModes" role="group" aria-label="${group.name} modes">${group.modes.map((id) => `<button type="button" data-tone="${id}" aria-pressed="${id === S.mode}" data-act="mode" data-v="${id}"><strong>${MODES[id].name}</strong><small>${MODES[id].sub}</small></button>`).join("")}</div>`;
    } else {
      middle = `<div class="mhTitle"><h2>${MODES[S.mode].name}</h2><p>${MODES[S.mode].copy}</p></div>`;
    }
    const dot = S.mode === "coach" && S.coachView === "chat" && S.chatMode === "coach" ? '<span class="chatMascotDot" aria-hidden="true"></span>' : "";
    const step = GROUPS.indexOf(group);
    const seat = `<button type="button" class="chatMascot seat" data-act="seat" aria-label="Studigo's seat. Tap to call him out or send him back."><span class="studigoMascot"><img src="assets/center.png" alt=""></span>${dot}</button>`;
    return `<header class="modeHead" data-tone="${headTone()}">${seat}${middle}</header>
      <div class="studigoRail" aria-hidden="true"><span class="railLed"></span><span class="railBrand">studigo</span><span class="railDots">${GROUPS.map((_, index) => `<i ${index === step ? "data-lit" : ""}></i>`).join("")}</span></div>`;
  }
  const chip = (label, act) => `<button type="button" class="chatTopic" data-act="${act}"><span class="chatTopicName">${esc(label)}</span><span aria-hidden="true">▾</span></button>`;
  function chipsHTML() {
    if (S.mode === "coach") {
      const tabsHTML = `<div class="coachTabs" role="group" aria-label="Coach sections">
        <button type="button" aria-pressed="${S.coachView === "chat"}" data-act="coachview" data-v="chat">Chat</button>
        <button type="button" aria-pressed="${S.coachView === "topics"}" data-act="coachview" data-v="topics">Topics<span class="coachTabCount">${TOPICS.length}</span></button></div>`;
      return tabsHTML + (S.coachView === "chat" ? chip(TOPICS[S.topic].title, "topics") : "");
    }
    if (S.mode === "quiz" && !S.quiz) return chip("Where I'm weakest", "noop");
    if (S.mode === "plan") return chip(`Test ${ROOM.test}`, "noop");
    if (S.mode === "materials") return chip("Adding: Study guide", "noop");
    return "";
  }
  function tabsHTML(current) {
    return GROUPS.map((group) => `<button type="button" data-tone="${group.tone}" ${group === current ? 'aria-current="page"' : ""} data-act="mode" data-v="${group.modes[0]}"><span class="studyGroupIcon" aria-hidden="true">${glyph(group.icon, 24)}</span><span class="studyGroupLabel">${group.name}</span></button>`).join("");
  }

  /* ---------- pages ---------- */
  function coachChatHTML() {
    const learn = S.chatMode === "learn";
    return `<div class="coachMode"><section class="coachChat" data-chat-mode="${S.chatMode}" aria-label="Conversation with Studigo">
      ${learn ? "" : '<button type="button" class="coachActiveStyle" data-act="noop"><span>Coaching</span><strong>Concrete to abstract · Teacher\'s method</strong><em>Simpler words</em></button>'}
      <div class="chatThread" id="thread" role="log" aria-live="polite" aria-label="Messages"></div>
      <div class="chatChips" id="chatChips"></div>
      <form class="chatComposer" id="composer" ${learn ? 'data-accent="learn"' : ""}><div class="chatRow">
        <input id="chatInput" placeholder="${learn ? "Ask about your materials" : "Answer, or message your coach"}" aria-label="Message Studigo" enterkeyhint="send" autocomplete="off">
        <button class="chatSend" type="submit" aria-label="Send to Studigo" disabled><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div></form></section></div>`;
  }
  function emptyHTML() {
    const title = TOPICS[S.topic].title;
    if (S.chatMode === "learn") return '<div class="coachEmpty"><strong>Understand it.</strong><p>Learn answers from your materials and shows the page it came from. Use it when an idea or term does not make sense yet. Then switch to Coach to practice it. Tap a starter below to see how it works.</p></div>';
    return `<div class="coachEmpty"><strong>Practice it.</strong>
      <p>Coach gives you problems, checks your work and tracks what you have mastered. Not sure what a term means? Switch to Learn first.</p>
      <p class="coachEmptyStyle"><b>Concrete to abstract:</b> A picture, model or real example first, then the formal idea and terms.</p>
      <div class="starterList"><button type="button" data-act="starter" data-v="coach">Coach me on ${esc(title)}</button><button type="button" data-act="starter" data-v="example">Show me an example</button></div></div>`;
  }
  function kicker(message) {
    if (message.kind === "guide") return "LEARN · HOW IT WORKS";
    if (message.mode === "learn") return message.streaming ? "LEARN · READING YOUR MATERIALS…" : message.grounded ? "LEARN · FROM YOUR MATERIALS" : "LEARN · NOT IN YOUR MATERIALS";
    return message.streaming ? "COACH · THINKING…" : "COACH · PRACTICE";
  }
  function bubbleNode(message) {
    const node = document.createElement("div");
    if (message.role === "user") { node.className = "studentBubble"; node.textContent = message.content; return node; }
    node.className = "answerBubble"; node.dataset.mode = message.mode;
    if (message.streaming) node.dataset.state = "streaming";
    node.innerHTML = `<span class="answerKicker">${mark()}<span class="kick">${kicker(message)}</span></span><div class="answerText">${rich(message.content)}${message.streaming ? '<span class="caret" aria-hidden="true"></span>' : ""}</div>${message.page && !message.streaming ? cite(message.page) : ""}`;
    return node;
  }
  function paintThread(instant) {
    const thread = $("#thread"); if (!thread) return;
    thread.innerHTML = "";
    const shown = S.messages.filter((message) => message.mode === S.chatMode);
    if (!shown.length) thread.innerHTML = emptyHTML();
    else shown.forEach((message) => { const node = bubbleNode(message); if (instant) node.style.animation = "none"; message.node = node; thread.appendChild(node); });
    paintChips(); thread.scrollTop = thread.scrollHeight;
  }
  function paintChips() {
    const row = $("#chatChips"); if (!row) return;
    const has = S.messages.some((message) => message.mode === S.chatMode);
    if (S.chatMode === "learn") row.innerHTML = LEARN_STARTERS.map((s) => `<button type="button" data-act="learn" data-v="${s.id}" ${S.busy ? "disabled" : ""}>${esc(s.label)}</button>`).join("");
    else row.innerHTML = has ? COMMANDS.map((label) => `<button type="button" data-act="command" data-v="${label}" ${S.busy ? "disabled" : ""}>${label}</button>`).join("") : "";
    row.hidden = !row.innerHTML;
    requestAnimationFrame(() => C().relayout());
  }
  function push(message) {
    const thread = $("#thread");
    if (thread && thread.querySelector(".coachEmpty")) thread.innerHTML = "";
    S.messages.push(message);
    if (thread && message.mode === S.chatMode) { message.node = bubbleNode(message); thread.appendChild(message.node); thread.scrollTop = thread.scrollHeight; }
    paintChips();
  }
  /** Shows the reply the way the app streams one: a pause, then words arriving. */
  function answer(mode, text, extra, done) {
    S.busy = true;
    const message = Object.assign({ role: "assistant", mode, content: "", streaming: true, grounded: true }, extra || {});
    push(message);
    C().event("thinking");
    const words = text.split(/(\s+)/);
    let index = 0;
    setTimeout(() => {
      C().event("thinkingEnd");
      if (message.node) C().event("look", message.node);
      const timer = setInterval(() => {
        index = Math.min(words.length, index + 3);
        message.content = words.slice(0, index).join("");
        const thread = $("#thread");
        if (message.node) { $(".answerText", message.node).innerHTML = rich(message.content) + (index < words.length ? '<span class="caret" aria-hidden="true"></span>' : ""); }
        if (thread) thread.scrollTop = thread.scrollHeight;
        if (index < words.length) return;
        clearInterval(timer);
        message.streaming = false; S.busy = false;
        if (message.node) {
          delete message.node.dataset.state; $(".kick", message.node).textContent = kicker(message);
          if (message.page) message.node.insertAdjacentHTML("beforeend", cite(message.page));
          if (thread) thread.scrollTop = thread.scrollHeight;
        }
        paintChips();
        if (done) done();
      }, 34);
    }, 720);
  }
  function coachSay(text, verdict) { answer("coach", text, null, verdict ? () => C().event(verdict) : null); }
  function coachTurn(text) {
    const said = text.trim(); if (!said || S.busy) return;
    push({ role: "user", mode: "coach", content: said });
    const state = S.coach, item = COACH_SET[state.i];
    const next = () => { state.i += 1; state.tries = 0; return COACH_SET[state.i] ? "\n\n" + COACH_SET[state.i].q : "\n\nThat is the set for this topic. Open Practice for a quiz on it, or pick another topic."; };
    if (!state.started || /^coach me/i.test(said)) { state.started = true; state.i = 0; state.tries = 0; return coachSay("**Let's start with something you can picture.**\n\n" + COACH_SET[0].q); }
    if (!item) return coachSay("That is everything in this sample set. Open Practice for a quiz, or pick another topic.");
    if (/simpler/i.test(said)) return coachSay(item.simpler);
    if (/hint/i.test(said)) return coachSay(item.hint);
    if (/example/i.test(said)) return coachSay(item.example);
    if (/challenge/i.test(said)) return coachSay("**Here is a harder one.**" + next());
    if (item.accept.test(said)) return coachSay(item.yes + next(), "correct");
    state.tries += 1;
    if (state.tries < 2) return coachSay("**Not quite.** " + item.hint + " Try once more.", "wrong");
    return coachSay("**Here it is.** " + item.reveal + next(), "wrong");
  }
  function learnTurn(id, text) {
    if (S.busy) return;
    push({ role: "user", mode: "learn", content: text });
    const found = LEARN_ANSWERS[id];
    if (found) return answer("learn", found.text, { kind: found.kind, page: found.page, grounded: !found.kind });
    answer("learn", "**That is not in this demo's sample materials.**\n\nIn the app, Learn answers from the files in this room and shows the page each answer came from.", { grounded: false });
  }

  function topicsHTML() {
    return `<div class="coachTopicsView"><p class="phSub topicsLead">${TOPICS.length} topics from your study guide. Open one for a lesson.</p><ul class="topicList">${TOPICS.map((topic, index) => {
      const pct = topic.seen ? Math.round((topic.right / topic.seen) * 100) : 0;
      const state = !topic.seen ? "" : pct >= 80 ? "mastered" : "learning";
      return `<li class="topicItem"><button class="topicHead" type="button" data-act="picktopic" data-v="${index}"><span class="topicMarker ${state}">${index + 1}</span><span class="topicCopy"><strong>${esc(topic.title)}</strong><small>${esc(topic.objective)}</small></span><span class="masteryPill">${pct}%</span></button></li>`;
    }).join("")}</ul></div>`;
  }

  function quizHTML() {
    const quiz = S.quiz;
    if (!quiz) {
      const done = S.quizDone;
      let card = "";
      if (done) {
        const right = done.filter((item) => item.isCorrect).length, blind = done.filter((item) => item.confidence === 3 && !item.isCorrect).length, lucky = done.filter((item) => item.confidence === 1 && item.isCorrect).length;
        card = `<div class="quizScoreCard"><img class="fullMascot" src="assets/full/celebrate.webp" alt="Studigo celebrating"><span class="tinyLabel">SET COMPLETE</span><strong>${Math.round((right / done.length) * 100)}%</strong><small>${right} of ${done.length} right · your mastery has been updated</small>
          ${blind ? `<p class="calibrationNote">You were confident on ${blind} answer${blind === 1 ? "" : "s"} you got wrong. Those are blind spots. Weak Areas now ranks them first.</p>` : lucky ? `<p class="calibrationNote">You guessed right ${lucky} time${lucky === 1 ? "" : "s"}. Worth another pass before you count it as known.</p>` : ""}</div>`;
      }
      return `<div class="quizSetup">${card}<p class="setupLead">${done ? "Go again with a new set." : "Five questions, written only from your materials."}</p><button class="buttonPrimary" type="button" data-act="quizstart">Start quiz <span aria-hidden="true">→</span></button></div>`;
    }
    const q = QUIZ[quiz.index], result = quiz.result, usesChoices = q.kind !== "fill_blank";
    const hasAnswer = usesChoices ? quiz.selected !== null : quiz.written.trim().length > 0;
    let promptHTML = esc(q.prompt);
    if (q.kind === "fill_blank") { const parts = q.prompt.split("____"); promptHTML = `${esc(parts[0])}<span class="inlineBlank ${quiz.written.trim() ? "inlineBlankFilled" : ""}" id="blankSlot">${esc(quiz.written.trim()) || "?"}</span>${esc(parts[1])}`; }
    const choices = usesChoices ? `<div class="choiceList" role="radiogroup" aria-label="Answer choices">${q.choices.map((choice, index) => {
      const state = !result ? (quiz.selected === index ? "choiceSelected" : "") : index === q.answer ? "choiceCorrect" : index === quiz.selected ? "choiceWrong" : "";
      const verdict = result && index === q.answer ? `<b class="choiceVerdict">${index === quiz.selected ? "✓ Your answer" : "✓ Correct answer"}</b>` : result && index === quiz.selected ? '<b class="choiceVerdict">✕ Your answer</b>' : "";
      return `<button type="button" role="radio" aria-checked="${quiz.selected === index}" class="choiceItem ${state}" ${result ? "disabled" : ""} data-act="choose" data-v="${index}"><i>${q.kind === "true_false" ? (index === 0 ? "T" : "F") : String.fromCharCode(65 + index)}</i><span>${esc(choice)}</span>${verdict}</button>`;
    }).join("")}</div>` : `<input class="blankInput" id="blankInput" value="${esc(quiz.written)}" placeholder="The missing word or phrase…" aria-label="Fill in the blank" maxlength="120" autocomplete="off" ${result ? "disabled" : ""}>`;
    const feedback = result ? `<div class="quizFeedback ${result.isCorrect ? "feedbackRight" : "feedbackWrong"}" id="quizFeedback"><span class="answerKicker">${result.isCorrect ? "CORRECT" : "NOT QUITE"} · ${result.isCorrect ? 100 : 0}%</span>
      ${result.confidence === 3 && !result.isCorrect ? '<p class="blindSpotFlag">You were confident here. This is a blind spot worth a second look.</p>' : ""}${result.confidence === 1 && result.isCorrect ? '<p class="blindSpotFlag">You knew that one. You just didn\'t trust it yet.</p>' : ""}
      <p>${esc(result.isCorrect ? q.right : q.wrong)}</p>${!result.isCorrect && q.expected ? `<p class="expectedAnswer"><strong>Model answer:</strong> ${esc(q.expected)}</p>` : ""}${cite(q.page)}</div>` : "";
    const actions = result
      ? `<button class="buttonPrimary" type="button" data-act="quiznext">${quiz.index + 1 === QUIZ.length ? "See results" : "Next question"} <span aria-hidden="true">→</span></button>`
      : `<div class="confidenceRow"><span class="tinyLabel" id="sureLabel">${hasAnswer ? "HOW SURE ARE YOU?" : "ANSWER TO CONTINUE"}</span><div class="confidenceButtons">${CONFIDENCE.map((level) => `<button type="button" class="confidenceButton confidence-${level.value}" ${hasAnswer ? "" : "disabled"} data-act="grade" data-v="${level.value}"><strong>${level.label}</strong></button>`).join("")}</div><small class="hintText">Your answer is checked when you rate it.</small></div>`;
    return `<div class="quizMode"><div class="quizProgress"><span class="tinyLabel">QUESTION ${quiz.index + 1} OF ${QUIZ.length} · ${KIND_LABELS[q.kind]}</span><div class="quizBar"><i style="width:${(quiz.index / QUIZ.length) * 100}%"></i></div></div>
      <h2 class="quizPrompt">${promptHTML}</h2>${choices}${feedback}<div class="quizActions">${actions}</div></div>`;
  }
  function grade(confidence) {
    const quiz = S.quiz, q = QUIZ[quiz.index]; if (!quiz || quiz.result) return;
    const isCorrect = q.kind === "fill_blank" ? q.accept.test(quiz.written.trim()) : quiz.selected === q.answer;
    quiz.result = { isCorrect, confidence };
    quiz.answered.push({ isCorrect, confidence });
    const topic = TOPICS[q.topic]; topic.seen += 1; if (isCorrect) topic.right += 1;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    repaint(quizHTML());
    C().steady(1400);
    C().event(isCorrect ? "correct" : confidence === 3 ? "blindspot" : "wrong");
    requestAnimationFrame(() => { surface.scrollTo({ top: surface.scrollHeight, behavior: "smooth" }); });
  }

  function cardsHTML() {
    const deck = S.cards;
    if (deck.done) return '<div class="modeEmpty"><img class="fullMascot" src="assets/full/wave.webp" alt="Studigo waving"><h3>All caught up.</h3><p>Every card that was due has been reviewed. Your next cards come back when they are due.</p><button class="buttonPrimary" type="button" data-act="cardsagain">Review again <span aria-hidden="true">→</span></button></div>';
    const card = CARDS[deck.index];
    return `<div class="cardsMode"><span class="tinyLabel">CARD ${deck.index + 1} OF ${CARDS.length} DUE</span>
      <button class="flashcard ${deck.flipped ? "flashcardFlipped" : ""}" type="button" data-act="flip"><span class="srOnly">${deck.flipped ? "Answer side. Press to show the question." : "Question side. Press to show the answer."}</span>
        <span class="flashcardInner"><span class="flashcardFace flashcardFront"><small>FRONT</small><span class="flashcardSide">${esc(card.front)}</span><small>Tap to flip</small></span>
        <span class="flashcardFace flashcardBack"><small>BACK</small><span class="flashcardSide">${esc(card.back)}</span></span></span></button>
      <div class="ratingRow">${ratingHTML(deck.flipped)}</div></div>`;
  }
  const ratingHTML = (flipped) => (flipped ? RATINGS.map((r) => `<button type="button" class="ratingButton rating-${r.value}" data-act="rate" data-v="${r.value}"><strong>${r.label}</strong><small>${r.hint}</small></button>`).join("") : '<button class="buttonPrimary" type="button" data-act="flip">Show answer <span aria-hidden="true">→</span></button>');
  /** Swap the page's content in place, without replaying its entrance. */
  function repaint(html) { surface.innerHTML = html; if (surface.firstElementChild) surface.firstElementChild.style.animation = "none"; requestAnimationFrame(() => C().relayout()); }
  const testHTML = () => `<div class="practiceTestSetup"><span class="tinyLabel">NEXT TEST</span><h3>20 questions</h3><p class="setupLead">A full test, graded when you submit.</p><button class="buttonPrimary" type="button" data-act="teststart">Start practice test <span aria-hidden="true">→</span></button>${S.testNote ? '<p class="formNotice" role="status">The full practice test is not part of this demo. Try Quiz or Cards.</p>' : ""}</div>`;

  function masteryHTML() {
    const practiced = TOPICS.filter((topic) => topic.seen), seen = practiced.reduce((sum, topic) => sum + topic.seen, 0), right = practiced.reduce((sum, topic) => sum + topic.right, 0);
    const value = seen ? Math.round((right / seen) * 100 * (practiced.length / TOPICS.length)) : 0;
    const circumference = 2 * Math.PI * 50;
    const count = { mastered: 0, learning: 0, new: 0 };
    const tiles = TOPICS.map((topic) => {
      const pct = topic.seen ? Math.round((topic.right / topic.seen) * 100) : 0;
      const state = !topic.seen ? "new" : pct >= 80 ? "mastered" : "learning"; count[state] += 1;
      return `<li><button type="button" class="mdTile mdTile-${state}" style="--v:${Math.max(4, pct)}%" data-act="practice"><b>${esc(topic.title)}</b><small>${state === "new" ? "Not practiced" : `${pct}% · ${state === "mastered" ? "Strong" : "Needs work"}`}</small></button></li>`;
    }).join("");
    return `<div class="masteryMode"><div class="masteryHero"><div class="masteryHeroText"><span class="tinyLabel">READINESS</span><p>${seen ? `${right} of ${seen} practice answers right.` : "Practice a topic to start measuring."}</p></div>
      <div class="progressRing"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ringTrack" cx="60" cy="60" r="50"/><circle class="ringValue" cx="60" cy="60" r="50" stroke-dasharray="${(value / 100) * circumference} ${circumference}"/></svg><div class="ringLabel"><strong>${seen ? value + "%" : "–"}</strong><span>READY</span></div></div></div>
      <section class="masteryDeck"><div class="mdHead"><div><span class="tinyLabel">EVERY TOPIC</span><b>${TOPICS.length} topics on the map</b></div>
        <dl class="mdLegend" aria-label="Tile key"><div><dt><i class="lg-mastered"></i>Strong <span>${count.mastered}</span></dt></div><div><dt><i class="lg-learning"></i>Needs work <span>${count.learning}</span></dt></div><div><dt><i class="lg-new"></i>Not practiced <span>${count.new}</span></dt></div></dl></div><ul class="mdTiles">${tiles}</ul></section>
      <dl class="statRow"><div><dt>Practice responses</dt><dd>${seen}</dd></div><div><dt>Cards due</dt><dd>${S.cards.done ? 0 : CARDS.length - S.cards.index}</dd></div></dl></div>`;
  }
  const weakHTML = () => `<section class="weakAreasPanel"><ol class="weakAreaList">${[3, 1, 2].map((id, index) => `<li><span class="priorityNumber">0${index + 1}</span><div class="weakAreaBody"><span class="tinyLabel">${TOPICS[id].seen ? "NEEDS WORK" : "NOT PRACTICED"}</span><h3>${esc(TOPICS[id].title)}</h3><ul><li>${TOPICS[id].seen ? `${TOPICS[id].right} of ${TOPICS[id].seen} practice answers right.` : NOT_YET}</li></ul></div><button type="button" class="buttonPrimary" data-act="practice">Practice 5 questions <span>→</span></button></li>`).join("")}</ol></section>`;
  const planHTML = () => '<section class="studyPlanPanel"><div class="modeEmpty"><p>Add a study guide and set an upcoming test date to plan your next sessions.</p></div><p class="hintText">Checking off a plan never adds mastery. Only saved practice performance does. Dates use the Study Room\'s test-date calendar.</p></section>';
  function cramHTML() {
    const rows = CRAM[S.cramMinutes].map(([what, minutes, why]) => `<li><div><strong>${esc(typeof what === "number" ? TOPICS[what].title : what)}</strong><p>${esc(why || (TOPICS[what].seen ? "Practiced a little. Worth another pass." : NOT_YET))}</p></div><b>${minutes} min</b></li>`).join("");
    const label = (n) => (n < 60 ? `${n} min` : `${n / 60} hour${n === 120 ? "s" : ""}`);
    return `<section class="cramSetup"><p class="setupLead">Short on time? Start with the biggest gaps.</p>
      <div class="timeChoices" role="group" aria-label="Available study time">${[15, 30, 60, 120].map((n) => `<button type="button" aria-pressed="${S.cramMinutes === n}" data-act="cramtime" data-v="${n}">${label(n)}</button>`).join("")}</div>
      <ol class="cramPreview">${rows}</ol><button class="buttonPrimary" type="button" data-act="quizstart">Start ${label(S.cramMinutes).replace(" min", "-minute").replace(" hours", "-hour").replace(" hour", "-hour")} session <span>→</span></button>
      <p class="hintText">Each step opens the actual lesson, quiz, or flashcards here. The timer guides pacing; it never submits an answer for you. Keep this page open during the session.</p></section>`;
  }
  const materialsHTML = () => `<div class="materialsPanel"><p class="setupLead">Set the file type above, then add your files.</p>
    <div class="dropzone"><strong>Drop files here</strong><small>PDF, DOCX, PPTX, TXT, Markdown, or a photo of a handout · up to 50 MB</small><button class="buttonPrimary" type="button" data-act="noop">Choose files</button></div>
    <ul class="documentList"><li class="documentRow" data-source="study_guide"><span class="documentBadge">Study guide</span><div class="documentMeta"><strong>${SOURCE}.pdf</strong><small><b class="docStatus">Ready</b>8 pages</small></div></li>
    <li class="documentRow" data-source="student_notes"><span class="documentBadge">Student notes</span><div class="documentMeta"><strong>Class notes (sample).docx</strong><small><b class="docStatus">Ready</b>3 pages</small></div></li></ul></div>`;

  function surfaceHTML() {
    switch (S.mode) {
      case "coach": return S.coachView === "chat" ? coachChatHTML() : topicsHTML();
      case "quiz": return quizHTML();
      case "cards": return cardsHTML();
      case "test": return testHTML();
      case "mastery": return masteryHTML();
      case "weak": return weakHTML();
      case "plan": return planHTML();
      case "cram": return cramHTML();
      default: return materialsHTML();
    }
  }
  function render(keepScroll) {
    const group = groupOf(S.mode), chat = S.mode === "coach" && S.coachView === "chat", top = surface.scrollTop;
    ws.dataset.tone = S.mode;
    if (chat) ws.dataset.chat = ""; else delete ws.dataset.chat;
    frame.dataset.tone = group.tone; frame.innerHTML = headHTML(group);
    chips.dataset.tone = headTone(); chips.innerHTML = chipsHTML(); chips.toggleAttribute("data-coach", S.mode === "coach");
    surface.innerHTML = surfaceHTML(); surface.scrollTop = keepScroll ? top : 0;
    tabs.innerHTML = tabsHTML(group);
    if (chat) paintThread(true);
    C().event("tone", headTone());
    C().job(screen.dataset.view === "room" && JOB_MODES.includes(S.mode));
    requestAnimationFrame(() => C().relayout());
  }
  function go(mode) { S.mode = mode; setKeyboard(false); render(); }

  /* ---------- views: onboarding, home, room ---------- */
  function setView(name) {
    setKeyboard(false);
    screen.dataset.view = name;
    if (name !== "room") C().job(false);
  }
  function applyRoom() {
    $(".workspaceTitle strong").textContent = ROOM.title;
    $(".roomDevice").dataset.tone = ROOM.tone; $(".roomGem").dataset.tone = ROOM.tone;
  }
  /** Open a Study Room. With `fly`, Studigo leaps from his stage into his window. */
  function openRoom(room, options) {
    Object.assign(ROOM, room || {}); applyRoom();
    clearInterval(typer);
    S.mode = "coach"; S.coachView = "chat"; S.chatMode = "coach";
    const stage = C().stage, fly = Boolean(options && options.fly && stage.active());
    setView("room");
    // For the leap his window is shown empty first, then he lands in it.
    if (fly) C().arrive(); else { stage.detach(); C().present(true); }
    render();
    if (fly) setTimeout(() => { C().relayout(); stage.flyTo(C().arrive(), () => C().landed()); }, 80);
  }

  /* ---------- actions ---------- */
  const ACTIONS = {
    noop() {},
    seat() { C().seatTap(); },
    home() { window.Flows.home(); },
    mode(v) { go(v); },
    chatmode(v) { S.chatMode = v; render(); },
    coachview(v) { S.coachView = v; render(); },
    topics() { S.coachView = "topics"; render(); },
    picktopic(v) { S.topic = Number(v); S.coachView = "chat"; S.chatMode = "coach"; S.coach = { i: 0, tries: 0, started: false }; S.messages = S.messages.filter((m) => m.mode !== "coach"); render(); coachTurn(`Coach me on ${TOPICS[S.topic].title}`); },
    starter(v) { if (v === "coach") coachTurn(`Coach me on ${TOPICS[S.topic].title}`); else { push({ role: "user", mode: "coach", content: "Show me an example" }); S.coach.started = true; coachSay(COACH_SET[0].example + "\n\n" + COACH_SET[0].q); } },
    command(v) { coachTurn(v); },
    learn(v) { const starter = LEARN_STARTERS.find((s) => s.id === v); learnTurn(v, starter.text); },
    quizstart() { S.mode = "quiz"; S.quiz = { index: 0, selected: null, written: "", result: null, answered: [] }; S.quizDone = null; render(); },
    // Picking an answer brings the next step (how sure are you?) up above the companion.
    choose(v) { if (S.quiz.result) return; S.quiz.selected = Number(v); const top = surface.scrollTop; repaint(quizHTML()); surface.scrollTop = top; C().steady(900); surface.scrollTo({ top: surface.scrollHeight, behavior: "smooth" }); },
    grade(v) { grade(Number(v)); },
    quiznext() {
      const quiz = S.quiz; quiz.index += 1; quiz.selected = null; quiz.written = ""; quiz.result = null;
      if (quiz.index >= QUIZ.length) { S.quizDone = quiz.answered; S.quiz = null; render(); C().event("setDone"); return; }
      render();
    },
    flip() { S.cards.flipped = !S.cards.flipped; const card = $(".flashcard", surface); card.classList.toggle("flashcardFlipped", S.cards.flipped); $(".ratingRow", surface).innerHTML = ratingHTML(S.cards.flipped); C().event("look", card); },
    rate(v) { C().event(Number(v) === 3 ? "cardGood" : Number(v) === 1 ? "cardMiss" : "look", $(".flashcard", surface)); S.cards.index += 1; S.cards.flipped = false; if (S.cards.index >= CARDS.length) S.cards.done = true; repaint(cardsHTML()); },
    cardsagain() { S.cards = { index: 0, flipped: false, done: false }; render(); },
    teststart() { S.testNote = true; render(); },
    practice() { ACTIONS.quizstart(); },
    cramtime(v) { S.cramMinutes = Number(v); render(true); }
  };

  /* ---------- a stand-in iOS keyboard (desktop only) ---------- */
  const EMBED = new URLSearchParams(location.search).has("embed");
  const TOUCH = window.matchMedia("(pointer: coarse)").matches;
  const framed = () => EMBED || !window.matchMedia("(max-width: 860px) and (pointer: coarse)").matches;
  let shift = false;
  function setKeyboard(open) {
    // Inside another page on a touch device, the real keyboard is the keyboard.
    if (!framed() || (EMBED && TOUCH)) open = false;
    if ((screen.dataset.keyboard === "open") === open) return;
    if (open) screen.dataset.keyboard = "open"; else delete screen.dataset.keyboard;
    screen.style.setProperty("--kb-h", open ? "290px" : "0px");
    C().steady(700);
    C().relayout(); setTimeout(() => C().relayout(), 180); setTimeout(() => { C().relayout(); const thread = $("#thread"); if (thread) thread.scrollTop = thread.scrollHeight; }, 340);
  }
  function buildKeyboard() {
    const row = (keys, cls) => `<div class="kRow ${cls || ""}">${keys}</div>`;
    const letters = (text) => text.split("").map((ch) => `<button type="button" class="k" data-k="${ch}" tabindex="-1">${ch}</button>`).join("");
    $("#kbd").innerHTML = row(letters("qwertyuiop")) + row(letters("asdfghjkl"), "in")
      + row(`<button type="button" class="k alt" data-k="shift" tabindex="-1" aria-label="Shift">⇧</button><span class="kGap"></span>${letters("zxcvbnm")}<span class="kGap"></span><button type="button" class="k alt" data-k="back" tabindex="-1" aria-label="Delete">⌫</button>`)
      + row('<button type="button" class="k wide" data-k="done" tabindex="-1">done</button><button type="button" class="k space" data-k=" " tabindex="-1">space</button><button type="button" class="k wide" data-k="return" tabindex="-1">return</button>');
    const kbd = $("#kbd");
    // Keys never take focus, so the field keeps its caret.
    kbd.addEventListener("pointerdown", (event) => event.preventDefault());
    kbd.addEventListener("mousedown", (event) => event.preventDefault());
    kbd.addEventListener("click", (event) => {
      const key = event.target.closest("[data-k]"), input = document.activeElement;
      if (!key || !input || input.tagName !== "INPUT") return;
      const k = key.dataset.k;
      if (k === "shift") { shift = !shift; return; }
      if (k === "done") { input.blur(); return; }
      if (k === "return") { if (input.form) input.form.requestSubmit(); else input.blur(); return; }
      const start = input.selectionStart, end = input.selectionEnd;
      if (k === "back") { if (start === end && start > 0) input.setRangeText("", start - 1, end, "end"); else input.setRangeText("", start, end, "end"); }
      else { input.setRangeText(shift || !input.value ? k.toUpperCase() : k, start, end, "end"); shift = false; }
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  /* ---------- scenarios for the panel ---------- */
  let typer = 0;
  function resetCoach() { clearInterval(typer); S.mode = "coach"; S.coachView = "chat"; S.chatMode = "coach"; S.messages = []; S.busy = false; S.coach = { i: 0, tries: 0, started: false }; }
  const SCENARIOS = {
    1() { resetCoach(); openRoom(); },
    2() {
      resetCoach(); S.coach.started = true;
      S.messages.push({ role: "user", mode: "coach", content: `Coach me on ${TOPICS[S.topic].title}` }, { role: "assistant", mode: "coach", content: "**Let's start with something you can picture.**\n\n" + COACH_SET[0].q, grounded: true });
      openRoom();
      const input = $("#chatInput"), text = "It's how well the metal conducts"; let n = 0;
      input.focus(); setKeyboard(true);
      typer = setInterval(() => { if (document.activeElement !== input || n >= text.length) { clearInterval(typer); return; } n += 1; input.value = text.slice(0, n); input.dispatchEvent(new Event("input", { bubbles: true })); }, 95);
    },
    3() { openRoom(); ACTIONS.quizstart(); setTimeout(() => { ACTIONS.choose(2); setTimeout(() => grade(2), 650); }, 500); },
    4() { openRoom(); ACTIONS.quizstart(); S.quiz.index = 1; S.quiz.answered = [{ isCorrect: true, confidence: 2 }]; render(); setTimeout(() => { ACTIONS.choose(0); setTimeout(() => grade(3), 650); }, 500); },
    5() { resetCoach(); openRoom(); setTimeout(() => C().seatTap(), 900); }
  };

  /* ---------- start ---------- */
  function fit() {
    const stage = $(".stage");
    const s = EMBED ? Math.min(window.innerHeight / 876, window.innerWidth / 417)
      : framed() ? Math.max(0.4, Math.min(1, (window.innerHeight - 40) / 876, (window.innerWidth - 32) / 417)) : 1;
    stage.style.setProperty("--s", s);
    if (!framed()) setKeyboard(false);
    requestAnimationFrame(() => window.Companion && C().relayout());
  }
  function start() {
    if (EMBED) document.body.classList.add("embed");
    screen = $("#screen"); ws = $("#workspace"); frame = $("#frame"); chips = $("#chips"); surface = $("#surface"); tabs = $("#tabs");
    buildKeyboard(); fit();
    C().init(screen);
    screen.dataset.view = "room";
    applyRoom(); render();
    window.Demo = { openRoom, setView, room: ROOM, scenarios: SCENARIOS, setKeyboard, embed: EMBED };
    // The page that embeds the phone can borrow Studigo and recolor the room.
    if (EMBED) window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "studigo:leave") event.source.postMessage({ type: "studigo:left", rect: C().leave(), id: data.id }, "*");
      if (data.type === "studigo:return") C().comeBack();
      if (data.type === "studigo:tone" && /^[a-z]+$/.test(data.tone || "")) { ROOM.tone = data.tone; applyRoom(); }
    });
    ws.addEventListener("click", (event) => {
      const target = event.target.closest("[data-act]"); if (!target || target.disabled) return;
      if (target.tagName === "A") event.preventDefault();
      ACTIONS[target.dataset.act](target.dataset.v);
    });
    ws.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = $("#chatInput"), text = input.value; if (!text.trim() || S.busy) return;
      input.value = ""; $(".chatSend").disabled = true;
      if (S.chatMode === "learn") learnTurn("free", text); else coachTurn(text);
    });
    screen.addEventListener("input", (event) => {
      const input = event.target;
      if (input.type === "checkbox") return;
      if (input.id === "chatInput") $(".chatSend").disabled = !input.value.trim();
      if (input.id === "blankInput") {
        S.quiz.written = input.value; const slot = $("#blankSlot"), filled = input.value.trim();
        slot.textContent = filled || "?"; slot.classList.toggle("inlineBlankFilled", Boolean(filled));
        $("#sureLabel").textContent = filled ? "HOW SURE ARE YOU?" : "ANSWER TO CONTINUE";
        surface.querySelectorAll(".confidenceButton").forEach((button) => { button.disabled = !filled; });
      }
      C().typing(input);
    });
    screen.addEventListener("focusin", (event) => { if (event.target.tagName === "INPUT" && event.target.type !== "checkbox") { setKeyboard(true); setTimeout(() => C().typing(event.target), 360); } });
    screen.addEventListener("focusout", (event) => { if (event.target.tagName === "INPUT") setTimeout(() => { if (!document.activeElement || document.activeElement.tagName !== "INPUT") setKeyboard(false); }, 60); });

    // The scripted typing in scenario 2 stops the moment you type for yourself.
    document.addEventListener("keydown", (event) => { if (event.isTrusted) clearInterval(typer); });
    $("#kbd").addEventListener("pointerdown", () => clearInterval(typer));
    document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => SCENARIOS[button.dataset.scenario]()));
    document.querySelectorAll("[data-flow]").forEach((button) => button.addEventListener("click", () => window.Flows[button.dataset.flow]()));
    document.querySelectorAll("[data-demo]").forEach((button) => button.addEventListener("click", () => C().demo(button.dataset.demo)));
    C().onChange((state) => {
      const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
      set("roMood", state.mood);
      set("roWhere", state.where);
      set("roTalk", state.quiet ? "Quiet mode" : state.chatty >= 0.75 ? "Speaks up" : state.chatty >= 0.45 ? "Now and then" : "Rarely");
    });
    window.addEventListener("resize", fit);
    window.addEventListener("load", fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => C().relayout());
    window.Flows.start();
    if (EMBED && window.parent !== window) window.parent.postMessage({ type: "studigo:ready" }, "*");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
