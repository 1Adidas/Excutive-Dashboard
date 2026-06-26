-- ============================================================
-- GIAI ĐOẠN 1: TẠO CƠ SỞ DỮ LIỆU HR_Legacy_DB
-- Hệ thống Nhân sự (Human Resources Legacy System)
-- Lưu ý: Database này là hệ thống cũ, chỉ được phép ĐỌC (Read-Only)
--         từ tầng tích hợp. KHÔNG chỉnh sửa cấu trúc sau khi khởi tạo.
-- ============================================================

-- Tạo database nếu chưa tồn tại
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'HR_Legacy_DB')
BEGIN
    CREATE DATABASE HR_Legacy_DB;
END
GO

USE HR_Legacy_DB;
GO

-- Xóa bảng cũ nếu đang chạy lại script
IF OBJECT_ID('dbo.Employees', 'U') IS NOT NULL
    DROP TABLE dbo.Employees;
GO

-- ============================================================
-- Bảng Employees: Chứa toàn bộ thông tin nhân sự
-- Employee_ID là mã định danh chung, dùng để liên kết với 
-- Payroll_Legacy_DB ở tầng ứng dụng (KHÔNG dùng FK giữa 2 DB)
-- ============================================================
CREATE TABLE dbo.Employees (
    Employee_ID     INT             PRIMARY KEY,            -- Mã nhân viên (khóa chính)
    First_Name      NVARCHAR(50)    NOT NULL,               -- Tên
    Last_Name       NVARCHAR(50)    NOT NULL,               -- Họ
    Department      NVARCHAR(100)   NOT NULL,               -- Phòng ban
    Hire_Date       DATE            NOT NULL,               -- Ngày tuyển dụng
    Date_of_Birth   DATE            NOT NULL,               -- Ngày sinh
    Gender          NVARCHAR(10)    NOT NULL,               -- Giới tính (Male/Female/Other)
    Ethnicity       NVARCHAR(50)    NOT NULL,               -- Sắc tộc
    Vacation_Days_Used INT          NOT NULL DEFAULT 0,     -- Số ngày phép đã sử dụng
    Marital_Status  NVARCHAR(20)    NOT NULL DEFAULT 'Single', -- Tình trạng hôn nhân
    Wedding_Anniversary DATE        NULL                    -- Ngày kỷ niệm cưới (NULL nếu chưa kết hôn)
);
GO

PRINT N'HR_Legacy_DB - Bảng Employees đã được tạo thành công.';
GO
