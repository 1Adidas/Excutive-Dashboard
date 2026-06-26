/**
 * ============================================================
 * EMPLOYEES ROUTES - API lọc nhân viên theo thu nhập & phòng ban
 * ============================================================
 * Endpoint: GET /api/employees/filter
 * 
 * Query params:
 *   - amount: Mức thu nhập ngưỡng của năm ngoái (bắt buộc)
 *   - department: Phòng ban cụ thể (tùy chọn)
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const integrationService = require('../services/integrationService');

/**
 * Bộ lọc: Nhân viên có thu nhập năm ngoái vượt quá mức [amount]
 * GET /api/employees/filter?amount=50000&department=IT
 */
router.get('/filter', async (req, res) => {
    try {
        const amountStr = req.query.amount;
        const department = req.query.department || null;

        let amount = null;
        if (amountStr) {
            amount = parseFloat(amountStr);
            if (isNaN(amount)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tham số amount phải là một số hợp lệ'
                });
            }
        }

        const options = {
            shareholder: req.query.shareholder || null,
            employmentType: req.query.employment_type || null,
            gender: req.query.gender || null,
            search: req.query.search || null
        };

        const filteredResult = await integrationService.filterEmployeesByIncome(amount, department, options);
        
        res.json({
            success: true,
            data: filteredResult,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi lọc nhân viên:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể lọc nhân viên',
            message: error.message
        });
    }
});

module.exports = router;
