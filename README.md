# 🏢 Executive Integration Dashboard
## Hệ Thống Tích Hợp Nhân Sự & Lương — SE445 Case Study 3

> Dự án thực hành môn **Tích Hợp Hệ Thống Phần Mềm (SE445)** — Xây dựng tầng tích hợp giữa hai cơ sở dữ liệu di sản độc lập, cung cấp giao diện quản trị thời gian thực cho CEO, bộ phận Nhân sự và Tài chính.

---

## 📌 Bối Cảnh & Bài Toán

Doanh nghiệp vận hành hai hệ thống di sản (Legacy Systems) hoàn toàn tách biệt:

| Hệ thống | Database | Nội dung |
|----------|----------|----------|
| HR Legacy | `HR_Legacy_DB` | Hồ sơ nhân viên, phòng ban, ngày tuyển dụng, nghỉ phép... |
| Payroll Legacy | `Payroll_Legacy_DB` | Thông tin lương, loại hợp đồng, gói phúc lợi, cổ đông... |

**Ràng buộc thực tế:**
- Không được chỉnh sửa schema, thêm trigger/stored procedure trên DB cũ (Black-box DB)
- Hai DB không có Foreign Key liên kết vật lý với nhau
- Phải đảm bảo **nhất quán dữ liệu** khi thêm/sửa/xóa giữa hai hệ thống

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (Browser)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ CEO Dashboard│  │  HR System   │  │Payroll System│  │
│  │  index.html  │  │   hr.html    │  │payroll.html  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └─────────────────┴──────────────────┘          │
│                    SSE EventSource (/api/updates)         │
└─────────────────────────────┬───────────────────────────┘
                               │ REST API + SSE
