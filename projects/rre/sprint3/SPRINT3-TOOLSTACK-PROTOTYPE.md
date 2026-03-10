# RRE Sprint 3 — Kế Toán/Thuế SME Vertical
## Prototype Specification: Free Audit Workflow + Tool Stack

**Version:** 1.0  
**Date:** 2026-03-01  
**Target:** Văn phòng kế toán dịch vụ 1-5 người, 15-50 SME clients  
**Stack:** MISA (export/import only) + Excel + Zalo + Make.com + Gemini API

---

# DELIVERABLE 1 — Free 1-Week Audit Toolkit

## A. Bảng Câu Hỏi Trước Kiểm Toán (Pre-Audit Questionnaire)

> *Gửi trước khi đến văn phòng 3-5 ngày. Gửi qua Zalo, yêu cầu trả lời bằng text hoặc voice note.*

---

**[FORM PRE-AUDIT — GỬI QUA ZALO]**

Chào [Tên], mình là [Tên RRE] — mình đang nghiên cứu cách tự động hóa quy trình kế toán cho các văn phòng như của bạn. Trước khi gặp nhau, bạn có thể trả lời nhanh 10 câu hỏi dưới đây không? Mỗi câu 1-2 dòng là được, không cần chi tiết.

---

**Câu 1 — Quy mô văn phòng:**
Văn phòng bạn hiện có bao nhiêu kế toán viên (kể cả bạn)? Đang phụ trách bao nhiêu khách hàng doanh nghiệp?

**Câu 2 — Phần mềm đang dùng:**
Bạn đang dùng phần mềm kế toán nào? (MISA SME, MISA AMIS, Fast, Excel thuần?) Phiên bản nào?

**Câu 3 — Loại hình khách hàng:**
Khách hàng của bạn chủ yếu là loại hình gì? (Công ty TNHH, hộ kinh doanh, startup?) Ngành nghề chính?

**Câu 4 — Giao tiếp khách hàng:**
Bạn giao tiếp với khách hàng chủ yếu qua kênh nào? (Zalo, email, điện thoại?) Trung bình mỗi ngày mất bao lâu để trả lời khách?

**Câu 5 — Khai thuế:**
Mỗi tháng bạn phải khai thuế cho bao nhiêu khách? Thường khai loại thuế nào (VAT, TNCN, TNDN)? Dùng HTKK hay MISA?

**Câu 6 — Điểm đau lớn nhất:**
Công việc nào trong tháng khiến bạn stress nhất? Cái gì chiếm nhiều thời gian nhất mà bạn cảm thấy "lãng phí"?

**Câu 7 — Báo cáo cho khách:**
Bạn có lập báo cáo tài chính hàng tháng gửi cho khách không? Định dạng gì (Excel, PDF)? Mất bao lâu cho 1 khách?

**Câu 8 — Nhập liệu:**
Hóa đơn đầu vào/đầu ra — bạn nhận từ khách qua kênh nào? (Zalo ảnh, email scan, file PDF?) Sau đó xử lý thế nào?

**Câu 9 — Công nghệ hiện tại:**
Bạn đã thử dùng tool tự động hóa nào chưa? (Google Sheets công thức phức tạp, Zalo OA, bất kỳ app nào?) Kết quả thế nào?

**Câu 10 — Mục tiêu:**
Nếu bạn có thể tự động hóa 1 thứ trong công việc ngay ngày mai, bạn muốn tự động hóa cái gì?

---

### Scoring Guide (dùng nội bộ RRE)
| Điểm | Tiêu chí |
|------|----------|
| +2 | Dùng MISA SME/AMIS |
| +2 | 20+ khách hàng |
| +1 | Khai báo VAT hàng tháng |
| +2 | Đang gửi báo cáo thủ công |
| +1 | Nhận hóa đơn qua Zalo/email |
| +2 | Stress về nhập liệu hoặc báo cáo |
| **7+** | **→ Ideal pilot candidate** |

---

## B. On-Site Audit Checklist (Ngày 1-2)

> *In ra, mang theo khi đến văn phòng. Điền bằng tay hoặc note app.*

---

### 📋 CHECKLIST KIỂM TRA TẠI VĂN PHÒNG

**Văn phòng:** ______________________  
**Ngày kiểm tra:** ______________________  
**Người phỏng vấn:** ______________________  

---

#### BLOCK 1 — Quan Sát Môi Trường Làm Việc (30 phút)

- [ ] Đếm số màn hình, máy tính tại văn phòng
- [ ] Quan sát: có bao nhiêu tab Excel đang mở?
- [ ] Kiểm tra: file Excel được đặt tên thế nào? Có version control không? (VD: `BCTC_thang1_v3_final_FINAL2.xlsx`)
- [ ] Hỏi: Lần cuối mất dữ liệu hoặc nhầm số liệu là khi nào?
- [ ] Quan sát: hóa đơn giấy có được scan/lưu digital không? Lưu ở đâu?
- [ ] Kiểm tra: có folder Google Drive/Dropbox chung không? Hay từng máy tự lưu?
- [ ] Ghi lại tên cụ thể các file Excel đang dùng thường xuyên nhất

**Ghi chú quan sát:** ___________________________________________________

---

#### BLOCK 2 — Shadow Session MISA (60 phút)

*Ngồi bên cạnh kế toán viên khi họ làm việc thật. Quan sát, không hướng dẫn.*

