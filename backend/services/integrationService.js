/**
 * ============================================================
 * INTEGRATION SERVICE - Tầng tích hợp dữ liệu
 * ============================================================
 * ĐÂY LÀ CORE CỦA PRESENTATION-STYLE INTEGRATION:
 * 
 * 1. Query SONG SONG vào 2 DB (Promise.all) → tối ưu hiệu năng
 * 2. JOIN dữ liệu bằng Employee_ID TẠI TẦNG ỨNG DỤNG (JavaScript)
 * 3. Aggregate (GROUP BY, SUM, AVG) tại code → không tạo view/SP trên DB cũ
 * 4. Trả JSON cho API routes → Frontend render
 * 
 * NGUYÊN TẮC: Không tạo cross-database query, không tạo linked server,
 *             mọi logic JOIN đều xảy ra ở tầng code.
 * ============================================================
 */

const hrService = require('./hrService');
const payrollService = require('./payrollService');

/**
 * Gộp dữ liệu HR + Payroll bằng Employee_ID ở tầng ứng dụng
 * Đây là phương pháp Presentation-style Integration:
 * - Đọc song song từ 2 DB
 * - JOIN dữ liệu trong memory bằng JavaScript
 * @returns {Promise<Array>} Dữ liệu đã gộp
 */
async function getMergedEmployeeData() {
    // Query SONG SONG vào 2 DB — tối ưu thời gian chờ
    const [employees, payrolls] = await Promise.all([
        hrService.getAllEmployees(),
        payrollService.getAllPayroll()
    ]);

    // Tạo Map từ Payroll data để lookup nhanh O(1)
    const payrollMap = new Map();
    payrolls.forEach(p => payrollMap.set(p.Employee_ID, p));

    // JOIN dữ liệu tại tầng ứng dụng (Application-level JOIN)
    const merged = employees.map(emp => {
        const payroll = payrollMap.get(emp.Employee_ID) || {};
        return {
            Employee_ID: emp.Employee_ID,
            First_Name: emp.First_Name,
            Last_Name: emp.Last_Name,
            Full_Name: `${emp.First_Name} ${emp.Last_Name}`,
            Department: emp.Department,
            Hire_Date: emp.Hire_Date,
            Date_of_Birth: emp.Date_of_Birth,
            Gender: emp.Gender,
            Ethnicity: emp.Ethnicity,
            Vacation_Days_Used: emp.Vacation_Days_Used,
            Marital_Status: emp.Marital_Status,
            Wedding_Anniversary: emp.Wedding_Anniversary,
            // --- Dữ liệu từ Payroll DB ---
            Current_Year_Income: payroll.Current_Year_Income || 0,
            Previous_Year_Income: payroll.Previous_Year_Income || 0,
            Shareholder_Status: payroll.Shareholder_Status ? 'Shareholder' : 'Non-Shareholder',
            Employment_Type: payroll.Employment_Type || 'N/A',
            Benefit_Plan: payroll.Benefit_Plan || 'N/A'
        };
    });

    return merged;
}

// ============================================================
// BÁO CÁO 1: Tổng thu nhập (phân loại theo nhiều tiêu chí)
// ============================================================

/**
 * Báo cáo tổng thu nhập với drill-down theo phòng ban, cổ đông, giới tính, sắc tộc, loại hình
 * @param {string} [groupBy] - Tiêu chí phân loại: department, shareholder, gender, ethnicity, employment_type
 * @returns {Promise<Object>} { summary, details }
 */
