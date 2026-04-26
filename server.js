import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const IMAGES_DIR = path.join(__dirname, "public", "images");
const DIST_DIR = path.join(__dirname, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

function loadAllImages() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.warn(`images folder not found: ${IMAGES_DIR}`);
    return [];
  }

  const entries = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });

  const images = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => `/images/${name}`);

  console.log(`loaded ${images.length} images from public/images`);
  return images;
}

const allImages = loadAllImages();

const TURN_SECONDS = 30;
const DEFAULT_BOT_COUNT = 2;
const MAX_BOTS = 6;
const BOT_NAME_POOL = [
  "Netanyahu",
  "Biden",
  "autisticgamer2002",
  "Mr. Iron Dad Beam",
  "just a cat",
  "Big Dill",
  "Rose",
  "Markiplier",
  "Custom Grow 420",
  "Steve",
  "Luffy",
  "Nova Online",
  "Cyrexx",
  "Ichigo",
  "Goku",
  "Itachi",
  "Mr. President",
  "Ash Ketchum",
];
const RESULT_SECONDS = 4;
const SCORE_LIMIT = 12;
const BOT_ONLY_ROOM_TTL_MS =
  Number.parseInt(process.env.BOT_ONLY_ROOM_TTL_MS, 10) || 10 * 60 * 1000;
const ROOM_CLEANUP_INTERVAL_MS = 30 * 1000;
const BOT_PICK_DELAY_MIN_MS =
  Number.parseInt(process.env.BOT_PICK_DELAY_MIN_MS, 10) || 1800;
const BOT_PICK_DELAY_MAX_MS =
  Number.parseInt(process.env.BOT_PICK_DELAY_MAX_MS, 10) || 4200;
const BOT_JUDGE_DELAY_MIN_MS =
  Number.parseInt(process.env.BOT_JUDGE_DELAY_MIN_MS, 10) || 3900;
const BOT_JUDGE_DELAY_MAX_MS =
  Number.parseInt(process.env.BOT_JUDGE_DELAY_MAX_MS, 10) || 5900;

const rooms = new Map();
const playerSockets = new Map();

/* ---------------- helpers ---------------- */

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomDelay(min, max) {
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(low, max);
  return low + Math.random() * (high - low);
}

function makeDeck() {
  const expanded = [];
  for (let i = 0; i < 4; i += 1) {
    expanded.push(...allImages.map((img) => `${img}?v=${i}`));
  }
  return shuffle(expanded);
}

function draw(deck, count) {
  return {
    cards: deck.slice(0, count),
    deck: deck.slice(count),
  };
}

function refillHand(hand, deck, target = 5) {
  if (hand.length >= target) return { hand, deck };
  const needed = target - hand.length;
  const drawn = draw(deck, needed);
  return {
    hand: [...hand, ...drawn.cards],
    deck: drawn.deck,
  };
}

function normalizeRoom(room) {
  return (
    String(room || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 16) || "orchard"
  );
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 18);
}

