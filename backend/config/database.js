/**
 * ============================================================
 * CẤU HÌNH KẾT NỐI DATABASE
 * ============================================================
 * Tạo 2 connection pool riêng biệt đến HR_Legacy_DB và Payroll_Legacy_DB.
 * 
 * NGUYÊN TẮC QUAN TRỌNG:
 * - Chỉ cấp quyền READ (SELECT) — tuân thủ ràng buộc hộp đen
 * - Không tạo trigger, stored procedure, hay thay đổi schema trên 2 DB cũ
 * - Sử dụng Windows Authentication (Trusted Connection) mặc định
 * ============================================================
 */

const sql = require('mssql');
require('dotenv').config();

const baseConfig = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || undefined,
    password: process.env.DB_PASSWORD || undefined,
    options: {
        encrypt: false,              // Không mã hóa cho local development
        trustServerCertificate: true, // Tin tưởng cert tự ký (local)
        enableArithAbort: true,
        connectTimeout: 30000,       // Timeout kết nối: 30 giây
        requestTimeout: 30000        // Timeout truy vấn: 30 giây
    },
    pool: {
        max: 10,                     // Tối đa 10 kết nối mỗi pool
        min: 0,
        idleTimeoutMillis: 30000     // Đóng kết nối idle sau 30 giây
    }
};

// ========================
// Cấu hình HR_Legacy_DB (Read-Only)
// ========================
const hrConfig = {
    ...baseConfig,
    database: process.env.HR_DB_NAME || 'HR_Legacy_DB',
};

// ========================
// Cấu hình Payroll_Legacy_DB (Read-Only)
// ========================
const payrollConfig = {
    ...baseConfig,
    database: process.env.PAYROLL_DB_NAME || 'Payroll_Legacy_DB',
};

// ========================
// Quản lý Connection Pools
// ========================
let hrPool = null;
let payrollPool = null;

/**
 * Kết nối đến HR_Legacy_DB
 * @returns {Promise<sql.ConnectionPool>} Connection pool đến HR DB
 */
async function getHRPool() {
    if (!hrPool) {
        try {
            hrPool = await new sql.ConnectionPool(hrConfig).connect();
            console.log('Đã kết nối HR_Legacy_DB (Read-Only)');
        } catch (err) {
            console.error('Lỗi kết nối HR_Legacy_DB:', err.message);
            throw err;
        }
    }
    return hrPool;
}

/**
 * Kết nối đến Payroll_Legacy_DB
 * @returns {Promise<sql.ConnectionPool>} Connection pool đến Payroll DB
 */
async function getPayrollPool() {
    if (!payrollPool) {
        try {
            payrollPool = await new sql.ConnectionPool(payrollConfig).connect();
            console.log('Đã kết nối Payroll_Legacy_DB (Read-Only)');
        } catch (err) {
            console.error('Lỗi kết nối Payroll_Legacy_DB:', err.message);
            throw err;
        }
    }
    return payrollPool;
}

/**
 * Đóng tất cả connection pools (gọi khi shutdown server)
 */
async function closePools() {
    if (hrPool) {
        await hrPool.close();
        hrPool = null;
        console.log('Đã đóng kết nối HR_Legacy_DB');
    }
    if (payrollPool) {
        await payrollPool.close();
        payrollPool = null;
        console.log('🔌 Đã đóng kết nối Payroll_Legacy_DB');
    }
}

module.exports = {
    sql,
    getHRPool,
    getPayrollPool,
    closePools
};
