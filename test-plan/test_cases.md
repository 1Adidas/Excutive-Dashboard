# KẾ HOẠCH KIỂM THỬ TÍCH HỢP (INTEGRATION TEST PLAN)

Tài liệu này định nghĩa các kịch bản kiểm thử tích hợp nhằm xác thực tính chính xác của luồng dữ liệu gộp từ hai cơ sở dữ liệu độc lập (`HR_Legacy_DB` và `Payroll_Legacy_DB`) hiển thị lên Executive Dashboard, tuân thủ nghiêm ngặt nguyên lý **Hộp đen (Black-box)** và phương pháp **Tích hợp tầng hiển thị (Presentation-style Integration)**.

---

## Kịch bản kiểm thử 1 (TC-01): Xác thực tổng hợp thu nhập & Drill-down chi tiết

### 1. Mục tiêu
Đảm bảo dữ liệu thu nhập năm nay và năm trước được lấy đúng từ `Payroll_Legacy_DB`, kết hợp với thông tin cá nhân của nhân viên ở `HR_Legacy_DB` để gộp và tính toán thống kê chính xác theo tiêu chí phân loại phòng ban (Department) mà không xảy ra sai lệch dữ liệu.

### 2. Điều kiện tiên quyết (Preconditions)
- Hai cơ sở dữ liệu `HR_Legacy_DB` và `Payroll_Legacy_DB` đang chạy trên SQL Server và đã chèn dữ liệu mẫu từ `03_insert_mock_data.sql`.
- Ứng dụng Backend API Node.js đã kết nối thành công và đang hoạt động tại cổng 3000.
- Dashboard Frontend được tải thành công trên trình duyệt.

### 3. Các bước thực hiện (Steps)
1. Trên trình duyệt, truy cập Dashboard và chuyển sang tab **Báo cáo thu nhập**.
2. Tại bộ lọc phân loại Drill-down, chọn **Phòng ban (Department)**.
3. Ghi lại giá trị của phòng ban **IT** trên bảng tổng hợp:
   - Số lượng nhân sự (Số NV)
   - Quỹ lương năm ngoái
   - Quỹ lương năm nay
   - Trung bình năm nay
4. Nhấp vào nút **Xem NV** tương ứng với hàng **IT** để mở Modal chi tiết.
5. Kiểm tra danh sách nhân viên trong Modal chi tiết của phòng ban **IT**.
6. Thực hiện câu lệnh SQL thủ công trực tiếp trên database để đối chiếu:
   ```sql
   -- Query gộp thủ công bằng cách liên kết logic
   SELECT 
       e.Employee_ID,
       e.First_Name + ' ' + e.Last_Name AS Full_Name,
       p.Previous_Year_Income,
       p.Current_Year_Income
   FROM HR_Legacy_DB.dbo.Employees e
   INNER JOIN Payroll_Legacy_DB.dbo.Payroll p ON e.Employee_ID = p.Employee_ID
   WHERE e.Department = 'IT';
   ```

### 4. Kết quả mong đợi (Expected Results)
- Giao diện hiển thị đúng 2 nhân sự thuộc phòng ban IT (Nguyen Van An và Vo Thi Phuong).
- Tổng thu nhập hiển thị trên giao diện phải khớp hoàn toàn với tổng tính toán từ câu lệnh SQL trực tiếp:
   - Quỹ lương năm nay của IT: `85,000 + 32,000 = $117,000`
   - Quỹ lương năm ngoái của IT: `78,000 + 28,000 = $106,000`
   - Trung bình năm nay: `$58,500`
- Việc truy vấn không làm khóa (lock) bất kỳ bảng nào trong database gốc (nhờ cơ chế kết nối Read-Only và câu lệnh truy vấn đơn giản không dùng giao dịch nặng).

---

## Kịch bản kiểm thử 2 (TC-02): Kiểm tra Cảnh báo tự động về quy định Nghỉ phép

### 1. Mục tiêu
Xác thực hệ thống phát hiện chính xác các nhân sự có số ngày phép đã nghỉ vượt quá quy định (ngưỡng 15 ngày được đặt trong file cấu hình `.env`), hiển thị đúng mức độ cảnh báo (Warning/Critical) trên Dashboard.

