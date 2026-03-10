# Mock Data — Văn Phòng Kế Toán ABC

> **Lưu ý:** Đây là dữ liệu tổng hợp (synthetic data) phục vụ mục đích demo pilot. Mọi tên, mã số thuế đều là hư cấu.

---

## 1. Thông Tin Văn Phòng

| Thông tin | Chi tiết |
|-----------|----------|
| **Tên công ty** | Văn Phòng Kế Toán ABC |
| **Địa chỉ** | 45 Nguyễn Thị Minh Khai, Q.3, TP.HCM |
| **Số nhân viên** | 3 người (1 kế toán trưởng + 2 kế toán viên) |
| **Phần mềm sử dụng** | MISA SME.NET 2024 |
| **Số khách hàng** | 20 doanh nghiệp |
| **Loại hình** | Công ty TNHH dịch vụ kế toán – thuế |
| **Thành lập** | 2018 |
| **Doanh thu trung bình/tháng** | ~85 triệu VNĐ |

### Nhân Sự

| Nhân viên | Chức vụ | Kinh nghiệm | Lương/tháng |
|-----------|---------|-------------|-------------|
| Chị Hương | Kế toán trưởng | 12 năm | 18 triệu VNĐ |
| Anh Tuấn | Kế toán viên | 5 năm | 11 triệu VNĐ |
| Chị Lan | Kế toán viên | 2 năm | 8 triệu VNĐ |

**Chi phí lao động trung bình:** ~12,333 VNĐ/giờ (tính trên 8h/ngày, 22 ngày/tháng)

---

## 2. Danh Sách 20 Khách Hàng

| # | Tên Doanh Nghiệp | Mã Số Thuế | Loại Hình | Hóa Đơn/Tháng | Ghi Chú |
|---|-----------------|------------|-----------|----------------|---------|
| 1 | Công ty TNHH Phở Bà Đắng | 0317123456 | F&B – Nhà hàng | 80–120 | Đối tác GrabFood, Baemin |
| 2 | Cửa Hàng Thời Trang Yolo | 0318234567 | Bán lẻ | 40–60 | Shopee, TikTok Shop |
| 3 | Công ty TNHH Vận Tải Minh Tiến | 0316345678 | Vận tải | 30–50 | Hóa đơn dầu nhiên liệu nhiều |
| 4 | Trung Tâm Anh Ngữ SmartKids | 0319456789 | Giáo dục | 20–30 | Dịch vụ – ít hóa đơn |
| 5 | Spa & Nail Studio Bích Ngọc | 0317567890 | Dịch vụ làm đẹp | 15–25 | Nhiều chi phí nhập nguyên liệu |
| 6 | Công ty TNHH Xây Dựng Hoàng Gia | 0315678901 | Xây dựng | 100–200 | Hóa đơn VLXD phức tạp |
| 7 | Siêu Thị Mini Hòa Bình | 0318789012 | Bán lẻ thực phẩm | 150–250 | Khối lượng hóa đơn lớn nhất |
| 8 | Công ty TNHH IT Solutions NextGen | 0319890123 | Công nghệ | 10–20 | Xuất hóa đơn USD, phức tạp |
| 9 | Tiệm Bánh Homemade Thu Trang | 0317901234 | F&B – Bakery | 30–50 | GrabFood, tự giao |
| 10 | Công ty TNHH Quảng Cáo Sáng Tạo VN | 0318012345 | Quảng cáo | 25–40 | Chi phí Facebook Ads, Google Ads |
| 11 | Phòng Khám Đa Khoa An Bình | 0316123456 | Y tế | 20–30 | Hàng hoá y tế miễn thuế |
| 12 | Cơ Sở May Mặc Xuân Hương | 0317234567 | Sản xuất | 60–90 | Nguyên liệu vải, phụ liệu |
| 13 | Công ty TNHH Du Lịch Happy Travel | 0319345678 | Du lịch | 15–25 | Hoá đơn GTGT dịch vụ |
| 14 | Trại Gà Sạch Gia Đình Bà Loan | 0315456789 | Nông nghiệp | 10–15 | Hàng hoá nông nghiệp thuế 5% |
| 15 | Cửa Hàng Điện Tử Minh Phúc | 0318567890 | Bán lẻ điện tử | 50–80 | Lazada, Shopee |
| 16 | Công ty CP Bất Động Sản Sunrise | 0317678901 | BĐS | 5–10 | Hóa đơn giá trị lớn, ít số lượng |
| 17 | Xưởng Cơ Khí Phước Thịnh | 0316789012 | Sản xuất | 40–70 | Nhiều nhà cung cấp kim loại |
| 18 | Công ty TNHH Logistics TốcĐộ | 0319890234 | Logistics | 35–55 | Hóa đơn nhiên liệu + phí cầu đường |
| 19 | Nhà Thuốc Tây Thảo Nguyên | 0317901345 | Dược phẩm | 70–100 | Thuốc miễn thuế + BHYT |
| 20 | Studio Chụp Ảnh Ánh Dương | 0318012456 | Dịch vụ sáng tạo | 8–15 | Hóa đơn dịch vụ đơn giản |