- [ ] Xem quy trình nhập hóa đơn từ đầu đến cuối: bao nhiêu click? Bao nhiêu phút/hóa đơn?
- [ ] Ghi lại: kế toán viên copy-paste dữ liệu từ đâu vào đâu?
- [ ] Đếm: có bao nhiêu bước thủ công lặp đi lặp lại?
- [ ] Hỏi: "Cái này bạn làm mỗi ngày/tuần/tháng không?" — ghi tần suất
- [ ] Quan sát quy trình export MISA: export được file gì? (Excel? CSV? PDF?)
- [ ] Chụp ảnh (với sự đồng ý) màn hình MISA export để biết cột nào/format nào
- [ ] Hỏi: sau khi export MISA, bạn làm gì tiếp với file đó?
- [ ] Ghi lại tên các cột trong file MISA export (sẽ cần cho automation)

**Tên cột MISA export:** ________________________________________________  
**Thời gian/hóa đơn:** _______ phút  
**Bước copy-paste thủ công:** _______  

---

#### BLOCK 3 — Đo Lường Thời Gian Thực (Interview + Estimate)

*Hỏi kế toán viên chính — ghi số liệu vào bảng này:*

| Loại công việc | Tần suất | Thời gian/lần | Số lần/tháng | Tổng giờ/tháng |
|----------------|----------|----------------|---------------|-----------------|
| Nhập liệu hóa đơn | Hàng ngày | ___ phút | ___ lần | ___ giờ |
| Khai thuế VAT | Hàng tháng | ___ giờ | 1 lần | ___ giờ |
| Khai thuế TNDN | Quý/năm | ___ giờ | ___ lần | ___ giờ |
| Đối chiếu số liệu | Hàng tháng | ___ giờ | ___ lần | ___ giờ |
| Lập BCTC | Hàng tháng | ___ giờ/KH | ___ KH | ___ giờ |
| Trả lời câu hỏi KH | Hàng ngày | ___ phút | ___ lần | ___ giờ |
| Gửi email/Zalo BC | Hàng tháng | ___ phút/KH | ___ KH | ___ giờ |
| Khác | | | | |
| **TỔNG** | | | | **___ giờ** |

---

#### BLOCK 4 — Quy Trình Khai Thuế

- [ ] Hỏi: quy trình khai VAT từ lúc lấy số liệu đến lúc nộp mất bao nhiêu bước?
- [ ] Ghi lại các bước cụ thể: ________________________________________
- [ ] Hỏi: có bao giờ nhầm số liệu giữa MISA và HTKK không?
- [ ] Hỏi: mùa khai thuế TNDN (tháng 3-4) thường thế nào? Overtime bao nhiêu giờ?

---

#### BLOCK 5 — Giao Tiếp Với Khách Hàng

- [ ] Hỏi: khách hỏi gì nhiều nhất? (tình trạng hoàn thuế, số dư, deadline?)
- [ ] Đếm: trung bình mỗi ngày nhận bao nhiêu tin Zalo từ khách?
- [ ] Hỏi: có khách nào "khó" — hay gửi hóa đơn muộn, hay hỏi lặp?
- [ ] Quan sát: nhóm Zalo với khách được quản lý thế nào?

---

#### BLOCK 6 — Pain Point Ranking

*Cuối buổi, cho kế toán viên xếp hạng các vấn đề (1 = khó chịu nhất):*

- [ ] ___ Nhập liệu thủ công nhiều
- [ ] ___ Khách hỏi lặp đi lặp lại
- [ ] ___ Deadline thuế căng thẳng
- [ ] ___ Báo cáo mất nhiều thời gian
- [ ] ___ Dữ liệu bị lỗi/không khớp
- [ ] ___ Khác: _______________

---

## C. Time Tracking Sheet Template

> *Gửi file Google Sheets (hoặc in ra) — kế toán điền 5 ngày làm việc*

---

### 📊 BẢNG THEO DÕI THỜI GIAN — 5 NGÀY

**Tên:** ______________________  
**Tuần:** ______________________  
**Hướng dẫn:** Ghi số phút thực tế cho từng loại công việc mỗi ngày. Nếu không làm loại đó, để trống.

---

| Loại công việc | Thứ 2 | Thứ 3 | Thứ 4 | Thứ 5 | Thứ 6 | **Tổng tuần** |
|----------------|-------|-------|-------|-------|-------|----------------|
| Nhập liệu hóa đơn | | | | | | |
| Khai thuế VAT | | | | | | |
| Khai thuế TNDN | | | | | | |
| Đối chiếu số liệu | | | | | | |
| Lập BCTC | | | | | | |
| Trả lời câu hỏi khách | | | | | | |
| Gửi email/Zalo báo cáo | | | | | | |
| Khác (ghi rõ): | | | | | | |
| **TỔNG ngày (phút)** | | | | | | |
| **TỔNG ngày (giờ)** | | | | | | |

---

**Ghi chú cuối ngày (tùy chọn):**  
*Hôm nay có gì đặc biệt làm mất thêm thời gian không? Ghi vào đây:*

Thứ 2: _______________  
Thứ 3: _______________  
Thứ 4: _______________  
Thứ 5: _______________  
Thứ 6: _______________  

---

