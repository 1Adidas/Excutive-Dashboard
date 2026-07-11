/**
 * ============================================================
 * MAIN APPLICATION LOGIC - app.js
 * ============================================================
 * Quản lý vòng đời ứng dụng, các sự kiện chuyển tab,
 * gọi API backend để lấy báo cáo/cảnh báo, và render dữ liệu.
 * ============================================================
 */

const API_BASE_URL = 'http://localhost:3000/api';

// Lưu trữ dữ liệu tải về để hỗ trợ Drill-down chi tiết tại chỗ
const appState = {
    incomeReport: null,
    vacationReport: null,
    benefitsReport: null,
    alerts: [],
    employees: [] // Danh sách nhân sự gộp tải trước
};

// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

/**
 * Khởi tạo ứng dụng
 */
async function initApp() {
    setupTabNavigation();
    setupEventListeners();
    setupSSESync(); // Thiết lập đồng bộ thời gian thực SSE
    
    // Khởi tạo các biểu đồ trống ban đầu
    initOverviewIncomeChart('incomeDeptChart');
    initOverviewVacationChart('vacationDeptChart');

    // Kiểm tra trạng thái hệ thống
    const isHealthy = await checkHealth();
    if (isHealthy) {
        loadDashboardData();
    } else {
        showConnectionError();
    }
}

/**
 * Điều hướng Tab Giao diện
 */
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');

            // Set active menu item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show active tab screen
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });

            // Gọi hàm render tương ứng khi chuyển tab
            onTabChanged(tabId);
        });
    });
}

/**
 * Thiết lập các Event Listener
 */
function setupEventListeners() {
    // Toggle Theme Sáng/Tối
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    // Tải cài đặt theme đã lưu
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.className = 'fa-solid fa-moon';
        setTimeout(() => {
            if (typeof toggleChartsTheme === 'function') toggleChartsTheme(true);
        }, 150);
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        
        if (typeof toggleChartsTheme === 'function') {
            toggleChartsTheme(isLight);
        }
    });

    // Nút làm mới cảnh báo
    document.getElementById('btn-refresh-alerts').addEventListener('click', loadAlertsData);

    // Sidebar Cảnh báo
    const alertTrigger = document.getElementById('alerts-trigger');
    const alertsSidebar = document.getElementById('alerts-sidebar');
    const alertsClose = document.getElementById('alerts-close');

    alertTrigger.addEventListener('click', () => {
        alertsSidebar.classList.add('open');
        renderAlertsSidebar();
    });

    alertsClose.addEventListener('click', () => {
        alertsSidebar.classList.remove('open');
    });

    // Sự kiện Thay đổi Bộ lọc Drill-down
    document.getElementById('income-groupby').addEventListener('change', loadIncomeReport);
    document.getElementById('vacation-groupby').addEventListener('change', loadVacationReport);

    // Nút áp dụng bộ lọc CEO
    document.getElementById('btn-submit-filter').addEventListener('click', () => {
        executeCEOFilter(API_BASE_URL);
    });

    // Đóng Modal chi tiết và Reset Trạng thái
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        const modal = document.getElementById('drilldown-modal');
        modal.style.display = 'none';
        
        // Reset modal layout
        document.getElementById('modal-table-view').style.display = 'block';
        const profileView = document.getElementById('modal-profile-view');
        profileView.style.display = 'none';
        profileView.removeAttribute('data-prev-title');
        
        const backBtn = modal.querySelector('.modal-back-btn');
        if (backBtn) backBtn.remove();
    });

    // Clickable KPI Cards chuyển Tab hoặc mở Cảnh báo
    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetTab = card.getAttribute('data-target-tab');
            const targetTrigger = card.getAttribute('data-target-trigger');
            if (targetTab) {
                const navItem = document.querySelector(`.nav-item[data-tab="${targetTab}"]`);
                if (navItem) navItem.click();
            } else if (targetTrigger === 'alerts') {
                document.getElementById('alerts-trigger').click();
            }
        });
    });

    // Nút xuất báo cáo PDF / Excel
    document.querySelectorAll('.btn-export').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const format = btn.getAttribute('data-format');
            const report = btn.getAttribute('data-report');
            simulateExport(format, report);
        });
    });
}

/**
 * Lắng nghe sự kiện chuyển đổi Tab để tải dữ liệu tương ứng
 * @param {string} tabId 
 */
function onTabChanged(tabId) {
    if (tabId === 'overview') {
        loadDashboardData();
    } else if (tabId === 'income-report') {
        loadIncomeReport();
    } else if (tabId === 'vacation-report') {
        loadVacationReport();
    } else if (tabId === 'benefits-report') {
        loadBenefitsReport();
    } else if (tabId === 'filter-section') {
        // Tự động chạy filter lần đầu
        executeCEOFilter(API_BASE_URL);
    }
}

/**
 * Kiểm tra kết nối tới Backend API
 */
async function checkHealth() {
    const statusDot = document.getElementById('api-status-dot');
    const statusText = document.getElementById('api-status-text');

    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy') {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Hệ thống trực tuyến';
            return true;
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Hệ thống lỗi DB';
            return true; // Vẫn cho phép thử vì server đang phản hồi
        }
    } catch (error) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Mất kết nối API';
        return false;
    }
}

/**
 * Hiển thị thông báo lỗi kết nối DB
 */