async function getIncomeReport(groupBy = 'department') {
    const merged = await getMergedEmployeeData();

    // Tổng hợp chung
    const summary = {
        total_current_income: merged.reduce((sum, e) => sum + e.Current_Year_Income, 0),
        total_previous_income: merged.reduce((sum, e) => sum + e.Previous_Year_Income, 0),
        total_employees: merged.length,
        avg_current_income: merged.reduce((sum, e) => sum + e.Current_Year_Income, 0) / merged.length,
        avg_previous_income: merged.reduce((sum, e) => sum + e.Previous_Year_Income, 0) / merged.length
    };

    // Phân loại theo tiêu chí
    const groupKeyMap = {
        department: 'Department',
        shareholder: 'Shareholder_Status',
        gender: 'Gender',
        ethnicity: 'Ethnicity',
        employment_type: 'Employment_Type'
    };

    const key = groupKeyMap[groupBy] || 'Department';
    const grouped = {};

    merged.forEach(emp => {
        const group = emp[key];
        if (!grouped[group]) {
            grouped[group] = {
                group_name: group,
                total_current_income: 0,
                total_previous_income: 0,
                employee_count: 0,
                employees: []
            };
        }
        grouped[group].total_current_income += emp.Current_Year_Income;
        grouped[group].total_previous_income += emp.Previous_Year_Income;
        grouped[group].employee_count += 1;
        grouped[group].employees.push(emp);
    });

    // Tính trung bình cho mỗi nhóm
    Object.values(grouped).forEach(g => {
        g.avg_current_income = g.total_current_income / g.employee_count;
        g.avg_previous_income = g.total_previous_income / g.employee_count;
    });

    return {
        report_name: 'Báo cáo Tổng Thu nhập',
        group_by: groupBy,
        summary,
        details: Object.values(grouped)
    };
}

// ============================================================
// BÁO CÁO 2: Tổng ngày nghỉ phép (phân loại theo nhiều tiêu chí)
// ============================================================

/**
 * Báo cáo ngày nghỉ phép với drill-down
 * @param {string} [groupBy] - Tiêu chí phân loại
 * @returns {Promise<Object>}
 */
async function getVacationReport(groupBy = 'department') {
    const merged = await getMergedEmployeeData();

    const summary = {
        total_vacation_days: merged.reduce((sum, e) => sum + e.Vacation_Days_Used, 0),
        avg_vacation_days: merged.reduce((sum, e) => sum + e.Vacation_Days_Used, 0) / merged.length,
        total_employees: merged.length
    };

    const groupKeyMap = {
        department: 'Department',
        shareholder: 'Shareholder_Status',
        gender: 'Gender',
        ethnicity: 'Ethnicity',
        employment_type: 'Employment_Type'
    };

    const key = groupKeyMap[groupBy] || 'Department';
    const grouped = {};

    merged.forEach(emp => {
        const group = emp[key];
        if (!grouped[group]) {
            grouped[group] = {
                group_name: group,
                total_vacation_days: 0,
                employee_count: 0,
                employees: []
            };
        }
        grouped[group].total_vacation_days += emp.Vacation_Days_Used;
        grouped[group].employee_count += 1;
        grouped[group].employees.push({
            Employee_ID: emp.Employee_ID,
            Full_Name: emp.Full_Name,
            Department: emp.Department,
            Vacation_Days_Used: emp.Vacation_Days_Used
        });
    });

    Object.values(grouped).forEach(g => {
        g.avg_vacation_days = g.total_vacation_days / g.employee_count;
    });

    return {
        report_name: 'Báo cáo Ngày nghỉ phép',
        group_by: groupBy,
        summary,
        details: Object.values(grouped)
    };
}

// ============================================================
// BÁO CÁO 3: Phúc lợi trung bình (cổ đông vs non-shareholder)
// ============================================================

/**
 * Báo cáo phúc lợi trung bình theo gói và trạng thái cổ đông
 * @returns {Promise<Object>}
 */
async function getBenefitsReport() {
    const merged = await getMergedEmployeeData();

    // Nhóm theo Benefit_Plan + Shareholder_Status
    const grouped = {};
    merged.forEach(emp => {
        const key = `${emp.Benefit_Plan}_${emp.Shareholder_Status}`;
        if (!grouped[key]) {
            grouped[key] = {
                benefit_plan: emp.Benefit_Plan,
                shareholder_status: emp.Shareholder_Status,
                total_income: 0,
                employee_count: 0,
                employees: []
            };
        }
        grouped[key].total_income += emp.Current_Year_Income;
        grouped[key].employee_count += 1;
        grouped[key].employees.push({
            Employee_ID: emp.Employee_ID,
            Full_Name: emp.Full_Name,
            Department: emp.Department,
            Current_Year_Income: emp.Current_Year_Income
        });
    });

    Object.values(grouped).forEach(g => {
        g.avg_income = g.total_income / g.employee_count;
    });

    // Tổng hợp theo gói phúc lợi
    const byPlan = {};
    Object.values(grouped).forEach(g => {
        if (!byPlan[g.benefit_plan]) {
            byPlan[g.benefit_plan] = { plan: g.benefit_plan, breakdowns: [] };
        }
        byPlan[g.benefit_plan].breakdowns.push(g);
    });

    return {
        report_name: 'Báo cáo Phúc lợi theo Gói & Cổ đông',
        details: Object.values(byPlan)
    };
}