> **Lưu ý cho RRE:** Nhân tổng tuần × 4.33 để ra ước tính tháng. Dùng số này cho Audit Report.

---

## D. Audit Report Template

> *Tạo file PDF này sau khi có đủ dữ liệu. Gửi qua Zalo hoặc trình bày trực tiếp.*

---

# BÁO CÁO KIỂM TRA QUY TRÌNH
## Chương Trình Tối Ưu Hóa Kế Toán

**Prepared for:** [Tên văn phòng]  
**Date:** [Ngày]  
**Prepared by:** [Tên RRE]  

---

### 1. TỔNG QUAN HIỆN TẠI

Dựa trên buổi kiểm tra ngày [ngày] và dữ liệu theo dõi thời gian 5 ngày, đây là bức tranh hiện tại của văn phòng bạn:

**Quy mô:**
- Số kế toán viên: ___ người
- Số khách hàng: ___ doanh nghiệp
- Phần mềm: MISA [version]

**Giờ làm việc thực tế/tháng:**

| Loại công việc | Giờ/tháng | % Tổng thời gian |
|----------------|-----------|-----------------|
| Nhập liệu hóa đơn | ___ | ___% |
| Khai thuế (VAT + TNDN) | ___ | ___% |
| Đối chiếu số liệu | ___ | ___% |
| Lập BCTC | ___ | ___% |
| Giao tiếp khách hàng | ___ | ___% |
| Khác | ___ | ___% |
| **TỔNG** | **___** | **100%** |

**Điểm đau chính được xác định:**
1. ___________________________________________________
2. ___________________________________________________
3. ___________________________________________________

---

### 2. PHÂN TÍCH CƠ HỘI TỰ ĐỘNG HÓA

Dựa trên dữ liệu trên, đây là các công việc **có thể tự động hóa ngay**:

| Công việc | Có thể tự động | Giờ tiết kiệm/tháng | Mức độ ưu tiên |
|-----------|---------------|---------------------|-----------------|
| Phân loại giao dịch MISA | ✅ 80% | ___ giờ | 🔴 Cao |
| Tạo báo cáo P&L | ✅ 90% | ___ giờ | 🔴 Cao |
| Gửi báo cáo hàng tháng | ✅ 95% | ___ giờ | 🟡 Trung bình |
| Trả lời câu hỏi lặp lại của khách | ✅ 60% | ___ giờ | 🟡 Trung bình |
| Nhập liệu hóa đơn | ⚠️ 40% (cần OCR) | ___ giờ | 🟢 Giai đoạn 2 |

---

### 3. TÍNH TOÁN ROI

#### Giả định:
- Giờ có thể tự động hóa/tháng: **___ giờ**
- Chi phí cơ hội (giá trị 1 giờ làm việc): **___ VNĐ/giờ**
  *(Tính theo: phí dịch vụ tháng ÷ số giờ làm việc = ___VNĐ/giờ)*

#### Tính toán:

```
Giờ tiết kiệm/tháng:          ___ giờ
× Giá trị 1 giờ làm việc:     ___ VNĐ
= Giá trị tiết kiệm/tháng:    ___ VNĐ

Chi phí automation/tháng:     ___ VNĐ (Make.com + AI)
Chi phí retainer RRE/tháng:   ___ VNĐ

TỔNG CHI PHÍ/THÁNG:           ___ VNĐ
GIÁ TRỊ TIẾT KIỆM/THÁNG:     ___ VNĐ
ROI THUẦN/THÁNG:              +___ VNĐ
```

**Thời gian hoàn vốn: ___ tháng**

---

### 4. GÓI TỰ ĐỘNG HÓA ĐỀ XUẤT

#### 🚀 Gói Khởi Động — ___ VNĐ/tháng

**Bao gồm:**
- ✅ Tự động phân loại giao dịch MISA → P&L
- ✅ Tự động tạo báo cáo P&L hàng tháng (Google Sheets → PDF)
- ✅ Tự động gửi báo cáo qua Zalo/email cho chủ doanh nghiệp
- ✅ Dashboard tổng quan cho tất cả khách hàng
- ✅ Hỗ trợ setup + training (2 buổi)
- ✅ Hỗ trợ kỹ thuật 30 ngày đầu

**Thời gian setup:** 1-2 tuần

**ROI dự kiến:** Tiết kiệm ___ giờ/tháng = ___ VNĐ/tháng → hoàn vốn trong ___ tháng

---

#### 🔥 Gói Nâng Cao — ___ VNĐ/tháng

*Bao gồm tất cả Gói Khởi Động, cộng thêm:*
- ✅ Chatbot Zalo trả lời câu hỏi tự động
- ✅ Nhắc nhở deadline thuế tự động
- ✅ Báo cáo so sánh tháng-tháng
- ✅ Hỗ trợ ưu tiên

---

### 5. BƯỚC TIẾP THEO

1. **Xác nhận hợp tác:** Ký thỏa thuận pilot trong vòng 3 ngày
2. **Kick-off session:** Setup Make.com + Google Sheets trong 2 giờ
3. **Pilot 30 ngày:** Chạy thử với 3-5 khách hàng của bạn
4. **Đánh giá kết quả:** Đo giờ tiết kiệm thực tế sau 30 ngày

**Liên hệ để bắt đầu:** [Zalo/Email/SĐT của RRE]

---

