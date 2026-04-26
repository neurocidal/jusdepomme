import { useEffect, useMemo, useRef, useState } from "react";
import './App.css';
import { io } from "socket.io-client";

const STORAGE_KEY = "jusdepomme-player-stats-v1";
const LAST_NAME_KEY = "jusdepomme-last-player";
const LAST_ROOM_KEY = "jusdepomme-last-room";
const TURN_SECONDS = 30;
const SERVER_URL = "http://localhost:3001";

const socket = io(SERVER_URL, {
  autoConnect: false,
});

const themes = {
  parchment: {
    name: "Parchment",
    pageBg: "#f7f3ea",
    marqueeBg: "#efe7d8",
    marqueeText: "#6f4b2a",
    panelBg: "#fffdf8",
    panelAlt: "#f1e9db",
    border: "#b7a58b",
    borderSoft: "#d7c9b6",
    text: "#2d241c",
    muted: "#6e6255",
    handBg: "#ece2d1",
    handSlot: "#fffaf0",
    select: "#c96b3b",
    pagePattern:
      "repeating-linear-gradient(45deg, #f7f3ea, #f7f3ea 18px, #f1ebdf 18px, #f1ebdf 36px)",
  },
  mint: {
    name: "Mint",
    pageBg: "#eef6ef",
    marqueeBg: "#ddeee0",
    marqueeText: "#3b6b4a",
    panelBg: "#fbfffb",
    panelAlt: "#e5f1e7",
    border: "#95b39a",
    borderSoft: "#c7d9ca",
    text: "#1e2b21",
    muted: "#536459",
    handBg: "#dceadf",
    handSlot: "#f8fff8",
    select: "#4f8f63",
    pagePattern:
      "repeating-linear-gradient(135deg, #eef6ef, #eef6ef 16px, #e5efe6 16px, #e5efe6 32px)",
  },
  dusk: {
    name: "Dusk",
    pageBg: "#ece7f2",
    marqueeBg: "#ddd5e8",
    marqueeText: "#6a4c88",
    panelBg: "#fcfbff",
    panelAlt: "#e9e2f3",
    border: "#aa9bbb",
    borderSoft: "#d3c8df",
    text: "#2b2433",
    muted: "#665b73",
    handBg: "#ddd5e7",
    handSlot: "#faf7ff",
    select: "#8c5bc0",
    pagePattern:
      "radial-gradient(circle at top left, #f3eef9 0, #ece7f2 45%, #e2d9ed 100%)",
  },
  peach: {
    name: "Peach",
    pageBg: "#f9f0ea",
    marqueeBg: "#f3dfd4",
    marqueeText: "#91553a",
    panelBg: "#fffaf7",
    panelAlt: "#f6e6dc",
    border: "#c9a28d",
    borderSoft: "#e1c5b6",
    text: "#38261d",
    muted: "#7a6459",
    handBg: "#eed9cc",
    handSlot: "#fff8f2",
    select: "#d27a52",
    pagePattern:
      "repeating-linear-gradient(0deg, #f9f0ea, #f9f0ea 20px, #f5e7de 20px, #f5e7de 40px)",
  },
  terminal: {
    name: "Terminal",
    pageBg: "#0b0f0b",
    marqueeBg: "#101a10",
    marqueeText: "#33ff33",
    panelBg: "#0f1a0f",
    panelAlt: "#132213",
    border: "#2aff2a",
    borderSoft: "#1f7f1f",
    text: "#33ff33",
    muted: "#1faa1f",
    handBg: "#0c140c",
    handSlot: "#081008",
    select: "#66ff66",
    pagePattern: "radial-gradient(#163116 1px, #0b0f0b 1px)",
  },
  midnight: {
    name: "Midnight",
    pageBg: "#0d0f1a",
    marqueeBg: "#141833",
    marqueeText: "#7aa2ff",
    panelBg: "#11142a",
    panelAlt: "#1a1f3d",
    border: "#5c6fff",
    borderSoft: "#2e3570",
    text: "#cbd5ff",
    muted: "#7a84b0",
    handBg: "#10142b",
    handSlot: "#0b0e1f",
    select: "#8fa3ff",
    pagePattern: "linear-gradient(180deg, #12162d 0%, #0d0f1a 100%)",
  },
  void: {
    name: "Void",
    pageBg: "#0a0a0a",
    marqueeBg: "#121212",
    marqueeText: "#aaaaaa",
    panelBg: "#111111",
    panelAlt: "#1a1a1a",
    border: "#444",
    borderSoft: "#222",
    text: "#dddddd",
    muted: "#777",
    handBg: "#0f0f0f",
    handSlot: "#080808",
    select: "#ffffff",
    pagePattern: "linear-gradient(135deg, #111 0%, #0a0a0a 100%)",
  },
  cyberpunk: {
    name: "Cyberpunk",
    pageBg: "#0f001a",
    marqueeBg: "#1a0033",
    marqueeText: "#ff00ff",
    panelBg: "#14002a",
    panelAlt: "#1f0040",
    border: "#ff00ff",
    borderSoft: "#660066",
    text: "#ff66ff",
    muted: "#aa44aa",
    handBg: "#120024",
    handSlot: "#0a0015",
    select: "#00ffff",
    pagePattern: "radial-gradient(circle at top, #2a004a 0%, #0f001a 60%)",
  },
  hacker: {
    name: "Hacker",
    pageBg: "#000000",
    marqueeBg: "#050505",
    marqueeText: "#00ff9c",
    panelBg: "#020202",
    panelAlt: "#0a0a0a",
    border: "#00ff9c",
    borderSoft: "#007a4d",
    text: "#00ff9c",
    muted: "#009966",
    handBg: "#010101",
    handSlot: "#000",
    select: "#00ffc8",
    pagePattern: "radial-gradient(#003b24 1px, #000 1px)",
  },
};

function normalizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 18);
}

function normalizeRoom(room) {
  const cleaned = String(room || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 16);
  return cleaned || "orchard";
}

function readLastName() {
  try {
    return localStorage.getItem(LAST_NAME_KEY) || "";
  } catch {
    return "";
  }
}

function writeLastName(name) {
  try {
    localStorage.setItem(LAST_NAME_KEY, normalizeName(name));
  } catch {}
}

function readLastRoom() {
  try {
    const fromPath = window.location.pathname.replace(/^\//, "");
    if (fromPath) return normalizeRoom(fromPath);
    return localStorage.getItem(LAST_ROOM_KEY) || "orchard";
  } catch {
    return "orchard";
  }
}

function writeLastRoom(room) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, normalizeRoom(room));
  } catch {}
}

function syncRoomPath(room) {
  try {
    const path = `/${normalizeRoom(room)}`;
    if (window.location.pathname !== path) {
      window.history.replaceState({}, "", path);
    }
  } catch {}
}

function clearRoomPath() {
  try {
    window.history.replaceState({}, "", "/");
  } catch {}
}

function safeReadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function safeWriteStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {}
}

function statsKey(name) {
  return normalizeName(name).toLowerCase();
}

function getStoredPlayer(name) {
  const stats = safeReadStats();
  const key = statsKey(name);
  return (
    stats[key] || {
      displayName: normalizeName(name),
      gamesPlayed: 0,
      roundWins: 0,
      judgeWinsGiven: 0,
      lastSeen: null,
    }
  );
}

function updateStoredPlayer(name, updater) {
  const allStats = safeReadStats();
  const key = statsKey(name);
  const current = allStats[key] || {
    displayName: normalizeName(name),
    gamesPlayed: 0,
    roundWins: 0,
    judgeWinsGiven: 0,
    lastSeen: null,
  };
  const next = updater(current);
  allStats[key] = {
    ...next,
    displayName: normalizeName(name),
    lastSeen: new Date().toISOString(),
  };
  safeWriteStats(allStats);
  return allStats[key];
}

const CAT_EMOJIS = [
  "1188-pixel-cat-typing.gif",
  "1311-pixel-cat-makeupkiss.gif",
  "1489-pixel-cat-bathtime.gif",
  "1522-pixel-cat-confuse.gif",
  "1537-pixel-cat-sparkledance.gif",
  "1614-pixel-cat-ok.gif",
  "1857-pixel-cat-lovepeek.gif",
  "1934-pixel-cat-fish.gif",
  "2001-pixel-cat-approve.gif",
  "2046-pixel-cat-heartdraw.gif",
  "2222-pixel-cat-wink.gif",
  "2482-pixel-cat-wave.gif",
  "2487-pixel-cat-cry.gif",
  "2556-pixel-cat-scratch.gif",
  "3325-pixel-cat-lovebirds.gif",
  "3420-pixel-cat-stare.gif",
  "3630-pixel-cat-sleepies.gif",
  "3829-pixel-cat-hearty.gif",
  "4645-pixel-cat-surprise.gif",
  "4837-pixel-cat-aha.gif",
  "5028-pixel-cat-raining.gif",
  "5511-pixel-cat-drag.gif",
  "5856-pixel-cat-showoff.gif",
  "5934-pixel-cat-cozy.gif",
  "7024-pixel-cat-hottea.gif",
  "7525-pixel-cat-tantrum.gif",
  "9322-pixel-cat-cloversparkle.gif",
  "9381-pixel-cat-eat.gif",
  "9834-pixel-cat-hugkiss.gif",
];

const PIXEL_EMOJIS = [
  "14813-b-rolling-eyes.png",
  "21973-b-slight-frown.png",
  "22177-b-kissing-closed-eyes.png",
  "25847-b-sob.png",
  "27460-b-innocent.png",
  "34692-b-nerd.png",
  "35255-b-flushed.png",
  "45842-b-face-with-symbols-over-mouth.png",
  "50155-b-heart-eyes.png",
  "53795-b-frowning2.png",
  "60527-b-fearful.png",
  "61542-b-angry.png",
  "61950-b-sweat-smile.png",
  "63537-b-skull.png",
  "6363-b-yum.png",
  "66794-b-sunglasses.png",
  "75286-b-cold-sweat.png",
  "75852-b-face-holding-back-tears.png",
  "78596-b-pleading-face.png",
  "80260-b-disappointed-relieved.png",
  "81220-b-start-struck.png",
  "81964-b-smirk.png",
  "82791-b-cry.png",
  "87790-b-rofl.png",
  "89929-b-smiling-3-hearts.png",
  "90741-b-sweat.png",
  "97996-b-laughing.png",
  "98271-b-disappointed.png",
  "99849-b-confounded.png",
  "99849-b-persevere.png",
  "99849-b-scream.png",
];

function buildEmojiCatalog(folder, files) {
  return files.map((file) => {
    const clean = file.replace(/^\d+-/, "").replace(/\.(gif|png)$/i, "");
    const key = `${folder}-${clean}`;
    return {
      key,
      code: `:${key}:`,
      label: clean.replace(/-/g, " "),
      src: `/emojis/${folder}/${file}`,
    };
  });
}

const EMOJI_GROUPS = {
  cat: buildEmojiCatalog("cat", CAT_EMOJIS),
  pixel: buildEmojiCatalog("pixel", PIXEL_EMOJIS),
};

