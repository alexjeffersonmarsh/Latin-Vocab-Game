// ===== SETTINGS =====

const rows = 5;
const cols = 4;

// ===== TIMING =====

const FALL_TIME = 450;
const CLEAR_TIME = 400;

// ===== COLORS =====

const colorMap = {

  red:
    "radial-gradient(circle at 30% 30%, #ff7e7e, #ff3e3e 70%, #a30000)",

  blue:
    "radial-gradient(circle at 30% 30%, #82ccdd, #0a3d62 70%, #062c43)",

  green:
    "radial-gradient(circle at 30% 30%, #a2ffaf, #27ae60 70%, #145a32)",

  purple:
    "radial-gradient(circle at 30% 30%, #d982ff, #8e44ad 70%, #4a235a)",

  gold:
    "radial-gradient(circle at 30% 30%, #ffeaa7, #f1c40f 70%, #967117)"

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

const audioCtx =
  new (window.AudioContext || window.webkitAudioContext)();

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

// ===== COMBO UI =====

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
// VOCAB LOADER
// =========================================

async function loadVocab() {

  const params = new URLSearchParams(window.location.search);

  // FIREBASE FIRST
  if (window.preloadedVocab && window.preloadedVocab.length) {

    vocab = window.preloadedVocab.map((item, index) => ({
      id: index + 1,
      word: item.word,
      definition: item.definition
    }));

    fullVocab = vocab.slice(0, rows * cols);
    recyclePool = [...fullVocab];

    return true;
  }

  // JSON FALLBACK
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

      fullVocab = vocab.slice(0, rows * cols);
      recyclePool = [...fullVocab];

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
    if (g.element) {
      g.element.setAttribute("data-moving", "false");
    }
  }, FALL_TIME);

}

// ===== CREATE GEM =====

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

// ===== BOARD =====

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
        id: item.id,
        color: colors[Math.floor(Math.random() * colors.length)],
        row: r,
        col: c
      };

      g.element = createGemElement(g);

      gemGrid.appendChild(g.element);

      positionGem(g);

      gemBoard[r][c] = g;
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

// ===== SELECT =====

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

          recyclePool.push({
            id: gemBoard[r][c].id,
            word: gemBoard[r][c].word,
            definition: gemBoard[r][c].definition
          });

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

// ===== GRAVITY =====

function applyGravity() {

  let moved = false;

  for (let c = 0; c < cols; c++) {

    for (let r = rows - 1; r >= 0; r--) {

      if (gemBoard[r][c] === null) {

        for (let rr = r - 1; rr >= 0; rr--) {

          if (gemBoard[rr][c]) {

            const g = gemBoard[rr][c];

            gemBoard[r][c] = g;
            gemBoard[rr][c] = null;

            g.row = r;

            positionGem(g);

            moved = true;

            break;

          }

        }

      }

    }

  }

  return moved;
}

// ===== REFILL =====

function refillFromRecycle() {

  for (let c = 0; c < cols; c++) {

    for (let r = 0; r < rows; r++) {

      if (gemBoard[r][c] === null) {

        if (!recyclePool.length) continue;

        const item = recyclePool.shift();

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

}

// ===== MATCH DETECTION =====

function findMatches() {

  const matches = [];

  // horizontal
  for (let r = 0; r < rows; r++) {

    let streak = 1;

    for (let c = 1; c < cols; c++) {

      const a = gemBoard[r][c];
      const b = gemBoard[r][c - 1];

      if (a && b && a.color === b.color) {

        streak++;

      } else {

        if (streak >= 3) {

          for (let i = 0; i < streak; i++) {
            matches.push(gemBoard[r][c - 1 - i]);
          }

        }

        streak = 1;
      }
    }

    if (streak >= 3) {

      for (let i = 0; i < streak; i++) {
        matches.push(gemBoard[r][cols - 1 - i]);
      }

    }
  }

  // vertical
  for (let c = 0; c < cols; c++) {

    let streak = 1;

    for (let r = 1; r < rows; r++) {

      const a = gemBoard[r][c];
      const b = gemBoard[r - 1][c];

      if (a && b && a.color === b.color) {

        streak++;

      } else {

        if (streak >= 3) {

          for (let i = 0; i < streak; i++) {
            matches.push(gemBoard[r - 1 - i][c]);
          }

        }

        streak = 1;
      }
    }

    if (streak >= 3) {

      for (let i = 0; i < streak; i++) {
        matches.push(gemBoard[rows - 1 - i][c]);
      }

    }
  }

  return [...new Set(matches)];
}

// ===== CLEAR MATCHES =====

function clearMatches(matches) {

  if (!matches.length) return;

  playExplosion();

  comboMultiplier++;

  updateScore(matches.length * 5 * comboMultiplier);

  if (comboMultiplier > 1) {
    showComboText(comboMultiplier + "x COMBO!");
  }

  matches.forEach(g => {

    recyclePool.push({
      id: g.id,
      word: g.word,
      definition: g.definition
    });

    if (g.element) g.element.remove();

    gemBoard[g.row][g.col] = null;

  });

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

    refillFromRecycle();
    await wait(FALL_TIME);

    const matches = findMatches();

    if (!matches.length) break;

    clearMatches(matches);
    await wait(CLEAR_TIME);

  }

  isProcessing = false;
}

// ===== COMBO UI =====

function showComboText(text) {

  const div = document.createElement("div");
  div.className = "combo-text";
  div.textContent = text;

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 1000);
}

// ===== START GAME =====

async function startLoadedGame() {

  score = 0;
  timeLeft = 180;

  selectedGem = null;
  selectedCard = null;

  recyclePool = [];

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

// ===== AUTO START =====

(async () => {

  const params = new URLSearchParams(window.location.search);

  if (params.get("id") || params.get("set")) return;

  if (params.get("vocab")) startLoadedGame();

})();