*Báo cáo này được tạo dựa trên dữ liệu thực tế từ văn phòng của bạn. Số liệu ROI là ước tính dựa trên thực hành tốt nhất và sẽ được xác nhận sau 30 ngày pilot.*

---
---

# DELIVERABLE 2 — Tool Stack Prototype Spec: Transaction Categorization → P&L Auto-Generation

## Tổng Quan Kiến Trúc

```
MISA Export (CSV/Excel)
    ↓
Google Drive (trigger folder)
    ↓
Make.com (orchestration)
    ↓
Gemini API (AI categorization)
    ↓
Google Sheets (P&L template)
    ↓
PDF Generation
    ↓
Zalo/Email (delivery)
```

**Stack:**
- Make.com (Core Pro plan)
- Gemini 1.5 Flash API (Google AI Studio)
- Google Drive + Google Sheets
- Zalo OA API (hoặc email fallback)

---

## Step-by-Step Technical Specification

---

### STEP 0 — Chuẩn Bị Môi Trường (Setup Once)

**Việc cần làm trước:**

1. Tạo Google Drive folder structure:
   ```
   /RRE-Automation/
   ├── /incoming-csv/          ← kế toán upload vào đây
   ├── /processed/             ← Make.com move file sau khi xử lý
   └── /pl-reports/            ← output PDF
   ```

2. Tạo Google Sheets P&L template với 2 sheets:
   - `Sheet1: Raw Data` (cột: Ngày, Mã GD, Mô tả, Số tiền, Loại, Danh mục AI)
   - `Sheet2: P&L Summary` (công thức SUMIF tự động từ Sheet1)

3. Lấy Gemini API key từ https://aistudio.google.com

4. **Thời gian setup bước 0:** 45 phút

---

### STEP 1 — Trigger: Watch Google Drive Folder

**Make.com Module:** `Google Drive > Watch Files in a Folder`

**Cấu hình:**
```
Connection: [Google Account của kế toán]
Folder: /RRE-Automation/incoming-csv/
File Type: All files
Watch: New Files Only
Schedule: Every 15 minutes (hoặc Instant với webhook)
```

**Potential Failure Points:**
- ❌ Kế toán upload sai folder → Mitigation: Đặt shortcut Zalo nhắc nhở + tạo folder bookmark
- ❌ File không phải CSV (upload Excel .xlsx) → Mitigation: Thêm filter kiểm tra extension, nếu .xlsx thì Convert module
- ❌ Google Drive rate limit → Mitigation: Tăng interval lên 30 phút

**Estimated Setup Time:** 15 phút

---

### STEP 2 — Parse CSV Data

**Make.com Module:** `Google Drive > Download a File` → `CSV > Parse CSV`

**Cấu hình CSV Parser:**
```
CSV Data: [file content từ Step 1]
Column Separator: Comma (hoặc Semicolon — kiểm tra file MISA thực tế)
Has Header Row: Yes
```

**MISA Export Format (standard columns):**
```
Ngày hạch toán | Ngày chứng từ | Số chứng từ | Diễn giải | 
Tài khoản Nợ | Tài khoản Có | Số tiền | Mã khách hàng | 
Mã hàng hóa | Mã bộ phận
```

> ⚠️ **Quan trọng:** Xác nhận tên cột thực tế trong buổi audit — có thể khác nhau giữa phiên bản MISA.

**Potential Failure Points:**
- ❌ Encoding lỗi (tiếng Việt có dấu) → Mitigation: Force UTF-8 trong CSV parser, kiểm tra BOM
- ❌ Format số tiền có dấu phẩy phân cách nghìn → Mitigation: Text transformation module để clean số
- ❌ Ngày tháng format khác nhau → Mitigation: Date parse với multiple formats

**Estimated Setup Time:** 20 phút

---

### STEP 3 — Gemini API Categorization

**Make.com Module:** `HTTP > Make a Request`

**API Endpoint:**
```
URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={{GEMINI_API_KEY}}
Method: POST
Content-Type: application/json
```

**Request Body:**
```json
{
  "contents": [{
    "parts": [{
      "text": "{{PROMPT}}"
    }]
  }]
}
```

---

#### 🤖 GEMINI PROMPT (Vietnamese Accounting Categorization)

```
Bạn là chuyên gia kế toán Việt Nam với 10 năm kinh nghiệm. Nhiệm vụ của bạn là phân loại các giao dịch kế toán vào đúng danh mục cho báo cáo P&L.

DANH MỤC P&L:
1. Doanh thu bán hàng (511)
2. Doanh thu dịch vụ (511)
3. Doanh thu tài chính (515) - lãi ngân hàng, chiết khấu thu được
4. Thu nhập khác (711)
5. Chi phí giá vốn hàng bán (632)
6. Chi phí bán hàng (641) - lương nhân viên bán hàng, marketing, vận chuyển
7. Chi phí quản lý doanh nghiệp (642) - lương văn phòng, thuê mặt bằng, điện nước, văn phòng phẩm
8. Chi phí tài chính (635) - lãi vay, phí ngân hàng
9. Chi phí khác (811)
10. Tài sản/Đầu tư (không thuộc P&L)
11. Không xác định (cần kiểm tra thủ công)

DỮ LIỆU GIAO DỊCH (JSON):
{{TRANSACTIONS_JSON}}

YÊU CẦU OUTPUT:
Trả về JSON array với cấu trúc sau cho MỖI giao dịch:
[
  {
    "so_chung_tu": "...",
    "ngay": "...",
    "dien_giai": "...",
    "so_tien": ...,
    "danh_muc": "Chi phí quản lý doanh nghiệp",
    "ma_tk": "642",
    "do_tin_cay": "cao/trung_binh/thap",
    "ly_do": "Diễn giải cho thấy đây là chi phí thuê văn phòng"
  }
]

QUY TẮC:
- Nếu không chắc chắn, đặt do_tin_cay = "thap" và danh_muc = "Không xác định"
- Dựa vào Tài khoản Nợ/Có trong MISA để hỗ trợ phân loại
- Ưu tiên mã tài khoản MISA (5xx = doanh thu, 6xx = chi phí)
- CHỈ trả về JSON, không có text giải thích thêm
```

