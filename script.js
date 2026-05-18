// ===== SETTINGS =====
const rows = 5;
const cols = 4;

// ===== TIMING =====
const FALL_TIME = 450;
const CLEAR_TIME = 400;

// ===== COLORS =====
const colorMap = {
  red: "radial-gradient(circle at 30% 30%, #ff7e7e, #ff3e3e 70%, #a30000)",
  blue: "radial-gradient(circle at 30% 30%, #82ccdd, #0a3d62 70%, #062c43)",
  green: "radial-gradient(circle at 30% 30%, #a2ffaf, #27ae60 70%, #145a32)",
  purple: "radial-gradient(circle at 30% 30%, #d982ff, #8e44ad 70%, #4a235a)",
  gold: "radial-gradient(circle at 30% 30%, #ffeaa7, #f1c40f 70%, #967117)"
};

const colors = Object.keys(colorMap);

// ===== GAME STATE =====
let score = 0;
let timeLeft = 180;
let timerInterval;

let comboMultiplier = 1;
let isProcessing = false;

let vocab = [];
let fullVocab = [];

let masteredVocab = [];   // permanent removals (player matches)
let comboRecycle = [];    // stores ONLY IDs now

let gemBoard = [];

let selectedGem = null;
let selectedCard = null;

// ===== DOM =====
const gemGrid = document.getElementById("gemGrid");
const cardGrid = document.getElementById("cardGrid");
const scoreDisplay = document.getElementById("score");
const timerDisplay = document.getElementById("timer");

// ===== AUDIO =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = "sine") {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.01,
    audioCtx.currentTime + duration
  );

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const playChime = () => playTone(600, 0.25);
const playBuzz = () => playTone(150, 0.3, "square");
const playExplosion = () => playTone(90, 0.2);

// ===== COMBO TEXT =====
function showComboText(text) {
  const div = document.createElement("div");
  div.className = "combo-text";
  div.textContent = text;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1000);
}

// ===== HELPERS =====
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isAnyGemMoving() {
  return document.querySelector('.gem[data-moving="true"]');
}

// =========================================
// VOCAB LOADER (LIMIT 20)
// =========================================

async function loadVocab() {

  if (!window.preloadedVocab || !window.preloadedVocab.length) {
    alert("No Firebase vocabulary loaded.");
    return false;
  }

  vocab = window.preloadedVocab.map((item, index) => ({
    id: index + 1,
    word: item.word,
    definition: item.definition
  }));

  fullVocab = vocab.slice(0, 20);

  masteredVocab = [];
  comboRecycle = [];

  return true;
}

// ===== SCORE =====
function updateScore(val) {
  score += val;
  scoreDisplay.textContent = score;
}

// ===== TIMER =====
function startTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      isProcessing = true;
      alert("Time's up! Final score: " + score);
    }
  }, 1000);
}

// ===== POSITION =====
function positionGem(g) {
  if (!g || !g.element) return;

  const x = g.col * 147;
  const y = g.row * 119;

  g.element.setAttribute("data-moving", "true");
  g.element.style.transform = `translate(${x}px, ${y}px)`;

  setTimeout(() => {
    if (g.element) g.element.setAttribute("data-moving", "false");
  }, FALL_TIME);
}

// ===== GEM =====
function createGemElement(g) {
  const d = document.createElement("div");
  d.className = "gem";
  d.style.background = colorMap[g.color];
  d.dataset.color = g.color;

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = g.word;

  d.appendChild(label);
  d.onclick = () => selectGem(g);
  return d;
}

// ===== BOARD BUILD =====
function buildBoard() {

  gemBoard = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );

  gemGrid.innerHTML = "";

  const items = [...fullVocab].sort(() => Math.random() - 0.5);

  let i = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      const item = items[i++];
      if (!item) continue;

      const g = {
        ...item,
        color: colors[Math.floor(Math.random() * colors.length)],
        row: r,
        col: c
      };

      g.element = createGemElement(g);
      gemGrid.appendChild(g.element);

      gemBoard[r][c] = g;

      positionGem(g);
    }
  }
}

// ===== CARDS =====
function buildCards() {

  cardGrid.innerHTML = "";

  [...fullVocab]
    .sort(() => Math.random() - 0.5)
    .forEach(item => {

      const d = document.createElement("div");
      d.className = "card";
      d.textContent = item.definition;
      d.dataset.id = item.id;
      d.onclick = () => selectCard(d);

      cardGrid.appendChild(d);

    });
}

// ===== SELECTION =====
function selectGem(g) {
  if (isProcessing || isAnyGemMoving()) return;

  if (selectedGem) selectedGem.element.classList.remove("selected");

  selectedGem = g;
  g.element.classList.add("selected");

  tryMatch();
}

