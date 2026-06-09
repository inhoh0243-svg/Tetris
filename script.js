// ============================================================
// 테트리스 핵심 데이터 · 렌더링 · 키보드 조작
// ============================================================

// --- 캔버스 및 보드 크기 상수 ---

/** 보드 가로 칸 수 */
const COLS = 10;

/** 보드 세로 칸 수 */
const ROWS = 20;

/** 캔버스 DOM 요소 */
const canvas = document.getElementById('game-board');

/** 2D 렌더링 컨텍스트 */
const ctx = canvas.getContext('2d');

/** 한 칸의 픽셀 크기 (캔버스 300×600 ÷ 10×20) */
const BLOCK_SIZE = canvas.width / COLS;

/** 다음 블록 미리보기 캔버스 */
const nextCanvas = document.getElementById('next-board');

/** 다음 블록 미리보기 렌더링 컨텍스트 */
const nextCtx = nextCanvas.getContext('2d');

/** 미리보기 격자 한 칸 크기 (96×96 ÷ 4×4) */
const NEXT_BLOCK_SIZE = nextCanvas.width / 4;


// --- (1) 10×20 보드 그리드 ---

/**
 * 빈 보드를 생성한다.
 * 각 칸은 null(비어 있음)이거나 블록 색상 문자열을 담는다.
 * @returns {Array<Array<string|null>>}
 */
function createBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );
}

/** 현재 게임 보드 상태 (고정된 블록들이 쌓이는 그리드) */
const board = createBoard();


// --- (2) 7가지 테트로미노 정의 (모양 + 색상) ---

/**
 * 테트로미노 종류별 정보
 * shape: 4×4 행렬, 1은 블록이 있는 칸, 0은 빈 칸
 * color: 해당 블록의 표시 색상
 */