---

**Batching Strategy** (để tránh prompt quá dài):
- Chia transactions thành batch 50 dòng/lần
- Make.com: dùng `Iterator` module để loop qua từng batch
- Tổng hợp kết quả bằng `Array Aggregator`

**Potential Failure Points:**
- ❌ Gemini timeout với file lớn → Mitigation: Batch 50 rows, retry 3 lần
- ❌ JSON parse error từ Gemini output → Mitigation: Add Text Parser module để extract JSON từ response
- ❌ API quota exceeded → Mitigation: Gemini Flash tier free 60 req/min là đủ cho SME
- ❌ Phân loại sai → Mitigation: Cột `do_tin_cay = "thap"` highlight màu đỏ để kế toán review

**Estimated Setup Time:** 45 phút (viết + test prompt)

---

### STEP 4 — Write to Google Sheets

**Make.com Module:** `Google Sheets > Add Multiple Rows`

**Cấu hình:**
```
Spreadsheet: [P&L Template file ID]
Sheet: Raw Data
Column Mapping:
  A: ngay
  B: so_chung_tu
  C: dien_giai
  D: so_tien
  E: danh_muc
  F: ma_tk
  G: do_tin_cay
  H: ly_do (ẩn, để kế toán có thể xem khi cần)
```

**Conditional Formatting (setup một lần trong Google Sheets):**
- `do_tin_cay = "thap"` → Highlight đỏ → kế toán phải review thủ công
- `do_tin_cay = "cao"` → Màu xanh
- `danh_muc = "Không xác định"` → Bold + đỏ

**Potential Failure Points:**
- ❌ Google Sheets row limit (1M rows) → Mitigation: Archive sheet mỗi quý
- ❌ Duplicate rows nếu Make.com chạy lại → Mitigation: Check duplicate bằng `so_chung_tu` trước khi insert

**Estimated Setup Time:** 30 phút

---

### STEP 5 — Google Sheets P&L Auto-Calculation

**Setup Google Sheets formulas (không cần Make.com):**

**Sheet2: P&L Summary — Cấu trúc:**

```
BÁO CÁO KẾT QUẢ KINH DOANH
Kỳ báo cáo: [tháng] [năm]
Đơn vị: VNĐ

DOANH THU
  Doanh thu bán hàng         =SUMIF('Raw Data'!E:E,"Doanh thu bán hàng",'Raw Data'!D:D)
  Doanh thu dịch vụ          =SUMIF('Raw Data'!E:E,"Doanh thu dịch vụ",'Raw Data'!D:D)
  Doanh thu tài chính        =SUMIF('Raw Data'!E:E,"Doanh thu tài chính",'Raw Data'!D:D)
TỔNG DOANH THU               =SUM(B5:B7)

CHI PHÍ
  Giá vốn hàng bán           =SUMIF(...)
  Chi phí bán hàng           =SUMIF(...)
  Chi phí quản lý DN         =SUMIF(...)
  Chi phí tài chính          =SUMIF(...)
TỔNG CHI PHÍ                 =SUM(B11:B14)

LỢI NHUẬN TRƯỚC THUẾ        =B9-B16
Thuế TNDN (20%)              =IF(B17>0,B17*0.2,0)
LỢI NHUẬN SAU THUẾ          =B17-B18
```

**Potential Failure Points:**
- ❌ Tên danh mục không khớp chính xác → Mitigation: Dùng danh sách cố định, validate trước khi write

**Estimated Setup Time:** 60 phút (tạo template hoàn chỉnh)

---

### STEP 6 — PDF Generation + Delivery

**Make.com Modules:**
1. `Google Slides/Sheets > Export to PDF` (hoặc Google Drive export URL)
2. `Gmail > Send an Email` / `HTTP > Zalo API`

**PDF Export cách đơn giản nhất:**
```
Make.com Module: HTTP > Make a Request
URL: https://docs.google.com/spreadsheets/d/{{SHEET_ID}}/export?format=pdf&gid={{SHEET2_GID}}&...
Method: GET
Headers: Authorization: Bearer {{GOOGLE_ACCESS_TOKEN}}
```

**Zalo OA Delivery (nếu có Zalo OA):**
```
Make.com Module: HTTP > Make a Request
URL: https://openapi.zalo.me/v2.0/oa/message
Method: POST
Body: {
  "recipient": {"user_id": "{{ZALO_USER_ID}}"},
  "message": {
    "text": "Báo cáo P&L tháng {{MONTH}} của {{COMPANY_NAME}} đã sẵn sàng",
    "attachment": {
      "type": "file",
      "payload": {"url": "{{PDF_URL}}"}
    }
  }
}
```

