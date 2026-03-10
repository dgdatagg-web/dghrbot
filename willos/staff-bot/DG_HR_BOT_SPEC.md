# DG HR BOT — Master Spec
**Source of truth for all bot behavior, EXP values, roles, and commands.**
**Last updated:** 2026-03-09
**Version:** 2.0
**Verified against:** Code (not memory). All values crosschecked against `utils/exp.js`, `utils/roles.js`, `utils/badges.js`, `commands/`.

---

## HOW THIS FILE WORKS

This file governs the bot. Not the other way around.

- **Will edits this file** when he wants to change behavior
- **Claude reads this file** and updates the corresponding code
- **Nova crosschecks against this file** — if the bot says something different, the bot is wrong

When something changes:
1. Edit the relevant section below
2. Note it in the Changelog at the bottom
3. Tell Claude: "update the bot to match the spec"

---

## SYSTEM OVERVIEW

**Bot:** `@DG_HR_BOT`
**Database:** `/Users/dongocminh/.openclaw/workspace/willos/data/staff.db`
**Entry point:** `/Users/dongocminh/.openclaw/workspace/willos/staff-bot/index.js`
**Code files to update when spec changes:**
- EXP values → `utils/exp.js` (EXP_EVENTS object)
- Role thresholds → `utils/roles.js` (ROLES object)
- Badge conditions → `utils/badges.js` (BADGES array + checkAndAwardBadges)
- Permissions → `utils/roles.js` (PERMISSIONS + SOP_ACCESS objects)
- Commands → `commands/[command].js`
- Cron jobs → `index.js` (bottom section)

---

## ROLES

| Role | Icon | EXP Range | Notes |
|------|------|-----------|-------|
| Newbie | 🐣 | 0–99 | Auto-activated on `/dangky`. No approval needed. |
| Nhân viên | ⚡ | 100–499 | Auto-promoted when EXP hits 100. |
| Kỳ cựu | 🔥 | 500–999 | Auto-promoted when EXP hits 500. |
| Quản lý | 🛡️ | 1000+ | Requires GM/Creator approval even after hitting 1000 EXP. |
| GM | ⚔️ | Special | Manually assigned. Full system access. |
| Creator | 👾 | Special | Will only. God mode. |

**Code location:** `utils/roles.js` → `ROLES` object, `getRoleFromExp()`

---

## PERMISSIONS

| Permission | Newbie | NV | Kỳ cựu | Quản lý | GM | Creator |
|-----------|--------|----|--------|---------|-----|---------|
| Check-in / Checkout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bàn giao ca `/bc` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem profile, leaderboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Xem SOP đầy đủ | 👁️ view only | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ghi nhận KPI | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Xem báo cáo ca | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Duyệt nhân viên `/approve` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Lịch ca `/lichca` submit | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Xem tài chính | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Nhập hàng `/nhaphang` | ❌ | ❌ | ✅ (kho only) | ✅ | ✅ | ✅ |
| Mở/đóng ca `/moca` `/dongca` | ❌ | ❌ | ❌ | ❌ (truong_ca only) | ✅ | ✅ |
| Điều chỉnh EXP `/exp` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Archive nhân viên `/fire` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Xóa tài khoản `/delete` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reward Engine — post/complete/cancel/kpihit | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reward Engine — confirmpayout/posttask | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Báo cáo doanh thu `/baocaodoanhthu` | ❌ | ❌ | ❌ | @ttminchi + @akerchientuong only | ✅ | ✅ |

**Code location:** `utils/roles.js` → `PERMISSIONS` object, `canSubmitMoca()`, `canSubmitDongca()`, `canSubmitNhaphang()`, `canSubmitShift()`

---

## SOP ACCESS

| SOP | Newbie | NV | Kỳ cựu | Quản lý |
|-----|--------|----|--------|---------|
| Mở/đóng bếp | 👁️ | ✅ | ✅ | ✅ |
| QC vệ sinh | 👁️ | ✅ | ✅ | ✅ |
| Xử lý complaint | 🔒 | ✅ | ✅ | ✅ |
| Nhập hàng | 🔒 | 🔒 | ✅ | ✅ |
| Tài chính | 🔒 | 🔒 | 🔒 | ✅ |