// ============================================================
// BỘ LỌC: Nhân viên thu nhập vượt mức theo phòng ban
// ============================================================

/**
 * Lọc nhân viên có thu nhập năm ngoái vượt mức, phân loại theo phòng ban
 * @param {number} amount - Ngưỡng thu nhập
 * @param {string} [department] - Phòng ban cụ thể (tùy chọn)
 * @returns {Promise<Object>}
 */
async function filterEmployeesByIncome(amount, department = null, options = {}) {
    const merged = await getMergedEmployeeData();

    let filtered = merged;
    
    // Ngưỡng thu nhập năm ngoái
    if (amount !== null && amount !== undefined && !isNaN(amount)) {
        filtered = filtered.filter(e => e.Previous_Year_Income > amount);
    }
    
    // Lọc theo phòng ban
    if (department) {
        filtered = filtered.filter(e => e.Department.toLowerCase() === department.toLowerCase());
    }

    // Lọc theo cổ đông
    if (options.shareholder) {
        filtered = filtered.filter(e => e.Shareholder_Status.toLowerCase() === options.shareholder.toLowerCase());
    }

    // Lọc theo loại hình làm việc
    if (options.employmentType) {
        filtered = filtered.filter(e => e.Employment_Type.toLowerCase() === options.employmentType.toLowerCase());
    }

    // Lọc theo giới tính
    if (options.gender) {
        filtered = filtered.filter(e => e.Gender.toLowerCase() === options.gender.toLowerCase());
    }

    // Lọc theo từ khóa tìm kiếm (Tên hoặc ID)
    if (options.search) {
        const query = options.search.trim().toLowerCase();
        filtered = filtered.filter(e => 
            e.Full_Name.toLowerCase().includes(query) || 
            e.Employee_ID.toString().includes(query)
        );
    }

    // Nhóm theo phòng ban
    const byDept = {};
    filtered.forEach(emp => {
        if (!byDept[emp.Department]) {
            byDept[emp.Department] = {
                department: emp.Department,
                employee_count: 0,
                employees: []
            };
        }
        byDept[emp.Department].employee_count += 1;
        byDept[emp.Department].employees.push(emp); // Trả về đầy đủ đối tượng để hỗ trợ hiển thị chi tiết
    });

    return {
        filter_description: `Nhân viên thỏa mãn các bộ lọc của CEO`,
        threshold_amount: amount,
        total_matching: filtered.length,
        by_department: Object.values(byDept)
    };
}

/**
 * Thêm mới nhân sự tích hợp (Saga Pattern)
 * @param {Object} data - Dữ liệu gộp HR & Payroll
 */
async function createIntegratedEmployee(data) {
    const employeeId = parseInt(data.Employee_ID);
    if (isNaN(employeeId)) {
        throw new Error("Mã nhân viên phải là số hợp lệ.");
    }

    // 1. Thực hiện ghi vào HR_Legacy_DB
    try {
        await hrService.createEmployee({
            Employee_ID: employeeId,
            First_Name: data.First_Name,
            Last_Name: data.Last_Name,
            Department: data.Department,
            Hire_Date: data.Hire_Date,
            Date_of_Birth: data.Date_of_Birth,
            Gender: data.Gender,
            Ethnicity: data.Ethnicity,
            Vacation_Days_Used: parseInt(data.Vacation_Days_Used) || 0,
            Marital_Status: data.Marital_Status || 'Single',
            Wedding_Anniversary: data.Wedding_Anniversary || null
        });
        console.log(`[Saga] Bước 1 thành công: Ghi HR DB cho mã NV #${employeeId}`);
    } catch (err) {
        console.error(`[Saga] Bước 1 thất bại khi ghi HR DB:`, err.message);
        throw new Error(`Thất bại khi ghi thông tin HR: ${err.message}`);
    }

    // 2. Thực hiện ghi vào Payroll_Legacy_DB
    try {
        await payrollService.createPayroll({
            Employee_ID: employeeId,
            Current_Year_Income: parseFloat(data.Current_Year_Income) || 0,
            Previous_Year_Income: parseFloat(data.Previous_Year_Income) || 0,
            Shareholder_Status: data.Shareholder_Status === 'Shareholder' || data.Shareholder_Status === true || data.Shareholder_Status === 1 ? 1 : 0,
            Employment_Type: data.Employment_Type || 'Full-time',
            Benefit_Plan: data.Benefit_Plan || 'Standard'
        });
        console.log(`[Saga] Bước 2 thành công: Ghi Payroll DB cho mã NV #${employeeId}`);
    } catch (err) {
        console.warn(`[Saga] Bước 2 thất bại khi ghi Payroll DB! Tiến hành khôi phục trạng thái (Compensating Transaction)...`);
        
        // Giao dịch bù đắp: Xóa nhân viên vừa thêm ở HR DB
        try {
            await hrService.deleteEmployee(employeeId);
            console.log(`[Saga] Giao dịch bù đắp thành công: Đã xóa NV #${employeeId} khỏi HR DB.`);
        } catch (rollbackErr) {
            console.error(`[Saga ERROR] LỖI CỰC KỲ NGHIÊM TRỌNG: Không thể hoàn tác ghi HR DB cho NV #${employeeId}.`, rollbackErr.message);
        }
        
        throw new Error(`Thất bại khi ghi thông tin lương (Hệ thống đã khôi phục trạng thái cũ): ${err.message}`);
    }
}

