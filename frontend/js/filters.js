/**
 * ============================================================
 * FILTER MODULE - BỘ LỌC THÔNG MINH CHO CEO
 * ============================================================
 * Xử lý sự kiện gửi bộ lọc lên API backend để lấy danh sách
 * nhân viên, hỗ trợ tìm kiếm theo tên/mã số, giới tính,
 * trạng thái cổ đông, và loại hình làm việc.
 * ============================================================
 */

/**
 * Thực thi lọc nhân viên và cập nhật giao diện kết quả
 * @param {string} apiBaseUrl - Cấu hình base URL của API
 */
async function executeCEOFilter(apiBaseUrl) {
    const searchInput = document.getElementById('filter-search');
    const amountInput = document.getElementById('filter-amount');
    const deptSelect = document.getElementById('filter-dept');
    const shareholderSelect = document.getElementById('filter-shareholder');
    const empTypeSelect = document.getElementById('filter-employment-type');
    const genderSelect = document.getElementById('filter-gender');

    const resultsContainer = document.getElementById('filter-results-container');
    const countText = document.getElementById('results-count-text');
    const resultsGrid = document.getElementById('filter-departments-results');

    const search = searchInput ? searchInput.value.trim() : '';
    const amount = amountInput ? amountInput.value.trim() : '';
    const department = deptSelect ? deptSelect.value : '';
    const shareholder = shareholderSelect ? shareholderSelect.value : '';
    const employmentType = empTypeSelect ? empTypeSelect.value : '';
    const gender = genderSelect ? genderSelect.value : '';

    try {
        resultsContainer.style.display = 'block';
        resultsGrid.innerHTML = '<div class="alert-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải kết quả lọc...</div>';

        // Xây dựng tham số truy vấn động
        let queryParams = [];
        if (amount) queryParams.push(`amount=${encodeURIComponent(amount)}`);
        if (department) queryParams.push(`department=${encodeURIComponent(department)}`);
        if (shareholder) queryParams.push(`shareholder=${encodeURIComponent(shareholder)}`);
        if (employmentType) queryParams.push(`employment_type=${encodeURIComponent(employmentType)}`);
        if (gender) queryParams.push(`gender=${encodeURIComponent(gender)}`);
        if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
        
        // Nếu không chọn bộ lọc nào, mặc định lấy toàn bộ (-1 để qua cổng kiểm tra thu nhập tối thiểu)
        if (queryParams.length === 0) {
            queryParams.push('amount=-1');
        }

        const url = `${apiBaseUrl}/employees/filter?${queryParams.join('&')}`;
        const response = await fetch(url);
        const resData = await response.json();

        if (!resData.success) {
            throw new Error(resData.error || 'Lỗi không xác định khi lọc');
        }

        const data = resData.data;

        // Xây dựng mô tả bộ lọc hiển thị cho CEO
        let descParts = [];
        if (search) descParts.push(`từ khóa "${search}"`);
        if (amount) descParts.push(`thu nhập năm ngoái > $${parseFloat(amount).toLocaleString()}`);
        if (department) descParts.push(`phòng ban ${department}`);
        if (shareholder) descParts.push(shareholder === 'Shareholder' ? 'cổ đông' : 'không phải cổ đông');
        if (employmentType) descParts.push(`loại hình ${employmentType}`);
        if (gender) descParts.push(gender === 'Male' ? 'nam' : 'nữ');
        
        const descText = descParts.length > 0 ? descParts.join(', ') : 'tất cả nhân sự';

        // Cập nhật số lượng kết quả
        countText.innerHTML = `<i class="fa-solid fa-people-group text-purple"></i> Kết quả lọc (${descText}): Tìm thấy <strong>${data.total_matching}</strong> nhân sự thỏa mãn`;

        if (data.total_matching === 0) {
            resultsGrid.innerHTML = `
                <div class="alert-empty">
                    <i class="fa-solid fa-magnifying-glass-minus" style="font-size: 2rem; margin-bottom: 12px; display: block; color: var(--text-muted);"></i>
                    Không tìm thấy nhân sự nào đáp ứng các tiêu chuẩn lọc hiện tại.
                </div>
            `;
            return;
        }

        // Render kết quả phân nhóm theo phòng ban
        let html = '';
        data.by_department.forEach(deptGroup => {
            html += `
                <div class="dept-result-group glass-panel">
                    <div class="dept-group-header">
                        <h4><i class="fa-solid fa-folder-open text-purple"></i> Phòng ban: ${deptGroup.department}</h4>
                        <span class="dept-count-badge">${deptGroup.employee_count} nhân sự thỏa mãn</span>
                    </div>
                    <div class="employees-cards-row">
            `;

            deptGroup.employees.forEach(emp => {
                const shareholderTag = emp.Shareholder_Status === 'Shareholder' 
                    ? '<span class="emp-shareholder-tag">Cổ đông</span>' 
                    : '';

                // Hiển thị cảnh báo nhỏ nếu quá ngày phép
                const isExceeded = emp.Vacation_Days_Used > 15;
                const vacationTag = isExceeded 
                    ? `<span class="badge" style="background:rgba(239,68,68,0.1); color:#EF4444; border: 1px solid rgba(239,68,68,0.15); font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 8px;"><i class="fa-solid fa-circle-exclamation"></i> Vượt phép (${emp.Vacation_Days_Used} ngày)</span>`
                    : '';

                html += `
                    <div class="employee-result-card clickable-card" onclick="showEmployeeProfile(${emp.Employee_ID})" title="Click để xem chi tiết hồ sơ liên kết">
                        ${shareholderTag}
                        <h5 class="emp-name">${emp.Full_Name}</h5>
                        <p class="emp-id">Mã số: #${emp.Employee_ID} • ${emp.Employment_Type} • ${emp.Gender}</p>
                        
                        <div class="emp-stats">
                            <span class="emp-stat-lbl">Năm ngoái:</span>
                            <span class="emp-stat-val text-muted">$${emp.Previous_Year_Income.toLocaleString()}</span>
                            <span class="emp-stat-lbl">Năm nay:</span>
                            <span class="emp-stat-val text-emerald" style="font-weight: 700;">$${emp.Current_Year_Income.toLocaleString()}</span>
                        </div>
                        ${vacationTag}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        resultsGrid.innerHTML = html;

    } catch (error) {
        console.error('❌ Lỗi thực thi filter:', error);
        resultsGrid.innerHTML = `
            <div class="alert-card critical" style="margin-top: 20px;">
                <span class="alert-card-icon">❌</span>
                <div class="alert-card-body">
                    <div class="alert-card-title">Lỗi truy vấn</div>
                    <div class="alert-card-msg">Không thể lọc dữ liệu từ máy chủ. Vui lòng kiểm tra lại kết nối API. Chi tiết: ${error.message}</div>
                </div>
            </div>
        `;
    }
}

