// Dream Journal: turns your real day into the dream you have that night.
// Everything is saved in this browser only (localStorage). Your Mac and your
// iPhone each keep their own journal; use Settings → Export / Import to move it.


// ===== Storage =====
// Small helpers for the browser's own storage, so things are remembered next time.
function loadSaved(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

// Save something. Returns false if the browser refused (private browsing, or storage full).
function save(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    return true;
  } catch {
    alert("This browser couldn't save your journal (storage may be full, or this is a private window). Export a backup in Settings so nothing is lost.");
    return false;
  }
}

// A short random id for new entries, people and threads
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}


// ===== The journal's data =====
const MOODS = ["tired", "anxious", "sad", "content", "happy", "restless", "grateful"];
const MOOD_EMOJI = { tired: "😴", anxious: "😟", sad: "😢", content: "🙂", happy: "😊", restless: "🌀", grateful: "🙏" };
const TONES = ["peaceful", "mystical", "eerie"];
const TONE_LABEL = { peaceful: "Peaceful", mystical: "Mystical", eerie: "Gently eerie" };
const LENGTHS = ["short", "medium", "long"];
const LENGTH_LABEL = { short: "Short · 1 min", medium: "Medium · 3 min", long: "Long · 5 min" };
const MODES = ["tonight", "morning"];
const MODE_LABEL = { tonight: "Tonight's dream", morning: "Morning dream" };
const EXTRA_PROMPTS = [
  { key: "good", label: "One good thing" },
  { key: "bothered", label: "One thing that bothered me" },
  { key: "noticed", label: "Something I noticed" },
  { key: "ate", label: "What I ate" },
  { key: "body", label: "How my body feels" },
];

const DEFAULT_SETTINGS = {
  literalness: 50,        // 0 = close to real life, 100 = fully dreamlike
  hardTopics: "reflect",  // "reflect" gently, or "soften" heavily
  defaultTone: "peaceful",
  defaultLength: "medium",
  defaultMode: "tonight",
  wakingThought: true,
  dailyLimit: 20,
};

// An entry looks like:
// { id, date: "2026-11-21", createdAt, checkIn: { text, good, bothered, noticed, ate, body, surprise },
//   mood, tone, length, mode, title, story, wakingThought, fragment: { name, description },
//   people: [person ids], rituals: { intention: { text, at }, worry: { text, at } } }
let entries = loadSaved("entries", []);
let people = loadSaved("people", []);    // { id, name, aliases, relationship, notes, firstMentioned, lastMentioned }
let threads = loadSaved("threads", []);  // { id, summary, followUpHint, resolved, createdAt }
let settings = Object.assign({}, DEFAULT_SETTINGS, loadSaved("settings", {}));

function saveEntries() { return save("entries", entries); }
function savePeople() { return save("people", people); }
function saveThreads() { return save("threads", threads); }
function saveSettings() {
  if (save("settings", settings)) {
    const message = document.getElementById("save-message");
    message.textContent = "Saved ✓";
    clearTimeout(saveSettings.timer);
    saveSettings.timer = setTimeout(function () { message.textContent = ""; }, 1500);
  }
}

function findEntry(id) { return entries.find(function (e) { return e.id === id; }); }
function findPerson(id) { return people.find(function (p) { return p.id === id; }); }

// Find a person by name or one of their other names ("my sister"), ignoring capitals
function findPersonByName(name) {
  const lower = name.trim().toLowerCase();
  return people.find(function (p) {
    return [p.name].concat(p.aliases || []).some(function (n) { return n.toLowerCase() === lower; });
  });
}

// Newest first
function sortEntries() {
  entries.sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
}


// ===== Little page-building helper =====
// el("p", { className: "muted" }, "Hello") makes <p class="muted">Hello</p>.
// Text is always added as plain text, so nothing typed can break the page.
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props || {});
  children.flat().forEach(function (child) {
    if (child === null || child === undefined || child === false) return;
    node.append(child instanceof Node ? child : String(child));
  });
  return node;
}

// A row of chip buttons for picking one option (mood, tone, …)
function makeChoices(container, options, labels, getValue, setValue, allowNone) {
  container.textContent = "";
  options.forEach(function (option) {
    const button = el("button", { type: "button", className: "chip" }, labels[option] || option);
    button.addEventListener("click", function () {
      setValue(allowNone && getValue() === option ? null : option);
      refresh();
    });
    container.append(button);
  });
  function refresh() {
    Array.from(container.children).forEach(function (button, i) {
      button.classList.toggle("on", getValue() === options[i]);
    });
  }
  refresh();
  return refresh;
}


