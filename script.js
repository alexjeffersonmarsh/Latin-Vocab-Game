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

// ===== DEBUG VALIDATOR =====
function validateBoard() {

  const seen = new Set();

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) {

      const g = gemBoard[r][c];

      if (!g) continue;

      if (seen.has(g)) {
        console.error("DUPLICATE GEM REFERENCE", g);
      }

      seen.add(g);

      if (g.row !== r || g.col !== c) {
        console.error("POSITION DESYNC", g, r, c);
      }
    }
  }
}

// ===== LOAD VOCAB =====
function loadVocabFromStorage() {

  const params = new URLSearchParams(window.location.search);

  const raw = params.get("list");

  if (!raw) return false;

  const saved = localStorage.getItem(
    "vocab_" + decodeURIComponent(raw)
  );

  if (!saved) return false;

  vocab = [];

  let id = 1;

  saved.split("\n").forEach(line => {

    const parts = line.split(",");

    if (parts.length >= 2) {

      vocab.push({
        id: id++,
        word: parts[0].trim(),
        definition: parts[1].trim()
      });
    }
  });

  fullVocab = vocab.slice(0, 20);

  return true;
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

// ===== POSITIONING =====
function positionGem(g) {

  if (!g || !g.element) return;

  const xOffset = 147;
  const yOffset = 119;

  g.element.setAttribute("data-moving", "true");

  const x = g.col * xOffset;
  const y = g.row * yOffset;

  g.element.style.transform =
    `translate(${x}px, ${y}px)`;

  g.element.dataset.row = g.row;
  g.element.dataset.col = g.col;

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

// ===== BOARD BUILD =====
function buildBoard() {

  gemBoard = Array.from(
    { length: rows },
    () => Array(cols).fill(null)
  );

  gemGrid.innerHTML = "";

  const items = [...fullVocab]
    .sort(() => Math.random() - 0.5);

  let i = 0;

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) {

      let item = items[i++];

      let color =
        colors[Math.floor(Math.random() * colors.length)];

      let g = {
        ...item,
        color,
        row: r,
        col: c
      };

      g.element = createGemElement(g);

      positionGem(g);

      gemGrid.appendChild(g.element);

      gemBoard[r][c] = g;
    }
  }
}

function buildCards() {

  cardGrid.innerHTML = "";

  [...fullVocab]
    .sort(() => Math.random() - 0.5)
    .forEach(item => {

      let d = document.createElement("div");

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

  if (selectedGem) {
    selectedGem.element.classList.remove("selected");
  }

  selectedGem = g;

  g.element.classList.add("selected");

  tryMatch();
}

function selectCard(card) {

  if (isProcessing || isAnyGemMoving()) return;

  if (selectedCard) {
    selectedCard.classList.remove("selected");
  }

  selectedCard = card;

  card.classList.add("selected");

  tryMatch();
}

function tryMatch() {

  if (!selectedGem || !selectedCard) return;

  if (
    selectedGem.id === Number(selectedCard.dataset.id)
  ) {

    playChime();

    updateScore(10);

    const mid = selectedGem.id;

    for (let r = 0; r < rows; r++) {

      for (let c = 0; c < cols; c++) {

        if (
          gemBoard[r][c] &&
          gemBoard[r][c].id === mid
        ) {

          gemBoard[r][c].element.remove();

          gemBoard[r][c] = null;
        }
      }
    }

    selectedCard.remove();

    if (
      document.querySelectorAll(".card").length === 0
    ) {

      handleWin();

    } else {

      resolveBoard();
    }

  } else {

    playBuzz();

    updateScore(-2);
  }

  if (selectedGem) {
    selectedGem.element.classList.remove("selected");
  }

  if (selectedCard) {
    selectedCard.classList.remove("selected");
  }

  selectedGem = null;
  selectedCard = null;
}

function handleWin() {

  clearInterval(timerInterval);

  isProcessing = true;

  const timeBonus = timeLeft * 25;

  setTimeout(() => {

    alert(`CLEARED!\nFinal Score: ${score + timeBonus}`);

    updateScore(timeBonus);

  }, 600);
}

// ===== COMBO TEXT =====
function showComboText(mult) {

  const text = document.createElement("div");

  text.className = "combo-text";

  text.textContent =
    mult < 2
      ? "COMBO CLEAR!"
      : "x" + mult + " COMBO!";

  text.style.position = "absolute";
  text.style.left = "50%";
  text.style.top = "40%";
  text.style.transform = "translate(-50%, -50%)";
  text.style.zIndex = "9999";
  text.style.pointerEvents = "none";

  gemGrid.appendChild(text);

  setTimeout(() => {

    if (text.parentNode) {
      text.remove();
    }

  }, 1000);
}

// ===== MATCH FINDER =====
function findMatches() {

  const visited = Array.from(
    { length: rows },
    () => Array(cols).fill(false)
  );

  const matchSet = new Set();

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) {

      if (gemBoard[r][c] && !visited[r][c]) {

        const color = gemBoard[r][c].color;

        const cluster = [];

        const stack = [[r, c]];

        visited[r][c] = true;

        while (stack.length) {

          const [cr, cc] = stack.pop();

          cluster.push(gemBoard[cr][cc]);

          [
            [cr - 1, cc],
            [cr + 1, cc],
            [cr, cc - 1],
            [cr, cc + 1]
          ].forEach(([nr, nc]) => {

            if (
              nr >= 0 &&
              nr < rows &&
              nc >= 0 &&
              nc < cols &&
              !visited[nr][nc] &&
              gemBoard[nr][nc] &&
              gemBoard[nr][nc].color === color
            ) {

              visited[nr][nc] = true;

              stack.push([nr, nc]);
            }
          });
        }

        if (cluster.length >= 3) {
          cluster.forEach(g => matchSet.add(g));
        }
      }
    }
  }

  return [...matchSet];
}