┌──────────────────────────────▼───────────────────────────┐
│              BACKEND INTEGRATION LAYER (Node.js)          │
│                                                           │
│   ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│   │   hrService  │  │payrollService │  │integrationS │  │
│   │  (Read/Write)│  │  (Read/Write) │  │ (Saga + JOIN│  │
│   └──────┬───────┘  └──────┬────────┘  └──────┬──────┘  │
│          │                  │                   │         │
│   ┌──────┴───────┐  ┌───────┴────────┐         │         │
│   │ HR_Legacy_DB │  │Payroll_LegacyDB│◄─────────┘         │
│   │ (SQL Server) │  │  (SQL Server)  │                    │
│   └──────────────┘  └────────────────┘                    │
└───────────────────────────────────────────────────────────┘
```

### Cơ chế Đồng bộ Thời gian thực (SSE)

Mỗi thao tác ghi (CREATE / UPDATE / DELETE) phát một sự kiện SSE `REFRESH` đến **tất cả tab trình duyệt đang mở**. Từng trang tự động tải lại dữ liệu mà không cần refresh thủ công.

```
Tab HR thêm nhân viên
        │
        ▼
POST /api/employees  ──►  Saga: INSERT HR_DB → INSERT Payroll_DB
        │
        ▼
broadcastUpdate('create_employee')
        │
        ├──► SSE → Tab CEO Dashboard   → reload KPIs & charts
        ├──► SSE → Tab HR System       → reload employee table
        └──► SSE → Tab Payroll System  → reload payroll table
```

---

## ⚡ Các Quyết Định Kỹ Thuật Quan Trọng

### 1. Application-level JOIN (O(N) với HashMap)

Thay vì dùng Linked Server hay Cross-DB query (vi phạm Black-box DB constraint), backend:
1. Truy vấn song song cả 2 DB bằng `Promise.all`
2. Dùng `Map<Employee_ID, PayrollRecord>` để JOIN trong bộ nhớ — O(1) lookup thay vì O(N²) nested loop

```javascript
const [employees, payrolls] = await Promise.all([
    hrService.getAllEmployees(),
    payrollService.getAllPayroll()
]);
const payrollMap = new Map(payrolls.map(p => [p.Employee_ID, p]));
const merged = employees.map(emp => ({ ...emp, ...payrollMap.get(emp.Employee_ID) }));
```

### 2. Saga Pattern — Compensating Transactions

Vì không có Foreign Key vật lý giữa 2 DB, mọi thao tác ghi đều theo **Saga Pattern**:

| Thao tác | Bước 1 | Bước 2 | Rollback |
|----------|--------|--------|---------|
| Tạo nhân viên | INSERT HR DB | INSERT Payroll DB | Nếu Payroll fail → DELETE HR DB |
| Cập nhật | UPDATE HR DB (merge) | UPDATE Payroll DB | Nếu Payroll fail → RESTORE HR DB cũ |
| Xóa nhân viên | DELETE Payroll DB | DELETE HR DB | Nếu HR fail → RE-INSERT Payroll DB |

### 3. Merge-before-Update (Partial Update Pattern)

`updateEmployee()` trong `hrService` tự động **fetch dữ liệu hiện tại từ DB trước** khi UPDATE, cho phép Payroll System chỉ truyền các trường lương mà không cần cung cấp lại toàn bộ thông tin HR — tránh lỗi NULL constraint.

```javascript
const current = await pool.request()...query('SELECT * FROM Employees WHERE ...');
const cur = current.recordset[0] || {};
// Merge: dùng giá trị truyền vào nếu có, fallback về DB hiện tại
.input('First_Name', emp.First_Name ?? cur.First_Name)
```

---

## 📁 Cấu Trúc Dự Án

```
Project/
├── backend/
│   ├── config/
│   │   └── database.js          # Connection pool cho HR & Payroll DB
│   ├── routes/
│   │   ├── employees.js         # POST/PUT/DELETE /api/employees
│   │   ├── payroll.js           # GET/PUT /api/payroll
│   │   └── reports.js           # GET /api/reports/*
│   ├── services/
│   │   ├── hrService.js         # Truy vấn & ghi HR_Legacy_DB
│   │   ├── payrollService.js    # Truy vấn & ghi Payroll_Legacy_DB
│   │   └── integrationService.js # Saga + Application JOIN
│   ├── server.js                # Express app + SSE hub /api/updates
│   └── .env                     # Cấu hình kết nối (không commit)
│
├── frontend/
│   ├── index.html               # CEO Executive Dashboard
│   ├── hr.html                  # HR Management System
│   ├── payroll.html             # Payroll Management System
│   ├── css/
│   │   └── style.css            # Design system (dark-mode, glassmorphism)
│   └── js/
│       ├── app.js               # CEO Dashboard logic + SSE sync
│       ├── hr.js                # HR System logic + SSE sync
│       ├── payroll.js           # Payroll System logic + SSE sync
│       └── charts.js            # Chart.js wrappers
│
├── database/
│   ├── 01_create_hr_db.sql      # Tạo HR_Legacy_DB
│   ├── 02_create_payroll_db.sql # Tạo Payroll_Legacy_DB
│   └── 03_insert_mock_data.sql  # Dữ liệu mẫu
│
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### Bước 1: Khởi tạo Database

Mở **SQL Server Management Studio (SSMS)**, kết nối `localhost` và chạy lần lượt:

```sql
-- 1. Tạo HR database
-- Chạy file: database/01_create_hr_db.sql

-- 2. Tạo Payroll database
-- Chạy file: database/02_create_payroll_db.sql

-- 3. Nạp dữ liệu mẫu (10 nhân viên)
-- Chạy file: database/03_insert_mock_data.sql
```

### Bước 2: Tạo tài khoản SQL & Phân quyền

```sql
-- Tạo login
CREATE LOGIN dashboard_user WITH PASSWORD = '123456';
GO

-- Phân quyền HR DB (đọc + ghi)
USE HR_Legacy_DB;
CREATE USER dashboard_user FOR LOGIN dashboard_user;
ALTER ROLE db_datareader ADD MEMBER dashboard_user;
GRANT INSERT, UPDATE, DELETE ON dbo.Employees TO dashboard_user;
GO

-- Phân quyền Payroll DB (đọc + ghi)
USE Payroll_Legacy_DB;
CREATE USER dashboard_user FOR LOGIN dashboard_user;
ALTER ROLE db_datareader ADD MEMBER dashboard_user;
GRANT INSERT, UPDATE, DELETE ON dbo.Payroll TO dashboard_user;
GO
```

### Bước 3: Cấu hình `.env`

Tạo file `backend/.env`:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_USER=dashboard_user
DB_PASSWORD=123456
HR_DB_NAME=HR_Legacy_DB
PAYROLL_DB_NAME=Payroll_Legacy_DB
PORT=3000
MAX_VACATION_DAYS=15
ANNIVERSARY_ALERT_DAYS=30
```

### Bước 4: Chạy Backend Server

```bash
cd backend
npm install
node server.js
```

### Bước 5: Mở các giao diện

| Trang | URL |
|-------|-----|
| 🏢 CEO Executive Dashboard | http://localhost:3000/index.html |
| 👥 HR Management System | http://localhost:3000/hr.html |
| 💰 Payroll Management System | http://localhost:3000/payroll.html |
| ❤️ Health Check API | http://localhost:3000/api/health |

> **Mẹo**: Mở 3 tab cùng lúc — khi thêm/sửa nhân viên ở bất kỳ tab nào, toàn bộ tab còn lại tự cập nhật ngay lập tức nhờ SSE.

---

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/health` | Kiểm tra kết nối DB |
| `GET` | `/api/employees` | Danh sách nhân viên tích hợp |
| `POST` | `/api/employees` | Tạo nhân viên mới (ghi cả 2 DB) |
| `PUT` | `/api/employees/:id` | Cập nhật thông tin nhân sự |
| `DELETE` | `/api/employees/:id` | Xóa đồng bộ khỏi cả 2 DB |
| `GET` | `/api/payroll` | Danh sách bảng lương |
| `PUT` | `/api/payroll/:id` | Cập nhật lương (partial update) |
| `GET` | `/api/reports/income` | Báo cáo thu nhập theo phòng ban |
| `GET` | `/api/reports/vacation` | Báo cáo ngày phép |
| `GET` | `/api/reports/benefits` | Báo cáo phúc lợi & cổ đông |
| `GET` | `/api/alerts` | Cảnh báo bất thường |
| `GET` | `/api/updates` | SSE stream — đồng bộ real-time |

---

## 🛡️ Bảo Mật

- **Least Privilege**: Tài khoản DB chỉ có quyền tối thiểu cần thiết
- **Parameterized Queries**: Toàn bộ câu truy vấn dùng `.input()` của `mssql` — chống SQL Injection
- **CORS**: Cấu hình `Access-Control-Allow-Origin` có kiểm soát
- **Secrets**: Thông tin nhạy cảm lưu trong `.env`, không commit lên Git (`.gitignore`)

---

## 📚 Kiến Thức Thu Hoạch

| Lĩnh vực | Nội dung |
|----------|----------|
| **Tích hợp hệ thống** | Presentation-level Integration, Application JOIN, SSE real-time sync |
| **Độ tin cậy dữ liệu** | Saga Pattern, Compensating Transaction, Eventual Consistency |
| **Hiệu năng** | Promise.all parallel query, O(N) HashMap JOIN, Connection Pooling |
| **Bảo mật** | Least Privilege, Parameterized Query, Input Sanitization |
| **Frontend** | Vanilla JS, Chart.js, CSS Grid/Flexbox, EventSource API |