const TETROMINOES = {
  // I형 — 가로 4칸 직선 (시안)
  I: {
    color: '#00f0f0',
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // O형 — 2×2 정사각형 (노랑)
  O: {
    color: '#f0f000',
    shape: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // T형 — T자 모양 (보라)
  T: {
    color: '#a000f0',
    shape: [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // S형 — S자 지그재그 (초록)
  S: {
    color: '#00f000',
    shape: [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // Z형 — Z자 지그재그 (빨강)
  Z: {
    color: '#f00000',
    shape: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // J형 — J자 모양 (파랑)
  J: {
    color: '#0000f0',
    shape: [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },

  // L형 — L자 모양 (주황)
  L: {
    color: '#f0a000',
    shape: [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
};


// --- 현재 떨어지는 블록 (미리보기용, 맨 위 중앙에 배치) ---

/**
 * 테트로미노를 보드 가로 중앙에 맞추기 위한 시작 x 좌표를 계산한다.
 * @param {string} type - 테트로미노 종류 ('I', 'O', 'T' 등)
 * @returns {number} 보드 그리드 기준 x 좌표
 */
function getSpawnX(type) {
  const shape = TETROMINOES[type].shape;
  const shapeWidth = shape[0].length;
  return Math.floor((COLS - shapeWidth) / 2);
}

/** 테트로미노 종류 목록 (랜덤 스폰용) */
const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** 레벨 1 기준 낙하 간격 (밀리초) */
const BASE_DROP_INTERVAL = 500;

/** 레벨당 낙하 간격 감소량 (밀리초) */
const DROP_SPEED_PER_LEVEL = 40;

/** 최소 낙하 간격 (밀리초) */
const MIN_DROP_INTERVAL = 100;

/** 레벨 상승에 필요한 점수 (1000점마다 1레벨) */
const SCORE_PER_LEVEL = 1000;

/** 다음에 등장할 블록 종류 */
let nextPieceType = null;

/** 지금 화면에 그려지는 활성 블록 */
const currentPiece = {
  type: 'T',
  x: 0,
  y: 0,
  shape: [], // 스폰 시 복사되며, 회전할 때마다 갱신됨
};

/** 게임 종료 여부 (스폰 불가 시 true) */
let gameOver = false;

/** 자동 낙하 타이머 ID */
let dropTimer = null;

/** 현재 점수 */
let score = 0;

/** 지금까지 클리어한 총 라인 수 */
let totalLines = 0;

/** 동시에 지운 줄 수에 따른 점수 배점 */
const LINE_SCORES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

/** 점수 표시 DOM 요소 */
const scoreElement = document.getElementById('score');

/** 라인 수 표시 DOM 요소 */
const linesElement = document.getElementById('lines');

/** 레벨 표시 DOM 요소 */
const levelElement = document.getElementById('level');

/** 게임 오버 오버레이 */
const gameOverOverlay = document.getElementById('game-over-overlay');

/** 다시 시작 버튼 */
const restartButton = document.getElementById('restart-btn');


// --- 충돌 판정 ---

/**
 * 주어진 위치에 블록을 놓을 수 있는지 검사한다.
 * 보드 경계(좌·우·아래)를 벗어나거나, 이미 고정된 블록과 겹치면 false.
 *
 * @param {string} type - 테트로미노 종류
 * @param {number} x - 보드 그리드 기준 x 좌표
 * @param {number} y - 보드 그리드 기준 y 좌표
 * @param {number[][]} [shape] - 검사할 모양 (생략 시 해당 타입의 기본 모양)
 * @returns {boolean} 배치 가능하면 true
 */
function isValidPosition(type, x, y, shape = TETROMINOES[type].shape) {

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      // shape에서 빈 칸(0)은 검사하지 않음
      if (!shape[row][col]) continue;

      const boardX = x + col;
      const boardY = y + row;

      // 좌·우 경계 초과
      if (boardX < 0 || boardX >= COLS) {
        return false;
      }

      // 아래 경계 초과 (바닥)
      if (boardY >= ROWS) {
        return false;
      }

      // 보드 위쪽(y < 0)은 스폰 직후 일부 칸이 보이지 않는 구간이므로 통과
      if (boardY < 0) continue;

      // 이미 고정된 블록과 겹침
      if (board[boardY][boardX]) {
        return false;
      }
    }
  }

  return true;
}


// --- 블록 고정 · 스폰 · 낙하 ---

/**
 * shape 행렬을 깊은 복사한다.
 * @param {number[][]} shape
 * @returns {number[][]}
 */
function copyShape(shape) {
  return shape.map((row) => [...row]);
}

/**
 * 4×4 행렬을 시계 방향으로 90° 회전한다.
 * @param {number[][]} shape
 * @returns {number[][]}
 */
function rotateShapeClockwise(shape) {
  const size = shape.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      rotated[col][size - 1 - row] = shape[row][col];
    }
  }

  return rotated;
}

/**
 * 활성 블록을 보드 그리드에 고정한다.
 * 각 칸의 색상을 board 배열에 기록한다.
 */
function lockPiece() {
  const { type, x, y, shape } = currentPiece;
  const { color } = TETROMINOES[type];

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;

      const boardX = x + col;
      const boardY = y + row;

      // 보드 안에 있는 칸만 기록 (위쪽 잘린 부분은 무시)
      if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        board[boardY][boardX] = color;
      }
    }
  }
}

/**
 * 한 행이 가득 찼는지 검사한다.
 * @param {number} row - 행 인덱스
 * @returns {boolean}
 */
function isRowFull(row) {
  return board[row].every((cell) => cell !== null);
}

/**
 * 가득 찬 줄을 삭제하고 위 블록을 아래로 내린다.
 * 여러 줄이 동시에 지워질 수 있다.
 * @returns {number} 이번에 지운 줄 수
 */
function clearLines() {
  const remainingRows = [];
  let clearedCount = 0;

  // 가득 찬 줄은 제외하고, 나머지 행만 모은다
  for (let row = 0; row < ROWS; row++) {
    if (isRowFull(row)) {
      clearedCount += 1;
    } else {
      remainingRows.push(board[row]);
    }
  }

  if (clearedCount === 0) {
    return 0;
  }

  // 위쪽에 빈 줄을 추가해 보드 크기(20행)를 유지한다
  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array.from({ length: COLS }, () => null));
  }

  // board 배열을 갱신된 행으로 교체
  for (let row = 0; row < ROWS; row++) {
    board[row] = remainingRows[row];
  }

  // 지운 줄 수에 따라 점수 가산
  const points = LINE_SCORES[clearedCount] ?? 0;
  score += points;
  totalLines += clearedCount;
  updateScoreDisplay();
  updateDropSpeed();

  return clearedCount;
}

/**
 * 현재 점수에 따른 레벨을 계산한다.
 * @returns {number}
 */
function calculateLevel() {
  return Math.floor(score / SCORE_PER_LEVEL) + 1;
}

/**
 * 현재 레벨에 맞는 낙하 간격을 계산한다.
 * @returns {number}
 */
function getDropInterval() {
  const level = calculateLevel();
  return Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * DROP_SPEED_PER_LEVEL);
}

