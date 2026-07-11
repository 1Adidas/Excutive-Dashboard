/**
 * ============================================================
 * PAYROLL SYSTEM INTERFACE LOGIC - payroll.js
 * ============================================================
 * Quản lý dữ liệu lương & phúc lợi của nhân sự, thực hiện
 * cập nhật và kết nối Server-Sent Events (SSE) để đồng bộ thời gian thực.
 * ============================================================
 */

const API_BASE_URL = 'http://localhost:3000/api';
let allEmployees = [];
let editingEmployeeId = null;

// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initPayrollApp();
});

/**
 * Khởi tạo hệ thống Payroll
 */
async function initPayrollApp() {
    setupTheme();
    setupEventListeners();
    setupSSESync();
    await loadEmployees();
}

/**
 * Cài đặt và chuyển đổi Theme Sáng/Tối
 */
function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.className = 'fa-solid fa-moon';
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeIcon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    });
}

/**
 * Thiết lập các sự kiện trên UI
 */
function setupEventListeners() {
    // Tìm kiếm nhân sự
    const searchInput = document.getElementById('payroll-search-input');
    searchInput.addEventListener('input', () => {
        renderPayrollTable(searchInput.value.trim().toLowerCase());
    });

    // Đóng modal
    document.getElementById('btn-close-modal').addEventListener('click', closePayrollModal);
    document.getElementById('btn-cancel-form').addEventListener('click', closePayrollModal);

    // Xử lý gửi Form
    const form = document.getElementById('payroll-form');
    form.addEventListener('submit', handleFormSubmit);
}

/**
 * Lấy danh sách nhân viên gộp từ Backend
 */
async function loadEmployees() {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/filter?amount=-1`);
        const result = await response.json();
        
        if (result.success) {
            // Flatten cấu trúc phân nhóm
            allEmployees = result.data.by_department.reduce((list, dept) => {
                return list.concat(dept.employees);
            }, []);
            
            // Sắp xếp theo ID
            allEmployees.sort((a, b) => a.Employee_ID - b.Employee_ID);
            
            renderPayrollTable();
        } else {
            console.error('Không thể tải nhân viên:', result.error);
        }
    } catch (e) {
        console.error('Lỗi kết nối API tải dữ liệu:', e);
        const tbody = document.querySelector('#payroll-employee-table tbody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-danger text-center">Không thể kết nối máy chủ API. Vui lòng chạy server Node.js.</td></tr>';
    }
}

/**
 * Render danh sách lương ra bảng
 */
function renderPayrollTable(filterQuery = '') {
    const tbody = document.querySelector('#payroll-employee-table tbody');
    tbody.innerHTML = '';

    const filtered = allEmployees.filter(emp => {
        if (!filterQuery) return true;
        const name = emp.Full_Name.toLowerCase();
        const id = emp.Employee_ID.toString();
        const dept = emp.Department.toLowerCase();
        const type = emp.Employment_Type.toLowerCase();
        return name.includes(filterQuery) || id.includes(filterQuery) || dept.includes(filterQuery) || type.includes(filterQuery);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Không tìm thấy dữ liệu nhân viên nào.</td></tr>';
        return;
    }

    filtered.forEach(emp => {
        const isShareholder = emp.Shareholder_Status === 'Shareholder';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>#${emp.Employee_ID}</strong></td>
                <td><strong>${emp.First_Name} ${emp.Last_Name}</strong></td>
                <td><span class="badge-dept" style="background:rgba(16, 185, 129, 0.1); color:#10b981; border: 1px solid rgba(16, 185, 129, 0.2);">${emp.Department}</span></td>
                <td>${emp.Employment_Type}</td>
                <td>$${emp.Previous_Year_Income.toLocaleString()}</td>
                <td class="text-emerald" style="font-weight:700;">$${emp.Current_Year_Income.toLocaleString()}</td>
                <td>
                    <span class="${isShareholder ? 'badge-shareholder' : 'badge'}" style="${!isShareholder ? 'background:rgba(255,255,255,0.05); color:#999;' : ''}">
                        ${isShareholder ? '★ Cổ đông' : 'N/A'}
                    </span>
                </td>
                <td><span class="badge-payroll">${emp.Benefit_Plan}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editPayroll(${emp.Employee_ID})">
                        <i class="fa-solid fa-money-check-dollar"></i> Điều chỉnh
                    </button>
                </td>
            </tr>
        `;
    });
}

