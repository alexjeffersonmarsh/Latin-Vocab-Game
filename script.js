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
let gemBoard = [];
let selectedGem = null;
let selectedCard = null;
let recyclePool = [];

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

// ===== HELPERS =====
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isAnyGemMoving() {
  return document.querySelector('.gem[data-moving="true"]');
}

// =========================================
// ✅ NEW UNIVERSAL VOCAB LOADER
// =========================================

async function loadVocab() {

  const params = new URLSearchParams(window.location.search);

  // ✅ PRIORITY 1: Firebase (teacher links)
  if (window.preloadedVocab && window.preloadedVocab.length) {

    vocab = window.preloadedVocab.map((item, index) => ({
      id: index + 1,
      word: item.word,
      definition: item.definition
    }));

    fullVocab = vocab.slice(0, 20);
    return true;
  }

  // ✅ PRIORITY 2: legacy JSON support
  const vocabPath = params.get("vocab");

  if (vocabPath) {

    try {
      const response = await fetch(vocabPath);
      const data = await response.json();

      vocab = data.map((item, index) => ({
        id: index + 1,
        word: item.word,
        definition: item.definition
      }));

      fullVocab = vocab.slice(0, 20);
      return true;

    } catch (e) {
      console.error(e);
      alert("Unable to load vocabulary file.");
      return false;
    }
  }

  alert("No vocabulary provided.");
  return false;
}

// ===== CORE UI =====
function updateScore(val) {
  score += val;
  scoreDisplay.textContent = score;
}

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

// ===== POSITION GEM =====
function positionGem(g) {
  if (!g || !g.element) return;

  const xOffset = 147;
  const yOffset = 119;

  const x = g.col * xOffset;
  const y = g.row * yOffset;

  g.element.setAttribute("data-moving", "true");
  g.element.style.transform = `translate(${x}px, ${y}px)`;

  setTimeout(() => {
    if (g.element) {
      g.element.setAttribute("data-moving", "false");
    }
  }, FALL_TIME);
}

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

// ===== BUILD BOARD =====
function buildBoard() {
  gemBoard = Array.from({ length: rows }, () => Array(cols).fill(null));
  gemGrid.innerHTML = "";

  const items = [...fullVocab].sort(() => Math.random() - 0.5);
  let i = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const item = items[i++];
      const color = colors[Math.floor(Math.random() * colors.length)];

      const g = { ...item, color, row: r, col: c };
      g.element = createGemElement(g);
      gemGrid.appendChild(g.element);
      positionGem(g);
      gemBoard[r][c] = g;
    }
  }
}

function buildCards() {
  cardGrid.innerHTML = "";
  [...fullVocab].sort(() => Math.random() - 0.5).forEach(item => {
    const d = document.createElement("div");
    d.className = "card";
    d.textContent = item.definition;
    d.dataset.id = item.id;
    d.onclick = () => selectCard(d);
    cardGrid.appendChild(d);
  });
}

// ===== INTERACTION =====
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

// ===== MATCH LOGIC =====
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

    selectedCard.remove();
    resolveBoard();
  } else {
    playBuzz();
    updateScore(-2);
  }

  if (selectedGem) selectedGem.element.classList.remove("selected");
  if (selectedCard) selectedCard.classList.remove("selected");
  selectedGem = null;
  selectedCard = null;
}

// ===== RESOLVE LOOP =====
async function resolveBoard() {
  isProcessing = true;
  comboMultiplier = 1;

  while (true) {
    applyGravity();
    await wait(FALL_TIME);
    refillFromRecycle();
    await wait(FALL_TIME);

    const matches = findMatches();
    if (!matches.length) break;

    clearMatches(matches);
    await wait(CLEAR_TIME + 250);
  }

  isProcessing = false;
}

// ===== INIT =====
(async function initGame() {

  // ✅ WAIT for Firebase to populate window.preloadedVocab
  await new Promise(resolve => setTimeout(resolve, 200));

  if (await loadVocab()) {
    buildBoard();
    buildCards();
    startTimer();
  }

})();
``
