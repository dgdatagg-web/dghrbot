# Hướng Dẫn Nhân Viên — DG HR Bot
**Phiên bản:** 1.1 | **Cập nhật:** 2026-03-11
**Áp dụng cho:** Newbie 🐣 · Nhân viên ⚡ · Kỳ cựu 🔥

---

## MỤC LỤC
1. [Đăng ký lần đầu](#1-đăng-ký-lần-đầu)
2. [Check-in mỗi ngày](#2-check-in-mỗi-ngày)
3. [Checkout cuối ca](#3-checkout-cuối-ca)
4. [Bàn giao ca](#4-bàn-giao-ca)
5. [Xem thông tin cá nhân](#5-xem-thông-tin-cá-nhân)
6. [Hệ thống EXP](#6-hệ-thống-exp)
7. [Huy hiệu (Badges)](#7-huy-hiệu-badges)
8. [Thăng cấp](#8-thăng-cấp)
9. [Tình huống thường gặp](#9-tình-huống-thường-gặp)
10. [Quy tắc nhóm và DM](#10-quy-tắc-nhóm-và-dm)

---

## 1. Đăng Ký Lần Đầu

**Mọi lệnh cá nhân đều làm trong DM với bot, không phải trong nhóm.**

### Cách làm
1. Mở chat riêng với `@DG_HR_BOT`
2. Gõ: `/dangky [tên của bạn]`
   - Ví dụ: `/dangky Minh Tuấn`
3. Bot sẽ hỏi bộ phận và vị trí — chọn bằng nút bấm
4. Đăng ký xong ngay, không cần chờ duyệt

> **Lưu ý:** Tên nhập lần đầu sẽ được lưu vĩnh viễn. Nhập đúng tên thật của bạn.

### Sau khi đăng ký
- Role mặc định: **Newbie 🐣**
- EXP bắt đầu: 0
- Tự động lên **Nhân viên ⚡** khi đạt 100 EXP

---

## 2. Check-in Mỗi Ngày

### Cách check-in
1. Mở DM với bot
2. Gõ: `/checkin`
3. Bot yêu cầu gửi **vị trí GPS** — bấm nút "Chia sẻ vị trí" trong Telegram
4. Nếu bạn đang ở trong quán → check-in thành công
5. Bot thông báo lên **nhóm làm việc** rằng bạn đã vào ca

### Thời gian và EXP check-in
| Thời gian | EXP nhận được |
|-----------|--------------|
| Đúng giờ (trễ < 5 phút) | +3 EXP |
| Trễ 5–15 phút | +1 EXP |
| Trễ > 15 phút | 0 EXP |

> **Tip:** Check-in đúng giờ mỗi ngày để giữ streak và nhận bonus milestone.

---

## 3. Checkout Cuối Ca

### Cách checkout
1. Mở DM với bot
2. Gõ: `/checkout`
3. Bot xác nhận giờ ra và tổng số giờ làm trong ca
4. Thông báo lên nhóm làm việc

> **Quan trọng:** Luôn checkout trước khi về. Nếu quên checkout, xem phần [Tình huống thường gặp](#9-tình-huống-thường-gặp).

---

## 4. Bàn Giao Ca

Sau mỗi ca làm, **bàn giao ca là bắt buộc** — bỏ qua sẽ bị trừ **-15 EXP**.

### Cách làm
1. Mở DM với bot
2. Gõ: `/bc`
3. Bot hỏi từng bước theo checklist của bộ phận bạn
4. Trả lời từng câu hỏi theo hướng dẫn
5. Kết quả bàn giao được đẩy lên nhóm làm việc

### Hủy giữa chừng
Nếu cần thoát: gõ `/cancel` hoặc `/huy`

---

## 5. Xem Thông Tin Cá Nhân

| Lệnh | Chức năng |
|------|-----------|
| `/profile` hoặc `/me` hoặc `/stats` | Xem EXP, role, streak, số ca |
| `/leaderboard` hoặc `/lb` | Bảng xếp hạng EXP toàn nhóm |
| `/roadmap` | Lộ trình thăng cấp + badges còn thiếu |
| `/badges` | Bộ sưu tập huy hiệu đã đạt được |

---

## 5b. Townboard — Task & KPI

Bot có hệ thống Townboard: **nhiệm vụ và KPI** được đăng để nhân viên tham gia và kiếm thêm phần thưởng.

### Xem nhiệm vụ đang mở
```
/tb
```
Hiển thị tất cả task và KPI đang hoạt động, phần thưởng EXP + cash tương ứng.

### Tham gia nhiệm vụ
```
/join [id]
```
Ví dụ: `/join 3` để tham gia task số 3.

### Sau khi tham gia
- Quản lý sẽ xác nhận khi bạn hoàn thành
- EXP được cộng ngay sau khi xác nhận
- Cash reward (nếu có) được xác nhận thanh toán riêng
- Kiểm tra trạng thái bằng `/profile`

---

## 6. Hệ Thống EXP

### Cách kiếm EXP tự động
| Hành động | EXP |
|-----------|-----|
| Check-in đúng giờ | +3 |
| Check-in trễ 5–15 phút | +1 |
| Bàn giao ca (`/bc`) đúng hạn | +2 |
| Streak 7 ngày liên tiếp | +20 bonus |
| Streak 14 ngày liên tiếp | +40 bonus |
| Streak 30 ngày liên tiếp | +80 bonus |
| Streak 60 ngày liên tiếp | +150 bonus |

> Streak bonus chỉ nhận đúng vào **mốc ngày** (7, 14, 30, 60). Không có +1 EXP/ngày bình thường.

### EXP bị trừ (do GM/Quản lý xử lý)
| Vi phạm | EXP bị trừ |
|---------|-----------|
| Đi trễ không báo | -20 |
| Không nộp bàn giao ca | -15 |
| Vắng không báo | -50 |
| Hủy hàng không lý do | -20 |
| Lỗi đơn Grab | -25 |
| Vi phạm vệ sinh ATTP | -100 |
| Gian lận GPS check-in | -200 |

### Kiếm EXP thêm (do GM ghi nhận)
| Đóng góp | EXP gợi ý |
|---------|-----------|
| Làm thêm ca ngoài lịch | +15 |
| KPI tháng 100% | +30 |
| Khách khen 5 sao | +15 |
| Đi làm đầy đủ cả tháng | +50 |
| Dạy Newbie lên được Nhân viên | +30 |

---

## 7. Huy Hiệu (Badges)

Bot tự động trao huy hiệu khi bạn đạt điều kiện. Nhận được → bot nhắn DM ngay.

| Huy hiệu | Icon | Điều kiện |
|---------|------|-----------|
| First Blood | 🩸 | Ca đầu tiên hoàn thành |
| Grinder | ⚙️ | 30 ca tích lũy |
| Century | 💯 | 100 ca tích lũy |
| On Fire | 🔥 | Streak 7 ngày liên tiếp |
| Legendary | 🌟 | Streak 30 ngày liên tiếp |
| Mentor | 🎓 | 1 người bạn giới thiệu đã lên Nhân viên |
| KPI King | 👑 | 3 tháng KPI 100% liên tiếp (GM ghi nhận) |
| Clean Slate | 🧹 | 30 ngày không vi phạm |
| Comeback | ⚡ | EXP từ âm lên dương |

---

## 8. Thăng Cấp

| Role | Icon | EXP cần | Cách lên |
|------|------|---------|---------|
| Newbie | 🐣 | 0 | Tự động khi đăng ký |
| Nhân viên | ⚡ | 100 | Tự động khi đủ EXP |
| Kỳ cựu | 🔥 | 500 | Tự động khi đủ EXP |
| Quản lý | 🛡️ | 1000+ | Cần GM/quản lý cấp cao duyệt thêm |

Dùng `/roadmap` để xem bạn còn thiếu bao nhiêu EXP và badges gì.

---

## 9. Tình Huống Thường Gặp

### GPS không hoạt động / không gửi được vị trí
- Kiểm tra Telegram có quyền truy cập vị trí chưa (Settings > Apps)
- Tắt WiFi, dùng 4G — GPS qua WiFi đôi khi không chính xác
- Ra ngoài một chút cho GPS bắt tín hiệu, thử lại
- Nếu vẫn không được: báo ngay với quản lý ca để ghi nhận thủ công

### GPS bắt không đúng vị trí (đang trong quán nhưng bot báo không hợp lệ)
- Di chuyển ra gần cửa sổ hoặc cửa ra vào
- Tắt và mở lại Telegram, thử lại
- Báo với quản lý nếu lỗi lặp lại nhiều lần

### Quên checkout
- Báo ngay với quản lý ca hoặc GM
- GM có thể xử lý thủ công trong database
- Không tự ý check-in ngày hôm sau nếu chưa checkout hôm trước

### Check-in xong rồi nhưng nhóm không thấy thông báo
- Check-in của bạn đã được ghi nhận trong hệ thống
- Thông báo đôi khi delay 1–2 phút — chờ thêm
- Nếu sau 5 phút vẫn không thấy: báo quản lý kiểm tra

### Bot không phản hồi
- Chờ 1–2 phút rồi thử lại
- Thử gõ `/cancel` trước rồi gõ lại lệnh cần dùng
- Báo quản lý nếu bot im lặng hơn 5 phút

### Đang làm bàn giao ca, bị gián đoạn / muốn dừng giữa chừng
- Gõ `/cancel` hoặc `/huy` để thoát
- Bước đang làm sẽ bị xóa — bắt đầu lại từ đầu khi sẵn sàng

### Bàn giao ca hỏi xong hết nhưng không thấy kết quả lên nhóm
- Kết quả có thể delay 1–2 phút
- Nếu sau 5 phút không lên: làm lại `/bc` từ đầu

### Đăng ký sai tên
- Báo GM để được sửa trong database
- Không tự tạo tài khoản mới — hệ thống theo dõi theo username Telegram

### Muốn xem lịch sử vi phạm hoặc EXP bị trừ
- Dùng `/profile` để xem tổng EXP hiện tại
- Hỏi GM nếu muốn biết chi tiết từng lần trừ

### Đăng ký xong nhưng không thấy mình trong leaderboard
- Leaderboard chỉ hiện người đã có EXP > 0
- Check-in ngày đầu tiên xong sẽ xuất hiện

### Timeout giữa chừng (bot hỏi nhưng không trả lời kịp)
- Các lệnh có bước nhiều (`/bc`, `/dangky`) có timeout ~10–15 phút
- Nếu quá giờ: gõ lại lệnh từ đầu, làm không ngắt quãng

---

## 10. Quy Tắc Nhóm Và DM

### Bot trong nhóm làm việc
- Bot **không đọc** tin nhắn thường trong nhóm
- Bot **không trả lời** khi mọi người chat với nhau
- Bot chỉ **tự đăng** khi có sự kiện: check-in, checkout, bàn giao, mở/đóng ca, nhập hàng

### Mọi lệnh cá nhân → làm trong DM
Không gõ lệnh trong nhóm — bot sẽ không phản hồi.

### Thông báo tự động trong nhóm
Bot sẽ đăng vào nhóm khi:
- Nhân viên check-in / checkout
- Trưởng ca hoàn thành `/moca` hoặc `/dongca`
- Nhân viên hoàn thành `/bc`
- Nhập hàng `/nhaphang` xong
- Mỗi sáng: bảng điểm danh ngày
- Mỗi tuần: bảng xếp hạng EXP

---

## Liên Hệ Hỗ Trợ

Nếu gặp vấn đề không giải quyết được:
1. Báo **quản lý ca** trực tiếp
2. Quản lý báo lên **GM** nếu cần xử lý hệ thống

---

*DG HR Bot — Hệ thống quản lý nhân sự | Phiên bản 1.0 | 2026*
