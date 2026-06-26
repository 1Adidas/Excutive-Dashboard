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

module.exports = {
    getMergedEmployeeData,
    getIncomeReport,
    getVacationReport,
    getBenefitsReport,
    filterEmployeesByIncome
};