// ===== Dates, seasons and the moon =====
// Today's date as "YYYY-MM-DD" in this device's own time zone
function localDate(date) {
  const d = date || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// "2026-11-21" → a Date at noon (noon avoids time-zone off-by-one mistakes)
function parseDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function niceDate(text, options) {
  return parseDate(text).toLocaleDateString(undefined, options || { weekday: "long", month: "long", day: "numeric" });
}

// Northern Hemisphere seasons. (Swap the names if you live in the south.)
function season(date) {
  const m = date.getMonth();
  return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
}

// Approximate moon phase (accurate to about a day)
function moonPhase(date) {
  const cycle = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((((date.getTime() - knownNewMoon) / 86400000) % cycle) + cycle) % cycle;
  const names = ["new moon", "waxing crescent", "first quarter", "waxing gibbous",
                 "full moon", "waning gibbous", "last quarter", "waning crescent"];
  return names[Math.round((age / cycle) * 8) % 8];
}

// Calendar icon: heavy days get a cloud, happy days a sun, otherwise it follows the tone
function entryIcon(entry) {
  if (entry.mood === "sad" || entry.mood === "anxious") return "☁️";
  if (entry.mood === "happy" || entry.mood === "grateful") return "☀️";
  if (entry.tone === "mystical") return "✨";
  if (entry.tone === "eerie") return "🌫️";
  return "🌙";
}


// ===== Theme (night / pale dawn) =====
// "auto" follows the time of day; the button cycles Auto → Night → Day.
let themeChoice = loadSaved("theme", "auto");

function applyTheme() {
  const hour = new Date().getHours();
  const theme = themeChoice === "auto" ? (hour >= 6 && hour < 18 ? "day" : "night") : themeChoice;
  document.documentElement.setAttribute("data-theme", theme);
  const label = { auto: "🌗 Auto", night: "🌙 Night", day: "🌅 Day" }[themeChoice];
  document.querySelectorAll(".theme-button").forEach(function (b) { b.textContent = label; });
}

document.querySelectorAll(".theme-button").forEach(function (button) {
  button.addEventListener("click", function () {
    const order = ["auto", "night", "day"];
    themeChoice = order[(order.indexOf(themeChoice) + 1) % 3];
    save("theme", themeChoice);
    applyTheme();
  });
});
setInterval(applyTheme, 5 * 60 * 1000); // re-check every 5 minutes in auto mode


// ===== Drifting particles =====
(function makeParticles() {
  const box = document.getElementById("particles");
  for (let i = 0; i < 18; i++) {
    const speck = document.createElement("i");
    const size = 2 + (i % 3);
    speck.style.left = ((i * 53) % 100) + "%";
    speck.style.width = speck.style.height = size + "px";
    speck.style.animationDelay = "-" + ((i * 3.7) % 30) + "s";
    speck.style.animationDuration = (28 + ((i * 7) % 20)) + "s";
    box.append(speck);
  }
})();


// ===== Tabs and pages =====
// The address after # says which page is open (#journal, #dream/abc123, …),
// so the Back button and iPhone's swipe-back work.
const TABS = ["tonight", "journal", "people", "person", "dream", "fragments", "settings"];

function showPage() {
  const [page, id] = (location.hash.slice(1) || "tonight").split("/");
  const tab = TABS.includes(page) ? page : "tonight";
  TABS.forEach(function (name) {
    document.getElementById(name + "-tab").hidden = name !== tab;
  });
  // Highlight the right bottom tab (a person's page belongs to People, a dream to Journal)
  const navTab = { person: "people", dream: "journal" }[tab] || tab;
  document.querySelectorAll(".nav a").forEach(function (a) {
    a.classList.toggle("active", a.dataset.tab === navTab);
  });
  stopSpeaking();
  stopAmbience();

  if (tab === "tonight") showTonight();
  if (tab === "journal") showJournal();
  if (tab === "people") showPeople();
  if (tab === "person") showPerson(id);
  if (tab === "dream") showDreamPage(id);
  if (tab === "fragments") showFragments();
  if (tab === "settings") showSettings();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", showPage);


// ===== Tonight: the daily check-in =====
const checkinText = document.getElementById("checkin-text");
const extraPrompts = document.getElementById("extra-prompts");
const extraInputs = {};
let checkinMood = null;
let checkinTone = settings.defaultTone;
let checkinLength = settings.defaultLength;
let checkinMode = new Date().getHours() < 12 ? "morning" : settings.defaultMode; // mornings start in Morning mode

EXTRA_PROMPTS.forEach(function (prompt) {
  // Small text boxes, since these are now the main places to write
  const input = el("textarea", { id: "extra-" + prompt.key, rows: 2, placeholder: "A few words is enough…" });
  extraInputs[prompt.key] = input;
  extraPrompts.append(el("div", { className: "extra" },
    el("label", { className: "label", htmlFor: input.id }, prompt.label), input));
});

makeChoices(document.getElementById("mood-choices"), MOODS,
  Object.fromEntries(MOODS.map(function (m) { return [m, MOOD_EMOJI[m] + " " + m]; })),
  function () { return checkinMood; }, function (v) { checkinMood = v; saveDraft(); }, true);
const refreshTone = makeChoices(document.getElementById("tone-choices"), TONES, TONE_LABEL,
  function () { return checkinTone; }, function (v) { checkinTone = v; });
const refreshLength = makeChoices(document.getElementById("length-choices"), LENGTHS, LENGTH_LABEL,
  function () { return checkinLength; }, function (v) { checkinLength = v; });
const refreshMode = makeChoices(document.getElementById("mode-choices"), MODES, MODE_LABEL,
  function () { return checkinMode; }, function (v) { checkinMode = v; showTonightWords(); });

function readCheckIn() {
  const checkIn = { text: checkinText.value.trim() };
  EXTRA_PROMPTS.forEach(function (p) { checkIn[p.key] = extraInputs[p.key].value.trim(); });
  return checkIn;
}

// Your unsent check-in is kept as you type, so nothing is lost if the app closes
function saveDraft() {
  save("draft", { date: localDate(), checkIn: readCheckIn(), mood: checkinMood });
}
checkinText.addEventListener("input", saveDraft);
Object.values(extraInputs).forEach(function (input) { input.addEventListener("input", saveDraft); });

(function restoreDraft() {
  const draft = loadSaved("draft", null);
  if (!draft || draft.date !== localDate()) return;
  checkinText.value = draft.checkIn.text || "";
  if (checkinText.value) document.getElementById("more-details").open = true; // show saved words
  EXTRA_PROMPTS.forEach(function (p) { extraInputs[p.key].value = draft.checkIn[p.key] || ""; });
  checkinMood = draft.mood || null;
  makeChoices(document.getElementById("mood-choices"), MOODS,
    Object.fromEntries(MOODS.map(function (m) { return [m, MOOD_EMOJI[m] + " " + m]; })),
    function () { return checkinMood; }, function (v) { checkinMood = v; saveDraft(); }, true);
})();

function showTonightWords() {
  const morning = checkinMode === "morning";
  document.getElementById("tonight-title").textContent = morning ? "Good morning" : "Tonight";
  document.getElementById("checkin-question").textContent = morning ? "＋ Anything else about the day ahead?" : "＋ Anything else about today?";
  document.getElementById("dream-button").textContent = morning ? "Dream the day ahead" : "Dream it";
}

function showTonight() {
  const now = new Date();
  document.getElementById("sky-line").textContent =
    now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) +
    " · " + season(now) + " · " + moonPhase(now);
  document.getElementById("no-key-banner").hidden = !!openaiKey;
  showTonightWords();
}

document.getElementById("dream-button").addEventListener("click", function () { writeDream(false); });
document.getElementById("surprise-button").addEventListener("click", function () { writeDream(true); });


// ===== OpenAI: settings =====
// The key and model are kept only in this browser (localStorage), never in the website's files.
const DEFAULT_MODEL = "gpt-4.1";

const openaiKeyInput = document.getElementById("openai-key");
const openaiModelInput = document.getElementById("openai-model");
const openaiStatus = document.getElementById("openai-status");

let openaiKey = loadSaved("openaiKey", "");
let openaiModel = loadSaved("openaiModel", DEFAULT_MODEL);

function showOpenaiStatus() {
  openaiModelInput.value = openaiModel;
  openaiKeyInput.value = "";
  // Only the last 4 characters are ever shown
  openaiKeyInput.placeholder = openaiKey ? "Saved (ends in …" + openaiKey.slice(-4) + ")" : "sk-...";
  openaiStatus.textContent = openaiKey
    ? "Connected: a key is saved on this device. Model: " + openaiModel
    : "No key saved yet.";
}

document.getElementById("openai-form").addEventListener("submit", function (event) {
  event.preventDefault();
  const typedKey = openaiKeyInput.value.trim();
  if (typedKey) openaiKey = typedKey; // An empty box keeps the key that's already saved
  openaiModel = openaiModelInput.value.trim() || DEFAULT_MODEL;
  save("openaiKey", openaiKey);
  save("openaiModel", openaiModel);
  showOpenaiStatus();
});

document.getElementById("openai-forget").addEventListener("click", function () {
  openaiKey = "";
  save("openaiKey", null);
  showOpenaiStatus();
});


// ===== OpenAI: asking for a dream =====
// Sends the request and calls onText with everything written so far, as it arrives
// (that's what makes the dream appear word by word). Errors are explained in plain words.
async function askOpenaiStream(request, onText, signal) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openaiKey,
      },
      body: JSON.stringify(Object.assign({}, request, { stream: true })),
      signal: signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach OpenAI. Check your internet connection, and that the API key in Settings is correct.");
  }

  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch {}
    if (response.status === 401) throw new Error("The API key wasn't accepted. Check it in Settings → OpenAI.");
    if (response.status === 404) throw new Error("OpenAI doesn't know the model \"" + openaiModel + "\". Check it in Settings → OpenAI.");
    if (response.status === 429) throw new Error("Too many requests, or no credit left on your OpenAI account. Try again later.");
    throw new Error("Something went wrong (" + response.status + "): " + (data.error ? data.error.message : ""));
  }

  // The answer arrives as lines like:  data: {"choices":[{"delta":{"content":"word"}}]}
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let leftover = "";
  let text = "";
  let finishReason = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    leftover += decoder.decode(value, { stream: true });
    const lines = leftover.split("\n");
    leftover = lines.pop(); // the last line may be unfinished
    lines.forEach(function (line) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") return;
      try {
        const choice = JSON.parse(line.slice(6)).choices[0];
        if (choice.delta && choice.delta.content) {
          text += choice.delta.content;
          onText(text);
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      } catch {}
    });
  }
  return { text: text, finishReason: finishReason };
}


// ===== Writing a dream =====
let lastWasSurprise = false;
let dreamAbort = null;

// Daily limit: the times dreams were written are kept, and the last 24 hours are counted
function dreamsInLastDay() {
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const times = loadSaved("dreamTimes", []).filter(function (t) { return t > dayAgo; });
  save("dreamTimes", times);
  return times;
}