function showConnectionError() {
    const overviewAlerts = document.getElementById('overview-alerts-list');
    overviewAlerts.innerHTML = `
        <div class="alert-card critical">
            <span class="alert-card-icon">❌</span>
            <div class="alert-card-body">
                <div class="alert-card-title">Mất kết nối API Máy chủ</div>
                <div class="alert-card-msg">Vui lòng khởi chạy server Node.js bằng cách mở terminal trong thư mục backend và chạy lệnh: <strong>npm run dev</strong>.</div>
            </div>
        </div>
    `;
}

/**
 * Tải toàn bộ dữ liệu cho màn hình Tổng quan
 */
async function loadDashboardData() {
    loadAlertsData();

    // Tải trước toàn bộ danh sách nhân sự gộp (phục vụ click xem profile, tìm kiếm)
    try {
        const empResponse = await fetch(`${API_BASE_URL}/employees/filter?amount=-1`);
        const empResult = await empResponse.json();
        if (empResult.success) {
            appState.employees = empResult.data.by_department.reduce((list, dept) => {
                return list.concat(dept.employees);
            }, []);
        }
    } catch (e) {
        console.error('Lỗi khi tải trước danh sách nhân sự:', e);
    }

    try {
        // Lấy báo cáo thu nhập theo phòng ban
        const incResponse = await fetch(`${API_BASE_URL}/reports/income?groupBy=department`);
        const incData = await incResponse.json();

        // Lấy báo cáo nghỉ phép theo phòng ban
        const vacResponse = await fetch(`${API_BASE_URL}/reports/vacation?groupBy=department`);
        const vacData = await vacResponse.json();

        if (incData.success && vacData.success) {
            // Cập nhật các KPI Cards
            document.getElementById('stat-total-emp').textContent = incData.data.summary.total_employees;
            document.getElementById('stat-total-payroll').textContent = '$' + incData.data.summary.total_current_income.toLocaleString();
            document.getElementById('stat-avg-vacation').textContent = parseFloat(vacData.data.summary.avg_vacation_days.toFixed(1)) + ' ngày';

            // Cập nhật các biểu đồ Tổng quan
            updateOverviewCharts(incData.data.details, vacData.data.details);
        }
    } catch (e) {
        console.error('Lỗi khi tải dữ liệu tổng quan:', e);
    }
}

/**
 * Tải dữ liệu Cảnh báo (Alerts)
 */
async function loadAlertsData() {
    const overviewAlerts = document.getElementById('overview-alerts-list');
    const badge = document.getElementById('global-badge-count');
    const statAlerts = document.getElementById('stat-total-alerts');

    try {
        overviewAlerts.innerHTML = '<div class="alert-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

        // Gọi song song các api alerts
        const [resAnniv, resVac, resBen, resBirt] = await Promise.all([
            fetch(`${API_BASE_URL}/alerts/anniversaries`),
            fetch(`${API_BASE_URL}/alerts/vacation-excess`),
            fetch(`${API_BASE_URL}/alerts/benefit-changes`),
            fetch(`${API_BASE_URL}/alerts/birthdays`)
        ]);

        const anniv = await resAnniv.json();
        const vac = await resVac.json();
        const ben = await resBen.json();
        const birt = await resBirt.json();

        // Gộp tất cả cảnh báo vào appState
        appState.alerts = [
            ...(anniv.success ? anniv.data.alerts : []),
            ...(vac.success ? vac.data.alerts : []),
            ...(ben.success ? ben.data.alerts : []),
            ...(birt.success ? birt.data.alerts : [])
        ];

        // Cập nhật các số liệu badge
        const count = appState.alerts.length;
        badge.textContent = count;
        if (count === 0) badge.style.display = 'none';
        else badge.style.display = 'block';

        statAlerts.textContent = count;

        // Render lên bảng tin Tổng quan (chỉ hiển thị tối đa 5 cảnh báo quan trọng nhất)
        if (count === 0) {
            overviewAlerts.innerHTML = '<div class="alert-empty"><i class="fa-solid fa-check text-emerald"></i> Hệ thống ổn định. Không có cảnh báo.</div>';
            return;
        }

        // Ưu tiên cảnh báo Critical/Warning lên trước
        const sortedAlerts = [...appState.alerts].sort((a, b) => {
            const severityRank = { critical: 3, warning: 2, info: 1 };
            return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
        });

        let html = '';
        sortedAlerts.slice(0, 5).forEach(alert => {
            let actionsHtml = '';
            if (alert.type === 'birthday') {
                actionsHtml = `
                    <div class="alert-actions">
                        <button class="alert-action-btn btn-accent" onclick="triggerAlertAction('birthday', ${alert.employee_id})">
                            <i class="fa-solid fa-cake-candles"></i> Gửi lời chúc mừng
                        </button>
                    </div>
                `;
            } else if (alert.type === 'vacation_excess') {
                actionsHtml = `
                    <div class="alert-actions">
                        <button class="alert-action-btn" onclick="triggerAlertAction('vacation', ${alert.employee_id})">
                            <i class="fa-solid fa-paper-plane"></i> Gửi nhắc nhở
                        </button>
                        <button class="alert-action-btn btn-accent" onclick="showEmployeeProfile(${alert.employee_id})">
                            <i class="fa-solid fa-user"></i> Xem hồ sơ
                        </button>
                    </div>
                `;
            } else if (alert.type === 'hire_anniversary' || alert.type === 'wedding_anniversary') {
                actionsHtml = `
                    <div class="alert-actions">
                        <button class="alert-action-btn btn-accent" onclick="triggerAlertAction('anniversary', ${alert.employee_id}, '${alert.type}')">
                            <i class="fa-solid fa-trophy"></i> Vinh danh / Chúc mừng
                        </button>
                    </div>
                `;
            } else if (alert.type === 'benefit_change') {
                actionsHtml = `
                    <div class="alert-actions">
                        <button class="alert-action-btn btn-accent" onclick="showEmployeeProfile(${alert.employee_id})">
                            <i class="fa-solid fa-magnifying-glass-dollar"></i> Xem hồ sơ
                        </button>
                    </div>
                `;
            }

            html += `
                <div class="alert-card ${alert.severity}">
                    <span class="alert-card-icon">${alert.icon}</span>
                    <div class="alert-card-body">
                        <div class="alert-card-title">${alert.title}</div>
                        <div class="alert-card-msg">${alert.message}</div>
                        ${actionsHtml}
                    </div>
                </div>
            `;
        });
        overviewAlerts.innerHTML = html;

    } catch (e) {
        console.error('Lỗi khi tải cảnh báo:', e);
        overviewAlerts.innerHTML = '<div class="alert-empty text-danger">Không thể tải cảnh báo từ máy chủ.</div>';
    }
}

