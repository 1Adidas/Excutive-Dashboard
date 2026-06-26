/**
 * ============================================================
 * CHARTS CONFIGURATION - CẤU HÌNH BIỂU ĐỒ CHART.JS
 * ============================================================
 * Quản lý các đối tượng biểu đồ Chart.js, áp dụng các màu sắc
 * và cấu hình cao cấp để khớp với chủ đề Glassmorphism Dark Theme.
 * ============================================================
 */

// Đối tượng lưu trữ các thực thể biểu đồ
const charts = {
    overviewIncome: null,
    overviewVacation: null,
    reportIncome: null,
    reportVacation: null
};

// Cấu hình phông chữ mặc định cho Chart.js
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = '#9CA3AF'; // text-secondary

/**
 * Tạo màu gradient cho cột biểu đồ
 * @param {CanvasRenderingContext2D} ctx - Context của canvas
 * @param {string} startColor - HSL/HEX bắt đầu
 * @param {string} endColor - HSL/HEX kết thúc
 * @returns {CanvasGradient}
 */
function createGradient(ctx, startColor, endColor) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
}

/**
 * Khởi tạo biểu đồ Tổng thu nhập theo phòng ban (Overview)
 * @param {string} canvasId 
 */
function initOverviewIncomeChart(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Tạo Gradients
    const gradCurrent = createGradient(ctx, '#8B5CF6', 'rgba(99, 102, 241, 0.2)'); // Purple
    const gradPrev = createGradient(ctx, '#06B6D4', 'rgba(59, 130, 246, 0.2)');  // Blue

    charts.overviewIncome = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Năm ngoái',
                    data: [],
                    backgroundColor: gradPrev,
                    borderColor: '#3B82F6',
                    borderWidth: 1.5,
                    borderRadius: 4
                },
                {
                    label: 'Năm nay',
                    data: [],
                    backgroundColor: gradCurrent,
                    borderColor: '#8B5CF6',
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    padding: 12,
                    backgroundColor: '#070A13',
                    titleColor: '#FFF',
                    bodyColor: '#D1D5DB',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Khởi tạo biểu đồ phân bổ ngày phép theo phòng ban (Overview)
 * @param {string} canvasId 
 */
function initOverviewVacationChart(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    charts.overviewVacation = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(236, 72, 153, 0.7)',  // Pink
                    'rgba(139, 92, 246, 0.7)',  // Purple
                    'rgba(6, 182, 212, 0.7)',   // Blue
                    'rgba(245, 158, 11, 0.7)',  // Orange
                    'rgba(16, 185, 129, 0.7)'   // Emerald
                ],
                borderColor: '#0B0F19',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, padding: 12 }
                },
                tooltip: {
                    padding: 12,
                    backgroundColor: '#070A13'
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * Cập nhật dữ liệu cho các biểu đồ màn hình Tổng Quan
 * @param {Array} incomeDetails - Details của Income Report
 * @param {Array} vacationDetails - Details của Vacation Report
 */
function updateOverviewCharts(incomeDetails, vacationDetails) {
    // 1. Cập nhật biểu đồ thu nhập
    if (charts.overviewIncome) {
        const labels = incomeDetails.map(d => d.group_name);
        const prevData = incomeDetails.map(d => d.total_previous_income);
        const currData = incomeDetails.map(d => d.total_current_income);

        charts.overviewIncome.data.labels = labels;
        charts.overviewIncome.data.datasets[0].data = prevData;
        charts.overviewIncome.data.datasets[1].data = currData;
        charts.overviewIncome.update();
    }

    // 2. Cập nhật biểu đồ nghỉ phép
    if (charts.overviewVacation) {
        const labels = vacationDetails.map(d => d.group_name);
        const data = vacationDetails.map(d => d.total_vacation_days);

        charts.overviewVacation.data.labels = labels;
        charts.overviewVacation.data.datasets[0].data = data;
        charts.overviewVacation.update();
    }
}

/**
 * Khởi tạo/Cập nhật biểu đồ màn hình Báo cáo thu nhập (Dynamic)
 * @param {string} canvasId 
 * @param {Array} details 
 */
function renderReportIncomeChart(canvasId, details) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (charts.reportIncome) {
        charts.reportIncome.destroy();
    }

    const labels = details.map(d => d.group_name);
    const prevData = details.map(d => d.total_previous_income);
    const currData = details.map(d => d.total_current_income);

    const gradCurrent = createGradient(ctx, '#EC4899', 'rgba(236, 72, 153, 0.1)'); // Pink-Red
    const gradPrev = createGradient(ctx, '#8B5CF6', 'rgba(139, 92, 246, 0.1)');   // Purple

    charts.reportIncome = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Quỹ lương năm trước',
                    data: prevData,
                    backgroundColor: gradPrev,
                    borderColor: '#8B5CF6',
                    borderWidth: 1.5,
                    borderRadius: 4
                },
                {
                    label: 'Quỹ lương năm nay',
                    data: currData,
                    backgroundColor: gradCurrent,
                    borderColor: '#EC4899',
                    borderWidth: 1.5,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: {
                        callback: function(val) {
                            return '$' + val.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

/**
 * Khởi tạo/Cập nhật biểu đồ màn hình Báo cáo nghỉ phép (Dynamic)
 * @param {string} canvasId 
 * @param {Array} details 
 */
function renderReportVacationChart(canvasId, details) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    if (charts.reportVacation) {
        charts.reportVacation.destroy();
    }

    const labels = details.map(d => d.group_name);
    const data = details.map(d => d.avg_vacation_days); // Dùng số trung bình để so sánh trực quan hơn

    const gradBar = createGradient(ctx, '#06B6D4', 'rgba(6, 182, 212, 0.15)');

    charts.reportVacation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ngày nghỉ phép trung bình / NV',
                data: data,
                backgroundColor: gradBar,
                borderColor: '#06B6D4',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    title: {
                        display: true,
                        text: 'Ngày nghỉ trung bình'
                    }
                }
            }
        }
    });
}