**Code location:** `utils/roles.js` → `SOP_ACCESS` object

---

## EXP SYSTEM

### Cộng EXP (auto)

| Sự kiện | EXP | Code key |
|---------|-----|----------|
| Check-in đúng giờ (< 5 phút) | +3 | `CHECKIN_ON_TIME` |
| Check-in trễ 5–15 phút | +1 | `CHECKIN_LATE_MINOR` |
| Check-in trễ > 15 phút | 0 | `CHECKIN_LATE_MAJOR` |
| Bàn giao ca `/bc` đúng hạn | +2 | `BC_SUBMITTED` |
| Streak milestone 7 ngày | +20 bonus | `STREAK_7` |
| Streak milestone 14 ngày | +40 bonus | `STREAK_14` |
| Streak milestone 30 ngày | +80 bonus | `STREAK_30` |
| Streak milestone 60 ngày | +150 bonus | `STREAK_60` |

> Streak bonus chỉ cộng vào đúng mốc 7/14/30/60 ngày. Không có +1/ngày liên tiếp.

### Cộng EXP (manual — GM/Creator dùng `/exp`)

| Sự kiện | EXP gợi ý | Ghi chú |
|---------|-----------|---------|
| Thêm ca ngoài lịch | +15 | `EXTRA_SHIFT` |
| KPI tháng 100% | +30 | Manual |
| Khách khen 5 sao | +15 | Manual |
| Perfect attendance tháng | +50 | Manual |
| Mentor (dạy Newbie lên NV) | +30 | Manual |

### Trừ EXP

| Vi phạm | EXP | Code key | Auto? |
|---------|-----|----------|-------|
| Đi trễ không báo | -20 | `LATE_NO_NOTICE` | Manual |
| Không nộp BC | -15 | `MISS_BC` | Manual |
| Vắng không báo | -50 | `ABSENT_NO_NOTICE` | Manual |
| Hủy hàng không lý do | -20 | `HUY_HANG_NO_REASON` | Manual |
| Lỗi đơn Grab | -25 | `GRAB_ORDER_MISTAKE` | Manual |
| Vi phạm vệ sinh ATTP | -100 | `FOOD_SAFETY_VIOLATION` | Manual |
| Gian lận GPS check-in | -200 | `GPS_FRAUD` | Manual |

> No-show: nếu đăng ký lịch ca mà không check-in → phát hiện lúc **23:30 ICT** hàng ngày (cron tự động). EXP penalty áp dụng theo `ABSENT_NO_NOTICE` (-50).

**Code location:** `utils/exp.js` → `EXP_EVENTS` object, `calculateCheckinExp()`

---

## COMMANDS

### Tất cả nhân viên (DM với bot)

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/dangky [tên]` | Đăng ký tài khoản | Bot hỏi thêm bộ phận + vị trí qua inline keyboard. Newbie active ngay. |
| `/checkin` | Vào ca | Yêu cầu gửi GPS trong 5 phút. Phải trong quán. |
| `/checkout` | Ra ca | Ghi nhận giờ ra, tính thời gian làm. |
| `/bc` | Bàn giao ca | Bot hỏi từng bước theo checklist bộ phận. Kết quả đẩy lên nhóm. |
| `/profile` hoặc `/me` hoặc `/stats` | Xem thông tin cá nhân | EXP, role, streak, số ca. |
| `/leaderboard` hoặc `/lb` | Bảng xếp hạng EXP | |
| `/roadmap` | Lộ trình thăng cấp + badges còn thiếu | |
| `/badges` | Bộ sưu tập huy hiệu | |
| `/cancel` hoặc `/huy` | Hủy bước đang làm | Dùng khi muốn thoát giữa chừng bất kỳ lệnh nào. |

### Trưởng ca (thêm vào)

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/moca` | Báo cáo mở ca đầu ngày | Checklist từng bước. Kết quả đẩy lên nhóm. |
| `/dongca` | Báo cáo đóng ca cuối ngày | Tổng kết ca. Kết quả đẩy lên nhóm. |

