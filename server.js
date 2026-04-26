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

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
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
const BOT_NAMES = ["Cowgirl", "RepsaC"];
const RESULT_SECONDS = 4;

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

function isBot(player) {
  return !player?.socketId;
}

function emitRoom(room) {
  io.to(room.roomCode).emit("room_state", room);
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

function getOrCreateRoom(roomCode) {
  const key = normalizeRoom(roomCode);
  if (!rooms.has(key)) {
    rooms.set(key, createRoom(key));
  }
  return rooms.get(key);
}

/* ---------------- room / round ---------------- */

function createRoom(roomCode) {
  return {
    roomCode,
    phase: "lobby",
    round: 1,
    deck: makeDeck(),
    centerImage: allImages.length
      ? allImages[Math.floor(Math.random() * allImages.length)]
      : null,
    players: BOT_NAMES.map((name) => ({
      name,
      socketId: null,
      hand: [],
    })),
    judgeIndex: 0,
    activePlayerIndex: 0,
    selectedByPlayer: {},
    submissions: {},
    revealOrder: [],
    winnerCard: null,
    scores: {},
    turnEndsAt: null,
    resultEndsAt: null,
    feed: [
      {
        user: "system",
        text: `room ${roomCode} created with bots`,
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
  room.resultEndsAt = null;
  room.turnEndsAt = Date.now() + TURN_SECONDS * 1000;

  const judgeName = room.players[room.judgeIndex]?.name;
  room.activePlayerIndex = room.judgeIndex;

  addFeed(room, "system", `round ${room.round} started`);
  if (judgeName) addFeed(room, "system", `${judgeName} is the judge`);

  scheduleBotsForRound(room);
}

function nextRound(room) {
  room.round += 1;
  room.judgeIndex = (room.judgeIndex + 1) % room.players.length;
  startRound(room);
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

  room.players.forEach((player) => {
    if (!isBot(player)) return;
    if (player.name === judgeName) return;
    if (room.submissions[player.name]) return;

    const delay = 800 + Math.random() * 1600;

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
    1400 + Math.random() * 800,
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
  room.phase = "result";
  room.resultEndsAt = Date.now() + RESULT_SECONDS * 1000;
  addFeed(room, "system", `${winnerName} wins the round`);
}

/* ---------------- routes ---------------- */

app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

/* ---------------- sockets ---------------- */

io.on("connection", (socket) => {
  socket.on("join_room", ({ roomCode, playerName }, callback = () => {}) => {
    const normalizedRoom = normalizeRoom(roomCode);
    const normalizedName = normalizeName(playerName);

    if (!normalizedName) {
      callback({ ok: false, error: "Name is required." });
      return;
    }

    const room = getOrCreateRoom(normalizedRoom);
    // enforce room size limit (max 8 players total)
    if (room.players.length >= 8) {
      callback({ ok: false, error: "room is full (max 8 players)" });
      return;
    }
    const existing = room.players.find(
      (p) => p.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (existing && existing.socketId && existing.socketId !== socket.id) {
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
      });
      room.scores[normalizedName] = room.scores[normalizedName] || 0;
      addFeed(room, "system", `${normalizedName} joined the room`);
    } else {
      existing.socketId = socket.id;
      addFeed(room, "system", `${normalizedName} rejoined the room`);
    }

    maybeDealHands(room);

    if (room.phase === "lobby" && room.players.length >= 2) {
      startRound(room);
    }

    emitRoom(room);
    callback({ ok: true, room });
  });

  socket.on("send_chat", ({ roomCode, playerName, text }) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room) return;

    const cleanName = normalizeName(playerName);
    const cleanText = String(text || "")
      .trim()
      .slice(0, 240);

    if (!cleanName || !cleanText) return;

    addFeed(room, cleanName, cleanText, "chat");
    emitRoom(room);
  });

  socket.on("select_card", ({ roomCode, playerName, card }) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room || room.phase !== "pick") return;

    const judgeName = room.players[room.judgeIndex]?.name;
    if (playerName === judgeName) return;

    const player = room.players.find((p) => p.name === playerName);
    if (!player) return;
    if (!player.hand.includes(card)) return;

    room.selectedByPlayer[playerName] = card;
    emitRoom(room);
  });

  socket.on("submit_card", ({ roomCode, playerName }) => {
    const room = rooms.get(normalizeRoom(roomCode));
    if (!room || room.phase !== "pick") return;

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

      const judge = room.players[room.judgeIndex];
      if (!judge || judge.name !== judgeName) return;

      chooseWinnerInternal(room, winnerName);
      emitRoom(room);
    },
  );

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
        return;
      }

      player.socketId = null;
      addFeed(room, "system", `${data.playerName} disconnected`);

      if (room.phase === "pick" && everyoneSubmitted(room)) {
        moveToJudgePhase(room);
      }

      emitRoom(room);
    }

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

server.listen(PORT, () => {
  console.log(`jusdepomme socket server running on http://localhost:${PORT}`);
});