async function writeDream(surprise) {
  lastWasSurprise = surprise;
  document.getElementById("checkin").hidden = true;
  document.getElementById("dreaming").hidden = false;
  document.getElementById("dream-error").hidden = true;
  document.getElementById("dream-done").textContent = "";
  const streamBox = document.getElementById("dream-stream");
  streamBox.textContent = "";
  window.scrollTo(0, 0);

  if (!openaiKey) return showDreamError("Add your OpenAI API key in Settings first.");
  const times = dreamsInLastDay();
  if (times.length >= settings.dailyLimit) {
    return showDreamError("You've reached today's limit of " + settings.dailyLimit + " dreams. You can change it in Settings.");
  }

  const checkIn = surprise ? { surprise: true } : readCheckIn();
  const mood = surprise ? null : checkinMood;
  const date = localDate();
  startBreathing();
  streamBox.append(el("p", { className: "muted cursor center" }, "Drifting off"));

  dreamAbort = new AbortController();
  try {
    times.push(Date.now());
    save("dreamTimes", times);
    const answer = await askOpenaiStream({
      model: openaiModel,
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildDreamPrompt(checkIn, mood, date) },
      ],
    }, showPartialDream, dreamAbort.signal);

    if (answer.finishReason === "length") throw new Error("The dream ran too long and was cut off. Try again.");
    if (answer.finishReason === "content_filter") throw new Error("This dream couldn't be written. Try changing a few words.");
    const result = parseDream(answer.text);
    if (!result) throw new Error("The dream came out jumbled. Try again.");

    const entry = saveDream(result, checkIn, mood, date);
    save("draft", null);
    checkinText.value = "";
    Object.values(extraInputs).forEach(function (input) { input.value = ""; });
    checkinMood = null;
    restoreMoodButtons();

    stopBreathing();
    streamBox.textContent = "";
    const done = document.getElementById("dream-done");
    done.textContent = "";
    done.append(renderDream(entry));
  } catch (error) {
    if (error.name === "AbortError") return;
    showDreamError(error.message);
  }
}

function showDreamError(message) {
  stopBreathing();
  document.getElementById("dream-stream").textContent = "";
  document.getElementById("dream-error-text").textContent = message;
  document.getElementById("dream-error").hidden = false;
}

function restoreMoodButtons() {
  Array.from(document.getElementById("mood-choices").children).forEach(function (b) { b.classList.remove("on"); });
}

// Show the title and story while the JSON is still arriving
function showPartialDream(raw) {
  if (!document.getElementById("breath").hidden) return; // still breathing; text appears after
  const title = grabPartial(raw, "title");
  const story = grabPartial(raw, "story");
  const box = document.getElementById("dream-stream");
  box.textContent = "";
  box.append(el("h2", {}, title || "…"));
  if (!story) {
    box.append(el("p", { className: "muted cursor center" }, "Drifting off"));
    return;
  }
  const paragraphs = story.split(/\n\s*\n/);
  paragraphs.forEach(function (p, i) {
    box.append(el("p", { className: i === paragraphs.length - 1 ? "cursor" : "", style: "animation: none" }, p));
  });
}

// Pull one text field out of half-finished JSON
function grabPartial(raw, key) {
  const match = raw.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)'));
  if (!match) return "";
  try { return JSON.parse('"' + match[1].replace(/\\$/, "") + '"'); }
  catch { return match[1].replace(/\\n/g, "\n"); }
}

function buildDreamPrompt(checkIn, mood, date) {
  const day = parseDate(date);
  const lines = [
    checkIn.text && "Anything else: " + checkIn.text,
    checkIn.good && "One good thing: " + checkIn.good,
    checkIn.bothered && "Something that bothered me: " + checkIn.bothered,
    checkIn.noticed && "Something I noticed: " + checkIn.noticed,
    checkIn.ate && "What I ate: " + checkIn.ate,
    checkIn.body && "How my body feels: " + checkIn.body,
  ].filter(Boolean);

  // Send people mentioned today, plus a few recent ones, to keep the prompt short
  const allText = Object.values(checkIn).join(" ").toLowerCase();
  const byRecent = people.slice().sort(function (a, b) { return (b.lastMentioned || "").localeCompare(a.lastMentioned || ""); });
  const mentioned = byRecent.filter(function (p) {
    return [p.name].concat(p.aliases || []).some(function (n) { return n && allText.includes(n.toLowerCase()); });
  });
  const recent = byRecent.filter(function (p) { return !mentioned.includes(p); }).slice(0, 4);
  const peopleText = mentioned.concat(recent).map(function (p) {
    const notes = p.notes ? ": " + p.notes.split("\n").slice(-3).join("; ") : "";
    return "- " + p.name + (p.relationship ? " (" + p.relationship + ")" : "") + notes;
  }).join("\n");

  const openThreads = threads.filter(function (t) { return !t.resolved; }).slice(0, 5);

  // Before-sleep rituals from the last 3 days, which dreams may gently reflect
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const rituals = [];
  entries.forEach(function (e) {
    ["intention", "worry"].forEach(function (kind) {
      const r = e.rituals && e.rituals[kind];
      if (r && r.text && r.at > threeDaysAgo) rituals.push({ kind: kind, text: r.text, at: r.at });
    });
  });
  rituals.sort(function (a, b) { return b.at.localeCompare(a.at); });

  const literal = settings.literalness < 34 ? "Stay fairly close to real life; only a few dreamlike touches."
    : settings.literalness > 66 ? "Make it fully dreamlike; real details may transform freely."
    : "Balance real details with dream logic.";

  // Season and moon only go to the model for "Surprise me" (no check-in to work from).
  // Otherwise they tempt it into moonlit clichés.
  const surprise = checkIn.surprise || lines.length === 0;

  return [
    surprise
      ? "Date: " + day.toDateString() + " · season: " + season(day) + " · moon: " + moonPhase(day)
      : "Date: " + day.toDateString(),
    "Mode: " + (checkinMode === "morning" ? "Morning dream (hopeful, about the day ahead)" : "Tonight's dream (about today)"),
    "Mood: " + (mood || "not given") + " · Tone: " + checkinTone + " · Length: " + checkinLength,
    "How literal: " + literal,
    "Hard topics: " + (settings.hardTopics === "soften" ? "soften heavy things a lot" : "reflect heavy things gently and honestly"),
    settings.wakingThought ? "" : 'Leave "wakingThought" as an empty string.',
    "",
    peopleText ? "People the reader knows:\n" + peopleText : "",
    openThreads.length ? "Open threads in the reader's life:\n" + openThreads.map(function (t) {
      return "- " + t.summary + (t.followUpHint ? " (" + t.followUpHint + ")" : "");
    }).join("\n") : "",
    rituals.length ? "Before sleep recently, the reader wrote:\n" + rituals.slice(0, 2).map(function (r) {
      return "- " + (r.kind === "worry" ? "A worry they let drift away" : "An intention") + ": " + r.text;
    }).join("\n") + "\n(You may reflect these very gently.)" : "",
    "",
    surprise
      ? "The reader shared nothing today. Write a dream seeded only by the date, season and moon. Treat rest as a gift. Return empty peopleMentioned and newThreads."
      : "The reader's check-in:\n" + lines.join("\n"),
  ].filter(function (line) { return line !== ""; }).join("\n");
}

// Read the JSON the model wrote. Returns null if it can't be understood.
function parseDream(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1));
    if (typeof j.story !== "string" || !j.story.trim()) return null;
    return {
      title: String(j.title || "Untitled dream"),
      story: j.story,
      wakingThought: String(j.wakingThought || ""),
      fragment: j.fragment && j.fragment.name ? { name: String(j.fragment.name), description: String(j.fragment.description || "") } : null,
      peopleMentioned: Array.isArray(j.peopleMentioned) ? j.peopleMentioned.filter(function (p) { return p && p.name; }) : [],
      newThreads: Array.isArray(j.newThreads) ? j.newThreads.filter(function (t) { return t && t.summary; }) : [],
    };
  } catch {
    return null;
  }
}