**Fallback — Email delivery:**
```
Make.com Module: Gmail > Send an Email
To: {{CLIENT_EMAIL}}
Subject: [{{COMPANY_NAME}}] Báo cáo P&L tháng {{MONTH}}/{{YEAR}}
Body: "Kính gửi [Tên chủ doanh nghiệp], ..."
Attachment: {{PDF_FILE}}
```

**Potential Failure Points:**
- ❌ Zalo OA cần approval (mất 1-2 tuần) → Mitigation: Dùng email làm default, Zalo là optional
- ❌ PDF layout vỡ → Mitigation: Test với 3-4 format trước khi ra production
- ❌ File đính kèm quá lớn (Zalo limit 10MB) → Mitigation: Tối ưu Google Sheets template, hoặc share link Drive thay vì attach

**Estimated Setup Time:** 30 phút

---

## Chi Phí Hàng Tháng

| Item | Plan/Tier | Giá/tháng (USD) | Giá/tháng (VNĐ ≈) |
|------|-----------|-----------------|---------------------|
| Make.com | Core (10,000 ops) | $10.59 | 270,000 |
| Gemini API | Flash 1.5 (Pay-as-you-go) | ~$2-5 | 50,000 - 130,000 |
| Google Workspace | Business Starter | $6 | 150,000 |
| **Tổng** | | **~$18-21** | **~470,000 - 550,000 VNĐ** |

> **Ghi chú:** Gemini 1.5 Flash = $0.075/1M input tokens. Với 500 transactions/tháng (~100K tokens) = ~$0.0075/client/tháng. Gần như miễn phí cho giai đoạn pilot.

**Với Make.com Core 10,000 ops:**
- 1 client/tháng = ~50-100 operations (1 file CSV = 1 trigger + N batches + 1 write + 1 send)
- Core plan đủ cho 30-50 clients/tháng

---

## Timeline

### Setup lần đầu (Client 1): **12-16 giờ**
```
Day 1 (4h): Google Drive + Sheets template + Make.com account
Day 2 (4h): Build Make.com scenario + test Gemini prompt
Day 3 (2h): Test với dữ liệu MISA thực tế, fix lỗi encoding/format
Day 4 (2h): Setup PDF + delivery + end-to-end test
Day 5 (2h): Training kế toán (1 buổi 1 giờ + buffer)
```

### Nhân rộng (Client 2 trở đi): **2-3 giờ**
```
30 phút: Clone Make.com scenario + update folder/sheet IDs
60 phút: Test với file MISA của client mới (confirm column names)
30 phút: Setup Google Drive folder + Share với kế toán
30 phút: Training + handover
```

---

## Demo Script — 15 Phút Với Pilot Client

```
[Phút 0-2] — Hook
"Bạn mất bao nhiêu giờ làm báo cáo P&L mỗi tháng? 
Tôi sẽ cho bạn xem cách làm việc đó trong 30 giây."

[Phút 2-5] — Live Demo (đã chuẩn bị sẵn dữ liệu giả)
- Upload file CSV vào Google Drive
- Màn hình Make.com chạy real-time
- Hiện kết quả trong Google Sheets (màu xanh = tự động, đỏ = cần review)

[Phút 5-8] — Show Output
- Mở Sheet P&L Summary: đây là báo cáo tự động
- Mở email/Zalo: đây là báo cáo PDF đã gửi cho chủ doanh nghiệp

[Phút 8-11] — ROI Calculation (dùng số liệu của họ)
"Bạn có X giờ/tháng làm việc này. × Y VNĐ/giờ = Z VNĐ/tháng.
Chi phí hệ thống: 500,000 VNĐ/tháng.
Bạn tiết kiệm ròng: Z - 500K = [số tiền] VNĐ/tháng."

[Phút 11-13] — Xử lý objections
"Còn những giao dịch AI phân loại sai thì sao?"
→ "Hệ thống tự highlight đỏ — bạn chỉ cần check những cái đỏ. 
   Thường dưới 10%. Thay vì check 100%, bạn chỉ check 10%."

[Phút 13-15] — Close
"Tôi đang tìm 3 văn phòng để pilot miễn phí trong 30 ngày.
Bạn chỉ cần cung cấp 1 file MISA export — tôi setup hết.
Nếu sau 30 ngày không tiết kiệm được ít nhất 10 giờ, 
bạn không cần trả thêm gì cả. Bắt đầu tuần sau được không?"
```

---
---

# DELIVERABLE 3 — Pilot Client Outreach Pack

## 1. Tiêu Chí Chọn Pilot Client Lý Tưởng

**Bắt buộc (Must Have):**
- [ ] Văn phòng kế toán dịch vụ (không phải kế toán nội bộ doanh nghiệp)
- [ ] 15-50 khách hàng doanh nghiệp đang phục vụ
- [ ] Đang dùng MISA SME hoặc MISA AMIS
- [ ] Có ít nhất 1 kế toán viên biết dùng Google Sheets cơ bản
- [ ] Đang làm báo cáo tài chính gửi khách hàng (dù thủ công)

