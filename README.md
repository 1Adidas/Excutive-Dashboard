# BÀI TẬP LỚN MÔN HỌC: TÍCH HỢP HỆ THỐNG PHẦN MỀM (SE445)
## ĐỀ TÀI: ĐỒNG BỘ VÀ TÍCH HỢP HỆ THỐNG QUẢN LÝ NHÂN SỰ & LƯƠNG (EXECUTIVE INTEGRATION DASHBOARD)

Dự án này là sản phẩm thực hành thiết kế giải pháp tích hợp dữ liệu ở **Tầng trình diễn (Presentation-level Integration)** giữa hai hệ thống di sản (Legacy Systems) hoạt động độc lập: **Hệ thống Nhân sự (HR System)** và **Hệ thống Lương (Payroll System)**.

---

## 📌 1. Mục tiêu & Ý nghĩa Đề tài

Trong thực tế doanh nghiệp, việc sáp nhập hoặc nâng cấp hệ thống thường để lại các cơ sở dữ liệu cũ (Legacy Databases) không thể sửa đổi cấu trúc (ràng buộc hộp đen - Black-box). Dự án này giải quyết bài toán tích hợp thông tin của ban giám đốc (CEO) mà:
* **Không làm thay đổi schema** của các cơ sở dữ liệu cũ.
* **Không cài đặt trigger, stored procedure** hay can thiệp ghi đè dữ liệu gốc.
* **Tuân thủ nguyên tắc Read-Only** đối với các hệ thống nguồn.
* Thực hiện **Application-level JOIN** (gộp dữ liệu ở tầng ứng dụng bằng JavaScript) để xuất bản các báo cáo tổng hợp thời gian thực.

---

## 🏗️ 2. Kiến trúc Tích hợp Hệ thống

Mô hình tích hợp được triển khai theo cơ chế tích hợp mức hiển thị thông qua một API Gateway trung gian:

```mermaid
graph TD
    subgraph Legacy Databases (SQL Server)
        DB_HR[(HR_Legacy_DB)]
        DB_PAY[(Payroll_Legacy_DB)]
    end

    subgraph Backend Integration Layer (Node.js & Express)
        Service_HR[HR Service]
        Service_Pay[Payroll Service]
        Integration[Integration Service]
        API_Routes[REST API Endpoints]
        
        DB_HR -->|Query SELECT| Service_HR
        DB_PAY -->|Query SELECT| Service_Pay
        Service_HR -->|Raw Recordsets| Integration
        Service_Pay -->|Raw Recordsets| Integration
        Integration -->|Application-level JOIN| API_Routes
    end

    subgraph Premium Frontend (Presentation Layer)
        UI[Glassmorphism Executive Dashboard]
        API_Routes -->|JSON Payload| UI
    end
    
    style DB_HR fill:#f9f,stroke:#333,stroke-width:2px
    style DB_PAY fill:#bbf,stroke:#333,stroke-width:2px
    style UI fill:#dfd,stroke:#333,stroke-width:2px
```

* **HR_Legacy_DB**: Lưu thông tin hồ sơ nhân sự (Phòng ban, Ngày sinh, Ngày tuyển dụng, Sắc tộc, Tình trạng hôn nhân, Số ngày phép đã dùng...).
* **Payroll_Legacy_DB**: Lưu thông tin thu nhập và chính sách đãi ngộ (Lương năm nay, Lương năm ngoái, Trạng thái cổ đông, Loại hình lao động, Gói phúc lợi...).
* **Integration Service**: Thực hiện truy vấn **song song (parallel queries)** vào hai cơ sở dữ liệu để tối ưu hóa thời gian phản hồi, sau đó dùng khóa liên kết logic là `Employee_ID` để tự động khớp nối thông tin trên bộ nhớ RAM của máy chủ Node.js.

---

## 🌟 3. Các Tính năng Chính trên Dashboard dành cho CEO

Dashboard được xây dựng với giao diện **Glassmorphism Dark Theme** hiện đại, tối ưu hóa trải nghiệm điều hành của CEO:

1. **Thống kê KPIs động (Interactive KPIs)**:
   * Hiển thị tổng số lượng nhân sự gộp, tổng quỹ lương năm nay, số ngày nghỉ phép trung bình và số cảnh báo cần xử lý.
   * Các thẻ có khả năng tương tác, nhấp vào sẽ tự động chuyển tab báo cáo liên quan hoặc kích hoạt trung tâm thông báo.
2. **Hệ thống 3 Báo cáo Phân tích Chuyên sâu (Drill-down Reports)**:
   * **Báo cáo Thu nhập**: So sánh biến động quỹ lương năm trước và năm nay theo các chiều (Drill-down): Phòng ban, Trạng thái cổ đông, Giới tính, Sắc tộc, Loại hình làm việc.
   * **Báo cáo Nghỉ phép**: Theo dõi tỉ lệ phân bổ ngày nghỉ phép, khoanh vùng các bộ phận vượt quy chế nghỉ phép (>15 ngày phép).
   * **Báo cáo Phúc lợi**: Thống kê mức thu nhập trung bình chi trả cho cổ đông so với nhân viên thường theo từng cấp độ gói phúc lợi (Standard, Gold, Platinum).
3. **Chi tiết hồ sơ nhân sự gộp (Cross-DB Profile View)**:
   * Click vào bất kỳ nhân sự nào trên các bảng báo cáo để mở ngay thẻ thông tin chi tiết tích hợp dữ liệu của cả HR & Lương trên một màn hình duy nhất (bao gồm cả chỉ số tăng trưởng lương cá nhân).