/**
 * Mở modal chỉnh sửa lương
 */
function editPayroll(empId) {
    const modal = document.getElementById('payroll-modal');
    editingEmployeeId = empId;

    const emp = allEmployees.find(e => e.Employee_ID === empId);
    if (!emp) return;

    // Hiển thị thông tin hồ sơ
    document.getElementById('payroll-emp-id-text').textContent = `#${emp.Employee_ID}`;
    document.getElementById('payroll-emp-name-text').textContent = emp.Full_Name;

    // Điền dữ liệu cũ vào input
    document.getElementById('pay-income').value = emp.Current_Year_Income;
    document.getElementById('pay-prev-income').value = emp.Previous_Year_Income;
    document.getElementById('pay-type').value = emp.Employment_Type;
    document.getElementById('pay-plan').value = emp.Benefit_Plan;
    document.getElementById('pay-shareholder').checked = (emp.Shareholder_Status === 'Shareholder');

    modal.style.display = 'flex';
}

/**
 * Đóng Modal
 */
function closePayrollModal() {
    document.getElementById('payroll-modal').style.display = 'none';
}

/**
 * Gửi form cập nhật lương
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');

    const Current_Year_Income = parseFloat(document.getElementById('pay-income').value) || 0;
    const Previous_Year_Income = parseFloat(document.getElementById('pay-prev-income').value) || 0;
    const Employment_Type = document.getElementById('pay-type').value;
    const Benefit_Plan = document.getElementById('pay-plan').value;
    const Shareholder_Status = document.getElementById('pay-shareholder').checked; // boolean

    const payload = {
        Current_Year_Income,
        Previous_Year_Income,
        Employment_Type,
        Benefit_Plan,
        Shareholder_Status
    };

    try {
        dot.className = 'status-dot syncing';
        text.textContent = 'Đang đồng bộ...';

        const response = await fetch(`${API_BASE_URL}/payroll/${editingEmployeeId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            closePayrollModal();
            // Load lại dữ liệu qua sự kiện SSE phát tới
        } else {
            alert(`Lỗi khi cập nhật bảng lương: ${result.error}`);
            dot.className = 'status-dot online';
            text.textContent = 'Đồng bộ: Sẵn sàng';
        }
    } catch (e) {
        console.error(e);
        alert('Mất kết nối tới API Máy chủ.');
        dot.className = 'status-dot online';
        text.textContent = 'Đồng bộ: Sẵn sàng';
    }
}

/**
 * Server-Sent Events (SSE) real-time connection
 */
function setupSSESync() {
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');

    try {
        const eventSource = new EventSource(`${API_BASE_URL}/updates`);

        eventSource.onopen = () => {
            dot.className = 'status-dot online';
            text.textContent = 'Đồng bộ: Sẵn sàng';
            console.log('[SSE] Đã kết nối với máy chủ đồng bộ thời gian thực.');
        };

        eventSource.onerror = (err) => {
            dot.className = 'status-dot offline';
            text.textContent = 'Đồng bộ: Lỗi kết nối';
            console.warn('[SSE] Mất kết nối. Đang chờ kết nối lại...');
        };

        eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'REFRESH') {
                console.log(`[SSE] Nhận tín hiệu làm mới dữ liệu lương từ hành động: ${data.action}`);
                
                // Hiển thị nhấp nháy trạng thái đồng bộ
                dot.className = 'status-dot syncing';
                text.textContent = 'Đang đồng bộ...';
                
                await loadEmployees();
                
                setTimeout(() => {
                    dot.className = 'status-dot online';
                    text.textContent = 'Đồng bộ: Sẵn sàng';
                }, 500);
            }
        };
    } catch (e) {
        console.error('[SSE] Không thể cấu hình Server-Sent Events:', e);
        dot.className = 'status-dot offline';
        text.textContent = 'Đồng bộ: Không khả dụng';
    }
}

// Gắn hàm điều chỉnh lương vào window
window.editPayroll = editPayroll;
