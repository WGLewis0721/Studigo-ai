/* Home and onboarding. These are the two places Studigo is seen full body:
   he stands on his stage, reacts to what you do, and when a room opens he leaps
   from the stage into his window. Sample content throughout. */
(function () {
  "use strict";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const C = () => window.Companion, D = () => window.Demo;
  const DONE_KEY = "studigo.demo.onboarded.v1";

  /* Room colors, as in apps/web/lib/room-theme.ts. */
  const THEMES = [["blueberry", "Blueberry"], ["tangerine", "Tangerine"], ["grape", "Grape"], ["berry", "Berry"], ["kiwi", "Kiwi"], ["dandelion", "Dandelion"], ["teal", "Teal"], ["indigo", "Indigo"], ["graphite", "Graphite"]];
  const ROOMS = [
    { title: "Science", tone: "teal", meta: "SCIENCE · PERIOD 3", sources: 2, test: "Oct 7", days: 6, next: "Electricity and Simple Circuits", open: true },
    { title: "World History", tone: "grape", meta: "HISTORY", sources: 3, test: "Oct 13", days: 12 },
    { title: "Algebra II", tone: "blueberry", meta: "MATH", sources: 1, test: null, days: null }
  ];
  const STEPS = 5;
  // Embedded in the homepage there is no sign-in step: "New room" starts at the room name.
  const firstStep = () => (D().embed ? 2 : 1);
  let screen, homeEl, obEl, ob = null, scrollTimer = 0;

  /* ---------- Home ---------- */
  function roomCard(room, index) {
    const sources = `${room.sources} ${room.sources === 1 ? "source" : "sources"}`;
    return `<button type="button" class="roomCard" data-tone="${room.tone}" data-open="${index}"><span class="roomCardMeta">${esc(room.meta)}</span><strong>${esc(room.title)}</strong>
      <span class="roomCardFooter"><span>${sources}</span>${room.days != null ? `<b>${room.days} days to ${room.test}</b>` : ""}</span></button>`;
  }
  function homeHTML() {
    const first = ROOMS[0], hour = new Date().getHours();
    const hello = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
    return `<header class="homeTop"><b class="wordmarkText">Studigo</b><span class="profileChip" aria-label="Signed in"><span>ME</span></span></header>
      <div class="homeScroll" id="homeScroll">
        <section class="stageScreen homeStage" data-tone="${first.tone}" aria-label="Studigo">
          <div class="homeSay" id="homeSay"><span class="tinyLabel">${hello}</span><p><b>${esc(first.title)} is up next.</b>${first.days != null ? `Your test is in ${first.days} days.` : "Add a test date when you know it."}</p></div>
          <div class="stgAnchor" id="homeAnchor"></div>
          <div class="stageSill" aria-hidden="true"><span class="railLed"></span><span class="railBrand">studigo</span></div>
        </section>
        <section class="nextUp" data-tone="${first.tone}"><span class="tinyLabel">NEXT UP · ${esc(first.title.toUpperCase())}</span><h2>${esc(first.next || "Add your study guide")}</h2>
          <p>${first.next ? "Not practiced yet. About 6 minutes." : "Studigo teaches only from what you add."}</p><button class="buttonPrimary" type="button" data-open="0">Continue <span aria-hidden="true">→</span></button></section>
        <div class="homeHead"><span class="tinyLabel">YOUR STUDY ROOMS</span></div>
        <div class="roomsGrid">${ROOMS.map(roomCard).join("")}<button type="button" class="roomNew" data-new><i aria-hidden="true">+</i>New room</button></div>
      </div>`;
  }
  function say(html) { const node = $("#homeSay p"); if (!node) return; node.innerHTML = html; const box = $("#homeSay"); box.style.animation = "none"; void box.offsetWidth; box.style.animation = ""; }
  function home() {
    D().setView("home");
    homeEl.innerHTML = homeHTML();
    const stage = C().stage;
    stage.onTouch = null; stage.hold("center");
    stage.attach($("#homeAnchor"), "wave"); stage.react("wave", 1500);
    $("#homeScroll").addEventListener("scroll", () => {
      // He stays on his stage as the page scrolls under the finger.
      stage.node.classList.add("noMove"); stage.sync();
      clearTimeout(scrollTimer); scrollTimer = setTimeout(() => stage.node.classList.remove("noMove"), 140);
    }, { passive: true });
  }
  function open(index) {
    const room = ROOMS[index];
    if (!room.open) { C().stage.react("read", 1400); say(`<b>Only ${esc(ROOMS[0].title)} is set up.</b>The other rooms are placeholders in this demo.`); return; }
    D().openRoom({ title: room.title, tone: room.tone, test: room.test || "not set" }, { fly: true });
  }

  /* ---------- onboarding ---------- */
  const APPLE = '<svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true"><path fill="currentColor" d="M13.6 10.6c0-2.3 1.900-3.400 2-3.500-1.100-1.600-2.800-1.800-3.400-1.800-1.400-.100-2.800.800-3.500.800-.700 0-1.900-.800-3.100-.800C4 5.300 2.500 6.200 1.700 7.600c-1.700 2.900-.400 7.200 1.200 9.600.800 1.200 1.800 2.500 3 2.400 1.200 0 1.700-.800 3.100-.800 1.400 0 1.900.800 3.100.700 1.300 0 2.100-1.200 2.900-2.300.900-1.300 1.300-2.600 1.300-2.700 0 0-2.600-1-2.700-3.900ZM11.300 3.700c.600-.800 1.100-1.900 1-3-.900 0-2.100.600-2.700 1.400-.600.700-1.100 1.800-1 2.800 1 .100 2.100-.500 2.700-1.200Z"/></svg>';
  const GOOGLE = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.640 9.200c0-.640-.060-1.250-.160-1.840H9v3.480h4.840a4.140 4.140 0 0 1-1.800 2.720v2.260h2.920c1.700-1.570 2.680-3.880 2.680-6.620Z"/><path fill="#34A853" d="M9 18c2.430 0 4.470-.800 5.960-2.180l-2.920-2.260c-.800.540-1.840.860-3.040.860-2.340 0-4.330-1.580-5.040-3.710H.960v2.330A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.960 10.710A5.410 5.410 0 0 1 3.680 9c0-.590.100-1.170.280-1.710V4.960H.960A9 9 0 0 0 0 9c0 1.450.350 2.830.960 4.040l3-2.330Z"/><path fill="#EA4335" d="M9 3.580c1.320 0 2.510.450 3.440 1.350l2.580-2.590C13.460.890 11.430 0 9 0A9 9 0 0 0 .960 4.960l3 2.330C4.670 5.160 6.660 3.580 9 3.580Z"/></svg>';

  function stepView() {
    const name = ob.name.trim();
    switch (ob.step) {
      case 1: return {
        pose: "wave",
        body: `<h1>Hi, I'm Studigo.</h1><p class="obLede">I study with you, using your own class materials.</p>
          <div class="obProviders"><button type="button" class="appleButton" data-next>${APPLE}Continue with Apple</button><button type="button" class="googleButton" data-next>${GOOGLE}Continue with Google</button><button type="button" class="obQuiet" data-next>Use email instead</button></div>
          <small class="hintText obNote">Demo: sign-in is skipped.</small>`
      };
      case 2: return {
        pose: "center",
        body: `<h1>What's your next test?</h1><p class="obLede">Each Study Room holds one test's worth of material.</p>
          <label class="field"><span>Room name</span><input id="obName" maxlength="40" placeholder="Biology Midterm" autocomplete="off" enterkeyhint="next" value="${esc(ob.name)}"></label>
          <div class="obChips"><span class="tinyLabel">TEST DATE, IF YOU KNOW IT</span><div role="group" aria-label="Test date">${["This week", "Next week", "Not sure yet"].map((label) => `<button type="button" aria-pressed="${ob.date === label}" data-date="${label}">${label}</button>`).join("")}</div></div>`,
        foot: `<button class="buttonPrimary" type="button" data-next ${name ? "" : "disabled"}>Next <span aria-hidden="true">→</span></button>`
      };
      case 3: return {
        pose: "center",
        body: `<h1>Pick a color for this room.</h1><p class="obLede">It tints the whole room, so you always know where you are.</p>
          <div class="cdSwatches" role="radiogroup" aria-label="Room color">${THEMES.map(([id, label]) => `<button type="button" role="radio" class="cdSwatch" data-tone="${id}" data-theme="${id}" aria-checked="${ob.tone === id}">${label}</button>`).join("")}</div>
          <div class="roomCard obPreview" data-tone="${ob.tone}" id="obPreview"><span class="roomCardMeta">YOUR FIRST ROOM</span><strong>${esc(name || "Science")}</strong></div>`,
        foot: '<button class="buttonPrimary" type="button" data-next>Next <span aria-hidden="true">→</span></button>'
      };
      case 4: return {
        pose: ob.file === "reading" ? "read" : "center", skip: true,
        body: `<h1>Add your study guide.</h1><p class="obLede">I only teach from what you give me, and I show the page each answer came from.</p>
          ${ob.file ? `<ul class="uploadQueue"><li class="queueItem ${ob.file === "ready" ? "queue-done" : ""}"><span class="queueSpinner" aria-hidden="true"></span><strong>Science study guide (sample).pdf</strong><small>${ob.file === "ready" ? "Ready · 8 pages" : "Studigo is reading it…"}</small></li></ul>`
            : '<div class="dropzone obDrop"><strong>Drop files here</strong><small>PDF, DOCX, PPTX, TXT, or a photo of a handout</small><button class="buttonPrimary" type="button" data-file>Choose files</button></div>'}`,
        foot: `<button class="buttonPrimary" type="button" data-next ${ob.file === "reading" ? "disabled" : ""}>${ob.file ? "Next" : "Add it later"} <span aria-hidden="true">→</span></button>`
      };
      default: return {
        pose: "center",
        body: `<h1>I'll keep you company.</h1><p class="obLede">Try it now. I react to you.</p>
          <ul class="obTry"><li ${ob.did.poke ? "data-done" : ""} data-try="poke"><i aria-hidden="true">✓</i><div><b>Tap me</b><span>I'm ticklish.</span></div></li>
          <li ${ob.did.pet ? "data-done" : ""} data-try="pet"><i aria-hidden="true">✓</i><div><b>Pet me</b><span>Press and slide across me.</span></div></li></ul>
          <p class="hintText">While you study I sit in a corner of the room. Drag me to another corner, or send me back to my seat.</p>`,
        foot: '<button class="buttonPrimary" type="button" data-finish>Start studying <span aria-hidden="true">→</span></button>'
      };
    }
  }
  function paintStep(still) {
    const view = stepView();
    obEl.dataset.tone = ob.tone;
    $("#obBody").innerHTML = `<div class="obStep${still ? " still" : ""}">${view.body}</div>`;
    $("#obFoot").innerHTML = view.foot || "";
    $("#obBack").hidden = ob.step === 1;
    $("#obBack").setAttribute("aria-label", ob.step === firstStep() ? "Back to your rooms" : "Back");
    $("#obSkip").hidden = !view.skip;
    $("#obDots").innerHTML = Array.from({ length: STEPS }, (_, index) => `<i ${index + 1 === ob.step ? "data-on" : index + 1 < ob.step ? "data-past" : ""}></i>`).join("");
    const stage = C().stage;
    stage.hold(view.pose);
    stage.onTouch = ob.step === 5 ? (kind) => { ob.did[kind] = true; const row = $(`[data-try="${kind}"]`); if (row) row.dataset.done = ""; } : null;
  }
  function toStep(step) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    D().setKeyboard(false);
    ob.step = Math.max(firstStep(), Math.min(STEPS, step));
    paintStep();
  }
  function finish() {
    const title = ob.name.trim() || "Science";
    try { localStorage.setItem(DONE_KEY, "1"); } catch (error) { /* storage is optional */ }
    Object.assign(ROOMS[0], { title, tone: ob.tone, meta: "YOUR FIRST ROOM", sources: ob.file === "ready" ? 1 : 0, next: ob.file === "ready" ? ROOMS[0].next || "Electricity and Simple Circuits" : null, open: true });
    if (ob.date === "Not sure yet" || !ob.date) Object.assign(ROOMS[0], { days: null, test: null });
    else Object.assign(ROOMS[0], ob.date === "This week" ? { days: 4, test: "Oct 5" } : { days: 9, test: "Oct 10" });
    D().openRoom({ title, tone: ob.tone, test: ROOMS[0].test || "not set" }, { fly: true });
  }
  function onboarding() {
    ob = { step: 1, name: "", date: "", tone: "teal", file: "", did: { poke: false, pet: false } };
    D().setView("onboarding");
    paintStep();
    const stage = C().stage;
    stage.attach($("#obAnchor"), "wave");
  }

  function start() {
    screen = $("#screen"); homeEl = $("#homeView"); obEl = $("#obView");
    obEl.innerHTML = `<header class="obBar"><button class="obBack" id="obBack" type="button" aria-label="Back"><span aria-hidden="true">‹</span></button><div class="obDots" id="obDots" aria-hidden="true"></div><button class="obSkip" id="obSkip" type="button">Skip</button></header>
      <section class="stageScreen obStage" aria-label="Studigo"><div class="stgAnchor" id="obAnchor"></div><div class="stageSill" aria-hidden="true"><span class="railLed"></span><span class="railBrand">studigo</span></div></section>
      <div class="obBody" id="obBody"></div><footer class="obFoot" id="obFoot"></footer>`;

    homeEl.addEventListener("click", (event) => {
      const card = event.target.closest("[data-open]");
      if (card) open(Number(card.dataset.open));
      if (event.target.closest("[data-new]")) { onboarding(); toStep(2); }
    });
    obEl.addEventListener("click", (event) => {
      const hit = (selector) => event.target.closest(selector);
      if (hit("#obBack")) { if (D().embed && ob.step === firstStep()) home(); else toStep(ob.step - 1); }
      else if (hit("#obSkip") || hit("[data-next]")) { if (!(hit("[data-next]") || {}).disabled) toStep(ob.step + 1); }
      else if (hit("[data-finish]")) finish();
      else if (hit("[data-date]")) { ob.date = hit("[data-date]").dataset.date; obEl.querySelectorAll("[data-date]").forEach((button) => button.setAttribute("aria-pressed", button.dataset.date === ob.date)); }
      else if (hit("[data-theme]")) {
        ob.tone = hit("[data-theme]").dataset.theme; obEl.dataset.tone = ob.tone;
        obEl.querySelectorAll("[data-theme]").forEach((button) => button.setAttribute("aria-checked", button.dataset.theme === ob.tone));
        $("#obPreview").dataset.tone = ob.tone;
        C().stage.pose = ""; C().stage.react("celebrate", 800);
      } else if (hit("[data-file]")) {
        ob.file = "reading"; paintStep(true);
        setTimeout(() => { if (!ob || ob.file !== "reading") return; ob.file = "ready"; if (ob.step === 4) { paintStep(true); C().stage.pose = ""; C().stage.react("celebrate", 900); } }, 1900);
      }
    });
    obEl.addEventListener("input", (event) => {
      if (event.target.id !== "obName") return;
      ob.name = event.target.value;
      const next = $("#obFoot [data-next]"); if (next) next.disabled = !ob.name.trim();
    });
    obEl.addEventListener("submit", (event) => event.preventDefault());
    obEl.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.id === "obName" && ob.name.trim()) toStep(3); });

    let done = false;
    try { done = localStorage.getItem(DONE_KEY) === "1"; } catch (error) { /* storage is optional */ }
    // Embedded in the homepage: go straight to the Study Room.
    if (D().embed) D().openRoom(); else if (done) home(); else onboarding();
  }

  window.Flows = { start, home, onboarding };
})();