function normalizeColor(color, fallback) {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function normalizeNameColor(nameColor = {}) {
  return {
    inner: normalizeColor(nameColor.inner, "#ffffff"),
    glow: normalizeColor(nameColor.glow, "#c96b3b"),
  };
}

function normalizeBotCount(botCount) {
  const parsed = Number.parseInt(botCount, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BOT_COUNT;
  return Math.max(0, Math.min(MAX_BOTS, parsed));
}

function isBot(player) {
  return Boolean(player?.bot);
}

function hasLiveHuman(room) {
  return room.players.some(
    (player) =>
      !isBot(player) &&
      player.socketId &&
      io.sockets.sockets.has(player.socketId),
  );
}

function liveHumanCount(room) {
  return room.players.filter(
    (player) =>
      !isBot(player) &&
      player.socketId &&
      io.sockets.sockets.has(player.socketId),
  ).length;
}

function getPlayer(room, playerName) {
  const cleanName = normalizeName(playerName);
  return room.players.find((p) => p.name === cleanName);
}

function refreshSocketRoom(socket, room, playerName) {
  const player = getPlayer(room, playerName);
  if (!player) return null;
  socket.join(room.roomCode);
  player.socketId = socket.id;
  playerSockets.set(socket.id, {
    roomCode: room.roomCode,
    playerName: player.name,
  });
  markRoomOccupancy(room);
  return player;
}

function emitRoom(room) {
  io.to(room.roomCode).emit("room_state", room);
}

function markRoomOccupancy(room) {
  if (hasLiveHuman(room)) {
    room.botOnlySince = null;
    return;
  }

  room.botOnlySince = room.botOnlySince || Date.now();
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);

  for (const [socketId, data] of playerSockets.entries()) {
    if (data.roomCode === roomCode) {
      playerSockets.delete(socketId);
    }
  }
}

function addFeed(room, user, text, type = "system") {
  room.feed.push({ user, text, type, time: Date.now() });
  if (room.feed.length > 100) {
    room.feed = room.feed.slice(-100);
  }
}

function nonJudgePlayers(room) {
  const judgeName = room.players[room.judgeIndex]?.name;
  return room.players.filter((p) => p.name !== judgeName);
}

function everyoneSubmitted(room) {
  return nonJudgePlayers(room).every((p) => room.submissions[p.name]);
}

function getOrCreateRoom(roomCode, botCount = DEFAULT_BOT_COUNT) {
  const key = normalizeRoom(roomCode);
  if (!rooms.has(key)) {
    rooms.set(key, createRoom(key, botCount));
  }
  return rooms.get(key);
}

function makeBotPlayers(count, existingNames = new Set()) {
  const names = shuffle(BOT_NAME_POOL).filter(
    (name) => !existingNames.has(name.toLowerCase()),
  );

  return names.slice(0, count).map((name) => ({
    name,
    socketId: null,
    hand: [],
    bot: true,
    nameColor: {
      inner: "#d8f5ff",
      glow: "#66ccff",
    },
  }));
}

function ensureBotCount(room, botCount) {
  if (room.phase !== "lobby") return;
  const requestedBots = normalizeBotCount(botCount);
  const currentBots = room.players.filter((player) => player.bot).length;
  if (currentBots >= requestedBots) return;

  const remainingSlots = Math.max(0, 8 - room.players.length);
  const botSlots = Math.min(requestedBots - currentBots, remainingSlots);
  if (!botSlots) return;

  const existingNames = new Set(
    room.players.map((player) => player.name.toLowerCase()),
  );
  const bots = makeBotPlayers(botSlots, existingNames);
  room.players.push(...bots);
  bots.forEach((bot) => {
    room.scores[bot.name] = room.scores[bot.name] || 0;
  });
}

function serializeRoomSummary(room) {
  const bots = room.players.filter((player) => player.bot).length;
  const humans = liveHumanCount(room);
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    round: room.round,
    playerCount: humans + bots,
    humans,
    bots,
    scoreLimit: room.scoreLimit,
    gameWinner: room.gameWinner,
    judge: room.players[room.judgeIndex]?.name || null,
  };
}

/* ---------------- room / round ---------------- */

function createRoom(roomCode, botCount = DEFAULT_BOT_COUNT) {
  const bots = makeBotPlayers(normalizeBotCount(botCount));

  return {
    roomCode,
    phase: "lobby",
    round: 1,
    deck: makeDeck(),
    centerImage: allImages.length
      ? allImages[Math.floor(Math.random() * allImages.length)]
      : null,
    players: bots,
    judgeIndex: 0,
    activePlayerIndex: 0,
    selectedByPlayer: {},
    submissions: {},
    revealOrder: [],
    winnerCard: null,
    gameWinner: null,
    scoreLimit: SCORE_LIMIT,
    botOnlySince: Date.now(),
    scores: {},
    turnEndsAt: null,
    resultEndsAt: null,
    feed: [
      {
        user: "system",
        text: `room ${roomCode} created with ${bots.length} bot${bots.length === 1 ? "" : "s"}`,
        type: "system",
        time: Date.now(),
      },
    ],
  };
}

function maybeDealHands(room) {
  room.players.forEach((player) => {
    if (!player.hand) player.hand = [];
    const refill = refillHand(player.hand, room.deck, 5);
    player.hand = refill.hand;
    room.deck = refill.deck;
    if (typeof room.scores[player.name] !== "number") {
      room.scores[player.name] = 0;
    }
  });
}

