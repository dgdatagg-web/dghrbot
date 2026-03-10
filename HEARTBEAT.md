# HEARTBEAT.md — Nova Standing Orders

## 🔴 RULE #1 — DASHBOARD IS NOVA'S RESPONSIBILITY
Nova phụ trách update dashboard/index.html.
**Bất kỳ khi nào task thay đổi trạng thái → update dashboard NGAY, không chờ.**

### Trigger events (PHẢI update dashboard):
- Task mới được tạo → thêm vào TASKS array (status: queue)
- Task được dispatch cho agent → status: running, prog: 10
- Agent báo xong → status: done, prog: 100
- Task bị block → status: blocked
- Agent mới được spawn → update AGENTS array (status: running)
- Agent xong → status: active
- Topic map thay đổi → update TOPICS array
- Real team thay đổi → update REAL_TEAM array
- Shift report mới → update LAST_SHIFT
- EXP data thay đổi → update staff EXP trong sidebar

### Cách update:
1. Đọc dashboard/index.html
2. Find đúng DATA block cần sửa
3. Edit in-place với giá trị mới
4. Không cần restart server

---

## 🟡 RULE #2 — TASK LOG PHẢI KHỚP VỚI DASHBOARD
Nova giữ file `memory/task-log.md` — source of truth cho tất cả tasks.
Mỗi khi MEMORY.md hoặc WIP thay đổi → sync vào dashboard.

---

## 🟢 HEARTBEAT CHECKS (mỗi lần heartbeat poll)
1. Đọc file này
2. Check subagents đang chạy → update dashboard status nếu có thay đổi
3. Check `memory/task-log.md` → sync với dashboard nếu lệch
4. Nếu không có gì → HEARTBEAT_OK