// Save the finished dream, and update people and threads from it
function saveDream(result, checkIn, mood, date) {
  const entry = {
    id: newId(), date: date, createdAt: new Date().toISOString(), checkIn: checkIn,
    mood: mood, tone: checkinTone, length: checkinLength, mode: checkinMode,
    title: result.title, story: result.story,
    wakingThought: settings.wakingThought ? result.wakingThought : "",
    fragment: result.fragment, people: [], rituals: {},
  };

  // People are added automatically the first time they're mentioned
  result.peopleMentioned.slice(0, 12).forEach(function (mention) {
    const name = String(mention.name).trim().slice(0, 80);
    if (!name) return;
    const note = String(mention.newNotes || "").trim();
    let person = findPersonByName(name);
    if (person) {
      if (note && !person.notes.includes(note)) person.notes = [person.notes, note].filter(Boolean).join("\n");
      if (!person.relationship) person.relationship = String(mention.relationship || "");
      person.lastMentioned = date;
    } else {
      person = { id: newId(), name: name, aliases: [], relationship: String(mention.relationship || ""),
                 notes: note, firstMentioned: date, lastMentioned: date };
      people.push(person);
    }
    if (!entry.people.includes(person.id)) entry.people.push(person.id);
  });

  result.newThreads.slice(0, 5).forEach(function (t) {
    threads.unshift({ id: newId(), summary: String(t.summary).slice(0, 300),
      followUpHint: String(t.followUpHint || "").slice(0, 300), resolved: false, createdAt: entry.createdAt });
  });

  entries.unshift(entry);
  saveEntries();
  savePeople();
  saveThreads();
  return entry;
}

document.getElementById("new-checkin-button").addEventListener("click", function () {
  if (dreamAbort) dreamAbort.abort();
  stopBreathing();
  stopSpeaking();
  stopAmbience();
  document.getElementById("dreaming").hidden = true;
  document.getElementById("checkin").hidden = false;
});
document.getElementById("retry-button").addEventListener("click", function () { writeDream(lastWasSurprise); });
document.getElementById("edit-checkin-button").addEventListener("click", function () {
  document.getElementById("dreaming").hidden = true;
  document.getElementById("checkin").hidden = false;
});


// ===== Breathing moment =====
// A short, skippable breathing animation while the dream is being written.
let breathTimers = [];

function startBreathing() {
  const breath = document.getElementById("breath");
  const text = document.getElementById("breath-text");
  breath.hidden = false;
  text.textContent = "Breathe in…";
  breathTimers = [
    setInterval(function () {
      text.textContent = text.textContent.startsWith("Breathe in") ? "Breathe out…" : "Breathe in…";
    }, 4000),
    setTimeout(stopBreathing, 16000),
  ];
}

function stopBreathing() {
  breathTimers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
  breathTimers = [];
  const breath = document.getElementById("breath");
  if (breath.hidden) return;
  breath.hidden = true;
  // If the dream is still arriving, show what's there so far
  if (dreamAbort && !document.getElementById("dreaming").hidden && !document.getElementById("dream-done").children.length) {
    document.getElementById("dream-stream").textContent = "";
    document.getElementById("dream-stream").append(el("p", { className: "muted cursor center" }, "Drifting off"));
  }
}
document.getElementById("skip-breath").addEventListener("click", stopBreathing);


// ===== Reading a dream =====
// Builds the calm reading view: text, waking thought, who appeared, fragment,
// read-aloud, ambient sound and the Before sleep rituals.
function renderDream(entry) {
  const box = el("article", { className: "fade-in" });

  // Read aloud + ambient sound
  const tools = el("div", { className: "row reader-tools" });
  if ("speechSynthesis" in window) {
    const speakButton = el("button", { type: "button", className: "chip" }, "🔈 Read aloud");
    speakButton.addEventListener("click", function () {
      if (speakButton.textContent.startsWith("⏹")) {
        stopSpeaking();
        speakButton.textContent = "🔈 Read aloud";
      } else {
        speakButton.textContent = "⏹ Stop";
        speak(entry.title + ".\n\n" + entry.story, function () { speakButton.textContent = "🔈 Read aloud"; });
      }
    });
    tools.append(speakButton);
  }
  const sound = el("select", { ariaLabel: "Ambient sound" },
    el("option", { value: "off" }, "Sound: off"),
    el("option", { value: "rain" }, "🌧 Rain"),
    el("option", { value: "night" }, "🌌 Night"),
    el("option", { value: "wind" }, "🍃 Soft wind"));
  sound.addEventListener("change", function () {
    if (sound.value === "off") stopAmbience(); else startAmbience(sound.value);
  });
  tools.append(sound);
  box.append(tools);

  // The dream itself; paragraphs fade in one after another
  const dream = el("div", { className: "dream" }, el("h2", {}, entry.title));
  entry.story.split(/\n\s*\n/).filter(function (p) { return p.trim(); }).forEach(function (p, i) {
    dream.append(el("p", { style: "animation-delay: " + Math.min(i * 0.35, 3) + "s" }, p));
  });
  box.append(dream);

  if (entry.wakingThought) box.append(el("p", { className: "waking" }, "“" + entry.wakingThought + "”"));

  const who = (entry.people || []).map(findPerson).filter(Boolean);
  if (who.length) {
    const line = el("p", { className: "muted small center" }, "In this dream: ");
    who.forEach(function (p, i) {
      if (i > 0) line.append(", ");
      line.append(el("a", { href: "#person/" + p.id }, p.name));
    });
    box.append(line);
  }

  if (entry.fragment && entry.fragment.name) {
    box.append(el("div", { className: "card fragment" },
      el("span", { className: "label" }, "A fragment you kept"),
      el("div", { className: "name" }, "🗝️ " + entry.fragment.name),
      entry.fragment.description && el("div", { className: "muted small" }, entry.fragment.description)));
  }

  box.append(renderRituals(entry));
  return box;
}

// "Before sleep": set an intention, or let a worry drift away. Each has an optional short text.
function renderRituals(entry) {
  const card = el("div", { className: "card" }, el("span", { className: "label" }, "Before sleep"));
  const kinds = [
    { kind: "intention", icon: "🕯️", label: "Set an intention for tonight", placeholder: "Tonight I'd like to…", saveLabel: "Keep it" },
    { kind: "worry", icon: "🍃", label: "Let a worry drift away", placeholder: "I'm letting go of…", saveLabel: "Let it drift" },
  ];
  kinds.forEach(function (k) {
    const spot = el("div", { className: "ritual" });
    card.append(spot);
    function showButton() {
      spot.textContent = "";
      const done = entry.rituals && entry.rituals[k.kind];
      const button = el("button", { type: "button", className: "ghost block ritual-button" }, k.icon + " " + k.label,
        done && el("span", { className: "muted small done" }, "✓ " + (done.text ? "saved" : "done")));
      button.addEventListener("click", showForm);
      spot.append(button);
    }
    function showForm() {
      spot.textContent = "";
      const existing = entry.rituals && entry.rituals[k.kind];
      const box = el("textarea", { placeholder: k.placeholder, maxLength: 500, value: existing ? existing.text : "" });
      const keep = el("button", { type: "button", className: "primary" }, k.saveLabel);
      const cancel = el("button", { type: "button", className: "ghost" }, "Cancel");
      keep.addEventListener("click", function () {
        entry.rituals = entry.rituals || {};
        entry.rituals[k.kind] = { text: box.value.trim(), at: new Date().toISOString() };
        saveEntries();
        showButton();
      });
      cancel.addEventListener("click", showButton);
      spot.append(el("div", { className: "fade-in" }, box, el("div", { className: "row", style: "margin: 8px 0" }, keep, cancel)));
      box.focus();
    }
    showButton();
  });
  return card;
}