function buildRevealOrder(room) {
  const judgeName = room.players[room.judgeIndex]?.name;
  room.revealOrder = shuffle(
    room.players
      .filter((p) => p.name !== judgeName)
      .map((p) => ({
        player: p.name,
        card: room.submissions[p.name],
        winner: false,
      })),
  );
}

function startRound(room) {
  maybeDealHands(room);

  room.phase = "pick";
  room.centerImage = allImages.length
    ? allImages[Math.floor(Math.random() * allImages.length)]
    : null;
  room.selectedByPlayer = {};
  room.submissions = {};
  room.revealOrder = [];
  room.winnerCard = null;
  room.gameWinner = null;
  room.resultEndsAt = null;
  room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;

  const judgeName = room.players[room.judgeIndex]?.name;
  room.activePlayerIndex = room.judgeIndex;

  addFeed(room, "system", `round ${room.round} started`);
  if (judgeName) addFeed(room, "system", `${judgeName} is the judge`);

  scheduleBotsForRound(room);
}

function nextRound(room) {
  if (room.phase === "gameover") return;
  room.round += 1;
  room.judgeIndex = (room.judgeIndex + 1) % room.players.length;
  startRound(room);
}

function resetGame(room) {
  room.round = 1;
  room.deck = makeDeck();
  room.centerImage = allImages.length
    ? allImages[Math.floor(Math.random() * allImages.length)]
    : null;
  room.judgeIndex = 0;
  room.activePlayerIndex = 0;
  room.selectedByPlayer = {};
  room.submissions = {};
  room.revealOrder = [];
  room.winnerCard = null;
  room.gameWinner = null;
  room.turnEndsAt = null;
  room.resultEndsAt = null;
  room.scores = {};
  room.players.forEach((player) => {
    player.hand = [];
    room.scores[player.name] = 0;
  });
  room.feed = [];
  addFeed(room, "system", "game restarted");
  if (room.players.length >= 2) {
    startRound(room);
  } else {
    room.phase = "lobby";
  }
}

function moveToJudgePhase(room) {
  if (room.phase !== "pick") return;

  room.phase = "judge";
  room.turnEndsAt = null;
  room.activePlayerIndex = room.judgeIndex;
  buildRevealOrder(room);

  const judgeName = room.players[room.judgeIndex]?.name;
  addFeed(room, "system", `all cards submitted — ${judgeName} is choosing`);

  scheduleBotJudge(room);
}

/* ---------------- bots ---------------- */

function scheduleBotsForRound(room) {
  if (room.phase !== "pick") return;

  const judgeName = room.players[room.judgeIndex]?.name;

  room.players.forEach((player, index) => {
    if (!isBot(player)) return;
    if (player.name === judgeName) return;
    if (room.submissions[player.name]) return;

    const delay =
      randomDelay(BOT_PICK_DELAY_MIN_MS, BOT_PICK_DELAY_MAX_MS) + index * 250;

    setTimeout(() => {
      const liveRoom = rooms.get(room.roomCode);
      if (!liveRoom || liveRoom.phase !== "pick") return;

      const liveJudge = liveRoom.players[liveRoom.judgeIndex]?.name;
      const livePlayer = liveRoom.players.find((p) => p.name === player.name);

      if (!livePlayer || livePlayer.name === liveJudge) return;
      if (liveRoom.submissions[livePlayer.name]) return;

      submitPlayerCard(liveRoom, livePlayer.name);
      emitRoom(liveRoom);

      if (everyoneSubmitted(liveRoom)) {
        moveToJudgePhase(liveRoom);
        emitRoom(liveRoom);
      }
    }, delay);
  });
}

function scheduleBotJudge(room) {
  const judge = room.players[room.judgeIndex];
  if (!judge || !isBot(judge) || room.phase !== "judge") return;

  setTimeout(
    () => {
      const liveRoom = rooms.get(room.roomCode);
      if (!liveRoom || liveRoom.phase !== "judge") return;

      const liveJudge = liveRoom.players[liveRoom.judgeIndex];
      if (!liveJudge || liveJudge.name !== judge.name) return;
      if (!liveRoom.revealOrder.length) return;

      const randomPick =
        liveRoom.revealOrder[
          Math.floor(Math.random() * liveRoom.revealOrder.length)
        ];

      chooseWinnerInternal(liveRoom, randomPick.player);
      emitRoom(liveRoom);
    },
    randomDelay(BOT_JUDGE_DELAY_MIN_MS, BOT_JUDGE_DELAY_MAX_MS),
  );
}

