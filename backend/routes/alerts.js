/**
 * ============================================================
 * ALERTS ROUTES - API 4 Cảnh báo Tự động
 * ============================================================
 * Endpoint 1: GET /api/alerts/anniversaries     → Kỷ niệm sắp đến
 * Endpoint 2: GET /api/alerts/vacation-excess    → Vượt ngày phép
 * Endpoint 3: GET /api/alerts/benefit-changes    → Thay đổi phúc lợi
 * Endpoint 4: GET /api/alerts/birthdays          → Sinh nhật tháng hiện tại
 * Endpoint 5: GET /api/alerts/all                → Tất cả cảnh báo (tổng hợp)
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const hrService = require('../services/hrService');
const integrationService = require('../services/integrationService');

// Đọc ngưỡng từ biến môi trường
const MAX_VACATION_DAYS = parseInt(process.env.MAX_VACATION_DAYS) || 15;
const ANNIVERSARY_ALERT_DAYS = parseInt(process.env.ANNIVERSARY_ALERT_DAYS) || 30;

/**
 * CẢNH BÁO 1: Nhân viên sắp đến ngày kỷ niệm tuyển dụng/cưới
 * GET /api/alerts/anniversaries?daysAhead=30
 */
router.get('/anniversaries', async (req, res) => {
    try {
        const daysAhead = parseInt(req.query.daysAhead) || ANNIVERSARY_ALERT_DAYS;
        const data = await hrService.getUpcomingAnniversaries(daysAhead);
        
        const alerts = [];
        
        // Kỷ niệm tuyển dụng
        data.hireAnniversaries.forEach(emp => {
            alerts.push({
                type: 'hire_anniversary',
                severity: 'info',
                icon: '🎉',
                title: `Kỷ niệm ${emp.Years_Of_Service} năm làm việc`,
                employee: `${emp.First_Name} ${emp.Last_Name}`,
                employee_id: emp.Employee_ID,
                department: emp.Department,
                date: emp.Next_Anniversary,
                original_date: emp.Hire_Date,
                message: `${emp.First_Name} ${emp.Last_Name} (${emp.Department}) sắp kỷ niệm ${emp.Years_Of_Service} năm làm việc`
            });
        });

        // Kỷ niệm ngày cưới
        data.weddingAnniversaries.forEach(emp => {
            alerts.push({
                type: 'wedding_anniversary',
                severity: 'info',
                icon: '💍',
                title: `Kỷ niệm ${emp.Years_Married} năm ngày cưới`,
                employee: `${emp.First_Name} ${emp.Last_Name}`,
                employee_id: emp.Employee_ID,
                department: emp.Department,
                date: emp.Next_Anniversary,
                original_date: emp.Wedding_Anniversary,
                message: `${emp.First_Name} ${emp.Last_Name} (${emp.Department}) sắp kỷ niệm ${emp.Years_Married} năm ngày cưới`
            });
        });

        res.json({
            success: true,
            data: {
                alert_type: 'Kỷ niệm sắp đến',
                days_ahead: daysAhead,
                total_alerts: alerts.length,
                alerts
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cảnh báo kỷ niệm:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * CẢNH BÁO 2: Nhân viên tích lũy ngày nghỉ phép vượt quá mức quy định
 * GET /api/alerts/vacation-excess?maxDays=15
 */
router.get('/vacation-excess', async (req, res) => {
    try {
        const maxDays = parseInt(req.query.maxDays) || MAX_VACATION_DAYS;
        const employees = await hrService.getEmployeesExceedingVacation(maxDays);

        const alerts = employees.map(emp => ({
            type: 'vacation_excess',
            severity: emp.Vacation_Days_Used > maxDays + 5 ? 'critical' : 'warning',
            icon: '⚠️',
            title: `Vượt ${emp.Vacation_Days_Used - maxDays} ngày phép`,
            employee: `${emp.First_Name} ${emp.Last_Name}`,
            employee_id: emp.Employee_ID,
            department: emp.Department,
            vacation_used: emp.Vacation_Days_Used,
            max_allowed: maxDays,
            excess_days: emp.Vacation_Days_Used - maxDays,
            message: `${emp.First_Name} ${emp.Last_Name} (${emp.Department}) đã sử dụng ${emp.Vacation_Days_Used}/${maxDays} ngày phép`
        }));

        res.json({
            success: true,
            data: {
                alert_type: 'Vượt ngày phép',
                max_vacation_days: maxDays,
                total_alerts: alerts.length,
                alerts
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cảnh báo ngày phép:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * CẢNH BÁO 3: Thay đổi gói phúc lợi ảnh hưởng bảng lương
 * GET /api/alerts/benefit-changes
 * 
 * Logic: So sánh thu nhập năm nay vs năm ngoái, kết hợp gói phúc lợi
 * Nếu chênh lệch thu nhập lớn (>10%) → có thể do thay đổi gói phúc lợi
 */
router.get('/benefit-changes', async (req, res) => {
    try {
        const merged = await integrationService.getMergedEmployeeData();
        
        const alerts = [];
        merged.forEach(emp => {
            if (emp.Previous_Year_Income > 0) {
                const changePercent = ((emp.Current_Year_Income - emp.Previous_Year_Income) / emp.Previous_Year_Income) * 100;
                
                // Cảnh báo nếu thay đổi > 10% — có thể do thay đổi phúc lợi
                if (Math.abs(changePercent) > 10) {
                    alerts.push({
                        type: 'benefit_change',
                        severity: Math.abs(changePercent) > 20 ? 'critical' : 'warning',
                        icon: '📊',
                        title: `Thay đổi thu nhập ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`,
                        employee: emp.Full_Name,
                        employee_id: emp.Employee_ID,
                        department: emp.Department,
                        benefit_plan: emp.Benefit_Plan,
                        current_income: emp.Current_Year_Income,
                        previous_income: emp.Previous_Year_Income,
                        change_percent: parseFloat(changePercent.toFixed(1)),
                        message: `${emp.Full_Name} (${emp.Department}): Thu nhập thay đổi ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% — Gói ${emp.Benefit_Plan}`
                    });
                }
            }
        });

        // Sắp xếp theo mức thay đổi lớn nhất
        alerts.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));

        res.json({
            success: true,
            data: {
                alert_type: 'Thay đổi phúc lợi/lương',
                threshold: '±10% thu nhập',
                total_alerts: alerts.length,
                alerts
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cảnh báo phúc lợi:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * CẢNH BÁO 4: Danh sách nhân viên có sinh nhật trong tháng hiện tại
 * GET /api/alerts/birthdays?month=6
 */
router.get('/birthdays', async (req, res) => {
    try {
        const currentMonth = parseInt(req.query.month) || new Date().getMonth() + 1;
        const employees = await hrService.getEmployeesByBirthdayMonth(currentMonth);

        const monthNames = [
            '', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
            'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
        ];

        const alerts = employees.map(emp => {
            const birthDate = new Date(emp.Date_of_Birth);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            
            return {
                type: 'birthday',
                severity: 'info',
                icon: '🎂',
                title: `Sinh nhật ${emp.First_Name} ${emp.Last_Name}`,
                employee: `${emp.First_Name} ${emp.Last_Name}`,
                employee_id: emp.Employee_ID,
                department: emp.Department,
                date_of_birth: emp.Date_of_Birth,
                birthday_day: birthDate.getDate(),
                turning_age: age,
                message: `${emp.First_Name} ${emp.Last_Name} (${emp.Department}) — Ngày ${birthDate.getDate()} ${monthNames[currentMonth]}`
            };
        });

        res.json({
            success: true,
            data: {
                alert_type: `Sinh nhật ${monthNames[currentMonth]}`,
                month: currentMonth,
                month_name: monthNames[currentMonth],
                total_birthdays: alerts.length,
                alerts
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi cảnh báo sinh nhật:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * TỔNG HỢP TẤT CẢ CẢNH BÁO
 * GET /api/alerts/all
 */
router.get('/all', async (req, res) => {
    try {
        const currentMonth = new Date().getMonth() + 1;

        // Gọi song song tất cả cảnh báo
        const [anniversaries, vacationExcess, benefitChanges, birthdays] = await Promise.all([
            hrService.getUpcomingAnniversaries(ANNIVERSARY_ALERT_DAYS),
            hrService.getEmployeesExceedingVacation(MAX_VACATION_DAYS),
            integrationService.getMergedEmployeeData(),
            hrService.getEmployeesByBirthdayMonth(currentMonth)
        ]);

        // Xử lý benefit changes
        const benefitAlerts = [];
        benefitChanges.forEach(emp => {
            if (emp.Previous_Year_Income > 0) {
                const changePercent = ((emp.Current_Year_Income - emp.Previous_Year_Income) / emp.Previous_Year_Income) * 100;
                if (Math.abs(changePercent) > 10) {
                    benefitAlerts.push({
                        type: 'benefit_change',
                        severity: Math.abs(changePercent) > 20 ? 'critical' : 'warning',
                        icon: '📊',
                        employee: emp.Full_Name,
                        employee_id: emp.Employee_ID,
                        department: emp.Department,
                        message: `Thu nhập thay đổi ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`
                    });
                }
            }
        });

        const totalAlerts = anniversaries.hireAnniversaries.length + 
                          anniversaries.weddingAnniversaries.length + 
                          vacationExcess.length + 
                          benefitAlerts.length + 
                          birthdays.length;

        res.json({
            success: true,
            data: {
                total_alerts: totalAlerts,
                summary: {
                    anniversaries: anniversaries.hireAnniversaries.length + anniversaries.weddingAnniversaries.length,
                    vacation_excess: vacationExcess.length,
                    benefit_changes: benefitAlerts.length,
                    birthdays: birthdays.length
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Lỗi tổng hợp cảnh báo:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