// ===== CLEAR MATCHES =====
function clearMatches(matches) {

  if (!matches.length) return;

  playExplosion();

  updateScore(20 * comboMultiplier);

  showComboText(comboMultiplier);

  comboMultiplier++;

  const matchSet = new Set(matches);

  for (let r = 0; r < rows; r++) {

    for (let c = 0; c < cols; c++) {

      const g = gemBoard[r][c];

      if (g && matchSet.has(g)) {

        recyclePool.push({
          id: g.id,
          word: g.word,
          definition: g.definition
        });

        const el = g.element;

        el.classList.add("fade-out");

        gemBoard[r][c] = null;

        setTimeout(() => {

          if (el && el.parentNode) {
            el.remove();
          }

        }, CLEAR_TIME);
      }
    }
  }
}

// ===== GRAVITY =====
function applyGravity() {

  for (let c = 0; c < cols; c++) {

    let writeRow = rows - 1;

    for (let r = rows - 1; r >= 0; r--) {

      let g = gemBoard[r][c];

      if (g) {

        if (r !== writeRow) {

          gemBoard[writeRow][c] = g;

          gemBoard[r][c] = null;

          g.row = writeRow;
          g.col = c;

          positionGem(g);
        }

        writeRow--;
      }
    }

    for (let r = writeRow; r >= 0; r--) {
      gemBoard[r][c] = null;
    }
  }
}

// ===== REFILL =====
function refillFromRecycle() {

  for (let c = 0; c < cols; c++) {

    // IMPORTANT: TOP DOWN
    for (let r = 0; r < rows; r++) {

      if (
        !gemBoard[r][c] &&
        recyclePool.length
      ) {

        let item = recyclePool.shift();

        let color =
          colors[
            Math.floor(Math.random() * colors.length)
          ];

        let g = {
          ...item,
          color,
          row: -1,
          col: c
        };

        g.element = createGemElement(g);

        g.element.style.transition = "none";

        g.element.style.left =
          (c * 147) + "px";

        g.element.style.top = "-150px";

        gemGrid.appendChild(g.element);

        void g.element.offsetHeight;

        gemBoard[r][c] = g;

        setTimeout(() => {

          if (!g.element) return;

          g.element.style.transition = "";

          g.row = r;

          positionGem(g);

        }, 50);
      }
    }
  }
}

// ===== RESOLVE LOOP =====
async function resolveBoard() {

  isProcessing = true;

  comboMultiplier = 1;

  while (true) {

    validateBoard();

    applyGravity();

    await wait(FALL_TIME);

    refillFromRecycle();

    await wait(FALL_TIME);

    validateBoard();

    const matches = findMatches();

    if (!matches.length) {
      break;
    }

    clearMatches(matches);

    // IMPORTANT:
    // Gives combo text time to appear
    await wait(CLEAR_TIME + 250);
  }

  isProcessing = false;
}

// ===== INIT =====
if (loadVocabFromStorage()) {

  buildBoard();

  buildCards();

  startTimer();
}