// The original check-in for a day ("Real day")
function renderRealDay(entry) {
  const c = entry.checkIn || {};
  const card = el("div", { className: "card fade-in" }, el("span", { className: "label" }, "Your real day"));
  const extras = EXTRA_PROMPTS.filter(function (p) { return c[p.key]; });
  if (c.surprise) {
    card.append(el("p", { className: "muted" }, "You didn't share anything this day. It was a “Surprise me” dream."));
  } else {
    if (c.text) card.append(el("p", { style: "white-space: pre-wrap" }, c.text));
    extras.forEach(function (p) {
      card.append(el("p", {}, el("span", { className: "muted small" }, p.label + ":"), el("br"), c[p.key]));
    });
    if (!c.text && !extras.length) card.append(el("p", { className: "muted" }, "No words this day."));
  }
  card.append(el("p", { className: "muted small" },
    (entry.mood ? MOOD_EMOJI[entry.mood] + " " + entry.mood + " · " : "") +
    TONE_LABEL[entry.tone] + " · " + MODE_LABEL[entry.mode]));
  return card;
}

// A "Dream / Real day" switch above a dream
function renderWithToggle(entry, header) {
  const wrap = el("div");
  const dreamButton = el("button", { type: "button", className: "on" }, "Dream");
  const realButton = el("button", { type: "button" }, "Real day");
  const body = el("div");
  function show(which) {
    stopSpeaking();
    stopAmbience();
    dreamButton.classList.toggle("on", which === "dream");
    realButton.classList.toggle("on", which === "real");
    body.textContent = "";
    body.append(which === "dream" ? renderDream(entry) : renderRealDay(entry));
  }
  dreamButton.addEventListener("click", function () { show("dream"); });
  realButton.addEventListener("click", function () { show("real"); });
  wrap.append(el("div", { className: "spread", style: "margin: 8px 0 12px" },
    header, el("div", { className: "toggle" }, dreamButton, realButton)), body);
  show("dream");
  return wrap;
}

// One dream on its own page (#dream/<id>)
function showDreamPage(id) {
  const page = document.getElementById("dream-tab");
  page.textContent = "";
  const back = el("button", { type: "button", className: "ghost chip" }, "← Back");
  back.addEventListener("click", function () { history.back(); });
  page.append(el("div", { className: "topbar" }, back));
  const entry = findEntry(id);
  if (!entry) {
    page.append(el("p", { className: "muted" }, "This dream couldn't be found."));
    return;
  }
  page.append(renderWithToggle(entry, el("span", { className: "muted small" },
    niceDate(entry.date, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))));
}


// ===== Read aloud =====
// Uses the voices built into the browser
function speak(text, onEnd) {
  speechSynthesis.cancel();
  const voices = speechSynthesis.getVoices().filter(function (v) { return v.lang.startsWith("en"); });
  const preferred = ["Samantha", "Ava", "Karen", "Moira", "Serena", "Google UK English Female"];
  const voice = preferred.map(function (n) { return voices.find(function (v) { return v.name.includes(n); }); }).find(Boolean) || voices[0];
  // One paragraph at a time: long speech gets cut off on iPhone
  const parts = text.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  parts.forEach(function (part, i) {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = 0.82; // slow and calm
    u.pitch = 0.95;
    if (voice) u.voice = voice;
    if (i === parts.length - 1) u.onend = onEnd;
    speechSynthesis.speak(u);
  });
}

function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}


// ===== Ambient sound =====
// Made in the browser with Web Audio, so there are no sound files. Off by default.
let audioContext = null;
let stopSoundSteps = [];

function noise(context, kind) {
  const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") data[i] = white;
    else { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; } // "brown" noise: deeper and softer
  }
  return buffer;
}

function startAmbience(kind) {
  stopAmbience();
  audioContext = audioContext || new AudioContext();
  const ac = audioContext;
  ac.resume();
  const volume = ac.createGain();
  volume.gain.setValueAtTime(0, ac.currentTime);
  volume.gain.linearRampToValueAtTime(0.35, ac.currentTime + 2); // gentle fade in
  volume.connect(ac.destination);

  const source = ac.createBufferSource();
  source.buffer = noise(ac, kind === "rain" ? "white" : "brown");
  source.loop = true;
  const filter = ac.createBiquadFilter();
  if (kind === "rain") { filter.type = "lowpass"; filter.frequency.value = 1400; }
  if (kind === "night") { filter.type = "lowpass"; filter.frequency.value = 500; }
  if (kind === "wind") {
    filter.type = "bandpass"; filter.frequency.value = 400; filter.Q.value = 0.8;
    // slow swells
    const swell = ac.createOscillator();
    const swellSize = ac.createGain();
    swell.frequency.value = 0.08;
    swellSize.gain.value = 250;
    swell.connect(swellSize).connect(filter.frequency);
    swell.start();
    stopSoundSteps.push(function () { swell.stop(); });
  }
  source.connect(filter).connect(volume);
  source.start();

  // Night: soft, occasional crickets
  if (kind === "night") {
    const timer = setInterval(function () {
      if (Math.random() < 0.5) return;
      const tone = ac.createOscillator();
      const level = ac.createGain();
      tone.frequency.value = 4200 + Math.random() * 600;
      const t = ac.currentTime;
      for (let i = 0; i < 3; i++) {
        level.gain.setValueAtTime(0, t + i * 0.08);
        level.gain.linearRampToValueAtTime(0.02, t + i * 0.08 + 0.02);
        level.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.05);
      }
      tone.connect(level).connect(volume);
      tone.start(t);
      tone.stop(t + 0.3);
    }, 1800);
    stopSoundSteps.push(function () { clearInterval(timer); });
  }

  // Fade out, then stop
  stopSoundSteps.push(function () {
    volume.gain.cancelScheduledValues(ac.currentTime);
    volume.gain.setValueAtTime(volume.gain.value, ac.currentTime);
    volume.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
    setTimeout(function () { try { source.stop(); } catch {} volume.disconnect(); }, 600);
  });
}

function stopAmbience() {
  stopSoundSteps.forEach(function (step) { try { step(); } catch {} });
  stopSoundSteps = [];
}


// ===== Journal: calendar, search, on this day =====
let journalMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let journalDay = localDate();

function entriesByDay() {
  const days = {};
  entries.forEach(function (e) { (days[e.date] = days[e.date] || []).push(e); }); // newest first within a day
  return days;
}

// A short clickable row for a dream
function entryRow(entry) {
  const row = el("a", { className: "card list-item", href: "#dream/" + entry.id, style: "display: block" },
    el("div", { className: "spread" },
      el("span", { className: "title-line" }, entryIcon(entry) + " " + entry.title),
      el("span", { className: "muted small" }, niceDate(entry.date, { month: "short", day: "numeric", year: "numeric" }))),
    el("div", { className: "preview" }, entry.story.slice(0, 110) + "…"));
  return row;
}

