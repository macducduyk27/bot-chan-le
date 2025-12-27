const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

/* ================== CONFIG ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMINS = [1913597752];

/* ================== WEB ================== */
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

/* ================== BOT ================== */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATABASE (RAM) ================== */
const users = {};
const withdrawRequests = [];
const withdrawHistory = [];

function initUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 0,
      step: null,
      betAmount: 0,
      choice: null,
      playing: false,
      withdrawAmount: 0,
      withdrawInfo: ""
    };
  }
}

function resetUserState(user) {
  user.step = null;
  user.choice = null;
  user.playing = false;
  user.betAmount = 0;
  user.withdrawAmount = 0;
  user.withdrawInfo = "";
}

/* ================== MENU ================== */
function mainMenu(chatId) {
  bot.sendMessage(chatId, "🎮 MENU CHÍNH", {
    reply_markup: {
      keyboard: [
        ["👤 Thông tin cá nhân"],
        ["🎲 Game chẵn lẻ"],
        ["💳 Nạp tiền"],
        ["💰 Số dư", "💸 Rút tiền"]
      ],
      resize_keyboard: true
    }
  });
}

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  initUser(chatId);

  bot.sendMessage(chatId,
`🎲 BOT CHẴN / LẺ – 1 XÚC XẮC

🎯 Xúc 1 viên – Kết quả ngay
🎲 Trò chơi giải trí minh bạch – công bằng
💰 Thắng thua cập nhật số dư tức thì
🔒 Hệ thống tự động – bảo mật

⚠️ LƯU Ý:
BOT chỉ có 1 ADMIN DUY NHẤT: @admxucxactele  
Ngoài tài khoản trên, tất cả đều là giả mạo.

🎁 ƯU ĐÃI NGƯỜI DÙNG MỚI
👉 Tặng ngay 20,000 VND
📩 Nhắn ngay @admxucxactele để nhận 20,000 VND tiền trải nghiệm.`
  );

  mainMenu(chatId);
});

/* ================== MESSAGE ================== */
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").replace(/,/g, '');
  initUser(chatId);
  const user = users[chatId];

  if (text === "👤 Thông tin cá nhân") {
    return bot.sendMessage(chatId,
`👤 ID: ${chatId}
💰 Số dư: ${user.balance.toLocaleString()} VND`);
  }

  if (text === "💰 Số dư") {
    return bot.sendMessage(chatId,
`💰 ${user.balance.toLocaleString()} VND`);
  }

/* ===== RÚT TIỀN ===== */
if (text === "💸 Rút tiền") {
  resetUserState(user);   // 🔥 DÒNG QUAN TRỌNG
  user.step = "withdraw_amount";
  return bot.sendMessage(chatId,
`✅ Số Tiền Rút Tối Thiểu Là: 200,000 VND

🏧 Bạn nhập số tiền rút
Ví dụ: 200000`);
}

if (user.step === "withdraw_amount") {
  const amount = parseInt(text);
  if (isNaN(amount) || amount < 200000)
    return bot.sendMessage(chatId, "❌ Số tiền rút tối thiểu 200,000 VND");
  if (amount > user.balance)
    return bot.sendMessage(chatId, "❌ Số dư không đủ");

  user.withdrawAmount = amount;
  user.step = "withdraw_info";

  return bot.sendMessage(chatId,
`Bạn vui lòng nhập:
Tên ngân hàng + Họ tên + STK

Ví dụ:
Vietcombank N.V.A 123456789`);
}

if (user.step === "withdraw_info") {
  user.withdrawInfo = text;
  user.step = "withdraw_confirm";

  return bot.sendMessage(chatId,
`❗ XÁC NHẬN RÚT TIỀN
💰 Số tiền: ${user.withdrawAmount.toLocaleString()} VND`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Chắc chắn", callback_data: "confirm_withdraw" }],
        [{ text: "❌ Huỷ", callback_data: "cancel_withdraw" }]
      ]
    }
  });
}
  if (text === "💳 Nạp tiền") {
    return bot.sendMessage(chatId,
`📩 Liên hệ admin: @admxucxactele`);
  }

  if (text === "🎲 Game chẵn lẻ") {
  resetUserState(user); // 🔥 QUAN TRỌNG
  user.step = "bet";
  return bot.sendMessage(chatId,
`💵 NHẬP TIỀN CƯỢC
Tối thiểu 5,000 VND`);
}

  if (user.step === "bet") {
    if (!/^\d+$/.test(text)) return;
    const amount = parseInt(text);

    if (amount < 5000)
      return bot.sendMessage(chatId, "❌ Cược tối thiểu 5,000");
    if (amount > user.balance)
      return bot.sendMessage(chatId, "❌ Số dư không đủ");

    user.betAmount = amount;
    user.step = "choose";

    return bot.sendMessage(chatId, "👉 Chọn cửa", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⚪ CHẴN (2-4-6)", callback_data: "even" }],
          [{ text: "⚫ LẺ (1-3-5)", callback_data: "odd" }]
        ]
      }
    });
  }
});

/* ================== CALLBACK ================== */
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  initUser(chatId);
  const user = users[chatId];
  // ===== XÁC NHẬN RÚT TIỀN =====
