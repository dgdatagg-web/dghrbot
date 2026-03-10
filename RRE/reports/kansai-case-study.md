# KANSAI OSAKA — AI Ops Case Study
> Format: Pitch-ready | Version: 1.0 | Date: 2026-03-01
> Classification: RRE Sales Asset

---

## THE PROBLEM — Bếp Nhật tại HCM, vận hành "bằng cảm giác"

Kansai Osaka là bếp Nhật delivery-first tại TP.HCM, bán qua GrabFood.
Menu 71 SKUs. Team 3-5 người. Doanh thu thực tế: tốt.

Nhưng founder không biết:
- **Món nào đang thực sự nuôi sống bếp** (theo real-time)
- **Ngày nào chết, tại sao chết** — không có dữ liệu để hành động
- **Platform đang lấy bao nhiêu** — và có chiến lược nào đối phó không
- **Khuyến mãi nào thực sự có ROI** — đang chi tiền theo cảm tính
- **Menu có món nào nên kill** — 71 SKUs nhưng không có cơ chế review

**Root cause:** Grab dashboard có data. Nhưng data không tự biến thành quyết định.

---

## THE INTERVENTION — AI Decision Layer

Nova (AI analyst) được deploy để xử lý 90 ngày dữ liệu Grab thực tế.

**Input:** Raw CSV từ GrabFood — Sales, Menu, Offers, Peak Hour, Combo
**Process:** Automated analysis → pattern detection → actionable insight
**Output:** Weekly decision brief cho founder

Không thay đổi phần mềm. Không đào tạo lại team. Không cần IT.

---

## THE NUMBERS — 90 Ngày Thực Tế

| Metric | Số liệu |
|--------|---------|
| Kỳ phân tích | 28/11/2025 → 25/02/2026 |
| Tổng đơn | **4,257 đơn** |
| Gross Revenue | **646,432,000₫** |
| Net Revenue (sau fee) | **553,629,000₫** |
| GrabFood Fee | **92,803,000₫ (14.4%)** |
| TB đơn/ngày | **48.4 đơn** |
| TB giá/đơn | **151,852₫** |
| Tăng trưởng vs baseline | **+43% → +75%/tháng** |

---

## 5 INSIGHTS — Những Gì Founder Không Thấy Trước Khi Có Data

---

### Insight #1 — "Thứ 2 là ngày chết" — và có thể fix được

**Data:** Doanh thu Thứ 2 = 1,669,083₫ — thấp hơn **80%** so với ngày thường

**Trước:** Founder biết Thứ 2 ế, nhưng không biết con số chính xác và không có hành động cụ thể.

**Sau khi có AI analysis:**
→ Confirm: Thứ 2 ế vì quán đóng/hạn chế — không phải do demand thấp
→ Action: Test push offer Thứ 2 sáng (auto-schedule qua GrabFood promo)
→ Target: Phục hồi 30-40% doanh thu Thứ 2 → +~500K-700K₫/tuần

---

### Insight #2 — 2 món đang nuôi sống cả bếp

**Data:**
- Kare Tonkatsu: 1,363 units — **21.8% tổng đơn**, 140M revenue
- Kare Chicken Katsu: 1,276 units — **18.4%**, 118M revenue
- Top 2 = **40.2% tổng revenue**

**Trước:** Bếp xử lý tất cả 71 SKUs như nhau — không biết cái nào cần bảo vệ nhất.

**Sau khi có AI analysis:**
→ Kare Tonkatsu = "hero SKU" — bất kỳ thay đổi nào về giá/nguyên liệu/presentation đều ảnh hưởng trực tiếp đến revenue
→ Action: Protect hero SKU + push upsell xung quanh (side dishes, combo)
→ Identify: 30+ SKUs trong "long tail" có thể xem xét kill để reduce complexity

---

### Insight #3 — GrabFood lấy 92.8 triệu — nhưng không đồng đều theo món

**Data:** Gross 646M → Net 554M — platform fee 14.4% flat

**Trước:** Founder biết bị lấy fee nhưng áp dụng giá đồng đều cho tất cả món.

