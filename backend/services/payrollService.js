/**
 * ============================================================
 * PAYROLL SERVICE - Tầng truy vấn Payroll_Legacy_DB
 * ============================================================
 * Chỉ thực hiện truy vấn SELECT (Read-Only) trên Payroll_Legacy_DB.
 * KHÔNG chỉnh sửa, thêm, xóa dữ liệu trên hệ thống cũ.
 * ============================================================
 */

const { getPayrollPool, sql } = require('../config/database');

/**
 * Lấy toàn bộ dữ liệu lương
 * @returns {Promise<Array>} Danh sách bản ghi lương
 */
async function getAllPayroll() {
    const pool = await getPayrollPool();
    const result = await pool.request().query(`
        SELECT 
            Payroll_ID,
            Employee_ID,
            Current_Year_Income,
            Previous_Year_Income,
            Shareholder_Status,
            Employment_Type,
            Benefit_Plan
        FROM dbo.Payroll
        ORDER BY Employee_ID
    `);
    return result.recordset;
}

/**
 * Lấy thông tin lương theo Employee_ID
 * @param {number} employeeId - Mã nhân viên
 * @returns {Promise<Object|null>}
 */
async function getPayrollByEmployeeId(employeeId) {
    const pool = await getPayrollPool();
    const result = await pool.request()
        .input('employeeId', sql.Int, employeeId)
        .query(`
            SELECT * FROM dbo.Payroll 
            WHERE Employee_ID = @employeeId
        `);
    return result.recordset[0] || null;
}

/**
 * Lấy nhân viên có thu nhập năm ngoái vượt ngưỡng
 * @param {number} amount - Ngưỡng thu nhập
 * @returns {Promise<Array>}
 */
async function getEmployeesAboveIncome(amount) {
    const pool = await getPayrollPool();
    const result = await pool.request()
        .input('amount', sql.Decimal(15, 2), amount)
        .query(`
            SELECT 
                Employee_ID,
                Current_Year_Income,
                Previous_Year_Income,
                Shareholder_Status,
                Employment_Type,
                Benefit_Plan
            FROM dbo.Payroll
            WHERE Previous_Year_Income > @amount
            ORDER BY Previous_Year_Income DESC
        `);
    return result.recordset;
}

/**
 * Thống kê thu nhập theo Employee_ID (để JOIN với HR ở tầng ứng dụng)
 * @returns {Promise<Array>}
 */
async function getIncomeStats() {
    const pool = await getPayrollPool();
    const result = await pool.request().query(`
        SELECT 
            Employee_ID,
            Current_Year_Income,
            Previous_Year_Income,
            Shareholder_Status,
            Employment_Type,
            Benefit_Plan
        FROM dbo.Payroll
        ORDER BY Employee_ID
    `);
    return result.recordset;
}

/**
 * Thống kê phúc lợi theo gói và trạng thái cổ đông
 * @returns {Promise<Array>}
 */
async function getBenefitStats() {
    const pool = await getPayrollPool();
    const result = await pool.request().query(`
        SELECT 
            Benefit_Plan,
            Shareholder_Status,
            COUNT(*) AS Employee_Count,
            AVG(Current_Year_Income) AS Avg_Current_Income,
            SUM(Current_Year_Income) AS Total_Current_Income
        FROM dbo.Payroll
        GROUP BY Benefit_Plan, Shareholder_Status
        ORDER BY Benefit_Plan, Shareholder_Status
    `);
    return result.recordset;
}

/**
 * Thêm mới bản ghi lương (khi thêm nhân viên mới)
 * @param {Object} payroll - Dữ liệu lương
 */
async function createPayroll(payroll) {
    const pool = await getPayrollPool();
    await pool.request()
        .input('Employee_ID', sql.Int, payroll.Employee_ID)
        .input('Current_Year_Income', sql.Decimal(15, 2), payroll.Current_Year_Income || 0)
        .input('Previous_Year_Income', sql.Decimal(15, 2), payroll.Previous_Year_Income || 0)
        .input('Shareholder_Status', sql.Bit, payroll.Shareholder_Status ? 1 : 0)
        .input('Employment_Type', sql.NVarChar(20), payroll.Employment_Type || 'Full-time')
        .input('Benefit_Plan', sql.NVarChar(50), payroll.Benefit_Plan || 'Standard')
        .query(`
            INSERT INTO dbo.Payroll (
                Employee_ID, Current_Year_Income, Previous_Year_Income, 
                Shareholder_Status, Employment_Type, Benefit_Plan
            ) VALUES (
                @Employee_ID, @Current_Year_Income, @Previous_Year_Income, 
                @Shareholder_Status, @Employment_Type, @Benefit_Plan
            )
        `);
}

/**
 * Cập nhật thông tin lương
 * @param {number} employeeId - ID nhân viên
 * @param {Object} payroll - Dữ liệu cập nhật
 */
async function updatePayroll(employeeId, payroll) {
    const pool = await getPayrollPool();
    await pool.request()
        .input('Employee_ID', sql.Int, employeeId)
        .input('Current_Year_Income', sql.Decimal(15, 2), payroll.Current_Year_Income)
        .input('Previous_Year_Income', sql.Decimal(15, 2), payroll.Previous_Year_Income)
        .input('Shareholder_Status', sql.Bit, payroll.Shareholder_Status ? 1 : 0)
        .input('Employment_Type', sql.NVarChar(20), payroll.Employment_Type)
        .input('Benefit_Plan', sql.NVarChar(50), payroll.Benefit_Plan)
        .query(`
            UPDATE dbo.Payroll
            SET 
                Current_Year_Income = @Current_Year_Income,
                Previous_Year_Income = @Previous_Year_Income,
                Shareholder_Status = @Shareholder_Status,
                Employment_Type = @Employment_Type,
                Benefit_Plan = @Benefit_Plan
            WHERE Employee_ID = @Employee_ID
        `);
}

/**
 * Xóa bản ghi lương
 * @param {number} employeeId - ID nhân viên
 */
async function deletePayroll(employeeId) {
    const pool = await getPayrollPool();
    await pool.request()
        .input('Employee_ID', sql.Int, employeeId)
        .query(`
            DELETE FROM dbo.Payroll
            WHERE Employee_ID = @Employee_ID
        `);
}

module.exports = {
    getAllPayroll,
    getPayrollByEmployeeId,
    getEmployeesAboveIncome,
    getIncomeStats,
    getBenefitStats,
    createPayroll,
    updatePayroll,
    deletePayroll
};
