/**
 * ============================================================
 * REPORTS ROUTES - API 3 Báo cáo Tổng hợp
 * ============================================================
 * Endpoint 1: GET /api/reports/income    → Báo cáo thu nhập
 * Endpoint 2: GET /api/reports/vacation  → Báo cáo ngày phép
 * Endpoint 3: GET /api/reports/benefits  → Báo cáo phúc lợi
 * 
 * Tất cả đều hỗ trợ drill-down bằng query param ?groupBy=
 * Giá trị groupBy: department, shareholder, gender, ethnicity, employment_type
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const integrationService = require('../services/integrationService');

/**
 * BÁO CÁO 1: Tổng thu nhập tính đến nay và năm trước
 * GET /api/reports/income?groupBy=department
 * 
 * Query params:
 *   groupBy: department | shareholder | gender | ethnicity | employment_type
 */
router.get('/income', async (req, res) => {
    try {
        const groupBy = req.query.groupBy || 'department';
        const report = await integrationService.getIncomeReport(groupBy);
        res.json({
            success: true,
            data: report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi báo cáo thu nhập:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể tạo báo cáo thu nhập',
            message: error.message
        });
    }
});

/**
 * BÁO CÁO 2: Tổng số ngày nghỉ phép đã nghỉ
 * GET /api/reports/vacation?groupBy=department
 */
router.get('/vacation', async (req, res) => {
    try {
        const groupBy = req.query.groupBy || 'department';
        const report = await integrationService.getVacationReport(groupBy);
        res.json({
            success: true,
            data: report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi báo cáo ngày phép:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể tạo báo cáo ngày phép',
            message: error.message
        });
    }
});

/**
 * BÁO CÁO 3: Mức phúc lợi trung bình theo gói & cổ đông
 * GET /api/reports/benefits
 */
router.get('/benefits', async (req, res) => {
    try {
        const report = await integrationService.getBenefitsReport();
        res.json({
            success: true,
            data: report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi báo cáo phúc lợi:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể tạo báo cáo phúc lợi',
            message: error.message
        });
    }
});

module.exports = router;