function showJournal() {
  const days = entriesByDay();

  // "On this day": a year ago and a month ago
  const onThisDay = document.getElementById("on-this-day");
  onThisDay.textContent = "";
  const t = new Date();
  [["A year ago", localDate(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()))],
   ["A month ago", localDate(new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()))]].forEach(function (pair) {
    const e = (days[pair[1]] || [])[0];
    if (!e) return;
    onThisDay.append(el("a", { className: "card list-item fade-in", href: "#dream/" + e.id, style: "display: block" },
      el("span", { className: "label" }, "On this day · " + pair[0]),
      el("div", { className: "title-line" }, entryIcon(e) + " " + e.title),
      el("div", { className: "preview" }, e.story.slice(0, 120) + "…")));
  });

  // The month calendar (weeks start on Monday)
  document.getElementById("month-name").textContent =
    journalMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendar = document.getElementById("calendar");
  calendar.textContent = "";
  ["M", "T", "W", "T", "F", "S", "S"].forEach(function (d) { calendar.append(el("div", { className: "dow" }, d)); });
  const blanks = (journalMonth.getDay() + 6) % 7;
  for (let i = 0; i < blanks; i++) calendar.append(el("div"));
  const daysInMonth = new Date(journalMonth.getFullYear(), journalMonth.getMonth() + 1, 0).getDate();
  const today = localDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = localDate(new Date(journalMonth.getFullYear(), journalMonth.getMonth(), d));
    const classes = [days[date] && "has", date === journalDay && "sel", date === today && "today"].filter(Boolean).join(" ");
    const button = el("button", { type: "button", className: classes },
      el("span", {}, d), el("span", { className: "ico" }, days[date] ? entryIcon(days[date][0]) : ""));
    button.addEventListener("click", function () { journalDay = date; showJournal(); });
    calendar.append(button);
  }

  // The chosen day
  const dayView = document.getElementById("day-view");
  dayView.textContent = "";
  stopSpeaking();
  stopAmbience();
  const dayEntries = days[journalDay] || [];
  if (!dayEntries.length) {
    dayView.append(el("p", { className: "muted center" },
      entries.length ? "No dream on " + niceDate(journalDay, { month: "long", day: "numeric" }) + "."
                     : "Your journal is empty for now. Write tonight's dream in 🌙 Tonight."));
    return;
  }
  dayView.append(renderWithToggle(dayEntries[0], el("span", { className: "muted small" }, niceDate(journalDay))));
  if (dayEntries.length > 1) {
    dayView.append(el("span", { className: "label", style: "margin-top: 16px" }, "Other dreams this day"));
    dayEntries.slice(1).forEach(function (e) { dayView.append(entryRow(e)); });
  }
}

document.getElementById("prev-month").addEventListener("click", function () {
  journalMonth = new Date(journalMonth.getFullYear(), journalMonth.getMonth() - 1, 1);
  showJournal();
});
document.getElementById("next-month").addEventListener("click", function () {
  journalMonth = new Date(journalMonth.getFullYear(), journalMonth.getMonth() + 1, 1);
  showJournal();
});

// Search across dreams and check-ins
document.getElementById("search").addEventListener("input", function (event) {
  const query = event.target.value.trim().toLowerCase();
  const results = document.getElementById("search-results");
  document.getElementById("journal-main").hidden = query.length >= 2;
  results.hidden = query.length < 2;
  if (query.length < 2) return;
  const found = entries.filter(function (e) {
    return (e.title + " " + e.story + " " + Object.values(e.checkIn || {}).join(" ")).toLowerCase().includes(query);
  });
  results.textContent = "";
  results.append(el("p", { className: "muted small" }, found.length + " found"));
  found.slice(0, 50).forEach(function (e) { results.append(entryRow(e)); });
});


// ===== People and threads =====
let peopleView = "people";

function showPeople() {
  document.getElementById("people-title").textContent = peopleView === "people" ? "People" : "Threads";
  document.getElementById("show-people").classList.toggle("on", peopleView === "people");
  document.getElementById("show-threads").classList.toggle("on", peopleView === "threads");
  document.getElementById("people-list").hidden = peopleView !== "people";
  document.getElementById("threads-list").hidden = peopleView !== "threads";

  const list = document.getElementById("people-list");
  list.textContent = "";
  if (!people.length) {
    list.append(el("p", { className: "muted" }, "People you mention in your check-ins will appear here on their own."));
  } else {
    const grid = el("div", { className: "grid" });
    people.slice().sort(function (a, b) { return (b.lastMentioned || "").localeCompare(a.lastMentioned || ""); })
      .forEach(function (p) {
        const count = entries.filter(function (e) { return (e.people || []).includes(p.id); }).length;
        grid.append(el("a", { className: "card list-item person-card", href: "#person/" + p.id },
          el("div", { className: "title-line" }, p.name),
          p.relationship && el("div", { className: "muted small" }, p.relationship),
          el("div", { className: "muted small", style: "margin-top: 6px" },
            count + " dream" + (count === 1 ? "" : "s") +
            (p.lastMentioned ? " · last " + niceDate(p.lastMentioned, { month: "short", day: "numeric" }) : ""))));
      });
    list.append(grid);
  }
  showThreads();
}

let showDoneThreads = false;

function showThreads() {
  const list = document.getElementById("threads-list");
  list.textContent = "";
  list.append(el("p", { className: "muted small" }, "Ongoing things from your days. Dreams may gently follow up on open ones."));
  const shown = threads.filter(function (t) { return showDoneThreads || !t.resolved; });
  if (!shown.length) list.append(el("p", { className: "muted" }, "No open threads."));
  shown.forEach(function (t) {
    const done = el("button", { type: "button", className: "chip" }, t.resolved ? "Reopen" : "✓ Done");
    const remove = el("button", { type: "button", className: "chip ghost danger" }, "Remove");
    done.addEventListener("click", function () { t.resolved = !t.resolved; saveThreads(); showThreads(); });
    remove.addEventListener("click", function () {
      threads = threads.filter(function (x) { return x !== t; });
      saveThreads();
      showThreads();
    });
    list.append(el("div", { className: "card thread" + (t.resolved ? " resolved" : "") },
      el("div", { className: "summary" }, t.summary),
      t.followUpHint && el("div", { className: "muted small" }, t.followUpHint),
      el("div", { className: "row", style: "margin-top: 8px" }, done, remove)));
  });
  if (threads.some(function (t) { return t.resolved; })) {
    const toggle = el("button", { type: "button", className: "ghost" }, showDoneThreads ? "Hide done" : "Show done");
    toggle.addEventListener("click", function () { showDoneThreads = !showDoneThreads; showThreads(); });
    list.append(toggle);
  }
}

document.getElementById("show-people").addEventListener("click", function () { peopleView = "people"; showPeople(); });
document.getElementById("show-threads").addEventListener("click", function () { peopleView = "threads"; showPeople(); });

