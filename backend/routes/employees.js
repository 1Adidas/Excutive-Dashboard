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

/**
 * Thêm mới nhân viên tích hợp (HR & Payroll)
 * POST /api/employees
 */
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        if (!data.Employee_ID || !data.First_Name || !data.Last_Name || !data.Department || !data.Hire_Date || !data.Date_of_Birth) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu thông tin nhân sự bắt buộc'
            });
        }

        // Thực hiện ghi thông qua dịch vụ tích hợp
        await integrationService.createIntegratedEmployee(data);

        // Phát tín hiệu cập nhật qua SSE
        const broadcastUpdate = req.app.get('broadcastUpdate');
        if (broadcastUpdate) {
            broadcastUpdate('create_employee', { Employee_ID: parseInt(data.Employee_ID) });
        }

        res.status(201).json({
            success: true,
            message: `Thêm nhân sự mới #${data.Employee_ID} thành công.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi thêm nhân sự:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể thêm nhân sự mới',
            message: error.message
        });
    }
});

/**
 * Cập nhật thông tin nhân sự
 * PUT /api/employees/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const employeeId = parseInt(req.params.id);
        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                error: 'Mã nhân viên không hợp lệ'
            });
        }

        // Thực hiện cập nhật
        await integrationService.updateIntegratedEmployee(employeeId, req.body);

        // Phát tín hiệu cập nhật qua SSE
        const broadcastUpdate = req.app.get('broadcastUpdate');
        if (broadcastUpdate) {
            broadcastUpdate('update_employee', { Employee_ID: employeeId });
        }

        res.json({
            success: true,
            message: `Cập nhật nhân viên #${employeeId} thành công.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cập nhật nhân sự:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể cập nhật thông tin nhân sự',
            message: error.message
        });
    }
});

/**
 * Xóa nhân viên khỏi cả 2 DB
 * DELETE /api/employees/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const employeeId = parseInt(req.params.id);
        if (isNaN(employeeId)) {
            return res.status(400).json({
                success: false,
                error: 'Mã nhân viên không hợp lệ'
            });
        }

        // Thực hiện xóa
        await integrationService.deleteIntegratedEmployee(employeeId);

        // Phát tín hiệu cập nhật qua SSE
        const broadcastUpdate = req.app.get('broadcastUpdate');
        if (broadcastUpdate) {
            broadcastUpdate('delete_employee', { Employee_ID: employeeId });
        }

        res.json({
            success: true,
            message: `Xóa nhân viên #${employeeId} thành công.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi xóa nhân sự:', error.message);
        res.status(500).json({
            success: false,
            error: 'Không thể xóa nhân sự',
            message: error.message
        });
    }
});

module.exports = router;