### Quản lý (thêm vào)

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/approve` | Xem danh sách chờ duyệt | Chỉ role Quản lý cần approve. |
| `/approve [tên]` | Duyệt trực tiếp | |
| `/lichca [tên]: T2 T4 T6` | Submit lịch ca tuần này | Thứ hợp lệ: T2 T3 T4 T5 T6 T7 CN |
| `/lichca [tên] T2:tối T3:9h-13h` | Submit lịch ca với ca cụ thể | |
| `/lichca view` | Xem lịch ca tuần hiện tại | |
| `/lichca view 2026-W10` | Xem lịch ca tuần cụ thể | |
| `/nhaphang` | Nhập hàng | Chụp ảnh hóa đơn gửi bot. Kho + Quản lý trở lên. |

### GM / Creator (thêm vào)

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/exp [tên] [+/-số] [lý do]` | Điều chỉnh EXP thủ công | VD: `/exp Hiếu -20 đi trễ không báo` |
| `/fire [tên]` | Archive nhân viên nghỉ việc | Data giữ nguyên. Khôi phục: `/approve [tên]` |
| `/setrole [@username] [role]` | Assign role cho nhân viên | Creator: mọi role. GM: tối đa quanly. Lookup theo @username. |
| `/tongquan` | Tổng quan toàn hệ thống | Doanh thu, nhân sự, ca làm việc. |
| `/baocaodoanhthu` | Báo cáo doanh thu hàng ngày | GM/Creator + @ttminchi + @akerchientuong. Guided 6-bước + chứng từ ảnh. |
| `/xemdoanhthu [ngày?]` | Xem báo cáo doanh thu | GM/Creator only. |
| `/assignreporter [tên]` | Phân công người nộp báo cáo doanh thu | GM/Creator only. |

