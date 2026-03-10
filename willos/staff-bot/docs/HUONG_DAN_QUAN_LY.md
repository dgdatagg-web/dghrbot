# Hướng Dẫn Quản Lý — DG HR Bot
**Phiên bản:** 1.1 | **Cập nhật:** 2026-03-11
**Áp dụng cho:** Quản lý 🛡️ · Trưởng ca (có thêm quyền `/moca` `/dongca`)

> Tài liệu này dành riêng cho Quản lý. Các quyền ở đây **bổ sung thêm** vào quyền nhân viên thông thường.
> Xem hướng dẫn nhân viên tại: `HUONG_DAN_NHAN_VIEN.md`

---

## MỤC LỤC
1. [Mở ca đầu ngày — /moca](#1-mở-ca-đầu-ngày--moca)
2. [Đóng ca cuối ngày — /dongca](#2-đóng-ca-cuối-ngày--dongca)
3. [Lịch ca — /lichca](#3-lịch-ca--lichca)
4. [Duyệt nhân viên — /approve](#4-duyệt-nhân-viên--approve)
5. [Nhập hàng — /nhaphang](#5-nhập-hàng--nhaphang)
6. [Xem báo cáo ca và tài chính](#6-xem-báo-cáo-ca-và-tài-chính)
7. [Reward Engine — Task & KPI](#7-reward-engine--task--kpi)
8. [Trách nhiệm quản lý vận hành](#8-trách-nhiệm-quản-lý-vận-hành)
9. [Tình huống thường gặp](#9-tình-huống-thường-gặp)
10. [Thông báo tự động trong nhóm](#10-thông-báo-tự-động-trong-nhóm)

---

## 1. Mở Ca Đầu Ngày — /moca

*Chỉ áp dụng cho trưởng ca.*

### Khi nào làm
- Đầu mỗi ca làm việc, **trước khi nhân viên bắt đầu làm**

### Cách làm
1. Mở DM với bot
2. Gõ: `/moca`
3. Bot hỏi từng bước theo checklist mở ca
4. Trả lời từng mục — kiểm tra vệ sinh, thiết bị, tồn kho cơ bản
5. Kết quả báo cáo mở ca được đẩy lên **nhóm làm việc** tự động

> **Tầm quan trọng:** Báo cáo mở ca là bằng chứng ca được bàn giao đúng quy trình. Không bỏ qua.

---

## 2. Đóng Ca Cuối Ngày — /dongca

*Chỉ áp dụng cho trưởng ca.*

### Khi nào làm
- Cuối ca, **sau khi tất cả nhân viên đã checkout**

### Cách làm
1. Mở DM với bot
2. Gõ: `/dongca`
3. Bot hỏi từng bước tổng kết ca: doanh thu, tồn kho, sự cố, nhận xét
4. Trả lời từng mục
5. Báo cáo đóng ca đẩy lên nhóm làm việc

### Sau khi đóng ca
- Toàn bộ dữ liệu ca (check-in, checkout, bàn giao, mở/đóng ca) được lưu
- GM và quản lý cấp cao có thể xem báo cáo

---

## 3. Lịch Ca — /lichca

Quản lý submit lịch ca cho nhân viên trong nhóm.

### Cách submit lịch theo ngày
```
/lichca [tên nhân viên]: T2 T4 T6
```
Ví dụ:
```
/lichca Minh Tuấn: T2 T4 T6
/lichca Thu Hà: T3 T5 CN
```

### Cách submit với ca cụ thể
```
/lichca [tên nhân viên] T2:tối T3:9h-13h T5:sáng
```

### Xem lịch ca
```
/lichca view                    → Lịch ca tuần hiện tại
/lichca view 2026-W12           → Lịch ca tuần cụ thể (theo số tuần ISO)
```

### Thứ hợp lệ
`T2 T3 T4 T5 T6 T7 CN`

### Lưu ý quan trọng
- Submit lịch **trước khi tuần bắt đầu**
- Nhân viên có lịch mà **không check-in** → hệ thống phát hiện lúc 23:30 ICT và tự động trừ EXP (-50)
- Nếu nhân viên nghỉ phép → cập nhật lịch ca trước 23:30 để tránh trừ nhầm

---

## 4. Duyệt Nhân Viên — /approve

Khi nhân viên đạt đủ điều kiện lên **Quản lý 🛡️** (1000+ EXP), cần GM hoặc quản lý cấp cao duyệt thêm.

### Xem danh sách chờ duyệt
```
/approve
```

### Duyệt trực tiếp
```
/approve [tên nhân viên]
```

> Newbie → Nhân viên → Kỳ cựu tự động theo EXP. Chỉ cấp Quản lý trở lên mới cần duyệt tay.

---

## 5. Nhập Hàng — /nhaphang

Áp dụng cho bộ phận **Kho** và **Quản lý trở lên**.

### Cách làm
1. Chụp ảnh hóa đơn nhập hàng
2. Mở DM với bot
3. Gửi ảnh hóa đơn kèm caption `/nhaphang`
   *hoặc* gõ `/nhaphang` trước → bot sẽ hỏi để gửi ảnh
4. Bot xử lý và đẩy phiếu nhập hàng + ảnh lên nhóm làm việc

### Thông tin cần có trong hóa đơn
- Tên hàng, số lượng, đơn giá
- Tên nhà cung cấp
- Ngày mua

---

## 6. Xem Báo Cáo Ca Và Tài Chính

Quản lý có quyền xem:
- **Báo cáo ca:** Dữ liệu check-in/checkout, bàn giao, mở/đóng ca
- **Tài chính:** Dữ liệu doanh thu, nhập hàng

> Xem qua bot bằng `/tongquan` (nếu được GM cấp) hoặc qua báo cáo tự động trong nhóm.

---

## 7. Reward Engine — Task & KPI

Quản lý có quyền tạo, xác nhận và huỷ task/KPI cho nhân viên.

### Xem Townboard
```
/tb
```
Danh sách tất cả task và KPI đang mở. Nhân viên xem và join qua đây.

### Xác nhận nhân viên hoàn thành task
```
/completetask [id] [tên nhân viên]
```
Ví dụ: `/completetask 3 Minh Tuấn`
- EXP cộng ngay cho nhân viên
- Cash reward (nếu có) → payout row mở, chờ GM xác nhận thanh toán

### Huỷ task của nhân viên
```
/canceltask [id] [tên nhân viên]
```
EXP đã cộng sẽ bị hoàn lại nếu task đã từng completed.

### Xác nhận nhân viên đạt Cash KPI
```
/kpihit [assignment_id]
```
Dùng ID từ `/tb`. Gửi DM tức thì cho nhân viên. Mở payout row chờ GM xác nhận tiền.

### Tạo Cash KPI cho nhân viên
```
/cashkpi [tên nhân viên]
```
Bot hỏi từng bước: tên KPI, số tiền thưởng, thời hạn. Tự động assign cho nhân viên.

---

## 8. Trách Nhiệm Quản Lý Vận Hành

### Hàng ngày
| Thời điểm | Việc cần làm |
|-----------|-------------|
| Đầu ca | Xác nhận trưởng ca đã `/moca` |
| Trong ca | Theo dõi nhân viên có check-in đúng giờ không |
| Cuối ca | Đảm bảo tất cả đã checkout + bàn giao |
| Trước 23:30 | Cập nhật lịch ca nếu có thay đổi nhân sự |

### Hàng tuần
- Submit lịch ca tuần tới trước Chủ Nhật
- Review báo cáo EXP, phát hiện ai cần khen/xử lý

### Xử lý vi phạm
- Phát hiện vi phạm → báo GM để xử lý EXP
- Quản lý không tự trừ EXP — quyền này thuộc GM

---

## 8. Tình Huống Thường Gặp

### Nhân viên quên checkout
- Nhắc nhân viên checkout nếu còn kịp
- Nếu đã về rồi: báo GM để ghi nhận thủ công trong database

### Nhân viên không check-in nhưng có mặt (GPS lỗi)
- Xác nhận nhân viên thực sự có mặt
- Báo GM để check-in thủ công — tránh để hệ thống tự phát hiện no-show và trừ EXP

### Nhân viên nghỉ đột xuất
- Cập nhật lịch ca trước 23:30 ICT hôm đó
- Nếu quá 23:30: báo GM để cancel penalty sau khi hệ thống chạy

### Submit lịch sai ngày/tên
- Gõ lại `/lichca` với thông tin đúng — lịch mới sẽ ghi đè

### /moca không đẩy lên nhóm
- Hoàn thành đủ tất cả các bước trong flow — không bỏ câu hỏi nào
- Nếu đã hoàn thành mà không thấy: chờ 2–3 phút, nhóm đôi khi delay

### Bot hỏi câu hỏi moca/dongca nhưng bị ngắt quãng
- Gõ `/cancel` rồi làm lại từ đầu
- Timeout là ~10–15 phút — nếu bị gián đoạn sẽ cần làm lại

### Muốn approve một nhân viên nhưng không thấy trong danh sách
- Chỉ nhân viên đạt 1000+ EXP mới vào danh sách chờ duyệt lên Quản lý
- Kiểm tra EXP nhân viên bằng cách hỏi họ dùng `/profile`

---

## 9. Thông Báo Tự Động Trong Nhóm

Bot tự đăng vào nhóm khi có các sự kiện:

| Sự kiện | Nội dung |
|---------|---------|
| Nhân viên check-in | Thông báo vào ca |
| Nhân viên checkout | Thông báo ra ca + tổng giờ làm |
| `/moca` hoàn thành | Báo cáo mở ca đầy đủ |
| `/dongca` hoàn thành | Báo cáo đóng ca + tổng kết |
| `/bc` hoàn thành | Bàn giao ca theo bộ phận |
| `/nhaphang` hoàn thành | Phiếu nhập hàng + ảnh |
| Mỗi sáng (cron) | Bảng điểm danh ngày |
| Mỗi tuần (cron) | Bảng xếp hạng EXP |
| 23:30 ICT (cron) | Phát hiện no-show → trừ EXP |

---

## Liên Hệ Hỗ Trợ

Vấn đề kỹ thuật → báo **GM** để xử lý trong hệ thống.

---

*DG HR Bot — Hệ thống quản lý nhân sự | Phiên bản 1.0 | 2026*