/* ---------------- actions ---------------- */

function submitPlayerCard(room, playerName, card = null) {
  if (room.phase !== "pick") return false;

  const judgeName = room.players[room.judgeIndex]?.name;
  if (playerName === judgeName) return false;
  if (room.submissions[playerName]) return false;

  const player = room.players.find((p) => p.name === playerName);
  if (!player) return false;

  const chosen = card || room.selectedByPlayer[playerName] || player.hand[0];
  if (!chosen) return false;

  room.submissions[playerName] = chosen;
  room.selectedByPlayer[playerName] = chosen;
  player.hand = player.hand.filter((img) => img !== chosen);
  addFeed(room, playerName, "submitted a card");

  return true;
}



function chooseWinnerInternal(room, winnerName) {
  room.revealOrder = room.revealOrder.map((item) => ({
    ...item,
    winner: item.player === winnerName,
  }));
  room.winnerCard = room.revealOrder.find((item) => item.winner)?.card || null;
  room.scores[winnerName] = (room.scores[winnerName] || 0) + 1;
  addFeed(room, "system", `${winnerName} wins the round`);

  if (room.scores[winnerName] >= SCORE_LIMIT) {
    room.phase = "gameover";
    room.gameWinner = winnerName;
    room.turnEndsAt = null;
    room.resultEndsAt = null;
    addFeed(room, "system", `${winnerName} wins the game`);
    return;
  }

  room.phase = "result";
  room.resultEndsAt = Date.now() + RESULT_SECONDS * 1000;
}

/* ---------------- routes ---------------- */

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/rooms", (_req, res) => {
  res.json({
    ok: true,
    rooms: Array.from(rooms.values()).map(serializeRoomSummary),
  });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET" || !req.accepts("html")) {
      next();
      return;
    }

    res.sendFile(DIST_INDEX);
  });
}