### Reward Engine — Quản lý trở lên

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/tb` | Townboard — xem tất cả task & KPI đang mở | Tất cả nhân viên. |
| `/join [id]` | Tham gia task | Tất cả nhân viên. |
| `/posttask` | Đăng task / KPI mới | GM/Creator. Guided flow. |
| `/completetask [id] [tên]` | Xác nhận hoàn thành task | Quản lý trở lên. |
| `/canceltask [id] [tên]` | Huỷ task của nhân viên | Quản lý trở lên. |
| `/cashkpi [tên]` | Tạo Cash KPI cho nhân viên | Quản lý trở lên. Guided flow. |
| `/kpihit [assignment_id]` | Xác nhận nhân viên đạt KPI | Quản lý trở lên. Mở payout row. |
| `/confirmpayout` | Xác nhận thanh toán cash reward | GM/Creator. |

### Creator Only (Will)

| Lệnh | Chức năng | Ghi chú |
|------|-----------|---------|
| `/delete [tên]` | Yêu cầu xác nhận xóa | Hard delete — không khôi phục được. |
| `/delete [tên] CONFIRM` | Xác nhận xóa hẳn | |

---

## BADGES

| Badge | Icon | Điều kiện chính xác |
|-------|------|---------------------|
| First Blood | 🩸 | Ca đầu tiên (checkin_count ≥ 1) |
| Grinder | ⚙️ | 30 ca tích lũy |
| Century | 💯 | 100 ca tích lũy |
| On Fire | 🔥 | Streak ≥ 7 ngày liên tiếp |
| Legendary | 🌟 | Streak ≥ 30 ngày liên tiếp |
| Mentor | 🎓 | Có ít nhất 1 người mình giới thiệu đã lên được Nhân viên |
| KPI King | 👑 | 3 tháng KPI 100% liên tiếp |
| Clean Slate | 🧹 | 30 ngày không vi phạm |
| Comeback | ⚡ | EXP từ thực sự âm (< 0) lên dương |

Badge tự award sau mỗi check-in hoặc thay đổi EXP. Khi earn → bot thông báo ngay trong DM.

**Code location:** `utils/badges.js` → `BADGES` array + `checkAndAwardBadges()`

---

## BOT TRONG NHÓM LÀM VIỆC

Bot **không đọc tin nhắn thường** trong nhóm.
Bot **không trả lời** khi mọi người nói chuyện với nhau.
Mọi lệnh cá nhân → làm trong **DM**.

Bot tự động đăng vào nhóm khi:

| Sự kiện | Nội dung đăng |
|---------|--------------|
| Check-in thành công | Thông báo vào ca |
| Checkout thành công | Thông báo ra ca + tổng giờ làm |
| `/moca` hoàn thành | Báo cáo mở ca đầy đủ |
| `/dongca` hoàn thành | Báo cáo đóng ca đầy đủ |
| `/bc` hoàn thành | Bàn giao ca theo bộ phận |
| `/nhaphang` hoàn thành | Phiếu nhập hàng + ảnh hóa đơn |
| Mỗi sáng (tự động) | Bảng điểm danh ngày |
| Mỗi tuần (tự động) | Bảng xếp hạng EXP |
| 23:30 ICT mỗi ngày (tự động) | Phát hiện no-show → trừ EXP |

---

## CRON JOBS

| Job | Thời gian | Chức năng |
|-----|-----------|-----------|
| No-show detection | 23:30 ICT hàng ngày (16:30 UTC) | So sánh shift_schedule vs checkin_log. Ai có lịch mà không check-in → trừ EXP. |
| Daily scorecard | Mỗi sáng | Bảng điểm danh ngày đăng vào nhóm (topic 172). |
| Weekly leaderboard | Đầu tuần | Bảng xếp hạng EXP đăng vào nhóm. |
| Reminders | 08:45, 14:00 | Nhắc moca (08:45), nhắc bc (14:00). |

**Code location:** `index.js` → bottom cron section

---

## CHANGELOG

| Ngày | Version | Thay đổi | Người thực hiện |
|------|---------|---------|-----------------|
| 2026-02-26 | 1.0 | Khởi tạo spec | Will |
| 2026-02-28 | 1.1 | Code hoàn chỉnh — 75/75 tests pass | Nova |
| 2026-02-28 | 1.2 | Newbie auto-active, alias commands, no-show cron, inline approve | Nova |
| 2026-03-09 | 2.0 | Full rewrite từ code thực tế. Sửa EXP sai (checkin +3 không phải +5, vắng -50 không phải -25, không có streak +1/ngày). Sửa lichca syntax. Comeback badge condition chính xác. Thêm permissions table đầy đủ. Thêm cron jobs section. | Claude (từ code) |
| 2026-03-11 | 2.2 | Reward Engine commands added (Ch1–Ch9 complete). `/tb`, `/join`, `/posttask`, `/completetask`, `/canceltask`, `/cashkpi`, `/kpihit`, `/confirmpayout`. Permissions table updated. `/baocaodoanhthu` restricted to GM/Creator + @ttminchi + @akerchientuong. | Claude |

---

## GHI CHÚ KỸ THUẬT

- **GPS check-in:** `utils/venue.js` → `isWithinVenue()` — kiểm tra tọa độ có trong bán kính quán không.
- **Pending flows:** Các lệnh có bước nhiều (`/dangky`, `/bc`, `/lichca`, `/moca`, `/dongca`, `/nhaphang`) dùng in-memory Map với timeout. Nếu timeout (thường 10–15 phút) → phải làm lại từ đầu.
- **Group push:** Topic ID 172 là topic mặc định trong nhóm làm việc (`GROUP_CHAT_ID` trong `.env`).
- **EFATAL errors:** Network hiccup Telegram polling — bot tự recover, không ảnh hưởng dữ liệu.
