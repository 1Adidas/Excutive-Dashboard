/**
 * ============================================================
 * HR SERVICE - Tầng truy vấn HR_Legacy_DB
 * ============================================================
 * Chỉ thực hiện truy vấn SELECT (Read-Only) trên HR_Legacy_DB.
 * KHÔNG chỉnh sửa, thêm, xóa dữ liệu trên hệ thống cũ.
 * ============================================================
 */

const { getHRPool } = require('../config/database');

/**
 * Lấy toàn bộ danh sách nhân viên
 * @returns {Promise<Array>} Danh sách nhân viên từ HR DB
 */
async function getAllEmployees() {
    const pool = await getHRPool();
    const result = await pool.request().query(`
        SELECT 
            Employee_ID,
            First_Name,
            Last_Name,
            Department,
            Hire_Date,
            Date_of_Birth,
            Gender,
            Ethnicity,
            Vacation_Days_Used,
            Marital_Status,
            Wedding_Anniversary
        FROM dbo.Employees
        ORDER BY Employee_ID
    `);
    return result.recordset;
}

/**
 * Lấy nhân viên theo phòng ban
 * @param {string} department - Tên phòng ban
 * @returns {Promise<Array>}
 */
async function getEmployeesByDepartment(department) {
    const pool = await getHRPool();
    const result = await pool.request()
        .input('department', department)
        .query(`
            SELECT * FROM dbo.Employees 
            WHERE Department = @department
            ORDER BY Employee_ID
        `);
    return result.recordset;
}

/**
 * Lấy danh sách nhân viên có sinh nhật trong tháng chỉ định
 * @param {number} month - Tháng (1-12)
 * @returns {Promise<Array>}
 */
async function getEmployeesByBirthdayMonth(month) {
    const pool = await getHRPool();
    const result = await pool.request()
        .input('month', month)
        .query(`
            SELECT 
                Employee_ID,
                First_Name,
                Last_Name,
                Department,
                Date_of_Birth,
                Gender
            FROM dbo.Employees
            WHERE MONTH(Date_of_Birth) = @month
            ORDER BY DAY(Date_of_Birth)
        `);
    return result.recordset;
}

/**
 * Lấy nhân viên có số ngày phép vượt ngưỡng
 * @param {number} maxDays - Ngưỡng ngày phép tối đa
 * @returns {Promise<Array>}
 */
async function getEmployeesExceedingVacation(maxDays) {
    const pool = await getHRPool();
    const result = await pool.request()
        .input('maxDays', maxDays)
        .query(`
            SELECT 
                Employee_ID,
                First_Name,
                Last_Name,
                Department,
                Vacation_Days_Used
            FROM dbo.Employees
            WHERE Vacation_Days_Used > @maxDays
            ORDER BY Vacation_Days_Used DESC
        `);
    return result.recordset;
}

/**
 * Lấy nhân viên sắp đến ngày kỷ niệm (tuyển dụng hoặc cưới)
 * @param {number} daysAhead - Số ngày trước kỷ niệm để cảnh báo
 * @returns {Promise<Object>} { hireAnniversaries, weddingAnniversaries }
 */
async function getUpcomingAnniversaries(daysAhead) {
    const pool = await getHRPool();
    
    // Kỷ niệm ngày tuyển dụng
    const hireResult = await pool.request()
        .input('daysAhead', daysAhead)
        .query(`
            SELECT 
                Employee_ID,
                First_Name,
                Last_Name,
                Department,
                Hire_Date,
                DATEDIFF(YEAR, Hire_Date, GETDATE()) AS Years_Of_Service,
                DATEADD(YEAR, DATEDIFF(YEAR, Hire_Date, GETDATE()) + 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, Hire_Date, GETDATE()), Hire_Date) < GETDATE() 
                         THEN 1 ELSE 0 END, 
                    Hire_Date) AS Next_Anniversary
            FROM dbo.Employees
            WHERE DATEDIFF(DAY, GETDATE(), 
                  DATEADD(YEAR, DATEDIFF(YEAR, Hire_Date, GETDATE()) + 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, Hire_Date, GETDATE()), Hire_Date) < GETDATE() 
                         THEN 1 ELSE 0 END, 
                    Hire_Date)) BETWEEN 0 AND @daysAhead
            ORDER BY Next_Anniversary
        `);

    // Kỷ niệm ngày cưới
    const weddingResult = await pool.request()
        .input('daysAhead', daysAhead)
        .query(`
            SELECT 
                Employee_ID,
                First_Name,
                Last_Name,
                Department,
                Wedding_Anniversary,
                DATEDIFF(YEAR, Wedding_Anniversary, GETDATE()) AS Years_Married,
                DATEADD(YEAR, DATEDIFF(YEAR, Wedding_Anniversary, GETDATE()) + 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, Wedding_Anniversary, GETDATE()), Wedding_Anniversary) < GETDATE() 
                         THEN 1 ELSE 0 END, 
                    Wedding_Anniversary) AS Next_Anniversary
            FROM dbo.Employees
            WHERE Wedding_Anniversary IS NOT NULL
              AND DATEDIFF(DAY, GETDATE(), 
                  DATEADD(YEAR, DATEDIFF(YEAR, Wedding_Anniversary, GETDATE()) + 
                    CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, Wedding_Anniversary, GETDATE()), Wedding_Anniversary) < GETDATE() 
                         THEN 1 ELSE 0 END, 
                    Wedding_Anniversary)) BETWEEN 0 AND @daysAhead
            ORDER BY Next_Anniversary
        `);

    return {
        hireAnniversaries: hireResult.recordset,
        weddingAnniversaries: weddingResult.recordset
    };
}

/**
 * Thống kê ngày phép theo phòng ban
 * @returns {Promise<Array>}
 */
async function getVacationStatsByDepartment() {
    const pool = await getHRPool();
    const result = await pool.request().query(`
        SELECT 
            Department,
            Gender,
            Ethnicity,
            SUM(Vacation_Days_Used) AS Total_Vacation_Days,
            AVG(Vacation_Days_Used) AS Avg_Vacation_Days,
            COUNT(*) AS Employee_Count
        FROM dbo.Employees
        GROUP BY Department, Gender, Ethnicity
        ORDER BY Department, Gender
    `);
    return result.recordset;
}

module.exports = {
    getAllEmployees,
    getEmployeesByDepartment,
    getEmployeesByBirthdayMonth,
    getEmployeesExceedingVacation,
    getUpcomingAnniversaries,
    getVacationStatsByDepartment
};