**Tốt hơn nếu có (Nice to Have):**
- [ ] Đã từng phàn nàn về việc "mất quá nhiều thời gian" trên mạng xã hội
- [ ] Có smartphone và dùng Zalo hàng ngày
- [ ] Tuổi 28-45 (open-minded với technology nhưng đủ kinh nghiệm hiểu giá trị)
- [ ] Có mối quan hệ tốt với khách hàng (sẵn sàng share case study)
- [ ] Nằm ở TP.HCM hoặc Hà Nội (dễ gặp trực tiếp)

**Tránh:**
- ✗ Văn phòng quá lớn (10+ người) — quá nhiều quy trình phức tạp
- ✗ Kế toán viên >55 tuổi và không quen công nghệ
- ✗ Đang dùng Fast Accounting, BRAVO (integration khác)
- ✗ Ngành đặc thù như ngân hàng, bảo hiểm (quy định phức tạp)
- ✗ Người hay "xem mà không làm" — cần ai action-taker

---

## 2. Pilot Offer Letter (Thư Đề Nghị Hợp Tác Pilot)

---

**THỎA THUẬN HỢP TÁC PILOT — CHƯƠNG TRÌNH TỰ ĐỘNG HÓA KẾ TOÁN**

*Ngày: ___/___/2026*

**Gửi:** [Tên kế toán/Tên văn phòng]  
**Từ:** [Tên RRE / Người đại diện]

---

Kính chào [Tên],

Tôi đang triển khai chương trình **Tự Động Hóa Kế Toán cho Văn Phòng Dịch Vụ** — ứng dụng AI để tự động phân loại giao dịch MISA và tạo báo cáo tài chính, giúp tiết kiệm 10-20 giờ làm việc mỗi tháng.

Tôi đang tìm **3 văn phòng kế toán** để tham gia **chương trình pilot 30 ngày hoàn toàn miễn phí**.

---

### 🎯 BẠN NHẬN ĐƯỢC GÌ (Miễn Phí, Không Điều Kiện Ẩn)

✅ **Setup hoàn toàn** — tôi tự cài đặt hệ thống, không cần bạn làm gì kỹ thuật  
✅ **Hệ thống tự động P&L** — upload file MISA → báo cáo tự động trong 5 phút  
✅ **30 ngày sử dụng** — không mất phí dùng thử  
✅ **Training 1-on-1** — hướng dẫn sử dụng cho bạn và nhân viên  
✅ **Hỗ trợ kỹ thuật** 30 ngày đầu qua Zalo  

**Giá trị ước tính:** 2,000,000 - 5,000,000 VNĐ (nếu setup thương mại)

---

### 🤝 TÔI CẦN GÌ TỪ BẠN

Để đổi lại, tôi chỉ cần:

1. **Dữ liệu thực tế** — 1 file MISA export (ẩn thông tin nhạy cảm nếu muốn)
2. **Feedback thành thật** — báo cáo sử dụng thực tế sau 30 ngày
3. **Một buổi phỏng vấn** (30 phút) — chia sẻ kinh nghiệm pilot qua Zalo call
4. **Cho phép sử dụng kết quả** — dưới dạng case study (ẩn tên hoặc hiện tên — tùy bạn)

---

### 📋 CAM KẾT CỦA TÔI

- Dữ liệu của bạn **TUYỆT ĐỐI BÍ MẬT** — không chia sẻ với bên thứ ba
- Nếu hệ thống không hoạt động như mô tả — tôi refund toàn bộ (mặc dù pilot là miễn phí)
- Sau 30 ngày, bạn **tự do quyết định** tiếp tục hay dừng — không bị ràng buộc

---

### ⏰ THỜI GIAN

- Pilot bắt đầu: Trong vòng **7 ngày** kể từ khi xác nhận
- Thời gian cần của bạn: **2 giờ** (1 buổi setup + 30 phút training)
- Duration: **30 ngày**

---

**Để tham gia, nhắn tin "PILOT" vào Zalo: [SĐT] hoặc email: [email]**

*Chỉ còn [X] slot trong số 3 slot pilot. Ưu tiên ai phản hồi trước.*

---

Trân trọng,  
[Tên]  
[RRE / Tên dự án]  
Zalo: [SĐT] | Email: [email]

*Thỏa thuận này là thư ý định — không có giá trị pháp lý ràng buộc. Dữ liệu được bảo vệ theo cam kết bảo mật thông tin.*

---

## 3. Kênh Tìm Pilot Client — 5 Kênh Cụ Thể

### Kênh 1 — Facebook Group: "Cộng đồng Kế Toán Việt Nam"
- **Link:** facebook.com/groups/ketoanchuyennghiep (900K+ thành viên)
- **Cách tiếp cận:** Đăng bài chia sẻ insight thực tế ("Tôi vừa audit 1 văn phòng kế toán và phát hiện điều này..."), sau đó mention pilot program. KHÔNG spam direct message.
- **Thời điểm tốt nhất:** Đăng vào thứ 2-3 sáng, giờ 8-9h (trước giờ làm việc)
- **Tần suất:** 2-3 bài/tuần trong 2 tuần đầu

### Kênh 2 — Facebook Group: "Hội Kế Toán Thực Hành"
- **Link:** Tìm kiếm "hội kế toán thực hành" trên Facebook (nhiều nhóm, target nhóm 50K+ thành viên)
- **Cách tiếp cận:** Đặt câu hỏi gây tò mò: "Văn phòng kế toán bạn dùng bao nhiêu giờ/tháng cho báo cáo P&L? Mình đang làm research." → Build engagement → Pitch pilot trong comment
- **Target:** Người comment nhiều và chia sẻ pain points cụ thể

