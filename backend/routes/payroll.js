/**
 * ============================================================
 * PAYROLL ROUTES - API quản lý Lương & Phúc lợi
 * ============================================================
 * Endpoint: PUT /api/payroll/:id
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const integrationService = require('../services/integrationService');

/**
 * Cập nhật thông tin Lương & Phúc lợi cho một nhân viên
 * PUT /api/payroll/1001
 */
router.put('/:id', async (req, res) => {
    try {
        const employeeId = parseInt(req.params.id);
        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                error: 'Mã nhân viên phải là số hợp lệ'
            });
        }

        const data = {
            Current_Year_Income: req.body.Current_Year_Income !== undefined ? parseFloat(req.body.Current_Year_Income) : undefined,
            Previous_Year_Income: req.body.Previous_Year_Income !== undefined ? parseFloat(req.body.Previous_Year_Income) : undefined,
            Shareholder_Status: req.body.Shareholder_Status,
            Employment_Type: req.body.Employment_Type,
            Benefit_Plan: req.body.Benefit_Plan
        };

        // Thực hiện cập nhật qua tầng tích hợp
        await integrationService.updateIntegratedEmployee(employeeId, data);

        // Phát tín hiệu cập nhật thời gian thực qua Server-Sent Events (SSE)
        const broadcastUpdate = req.app.get('broadcastUpdate');
        if (broadcastUpdate) {
            broadcastUpdate('update_payroll', { Employee_ID: employeeId });
        }

        res.json({
            success: true,
            message: `Cập nhật thông tin lương nhân viên #${employeeId} thành công.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cập nhật lương:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể cập nhật thông tin lương',
            message: error.message
        });
    }
});

module.exports = router;
