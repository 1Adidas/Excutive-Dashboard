/**
 * ============================================================
 * HR SYSTEM INTERFACE LOGIC - hr.js
 * ============================================================
 * Quản lý dữ liệu nhân sự, thêm/sửa/xóa thông tin nhân viên,
 * và kết nối Server-Sent Events (SSE) để đồng bộ thời gian thực.
 * ============================================================
 */

const API_BASE_URL = 'http://localhost:3000/api';
let allEmployees = [];
let isEditMode = false;
let editingEmployeeId = null;

// Khởi chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initHRApp();
});

/**
 * Khởi tạo hệ thống HR
 */
async function initHRApp() {
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
    const searchInput = document.getElementById('hr-search-input');
    searchInput.addEventListener('input', () => {
        renderEmployeeTable(searchInput.value.trim().toLowerCase());
    });

    // Mở modal Thêm nhân viên
    const btnAdd = document.getElementById('btn-add-employee');
    btnAdd.addEventListener('click', () => openEmployeeModal(false));

    // Đóng modal
    document.getElementById('btn-close-modal').addEventListener('click', closeEmployeeModal);
    document.getElementById('btn-cancel-form').addEventListener('click', closeEmployeeModal);

    // Xử lý gửi Form Thêm/Sửa
    const form = document.getElementById('employee-form');
    form.addEventListener('submit', handleFormSubmit);

    // Tự động kiểm soát trường ngày cưới dựa trên tình trạng hôn nhân
    const maritalSelect = document.getElementById('emp-marital');
    const weddingInput = document.getElementById('emp-wedding');
    maritalSelect.addEventListener('change', () => {
        if (maritalSelect.value === 'Married') {
            weddingInput.disabled = false;
            weddingInput.required = true;
        } else {
            weddingInput.disabled = true;
            weddingInput.required = false;
            weddingInput.value = '';
        }
    });
}

/**
 * Lấy danh sách nhân viên từ Backend
 */
