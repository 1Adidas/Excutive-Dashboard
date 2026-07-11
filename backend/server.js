/**
 * ============================================================
 * SERVER ENTRY POINT - server.js
 * ============================================================
 * Khởi tạo ứng dụng Express, kết nối hai CSDL Legacy và
 * định tuyến các API endpoints cho Dashboard.
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const { getHRPool, getPayrollPool, closePools } = require('./config/database');
const reportsRoutes = require('./routes/reports');
const alertsRoutes = require('./routes/alerts');
const employeesRoutes = require('./routes/employees');
const payrollRoutes = require('./routes/payroll');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Cho phép Frontend gọi API chéo cổng (CORS)
app.use(express.json());

// Phục vụ các file tĩnh của Frontend nếu cần chạy chung server
app.use(express.static('../frontend'));

// ============================================================
// REAL-TIME SYNCHRONIZATION VIA SERVER-SENT EVENTS (SSE)
// ============================================================
let sseClients = [];

app.get('/api/updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    console.log(`[SSE] Client mới kết nối. Tổng số client: ${sseClients.length}`);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
        console.log(`[SSE] Client đã ngắt kết nối. Tổng số client: ${sseClients.length}`);
    });
});

function broadcastUpdate(action, data) {
    console.log(`[SSE] Phát tín hiệu hành động: ${action} tới ${sseClients.length} clients`);
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'REFRESH', action, data })}\n\n`);
    });
}

app.set('broadcastUpdate', broadcastUpdate);

// Định tuyến API (API Routing)
app.use('/api/reports', reportsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/payroll', payrollRoutes);

// Endpoint kiểm tra trạng thái sức khỏe của API & DB
app.get('/api/health', async (req, res) => {
    let hrStatus = 'disconnected';
    let payrollStatus = 'disconnected';
    let errors = [];

    try {
        await getHRPool();
        hrStatus = 'connected';
    } catch (e) {
        errors.push(`HR DB: ${e.message}`);
    }

    try {
        await getPayrollPool();
        payrollStatus = 'connected';
    } catch (e) {
        errors.push(`Payroll DB: ${e.message}`);
    }

    res.json({
        status: errors.length === 0 ? 'healthy' : 'degraded',
        database: {
            hr_legacy_db: hrStatus,
            payroll_legacy_db: payrollStatus
        },
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
    });
});

// Middleware xử lý lỗi tập trung (Error Handler)
app.use((err, req, res, next) => {
    console.error('❌ Lỗi hệ thống:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Đã xảy ra lỗi hệ thống cục bộ',
        message: err.message
    });
});

// Khởi tạo các pool kết nối DB và Start Server
async function startServer() {
    console.log('🔄 Đang khởi tạo kết nối đến các hệ thống Database Legacy...');
    
    // Thử kết nối trước để cảnh báo người dùng nếu DB chưa chạy
    try {
        await getHRPool();
        console.log('✔ Kết nối thành công tới HR_Legacy_DB.');
    } catch (err) {
        console.warn('⚠️ CẢNH BÁO: Chưa thể kết nối tới HR_Legacy_DB. Hãy chắc chắn rằng SQL Server đã chạy và database đã được khởi tạo bằng SQL Scripts ở Giai đoạn 1.');
    }

    try {
        await getPayrollPool();
        console.log('✔ Kết nối thành công tới Payroll_Legacy_DB.');
    } catch (err) {
        console.warn('⚠️ CẢNH BÁO: Chưa thể kết nối tới Payroll_Legacy_DB. Hãy chắc chắn rằng SQL Server đã chạy và database đã được khởi tạo bằng SQL Scripts ở Giai đoạn 1.');
    }

    app.listen(PORT, () => {
        console.log(`\n============================================================`);
        console.log(`🚀 Executive Dashboard Server đang chạy tại: http://localhost:${PORT}`);
        console.log(`Health Check Endpoint: http://localhost:${PORT}/api/health`);
        console.log(`============================================================\n`);
    });
}

// Lắng nghe tín hiệu shutdown để đóng kết nối DB một cách an toàn (Graceful Shutdown)
process.on('SIGINT', async () => {
    console.log('\n🔄 Đang đóng máy chủ và dọn dẹp tài nguyên...');
    await closePools();
    process.exit(0);
});

startServer();