// One person (#person/<id>): edit details, see their dreams, merge a duplicate, or remove them
function showPerson(id) {
  const page = document.getElementById("person-tab");
  page.textContent = "";
  page.append(el("div", { className: "topbar" }, el("a", { className: "btn ghost chip", href: "#people" }, "← People")));
  const person = findPerson(id);
  if (!person) {
    page.append(el("p", { className: "muted" }, "This person couldn't be found."));
    return;
  }

  const name = el("input", { value: person.name });
  const relationship = el("input", { value: person.relationship, placeholder: "friend, sister, coworker…" });
  const aliases = el("input", { value: (person.aliases || []).join(", "), placeholder: "my sister, Em" });
  const notes = el("textarea", { value: person.notes, placeholder: "Small things you've mentioned…" });
  const saveButton = el("button", { type: "button", className: "primary" }, "Save");
  [name, relationship, aliases, notes].forEach(function (input) {
    input.addEventListener("input", function () { saveButton.textContent = "Save"; });
  });
  saveButton.addEventListener("click", function () {
    person.name = name.value.trim() || "Someone";
    person.relationship = relationship.value.trim();
    person.aliases = aliases.value.split(",").map(function (a) { return a.trim(); }).filter(Boolean);
    person.notes = notes.value;
    if (savePeople()) saveButton.textContent = "Saved ✓";
  });
  page.append(el("div", { className: "card" },
    el("label", { className: "label" }, "Name"), name,
    el("label", { className: "label spaced" }, "Relationship"), relationship,
    el("label", { className: "label spaced" }, "Also called"), aliases,
    el("label", { className: "label spaced" }, "Notes"), notes,
    el("p", { className: "muted small" },
      (person.firstMentioned ? "First mentioned " + niceDate(person.firstMentioned, { year: "numeric", month: "short", day: "numeric" }) : "") +
      (person.lastMentioned ? " · latest " + niceDate(person.lastMentioned, { year: "numeric", month: "short", day: "numeric" }) : "")),
    saveButton));

  page.append(el("span", { className: "label" }, "Dreams with " + person.name));
  const theirs = entries.filter(function (e) { return (e.people || []).includes(person.id); });
  if (!theirs.length) page.append(el("p", { className: "muted" }, "None yet."));
  theirs.forEach(function (e) { page.append(entryRow(e)); });

  // Merge a duplicate ("my sister" + "Emma") into this person
  const others = people.filter(function (p) { return p.id !== person.id; });
  if (others.length) {
    const pick = el("select", {}, el("option", { value: "" }, "Choose someone…"),
      others.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (o) { return el("option", { value: o.id }, o.name); }));
    const mergeButton = el("button", { type: "button" }, "Merge");
    mergeButton.addEventListener("click", function () {
      const other = findPerson(pick.value);
      if (!other || !confirm("Merge “" + other.name + "” into “" + person.name + "”?")) return;
      entries.forEach(function (e) {
        if (!(e.people || []).includes(other.id)) return;
        e.people = e.people.filter(function (x) { return x !== other.id; });
        if (!e.people.includes(person.id)) e.people.push(person.id);
      });
      const allNames = (person.aliases || []).concat([other.name], other.aliases || []);
      person.aliases = allNames.filter(function (a, i) {
        return a.toLowerCase() !== person.name.toLowerCase() && allNames.indexOf(a) === i;
      });
      person.notes = [person.notes, other.notes].filter(Boolean).join("\n");
      person.relationship = person.relationship || other.relationship;
      const firsts = [person.firstMentioned, other.firstMentioned].filter(Boolean).sort();
      const lasts = [person.lastMentioned, other.lastMentioned].filter(Boolean).sort();
      person.firstMentioned = firsts[0] || null;
      person.lastMentioned = lasts[lasts.length - 1] || null;
      people = people.filter(function (p) { return p !== other; });
      saveEntries();
      savePeople();
      showPerson(person.id);
    });
    page.append(el("div", { className: "card", style: "margin-top: 16px" },
      el("span", { className: "label" }, "Merge a duplicate into " + person.name),
      el("div", { className: "row", style: "flex-wrap: nowrap" }, pick, mergeButton)));
  }

  const removeButton = el("button", { type: "button", className: "ghost danger" }, "Remove " + person.name);
  removeButton.addEventListener("click", function () {
    if (!confirm("Remove " + person.name + "? Their dreams stay in your journal.")) return;
    people = people.filter(function (p) { return p !== person; });
    entries.forEach(function (e) { e.people = (e.people || []).filter(function (x) { return x !== person.id; }); });
    saveEntries();
    savePeople();
    location.hash = "#people";
  });
  page.append(removeButton);
}


// ===== Fragments shelf =====
function showFragments() {
  const grid = document.getElementById("fragments-grid");
  grid.textContent = "";
  const withFragments = entries.filter(function (e) { return e.fragment && e.fragment.name; });
  if (!withFragments.length) {
    grid.append(el("p", { className: "muted" }, "Your shelf is empty for now. Each dream leaves one fragment behind."));
    return;
  }
  withFragments.forEach(function (e) {
    grid.append(el("a", { className: "card list-item fragment-card fade-in", href: "#dream/" + e.id },
      el("div", { className: "key" }, "🗝️"),
      el("div", { className: "serif" }, e.fragment.name),
      e.fragment.description && el("div", { className: "muted small" }, e.fragment.description),
      el("div", { className: "muted small", style: "margin-top: 6px; opacity: 0.7" }, niceDate(e.date, { month: "short", day: "numeric", year: "numeric" }))));
  });
}


// ===== Settings =====
const literalnessInput = document.getElementById("literalness");
const wakingThoughtInput = document.getElementById("waking-thought-setting");
const dailyLimitInput = document.getElementById("daily-limit");

literalnessInput.addEventListener("change", function () {
  settings.literalness = Number(literalnessInput.value);
  saveSettings();
});
wakingThoughtInput.addEventListener("change", function () {
  settings.wakingThought = wakingThoughtInput.checked;
  saveSettings();
});
dailyLimitInput.addEventListener("change", function () {
  settings.dailyLimit = Math.max(1, Math.min(200, Number(dailyLimitInput.value) || 1));
  dailyLimitInput.value = settings.dailyLimit;
  saveSettings();
});

function showSettings() {
  showOpenaiStatus();
  literalnessInput.value = settings.literalness;
  wakingThoughtInput.checked = settings.wakingThought;
  dailyLimitInput.value = settings.dailyLimit;
  makeChoices(document.getElementById("hard-topic-choices"), ["reflect", "soften"],
    { reflect: "Reflect gently", soften: "Soften heavily" },
    function () { return settings.hardTopics; }, function (v) { settings.hardTopics = v; saveSettings(); });
  makeChoices(document.getElementById("default-tone-choices"), TONES, TONE_LABEL,
    function () { return settings.defaultTone; },
    function (v) { settings.defaultTone = v; checkinTone = v; refreshTone(); saveSettings(); });
  makeChoices(document.getElementById("default-length-choices"), LENGTHS, LENGTH_LABEL,
    function () { return settings.defaultLength; },
    function (v) { settings.defaultLength = v; checkinLength = v; refreshLength(); saveSettings(); });
  makeChoices(document.getElementById("default-mode-choices"), MODES, MODE_LABEL,
    function () { return settings.defaultMode; },
    function (v) { settings.defaultMode = v; saveSettings(); });
  const last = loadSaved("lastExport", null);
  document.getElementById("last-export").textContent = last
    ? "Last export: " + new Date(last).toLocaleDateString()
    : (entries.length ? "You haven't exported a backup yet." : "");
}