/**
 * Cập nhật thông tin nhân sự tích hợp (Saga Pattern)
 * @param {number} employeeId 
 * @param {Object} data 
 */
async function updateIntegratedEmployee(employeeId, data) {
    // Để cập nhật, chúng ta cần backup trạng thái cũ đề phòng thất bại để rollback
    let oldEmployee = null;
    let oldPayroll = null;

    try {
        const poolHR = await hrService.getAllEmployees();
        const poolPay = await payrollService.getAllPayroll();
        
        const existingEmp = poolHR.find(e => e.Employee_ID === employeeId);
        const existingPay = poolPay.find(p => p.Employee_ID === employeeId);

        if (existingEmp) oldEmployee = { ...existingEmp };
        if (existingPay) oldPayroll = { ...existingPay };
    } catch (err) {
        throw new Error(`Không thể sao lưu dữ liệu cũ để cập nhật: ${err.message}`);
    }

    // 1. Cập nhật HR DB
    const currentEmp = oldEmployee || {};
    try {
        await hrService.updateEmployee(employeeId, {
            First_Name: data.First_Name !== undefined ? data.First_Name : currentEmp.First_Name,
            Last_Name: data.Last_Name !== undefined ? data.Last_Name : currentEmp.Last_Name,
            Department: data.Department !== undefined ? data.Department : currentEmp.Department,
            Hire_Date: data.Hire_Date !== undefined ? data.Hire_Date : currentEmp.Hire_Date,
            Date_of_Birth: data.Date_of_Birth !== undefined ? data.Date_of_Birth : currentEmp.Date_of_Birth,
            Gender: data.Gender !== undefined ? data.Gender : currentEmp.Gender,
            Ethnicity: data.Ethnicity !== undefined ? data.Ethnicity : currentEmp.Ethnicity,
            Vacation_Days_Used: data.Vacation_Days_Used !== undefined ? parseInt(data.Vacation_Days_Used) : currentEmp.Vacation_Days_Used,
            Marital_Status: data.Marital_Status !== undefined ? data.Marital_Status : currentEmp.Marital_Status,
            Wedding_Anniversary: data.Wedding_Anniversary !== undefined ? data.Wedding_Anniversary : currentEmp.Wedding_Anniversary
        });
        console.log(`[Saga Update] Bước 1 thành công: Cập nhật HR DB cho mã NV #${employeeId}`);
    } catch (err) {
        console.error(`[Saga Update] Bước 1 thất bại khi ghi HR DB:`, err.message);
        throw new Error(`Cập nhật thông tin nhân sự thất bại: ${err.message}`);
    }

    // 2. Cập nhật Payroll DB
    try {
        // Lấy thông tin lương hiện tại để đảm bảo các trường không sửa vẫn giữ nguyên
        const currentPayroll = oldPayroll || {};
        await payrollService.updatePayroll(employeeId, {
            Current_Year_Income: data.Current_Year_Income !== undefined ? parseFloat(data.Current_Year_Income) : currentPayroll.Current_Year_Income,
            Previous_Year_Income: data.Previous_Year_Income !== undefined ? parseFloat(data.Previous_Year_Income) : currentPayroll.Previous_Year_Income,
            Shareholder_Status: data.Shareholder_Status !== undefined ? (data.Shareholder_Status === 'Shareholder' || data.Shareholder_Status === true || data.Shareholder_Status === 1 ? 1 : 0) : currentPayroll.Shareholder_Status,
            Employment_Type: data.Employment_Type !== undefined ? data.Employment_Type : currentPayroll.Employment_Type,
            Benefit_Plan: data.Benefit_Plan !== undefined ? data.Benefit_Plan : currentPayroll.Benefit_Plan
        });
        console.log(`[Saga Update] Bước 2 thành công: Cập nhật Payroll DB cho mã NV #${employeeId}`);
    } catch (err) {
        console.warn(`[Saga Update] Bước 2 thất bại! Tiến hành khôi phục trạng thái cũ (Compensating Transaction)...`);
        
        // Hoàn tác bước 1: Ghi lại dữ liệu HR cũ
        if (oldEmployee) {
            try {
                await hrService.updateEmployee(employeeId, oldEmployee);
                console.log(`[Saga Update] Bù đắp thành công: Đã khôi phục dữ liệu HR cũ cho NV #${employeeId}.`);
            } catch (rollbackErr) {
                console.error(`[Saga Update ERROR] Không thể hoàn tác cập nhật HR cho NV #${employeeId}.`, rollbackErr.message);
            }
        }
        throw new Error(`Cập nhật thông tin lương thất bại (Hệ thống đã khôi phục trạng thái cũ): ${err.message}`);
    }
}