/**
 * 점수 변화에 따라 낙하 속도를 갱신한다.
 */
function updateDropSpeed() {
  if (gameOver || !dropTimer) return;

  clearInterval(dropTimer);
  dropTimer = setInterval(tick, getDropInterval());
}

/**
 * 우측 패널의 점수·레벨·라인 수를 화면에 반영한다.
 */
function updateScoreDisplay() {
  scoreElement.textContent = String(score);
  levelElement.textContent = String(calculateLevel());
  linesElement.textContent = String(totalLines);
}

/**
 * 랜덤 테트로미노 종류를 반환한다.
 * @returns {string}
 */
function randomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

/**
 * 다음 블록 큐를 초기화한다.
 */
function initPieceQueue() {
  nextPieceType = randomPieceType();
}

/**
 * 큐에서 다음 블록을 꺼내 맨 위 중앙에 스폰한다.
 * @returns {boolean} 스폰 성공 여부
 */
function spawnPiece() {
  const type = nextPieceType;
  nextPieceType = randomPieceType();

  currentPiece.type = type;
  currentPiece.x = getSpawnX(type);
  currentPiece.y = 0;
  currentPiece.shape = copyShape(TETROMINOES[type].shape);

  drawNextPreview();

  return isValidPosition(type, currentPiece.x, currentPiece.y, currentPiece.shape);
}

/**
 * 블록을 한 칸 아래로 이동을 시도한다.
 * @returns {boolean} 이동에 성공하면 true
 */
function tryMoveDown() {
  const { type, x, y, shape } = currentPiece;

  if (isValidPosition(type, x, y + 1, shape)) {
    currentPiece.y += 1;
    return true;
  }

  return false;
}

/**
 * 현재 블록을 고정하고 새 블록을 스폰한다.
 */
function lockAndSpawn() {
  lockPiece();
  clearLines();

  if (!spawnPiece()) {
    endGame();
    draw();
  }
}

/**
 * 보드 그리드를 비운다.
 */
function resetBoard() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      board[row][col] = null;
    }
  }
}

/**
 * 게임 오버 상태로 전환한다.
 * 낙하를 멈추고 오버레이를 표시한다.
 */
function endGame() {
  gameOver = true;
  clearInterval(dropTimer);
  dropTimer = null;

  gameOverOverlay.classList.remove('hidden');
  gameOverOverlay.setAttribute('aria-hidden', 'false');
}

/**
 * 게임을 처음부터 다시 시작한다.
 */
function restartGame() {
  if (dropTimer) {
    clearInterval(dropTimer);
    dropTimer = null;
  }

  gameOver = false;
  score = 0;
  totalLines = 0;

  resetBoard();
  updateScoreDisplay();

  gameOverOverlay.classList.add('hidden');
  gameOverOverlay.setAttribute('aria-hidden', 'true');

  initPieceQueue();
  spawnPiece();
  draw();

  dropTimer = setInterval(tick, getDropInterval());
}

/**
 * 한 틱마다 블록을 한 칸 아래로 이동한다.
 * 더 이상 내려갈 수 없으면 고정 후 새 블록을 스폰한다.
 */
function tick() {
  if (gameOver) return;

  if (!tryMoveDown()) {
    lockAndSpawn();
  }

  draw();
}

/**
 * 좌우로 한 칸 이동한다.
 * @param {number} dx - 이동 방향 (-1: 왼쪽, 1: 오른쪽)
 */
function movePiece(dx) {
  const { type, x, y, shape } = currentPiece;

  if (isValidPosition(type, x + dx, y, shape)) {
    currentPiece.x += dx;
    draw();
  }
}

/**
 * 시계 방향으로 90° 회전한다.
 * 벽이나 다른 블록에 막히면 회전하지 않는다.
 */