if (q.data === "confirm_withdraw") {
  withdrawRequests.push({
    id: chatId,
    amount: user.withdrawAmount,
    info: user.withdrawInfo,
    status: "pending"
  });

  user.balance -= user.withdrawAmount;

  await bot.editMessageText("✅ Đã ghi nhận yêu cầu rút tiền", {
    chat_id: chatId,
    message_id: q.message.message_id
  });

  ADMINS.forEach(aid => {
    bot.sendMessage(aid,
`📢 YÊU CẦU RÚT TIỀN
👤 ID: ${chatId}
💰 ${user.withdrawAmount.toLocaleString()} VND
🏧 ${user.withdrawInfo}`);
  });

  resetUserState(user);
  return mainMenu(chatId);
}

if (q.data === "cancel_withdraw") {
  await bot.editMessageText("❌ Đã huỷ yêu cầu rút tiền", {
    chat_id: chatId,
    message_id: q.message.message_id
  });
  resetUserState(user);
  return mainMenu(chatId);
}

  // ===== CHỌN CỬA =====
  if (q.data === "even" || q.data === "odd") {
    if (user.choice)
      return bot.answerCallbackQuery(q.id, { text: "❌ Đã chọn rồi", show_alert: true });

    user.choice = q.data;
    user.playing = true;

    return bot.sendMessage(chatId, "🎲 BẤM ĐỂ XÚC", {
      reply_markup: {
        inline_keyboard: [[{ text: "🎲 XÚC", callback_data: "roll" }]]
      }
    });
  }

  // ===== XÚC =====
  if (q.data === "roll" && user.playing) {
    const dice = await bot.sendDice(chatId);
    const value = dice.dice.value;

    const isEven = value % 2 === 0;
    const win = (user.choice === "even" && isEven) ||
                (user.choice === "odd" && !isEven);

    const change = user.betAmount;
    user.balance += win ? change : -change;

    await bot.sendMessage(chatId,
`🎲 KẾT QUẢ
🎯 Xúc: ${value}
📌 Bạn chọn: ${user.choice === "even" ? "CHẴN" : "LẺ"}
🏆 Kết quả: ${win ? "THẮNG" : "THUA"}
💰 ${win ? "+" : "-"}${change.toLocaleString()} VND
💳 Số dư: ${user.balance.toLocaleString()} VND`);

    // LOG ADMIN
    ADMINS.forEach(aid => {
      bot.sendMessage(aid,
`📊 LOG CHẴN LẺ
👤 ID: ${chatId}
🎲 Xúc: ${value}
🎯 Cửa: ${user.choice}
💰 ${win ? "+" : "-"}${change.toLocaleString()}
💳 Dư: ${user.balance.toLocaleString()}`);
    });

    resetUserState(user);
    return mainMenu(chatId);
  }
});

/* ================== ADMIN NẠP ================== */
bot.onText(/\/naptien (\d+) (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const uid = parseInt(m[1]);
  const amount = parseInt(m[2]);

  initUser(uid);
  users[uid].balance += amount;

  bot.sendMessage(uid, `🎉 Đã nạp ${amount.toLocaleString()} VND`);
  bot.sendMessage(msg.chat.id, `✅ Nạp thành công cho ${uid}`);
});
bot.onText(/\/ruttien (\d+)/, (msg, m) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  const uid = parseInt(m[1]);

  const reqIndex = withdrawRequests.findIndex(
    r => r.id === uid && r.status === "pending"
  );

  if (reqIndex === -1) {
    return bot.sendMessage(msg.chat.id, "❌ Không tìm thấy yêu cầu rút tiền");
  }

  const req = withdrawRequests[reqIndex];
  req.status = "done";
  withdrawHistory.push(req);
  withdrawRequests.splice(reqIndex, 1);

  // ✅ THÔNG BÁO USER (CHÍNH LÀ CÁI BẠN MUỐN)
  bot.sendMessage(uid,
`🎉 CHÚC MỪNG BẠN 🎉

💸 Yêu cầu rút tiền đã được xử lý thành công
💰 Số tiền: ${req.amount.toLocaleString()} VND
🏧 ${req.info}

Cảm ơn bạn đã sử dụng bot ❤️`);

  // TB admin
  bot.sendMessage(msg.chat.id,
`✅ Đã duyệt rút tiền cho user ${uid}
💰 ${req.amount.toLocaleString()} VND`);
});
bot.onText(/\/danhsachrut/, (msg) => {
  if (!ADMINS.includes(msg.chat.id)) return;

  if (withdrawRequests.length === 0) {
    return bot.sendMessage(
      msg.chat.id,
      "📭 Hiện không có yêu cầu rút tiền nào đang chờ duyệt"
    );
  }

  let text = "📋 DANH SÁCH RÚT TIỀN CHỜ DUYỆT\n\n";

  withdrawRequests.forEach((r, i) => {
    text +=
`#${i + 1}
👤 User ID: ${r.id}
💰 Số tiền: ${r.amount.toLocaleString()} VND
🏧 Thông tin: ${r.info}
📌 Trạng thái: CHỜ DUYỆT

`;
  });

  bot.sendMessage(msg.chat.id, text);
});