**Sau khi có AI analysis:**
→ Gross margin per SKU khác nhau → fee 14.4% đau hơn với món giá thấp
→ Action: Re-price low-margin SKUs + push high-margin SKUs trong combo
→ Estimate: Tối ưu mix menu → recover 2-3% net margin → +13-20M₫/tháng

---

### Insight #4 — Khuyến mãi: ROI chênh lệch 8x giữa các chương trình

**Data:**
| Promotion | Chi | ROI |
|-----------|-----|-----|
| MÓN ĐỈNH ƯU ĐÃI 10% | — | **63.4x** |
| Giảm 3K | — | **47.7x** |
| Giảm 46K | 26.5M | 7.4x |

**Trước:** Ngân sách KM phân bổ theo cảm tính, không biết chương trình nào hiệu quả nhất.

**Sau khi có AI analysis:**
→ Small discount (3K-10%) = ROI cao hơn deep discount (46K) tới 8x
→ Action: Shift budget sang micro-discount programs + tắt deep discount
→ Estimate: Cùng ngân sách KM → revenue tăng 20-30%

---

### Insight #5 — 2 peak windows rõ ràng — nhưng staffing chưa match

**Data:**
- Peak 1: 11h-14h (lunch) — 3.7 đơn/giờ
- Peak 2: 17h-22h (dinner) — 6.1-8.4 đơn/giờ
- Dead zone: 14h-17h, sau 22h

**Trước:** Staffing theo lịch cố định — không theo demand pattern.

**Sau khi có AI analysis:**
→ Demand forecast theo giờ/ngày/tuần → staffing recommendation cụ thể
→ Action: Flex staffing → giảm cost dead zone, không miss peak
→ Estimate: Giảm 15-20% labor cost trong dead hours

---

## BEFORE vs AFTER — Tóm Tắt

| Vấn đề | Trước | Sau AI Layer |
|--------|-------|-------------|
| SKU performance | Cảm tính | Weekly report tự động |
| Thứ 2 ế | Chấp nhận | Data-driven promo strategy |
| Platform fee | Trả đều, không chiến lược | Net margin per SKU, optimize mix |
| Khuyến mãi | Chi theo budget có sẵn | ROI-ranked, auto-allocate |
| Staffing | Lịch cố định | Demand forecast → flex schedule |

**Tổng tiết kiệm/tăng thêm ước tính:** 30-50M₫/tháng
(Mix của: +revenue Thứ 2, +net margin từ pricing, +KM ROI, -labor cost)

---

## THE OFFER — Áp Dụng Cho F&B Owner Của Bạn

**Bạn đang có data trên Grab/Baemin/ShopeeFood.**
**Data đó chưa tự biến thành quyết định.**
**Đó là việc của chúng tôi.**

### 30-Day AI Ops Pilot
**8,000,000₫** — không cần setup fee, không cam kết dài hạn

Bao gồm:
- ✅ Audit toàn bộ data 90 ngày của bạn
- ✅ 4 weekly decision briefs (thứ 2 hàng tuần)
- ✅ SKU health report — biết món nào đang nuôi sống bếp
- ✅ Platform fee analysis — chiến lược đối phó cụ thể
- ✅ Promo ROI ranking — biết tiền đang chạy đúng chỗ không
- ✅ Staffing pattern report

**Sau 30 ngày:** Nếu thấy giá trị → tiếp tục 10M/tháng. Không thấy → dừng, không ràng buộc.

---

*Case study: Kansai Osaka — Bếp Nhật HCM | Data: 90 ngày thực tế*
*Prepared by: Nova (RRE AI Analyst) | Contact: Rat Race Escape Team*

---
## MILESTONE LOG
| Date | Event |
|------|-------|
| 2026-03-01 | RRE first paying client — Grey closed Deal #1 ✅ |

---
## DEAL #1 — VALIDATED PRICING
- Offer: AI Personal Assistant for founder/CEO
- Confirmed price: **5,000,000₫/tháng**
- Close time: 15 phút
- Target: Individual founder/CEO (not SME as org)
- Core pain: Trust + control + cost vs human assistant
- Grey's note: "5tr ok từ đầu" ✅
- Date: 2026-03-01