### Kênh 3 — Hội Kế Toán Kiểm Toán Việt Nam (VACPA)
- **Website:** vacpa.org.vn
- **Cách tiếp cận:** 
  1. Tham gia sự kiện/hội thảo của VACPA (thường có ở TP.HCM + Hà Nội)
  2. Networking trực tiếp — pitch ngắn 2 phút
  3. Xin liên hệ của chi hội địa phương để giới thiệu program
- **Lợi thế:** Credibility cao, gặp decision-maker trực tiếp

### Kênh 4 — LinkedIn Vietnam Accounting Community
- **Search:** "kế toán dịch vụ" hoặc "accounting services Vietnam" trên LinkedIn
- **Cách tiếp cận:**
  1. Send connection request với personalized note: "Tôi đang làm research về tự động hóa kế toán SME — bạn có 10 phút để chia sẻ workflow không?"
  2. Build mối quan hệ trước, pitch sau
  3. Đăng bài chia sẻ học thuật về MISA + automation để tạo authority
- **Target:** Profile có title "Giám đốc văn phòng kế toán", "Kế toán trưởng dịch vụ"

### Kênh 5 — Warm Network + Referral (Highest Conversion)
- **Cách tiếp cận:** Nhắn tin cho TẤT CẢ người quen hỏi: "Bạn có quen ai đang làm dịch vụ kế toán không? Mình đang tìm người để giới thiệu chương trình miễn phí."
- **Template nhắn tin:** "Hey [tên], mình đang build tool tự động hóa cho kế toán, đang tìm người để pilot miễn phí. Bạn có quen ai làm kế toán dịch vụ không? Mình sẽ setup free cho họ, chỉ cần feedback thôi."
- **Lý do effective:** Trust từ người quen → conversion rate cao nhất
- **Mục tiêu:** Tiếp cận 50 người quen trong 1 tuần

---

## 4. First Message — Zalo Message Cho Warm Lead

---

### Version A — Lead từ Facebook Group (đã thấy bài đăng)

```
Chào [Tên] 👋

Mình thấy bạn comment trong nhóm kế toán về việc mất nhiều thời gian làm báo cáo — mình đang build tool tự động hóa đúng cái đó.

Hiện mình đang tìm 3 văn phòng kế toán để pilot hoàn toàn miễn phí trong 30 ngày.

Cụ thể là: upload file MISA export → hệ thống tự phân loại giao dịch + tạo báo cáo P&L trong 5 phút thay vì vài tiếng.

Mình setup hết, bạn không cần làm gì kỹ thuật. Đổi lại mình chỉ cần feedback thật của bạn sau 30 ngày.

Bạn có muốn xem demo 15 phút trước không? Mình sẽ show live với dữ liệu giả cho bạn thấy nó chạy thế nào.
```

---

### Version B — Lead từ referral (chưa biết gì)

```
Chào [Tên], mình là [Tên] — bạn của [Người giới thiệu].

[Người giới thiệu] nói bạn đang chạy văn phòng kế toán dịch vụ — mình đang làm research về quy trình làm việc của các văn phòng kế toán và đang tìm 3 người để tham gia chương trình pilot miễn phí.

Mình đang xây tool tự động hóa báo cáo tài chính cho kế toán SME — upload file MISA là ra P&L tự động. Đang test thực tế với văn phòng thật trước khi launch.

Bạn có đang dùng MISA không? Nếu có thì rất phù hợp để thử.

Cho mình hỏi: mỗi tháng bạn mất khoảng bao nhiêu giờ để làm báo cáo cho khách?
```

---

### Version C — Follow-up sau 3 ngày im lặng

```
[Tên] ơi, follow-up nhỏ thôi 😄

Mình vẫn còn 1 slot pilot cuối cho tháng này. Demo chỉ 15 phút — mình show bạn xem hệ thống chạy live.

Nếu không phù hợp thì không sao — nhưng nếu tiết kiệm được 10+ giờ/tháng thì đáng xem đúng không?

Bạn rảnh cuối tuần này không?
```

---

**Nguyên tắc khi nhắn Zalo:**
- Tin nhắn đầu KHÔNG bao giờ paste link ngay
- Hỏi câu hỏi để qualify và tạo engagement
- Không pitch quá 3 lần nếu không có phản hồi
- Giọng văn tự nhiên, không formal quá

---

## Summary Checklist — Trước Khi Gặp Pilot Client Đầu Tiên

- [ ] Pre-audit questionnaire đã gửi và nhận đủ câu trả lời
- [ ] Scoring ≥ 7/12 điểm (qualified)
- [ ] Google Drive folder structure đã tạo
- [ ] Make.com account đã setup (Core plan)
- [ ] Gemini API key đã lấy + test
- [ ] P&L Google Sheets template đã hoàn chỉnh
- [ ] Demo scenario với dữ liệu giả đã test end-to-end
- [ ] Audit Report template đã điền số thực tế
- [ ] Pilot Offer Letter đã chuẩn bị
- [ ] Zalo OA hoặc email delivery đã test

---

*Tài liệu này là Sprint 3 working document của Project RRE. Cập nhật sau mỗi pilot iteration.*