// Export everything to a .json file (the API key is left out on purpose)
document.getElementById("export-button").addEventListener("click", function () {
  const backup = {
    app: "dream-journal", version: 3, exportedAt: new Date().toISOString(),
    entries: entries, people: people, threads: threads, settings: settings,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = el("a", { href: URL.createObjectURL(blob), download: "dream-journal-" + localDate() + ".json" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  save("lastExport", Date.now());
  showSettings();
});

const importFile = document.getElementById("import-file");
document.getElementById("import-button").addEventListener("click", function () { importFile.click(); });
importFile.addEventListener("change", async function () {
  const file = importFile.files[0];
  importFile.value = "";
  if (!file) return;
  const summaryBox = document.getElementById("import-summary");
  try {
    const summary = importJournal(JSON.parse(await file.text()));
    summaryBox.textContent = describeImport(summary);
  } catch (error) {
    summaryBox.textContent = error instanceof SyntaxError ? "That file isn't valid JSON." : error.message;
  }
  summaryBox.hidden = false;
  showSettings();
});

document.getElementById("delete-all-button").addEventListener("click", function () {
  if (!confirm("Delete ALL your dreams, people, threads and settings on this device? This can't be undone. (Your OpenAI key is kept.)")) return;
  if (prompt("Type DELETE to confirm") !== "DELETE") return;
  entries = []; people = []; threads = []; settings = Object.assign({}, DEFAULT_SETTINGS);
  ["entries", "people", "threads", "settings", "draft", "lastExport"].forEach(function (key) { save(key, null); });
  showSettings();
  alert("Everything was deleted.");
});


// ===== Importing backups and the old app's journal =====
// Understands:
//   - this app's backups (app "dream-journal", version 3)
//   - the old app's "Dream Journal" export (app "dream-journal", version 2)
//   - the old app's "Lanternwood" export (keepsakes, reflections, village characters)
// Anything it can't understand is skipped and counted.
function importJournal(data) {
  if (!data || (data.app !== "dream-journal" && data.app !== "lanternwood")) {
    throw new Error("This file doesn't look like a Dream Journal or Lanternwood export.");
  }
  const isNew = data.app === "dream-journal" && data.version >= 3;
  const summary = { entries: 0, duplicates: 0, people: 0, threads: 0, fragments: 0, rituals: 0, settings: false, skipped: 0 };
  const text = function (v) { return typeof v === "string" ? v : ""; };
  const isDate = function (v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v); };
  const fixTone = function (t) { return TONES.includes(t) ? t : "peaceful"; };   // old "cozy" → peaceful
  const fixMode = function (m) { return m === "morning" ? "morning" : "tonight"; }; // old "evening" → tonight

  // People first, so dreams can point to them. personIdFor maps the file's ids to ours.
  const personIdFor = {};
  function addPerson(name, details) {
    name = text(name).trim();
    if (!name) { summary.skipped++; return null; }
    let person = findPersonByName(name);
    if (!person) {
      person = { id: newId(), name: name, aliases: details.aliases || [], relationship: details.relationship || "",
                 notes: details.notes || "", firstMentioned: details.first || null, lastMentioned: details.last || null };
      people.push(person);
      summary.people++;
    }
    return person;
  }
  (data.people || []).forEach(function (p) {
    if (!p) { summary.skipped++; return; }
    const person = addPerson(p.name, {
      aliases: Array.isArray(p.aliases) ? p.aliases.filter(function (a) { return typeof a === "string"; }) : [],
      relationship: text(p.relationship), notes: text(p.notes),
      first: isDate(p.firstMentioned) ? p.firstMentioned : null, last: isDate(p.lastMentioned) ? p.lastMentioned : null,
    });
    if (person) personIdFor[p.id] = person.id;
  });
  // Lanternwood's village characters become people under the real person's name
  (data.characters || []).forEach(function (c) { addPerson(c && c.realPerson, {}); });

  // Dreams. Ones already here (same time and title) are skipped.
  const seen = new Set(entries.map(function (e) { return e.createdAt + "|" + e.title; }));
  const entryIdFor = {};
  (data.entries || []).forEach(function (e) {
    if (!e || typeof e.story !== "string" || !e.story.trim() || !isDate(e.date)) { summary.skipped++; return; }
    const c = e.checkIn || {};
    const createdAt = isDate(e.createdAt) ? e.createdAt : isDate(e.id) ? e.id : parseDate(e.date.slice(0, 10)).toISOString();
    const title = text(e.title);
    if (seen.has(createdAt + "|" + title)) { summary.duplicates++; return; }
    seen.add(createdAt + "|" + title);

    const fragment = e.fragment || e.keepsake; // keepsakes → fragments
    const entry = {
      id: newId(), date: e.date.slice(0, 10), createdAt: createdAt,
      checkIn: { text: text(c.text), good: text(c.good), bothered: text(c.bothered), noticed: text(c.noticed),
                 ate: text(c.ate), body: text(c.body), surprise: !!c.surprise },
      mood: MOODS.includes(isNew ? e.mood : c.mood) ? (isNew ? e.mood : c.mood) : null,
      tone: fixTone(isNew ? e.tone : c.tone),
      length: LENGTHS.includes(isNew ? e.length : c.length) ? (isNew ? e.length : c.length) : "medium",
      mode: fixMode(isNew ? e.mode : c.mode),
      title: title, story: e.story,
      wakingThought: text(e.wakingThought || e.reflection), // reflections → waking thoughts
      fragment: fragment && fragment.name ? { name: text(fragment.name), description: text(fragment.description) } : null,
      people: [], rituals: {},
    };
    if (entry.fragment) summary.fragments++;

    // Rituals: new backups keep both; the old app kept one ("lantern"/"intention" or "boat"/"worry")
    if (isNew && e.rituals) {
      ["intention", "worry"].forEach(function (kind) {
        const r = e.rituals[kind];
        if (r) { entry.rituals[kind] = { text: text(r.text), at: isDate(r.at) ? r.at : createdAt }; summary.rituals++; }
      });
    } else if (e.ritual) {
      const kind = e.ritual.kind === "worry" || e.ritual.kind === "boat" ? "worry" : "intention";
      entry.rituals[kind] = { text: text(e.ritual.text), at: isDate(e.ritual.at) ? e.ritual.at : createdAt };
      summary.rituals++;
    }

    // Who appeared: new backups store ids; the old app stored names
    (e.people || []).forEach(function (ref) {
      let personId = personIdFor[ref];
      if (!personId && !isNew) {
        const person = addPerson(ref, {});
        personId = person && person.id;
      }
      if (personId && !entry.people.includes(personId)) entry.people.push(personId);
    });

    entryIdFor[e.id] = entry;
    entries.push(entry);
    summary.entries++;
  });

  // The old app's people also listed their dreams by id
  (data.people || []).forEach(function (p) {
    if (!p || !personIdFor[p.id] || !Array.isArray(p.dreamIds)) return;
    p.dreamIds.forEach(function (dreamId) {
      const entry = entryIdFor[dreamId];
      if (entry && !entry.people.includes(personIdFor[p.id])) entry.people.push(personIdFor[p.id]);
    });
  });

  // Threads (ones with the same summary are skipped)
  const knownThreads = new Set(threads.map(function (t) { return t.summary; }));
  (data.threads || []).forEach(function (t) {
    if (!t || !t.summary) { summary.skipped++; return; }
    if (knownThreads.has(t.summary)) return;
    knownThreads.add(t.summary);
    threads.push({ id: newId(), summary: text(t.summary), followUpHint: text(t.followUpHint),
      resolved: !!t.resolved, createdAt: isDate(t.createdAt) ? t.createdAt : new Date().toISOString() });
    summary.threads++;
  });

  // Settings (old names are translated)
  const s = data.settings;
  if (s && typeof s === "object") {
    if (typeof s.literalness === "number") settings.literalness = s.literalness;
    if (s.hardTopics === "soften" || s.hardTopics === "reflect") settings.hardTopics = s.hardTopics;
    if (TONES.includes(s.defaultTone) || s.defaultTone === "cozy") settings.defaultTone = fixTone(s.defaultTone);
    if (LENGTHS.includes(s.defaultLength)) settings.defaultLength = s.defaultLength;
    if (s.defaultMode) settings.defaultMode = fixMode(s.defaultMode);
    if (typeof s.wakingThought === "boolean") settings.wakingThought = s.wakingThought;
    if (typeof s.showReflection === "boolean") settings.wakingThought = s.showReflection;
    if (typeof s.dailyLimit === "number") settings.dailyLimit = s.dailyLimit;
    summary.settings = true;
  }

  sortEntries();
  saveEntries();
  savePeople();
  saveThreads();
  save("settings", settings);
  return summary;
}

function describeImport(s) {
  const plural = function (n, word) { return n + " " + word + (n === 1 ? "" : "s"); };
  let message = "Imported " + plural(s.entries, "dream") + ", " + plural(s.people, "new person").replace("persons", "people") +
    ", " + plural(s.threads, "thread") + ", " + plural(s.fragments, "fragment") + ", " + plural(s.rituals, "ritual") +
    (s.settings ? ", and your settings." : ".");
  if (s.duplicates) message += " Skipped " + s.duplicates + " already here.";
  if (s.skipped) message += " Skipped " + plural(s.skipped, "item") + " it couldn't understand.";
  return message;
}


// ===== Start =====
sortEntries();
applyTheme();
showPage();

// Offline support: keeps the app's files so it opens without internet.
// (Service workers don't run from file://, only when hosted or on localhost.)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(function () {});
}