**Tổng hóa đơn xử lý/tháng (trung bình):** ~920 hóa đơn

---

## 3. Dữ Liệu Giao Dịch 3 Tháng (Tóm Tắt)

### Tháng 10/2024

| Khách hàng | Hóa đơn đầu vào | Hóa đơn đầu ra | Doanh thu (triệu VNĐ) | Thuế GTGT phải nộp (triệu) |
|------------|----------------|----------------|----------------------|--------------------------|
| Phở Bà Đắng | 95 | 102 | 380 | 28.5 |
| Yolo Fashion | 52 | 44 | 145 | 10.2 |
| Vận Tải Minh Tiến | 38 | 41 | 210 | 14.8 |
| Xây Dựng Hoàng Gia | 165 | 148 | 1,200 | 72.0 |
| Siêu Thị Mini Hòa Bình | 220 | 185 | 480 | 18.5 |
| *(15 khách còn lại)* | ~380 | ~360 | ~2,100 | ~105 |
| **TỔNG** | **950** | **880** | **4,515** | **249.0** |

### Tháng 11/2024

| Khách hàng | Hóa đơn đầu vào | Hóa đơn đầu ra | Doanh thu (triệu VNĐ) | Thuế GTGT phải nộp (triệu) |
|------------|----------------|----------------|----------------------|--------------------------|
| Phở Bà Đắng | 88 | 97 | 365 | 27.1 |
| Yolo Fashion | 58 | 51 | 160 | 11.5 |
| Vận Tải Minh Tiến | 35 | 39 | 198 | 13.9 |
| Xây Dựng Hoàng Gia | 178 | 162 | 1,350 | 81.0 |
| Siêu Thị Mini Hòa Bình | 195 | 172 | 510 | 19.8 |
| *(15 khách còn lại)* | ~365 | ~342 | ~2,050 | ~98 |
| **TỔNG** | **919** | **863** | **4,633** | **251.3** |

### Tháng 12/2024 (Cao Điểm)

| Khách hàng | Hóa đơn đầu vào | Hóa đơn đầu ra | Doanh thu (triệu VNĐ) | Thuế GTGT phải nộp (triệu) |
|------------|----------------|----------------|----------------------|--------------------------|
| Phở Bà Đắng | 118 | 125 | 480 | 36.0 |
| Yolo Fashion | 72 | 68 | 210 | 15.2 |
| Vận Tải Minh Tiến | 48 | 52 | 245 | 18.1 |
| Xây Dựng Hoàng Gia | 210 | 198 | 1,580 | 94.8 |
| Siêu Thị Mini Hòa Bình | 268 | 241 | 620 | 25.4 |
| *(15 khách còn lại)* | ~445 | ~420 | ~2,480 | ~125 |
| **TỔNG** | **1,161** | **1,104** | **5,615** | **314.5** |

---

## 4. Phân Tích Điểm Đau (Pain Points) & Thời Gian Tiêu Tốn

### 4.1 Các Công Việc Thủ Công Hàng Tháng