async function loadEmployees() {
    try {
        const response = await fetch(`${API_BASE_URL}/employees/filter?amount=-1`);
        const result = await response.json();
        
        if (result.success) {
            // Flatten cấu trúc phân nhóm phòng ban
            allEmployees = result.data.by_department.reduce((list, dept) => {
                return list.concat(dept.employees);
            }, []);
            
            // Sắp xếp theo ID giảm dần hoặc tăng dần
            allEmployees.sort((a, b) => a.Employee_ID - b.Employee_ID);
            
            renderEmployeeTable();
        } else {
            console.error('Không thể tải nhân viên:', result.error);
        }
    } catch (e) {
        console.error('Lỗi kết nối API tải nhân viên:', e);
        const tbody = document.querySelector('#hr-employee-table tbody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-danger text-center">Không thể kết nối máy chủ API. Vui lòng chạy server Node.js.</td></tr>';
    }
}

/**
 * Render danh sách nhân viên ra bảng
 */
function renderEmployeeTable(filterQuery = '') {
    const tbody = document.querySelector('#hr-employee-table tbody');
    tbody.innerHTML = '';

    const filtered = allEmployees.filter(emp => {
        if (!filterQuery) return true;
        const name = emp.Full_Name.toLowerCase();
        const id = emp.Employee_ID.toString();
        const dept = emp.Department.toLowerCase();
        return name.includes(filterQuery) || id.includes(filterQuery) || dept.includes(filterQuery);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Không tìm thấy nhân viên nào.</td></tr>';
        return;
    }

    filtered.forEach(emp => {
        const dob = emp.Date_of_Birth ? new Date(emp.Date_of_Birth).toLocaleDateString('vi-VN') : 'N/A';
        const hireDate = emp.Hire_Date ? new Date(emp.Hire_Date).toLocaleDateString('vi-VN') : 'N/A';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>#${emp.Employee_ID}</strong></td>
                <td><strong>${emp.First_Name} ${emp.Last_Name}</strong></td>
                <td><span class="badge-dept">${emp.Department}</span></td>
                <td>${emp.Gender === 'Male' ? 'Nam' : (emp.Gender === 'Female' ? 'Nữ' : 'Khác')}</td>
                <td>${dob}</td>
                <td>${hireDate}</td>
                <td><span class="${emp.Vacation_Days_Used > 15 ? 'text-danger' : ''}" style="font-weight:600;">${emp.Vacation_Days_Used} ngày</span></td>
                <td>${emp.Marital_Status === 'Married' ? 'Đã kết hôn' : (emp.Marital_Status === 'Single' ? 'Độc thân' : emp.Marital_Status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" style="margin-right: 5px;" onclick="editEmployee(${emp.Employee_ID})">
                        <i class="fa-solid fa-pen"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEmployee(${emp.Employee_ID})">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </td>
            </tr>
        `;
    });
}

/**
 * Mở modal Form Thêm/Sửa nhân viên
 */
function openEmployeeModal(editMode = false, empId = null) {
    const modal = document.getElementById('employee-modal');
    const titleText = document.getElementById('modal-title-text');
    const form = document.getElementById('employee-form');
    
    // reset form
    form.reset();
    isEditMode = editMode;
    editingEmployeeId = empId;

    const idInput = document.getElementById('emp-id');
    const payrollHeader = document.getElementById('payroll-fields-header');
    const payrollGrid1 = document.getElementById('payroll-fields-grid');
    const payrollGrid2 = document.getElementById('payroll-fields-grid-2');
    const payrollGrid3 = document.getElementById('payroll-fields-grid-3');

    if (editMode) {
        titleText.innerHTML = `<i class="fa-solid fa-user-pen text-pink"></i> Sửa Hồ Sơ Nhân Viên #${empId}`;
        idInput.value = empId;
        idInput.disabled = true; // Không cho sửa ID

        // Ẩn phần lương khi cập nhật thông tin HR (Lương được chỉnh sửa ở trang Payroll)
        payrollHeader.style.display = 'none';
        payrollGrid1.style.display = 'none';
        payrollGrid2.style.display = 'none';
        payrollGrid3.style.display = 'none';

        // Điền thông tin cũ vào form
        const emp = allEmployees.find(e => e.Employee_ID === empId);
        if (emp) {
            document.getElementById('emp-firstname').value = emp.First_Name;
            document.getElementById('emp-lastname').value = emp.Last_Name;
            document.getElementById('emp-dept').value = emp.Department;
            document.getElementById('emp-gender').value = emp.Gender;
            document.getElementById('emp-ethnicity').value = emp.Ethnicity;
            document.getElementById('emp-dob').value = emp.Date_of_Birth ? emp.Date_of_Birth.slice(0, 10) : '';
            document.getElementById('emp-hiredate').value = emp.Hire_Date ? emp.Hire_Date.slice(0, 10) : '';
            document.getElementById('emp-marital').value = emp.Marital_Status;
            
            const weddingInput = document.getElementById('emp-wedding');
            if (emp.Marital_Status === 'Married') {
                weddingInput.disabled = false;
                weddingInput.required = true;
                weddingInput.value = emp.Wedding_Anniversary ? emp.Wedding_Anniversary.slice(0, 10) : '';
            } else {
                weddingInput.disabled = true;
                weddingInput.required = false;
                weddingInput.value = '';
            }
        }
    } else {
        titleText.innerHTML = `<i class="fa-solid fa-user-plus text-pink"></i> Thêm Nhân Sự Mới`;
        idInput.disabled = false;

        // Hiện đầy đủ các trường để thực hiện nhập liệu "Một lần duy nhất"
        payrollHeader.style.display = 'block';
        payrollGrid1.style.display = 'grid';
        payrollGrid2.style.display = 'grid';
        payrollGrid3.style.display = 'flex';
        
        document.getElementById('emp-wedding').disabled = true;
    }

    modal.style.display = 'flex';
}

/**
 * Đóng Modal
 */
function closeEmployeeModal() {
    document.getElementById('employee-modal').style.display = 'none';
}

/**
 * Nhận lệnh sửa từ nút trên bảng
 */
function editEmployee(employeeId) {
    openEmployeeModal(true, employeeId);
}

/**
 * Xóa nhân viên
 */
async function deleteEmployee(employeeId) {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên #${employeeId} khỏi hệ thống? Thao tác này cũng sẽ xóa dữ liệu lương tương ứng.`)) {
        return;
    }

    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');

    try {
        dot.className = 'status-dot syncing';
        text.textContent = 'Đang đồng bộ...';

        const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            // Không cần reload trực tiếp, SSE sẽ phát tín hiệu kích hoạt loadEmployees()
            console.log(`Đã xóa thành công NV #${employeeId}`);
        } else {
            alert(`Lỗi khi xóa nhân viên: ${result.error}`);
            dot.className = 'status-dot online';
            text.textContent = 'Đồng bộ: Sẵn sàng';
        }
    } catch (e) {
        console.error(e);
        alert('Lỗi kết nối mạng khi thực hiện xóa.');
        dot.className = 'status-dot online';
        text.textContent = 'Đồng bộ: Sẵn sàng';
    }
}

/**
 * Gửi Form Thêm/Sửa
 */
async function handleFormSubmit(event) {
    event.preventDefault();

    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');

    const Employee_ID = parseInt(document.getElementById('emp-id').value);
    const First_Name = document.getElementById('emp-firstname').value.trim();
    const Last_Name = document.getElementById('emp-lastname').value.trim();
    const Department = document.getElementById('emp-dept').value;
    const Gender = document.getElementById('emp-gender').value;
    const Ethnicity = document.getElementById('emp-ethnicity').value.trim();
    const Date_of_Birth = document.getElementById('emp-dob').value;
    const Hire_Date = document.getElementById('emp-hiredate').value;
    const Marital_Status = document.getElementById('emp-marital').value;
    const Wedding_Anniversary = document.getElementById('emp-wedding').value || null;

    const payload = {
        Employee_ID,
        First_Name,
        Last_Name,
        Department,
        Gender,
        Ethnicity,
        Date_of_Birth,
        Hire_Date,
        Marital_Status,
        Wedding_Anniversary
    };

    // Nếu thêm mới, đính kèm thông tin Lương gộp
    if (!isEditMode) {
        payload.Current_Year_Income = parseFloat(document.getElementById('emp-income').value) || 0;
        payload.Previous_Year_Income = parseFloat(document.getElementById('emp-prev-income').value) || 0;
        payload.Employment_Type = document.getElementById('emp-type').value;
        payload.Benefit_Plan = document.getElementById('emp-plan').value;
        payload.Shareholder_Status = document.getElementById('emp-shareholder').checked ? 'Shareholder' : 'Non-Shareholder';
    }

    try {
        dot.className = 'status-dot syncing';
        text.textContent = 'Đang đồng bộ...';

        let url = `${API_BASE_URL}/employees`;
        let method = 'POST';

        if (isEditMode) {
            url = `${API_BASE_URL}/employees/${editingEmployeeId}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            closeEmployeeModal();
            // Việc load lại bảng sẽ tự động diễn ra nhờ nhận tín hiệu qua SSE
        } else {
            alert(`Lỗi ghi nhận giao dịch: ${result.error}`);
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
 * Cấu hình Server-Sent Events (SSE) để đồng bộ dữ liệu thời gian thực
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
                console.log(`[SSE] Nhận tín hiệu làm mới dữ liệu từ hành động: ${data.action}`);
                
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

// Gắn các hàm gọi từ mã HTML nội tuyến
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