function selectCard(card) {
  if (isProcessing || isAnyGemMoving()) return;

  if (selectedCard) selectedCard.classList.remove("selected");

  selectedCard = card;
  card.classList.add("selected");

  tryMatch();
}

// ===== MATCH =====
function tryMatch() {

  if (!selectedGem || !selectedCard) return;

  if (selectedGem.id === Number(selectedCard.dataset.id)) {

    playChime();
    updateScore(10);

    const mid = selectedGem.id;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {

        if (gemBoard[r][c] && gemBoard[r][c].id === mid) {
          gemBoard[r][c].element.remove();
          gemBoard[r][c] = null;
        }
      }
    }

    masteredVocab.push(mid);

    selectedCard.remove();
    resolveBoard();

  } else {
    playBuzz();
    updateScore(-2);
  }

  selectedGem?.element.classList.remove("selected");
  selectedCard?.classList.remove("selected");

  selectedGem = null;
  selectedCard = null;
}

// ===== GRAVITY =====
function applyGravity() {

  let moved = false;

  for (let c = 0; c < cols; c++) {

    let writeRow = rows - 1;

    for (let r = rows - 1; r >= 0; r--) {

      if (gemBoard[r][c] !== null) {

        if (r !== writeRow) {

          const g = gemBoard[r][c];

          gemBoard[writeRow][c] = g;
          gemBoard[r][c] = null;

          g.row = writeRow;
          positionGem(g);

          moved = true;
        }

        writeRow--;
      }
    }
  }

  return moved;
}

// ===== MATCH DETECTION =====
function findMatches() {

  const visited = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );

  const matches = [];

  function flood(r, c, color, group) {

    const stack = [[r, c]];

    while (stack.length) {

      const [cr, cc] = stack.pop();

      if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
      if (visited[cr][cc]) continue;

      const cell = gemBoard[cr][cc];
      if (!cell || cell.color !== color) continue;

      visited[cr][cc] = true;
      group.push(cell);

      stack.push([cr + 1, cc]);
      stack.push([cr - 1, cc]);
      stack.push([cr, cc + 1]);
      stack.push([cr, cc - 1]);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      const cell = gemBoard[r][c];

      if (!cell || visited[r][c]) continue;

      const group = [];
      flood(r, c, cell.color, group);

      if (group.length >= 3) {
        matches.push(...group);
      }
    }
  }

  return [...new Set(matches)];
}

// ===== COMBO CLEAR (FIXED RECYCLING) =====
function clearMatches(matches) {

  if (!matches.length) return;

  playExplosion();

  comboMultiplier++;
  updateScore(matches.length * 5 * comboMultiplier);

  if (comboMultiplier > 1) {
    showComboText(comboMultiplier + "x COMBO!");
  }

  matches.forEach(g => {

    if (g.element) g.element.remove();

    if (gemBoard[g.row]?.[g.col] === g) {
      gemBoard[g.row][g.col] = null;
    }

    // ONLY store ID (FIXED)
    if (!masteredVocab.includes(g.id)) {
      comboRecycle.push(g.id);
    }
  });
}

// ===== COMBO REFILL (FIXED) =====
function refillFromCombo() {

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {

      if (!gemBoard[r][c] && comboRecycle.length) {

        const id = comboRecycle.pop();

        const base = fullVocab.find(v => v.id === id);

        if (!base) continue;

        const g = {
          ...base,
          color: colors[Math.floor(Math.random() * colors.length)],
          row: r,
          col: c
        };

        g.element = createGemElement(g);

        gemGrid.appendChild(g.element);

        gemBoard[r][c] = g;

        positionGem(g);
      }
    }
  }
}

// ===== RESOLVE LOOP =====
async function resolveBoard() {

  isProcessing = true;
  comboMultiplier = 1;

  while (true) {

    let moved = true;

    while (moved) {
      moved = applyGravity();
      if (moved) await wait(FALL_TIME);
    }

    refillFromCombo();

    const matches = findMatches();

    if (!matches.length) break;

    clearMatches(matches);
    await wait(CLEAR_TIME);
  }

  isProcessing = false;
}

// ===== START GAME =====
async function startLoadedGame() {

  score = 0;
  timeLeft = 180;

  selectedGem = null;
  selectedCard = null;

  scoreDisplay.textContent = 0;
  timerDisplay.textContent = 180;

  const loaded = await loadVocab();
  if (!loaded) return;

  buildBoard();
  buildCards();
  startTimer();

  console.log("GemWords started successfully.");
}

window.startLoadedGame = startLoadedGame;

// ===== BOOT =====
(async () => {

  let tries = 0;

  while (!window.preloadedVocab && tries < 30) {
    await wait(200);
    tries++;
  }

  startLoadedGame();

})();
