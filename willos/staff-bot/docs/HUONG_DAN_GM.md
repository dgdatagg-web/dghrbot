# Hướng Dẫn GM — DG HR Bot
**Phiên bản:** 1.0 | **Cập nhật:** 2026-03-09
**Áp dụng cho:** GM ⚔️

> Tài liệu này dành riêng cho GM. GM có toàn quyền hệ thống.
> Các quyền dưới đây **bổ sung thêm** vào tất cả quyền của Quản lý và Nhân viên.

---

## MỤC LỤC
1. [Điều chỉnh EXP — /exp](#1-điều-chỉnh-exp--exp)
2. [Archive nhân viên — /fire](#2-archive-nhân-viên--fire)
3. [Gán role — /setrole](#3-gán-role--setrole)
4. [Tổng quan hệ thống — /tongquan](#4-tổng-quan-hệ-thống--tongquan)
5. [Duyệt lên Quản lý — /approve](#5-duyệt-lên-quản-lý--approve)
6. [Xử lý vi phạm](#6-xử-lý-vi-phạm)
7. [Quản lý EXP thủ công](#7-quản-lý-exp-thủ-công)
8. [Tình huống thường gặp](#8-tình-huống-thường-gặp)
9. [Cron jobs — Hệ thống tự động](#9-cron-jobs--hệ-thống-tự-động)
10. [Dữ liệu và bảo mật](#10-dữ-liệu-và-bảo-mật)

---

## 1. Điều Chỉnh EXP — /exp

GM là người duy nhất được trừ và cộng EXP thủ công ngoài hệ thống tự động.

### Cú pháp
```
/exp [tên nhân viên] [+/-số] [lý do]
```

### Ví dụ
```
/exp Minh Tuấn -20 đi trễ không báo
/exp Thu Hà +15 làm thêm ca ngoài lịch
/exp Khải -50 vắng không báo thứ 3
/exp Linh +30 KPI tháng 3 đạt 100%
```

### Nguyên tắc
- **Luôn ghi lý do** — dữ liệu được lưu lại để audit
- Không trừ EXP khi chưa xác minh vi phạm
- Khi nhân viên hỏi tại sao bị trừ → giải thích bằng lý do đã nhập

### Bảng vi phạm chuẩn
| Vi phạm | EXP |
|---------|-----|
| Đi trễ không báo | -20 |
| Không nộp bàn giao ca | -15 |
| Vắng không báo | -50 |
| Hủy hàng không lý do | -20 |
| Lỗi đơn Grab | -25 |
| Vi phạm vệ sinh ATTP | -100 |
| Gian lận GPS check-in | -200 |

### Bảng khen thưởng chuẩn
| Đóng góp | EXP gợi ý |
|---------|----------|
| Làm thêm ca ngoài lịch | +15 |
| KPI tháng 100% | +30 |
| Khách khen 5 sao | +15 |
| Đi làm đầy đủ cả tháng | +50 |
| Dạy Newbie lên được Nhân viên | +30 |

---

## 2. Archive Nhân Viên — /fire

Khi nhân viên nghỉ việc. Data **không bị xóa** — chỉ chuyển sang trạng thái inactive.

### Cú pháp
```
/fire [tên nhân viên]
```

### Sau khi fire
- Nhân viên không còn hiện trong leaderboard và check-in
- Lịch sử dữ liệu vẫn giữ nguyên
- Khôi phục (nếu họ quay lại): dùng `/approve [tên]`

### Lưu ý
- Kiểm tra chắc chắn đúng tên trước khi fire
- Fire nhầm người → dùng `/approve [tên]` để khôi phục

---

## 3. Gán Role — /setrole

GM có thể gán role cho bất kỳ nhân viên nào (tối đa Quản lý khi gán bằng quyền GM).

### Cú pháp
```
/setrole [@username] [role]
```

### Role hợp lệ
`newbie` · `nhanvien` · `kycuu` · `quanly` · `gm`

### Ví dụ
```
/setrole @minhtuan quanly
/setrole @thuha kycuu
/setrole @khoa gm
```

### Sau khi gán
- Bot tự nhắn DM thông báo cho nhân viên biết role đã thay đổi
- Role mới có hiệu lực ngay lập tức

### Lưu ý
- Lookup theo **@username Telegram** — nhân viên phải có username trong profile Telegram
- Nếu nhân viên chưa có username: nhắc họ đặt username trong Telegram Settings

---

## 4. Tổng Quan Hệ Thống — /tongquan

Xem snapshot toàn hệ thống.

### Cú pháp
```
/tongquan
```

### Nội dung hiển thị
- Tổng nhân sự đang active
- Số ca hôm nay (check-in/checkout)
- Doanh thu (nếu đã tích hợp)
- Top EXP tuần/tháng
- Nhân viên vi phạm gần đây

---

## 5. Duyệt Lên Quản Lý — /approve

Khi nhân viên đạt 1000+ EXP và được đề xuất lên Quản lý, cần GM duyệt.

### Xem danh sách chờ duyệt
```
/approve
```

### Duyệt
```
/approve [tên nhân viên]
```

### Tiêu chí duyệt (ngoài EXP)
- Thâm niên và độ tin cậy
- Không có vi phạm nặng trong 30 ngày gần nhất
- GM đánh giá chủ quan về năng lực lãnh đạo

---

## 6. Xử Lý Vi Phạm

### Quy trình chuẩn
1. **Xác minh** — xem log, hỏi quản lý ca xác nhận
2. **Trừ EXP** — dùng `/exp [tên] -[số] [lý do cụ thể]`
3. **Thông báo** — nhắn DM cho nhân viên biết lý do
4. **Ghi nhận** — lý do đã lưu trong hệ thống để audit

### Xử lý no-show (hệ thống tự làm lúc 23:30)
- Hệ thống tự phát hiện và trừ -50 EXP
- Nếu nhân viên thực sự có mặt nhưng bị trừ nhầm (GPS/bot lỗi): dùng `/exp [tên] +50 hoàn EXP no-show nhầm ngày XX/XX`

### Vi phạm nghiêm trọng
- GPS gian lận: -200 EXP + cân nhắc `/fire`
- Vi phạm ATTP: -100 EXP + báo cáo quản lý cấp trên

---

## 7. Quản Lý EXP Thủ Công

### Khi nào cần can thiệp thủ công
| Tình huống | Hành động |
|-----------|----------|
| Nhân viên check-in bị lỗi GPS, thực sự có mặt | `/exp [tên] +3 check-in đúng giờ ngày XX/XX - GPS lỗi` |
| Nhân viên no-show nhầm do lỗi hệ thống | `/exp [tên] +50 hoàn EXP no-show nhầm` |
| Thêm ca ngoài lịch | `/exp [tên] +15 thêm ca ngoài lịch XX/XX` |
| Nhân viên hoàn thành KPI tháng | `/exp [tên] +30 KPI tháng [tháng] 100%` |
| Khách khen 5 sao | `/exp [tên] +15 khách khen 5 sao ngày XX/XX` |

### Nguyên tắc
- Ghi lý do rõ ràng và đủ dữ liệu (ngày tháng, lý do)
- Không điều chỉnh EXP khi không có bằng chứng
- Dữ liệu EXP là hồ sơ nhân sự — chỉnh sai ảnh hưởng đến lộ trình thăng cấp

---

## 8. Tình Huống Thường Gặp

### Nhân viên khiếu nại bị trừ EXP không đúng
1. Kiểm tra log qua database (nếu cần báo kỹ thuật)
2. Xác minh sự việc với quản lý ca
3. Nếu trừ nhầm: hoàn lại bằng `/exp [tên] +[số] hoàn EXP nhầm - [lý do]`

### Nhân viên nghỉ việc đột ngột
1. `/fire [tên]` để archive
2. Cập nhật lịch ca ngay — xóa ca của họ trước 23:30
3. Sắp xếp người thay nếu cần

### Nhân viên cũ quay lại làm
1. `/approve [tên]` để khôi phục tài khoản
2. Kiểm tra EXP và role hiện tại — điều chỉnh nếu cần
3. Yêu cầu họ check-in lại để bắt đầu streak mới

### Muốn promote nhân viên trực tiếp (không chờ EXP)
1. Dùng `/setrole [@username] [role]` để gán thẳng role mong muốn
2. Ghi chú lý do promote ngoài quy trình EXP (ví dụ: kinh nghiệm đặc biệt, cần thiết cho vận hành)

### Bot không phản hồi lệnh GM
- Thử `/cancel` trước rồi gõ lại
- Kiểm tra PM2 status: `pm2 status` — nếu bot offline thì restart
- Báo kỹ thuật nếu cần restart thường xuyên

### Nhân viên đăng ký sai tên
- Cần sửa trực tiếp trong database (báo kỹ thuật)
- Bot không có lệnh đổi tên — phải can thiệp ở cấp db

---

## 9. Cron Jobs — Hệ Thống Tự Động

Hệ thống chạy tự động theo lịch. GM cần biết để không can thiệp nhầm thời điểm.

| Job | Thời gian | Chức năng |
|-----|-----------|-----------|
| No-show detection | **23:30 ICT** hàng ngày | So lịch ca vs check-in. Ai có lịch mà không check-in → trừ -50 EXP |
| Bảng điểm danh | Mỗi sáng | Đăng vào nhóm |
| Bảng xếp hạng EXP | Đầu tuần | Đăng vào nhóm |
| Nhắc moca | **08:45** | Nhắc trưởng ca |
| Nhắc bàn giao | **14:00** | Nhắc nhân viên nộp `/bc` |

### Lưu ý quan trọng
- **23:30** là deadline cứng — cập nhật lịch ca trước giờ này nếu có nhân viên nghỉ
- Sau khi hệ thống chạy rồi, cần hoàn EXP thủ công nếu trừ nhầm

---

## 10. Dữ Liệu Và Bảo Mật

### Database location
```
/Users/dongocminh/.openclaw/workspace/willos/data/staff.db
```

### Các bảng chính
| Bảng | Dữ liệu |
|------|---------|
| `staff` | Hồ sơ nhân viên, EXP, role, streak |
| `checkin_log` | Lịch sử check-in/checkout |
| `shift_schedule` | Lịch ca đã submit |
| `bc_log` | Lịch sử bàn giao ca |
| `inventory_log` | Lịch sử nhập hàng |

### Nguyên tắc bảo mật
- Không chia sẻ nội dung database với bên ngoài
- Dữ liệu tài chính và doanh thu chỉ xem qua bot — không export tùy tiện
- Khi có vấn đề kỹ thuật: báo kỹ thuật, không tự sửa database

---

## Liên Hệ Kỹ Thuật

Vấn đề cần can thiệp database hoặc code → báo **kỹ thuật**.

---

*DG HR Bot — Hệ thống quản lý nhân sự | Phiên bản 1.0 | 2026*
