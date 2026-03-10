# DG HR Bot — Staff RPG System

Hệ thống HR gamified cho DG Group, chạy qua Telegram bot **DG_HR_BOT**.

> ⚠️ **Bot đã tồn tại** — Dùng token của `DG_HR_BOT` từ @BotFather. **Không cần tạo bot mới.**

---

## Setup

```bash
# 1. Cài dependencies
cd willos/staff-bot
npm install

# 2. Điền token vào willos/.env
# Mở file: /path/to/willos/.env
# Tìm dòng: DG_HR_BOT_TOKEN=# Fill in token from @BotFather
# Thay bằng token thực từ @BotFather

# 3. Khởi động bot
npm start

# Development mode (auto-restart)
npm run dev
```

### ENV Variables (`willos/.env`)

| Key | Mô tả |
|-----|-------|
| `DG_HR_BOT_TOKEN` | Token của **DG_HR_BOT** (lấy từ @BotFather) |
| `CREATOR_TELEGRAM_ID` | Telegram ID của Creator (Will) |
| `STAFF_DB_PATH` | (Optional) Path đến SQLite DB |

---

## Command Reference

### 👤 Nhân viên

| Command | Mô tả |
|---------|-------|
| `/dangky [tên]` | Đăng ký tài khoản mới |
| `/checkin` | Bắt đầu ca làm việc |
| `/checkout` | Kết thúc ca làm việc |
| `/profile [tên?]` | Xem character sheet |
| `/badges [tên?]` | Xem badge collection |
| `/roadmap [tên?]` | Xem milestone map cá nhân |
| `/leaderboard` hoặc `/lb` | Bảng xếp hạng EXP |
| `/help` | Danh sách commands |

### 🛡️ Quản lý / GM / Creator

| Command | Mô tả |
|---------|-------|
| `/approve [tên]` | Duyệt nhân viên pending |
| `/exp [tên] [+/-N] [lý do]` | Điều chỉnh EXP thủ công |
| `/lichca [tên]: T2 T3 T5` | Submit lịch ca tuần này |
| `/lichca [tên]: T2 T4 2026-W10` | Submit lịch ca tuần cụ thể |
| `/lichca view [tuần?]` | Xem lịch ca tuần |
| `/fire [tên]` | Archive nhân viên (giữ data) |

### 👾 Creator Only

| Command | Mô tả |
|---------|-------|
| `/delete [tên]` | Xóa hoàn toàn nhân viên (cần confirm) |
| `/delete [tên] CONFIRM` | Xác nhận xóa |

---

## Role Progression

```
🐣 Newbie (0–99 EXP)
    ↓ auto-promote
⚡ Nhân viên (100–499 EXP)
    ↓ auto-promote
🔥 Kỳ cựu (500–999 EXP)
    ↓ cần duyệt thủ công
🛡️ Quản lý (1000+ EXP)

Special roles (set thủ công):
⚔️ GM
👾 Creator
```

## EXP System

| Event | EXP |
|-------|-----|
| Checkin đúng giờ | +5 |
| Streak bonus (mỗi ngày) | +1 (max +10) |
| Đi trễ 15–30p | -10 |
| Vắng không báo | -25 |
| No-show ca đã đăng ký | -25 |
| KPI 100% tháng | +30 |
| Perfect attendance tháng | +50 |
| Khách hàng khen | +15 |

---

## Badge System

| Badge | Icon | Điều kiện |
|-------|------|-----------|
| First Blood | 🩸 | Ca đầu tiên |
| Grinder | ⚙️ | 30 ca tích lũy |
| Century | 💯 | 100 ca tích lũy |
| On Fire | 🔥 | Streak 7 ngày |
| Legendary | 🌟 | Streak 30 ngày |
| Mentor | 🎓 | Giới thiệu 1 người lên Nhân viên |
| KPI King | 👑 | 3 tháng KPI 100% liên tiếp |
| Clean Slate | 🧹 | 30 ngày không vi phạm |
| Comeback | ⚡ | Từ EXP âm → positive |

---

## File Structure

```
staff-bot/
  index.js              ← Entry point (DG_HR_BOT)
  db.js                 ← Database layer (SQLite)
  package.json
  .env.example          ← Template config
  commands/
    dangky.js           ← /dangky
    checkin.js          ← /checkin
    checkout.js         ← /checkout
    profile.js          ← /profile
    approve.js          ← /approve
    exp_cmd.js          ← /exp
    leaderboard.js      ← /leaderboard /lb
    lichca.js           ← /lichca
    roadmap.js          ← /roadmap
    fire.js             ← /fire /delete
    badges_cmd.js       ← /badges
  utils/
    roles.js            ← Role thresholds, permissions
    exp.js              ← EXP calculation
    format.js           ← Message formatting
    badges.js           ← Badge definitions + check logic
    noshow.js           ← No-show detection
```

---

## No-Show Detection

Để chạy no-show check cuối ngày, import và gọi `detectNoShows` từ `utils/noshow.js`:

```js
const { detectNoShows, getCurrentWeek, getDayCode } = require('./utils/noshow');
const db = require('./db');

// Cuối ngày (ví dụ: cron 23:00)
const today = new Date();
const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
const week = getCurrentWeek(today);             // "2026-W09"
const dayCode = getDayCode(today);              // "T2"-"CN"

const penalized = detectNoShows(db, date, week, dayCode);
// penalized = [{staff, expDelta, newExp}, ...]
```

---

*DG Group — Staff RPG System v1.0*
