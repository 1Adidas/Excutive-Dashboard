-- ============================================================
-- GIAI ĐOẠN 1: CHÈN DỮ LIỆU MẪU (MOCK DATA)
-- Chèn 10 bản ghi vào HR_Legacy_DB và Payroll_Legacy_DB
-- Dữ liệu được thiết kế để cover tất cả các trường hợp kiểm thử:
--   ✓ Nhiều phòng ban (IT, HR, Finance, Marketing, Operations)
--   ✓ Đa dạng giới tính, sắc tộc
--   ✓ Có nhân viên sinh nhật trong tháng hiện tại (tháng 6)
--   ✓ Có nhân viên sắp kỷ niệm tuyển dụng (trong 30 ngày)
--   ✓ Có nhân viên vượt ngày phép (>15 ngày)
--   ✓ Có cả cổ đông và non-shareholder
--   ✓ Có cả Full-time và Part-time
--   ✓ Đa dạng gói phúc lợi (Standard, Gold, Platinum)
-- ============================================================

-- ========================
-- DỮ LIỆU HR_Legacy_DB
-- ========================
USE HR_Legacy_DB;
GO

-- Xóa dữ liệu cũ (nếu chạy lại script)
DELETE FROM dbo.Employees;
GO

INSERT INTO dbo.Employees 
    (Employee_ID, First_Name, Last_Name, Department, Hire_Date, Date_of_Birth, Gender, Ethnicity, Vacation_Days_Used, Marital_Status, Wedding_Anniversary)
VALUES
    -- NV 1: IT, nam, sinh nhật tháng 6 → test alert sinh nhật
    (1001, N'Nguyen',  N'Van An',     N'IT',         '2018-07-15', '1990-06-20', N'Male',   N'Asian',     8,  N'Married',  '2016-08-10'),
    
    -- NV 2: HR, nữ, vượt ngày phép (18 > 15) → test alert vượt phép
    (1002, N'Tran',    N'Thi Binh',   N'HR',         '2019-03-01', '1988-11-25', N'Female', N'Asian',     18, N'Married',  '2015-12-20'),
    
    -- NV 3: Finance, nam, kỷ niệm tuyển dụng sắp tới (tháng 7) → test alert kỷ niệm
    (1003, N'Le',      N'Hoang Cuong',N'Finance',    '2020-07-20', '1992-03-14', N'Male',   N'Asian',     5,  N'Single',   NULL),
    
    -- NV 4: Marketing, nữ, sinh nhật tháng 6 → test alert sinh nhật
    (1004, N'Pham',    N'Thi Dung',   N'Marketing',  '2017-01-10', '1995-06-05', N'Female', N'Asian',     12, N'Married',  '2022-07-15'),
    
    -- NV 5: Operations, nam, vượt ngày phép (20 > 15)
    (1005, N'Hoang',   N'Duc Em',     N'Operations', '2016-09-05', '1985-09-30', N'Male',   N'Asian',     20, N'Married',  '2012-05-18'),
    
    -- NV 6: IT, nữ, part-time (sẽ map ở Payroll)
    (1006, N'Vo',      N'Thi Phuong', N'IT',         '2021-04-12', '1998-02-28', N'Female', N'Asian',     3,  N'Single',   NULL),
    
    -- NV 7: Finance, nam, cổ đông
    (1007, N'Dang',    N'Quoc Gia',   N'Finance',    '2015-11-01', '1980-08-15', N'Male',   N'Asian',     10, N'Married',  '2008-06-25'),
    
    -- NV 8: HR, nam, kỷ niệm cưới sắp tới (tháng 7) → test alert kỷ niệm cưới
    (1008, N'Bui',     N'Thanh Hai',  N'HR',         '2022-02-14', '1993-12-01', N'Male',   N'Asian',     7,  N'Married',  '2020-07-10'),
    
    -- NV 9: Marketing, nữ, sắc tộc khác
    (1009, N'Nguyen',  N'Thi Ivy',    N'Marketing',  '2023-08-20', '1997-04-18', N'Female', N'Caucasian', 2,  N'Single',   NULL),
    
    -- NV 10: Operations, nam, sinh nhật tháng 6
    (1010, N'Truong',  N'Van Khanh',  N'Operations', '2014-06-28', '1987-06-28', N'Male',   N'Hispanic',  14, N'Married',  '2013-09-14');
GO

PRINT N'✅ HR_Legacy_DB - Đã chèn 10 bản ghi nhân viên mẫu.';
GO

-- ============================
-- DỮ LIỆU Payroll_Legacy_DB
-- ============================
USE Payroll_Legacy_DB;
GO

-- Xóa dữ liệu cũ (nếu chạy lại script)
DELETE FROM dbo.Payroll;
GO

-- Reset identity counter
DBCC CHECKIDENT ('dbo.Payroll', RESEED, 0);
GO

INSERT INTO dbo.Payroll 
    (Employee_ID, Current_Year_Income, Previous_Year_Income, Shareholder_Status, Employment_Type, Benefit_Plan)
VALUES
    -- NV 1001: IT, Full-time, thu nhập cao, cổ đông, gói Platinum
    (1001, 85000.00, 78000.00, 1, N'Full-time', N'Platinum'),
    
    -- NV 1002: HR, Full-time, thu nhập TB, non-shareholder, gói Gold
    (1002, 62000.00, 58000.00, 0, N'Full-time', N'Gold'),
    
    -- NV 1003: Finance, Full-time, thu nhập khá, non-shareholder, gói Standard
    (1003, 72000.00, 65000.00, 0, N'Full-time', N'Standard'),
    
    -- NV 1004: Marketing, Full-time, thu nhập TB, non-shareholder, gói Gold
    (1004, 55000.00, 50000.00, 0, N'Full-time', N'Gold'),
    
    -- NV 1005: Operations, Full-time, thu nhập cao, cổ đông, gói Platinum
    (1005, 90000.00, 88000.00, 1, N'Full-time', N'Platinum'),
    
    -- NV 1006: IT, Part-time, thu nhập thấp, non-shareholder, gói Standard
    (1006, 32000.00, 28000.00, 0, N'Part-time', N'Standard'),
    
    -- NV 1007: Finance, Full-time, thu nhập rất cao, cổ đông, gói Platinum
    (1007, 120000.00, 115000.00, 1, N'Full-time', N'Platinum'),
    
    -- NV 1008: HR, Full-time, thu nhập TB, non-shareholder, gói Standard
    (1008, 48000.00, 45000.00, 0, N'Full-time', N'Standard'),
    
    -- NV 1009: Marketing, Part-time, thu nhập thấp, non-shareholder, gói Standard
    (1009, 25000.00, 0.00, 0, N'Part-time', N'Standard'),
    
    -- NV 1010: Operations, Full-time, thu nhập cao, cổ đông, gói Gold
    (1010, 95000.00, 92000.00, 1, N'Full-time', N'Gold');
GO

PRINT N'✅ Payroll_Legacy_DB - Đã chèn 10 bản ghi lương mẫu.';
GO

-- ============================================================
-- KIỂM TRA NHANH: Hiển thị dữ liệu vừa chèn
-- ============================================================
USE HR_Legacy_DB;
SELECT '--- HR_Legacy_DB: Employees ---' AS Info;
SELECT * FROM dbo.Employees;
GO

USE Payroll_Legacy_DB;
SELECT '--- Payroll_Legacy_DB: Payroll ---' AS Info;
SELECT * FROM dbo.Payroll;
GO