/**
 * Xóa nhân sự tích hợp (Saga Pattern)
 * @param {number} employeeId - ID nhân viên
 */
async function deleteIntegratedEmployee(employeeId) {
    // Lưu trữ dự phòng thông tin trước khi xóa
    let backupEmployee = null;
    let backupPayroll = null;

    try {
        const poolHR = await hrService.getAllEmployees();
        const poolPay = await payrollService.getAllPayroll();
        
        const existingEmp = poolHR.find(e => e.Employee_ID === employeeId);
        const existingPay = poolPay.find(p => p.Employee_ID === employeeId);

        if (existingEmp) backupEmployee = { ...existingEmp };
        if (existingPay) backupPayroll = { ...existingPay };
    } catch (err) {
        throw new Error(`Không thể sao lưu dữ liệu trước khi xóa: ${err.message}`);
    }

    // 1. Xóa Payroll DB trước
    try {
        if (backupPayroll) {
            await payrollService.deletePayroll(employeeId);
            console.log(`[Saga Delete] Bước 1 thành công: Xóa Payroll DB cho mã NV #${employeeId}`);
        }
    } catch (err) {
        console.error(`[Saga Delete] Bước 1 thất bại khi xóa Payroll DB:`, err.message);
        throw new Error(`Không thể xóa dữ liệu lương: ${err.message}`);
    }

    // 2. Xóa HR DB
    try {
        if (backupEmployee) {
            await hrService.deleteEmployee(employeeId);
            console.log(`[Saga Delete] Bước 2 thành công: Xóa HR DB cho mã NV #${employeeId}`);
        }
    } catch (err) {
        console.warn(`[Saga Delete] Bước 2 thất bại khi xóa HR DB! Tiến hành phục hồi Payroll (Compensating Transaction)...`);
        
        // Khôi phục lương cũ
        if (backupPayroll) {
            try {
                await payrollService.createPayroll(backupPayroll);
                console.log(`[Saga Delete] Bù đắp thành công: Đã khôi phục dữ liệu lương cũ cho NV #${employeeId}.`);
            } catch (rollbackErr) {
                console.error(`[Saga Delete ERROR] Không thể khôi phục dữ liệu lương cho NV #${employeeId}.`, rollbackErr.message);
            }
        }
        throw new Error(`Không thể xóa thông tin nhân viên (Hệ thống đã khôi phục trạng thái cũ): ${err.message}`);
    }
}

module.exports = {
    getMergedEmployeeData,
    getIncomeReport,
    getVacationReport,
    getBenefitsReport,
    filterEmployeesByIncome,
    createIntegratedEmployee,
    updateIntegratedEmployee,
    deleteIntegratedEmployee
};
