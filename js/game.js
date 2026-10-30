(() => {
  const TARGET = "BEAM";
  const pack = window.BEAM_PACK;
  if (!pack || !Array.isArray(pack.words)) {
    document.body.textContent = "Word list failed to load.";
    return;
  }

  const dict = new Set(pack.words);
  const localWords = new Set(pack.local);
  const parent = new Map();
  const distance = new Map([[TARGET, 0]]);

  function neighbors(word) {
    const found = [];
    const chars = word.split("");
    for (let i = 0; i < 4; i += 1) {
      const orig = chars[i];
      for (let code = 65; code <= 90; code += 1) {
        const ch = String.fromCharCode(code);
        if (ch === orig) continue;
        chars[i] = ch;
        const next = chars.join("");
        if (dict.has(next)) found.push(next);
      }
      chars[i] = orig;
    }
    return found;
  }

  const queue = [TARGET];
  let qi = 0;
  while (qi < queue.length) {
    const word = queue[qi];
    qi += 1;
    const step = distance.get(word) + 1;
    for (const next of neighbors(word)) {
      if (distance.has(next)) continue;
      distance.set(next, step);
      parent.set(next, word);
      queue.push(next);
    }
  }

  // Added after the daily deck was fixed, so they can be played without
  // moving the puzzle that is already out.
  const addedLater = new Set(["BAWL", "CHUP", "SUSU", "BEBE"]);
  const ladderWords = [...distance.keys()].filter((word) => {
    const steps = distance.get(word);
    return steps >= 4 && steps <= 8 && !addedLater.has(word);
  }).sort();

  // Shared offline seed. Every client with the same words.js + this seed
  // walks the same daily sequence. No server, no network word of the day.
  const DAILY_SEED = "BEAM-TT-DAILY-v1";

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seedText) {
    const out = items.slice();
    const rand = mulberry32(hashString(seedText));
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  const dailySequence = seededShuffle(ladderWords, DAILY_SEED);

  // Published puzzle starts stay put when the deck is reshuffled later.
  const FIXED_STARTS = {
    "2026-10-29": "BUOY",
  };

  function trinidadIso(date = new Date()) {
    const shifted = new Date(date.getTime() - 4 * 60 * 60 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const d = String(shifted.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(iso, delta) {
    const [y, m, d] = iso.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d) + delta * 86400000);
    const yy = next.getUTCFullYear();
    const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(next.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function puzzleNumber(iso) {
    const toUtc = (value) => {
      const [y, m, d] = value.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((toUtc(iso) - toUtc("2026-01-01")) / 86400000) + 1;
  }

  function startFor(iso) {
    if (FIXED_STARTS[iso]) return FIXED_STARTS[iso];
    if (!dailySequence.length) return TARGET;
    const index = (puzzleNumber(iso) - 1) % dailySequence.length;
    return dailySequence[index];
  }

  function pathFrom(start) {
    const path = [start];
    let cur = start;
    const seen = new Set([start]);
    while (cur !== TARGET) {
      cur = parent.get(cur);
      if (!cur || seen.has(cur)) return null;
      seen.add(cur);
      path.push(cur);
    }
    return path;
  }

  function diffCount(a, b) {
    let n = 0;
    for (let i = 0; i < 4; i += 1) if (a[i] !== b[i]) n += 1;
    return n;
  }

  const STATS_KEY = "beam-stats-v1";
  const DAILY_KEY = "beam-daily-v1";
  const HELP_KEY = "beam-help-seen";
  const PRACTICE_KEY = "beam-practice-v1";

  function readJson(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      /* Private mode can block storage. The puzzle still plays. */
    }
  }

  function emptyStats() {
    return {
      wins: 0,
      totalExtra: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastWin: null,
      dist: [0, 0, 0, 0, 0, 0, 0],
    };
  }

  const stats = Object.assign(emptyStats(), readJson(localStorage, STATS_KEY, {}));
  if (!Array.isArray(stats.dist) || stats.dist.length !== 7) stats.dist = emptyStats().dist;

  const today = trinidadIso();
  const todayStart = startFor(today);
  const todayPar = distance.get(todayStart);

  function freshDaily() {
    return { iso: today, start: todayStart, entries: [], won: false, extra: null, par: todayPar };
  }

  function chainOk(start, entries) {
    let prev = start;
    for (const word of entries) {
      if (!dict.has(word) || diffCount(prev, word) !== 1) return false;
      prev = word;
    }
    return true;
  }

  let daily = readJson(localStorage, DAILY_KEY, null);
  if (!daily || daily.iso !== today || daily.start !== todayStart || !chainOk(daily.start, daily.entries || [])) {
    daily = freshDaily();
  }

  let practice = readJson(sessionStorage, PRACTICE_KEY, null);
  if (practice && !chainOk(practice.start, practice.entries || [])) practice = null;

  let mode = "daily";
  let typed = "";
  let toastTimer = 0;
  const seenLocal = new Set();

  const meta = document.getElementById("meta");
  const board = document.getElementById("board");
  const toast = document.getElementById("toast");
  const keyboard = document.getElementById("keyboard");
  const modal = document.getElementById("modal");
  const modeBtn = document.getElementById("mode");
  const newPracticeBtn = document.getElementById("new-practice");
  const shareBtn = document.getElementById("share");

  function current() {
    return mode === "daily" ? daily : practice;
  }

  function shownStreak() {
    if (!stats.lastWin) return 0;
    if (stats.lastWin === today || stats.lastWin === addDays(today, -1)) return stats.currentStreak;
    return 0;
  }

  function setToast(message, kind) {
    toast.textContent = message;
    toast.className = kind === "good" ? "toast good" : "toast";
    window.clearTimeout(toastTimer);
    if (message) toastTimer = window.setTimeout(() => { toast.textContent = ""; }, 1400);
  }

  function tile(letter, home, pop) {
    const el = document.createElement("div");
    el.className = "tile" + (home ? " home" : "") + (pop ? " pop" : "");
    el.textContent = letter || "";
    return el;
  }

  function row(word, className) {
    const el = document.createElement("div");
    el.className = "row" + (className ? " " + className : "");
    for (let i = 0; i < 4; i += 1) {
      const letter = word[i] || "";
      el.append(tile(letter, Boolean(letter) && letter === TARGET[i]));
    }
    return el;
  }

  function render() {
    const game = current();
    const playing = game && !game.won;
    if (mode === "daily") {
      meta.textContent = `#${puzzleNumber(today)}: ${daily.start}`;
    } else {
      meta.textContent = `Practice: ${practice.start}`;
    }
    modeBtn.textContent = mode === "daily" ? "Practice" : "Daily";
    newPracticeBtn.hidden = mode !== "practice";
    shareBtn.hidden = !game.won;

    board.replaceChildren();
    [game.start, ...game.entries].forEach((word) => board.append(row(word)));
    if (playing) {
      const entry = row(typed.padEnd(4, " "));
      entry.dataset.entry = "true";
      board.append(entry);
    }
    keyboard.querySelectorAll(".key").forEach((key) => {
      key.disabled = !playing;
    });
    if (board.lastElementChild) {
      board.lastElementChild.scrollIntoView({ block: "nearest" });
    }
  }

  function shakeEntry() {
    const entry = board.querySelector("[data-entry]");
    if (!entry) return;
    entry.classList.remove("shake");
    void entry.offsetWidth;
    entry.classList.add("shake");
  }

  function saveStats() {
    writeJson(localStorage, STATS_KEY, stats);
  }

  function saveGame() {
    if (mode === "daily") writeJson(localStorage, DAILY_KEY, daily);
    else writeJson(sessionStorage, PRACTICE_KEY, practice);
  }

  function recordWin(extra) {
    if (stats.lastWin === today) return;
    if (stats.lastWin === addDays(today, -1)) stats.currentStreak += 1;
    else stats.currentStreak = 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    stats.wins += 1;
    stats.totalExtra += extra;
    stats.dist[Math.min(extra, 6)] += 1;
    stats.lastWin = today;
    saveStats();
  }

  function shareBody(game, label) {
    const lines = game.entries.map((word) => [...word].map((ch, i) => (ch === TARGET[i] ? "🟨" : "⬛")).join(""));
    const score = game.extra === 0 ? "Par" : `${game.extra} extra`;
    return `Beam ${label}\n${lines.join("\n")}\n${score}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied", "good");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      modal.querySelector(".modal").append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      setToast("Copied", "good");
    }
  }

  function closeModal() {
    modal.hidden = true;
    modal.replaceChildren();
  }

  function openModal(build) {
    modal.replaceChildren();
    const card = document.createElement("div");
    card.className = "modal";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "✕";
    close.addEventListener("click", closeModal);
    card.append(close);
    build(card);
    modal.append(card);
    modal.hidden = false;
    close.focus();
  }

  function wordRow(word) {
    return row(word);
  }

  function showHelp() {
    writeJson(localStorage, HELP_KEY, true);
    openModal((card) => {
      const title = document.createElement("h2");
      title.textContent = "How to play Beam";
      const lead = document.createElement("p");
      lead.className = "lead";
      lead.textContent = "A daily word ladder from Trinidad and Tobago. Runs fully in your browser. The same offline seed picks today's start for everyone at midnight, Trinidad time.";
      const goal = document.createElement("p");
      const goalStrong = document.createElement("strong");
      goalStrong.textContent = "Get to BEAM in as few steps as you can.";
      goal.append(goalStrong);
      const rule = document.createElement("p");
      rule.textContent = "Each word changes exactly one letter from the word above it.";
      const demo = document.createElement("div");
      demo.className = "example";
      demo.append(wordRow("LIME"), wordRow("LINE"));
      const local = document.createElement("p");
      local.textContent = "Every step is 4 letters, same as BEAM. Regular English words count. Trini talk counts too — slang, food, places, brands, and acronyms. Obscure is allowed. Word, love, time, and home fit. So do maco, susu, fete, roti, soca, aloo, cyah, and chup. Doubles, pelau, tabanca, and callaloo are real, and they are longer than a step.";
      const gold = document.createElement("p");
      gold.className = "gold-note";
      gold.textContent = "Gold means that letter is already home in BEAM.";
      const goldDemo = document.createElement("div");
      goldDemo.className = "example";
      goldDemo.append(wordRow("BEAN"));
      const score = document.createElement("p");
      score.textContent = "There is no limit on steps. Par is the shortest path in this word list. Extra guesses are the steps you took past par.";
      const note = document.createElement("p");
      note.className = "fine";
      note.textContent = "Not affiliated with Poople.";
      const actions = document.createElement("div");
      actions.className = "actions";
      const play = document.createElement("button");
      play.type = "button";
      play.className = "text-action";
      play.textContent = "Click here to play!";
      play.addEventListener("click", () => {
        writeJson(localStorage, HELP_KEY, true);
        closeModal();
      });
      actions.append(play);
      card.append(title, lead, goal, rule, demo, local, gold, goldDemo, score, note, actions);
    });
  }

  function showStats() {
    openModal((card) => {
      const title = document.createElement("h2");
      title.textContent = "Stats";
      const grid = document.createElement("div");
      grid.className = "stat-grid";
      const avg = stats.wins ? (stats.totalExtra / stats.wins).toFixed(2) : "0.00";
      const items = [
        [String(stats.wins), "Wins"],
        [avg, "Avg. extra"],
        [String(shownStreak()), "Current streak"],
        [String(stats.bestStreak), "Best streak"],
      ];
      items.forEach(([value, label]) => {
        const cell = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = value;
        const span = document.createElement("span");
        span.textContent = label;
        cell.append(strong, span);
        grid.append(cell);
      });
      const heading = document.createElement("p");
      heading.textContent = "Extra guesses";
      const dist = document.createElement("div");
      dist.className = "dist";
      const max = Math.max(1, ...stats.dist);
      const todayExtra = daily.won ? Math.min(daily.extra, 6) : -1;
      stats.dist.forEach((count, index) => {
        const line = document.createElement("div");
        line.className = "dist-row";
        const name = document.createElement("span");
        name.textContent = index === 6 ? "6+" : String(index);
        const bar = document.createElement("div");
        bar.className = "bar" + (index === todayExtra ? " today" : "");
        const fill = document.createElement("span");
        fill.style.width = `${(count / max) * 100}%`;
        bar.append(fill);
        const num = document.createElement("span");
        num.textContent = String(count);
        line.append(name, bar, num);
        dist.append(line);
      });
      const note = document.createElement("p");
      note.className = "fine";
      note.textContent = "Daily only. Miss a day and the streak starts over. Practice does not count.";
      card.append(title, grid, heading, dist, note);
    });
  }

  function showYesterday() {
    const iso = addDays(today, -1);
    const number = puzzleNumber(iso);
    const start = startFor(iso);
    const path = pathFrom(start);
    openModal((card) => {
      const title = document.createElement("h2");
      title.textContent = `Beam #${number}: ${start}`;
      const body = document.createElement("p");
      if (!path) {
        body.textContent = "Yesterday's word has no path in this list.";
      } else {
        const steps = path.length - 1;
        body.textContent = steps === 1
          ? "The shortest path yesterday was 1 step."
          : `The shortest path yesterday was ${steps} steps. One way there:`;
      }
      card.append(title, body);
      if (path) {
        const wrap = document.createElement("div");
        wrap.className = "path";
        path.forEach((word) => wrap.append(wordRow(word)));
        card.append(wrap);
      }
    });
  }

  function showWin(game) {
    const label = mode === "daily" ? `#${puzzleNumber(today)}` : "practice";
    openModal((card) => {
      const title = document.createElement("h2");
      title.textContent = mode === "daily" ? `Beam #${puzzleNumber(today)}` : "Practice";
      const body = document.createElement("p");
      body.style.textAlign = "center";
      if (game.extra === 0) {
        body.textContent = `You matched par. ${game.par} ${game.par === 1 ? "step" : "steps"}.`;
      } else {
        body.textContent = `Par was ${game.par}. You took ${game.entries.length}. That's ${game.extra} extra.`;
      }
      const streak = document.createElement("p");
      streak.className = "fine";
      streak.textContent = mode === "daily"
        ? `Streak: ${shownStreak()}`
        : "Practice stays off your streak.";
      const actions = document.createElement("div");
      actions.className = "actions";
      const share = document.createElement("button");
      share.type = "button";
      share.className = "primary";
      share.textContent = "Share";
      share.addEventListener("click", () => copyText(shareBody(game, label)));
      const statsBtn = document.createElement("button");
      statsBtn.type = "button";
      statsBtn.className = "text-action";
      statsBtn.textContent = "Stats";
      statsBtn.addEventListener("click", showStats);
      actions.append(share, statsBtn);
      card.append(title, body, streak, actions);
    });
  }

  function submit() {
    const game = current();
    if (!game || game.won) return;
    if (typed.length !== 4) {
      shakeEntry();
      setToast("4 letters");
      return;
    }
    const prev = game.entries.length ? game.entries[game.entries.length - 1] : game.start;
    if (!dict.has(typed)) {
      shakeEntry();
      setToast("Not in word list");
      return;
    }
    if (diffCount(prev, typed) !== 1) {
      shakeEntry();
      setToast("Change exactly one letter");
      return;
    }
    game.entries.push(typed);
    const just = typed;
    typed = "";
    if (localWords.has(just) && !seenLocal.has(just)) {
      seenLocal.add(just);
      setToast("Trini word", "good");
    } else {
      setToast("");
    }
    if (just === TARGET) {
      game.won = true;
      game.par = distance.get(game.start);
      game.extra = game.entries.length - game.par;
      saveGame();
      render();
      if (mode === "daily") recordWin(game.extra);
      showWin(game);
      return;
    }
    saveGame();
    render();
  }

  function typeLetter(letter) {
    const game = current();
    if (!game || game.won || typed.length >= 4) return;
    typed += letter;
    render();
  }

  function backspace() {
    const game = current();
    if (!game || game.won || !typed) return;
    typed = typed.slice(0, -1);
    render();
  }

  function makePractice() {
    const pool = ladderWords.filter((word) => word !== todayStart);
    const start = pool[Math.floor(Math.random() * pool.length)] || ladderWords[0];
    practice = { start, entries: [], won: false, extra: null, par: distance.get(start) };
    typed = "";
    saveGame();
  }

  function buildKeyboard() {
    const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
    rows.forEach((letters, index) => {
      const line = document.createElement("div");
      line.className = "kb-row";
      if (index === 2) {
        const enter = document.createElement("button");
        enter.type = "button";
        enter.className = "key wide";
        enter.textContent = "Enter";
        enter.dataset.key = "ENTER";
        line.append(enter);
      }
      [...letters].forEach((letter) => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "key";
        key.textContent = letter;
        key.dataset.key = letter;
        line.append(key);
      });
      if (index === 2) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "key wide";
        back.textContent = "⌫";
        back.dataset.key = "BACK";
        back.setAttribute("aria-label", "Backspace");
        line.append(back);
      }
      keyboard.append(line);
    });
    keyboard.addEventListener("click", (event) => {
      const key = event.target.closest(".key");
      if (!key || key.disabled) return;
      if (key.dataset.key === "ENTER") submit();
      else if (key.dataset.key === "BACK") backspace();
      else typeLetter(key.dataset.key);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!modal.hidden) {
      if (event.key === "Escape") closeModal();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      backspace();
    } else if (/^[a-zA-Z]$/.test(event.key)) {
      typeLetter(event.key.toUpperCase());
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.getElementById("help").addEventListener("click", showHelp);
  document.getElementById("stats").addEventListener("click", showStats);
  document.getElementById("yesterday").addEventListener("click", showYesterday);
  modeBtn.addEventListener("click", () => {
    if (mode === "daily") {
      mode = "practice";
      if (!practice) makePractice();
    } else {
      mode = "daily";
    }
    typed = "";
    setToast("");
    render();
  });
  newPracticeBtn.addEventListener("click", () => {
    mode = "practice";
    makePractice();
    setToast("");
    render();
  });
  shareBtn.addEventListener("click", () => {
    const game = current();
    if (!game || !game.won) return;
    const label = mode === "daily" ? `#${puzzleNumber(today)}` : "practice";
    copyText(shareBody(game, label));
  });

  buildKeyboard();

  if (
    document.documentElement.dataset.launchMode === "practice" ||
    new URLSearchParams(location.search).get("mode") === "practice"
  ) {
    mode = "practice";
    if (!practice) makePractice();
  }

  render();
  if (!readJson(localStorage, HELP_KEY, false)) showHelp();
})();