### 2. Điều kiện tiên quyết (Preconditions)
- Đã cấu hình biến môi trường `MAX_VACATION_DAYS=15` trong file `.env`.
- Dữ liệu HR chứa nhân sự có ngày nghỉ lớn hơn 15 ngày (ví dụ: Tran Thi Binh - 18 ngày, Hoang Duc Em - 20 ngày).

### 3. Các bước thực hiện (Steps)
1. Tại màn hình **Tổng quan** của Dashboard, quan sát mục **Cảnh báo giám sát (Alerts)**.
2. Kiểm tra xem có xuất hiện cảnh báo vượt quá ngày phép của nhân viên `Tran Thi Binh` và `Hoang Duc Em` hay không.
3. Đối chiếu mức độ nghiêm trọng:
   - `Tran Thi Binh` (18 ngày - vượt 3 ngày) phải hiển thị nhãn **Warning** (màu vàng).
   - `Hoang Duc Em` (20 ngày - vượt 5 ngày) phải hiển thị nhãn **Critical** (màu đỏ) do vượt quá ngưỡng quy chế nghiêm trọng.
4. Truy cập SQL Server Management Studio để truy vấn kiểm tra chéo:
   ```sql
   SELECT Employee_ID, First_Name, Last_Name, Vacation_Days_Used 
   FROM HR_Legacy_DB.dbo.Employees
   WHERE Vacation_Days_Used > 15;
   ```

### 4. Kết quả mong đợi (Expected Results)
- Hệ thống tự động đẩy cảnh báo thời gian thực lên Dashboard.
- Danh sách cảnh báo hiển thị đầy đủ thông tin: họ tên nhân viên, phòng ban, số ngày phép đã nghỉ, số ngày vượt phép, thông điệp chi tiết.
- Kết quả hiển thị khớp 100% với danh sách lấy từ truy vấn SQL trực tiếp.

---

## Kịch bản kiểm thử 3 (TC-03): Kiểm tra bộ lọc CEO về thu nhập vượt mức

### 1. Mục tiêu
Xác thực chức năng đáp ứng câu hỏi nghiệp vụ đặc thù của CEO: "Những nhân viên nào có thu nhập vượt quá một mức số tiền nhất định [Amount] trong năm ngoái, phân loại theo từng phòng ban?".

### 2. Điều kiện tiên quyết (Preconditions)
- Các DB đang hoạt động bình thường.
- Đã xác định dữ liệu mẫu thu nhập năm ngoái trong DB Payroll.

### 3. Các bước thực hiện (Steps)
1. Trên menu điều hướng, nhấp chọn **Bộ lọc CEO**.
2. Tại ô nhập **Mức thu nhập tối thiểu năm ngoái**, nhập số tiền: `70000`.
3. Chọn **Tất cả phòng ban** ở danh sách phòng ban.
4. Nhấn nút **Áp dụng bộ lọc**.
5. Ghi nhận kết quả hiển thị trên màn hình:
   - Các phòng ban có nhân sự thỏa mãn.
   - Chi tiết thông tin nhân sự (Họ tên, mã số, thu nhập năm ngoái và năm nay).
6. Truy vấn SQL trực tiếp để đối chiếu chéo:
   ```sql
   SELECT 
       e.Department,
       e.Employee_ID,
       e.First_Name + ' ' + e.Last_Name AS Full_Name,
       p.Previous_Year_Income
   FROM HR_Legacy_DB.dbo.Employees e
   INNER JOIN Payroll_Legacy_DB.dbo.Payroll p ON e.Employee_ID = p.Employee_ID
   WHERE p.Previous_Year_Income > 70000
   ORDER BY e.Department;
   ```

### 4. Kết quả mong đợi (Expected Results)
- Hệ thống lọc ra đúng 3 nhân sự có thu nhập năm ngoái vượt quá $70,000, nhóm theo 2 phòng ban:
   - **IT**: Nguyen Van An ($78,000)
   - **Finance**: Dang Quoc Gia ($115,000)
   - **Operations**: Hoang Duc Em ($88,000)
- Các phòng ban khác không có nhân sự thỏa mãn (ví dụ: HR, Marketing) sẽ không hiển thị nhóm kết quả để tối ưu không gian hiển thị.
- UI render mượt mà, phản hồi ngay lập tức dưới 100ms nhờ cơ chế index `IX_Payroll_EmployeeID` ở cơ sở dữ liệu.