/* ---------------- sockets ---------------- */

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomCode, playerName, nameColor, botCount, silent = false }, callback = () => {}) => {
    const normalizedRoom = normalizeRoom(roomCode);
    const normalizedName = normalizeName(playerName);
    const normalizedNameColor = normalizeNameColor(nameColor);
    const normalizedBotCount = normalizeBotCount(botCount);

    if (!normalizedName) {
      callback({ ok: false, error: "Name is required." });
      return;
    }

    const room = getOrCreateRoom(normalizedRoom, normalizedBotCount);
    if (!silent) {
      ensureBotCount(room, normalizedBotCount);
    }

    const existing = room.players.find(
      (p) => p.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (!existing && room.players.length >= 8) {
      callback({ ok: false, error: "room is full (max 8 players)" });
      return;
    }

    const existingSocketStillLive =
      existing?.socketId && io.sockets.sockets.has(existing.socketId);

    if (existingSocketStillLive && existing.socketId !== socket.id) {
      callback({ ok: false, error: "That name is already in the room." });
      return;
    }

    socket.join(normalizedRoom);
    playerSockets.set(socket.id, {
      roomCode: normalizedRoom,
      playerName: normalizedName,
    });

    if (!existing) {
      room.players.push({
        name: normalizedName,
        socketId: socket.id,
        hand: [],
        nameColor: normalizedNameColor,
      });
      room.scores[normalizedName] = room.scores[normalizedName] || 0;
      addFeed(room, "system", `${normalizedName} joined the room`);
    } else {
      const wasBot = existing.bot;
      existing.bot = false;
      existing.socketId = socket.id;
      existing.nameColor = normalizedNameColor;
      if (wasBot) {
        addFeed(room, "system", `${normalizedName} joined the room`);
      } else if (!silent) {
        addFeed(room, "system", `${normalizedName} rejoined the room`);
      }
    }

    markRoomOccupancy(room);
    maybeDealHands(room);

    if (room.phase === "lobby" && room.players.length >= 2) {
      startRound(room);
    }

    emitRoom(room);
    callback({ ok: true, room });
  });

  socket.on("send_chat", ({ roomCode, playerName, text }, callback = () => {}) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room) {
      callback({ ok: false, error: "room not found" });
      return;
    }

    const cleanName = normalizeName(playerName);
    const cleanText = String(text || "")
      .trim()
      .slice(0, 240);

    if (!cleanName || !cleanText) {
      callback({ ok: false, error: "message is empty" });
      return;
    }

    const player = refreshSocketRoom(socket, room, cleanName);
    if (!player) {
      callback({ ok: false, error: "player not in room" });
      return;
    }

    addFeed(room, cleanName, cleanText, "chat");
    emitRoom(room);
    callback({ ok: true });
  });

  socket.on("select_card", ({ roomCode, playerName, card }) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room || room.phase !== "pick") return;

    const judgeName = room.players[room.judgeIndex]?.name;
    if (playerName === judgeName) return;

    const player = refreshSocketRoom(socket, room, playerName);
    if (!player) return;
    if (!player.hand.includes(card)) return;

    room.selectedByPlayer[playerName] = card;
    emitRoom(room);
  });

  socket.on("submit_card", ({ roomCode, playerName }) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room || room.phase !== "pick") return;
    if (!refreshSocketRoom(socket, room, playerName)) return;

    const didSubmit = submitPlayerCard(room, playerName);
    if (!didSubmit) return;

    if (everyoneSubmitted(room)) {
      moveToJudgePhase(room);
    }

    emitRoom(room);
  });

  socket.on(
    "choose_winner",
    ({ roomCode, playerName: judgeName, winnerName }) => {
      const room = rooms.get(normalizeRoom(roomCode));
      if (!room || room.phase !== "judge") return;
      if (!refreshSocketRoom(socket, room, judgeName)) return;

      const judge = room.players[room.judgeIndex];
      if (!judge || judge.name !== judgeName) return;

      chooseWinnerInternal(room, winnerName);
      emitRoom(room);
    },
  );

  socket.on("restart_game", ({ roomCode, playerName }, callback = () => {}) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room) {
      callback({ ok: false, error: "room not found" });
      return;
    }
    if (!refreshSocketRoom(socket, room, playerName)) {
      callback({ ok: false, error: "player not in room" });
      return;
    }
    if (room.phase !== "gameover") {
      callback({ ok: false, error: "game is not over yet" });
      return;
    }
    resetGame(room);
    emitRoom(room);
    callback({ ok: true });
  });

  socket.on("disconnect", () => {
    const data = playerSockets.get(socket.id);
    if (!data) return;

    const room = rooms.get(data.roomCode);
    if (!room) {
      playerSockets.delete(socket.id);
      return;
    }

    const player = room.players.find((p) => p.socketId === socket.id);

    if (player) {
      if (isBot(player)) {
        playerSockets.delete(socket.id);
        return;
      }

      player.socketId = null;
      addFeed(room, "system", `${data.playerName} disconnected`);

      if (room.phase === "pick" && everyoneSubmitted(room)) {
        moveToJudgePhase(room);
      }

      emitRoom(room);
    }

    markRoomOccupancy(room);
    playerSockets.delete(socket.id);
  });
});

/* ---------------- timers ---------------- */

setInterval(() => {
  for (const room of rooms.values()) {
    if (
      room.phase === "pick" &&
      room.turnEndsAt &&
      Date.now() >= room.turnEndsAt
    ) {
      const judgeName = room.players[room.judgeIndex]?.name;

      room.players
        .filter((p) => p.name !== judgeName && !room.submissions[p.name])
        .forEach((p) => {
          submitPlayerCard(room, p.name);
        });

      if (everyoneSubmitted(room)) {
        moveToJudgePhase(room);
      }

      emitRoom(room);
    }

    if (
      room.phase === "result" &&
      room.resultEndsAt &&
      Date.now() >= room.resultEndsAt
    ) {
      nextRound(room);
      emitRoom(room);
    }
  }
}, 400);

setInterval(() => {
  const now = Date.now();

  for (const [roomCode, room] of rooms.entries()) {
    markRoomOccupancy(room);

    if (
      room.botOnlySince &&
      now - room.botOnlySince >= BOT_ONLY_ROOM_TTL_MS
    ) {
      deleteRoom(roomCode);
      console.log(`deleted bot-only room ${roomCode}`);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`jusdepomme socket server running on http://localhost:${PORT}`);
});