4. **Bộ lọc thông minh CEO (CEO Smart Filter)**:
   * Hỗ trợ tìm kiếm nhanh theo Tên/Mã nhân viên kết hợp đồng thời nhiều bộ lọc nâng cao (Khoảng lương năm ngoái, Phòng ban, Loại hình, Cổ đông, Giới tính) để truy xuất dữ liệu đích tức thời.
5. **Trung tâm Chỉ thị Nhanh (Alert Action Center)**:
   * Phát hiện tự động các sự kiện: nhân sự quá ngày phép quy định, nhân sự sinh nhật trong tháng, kỷ niệm ngày tuyển dụng/kỷ niệm cưới sắp tới, hoặc thu nhập biến động bất thường (>10%).
   * Cho phép CEO viết và gửi email chỉ thị hoặc thư chúc mừng trực tiếp từ thẻ thông báo (simulated).
6. **Mô phỏng Xuất báo cáo (Report Exports)**:
   * Cho phép tải xuống các dữ liệu tổng hợp dưới dạng PDF và Excel (mô phỏng tiến trình kết xuất thời gian thực).

---

## 💻 4. Công nghệ Sử dụng

* **Cơ sở dữ liệu**: Microsoft SQL Server (SQLEXPRESS).
* **Máy chủ Backend**: Node.js v20+, Express framework.
* **Thư viện kết nối**: `mssql` (tedious wrapper), `dotenv`.
* **Giao diện Frontend**: HTML5, CSS3 (Custom Glassmorphism styling), Vanilla Javascript (ES6), FontAwesome Icons, Chart.js.

---

## ⚙️ 5. Hướng dẫn Cài đặt & Chạy dự án (Dev Setup)

### Bước 1: Khởi tạo Cơ sở Dữ liệu (SQL Server)
1. Mở phần mềm **SQL Server Management Studio (SSMS)** và kết nối tới máy chủ SQL Server của bạn (thường là `localhost\SQLEXPRESS`).
2. Mở và chạy lần lượt 3 file SQL scripts nằm trong thư mục [`database/`](file:///d:/University/TichHopHeThong/SE445/Project/database/):
   * Chạy [`01_create_hr_db.sql`](file:///d:/University/TichHopHeThong/SE445/Project/database/01_create_hr_db.sql) để tạo cơ sở dữ liệu nhân sự `HR_Legacy_DB`.
   * Chạy [`02_create_payroll_db.sql`](file:///d:/University/TichHopHeThong/SE445/Project/database/02_create_payroll_db.sql) để tạo cơ sở dữ liệu lương `Payroll_Legacy_DB`.
   * Chạy [`03_insert_mock_data.sql`](file:///d:/University/TichHopHeThong/SE445/Project/database/03_insert_mock_data.sql) để nạp 10 bản ghi nhân sự mẫu.

### Bước 2: Thiết lập Tài khoản đăng nhập SQL Server (SQL Authentication)
Để ứng dụng Express có thể kết nối đến cơ sở dữ liệu thông qua tài khoản đăng nhập SQL Server:
1. Đảm bảo SQL Server của bạn đã bật chế độ **Mixed Mode Authentication** (Cả SQL Server & Windows Authentication).
2. Tạo tài khoản đăng nhập `dashboard_user` với mật khẩu là `123456` bằng cách chạy script sau trong SSMS:
   ```sql
   -- Tạo login trên toàn server
   CREATE LOGIN dashboard_user WITH PASSWORD = '123456';
   GO
   
   -- Cấp quyền truy cập và quyền đọc (datareader) trên HR_Legacy_DB
   USE HR_Legacy_DB;
   CREATE USER dashboard_user FOR LOGIN dashboard_user;
   ALTER ROLE db_datareader ADD MEMBER dashboard_user;
   GO
   
   -- Cấp quyền truy cập và quyền đọc (datareader) trên Payroll_Legacy_DB
   USE Payroll_Legacy_DB;
   CREATE USER dashboard_user FOR LOGIN dashboard_user;
   ALTER ROLE db_datareader ADD MEMBER dashboard_user;
   GO
   ```

### Bước 3: Cấu hình biến môi trường Backend
1. Di chuyển vào thư mục [`backend/`](file:///d:/University/TichHopHeThong/SE445/Project/backend/).
2. Tạo một file mới tên là `.env` (bạn có thể copy từ [`.env.local`](file:///d:/University/TichHopHeThong/SE445/Project/backend/.env.local) hoặc tham khảo [`.env.example`](file:///d:/University/TichHopHeThong/SE445/Project/backend/.env.example)).
3. Định cấu hình thông tin kết nối SQL Server của bạn trong file `.env`:
   ```env
   DB_SERVER=localhost\\SQLEXPRESS  # Tên Server SQL của bạn (đổi thành localhost nếu dùng Default Instance)
   DB_PORT=1433
   DB_USER=dashboard_user
   DB_PASSWORD=123456
   HR_DB_NAME=HR_Legacy_DB
   PAYROLL_DB_NAME=Payroll_Legacy_DB
   PORT=3000
   MAX_VACATION_DAYS=15
   ANNIVERSARY_ALERT_DAYS=30
   ```

### Bước 4: Khởi chạy dự án
Mở Terminal trong thư mục [`backend/`](file:///d:/University/TichHopHeThong/SE445/Project/backend/) và chạy các lệnh sau:

1. **Cài đặt thư viện dependencies**:
   ```bash
   npm install
   ```
2. **Chạy Server ở chế độ nhà phát triển (Dev Mode)**:
   ```bash
   npm run dev
   ```
3. **Truy cập ứng dụng**:
   Mở trình duyệt của bạn và nhập địa chỉ: **[http://localhost:3000](http://localhost:3000)** để xem giao diện Dashboard.
   Kiểm tra sức khỏe hệ thống và trạng thái kết nối DB tại endpoint: **[http://localhost:3000/api/health](http://localhost:3000/api/health)**.