/**
 * Render chi tiết toàn bộ cảnh báo vào Sidebar
 */
function renderAlertsSidebar() {
    const list = document.getElementById('alerts-sidebar-list');
    
    if (appState.alerts.length === 0) {
        list.innerHTML = '<div class="alert-empty">Không có cảnh báo nào.</div>';
        return;
    }

    let html = '';
    appState.alerts.forEach(alert => {
        let actionsHtml = '';
        if (alert.type === 'birthday') {
            actionsHtml = `
                <div class="alert-actions">
                    <button class="alert-action-btn btn-accent" onclick="triggerAlertAction('birthday', ${alert.employee_id})">
                        <i class="fa-solid fa-cake-candles"></i> Gửi lời chúc
                    </button>
                </div>
            `;
        } else if (alert.type === 'vacation_excess') {
            actionsHtml = `
                <div class="alert-actions">
                    <button class="alert-action-btn" onclick="triggerAlertAction('vacation', ${alert.employee_id})">
                        <i class="fa-solid fa-paper-plane"></i> Nhắc nhở
                    </button>
                    <button class="alert-action-btn btn-accent" onclick="showEmployeeProfile(${alert.employee_id})">
                        <i class="fa-solid fa-user"></i> Hồ sơ
                    </button>
                </div>
            `;
        } else if (alert.type === 'hire_anniversary' || alert.type === 'wedding_anniversary') {
            actionsHtml = `
                <div class="alert-actions">
                    <button class="alert-action-btn btn-accent" onclick="triggerAlertAction('anniversary', ${alert.employee_id}, '${alert.type}')">
                        <i class="fa-solid fa-trophy"></i> Chúc mừng
                    </button>
                </div>
            `;
        } else if (alert.type === 'benefit_change') {
            actionsHtml = `
                <div class="alert-actions">
                    <button class="alert-action-btn btn-accent" onclick="showEmployeeProfile(${alert.employee_id})">
                        <i class="fa-solid fa-magnifying-glass-dollar"></i> Xem chi tiết
                    </button>
                </div>
            `;
        }

        html += `
            <div class="alert-card ${alert.severity}">
                <span class="alert-card-icon">${alert.icon}</span>
                <div class="alert-card-body">
                    <div class="alert-card-title">${alert.title}</div>
                    <div class="alert-card-msg">${alert.message}</div>
                    ${actionsHtml}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// ============================================================
// LOGIC BÁO CÁO 1: BÁO CÁO THU NHẬP
// ============================================================
async function loadIncomeReport() {
    const groupby = document.getElementById('income-groupby').value;
    const tableBody = document.querySelector('#income-report-table tbody');
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Đang tổng hợp báo cáo...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/reports/income?groupBy=${groupby}`);
        const result = await response.json();

        if (result.success) {
            appState.incomeReport = result.data;
            
            // Cập nhật biểu đồ dynamic
            renderReportIncomeChart('reportIncomeChart', result.data.details);

            // Render bảng số liệu
            let html = '';
            result.data.details.forEach((group, index) => {
                const diff = group.total_current_income - group.total_previous_income;
                const percent = group.total_previous_income > 0 ? (diff / group.total_previous_income) * 100 : 0;
                
                const trendClass = diff > 0 ? 'trend-up' : (diff < 0 ? 'trend-down' : 'trend-neutral');
                const trendIcon = diff > 0 ? '▲' : (diff < 0 ? '▼' : '▬');

                html += `
                    <tr>
                        <td><strong>${group.group_name}</strong></td>
                        <td>${group.employee_count}</td>
                        <td>$${group.total_previous_income.toLocaleString()}</td>
                        <td>$${group.total_current_income.toLocaleString()}</td>
                        <td>$${Math.round(group.avg_current_income).toLocaleString()}</td>
                        <td class="${trendClass}">${trendIcon} ${percent.toFixed(1)}%</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="showDrilldown('income', ${index})">
                                <i class="fa-solid fa-eye"></i> Xem NV
                            </button>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }
    } catch (e) {
        console.error('Lỗi tải báo cáo thu nhập:', e);
        tableBody.innerHTML = '<tr><td colspan="7" class="text-danger">Không thể tải dữ liệu báo cáo.</td></tr>';
    }
}

// ============================================================
// LOGIC BÁO CÁO 2: BÁO CÁO NGHỈ PHÉP
// ============================================================
async function loadVacationReport() {
    const groupby = document.getElementById('vacation-groupby').value;
    const tableBody = document.querySelector('#vacation-report-table tbody');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Đang tổng hợp báo cáo...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/reports/vacation?groupBy=${groupby}`);
        const result = await response.json();

        if (result.success) {
            appState.vacationReport = result.data;

            // Cập nhật biểu đồ dynamic
            renderReportVacationChart('reportVacationChart', result.data.details);

            // Render bảng số liệu
            let html = '';
            result.data.details.forEach((group, index) => {
                html += `
                    <tr>
                        <td><strong>${group.group_name}</strong></td>
                        <td>${group.employee_count}</td>
                        <td>${group.total_vacation_days} ngày</td>
                        <td>${group.avg_vacation_days.toFixed(1)} ngày</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="showDrilldown('vacation', ${index})">
                                <i class="fa-solid fa-eye"></i> Xem NV
                            </button>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }
    } catch (e) {
        console.error('Lỗi tải báo cáo nghỉ phép:', e);
        tableBody.innerHTML = '<tr><td colspan="5" class="text-danger">Không thể tải dữ liệu báo cáo.</td></tr>';
    }
}

// ============================================================
// LOGIC BÁO CÁO 3: PHÚC LỢI VÀ CỔ ĐÔNG
// ============================================================
async function loadBenefitsReport() {
    const cardsGrid = document.getElementById('benefits-cards-grid');
    const tableBody = document.querySelector('#benefits-report-table tbody');

    cardsGrid.innerHTML = '<div class="alert-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Đang tải...</td></tr>';

    try {
        const response = await fetch(`${API_BASE_URL}/reports/benefits`);
        const result = await response.json();

        if (result.success) {
            appState.benefitsReport = result.data;

            // Render các thẻ Phúc lợi lớn
            let cardsHtml = '';
            result.data.details.forEach(planGroup => {
                // Tính toán tổng số lượng trong gói phúc lợi này
                const totalEmp = planGroup.breakdowns.reduce((sum, b) => sum + b.employee_count, 0);
                const avgIncome = planGroup.breakdowns.reduce((sum, b) => sum + b.total_income, 0) / totalEmp;

                cardsHtml += `
                    <div class="benefit-plan-card glass-panel ${planGroup.plan}">
                        <div class="plan-title">
                            Gói: ${planGroup.plan}
                            <i class="fa-solid fa-gift text-purple"></i>
                        </div>
                        <div class="plan-stats-row">
                            <div class="plan-stat">
                                <span class="plan-stat-lbl">Số nhân sự:</span>
                                <span class="plan-stat-val">${totalEmp}</span>
                            </div>
                            <div class="plan-stat">
                                <span class="plan-stat-lbl">Trung bình năm nay:</span>
                                <span class="plan-stat-val text-emerald">$${Math.round(avgIncome).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            cardsGrid.innerHTML = cardsHtml;

            // Render bảng chi tiết phân rã cơ cấu
            let tableHtml = '';
            result.data.details.forEach(planGroup => {
                planGroup.breakdowns.forEach(breakdown => {
                    tableHtml += `
                        <tr>
                            <td><strong>Gói ${breakdown.benefit_plan}</strong></td>
                            <td>${breakdown.shareholder_status}</td>
                            <td>${breakdown.employee_count}</td>
                            <td>$${breakdown.total_income.toLocaleString()}</td>
                            <td>$${Math.round(breakdown.avg_income).toLocaleString()}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="showDrilldown('benefits', '${breakdown.benefit_plan}_${breakdown.shareholder_status}')">
                                    <i class="fa-solid fa-eye"></i> Xem NV
                                </button>
                            </td>
                        </tr>
                    `;
                });
            });
            tableBody.innerHTML = tableHtml;
        }
    } catch (e) {
        console.error('Lỗi tải báo cáo phúc lợi:', e);
        tableBody.innerHTML = '<tr><td colspan="6" class="text-danger">Không thể tải dữ liệu báo cáo.</td></tr>';
    }
}

// ============================================================
// DRILL-DOWN MODAL - XEM CHI TIẾT TỪNG PHÂN NHÓM
// ============================================================
function showDrilldown(reportType, index) {
    const modal = document.getElementById('drilldown-modal');
    const title = document.getElementById('modal-title');
    const headers = document.getElementById('modal-table-headers');
    const body = document.getElementById('modal-table-body');
    const tableView = document.getElementById('modal-table-view');
    const profileView = document.getElementById('modal-profile-view');

    // Ensure we are in table view mode inside the modal
    tableView.style.display = 'block';
    profileView.style.display = 'none';
    profileView.removeAttribute('data-prev-title');
    const backBtn = modal.querySelector('.modal-back-btn');
    if (backBtn) backBtn.remove();

    modal.style.display = 'flex';
    body.innerHTML = '';

    if (reportType === 'income') {
        const group = appState.incomeReport.details[index];
        title.innerHTML = `<i class="fa-solid fa-sack-dollar text-pink"></i> Thu nhập chi tiết: Nhóm <strong>${group.group_name}</strong>`;
        
        headers.innerHTML = `
            <th>Mã NV</th>
            <th>Họ Tên</th>
            <th>Phòng Ban</th>
            <th>Giới Tính</th>
            <th>Cổ Đông</th>
            <th>Loại Hình</th>
            <th>Năm Ngoái</th>
            <th>Năm Nay</th>
            <th>Hành động</th>
        `;

        let html = '';
        group.employees.forEach(emp => {
            html += `
                <tr style="cursor: pointer;" onclick="showEmployeeProfile(${emp.Employee_ID})">
                    <td>#${emp.Employee_ID}</td>
                    <td><strong>${emp.Full_Name}</strong></td>
                    <td>${emp.Department}</td>
                    <td>${emp.Gender}</td>
                    <td><span class="badge">${emp.Shareholder_Status}</span></td>
                    <td>${emp.Employment_Type}</td>
                    <td>$${emp.Previous_Year_Income.toLocaleString()}</td>
                    <td class="text-emerald">$${emp.Current_Year_Income.toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showEmployeeProfile(${emp.Employee_ID})">
                            <i class="fa-solid fa-id-badge"></i> Hồ sơ
                        </button>
                    </td>
                </tr>
            `;
        });
        body.innerHTML = html;

    } else if (reportType === 'vacation') {
        const group = appState.vacationReport.details[index];
        title.innerHTML = `<i class="fa-solid fa-plane-departure text-blue"></i> Ngày nghỉ phép chi tiết: Nhóm <strong>${group.group_name}</strong>`;

        headers.innerHTML = `
            <th>Mã NV</th>
            <th>Họ Tên</th>
            <th>Phòng Ban</th>
            <th>Ngày nghỉ phép đã nghỉ</th>
            <th>Trạng thái quy chế</th>
            <th>Hành động</th>
        `;

        let html = '';
        group.employees.forEach(emp => {
            const isExceeded = emp.Vacation_Days_Used > 15;
            const statusTag = isExceeded 
                ? '<span class="badge" style="background:rgba(239,68,68,0.1); color:#EF4444; border: 1px solid rgba(239,68,68,0.2);">Vượt quy định (>15 ngày)</span>'
                : '<span class="badge" style="background:rgba(16,185,129,0.1); color:#10B981; border: 1px solid rgba(16,185,129,0.2);">Hợp lệ</span>';

            html += `
                <tr style="cursor: pointer;" onclick="showEmployeeProfile(${emp.Employee_ID})">
                    <td>#${emp.Employee_ID}</td>
                    <td><strong>${emp.Full_Name}</strong></td>
                    <td>${emp.Department}</td>
                    <td><strong>${emp.Vacation_Days_Used} ngày</strong></td>
                    <td>${statusTag}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showEmployeeProfile(${emp.Employee_ID})">
                            <i class="fa-solid fa-id-badge"></i> Hồ sơ
                        </button>
                    </td>
                </tr>
            `;
        });
        body.innerHTML = html;

    } else if (reportType === 'benefits') {
        let group = null;
        for (let planGroup of appState.benefitsReport.details) {
            for (let breakdown of planGroup.breakdowns) {
                if (`${breakdown.benefit_plan}_${breakdown.shareholder_status}` === index) {
                    group = breakdown;
                    break;
                }
            }
            if (group) break;
        }
        if (!group) return;
        
        title.innerHTML = `<i class="fa-solid fa-hand-holding-heart text-pink"></i> Danh sách: Gói <strong>${group.benefit_plan}</strong> (${group.shareholder_status})`;
        
        headers.innerHTML = `
            <th>Mã NV</th>
            <th>Họ Tên</th>
            <th>Phòng Ban</th>
            <th>Thu nhập năm nay</th>
            <th>Hành động</th>
        `;
        
        let html = '';
        group.employees.forEach(emp => {
            html += `
                <tr style="cursor: pointer;" onclick="showEmployeeProfile(${emp.Employee_ID})">
                    <td>#${emp.Employee_ID}</td>
                    <td><strong>${emp.Full_Name}</strong></td>
                    <td>${emp.Department}</td>
                    <td class="text-emerald">$${emp.Current_Year_Income.toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); showEmployeeProfile(${emp.Employee_ID})">
                            <i class="fa-solid fa-id-badge"></i> Hồ sơ
                        </button>
                    </td>
                </tr>
            `;
        });
        body.innerHTML = html;
    }
}

/**
 * Hiển thị thẻ chi tiết nhân viên trong Modal (Gộp thông tin HR + Lương)
 */
function showEmployeeProfile(employeeId) {
    const modal = document.getElementById('drilldown-modal');
    const title = document.getElementById('modal-title');
    const tableView = document.getElementById('modal-table-view');
    const profileView = document.getElementById('modal-profile-view');
    
    // Tìm nhân sự trong CSDL đệm
    const emp = appState.employees.find(e => e.Employee_ID === employeeId);
    if (!emp) return;
    
    // Ẩn bảng danh sách, hiển thị khung profile
    tableView.style.display = 'none';
    profileView.style.display = 'block';
    
    // Ghi nhận tiêu đề trước đó để phục vụ nút Back quay lại
    if (!profileView.getAttribute('data-prev-title')) {
        profileView.setAttribute('data-prev-title', title.innerHTML);
    }
    title.innerHTML = `<i class="fa-solid fa-id-card text-purple"></i> Hồ sơ nhân sự liên kết`;
    
    // Nút quay lại (chỉ tạo nếu chưa có)
    let backBtn = modal.querySelector('.modal-back-btn');
    if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.className = 'modal-back-btn';
        backBtn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> Quay lại danh sách`;
        backBtn.addEventListener('click', () => {
            tableView.style.display = 'block';
            profileView.style.display = 'none';
            backBtn.remove();
            
            // Khôi phục tiêu đề gốc
            title.innerHTML = profileView.getAttribute('data-prev-title') || 'Chi tiết nhóm';
            profileView.removeAttribute('data-prev-title');
        });
        modal.querySelector('.modal-content').appendChild(backBtn);
    }
    
    // Tính toán số tuổi và kỷ niệm
    const dob = new Date(emp.Date_of_Birth);
    const age = new Date().getFullYear() - dob.getFullYear();
    const weddingAnniv = emp.Wedding_Anniversary 
        ? new Date(emp.Wedding_Anniversary).toLocaleDateString('vi-VN') 
        : 'Chưa kết hôn / N/A';
        
    const salaryDiff = emp.Current_Year_Income - emp.Previous_Year_Income;
    const growthPercent = emp.Previous_Year_Income > 0 ? (salaryDiff / emp.Previous_Year_Income) * 100 : 0;
    const growthClass = salaryDiff >= 0 ? 'salary-growth-pct' : 'salary-growth-pct negative';
    const growthIcon = salaryDiff >= 0 ? '▲' : '▼';
    
    profileView.innerHTML = `
        <div class="profile-card-container">
            <div class="profile-main-info">
                <div class="profile-avatar-large">
                    <i class="fa-solid ${emp.Gender.toLowerCase() === 'female' ? 'fa-user-nurse' : 'fa-user-astronaut'}"></i>
                </div>
                <div class="profile-name-title">
                    <h4>${emp.Full_Name}</h4>
                    <p>Mã số: #${emp.Employee_ID} • ${emp.Employment_Type} • Gói phúc lợi: ${emp.Benefit_Plan}</p>
                </div>
            </div>
            
            <div class="profile-grid-details">
                <div class="profile-section-title"><i class="fa-solid fa-id-card-clip"></i> Thông tin Nhân sự (HR Legacy DB)</div>
                
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Phòng ban</span>
                    <span class="profile-detail-value">${emp.Department}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Giới tính & Sắc tộc</span>
                    <span class="profile-detail-value">${emp.Gender} (${emp.Ethnicity})</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Ngày sinh & Tuổi</span>
                    <span class="profile-detail-value">${new Date(emp.Date_of_Birth).toLocaleDateString('vi-VN')} (${age} tuổi)</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Ngày tuyển dụng</span>
                    <span class="profile-detail-value">${new Date(emp.Hire_Date).toLocaleDateString('vi-VN')}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Tình trạng hôn nhân</span>
                    <span class="profile-detail-value">${emp.Marital_Status}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Kỷ niệm ngày cưới</span>
                    <span class="profile-detail-value">${weddingAnniv}</span>
                </div>
                
                <div class="profile-section-title"><i class="fa-solid fa-wallet"></i> Thông tin Lương & Phúc lợi (Payroll Legacy DB)</div>
                
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Thu nhập năm trước (Previous Year)</span>
                    <span class="profile-detail-value">$${emp.Previous_Year_Income.toLocaleString()}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Thu nhập năm nay (Current Year)</span>
                    <span class="profile-detail-value text-emerald">$${emp.Current_Year_Income.toLocaleString()}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Trạng thái cổ đông</span>
                    <span class="profile-detail-value">${emp.Shareholder_Status === 'Shareholder' ? '🌟 Cổ đông sở hữu' : 'Nhân sự thường'}</span>
                </div>
                <div class="profile-detail-item">
                    <span class="profile-detail-label">Số ngày phép đã dùng</span>
                    <span class="profile-detail-value ${emp.Vacation_Days_Used > 15 ? 'text-danger' : 'text-emerald'}">${emp.Vacation_Days_Used} / 15 ngày</span>
                </div>
                
                <div class="profile-salary-comparison">
                    <div>
                        <span class="profile-detail-label">Biến động thu nhập năm ngoái vs năm nay:</span>
                        <h4 style="margin-top: 4px; color: white;">$${salaryDiff.toLocaleString()} USD</h4>
                    </div>
                    <span class="${growthClass}">${growthIcon} ${growthPercent.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    `;
    
    // Mở modal nếu chưa mở
    modal.style.display = 'flex';
}

/**
 * Xử lý các hành động điều hành nhanh từ CEO (simulated executive actions)
 */
function triggerAlertAction(actionType, employeeId, subType = '') {
    const modal = document.getElementById('drilldown-modal');
    const title = document.getElementById('modal-title');
    const tableView = document.getElementById('modal-table-view');
    const profileView = document.getElementById('modal-profile-view');
    
    const emp = appState.employees.find(e => e.Employee_ID === employeeId);
    if (!emp) return;
    
    // Hide table view, show profile view
    tableView.style.display = 'none';
    profileView.style.display = 'block';
    
    // Remove existing back button
    const existingBackBtn = modal.querySelector('.modal-back-btn');
    if (existingBackBtn) existingBackBtn.remove();
    
    title.innerHTML = `<i class="fa-solid fa-envelope-open-text text-purple"></i> Soạn thảo chỉ thị / thông điệp`;
    modal.style.display = 'flex';
    
    let subject = '';
    let messageTemplate = '';
    
    if (actionType === 'birthday') {
        subject = `Chúc mừng sinh nhật nhân sự - ${emp.Full_Name}`;
        messageTemplate = `Thân gửi ${emp.Full_Name},\n\nThay mặt Ban Giám Đốc công ty, tôi xin gửi lời chúc mừng sinh nhật tốt đẹp nhất đến bạn. Cảm ơn bạn vì những đóng góp tuyệt vời cho bộ phận ${emp.Department}.\n\nChúc bạn tuổi mới nhiều sức khỏe, niềm vui và gặt hái thêm nhiều thành công!\n\nTrân trọng,\nCEO - Ban Giám Đốc`;
    } else if (actionType === 'vacation') {
        subject = `Nhắc nhở về quy chế nghỉ phép năm - ${emp.Full_Name}`;
        messageTemplate = `Gửi bộ phận Nhân sự & Quản lý bộ phận ${emp.Department},\n\nHệ thống giám sát ghi nhận nhân viên ${emp.Full_Name} (#${emp.Employee_ID}) hiện đã nghỉ ${emp.Vacation_Days_Used} ngày phép, vượt quá quy chuẩn tối đa (15 ngày).\n\nĐề nghị bộ phận HR tiến hành trao đổi trực tiếp với nhân viên để sắp xếp công việc và điều chỉnh chế độ phép hợp lý theo đúng quy chế.\n\nTrân trọng,\nCEO - Ban Giám Đốc`;
    } else if (actionType === 'anniversary') {
        if (subType === 'hire_anniversary') {
            subject = `Thư cảm ơn kỷ niệm ngày tuyển dụng - ${emp.Full_Name}`;
            messageTemplate = `Thân gửi ${emp.Full_Name},\n\nChúc mừng bạn đã đồng hành cùng công ty trong suốt thời gian qua. Sự cống hiến và nỗ lực bền bỉ của bạn tại bộ phận ${emp.Department} là mảnh ghép quan trọng cho sự phát triển của doanh nghiệp.\n\nHân hạnh được tiếp tục hợp tác cùng bạn trên những chặng đường phát triển sắp tới.\n\nTrân trọng,\nCEO - Ban Giám Đốc`;
        } else {
            subject = `Chúc mừng kỷ niệm ngày cưới - ${emp.Full_Name}`;
            messageTemplate = `Thân gửi ${emp.Full_Name},\n\nChúc mừng ngày kỷ niệm cưới của vợ chồng bạn! Chúc gia đình bạn luôn tràn ngập hạnh phúc, ấm áp và gặt hái được nhiều niềm vui trong cuộc sống.\n\nTrân trọng,\nCEO - Ban Giám Đốc`;
        }
    }
    
    profileView.innerHTML = `
        <div style="padding: 10px 0;">
            <div class="profile-detail-item" style="margin-bottom: 12px;">
                <span class="profile-detail-label">Người nhận:</span>
                <span class="profile-detail-value">${emp.Full_Name} (${emp.Department})</span>
            </div>
            <div class="profile-detail-item" style="margin-bottom: 12px;">
                <span class="profile-detail-label">Tiêu đề:</span>
                <input type="text" value="${subject}" style="background:transparent; border:none; color:white; font-weight:600; width:100%; font-family:inherit; outline:none;" id="email-subject-input">
            </div>
            <div class="profile-detail-item" style="margin-bottom: 20px;">
                <span class="profile-detail-label">Nội dung thư:</span>
                <textarea rows="8" style="background:transparent; border:none; color:white; width:100%; font-family:inherit; outline:none; resize:none; font-size:0.85rem; line-height:1.4;" id="email-content-input">${messageTemplate}</textarea>
            </div>
            
            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button class="btn btn-outline-warning" onclick="document.getElementById('drilldown-modal').style.display = 'none';">Hủy bỏ</button>
                <button class="btn btn-primary" onclick="sendSimulatedEmail('${emp.Full_Name}')">
                    <i class="fa-solid fa-paper-plane"></i> Gửi Chỉ Thị / Thư Chúc
                </button>
            </div>
        </div>
    `;
}

/**
 * Gửi email mô phỏng thành công
 */
function sendSimulatedEmail(employeeName) {
    const profileView = document.getElementById('modal-profile-view');
    const title = document.getElementById('modal-title');
    
    title.innerHTML = `<i class="fa-solid fa-circle-check text-emerald"></i> Đã gửi thư chỉ thị`;
    
    profileView.innerHTML = `
        <div style="text-align: center; padding: 25px 0;">
            <i class="fa-solid fa-paper-plane text-emerald" style="font-size: 3.5rem; margin-bottom: 20px; display: block; animation: pulse 1s infinite;"></i>
            <h4>Đã chuyển tiếp chỉ thị thành công!</h4>
            <p class="text-secondary" style="margin-top: 8px; font-size: 0.85rem;">Thông điệp điều hành đã được gửi tới hệ thống hòm thư của <strong>${employeeName}</strong> & các cấp quản lý bộ phận liên quan.</p>
            <button class="btn btn-primary" style="margin-top: 20px;" onclick="document.getElementById('drilldown-modal').style.display = 'none';">Đóng</button>
        </div>
    `;
}

/**
 * Mô phỏng quá trình xuất báo cáo sang PDF/Excel
 */
function simulateExport(format, reportType) {
    const modal = document.getElementById('drilldown-modal');
    const title = document.getElementById('modal-title');
    const tableView = document.getElementById('modal-table-view');
    const profileView = document.getElementById('modal-profile-view');
    
    // Switch views in modal
    tableView.style.display = 'none';
    profileView.style.display = 'block';
    
    // Hide back button if any
    const existingBackBtn = modal.querySelector('.modal-back-btn');
    if (existingBackBtn) existingBackBtn.remove();
    
    title.innerHTML = `<i class="fa-solid fa-file-export text-purple"></i> Đang xuất báo cáo...`;
    modal.style.display = 'flex';
    
    const reportNames = {
        income: 'Báo cáo Thu nhập Nhân sự',
        vacation: 'Báo cáo Ngày nghỉ phép',
        benefits: 'Báo cáo Phúc lợi & Cổ đông'
    };
    
    const reportName = reportNames[reportType] || 'Báo cáo Tổng hợp';
    
    profileView.innerHTML = `
        <div class="export-progress-container">
            <h4>Hệ thống đang xuất <strong>${reportName}</strong> định dạng <strong>${format.toUpperCase()}</strong></h4>
            <p class="text-secondary" style="margin-top: 8px; font-size: 0.85rem;">Đang tập hợp dữ liệu từ HR_Legacy_DB & Payroll_Legacy_DB...</p>
            <div class="export-progress-bar">
                <div class="export-progress-fill" id="export-fill"></div>
            </div>
            <div style="margin-top: 15px; font-size: 0.8rem; color: var(--text-muted);" id="export-status-text">Tiến trình: 0%</div>
        </div>
    `;
    
    const fill = document.getElementById('export-fill');
    const statusText = document.getElementById('export-status-text');
    let percent = 0;
    
    const interval = setInterval(() => {
        percent += 5;
        fill.style.width = percent + '%';
        statusText.textContent = `Tiến trình: ${percent}%`;
        
        if (percent === 35) {
            statusText.innerHTML = `Tiến trình: 35% - Thiết lập layout báo cáo...`;
        } else if (percent === 70) {
            statusText.innerHTML = `Tiến trình: 70% - Định dạng bảng dữ liệu gộp...`;
        } else if (percent === 90) {
            statusText.innerHTML = `Tiến trình: 90% - Đang ghi file...`;
        }
        
        if (percent >= 100) {
            clearInterval(interval);
            profileView.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fa-solid fa-circle-check text-emerald" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
                    <h4>Xuất báo cáo thành công!</h4>
                    <p class="text-secondary" style="margin-top: 8px; font-size: 0.85rem;">Đã tải xuống tệp: <strong>${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.${format}</strong></p>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="document.getElementById('drilldown-modal').style.display = 'none';">Hoàn tất</button>
                </div>
            `;
        }
    }, 100);
}

/**
 * Cấu hình Server-Sent Events (SSE) để đồng bộ dữ liệu thời gian thực cho CEO Dashboard
 */
function setupSSESync() {
    const dot = document.getElementById('api-status-dot');
    const text = document.getElementById('api-status-text');

    try {
        const eventSource = new EventSource(`${API_BASE_URL}/updates`);

        eventSource.onopen = () => {
            if (dot && text) {
                dot.className = 'status-dot online';
                text.textContent = 'Hệ thống trực tuyến';
            }
            console.log('[SSE] CEO Dashboard đã kết nối với máy chủ đồng bộ thời gian thực.');
        };

        eventSource.onerror = (err) => {
            if (dot && text) {
                dot.className = 'status-dot offline';
                text.textContent = 'Đồng bộ: Lỗi kết nối';
            }
            console.warn('[SSE] CEO Dashboard mất kết nối. Đang chờ kết nối lại...');
        };

        eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'REFRESH') {
                console.log(`[SSE] CEO Dashboard nhận tín hiệu làm mới dữ liệu từ hành động: ${data.action}`);
                
                // Lưu giữ tab hiện tại để tải lại đúng phần dữ liệu đang xem
                const activeTab = document.querySelector('.nav-item.active');
                const activeTabId = activeTab ? activeTab.getAttribute('data-tab') : 'overview';
                
                // Tải lại dữ liệu tổng quan
                await loadDashboardData();
                
                // Tải lại tab báo cáo hiện tại (nếu khác tổng quan)
                if (activeTabId && activeTabId !== 'overview') {
                    onTabChanged(activeTabId);
                }
            }
        };
    } catch (e) {
        console.error('[SSE] Không thể cấu hình SSE cho CEO Dashboard:', e);
    }
}

// Đăng ký các hàm toàn cục để gọi từ HTML nội tuyến
window.showEmployeeProfile = showEmployeeProfile;
window.triggerAlertAction = triggerAlertAction;
window.sendSimulatedEmail = sendSimulatedEmail;
window.simulateExport = simulateExport;
window.showDrilldown = showDrilldown;