const EMOJI_LOOKUP = Object.values(EMOJI_GROUPS)
  .flat()
  .reduce((acc, emoji) => {
    acc[emoji.code] = emoji;
    return acc;
  }, {});

function renderTextWithEmojis(text, styles) {
  const value = String(text || "");
  const parts = value.split(/(:[a-z0-9-]+:)/gi);

  return parts.map((part, index) => {
    const emoji = EMOJI_LOOKUP[part];
    if (emoji) {
      return (
        <img
          key={`${emoji.code}-${index}`}
          src={emoji.src}
          alt={emoji.label}
          title={emoji.label}
          style={styles.inlineEmoji}
        />
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}

export default function App() {
  const [themeKey, setThemeKey] = useState("parchment");
  const [pendingName, setPendingName] = useState(readLastName());
  const [pendingRoom, setPendingRoom] = useState(readLastRoom());
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerRecord, setPlayerRecord] = useState(null);
  const [game, setGame] = useState(null);
  const [joinError, setJoinError] = useState("");
  const [turnTime, setTurnTime] = useState(TURN_SECONDS);
  const [timerPos, setTimerPos] = useState({ x: 8, y: 10, vx: 0.38, vy: 0.31 });
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [chatDraft, setChatDraft] = useState("");
  const [emojiGroup, setEmojiGroup] = useState("cat");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const lastAwardedRoundRef = useRef({ winnerRound: 0, judgeRound: 0 });
  const eventScrollRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  const theme = themes[themeKey];
  const isTablet = viewportWidth < 1100;
  const isMobile = viewportWidth < 760;
  const styles = makeStyles(theme, { isTablet, isMobile });

  useEffect(() => {
    const styleId = "jusdepomme-marquee-animation";
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
    @keyframes jp-marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-100%); }
    }
  `;

    return () => {
      if (styleEl?.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.backgroundColor = theme.pageBg;
    document.body.style.backgroundImage = theme.pagePattern;
    return () => {
      document.body.style.backgroundImage = "none";
    };
  }, [theme]);

  useEffect(() => {
    const styleId = "jusdepomme-scrollbars";
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
    * {
      scrollbar-width: thin;
      scrollbar-color: ${theme.select} ${theme.panelAlt};
    }

    *::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    *::-webkit-scrollbar-track {
      background: ${theme.panelAlt};
      border-left: 1px solid ${theme.borderSoft};
      border-top: 1px solid ${theme.borderSoft};
    }

    *::-webkit-scrollbar-thumb {
      background: ${theme.select};
      border: 1px solid ${theme.panelBg};
      border-radius: 2px;
    }

    *::-webkit-scrollbar-thumb:hover {
      background: ${theme.border};
    }

    *::-webkit-scrollbar-corner {
      background: ${theme.panelAlt};
    }
  `;

    return () => {
      if (styleEl?.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [theme]);

  useEffect(() => {
    socket.connect();

    const onRoomState = (room) => {
      setGame(room);
      if (room.phase === "pick" && room.turnEndsAt) {
        const seconds = Math.max(
          0,
          Math.ceil((room.turnEndsAt - Date.now()) / 1000),
        );
        setTurnTime(seconds);
      }
    };

    socket.on("room_state", onRoomState);

    return () => {
      socket.off("room_state", onRoomState);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!game || game.phase !== "pick" || !game.turnEndsAt) return;
    const id = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((game.turnEndsAt - Date.now()) / 1000),
      );
      setTurnTime(seconds);
    }, 200);
    return () => window.clearInterval(id);
  }, [game?.phase, game?.turnEndsAt]);

  useEffect(() => {
    if (!game || game.phase !== "pick") return;
    const id = window.setInterval(() => {
      setTimerPos((prev) => {
        let nextX = prev.x + prev.vx;
        let nextY = prev.y + prev.vy;
        let nextVx = prev.vx;
        let nextVy = prev.vy;

        if (nextX <= 0 || nextX >= 78) {
          nextVx *= -1;
          nextX = Math.max(0, Math.min(78, nextX));
        }
        if (nextY <= 0 || nextY >= 78) {
          nextVy *= -1;
          nextY = Math.max(0, Math.min(78, nextY));
        }
        return { x: nextX, y: nextY, vx: nextVx, vy: nextVy };
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [game?.phase]);

  const currentJudge = game ? game.players?.[game.judgeIndex]?.name || "" : "";
  const me = game ? game.players?.find((p) => p.name === playerName) : null;
  const myHand = me?.hand || [];
  const isJudge = playerName === currentJudge;
  const alreadySubmitted = Boolean(game?.submissions?.[playerName]);
  const centerDisplayImage = game?.centerImage || null;
  const fullFeed = game?.feed || [];
  const eventFeed = fullFeed.filter((msg) => (msg.type || "event") !== "chat");
  const chatFeed = fullFeed.filter((msg) => msg.type === "chat");

  useEffect(() => {
    const node = eventScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [eventFeed.length]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatFeed.length]);

  useEffect(() => {
    if (!game || !playerName || game.phase !== "result") return;

    if (
      game.revealOrder?.some(
        (item) => item.winner && item.player === playerName,
      )
    ) {
      if (lastAwardedRoundRef.current.winnerRound !== game.round) {
        const next = updateStoredPlayer(playerName, (current) => ({
          ...current,
          roundWins: current.roundWins + 1,
        }));
        setPlayerRecord(next);
        lastAwardedRoundRef.current.winnerRound = game.round;
      }
    }

    if (playerName === currentJudge) {
      if (lastAwardedRoundRef.current.judgeRound !== game.round) {
        const next = updateStoredPlayer(playerName, (current) => ({
          ...current,
          judgeWinsGiven: current.judgeWinsGiven + 1,
        }));
        setPlayerRecord(next);
        lastAwardedRoundRef.current.judgeRound = game.round;
      }
    }
  }, [game, playerName, currentJudge]);

  const playerMeta = useMemo(() => {
    if (!game?.players) return [];
    return game.players.map((player, idx) => {
      const judgeThisRound = idx === game.judgeIndex;
      let status = "waiting";

      if (game.phase === "lobby") {
        status = "joining";
      } else if (game.phase === "pick") {
        if (judgeThisRound) status = "judge";
        else if (game.submissions?.[player.name]) status = "submitted";
        else status = "picking";
      } else if (game.phase === "judge") {
        status = judgeThisRound ? "choosing winner" : "submitted";
      } else if (game.phase === "result") {
        status = judgeThisRound
          ? "judged"
          : game.revealOrder?.find((item) => item.player === player.name)
                ?.winner
            ? "won"
            : "played";
      }

      return {
        name: player.name,
        score: game.scores?.[player.name] || 0,
        status,
        isJudge: judgeThisRound,
      };
    });
  }, [game]);

  const submittedPreview = game
    ? game.players
        ?.map((p) => p.name)
        .filter((name) => name !== currentJudge)
        .map((name) => ({
          player: name,
          card: game.submissions?.[name] || null,
        })) || []
    : [];

  function enterRoom() {
    const cleanedName = normalizeName(pendingName);
    const cleanedRoom = normalizeRoom(pendingRoom);
    if (!cleanedName || !cleanedRoom) return;

    writeLastName(cleanedName);
    writeLastRoom(cleanedRoom);
    syncRoomPath(cleanedRoom);
    setJoinError("");

    const record = updateStoredPlayer(cleanedName, (current) => ({
      ...current,
      gamesPlayed: current.gamesPlayed + 1,
    }));

    lastAwardedRoundRef.current = { winnerRound: 0, judgeRound: 0 };
    setPlayerName(cleanedName);
    setRoomCode(cleanedRoom);
    setPlayerRecord(record);

    socket.emit(
      "join_room",
      { roomCode: cleanedRoom, playerName: cleanedName },
      (result) => {
        if (!result?.ok) {
          setJoinError(result?.error || "Could not join room.");
          setPlayerName("");
          setRoomCode("");
          setGame(null);
        }
      },
    );
  }

  function randomRoom() {
    setPendingRoom(Math.random().toString(36).slice(2, 8));
  }

  function leaveGame() {
    setGame(null);
    setPlayerName("");
    setRoomCode("");
    setPlayerRecord(null);
    setJoinError("");
    setChatDraft("");
    setEmojiOpen(false);
    lastAwardedRoundRef.current = { winnerRound: 0, judgeRound: 0 };
    clearRoomPath();
    socket.disconnect();
    socket.connect();
  }

  function selectCard(card) {
    if (!game || game.phase !== "pick" || isJudge || alreadySubmitted) return;
    socket.emit("select_card", { roomCode, playerName, card });
  }

  function submitCurrentPlayer() {
    if (!game || game.phase !== "pick" || isJudge || alreadySubmitted) return;
    socket.emit("submit_card", { roomCode, playerName });
  }

  function chooseWinner(winnerName) {
    if (!game || game.phase !== "judge" || playerName !== currentJudge) return;
    socket.emit("choose_winner", { roomCode, playerName, winnerName });
  }

  function insertEmoji(code) {
    setChatDraft(
      (prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${code} `,
    );
    setEmojiOpen(false);
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
  }

  function sendChat() {
    const cleaned = chatDraft.trim();
    if (!cleaned || !roomCode || !playerName) return;
    socket.emit("send_chat", { roomCode, playerName, text: cleaned });
    setChatDraft("");
  }

  function handleChatKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    }
  }

  function resetLocalStats() {
    const blank = updateStoredPlayer(playerName, () => ({
      displayName: playerName,
      gamesPlayed: 0,
      roundWins: 0,
      judgeWinsGiven: 0,
      lastSeen: null,
    }));
    setPlayerRecord(blank);
    lastAwardedRoundRef.current = { winnerRound: 0, judgeRound: 0 };
  }

  if (!game) {
    const previewStats = pendingName.trim()
      ? getStoredPlayer(pendingName)
      : null;

    return (
      <div style={styles.page}>
        <div style={styles.marqueeOuter}>
          <div style={styles.marqueeInner}>
            jusdepomme 🍎 — enter a name — pick a room — same name = same local
            stats
          </div>
        </div>

        <div style={styles.loginScreen}>
          <div style={styles.loginCard}>
            <div style={styles.loginTitle}>enter the room</div>
            <div style={styles.loginSubtext}>
              backend is live now. open two browsers and join the same room.
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>name</label>
              <input
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enterRoom()}
                placeholder="your name"
                style={styles.loginInput}
                maxLength={18}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>room</label>
              <div style={styles.roomRow}>
                <input
                  value={pendingRoom}
                  onChange={(e) => setPendingRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enterRoom()}
                  placeholder="room code"
                  style={styles.loginInput}
                  maxLength={16}
                />
                <button style={styles.smallButton} onClick={randomRoom}>
                  random
                </button>
              </div>
            </div>

            <button
              style={styles.loginButton}
              onClick={enterRoom}
              disabled={!pendingName.trim() || !pendingRoom.trim()}
            >
              enter room
            </button>

            {joinError ? <div style={styles.errorBox}>{joinError}</div> : null}

            {previewStats ? (
              <div style={styles.loginStatsBox}>
                <div style={styles.panelTitle}>
                  saved stats for {previewStats.displayName}
                </div>
                <div>games played: {previewStats.gamesPlayed}</div>
                <div>round wins: {previewStats.roundWins}</div>
                <div>judge picks made: {previewStats.judgeWinsGiven}</div>
              </div>
            ) : (
              <div style={styles.loginHint}>
                pick any name and room. open another browser window with a
                different name to test multiplayer.
              </div>
            )}

            <div style={styles.topBarControls}>
              <span style={styles.themeLabel}>theme:</span>
              <select
                value={themeKey}
                onChange={(e) => setThemeKey(e.target.value)}
                style={styles.themeSelect}
              >
                {Object.entries(themes).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.marqueeOuter}>
        <div style={styles.marqueeInner}>
          jusdepomme 🍎 — room {roomCode} — round {game.round} — judge:{" "}
          {currentJudge} — phase: {game.phase}
        </div>
      </div>

      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          jusdepomme.xyz/{roomCode} / {playerName}
        </div>
        <div style={styles.topBarControls}>
          <span style={styles.themeLabel}>theme:</span>
          <select
            value={themeKey}
            onChange={(e) => setThemeKey(e.target.value)}
            style={styles.themeSelect}
          >
            {Object.entries(themes).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>
          <button style={styles.smallButton} onClick={leaveGame}>
            change room
          </button>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.chatPanel}>
          <div style={styles.chatSection}>
            <div style={styles.panelTitle}>event log</div>
            <div
              ref={eventScrollRef}
              className="jp-scroll"
              style={styles.chatMessages}
            >
              {eventFeed.map((msg, i) => (
                <div key={`event-${i}`} style={styles.eventMessage}>
                  <b>{msg.user}:</b> {renderTextWithEmojis(msg.text, styles)}
                </div>
              ))}
            </div>
          </div>

          <div style={styles.chatDivider} />

          <div style={styles.chatSection}>
            <div style={styles.panelTitle}>game chat</div>

            <div
              ref={chatScrollRef}
              className="jp-scroll"
              style={styles.chatMessages}
            >
              {chatFeed.length ? (
                chatFeed.map((msg, i) => (
                  <div key={`chat-${i}`} style={styles.message}>
                    <b>{msg.user}:</b> {renderTextWithEmojis(msg.text, styles)}
                  </div>
                ))
              ) : (
                <div style={styles.emptyChat}>no messages yet</div>
              )}
            </div>

            <div style={styles.chatComposer}>
              <div style={styles.chatToolsRow}>
                <div style={styles.emojiTabs}>
                  <button
                    type="button"
                    style={{
                      ...styles.emojiTab,
                      ...(emojiGroup === "cat" ? styles.emojiTabActive : null),
                    }}
                    onClick={() => {
                      setEmojiGroup("cat");
                      setEmojiOpen(true);
                    }}
                  >
                    cats
                  </button>
                  <button
                    type="button"
                    style={{
                      ...styles.emojiTab,
                      ...(emojiGroup === "pixel"
                        ? styles.emojiTabActive
                        : null),
                    }}
                    onClick={() => {
                      setEmojiGroup("pixel");
                      setEmojiOpen(true);
                    }}
                  >
                    pixel
                  </button>
                </div>
                <button
                  type="button"
                  style={styles.smallButton}
                  onClick={() => setEmojiOpen((prev) => !prev)}
                >
                  {emojiOpen ? "hide emojis" : "show emojis"}
                </button>
              </div>

              {emojiOpen ? (
                <div style={styles.emojiPicker}>
                  {EMOJI_GROUPS[emojiGroup].map((emoji) => (
                    <button
                      key={emoji.code}
                      type="button"
                      style={styles.emojiButton}
                      title={emoji.label}
                      onClick={() => insertEmoji(emoji.code)}
                    >
                      <img
                        src={emoji.src}
                        alt={emoji.label}
                        style={styles.emojiImage}
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={styles.chatInputRow}>
                <input
                  ref={chatInputRef}
                  style={styles.chatInput}
                  placeholder="> say something..."
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value.slice(0, 240))}
                  onKeyDown={handleChatKeyDown}
                  maxLength={240}
                />
                <button
                  type="button"
                  style={styles.actionButton}
                  onClick={sendChat}
                  disabled={!chatDraft.trim()}
                >
                  send
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.centerPanel}>
          {game.phase === "pick" ? (
            <div
              style={{
                ...styles.timerBubble,
                left: `${timerPos.x}%`,
                top: `${timerPos.y}%`,
              }}
            >
              {turnTime}s
            </div>
          ) : null}

          <div style={styles.panelTitle}>match this image</div>
          <div style={styles.centerImageWrap}>
            {game.phase === "result" ? (
              <div style={styles.resultStage}>
                <div style={styles.winnerShell}>
                  {game.winnerCard ? (
                    <div className="card-hover-wrap center-card" style={{ display: 'inline-block' }}>
                      <img
                        src={game.winnerCard}
                        alt="winning card"
                        style={styles.winnerImage}
                      />
                    </div>
                  ) : null}
                </div>
                <div style={styles.mainImageShell}>
                  {centerDisplayImage ? (
                    <div className="card-hover-wrap center-card" style={{ display: 'inline-block' }}>
                      <img
                        src={centerDisplayImage}
                        alt="main card"
                        style={styles.centerImage}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={styles.centerStage}>
                <div style={styles.mainImageShell}>
                  {centerDisplayImage ? (
                    <div className="card-hover-wrap center-card" style={{ display: 'inline-block' }}>
                      <img
                        src={centerDisplayImage}
                        alt="main card"
                        style={styles.centerImage}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Judge sees submissions in the center to choose a winner. Other players do not see the center grid. */}
                {game.phase === "judge" && playerName === currentJudge ? (
                  <div style={styles.submittedRow}>
                    {(game.revealOrder || []).map((item, i) => (
                      <button
                        key={`${item.player}-${i}`}
                        type="button"
                        style={{
                          ...styles.revealCard,
                          border: `1px solid ${theme.border}`,
                          opacity: item.card ? 1 : 0.75,
                        }}
                        onClick={() => (playerName === currentJudge ? chooseWinner(item.player) : null)}
                      >
                        {item.card ? (
                          <>
                            <div className="card-hover-wrap center-card" style={{ display: 'inline-block' }}>
                              <img src={item.card} alt="submitted" style={styles.revealImage} />
                            </div>
                            <div style={styles.revealText}>click to choose</div>
                          </>
                        ) : (
                          <div style={styles.waitingCard}>waiting...</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div style={styles.centerText}>
            {game.phase === "lobby" && "waiting for more players..."}
            {game.phase === "pick" &&
              (isJudge
                ? `${currentJudge} is judging this round — waiting for submissions`
                : alreadySubmitted
                  ? "you submitted — waiting for the rest"
                  : "everyone picks at the same time")}
            {game.phase === "judge" &&
              (playerName === currentJudge
                ? "pick the winning card"
                : `${currentJudge} is choosing the winner`)}
            {game.phase === "result" &&
              "winning card shown on the left — next round starts automatically"}
          </div>

          <div style={styles.actionRow}>
            {game.phase === "pick" && !isJudge ? (
              <button
                style={styles.actionButton}
                onClick={submitCurrentPlayer}
                disabled={
                  !game?.selectedByPlayer?.[playerName] || alreadySubmitted
                }
              >
                {alreadySubmitted ? "submitted" : "submit card"}
              </button>
            ) : null}
          </div>
        </div>

        <div style={styles.playersPanel} className="jp-scroll">
          <div style={styles.panelTitle}>players</div>
          {playerMeta.map((p) => (
            <div key={p.name} style={styles.playerRow}>
              <div>
                <div>
                  {p.name} {p.isJudge ? "👑" : ""}
                </div>
                <div style={styles.playerStatus}>{p.status}</div>
              </div>
              <span>{p.score}</span>
            </div>
          ))}

          <div style={styles.statsBox}>
            <div style={styles.panelTitle}>your saved stats</div>
            <div>games played: {playerRecord?.gamesPlayed ?? 0}</div>
            <div>round wins: {playerRecord?.roundWins ?? 0}</div>
            <div>judge picks made: {playerRecord?.judgeWinsGiven ?? 0}</div>
            <button style={styles.smallButton} onClick={resetLocalStats}>
              reset stats
            </button>
          </div>
        </div>
      </div>

      <div style={styles.handHeader}>
        {game.phase === "pick"
          ? isJudge
            ? `${currentJudge} is judging this round`
            : alreadySubmitted
              ? "you already submitted"
              : "your hand"
          : game.phase === "judge"
            ? `${currentJudge} is judging the submitted cards`
            : "round finished"}
      </div>

  <div style={styles.handBar} className="handBar">
  <div style={styles.handInner} className="jp-scroll cardContainer">
          {game.phase === "pick" && !isJudge ? (
            !alreadySubmitted ? (
              myHand.map((img, i) => {
                const selected = game?.selectedByPlayer?.[playerName] === img;

                return (
                  <div
                    key={i}
                    className={`card-hover-wrap hand-card ${selected ? 'selected' : ''} ${i === myHand.length - 1 ? 'lastCard' : ''}`}
                  >
                    <img
                      className="handImage"
                      src={img}
                      alt={`card ${i + 1}`}
                      onClick={() => selectCard(img)}
                      style={{
                        ...styles.handImage,
                        transform: "none",
                        border: selected
                          ? `2px dashed ${theme.select}`
                          : `1px solid ${theme.border}`,
                        opacity: alreadySubmitted ? 0.6 : 1,
                        cursor: alreadySubmitted ? "default" : "pointer",
                      }}
                    />
                  </div>
                );
              })
            ) : (
              // player already submitted: show submitted cards in the bottom area
              <div className="bottom-submissions">
                {submittedPreview.map((item, i) => (
                  <div key={`sub-${i}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    {item.card ? (
                      <div className="card-hover-wrap center-card" style={{ display: 'inline-block' }}>
                        <img src={item.card} alt={`submitted-${i}`} style={styles.previewImage} />
                      </div>
                    ) : (
                      <div style={styles.waitingCard}>waiting...</div>
                    )}
                    <div style={{ fontSize: 11, marginTop: 6 }}>{item.player === playerName ? 'you' : item.player}</div>
                  </div>
                ))}
              </div>
            )
          ) : game.phase === "pick" && isJudge ? (
            <div style={styles.handMessage}>
              judge has no playable hand this round — everyone else submits at
              the same time
            </div>
          ) : game.phase === "judge" ? (
            <div style={styles.handMessage}>
              everyone can see the submissions — only the judge can choose the
              winner
            </div>
          ) : (
            <div style={styles.handMessage}>next round is automatic</div>
          )}
        </div>
      </div>
    </div>
  );
}

function makeStyles(theme, ui) {
  const { isTablet, isMobile } = ui;

  return {
    page: {
      height: "100dvh",
      width: "100vw",
      margin: 0,
      padding: 0,
      background: theme.pageBg,
      backgroundImage: theme.pagePattern,
      color: theme.text,
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    marqueeOuter: {
      fontSize: "12px",
      height: "28px",
      overflow: "hidden",
      background: theme.marqueeBg,
      color: theme.marqueeText,
      borderBottom: `1px solid ${theme.border}`,
      display: "flex",
      alignItems: "center",
      position: "relative",
      whiteSpace: "nowrap",
    },

    marqueeInner: {
      display: "inline-block",
      whiteSpace: "nowrap",
      paddingLeft: "100%",
      lineHeight: "28px",
      animation: "jp-marquee 22s linear infinite",
    },
    loginScreen: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    },
    loginCard: {
      width: "100%",
      maxWidth: "460px",
      background: theme.panelBg,
      border: `1px solid ${theme.border}`,
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    loginTitle: { fontSize: "22px", textAlign: "center" },
    loginSubtext: { fontSize: "12px", color: theme.muted, textAlign: "center" },
    fieldGroup: { display: "flex", flexDirection: "column", gap: "4px" },
    fieldLabel: {
      fontSize: "11px",
      color: theme.muted,
      textTransform: "lowercase",
    },
    roomRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" },
    loginInput: {
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      color: theme.text,
      fontSize: "16px",
      padding: "10px 12px",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
      width: "100%",
      boxSizing: "border-box",
    },
    loginButton: {
      border: `1px solid ${theme.border}`,
      background: theme.handBg,
      color: theme.text,
      fontSize: "15px",
      padding: "10px 12px",
      cursor: "pointer",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
    },
    errorBox: {
      border: `1px solid ${theme.select}`,
      background: theme.handSlot,
      color: theme.text,
      padding: "8px 10px",
      fontSize: "12px",
    },
    loginStatsBox: {
      border: `1px dashed ${theme.borderSoft}`,
      background: theme.panelAlt,
      padding: "10px",
      fontSize: "12px",
      lineHeight: 1.5,
    },
    loginHint: { fontSize: "12px", color: theme.muted, textAlign: "center" },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: isMobile ? "flex-start" : "center",
      flexDirection: isMobile ? "column" : "row",
      gap: "8px",
      padding: "6px 8px",
      background: theme.pageBg,
      borderBottom: `1px dashed ${theme.borderSoft}`,
      fontSize: isMobile ? "11px" : "12px",
    },
    topBarLeft: { fontWeight: "bold", letterSpacing: "0.4px" },
    topBarControls: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
    },
    themeLabel: { color: theme.muted },
    themeSelect: {
      border: `1px solid ${theme.border}`,
      background: theme.panelBg,
      color: theme.text,
      fontSize: "12px",
      padding: "3px 6px",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
    },
    smallButton: {
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      color: theme.text,
      padding: "4px 8px",
      fontSize: "11px",
      cursor: "pointer",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
    },
    mainLayout: {
      flex: "1 1 auto",
      display: "grid",
      gridTemplateColumns: isMobile
        ? "1fr"
        : isTablet
          ? "180px minmax(0, 1fr)"
          : "220px minmax(0, 1fr) 220px",
      gap: "10px",
      padding: isMobile ? "8px" : "10px",
      boxSizing: "border-box",
      minHeight: 0,
      overflow: "hidden",
      alignItems: "stretch",
    },
    chatPanel: {
      order: isMobile ? 2 : 0,
      background: theme.panelBg,
      padding: "6px",
      border: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      height: isMobile ? "300px" : "100%",
      overflow: "hidden",
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
    },
    playersPanel: {
      order: isMobile ? 3 : 0,
      background: theme.panelBg,
      padding: "6px",
      border: `1px solid ${theme.border}`,
      fontSize: "11px",
      overflowY: "auto",
      minHeight: 0,
      maxHeight: isMobile ? "220px" : "none",
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
    },
    centerPanel: {
      order: isMobile ? 1 : 0,
      position: "relative",
      background: theme.panelBg,
      padding: "6px",
      border: `1px solid ${theme.border}`,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      overflow: "hidden",
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
    },
    timerBubble: {
      position: "absolute",
      zIndex: 2,
      width: isMobile ? "56px" : "74px",
      height: isMobile ? "56px" : "74px",
      borderRadius: "999px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: theme.panelBg,
      color: theme.text,
      border: `2px solid ${theme.select}`,
      boxShadow: `0 0 0 3px ${theme.panelAlt}`,
      fontSize: isMobile ? "16px" : "20px",
      fontWeight: "bold",
      pointerEvents: "none",
    },
    panelTitle: {
      fontSize: "11px",
      textTransform: "lowercase",
      letterSpacing: "0.8px",
      marginBottom: "6px",
      color: theme.muted,
    },
    chatSection: {
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    chatDivider: {
      height: "1px",
      background: theme.borderSoft,
      margin: "6px 0",
      flexShrink: 0,
    },
    chatMessages: {
      flex: 1,
      minHeight: 0,
      fontSize: "11px",
      overflowY: "auto",
      overflowX: "hidden",
      paddingRight: "2px",
    },
    message: {
      marginBottom: "5px",
      lineHeight: 1.35,
      wordBreak: "break-word",
    },
    eventMessage: {
      marginBottom: "5px",
      lineHeight: 1.35,
      color: theme.muted,
      wordBreak: "break-word",
    },
    emptyChat: {
      fontSize: "11px",
      color: theme.muted,
      fontStyle: "italic",
    },
    inlineEmoji: {
      width: "22px",
      height: "22px",
      objectFit: "contain",
      verticalAlign: "middle",
      margin: "0 2px",
      imageRendering: "pixelated",
    },
    chatComposer: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      marginTop: "6px",
      flexShrink: 0,
    },
    chatToolsRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      flexWrap: "wrap",
    },
    emojiTabs: {
      display: "flex",
      gap: "4px",
      flexWrap: "wrap",
    },
    emojiTab: {
      border: `1px solid ${theme.border}`,
      background: theme.panelBg,
      color: theme.text,
      padding: "4px 8px",
      fontSize: "11px",
      cursor: "pointer",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
    },
    emojiTabActive: {
      background: theme.handBg,
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
    },
    emojiPicker: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
      gap: "6px",
      maxHeight: isMobile ? "120px" : "170px",
      overflowY: "auto",
      padding: "4px",
      border: `1px dashed ${theme.borderSoft}`,
      background: theme.panelAlt,
    },
    emojiButton: {
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      padding: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      minHeight: "36px",
    },
    emojiImage: {
      width: "24px",
      height: "24px",
      objectFit: "contain",
      imageRendering: "pixelated",
    },
    chatInputRow: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "6px",
      alignItems: "center",
    },
    chatInput: {
      flex: 1,
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      color: theme.text,
      fontSize: "11px",
      padding: "5px 6px",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
      minWidth: 0,
    },
    centerImageWrap: {
      flex: 1,
      minHeight: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? "8px 4px 120px" : "12px 8px 120px", // leave space for submitted row
      overflow: 'visible', // allow enlarged center-card to overflow without clipping
    },
    centerStage: {
      width: "100%",
      maxWidth: isMobile ? "100%" : "920px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: isMobile ? "12px" : "18px",
    },
    resultStage: {
      width: "100%",
      maxWidth: isMobile ? "100%" : "920px",
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
      gap: isMobile ? "12px" : "18px",
      alignItems: "start",
      justifyContent: "center",
    },
    mainImageShell: {
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      width: "fit-content",
      maxWidth: "100%",
      padding: "8px",
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      boxShadow: `0 0 0 4px ${theme.panelAlt}`,
      boxSizing: "border-box",
    },
    winnerShell: {
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      width: "fit-content",
      maxWidth: "100%",
      padding: "8px",
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      boxShadow: `0 0 0 4px ${theme.panelAlt}`,
      boxSizing: "border-box",
    },
    centerImage: {
      display: "block",
      width: "auto",
      maxWidth: isMobile ? "92vw" : isTablet ? "420px" : "520px",
      maxHeight: isMobile ? "220px" : "320px",
      objectFit: "contain",
    },
    winnerImage: {
      display: "block",
      width: "auto",
      maxWidth: isMobile ? "92vw" : "280px",
      maxHeight: isMobile ? "180px" : "210px",
      objectFit: "contain",
    },
    submittedRow: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: isMobile ? "10px" : "14px",
      width: "100%",
      minHeight: isMobile ? "120px" : "160px",
    },
    previewCard: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      width: "fit-content",
      maxWidth: isMobile ? "140px" : "180px",
      background: theme.handSlot,
      padding: isMobile ? "6px" : "8px",
      border: `1px solid ${theme.border}`,
      boxSizing: "border-box",
    },
    previewImage: {
      display: "block",
      width: "auto",
      maxWidth: isMobile ? "128px" : "164px",
      maxHeight: isMobile ? "100px" : "130px",
      objectFit: "contain",
    },
    waitingCard: {
      width: isMobile ? "128px" : "164px",
      height: isMobile ? "100px" : "130px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      color: theme.muted,
      border: `1px dashed ${theme.borderSoft}`,
      background: theme.panelBg,
      boxSizing: "border-box",
    },
    revealCard: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      width: "fit-content",
      maxWidth: isMobile ? "140px" : "180px",
      background: theme.handSlot,
      padding: isMobile ? "6px" : "8px",
      cursor: "pointer",
      color: theme.text,
      boxSizing: "border-box",
    },
    revealImage: {
      width: "100%",
      height: isMobile ? "100px" : "130px",
      objectFit: "cover",
      display: "block",
    },
    revealText: { fontSize: "11px", marginTop: "6px" },
    centerText: {
      fontSize: "12px",
      marginTop: "4px",
      textAlign: "center",
      color: theme.muted,
    },
    actionRow: {
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      marginTop: "8px",
    },
    actionButton: {
      border: `1px solid ${theme.border}`,
      background: theme.handSlot,
      color: theme.text,
      padding: "6px 10px",
      fontFamily: "Comic Sans MS, Verdana, sans-serif",
      cursor: "pointer",
    },
    playerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: `1px dotted ${theme.borderSoft}`,
      padding: "5px 0",
    },
    playerStatus: { fontSize: "10px", color: theme.muted },
    statsBox: {
      marginTop: "12px",
      paddingTop: "8px",
      borderTop: `1px dashed ${theme.borderSoft}`,
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    handHeader: {
      padding: "6px 12px",
      fontSize: isMobile ? "11px" : "12px",
      color: theme.muted,
      borderTop: `1px dashed ${theme.borderSoft}`,
      background: theme.pageBg,
    },
    handBar: {
      minHeight: isMobile ? "160px" : "220px",
      borderTop: `1px solid ${theme.border}`,
      background: theme.handBg,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
    },
    handInner: {
      display: "flex",
      gap: isMobile ? "18px" : "22px",
      overflowX: "visible",
      overflowY: "visible",
      maxWidth: "100%",
      padding: isMobile ? "12px" : "12px 18px",
      justifyContent: isMobile ? "flex-start" : "center",
      alignItems: "center",
    },
    handMessage: { fontSize: "13px", color: theme.muted },
    handImage: {
      display: "block",
      width: "auto",
      maxWidth: isMobile ? "120px" : "140px",
      height: "auto",
      maxHeight: isMobile ? "140px" : "180px",
      objectFit: "cover",
      cursor: "pointer",
      background: theme.handSlot,
      flex: "0 0 auto",
      transition: "transform 0.15s ease, border 0.15s ease, opacity 0.15s ease",
      boxShadow: `0 0 0 2px ${theme.panelAlt}`,
      boxSizing: "border-box",
    },
  };
}
