-- ============================================================
-- GIAI ĐOẠN 1: TẠO CƠ SỞ DỮ LIỆU Payroll_Legacy_DB
-- Hệ thống Lương (Payroll Legacy System)
-- Lưu ý: Database này là hệ thống cũ, chỉ được phép ĐỌC (Read-Only)
--         từ tầng tích hợp. KHÔNG chỉnh sửa cấu trúc sau khi khởi tạo.
-- ============================================================

-- Tạo database nếu chưa tồn tại
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'Payroll_Legacy_DB')
BEGIN
    CREATE DATABASE Payroll_Legacy_DB;
END
GO

USE Payroll_Legacy_DB;
GO

-- Xóa bảng cũ nếu đang chạy lại script
IF OBJECT_ID('dbo.Payroll', 'U') IS NOT NULL
    DROP TABLE dbo.Payroll;
GO

-- ============================================================
-- Bảng Payroll: Chứa thông tin lương, phúc lợi, loại hình làm việc
-- Employee_ID liên kết logic với HR_Legacy_DB.Employees
-- (KHÔNG tạo FK vật lý giữa 2 database — tuân thủ nguyên tắc hộp đen)
-- ============================================================
CREATE TABLE dbo.Payroll (
    Payroll_ID          INT             PRIMARY KEY IDENTITY(1,1),  -- Mã bản ghi lương (tự tăng)
    Employee_ID         INT             NOT NULL,                    -- Mã nhân viên (liên kết logic với HR)
    Current_Year_Income DECIMAL(15, 2)  NOT NULL DEFAULT 0,         -- Thu nhập năm nay (USD)
    Previous_Year_Income DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- Thu nhập năm ngoái (USD)
    Shareholder_Status  BIT             NOT NULL DEFAULT 0,          -- Trạng thái cổ đông (1=Có, 0=Không)
    Employment_Type     NVARCHAR(20)    NOT NULL DEFAULT 'Full-time',-- Loại hình: Full-time / Part-time
    Benefit_Plan        NVARCHAR(50)    NOT NULL DEFAULT 'Standard'  -- Gói phúc lợi: Standard/Gold/Platinum
);
GO

-- Index trên Employee_ID để tăng tốc truy vấn JOIN ở tầng ứng dụng
CREATE NONCLUSTERED INDEX IX_Payroll_EmployeeID 
ON dbo.Payroll (Employee_ID);
GO

PRINT N'✅ Payroll_Legacy_DB - Bảng Payroll đã được tạo thành công.';
GO