function rotatePiece() {
  const { type, x, y, shape } = currentPiece;
  const rotated = rotateShapeClockwise(shape);

  if (isValidPosition(type, x, y, rotated)) {
    currentPiece.shape = rotated;
    draw();
  }
}

/**
 * 아래 화살표: 한 칸 빠르게 낙하 (soft drop).
 * 더 내려갈 수 없으면 즉시 고정한다.
 */
function softDrop() {
  if (!tryMoveDown()) {
    lockAndSpawn();
  }

  draw();
}

/**
 * 스페이스바: 바닥까지 즉시 낙하 (hard drop) 후 고정.
 */
function hardDrop() {
  while (tryMoveDown()) {}
  lockAndSpawn();
  draw();
}


// --- 키보드 입력 ---

/**
 * 키보드 이벤트를 처리한다.
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
  if (gameOver) return;

  switch (event.code) {
    case 'ArrowLeft':
      event.preventDefault();
      movePiece(-1);
      break;

    case 'ArrowRight':
      event.preventDefault();
      movePiece(1);
      break;

    case 'ArrowDown':
      event.preventDefault();
      softDrop();
      break;

    case 'ArrowUp':
      event.preventDefault();
      rotatePiece();
      break;

    case 'Space':
      event.preventDefault();
      hardDrop();
      break;
  }
}

document.addEventListener('keydown', handleKeyDown);


// --- (3) 그리기 함수 ---

/**
 * 보드 배경과 격자선을 그린다.
 */
function drawGrid() {
  // 배경을 검은색으로 채움
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 격자선 색상 및 선 두께 설정
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;

  // 세로 격자선
  for (let col = 0; col <= COLS; col++) {
    const x = col * BLOCK_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // 가로 격자선
  for (let row = 0; row <= ROWS; row++) {
    const y = row * BLOCK_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

/**
 * 지정한 캔버스에 블록 한 칸을 그린다.
 * @param {CanvasRenderingContext2D} context
 * @param {number} col - 열 인덱스
 * @param {number} row - 행 인덱스
 * @param {string} color - 블록 색상
 * @param {number} cellSize - 한 칸 픽셀 크기
 */
function drawCellOn(context, col, row, color, cellSize) {
  const x = col * cellSize;
  const y = row * cellSize;
  const padding = 1;

  context.fillStyle = color;
  context.fillRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2);

  context.fillStyle = 'rgba(255, 255, 255, 0.25)';
  context.fillRect(x + padding, y + padding, cellSize - padding * 2, 3);
}

/**
 * 메인 보드에 고정된 블록 한 칸을 그린다.
 * @param {number} col - 열 인덱스 (0 ~ COLS-1)
 * @param {number} row - 행 인덱스 (0 ~ ROWS-1)
 * @param {string} color - 블록 색상
 */
function drawCell(col, row, color) {
  drawCellOn(ctx, col, row, color, BLOCK_SIZE);
}

/**
 * 보드에 이미 고정된 블록들을 그린다.
 */
function drawBoard() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = board[row][col];
      if (color) {
        drawCell(col, row, color);
      }
    }
  }
}

/**
 * 현재 떨어지는(활성) 블록을 그린다.
 */
function drawCurrentPiece() {
  const { type, x, y, shape } = currentPiece;
  const { color } = TETROMINOES[type];

  // shape 행렬을 순회하며 1인 칸만 화면에 그림
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        drawCell(x + col, y + row, color);
      }
    }
  }
}

/**
 * 다음 블록 미리보기 영역을 그린다.
 */
function drawNextPreview() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPieceType) return;

  const { shape, color } = TETROMINOES[nextPieceType];

  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (shape[row][col]) {
        drawCellOn(nextCtx, col, row, color, NEXT_BLOCK_SIZE);
      }
    }
  }
}

/**
 * 전체 화면을 갱신한다.
 * 격자 → 고정 블록 → 활성 블록 순서로 그린다.
 */
function draw() {
  drawGrid();
  drawBoard();

  // 게임 오버 시 활성 블록은 그리지 않음
  if (!gameOver) {
    drawCurrentPiece();
  }
}

// --- 게임 시작 ---

restartButton.addEventListener('click', restartGame);

// 첫 블록 스폰 후 게임 시작
restartGame();