| Công việc | Người thực hiện | Giờ/tháng (hiện tại) | Mô tả vấn đề |
|-----------|----------------|----------------------|-------------|
| Nhập liệu hóa đơn vào MISA | Chị Lan + Anh Tuấn | 48 giờ | Nhập tay từng hóa đơn, sai sót nhiều |
| Đối chiếu công nợ | Anh Tuấn | 20 giờ | Excel thủ công, khách không phản hồi đúng hạn |
| Kiểm tra hạn nộp thuế | Chị Hương | 8 giờ | Check lịch tay, dễ bỏ sót |
| Lập báo cáo thuế GTGT | Chị Hương + Tuấn | 16 giờ | Tổng hợp từ nhiều nguồn, dễ nhầm |
| Trả lời câu hỏi của khách | Chị Hương | 12 giờ | Lặp đi lặp lại, cùng một loại câu hỏi |
| Soạn & gửi email nhắc nhở | Chị Lan | 6 giờ | Copy-paste template thủ công |
| Lookup quy định thuế mới | Chị Hương | 10 giờ | Đọc công văn, thông tư trên mạng |
| Chuẩn bị tờ khai quyết toán | Chị Hương | 24 giờ | Cuối năm áp lực nhất |
| Kiểm tra số dư tài khoản | Anh Tuấn | 4 giờ | Đăng nhập từng ngân hàng |
| Xử lý sai sót, điều chỉnh | Cả nhóm | 14 giờ | Do nhập liệu sai, phải làm lại |
| **TỔNG** | | **162 giờ/tháng** | |

### 4.2 Pain Points Theo Mức Độ Nghiêm Trọng

| # | Pain Point | Mức độ (1–5) | Tần suất | Hệ quả |
|---|-----------|-------------|---------|--------|
| 1 | Không nhớ hạn nộp thuế của từng khách | ⭐⭐⭐⭐⭐ | Hàng tháng | Bị phạt, mất uy tín |
| 2 | Nhập liệu hóa đơn sai, phải làm lại | ⭐⭐⭐⭐⭐ | Hàng tuần | Mất 2–4 giờ sửa/lần |
| 3 | Khách hỏi lặp đi lặp lại cùng một câu | ⭐⭐⭐⭐ | Hàng ngày | Mất tập trung, stress |
| 4 | Không kịp cập nhật thay đổi luật thuế | ⭐⭐⭐⭐ | Hàng quý | Tư vấn sai → rủi ro pháp lý |
| 5 | Khách GrabFood/TMĐT không hiểu hóa đơn điện tử | ⭐⭐⭐⭐ | Hàng tuần | Mất nhiều thời gian giải thích |
| 6 | Báo cáo cuối tháng luôn trễ deadline | ⭐⭐⭐ | Hàng tháng | Căng thẳng, làm thêm giờ |
| 7 | Không có cách tra cứu nhanh quy định | ⭐⭐⭐ | 2–3 lần/tuần | Phải tự search Google, mất thời gian |
| 8 | Quản lý công nợ khách hàng kém hiệu quả | ⭐⭐⭐ | Hàng tháng | Doanh thu văn phòng bị chậm |

### 4.3 Câu Hỏi Lặp Lại Nhiều Nhất Từ Khách Hàng

1. *"Tháng này tui phải nộp thuế bao nhiêu?"* (hỏi hàng tháng)
2. *"Hóa đơn điện tử làm thế nào?"* (GrabFood partners)
3. *"Sắp đến hạn nộp thuế chưa chị?"* (lo lắng hàng tháng)
4. *"Công ty tui có được hoàn thuế không?"*
5. *"Chi phí này có được khấu trừ không?"*
6. *"Nghị định/Thông tư mới có ảnh hưởng tới tui không?"*
7. *"Tui cần giấy tờ gì để quyết toán thuế TNCN?"*
8. *"Cách hạch toán chi phí quảng cáo Facebook như thế nào?"*

---

*Dữ liệu được tổng hợp dựa trên khảo sát thực tế của các văn phòng kế toán SME tại TP.HCM, Q3-Q4/2024.*
