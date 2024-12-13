// 独立数据库配置
const configDBConfig = {
    apiKey: "AIzaSyB-pZD5Mb8pejzBr3ZuHoFkJipzSWLJCpo",
    authDomain: "jizhang-2e89a.firebaseapp.com",
    databaseURL: "https://jizhang-2e89a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "jizhang-2e89a",
    storageBucket: "jizhang-2e89a.firebasestorage.app",
    messagingSenderId: "849349607897",
    appId: "1:849349607897:web:e0eb3a2222cac60d3b99c8",
    measurementId: "G-SYL25YT9ZC"
};

// 全局变量
let configApp = firebase.initializeApp(configDBConfig, "configApp");
let configDB = firebase.database(configApp);
let currentApp = null;
let currentDB = null;
let currentTable = null;
let selectedFields = [];
let draggedElement = null;
let isEditing = false;
let isSearching = false;
let originalData = null;
let deleteKey = null;
let isBatchOperation = false; // 用于跟踪是否是批量操作导致的状态改变
let bottomBlockSaveMode = false; // 用于跟踪底部块是否处于保存模式

// 弹窗相关函数
function showConfigModal() {
    document.getElementById('configModal').style.display = 'block';
}

function showDatabaseModal() {
    document.getElementById('databaseModal').style.display = 'block';
    loadDatabases();
}

// 显示提示框函数
function showToast(message, type = 'warning') {  // 默认使用warning类型
    const toast = document.getElementById('toast');
    const toastContent = toast.querySelector('.toast-content');
    
    // 清除之前的所有类型类名
    toast.classList.remove('info', 'warning', 'error');
    
    // 添加新的类型类名
    toast.classList.add(type);
    
    // 设置消息内容
    toastContent.textContent = message;
    
    // 显示提示框
    toast.classList.add('show');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        // 延迟后清除类型类名
        setTimeout(() => {
            toast.classList.remove(type);
        }, 500);
    }, 3000);
}

// 关闭弹窗框事件
// 添加关闭配置弹窗的函数
function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

// 数据库选择弹窗关闭函数
function closeDatabaseModal() {
    document.getElementById('databaseModal').style.display = 'none';
}

// 搜索弹窗关闭函数
function closeSearchModal() {
    document.getElementById('searchModal').style.display = 'none';
}

// 删除确认弹窗关闭函数
function closeDeleteConfirm() {
    document.getElementById('删除确认弹窗').style.display = 'none';
    deleteKey = null;
}

// 数据库加载和操作函数
async function loadDatabases() {
    const dbSelect = document.getElementById('databaseSelect');
    dbSelect.innerHTML = '<option value="">请选择数据库</option>';

    try {
        const snapshot = await configDB.ref('database').once('value');
        const configs = snapshot.val() || {};

        Object.keys(configs).forEach(dbName => {
            const option = document.createElement('option');
            option.value = dbName;
            option.textContent = dbName;
            dbSelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载数据库列表失败：', error);
    }
}

// 检查表格记录是否为编辑状态并更新操作块状态
function checkAndUpdateOperationsBlock() {
    const editingRows = document.querySelectorAll('#tableBody tr.editing');
    const allRows = document.querySelectorAll('#tableBody tr:not(.新增行)');
    
    if (allRows.length === 0) return;
    
    // 如果是批量操作，直接返回
    if (isBatchOperation) return;

    // 如果不是保存模式，且所有记录都是编辑状态，则变为保存模式
    if (!bottomBlockSaveMode && editingRows.length === allRows.length) {
        bottomBlockSaveMode = true;
        updateOperationsBlockStatus(true);
    }
    // 如果是保存模式，且没有任何编辑状态的记录，则变回操作模式
    else if (bottomBlockSaveMode && editingRows.length === 0) {
        bottomBlockSaveMode = false;
        updateOperationsBlockStatus(false);
    }
}



async function loadTables() {
    const dbName = document.getElementById('databaseSelect').value;
    const tableSelect = document.getElementById('tableSelect');
    tableSelect.innerHTML = '<option value="">请选择数据表</option>';

    if (!dbName) return;

    try {
        const snapshot = await configDB.ref('database').child(dbName).once('value');
        const config = snapshot.val();

        if (currentDB !== dbName) {
            if (currentApp) {
                currentApp.delete();
            }
            currentApp = firebase.initializeApp(JSON.parse(config.config), dbName);
            currentDB = dbName;
        }

        const database = firebase.database(currentApp);
        const tablesSnapshot = await database.ref('/').once('value');
        const tables = tablesSnapshot.val() || {};

        Object.keys(tables).forEach(tableName => {
            const option = document.createElement('option');
            option.value = tableName;
            option.textContent = tableName;
            tableSelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载数据表失败：', error);
    }
}

async function loadFields() {
    const tableName = document.getElementById('tableSelect').value;
    const fieldOptions = document.getElementById('fieldOptions');
    fieldOptions.innerHTML = '';
    selectedFields = [];

    if (!tableName || !currentApp) return;

    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(tableName).once('value');
        const allData = snapshot.val();

        if (!allData) return;

        const fieldsSet = new Set();

        // 遍历所有记录获取全部字段
        Object.values(allData).forEach(record => {
            if (record && typeof record === 'object') {
                Object.keys(record).forEach(field => fieldsSet.add(field));
            }
        });

        // 转换为数组并创建选项
        // loadFields 函数中创建字段选项
        Array.from(fieldsSet).sort().forEach(field => {
            const div = document.createElement('div');
            div.className = '字段选项-styled';  // 类名
            div.textContent = field;
            div.draggable = true;

            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);

            div.onclick = (e) => {
                if (e.target.dragging) return;
                toggleFieldSelection(div, field);
            };

            fieldOptions.appendChild(div);
        });

        fieldOptions.addEventListener('dragover', handleDragOver);
        fieldOptions.addEventListener('drop', handleDrop);
    } catch (error) {
        console.error('加载字段失败：', error);
    }
}

// 字段选择和拖拽相关函数
function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.target.dragging = true;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.textContent);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    setTimeout(() => e.target.dragging = false, 0);
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    if (!draggedElement) return;

    const dropTarget = e.target.classList.contains('字段选项') ? e.target : e.target.querySelector('.字段选项');

    if (dropTarget && dropTarget !== draggedElement) {
        const fields = Array.from(document.querySelectorAll('.字段选项'));
        const fromIndex = fields.indexOf(draggedElement);
        const toIndex = fields.indexOf(dropTarget);

        if (fromIndex !== -1 && toIndex !== -1) {
            const parent = draggedElement.parentNode;
            if (fromIndex < toIndex) {
                parent.insertBefore(draggedElement, dropTarget.nextSibling);
            } else {
                parent.insertBefore(draggedElement, dropTarget);
            }
            updateSelectedFieldsOrder();
        }
    }
}

function updateSelectedFieldsOrder() {
    selectedFields = Array.from(document.querySelectorAll('.字段选项'))
        .filter(field => field.classList.contains('selected'))
        .map(field => field.textContent);
}

function toggleFieldSelection(element, field) {
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedFields = selectedFields.filter(f => f !== field);
    } else {
        element.classList.add('selected');
        selectedFields = [...selectedFields.filter(f => f !== field), field];
    }
}

// 表格相关函数
async function applySelection() {

    if (isEditing) {
        showToast('请先保存编辑状态的记录！', 'warning');
        return;
    }

    const tableName = document.getElementById('tableSelect').value;
    if (!tableName || selectedFields.length === 0) {
        showToast('请选择数据表和字段！', 'warning');
        return;
    }

    document.documentElement.style.setProperty('--column-count', selectedFields.length);
    currentTable = tableName;
    document.getElementById('databaseModal').style.display = 'none';

    const headerRow = document.querySelector('#dataTable thead tr');
    headerRow.innerHTML = '<th>序号</th>';

    selectedFields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        th.className = '数据列';
        headerRow.appendChild(th);
    });

    const operationTh = document.createElement('th');
    operationTh.textContent = '操作';
    operationTh.className = '操作列';
    headerRow.appendChild(operationTh);

    const checkboxTh = document.createElement('th');
    checkboxTh.className = '复选框列';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.onclick = function () { toggleSelectAll(this); };
    checkboxTh.appendChild(checkbox);
    headerRow.appendChild(checkboxTh);

    await loadTableData();
}

async function loadTableData() {
    if (!currentTable || !currentApp) return;

    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(currentTable).once('value');
        let serverData = snapshot.val() || {};
        
        // 获取新增未保存的记录
        const newRecords = Array.from(document.querySelectorAll('tr.was-new-record'))
            .reduce((records, row) => {
                const key = row.querySelector('input[type="checkbox"]').value;
                const record = {};
                selectedFields.forEach((field, index) => {
                    const input = row.querySelectorAll('.数据列 input')[index];
                    record[field] = input?.value || '';
                });
                records[key] = record;
                return records;
            }, {});

        // 合并数据
        const data = { ...serverData, ...newRecords };
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        Object.entries(data).forEach(([key, row], index) => {
            const tr = document.createElement('tr');
            if (row.editing) tr.classList.add('editing');
            // 保持新增记录标记
            if (newRecords[key]) {
                tr.classList.add('was-new-record');
                tr.classList.add('editing');
            }

            const indexTd = document.createElement('td');
            indexTd.textContent = index + 1;
            tr.appendChild(indexTd);

            selectedFields.forEach(field => {
                const td = document.createElement('td');
                td.className = `数据列 field-${field}`;
                td.dataset.key = key;
                
                if (newRecords[key]) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = row[field] || '';
                    td.appendChild(input);
                } else {
                    td.textContent = row[field] || '';
                }
                tr.appendChild(td);
            });

            const operationTd = document.createElement('td');
            operationTd.className = '操作列';
            operationTd.innerHTML = (row.editing || newRecords[key]) ?
                `<button class="按钮 save-icon" onclick="saveRecord('${key}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                </button>` :
                `<div class="dropdown">
                    <button class="按钮" onclick="toggleDropdown(this)">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="3" r="1.5"/>
                            <circle cx="8" cy="8" r="1.5"/>
                            <circle cx="8" cy="13" r="1.5"/>
                        </svg>
                    </button>
                    <div class="dropdown-content">
                        <a href="#" onclick="visitRecord('${key}')">访问</a>
                        <a href="#" onclick="editRecord('${key}')">编辑</a>
                        <a href="#" onclick="reviewRecord('${key}')">审核</a>
                        <a href="#" onclick="toggleState('${key}')">状态</a>
                        <a href="#" onclick="deleteRecord('${key}')">删除</a>
                    </div>
                </div>`;
            tr.appendChild(operationTd);

            const checkboxTd = document.createElement('td');
            checkboxTd.className = '复选框列';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = key;
            checkboxTd.appendChild(checkbox);
            tr.appendChild(checkboxTd);

            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('加载表格数据失败：', error);
    }
    // 在表格数据加载完成后添加新增行
    addNewRecordRow();
}

// 记录批量操作相关函数
// 修改操作菜单点击事件处理
function toggleDropdown(button) {
    // 先关闭所有其他打开的下拉菜单
    closeAllDropdowns();

    const dropdownContent = button.nextElementSibling;
    const isVisible = dropdownContent.style.display === 'block';

    // 切换当前下拉菜单的显示状态
    dropdownContent.style.display = isVisible ? 'none' : 'block';

    // 如果显示下拉菜单，添加点击外部关闭的事件监听
    if (!isVisible) {
        const closeMenu = function (e) {
            if (!button.parentElement.contains(e.target)) {
                dropdownContent.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        };

        // 延迟添加事件监听，避免立即触发
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
}

function showOperationsModal() {
    const operationsBlock = document.getElementById('操作项块');
    const existingMenu = document.querySelector('.batch-operations-menu');

    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const menu = document.createElement('div');
    menu.className = 'batch-operations-menu';
    
    // 设置菜单内容
    menu.innerHTML = `
        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); batchEdit(); document.querySelector('.batch-operations-menu').remove();">编辑</a>
        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); batchReview();document.querySelector('.batch-operations-menu').remove()">审核</a>
        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); batchToggleState();document.querySelector('.batch-operations-menu').remove()">状态</a>
        <a href="#" onclick="event.preventDefault(); event.stopPropagation(); batchDelete();document.querySelector('.batch-operations-menu').remove()">删除</a>
    `;

    // 添加菜单到body
    document.body.appendChild(menu);
    menu.style.display = 'block';

    // 计算菜单位置
    const operationsBlockRect = operationsBlock.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 默认位置在操作块的上方
    let top = operationsBlockRect.top - menuRect.height;
    let left = operationsBlockRect.left;

    // 如果上方空间不足，则显示在下方
    if (top < 0) {
        top = operationsBlockRect.bottom;
    }

    // 确保左侧不超出视口
    if (left < 0) {
        left = 0;
    }

    // 确保右侧不超出视口
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width;
    }

    // 确保底部不超出视口
    if (top + menuRect.height > viewportHeight) {
        top = viewportHeight - menuRect.height;
    }

    // 应用计算后的位置
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    // 点击其他区域关闭菜单
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && !operationsBlock.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

// 全局函数关闭所有打开的下拉菜单（用于访问url失败，关闭下拉菜单）
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-content');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
}

async function visitRecord(key) {
    if (!currentApp || !currentTable) return;

    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(`${currentTable}/${key}`).once('value');
        const record = snapshot.val();
        
        // 先关闭所有菜单
        closeAllDropdowns();

        if (record && record.url) {
            window.open(record.url, '_blank');
        } else {
            showToast('该记录没有可访问的URL！', 'error');
        }
    } catch (error) {
        console.error('访问记录失败：', error);
        closeAllDropdowns();
        showToast('访问记录失败，请重试！', 'error');
    }
}

function editRecord(key) {
    const row = document.querySelector(`input[value="${key}"]`).closest('tr');
    row.classList.add('editing');

    const cells = row.querySelectorAll('.数据列');
    cells.forEach(cell => {
        const originalText = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        cell.innerHTML = '';
        cell.appendChild(input);
    });

    const operationCell = row.querySelector('.操作列');
    operationCell.innerHTML = `
        <button class="按钮 save-icon" onclick="saveRecord('${key}')">
            ${SVG_ICONS.SAVE}
        </button>
    `;

    checkAndUpdateOperationsBlock();
}


async function saveRecord(key) {
    if (!currentApp || !currentTable) return;

    const row = document.querySelector(`input[value="${key}"]`).closest('tr');
    const updates = {};

    row.querySelectorAll('.数据列').forEach(cell => {
        const input = cell.querySelector('input');
        const fieldName = cell.className.split('field-')[1].split(' ')[0];
        updates[fieldName] = input.value;
    });

    try {
        // 不设置批量操作标志，让状态检查生效
        const database = firebase.database(currentApp);
        await database.ref(`${currentTable}/${key}`).update(updates);

        row.classList.remove('editing');
        row.querySelectorAll('.数据列').forEach(cell => {
            const input = cell.querySelector('input');
            cell.textContent = input.value;
        });

        restoreOperationButton(row, key);
        
        // 检查表格状态并更新底部块
        checkAndUpdateOperationsBlock();

    } catch (error) {
        console.error('保存记录失败：', error);
        showToast('保存记录失败，请重试！', 'error');
    }
}



/**
 * reviewRecord - 审核单条记录
 * 功能说明:
 * 1. 对单条记录进行审核状态切换
 * 2. 独立于其他记录的编辑状态
 * 3. 支持在搜索状态下更新记录
 * 4. 自动更新UI显示和本地数据缓存
 * 5. 保持其他记录的所有状态不变
 * 
 * @param {string} key - 要审核的记录的唯一标识符
 */
async function reviewRecord(key) {
    if (!currentApp || !currentTable) return;
    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(`${currentTable}/${key}`).once('value');
        const record = snapshot.val();
        const status = record.status === '已审核' ? '未审核' : '已审核';
        await database.ref(`${currentTable}/${key}`).update({ status });

        // 更新 originalData（如果在搜索状态）
        if (originalData && originalData[key]) {
            originalData[key].status = status;
        }

        // 保存当前所有记录的编辑状态
        const editingState = Array.from(document.querySelectorAll('#tableBody tr.editing'))
            .map(row => ({
                key: row.querySelector('input[type="checkbox"]').value,
                inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input.value)
            }));

        // 根据搜索状态重新加载数据
        if (isSearching) {
            await performSearch();
        } else {
            await loadTableData();
        }

        // 恢复所有记录的编辑状态
        editingState.forEach(state => {
            const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
            if (row) {
                row.classList.add('editing');
                row.querySelectorAll('.数据列').forEach((cell, index) => {
                    cell.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = state.inputs[index] || '';
                    cell.appendChild(input);
                });

                const operationCell = row.querySelector('.操作列');
                operationCell.innerHTML = `
                    <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                `;
            }
        });
    } catch (error) {
        console.error('审核记录失败：', error);
    }
}


/**
 * toggleState - 切换单条记录的状态
 * 功能说明:
 * 1. 对单条记录进行有效/无效状态切换
 * 2. 独立于其他记录的编辑状态
 * 3. 支持在搜索状态下更新记录
 * 4. 自动更新UI显示和本地数据缓存
 * 5. 保持其他记录的所有状态不变
 * 
 * @param {string} key - 要切换状态的记录的唯一标识符
 */
async function toggleState(key) {
    if (!currentApp || !currentTable) return;
    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(`${currentTable}/${key}`).once('value');
        const record = snapshot.val();
        const state = record.state === '有效' ? '无效' : '有效';
        await database.ref(`${currentTable}/${key}`).update({ state });

        // 更新 originalData（如果在搜索状态）
        if (originalData && originalData[key]) {
            originalData[key].state = state;
        }

        // 保存当前所有记录的编辑状态
        const editingState = Array.from(document.querySelectorAll('#tableBody tr.editing'))
            .map(row => ({
                key: row.querySelector('input[type="checkbox"]').value,
                inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input.value)
            }));

        // 根据搜索状态重新加载数据
        if (isSearching) {
            await performSearch();
        } else {
            await loadTableData();
        }

        // 恢复所有记录的编辑状态
        editingState.forEach(state => {
            const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
            if (row) {
                row.classList.add('editing');
                row.querySelectorAll('.数据列').forEach((cell, index) => {
                    cell.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = state.inputs[index] || '';
                    cell.appendChild(input);
                });

                const operationCell = row.querySelector('.操作列');
                operationCell.innerHTML = `
                    <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                `;
            }
        });
    } catch (error) {
        console.error('切换状态失败：', error);
    }
}



/**
 * deleteRecord - 删除单条记录
 * 功能说明:
 * 1. 对单条记录进行删除操作
 * 2. 独立于其他记录的编辑状态
 * 3. 弹出确认框防止误操作
 * 4. 自动更新UI显示和本地数据缓存
 * 5. 保持其他记录的所有状态不变
 * 
 * @param {string} key - 要删除的记录的唯一标识符
 */
async function deleteRecord(key) {
    if (!currentApp || !currentTable) return;
    
    deleteKey = key;
    document.getElementById('删除确认弹窗').style.display = 'block';
}

// 批量操作相关函数
function toggleSelectAll(checkbox) {
    const checkboxes = document.querySelectorAll('#tableBody input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

/**
 * 批量编辑函数
 * 功能：
 * 1. 将选中的非编辑状态记录转换为编辑状态
 * 2. 自动检测是否存在编辑状态的记录
 * 3. 不影响记录进行单独操作
 */
async function batchEdit() {
    const checkedCheckboxes = document.querySelectorAll('#tableBody input[type="checkbox"]:checked');
    
    if (checkedCheckboxes.length === 0) {
        showToast('你还没有选择需要编辑的记录！', 'warning');
        return;
    }

    const hasNonEditingRows = Array.from(checkedCheckboxes).some(checkbox => 
        !checkbox.closest('tr').classList.contains('editing')
    );

    if (!hasNonEditingRows) {
        showToast('选中的记录都已处于编辑状态！', 'info');
        return;
    }

    isBatchOperation = true;

    checkedCheckboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (!row.classList.contains('editing')) {
            row.classList.add('editing');
            
            // 保持新增记录的标记
            if (row.classList.contains('was-new-record')) {
                row.classList.add('was-new-record');
            }
            
            row.querySelectorAll('.数据列').forEach(cell => {
                const currentValue = cell.textContent;
                cell.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentValue;
                cell.appendChild(input);
            });

            const key = checkbox.value;
            const operationCell = row.querySelector('.操作列');
            operationCell.innerHTML = `
                <button class="按钮 save-icon" onclick="saveRecord('${key}')">
                    ${SVG_ICONS.SAVE}
                </button>
            `;
        }
    });

    // 直接设置为保存模式
    bottomBlockSaveMode = true;
    updateOperationsBlockStatus(true);
    
    isBatchOperation = false;
}


/**
 * 批量保存函数
 * 功能说明:
 * 1. 保存选中的且处于编辑状态的记录
 * 2. 点击保存按钮时立即恢复底部为操作状态
 * 3. 保持未选中保存的记录的编辑状态
 * 4. 维持搜索状态和搜索结果
 * 5. 保持搜索界面的UI状态
 * 
 * @returns {Promise<void>}
 */
async function batchSave() {
    try {
        const checkedEditingRows = Array.from(document.querySelectorAll('#tableBody input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.closest('tr'))
            .filter(row => row.classList.contains('editing'));
        
        if (checkedEditingRows.length === 0) {
            showToast('没有选中需要保存的记录！', 'warning');
            return;
        }

        isBatchOperation = true;

        const savedKeys = [];
        for (const row of checkedEditingRows) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            const key = checkbox.value;
            const updates = {};

            row.querySelectorAll('.数据列').forEach(cell => {
                const input = cell.querySelector('input');
                if (!input) return;
                
                const fieldName = cell.className.split('field-')[1]?.split(' ')[0];
                if (fieldName) {
                    updates[fieldName] = input.value;
                }
            });

            // 更新数据库
            if (Object.keys(updates).length > 0) {
                const database = firebase.database(currentApp);
                // 检查是否为新增记录（新增的行会有特定的类名标记）
                if (row.classList.contains('was-new-record')) {
                    // 新增记录使用 set
                    await database.ref(`${currentTable}/${key}`).set(updates);
                } else {
                    // 现有记录使用 update
                    await database.ref(`${currentTable}/${key}`).update(updates);
                }

                if (originalData && originalData[key]) {
                    originalData[key] = { ...originalData[key], ...updates };
                }

                savedKeys.push(key);
            }
        }

        // 直接设置为操作模式
        bottomBlockSaveMode = false;
        updateOperationsBlockStatus(false);

        if (isSearching && originalData) {
            const searchInput = document.getElementById('searchInput').value.trim();
            const isOrMode = searchInput.includes('|');
            const keywords = isOrMode 
                ? searchInput.split('|')
                : searchInput.split(/[,，]/);
            
            const cleanedKeywords = keywords
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0);

            const filteredData = Object.entries(originalData).reduce((filtered, [key, record]) => {
                const recordString = Object.values(record)
                    .filter(value => value != null)
                    .map(value => String(value).toLowerCase())
                    .join(' ');

                let matches;
                if (isOrMode) {
                    matches = cleanedKeywords.some(keyword =>
                        recordString.includes(keyword)
                    );
                } else {
                    matches = cleanedKeywords.every(keyword =>
                        recordString.includes(keyword)
                    );
                }

                if (matches) {
                    filtered[key] = record;
                }
                return filtered;
            }, {});

            updateTableDisplay(filteredData, savedKeys);
            updateSearchUI(true);
        } else {
            const currentData = await getCurrentTableData();
            updateTableDisplay(currentData, savedKeys);
        }

        showToast('选中的记录已保存成功！', 'success');

    } catch (error) {
        console.error('批量保存失败：', error);
        showToast('保存失败，请重试！', 'error');
    } finally {
        isBatchOperation = false;
    }
}


/**批量审核函数 **/
async function batchReview() {
    // 获取所有非编辑状态的选中记录
    const checkboxes = Array.from(document.querySelectorAll('#tableBody input[type="checkbox"]:checked'))
        .filter(checkbox => !checkbox.closest('tr').classList.contains('editing'));

    if (checkboxes.length === 0) {
        showToast('你还没有选择需要审核的记录！', 'warning');
        return;
    }

    try {
        const database = firebase.database(currentApp);
        // 保存选中的记录keys
        const selectedKeys = checkboxes.map(checkbox => checkbox.value);

        for (const checkbox of checkboxes) {
            const key = checkbox.value;
            const snapshot = await database.ref(`${currentTable}/${key}`).once('value');
            const record = snapshot.val();
            const status = record.status === '已审核' ? '未审核' : '已审核';
            await database.ref(`${currentTable}/${key}`).update({ status });

            if (originalData && originalData[key]) {
                originalData[key].status = status;
            }
        }

        // 保存当前编辑状态
        const editingRows = Array.from(document.querySelectorAll('#tableBody tr.editing'));
        const editingState = editingRows.map(row => ({
            key: row.querySelector('input[type="checkbox"]').value,
            inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input.value)
        }));

        // 更新表格显示
        if (isSearching) {
            await performSearch();
        } else {
            await loadTableData();
        }

        // 恢复编辑状态
        editingState.forEach(state => {
            const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
            if (row) {
                row.classList.add('editing');
                row.querySelectorAll('.数据列').forEach((cell, index) => {
                    cell.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = state.inputs[index] || '';
                    cell.appendChild(input);
                });

                const operationCell = row.querySelector('.操作列');
                operationCell.innerHTML = `
                    <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                `;
            }
        });

        // 恢复选中状态
        selectedKeys.forEach(key => {
            const checkbox = document.querySelector(`input[type="checkbox"][value="${key}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });

    } catch (error) {
        console.error('批量审核失败：', error);
        showToast('审核失败，请重试！', 'warning');
    }
}

/** 批量切换函数 **/
async function batchToggleState() {
    const checkboxes = Array.from(document.querySelectorAll('#tableBody input[type="checkbox"]:checked'))
        .filter(checkbox => !checkbox.closest('tr').classList.contains('editing'));

    if (checkboxes.length === 0) {
        showToast('你还没有选择需要切换状态的记录！', 'warning');
        return;
    }

    try {
        const database = firebase.database(currentApp);
        // 保存选中的记录keys
        const selectedKeys = checkboxes.map(checkbox => checkbox.value);

        for (const checkbox of checkboxes) {
            const key = checkbox.value;
            const snapshot = await database.ref(`${currentTable}/${key}`).once('value');
            const record = snapshot.val();
            const state = record.state === '有效' ? '无效' : '有效';
            await database.ref(`${currentTable}/${key}`).update({ state });

            if (originalData && originalData[key]) {
                originalData[key].state = state;
            }
        }

        // 保存当前编辑状态
        const editingRows = Array.from(document.querySelectorAll('#tableBody tr.editing'));
        const editingState = editingRows.map(row => ({
            key: row.querySelector('input[type="checkbox"]').value,
            inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input.value)
        }));

        // 更新表格显示
        if (isSearching) {
            await performSearch();
        } else {
            await loadTableData();
        }

        // 恢复编辑状态
        editingState.forEach(state => {
            const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
            if (row) {
                row.classList.add('editing');
                row.querySelectorAll('.数据列').forEach((cell, index) => {
                    cell.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = state.inputs[index] || '';
                    cell.appendChild(input);
                });

                const operationCell = row.querySelector('.操作列');
                operationCell.innerHTML = `
                    <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                    </button>
                `;
            }
        });

        // 恢复选中状态
        selectedKeys.forEach(key => {
            const checkbox = document.querySelector(`input[type="checkbox"][value="${key}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });

    } catch (error) {
        console.error('批量切换状态失败：', error);
        showToast('切换状态失败，请重试！！', 'warning');
    }
}

// 打开删除确认弹窗 - 批量删除
async function batchDelete() {
    const checkboxes = document.querySelectorAll('#tableBody input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        showToast('你还没有选择需要删除的记录！', 'warning');
        return;
    }
    deleteKey = Array.from(checkboxes).map(cb => cb.value);
    document.getElementById('删除确认弹窗').style.display = 'block';
}

// 关闭删除确认弹窗
function closeDeleteConfirm() {
    document.getElementById('删除确认弹窗').style.display = 'none';
    deleteKey = null;
}

function restoreOperationButton(row, key) {
    const operationCell = row.querySelector('.操作列');
    operationCell.innerHTML = createOperationMenu(key);
}

/**
 * confirmDelete - 确认删除记录
 * 功能说明:
 * 1. 执行单条或批量记录的删除操作
 * 2. 保持其他记录的编辑状态不变
 * 3. 支持在搜索状态下删除记录
 * 4. 自动更新UI显示和本地数据缓存
 * 5. 删除后恢复所有未删除记录的编辑状态
 */
async function confirmDelete() {
    if (!deleteKey) return;

    try {
        const database = firebase.database(currentApp);

        // 保存当前所有记录的编辑状态
        const editingState = Array.from(document.querySelectorAll('#tableBody tr.editing'))
            .map(row => ({
                key: row.querySelector('input[type="checkbox"]').value,
                inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input.value)
            }));

        // 处理批量删除
        if (Array.isArray(deleteKey)) {
            for (const key of deleteKey) {
                await database.ref(`${currentTable}/${key}`).remove();
                
                // 从 originalData 中删除记录
                if (originalData && originalData[key]) {
                    delete originalData[key];
                }
            }
        } 
        // 处理单条记录删除
        else {
            await database.ref(`${currentTable}/${deleteKey}`).remove();
            
            // 从 originalData 中删除记录
            if (originalData && originalData[deleteKey]) {
                delete originalData[deleteKey];
            }
        }

        // 根据搜索状态重新加载数据
        if (isSearching) {
            await performSearch();
        } else {
            await loadTableData();
        }

        // 恢复未被删除记录的编辑状态
        editingState.forEach(state => {
            // 检查记录是否被删除
            const wasDeleted = Array.isArray(deleteKey) 
                ? deleteKey.includes(state.key)
                : state.key === deleteKey;

            if (!wasDeleted) {
                const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
                if (row) {
                    row.classList.add('editing');
                    row.querySelectorAll('.数据列').forEach((cell, index) => {
                        cell.innerHTML = '';
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = state.inputs[index] || '';
                        cell.appendChild(input);
                    });

                    const operationCell = row.querySelector('.操作列');
                    operationCell.innerHTML = `
                        <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                        </button>
                    `;
                }
            }
        });

    } catch (error) {
        console.error('删除记录失败：', error);
    } finally {
        // 关闭确认弹窗并清理 deleteKey
        closeDeleteConfirm();
    }
}

function restoreOperationsBlock() {
    const operationsBlock = document.getElementById('操作项块');
    operationsBlock.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M3 21H21" />
            <path d="M5 21V7L13 3V21" />
            <path d="M19 21V11L13 7" />
            <path d="M9 9V9.01" />
            <path d="M9 13V13.01" />
            <path d="M9 17V17.01" />
        </svg>
        <span>操作</span>
    `;
    operationsBlock.className = '功能块';
    operationsBlock.onclick = showOperationsModal;
}

async function addConfig() {
    const dbName = document.getElementById('dbName').value.trim();
    const dbConfig = document.getElementById('dbConfig').value.trim();

    if (!dbName || !dbConfig) {
        showToast('请填写完整的配置信息！', 'warning');
        return;
    }

    try {
        let config;
        if (dbConfig.includes('const firebaseConfig =')) {
            config = dbConfig.replace('const firebaseConfig =', '')
                .replace(/;$/, '')
                .trim();
        } else {
            config = dbConfig.trim();
        }

        try {
            config = JSON.parse(config);
        } catch (e) {
            config = eval('(' + config + ')');
        }

        const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        const missingFields = requiredFields.filter(field => !config[field]);

        if (missingFields.length > 0) {
            showToast('缺少必要的配置字段: ' + missingFields.join(', '), 'error');
            return;
        }

        // 检查是否存在同名配置
        const snapshot = await configDB.ref('database').once('value');
        const configs = snapshot.val() || {};
        let existingKey = null;

        Object.entries(configs).forEach(([key, value]) => {
            if (value.name === dbName) {
                existingKey = key;
            }
        });

        if (existingKey) {
            // 更新现有配置
            await configDB.ref('database').child(existingKey).set({
                name: dbName,
                config: JSON.stringify(config)
            });
        } else {
            // 添加新配置
            const newKey = Date.now().toString();
            await configDB.ref('database').child(newKey).set({
                name: dbName,
                config: JSON.stringify(config)
            });
        }

        alert('配置' + (existingKey ? '更新' : '添加') + '成功！');
        document.getElementById('configModal').style.display = 'none';
    } catch (error) {
        console.error('配置操作失败：', error);
        showToast('配置格式错误，请检查！', 'error');
    }
}

async function loadDatabases() {
    const dbSelect = document.getElementById('databaseSelect');
    dbSelect.innerHTML = '<option value="">请选择数据库</option>';

    try {
        const snapshot = await configDB.ref('database').once('value');
        const configs = snapshot.val() || {};

        Object.entries(configs).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value.name;
            dbSelect.appendChild(option);
        });
    } catch (error) {
        console.error('加载数据库列表失败：', error);
    }
}

async function deleteConfig() {
    const dbName = document.getElementById('dbName').value.trim();

    if (!dbName) {
        showToast('请输入要删除的数据库名称！', 'warning');
        return;
    }

    if (!confirm(`确定要删除数据库 "${dbName}" 的配置吗？`)) return;

    try {
        const snapshot = await configDB.ref('database').once('value');
        const configs = snapshot.val() || {};

        // 查找匹配的数据库记录
        const matchingKey = Object.entries(configs).find(([key, value]) =>
            value.name === dbName
        )?.[0];

        if (!matchingKey) {
            showToast('未找到该数据库配置！', 'error');
            return;
        }

        await configDB.ref('database').child(matchingKey).remove();
        showToast('配置删除成功！', 'info');
        document.getElementById('configModal').style.display = 'none';
    } catch (error) {
        console.error('删除配置失败：', error);
        showToast('删除配置失败，请重试！', 'error');
    }
}

// 切换搜索状态
function toggleSearch() {
    if (isSearching) {
        cancelSearch();
    } else {
        showSearchModal();
    }
}

// 显示搜索模态框
function showSearchModal() {
    document.getElementById('searchModal').style.display = 'block';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').focus();
}

// 关闭搜索模态框
function closeSearchModal() {
    document.getElementById('searchModal').style.display = 'none';
}

// 执行搜索
async function performSearch() {
    const searchInput = document.getElementById('searchInput').value.trim();

    if (!searchInput) {
        showToast('请输入搜索关键字！', 'warning');
        return;
    }

    if (!originalData) {
        originalData = await getCurrentTableData();
    }

    console.log('原始数据：', originalData); // 添加调试日志

    // 检查搜索模式
    const isOrMode = searchInput.includes('|');

    // 分割关键字
    const keywords = isOrMode
        ? searchInput.split('|')
        : searchInput.split(/[,，]/);

    const cleanedKeywords = keywords
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

    console.log('搜索关键字：', cleanedKeywords); // 添加调试日志

    if (cleanedKeywords.length === 0) {
        showToast('请输入有效的搜索关键字！', 'warning');
        return;
    }

    const filteredData = Object.entries(originalData).reduce((filtered, [key, record]) => {
        const recordString = Object.values(record)
            .filter(value => value != null)  // 过滤空值
            .map(value => String(value).toLowerCase())
            .join(' ');

        console.log('记录字符串：', recordString); // 添加调试日志

        let matches;
        if (isOrMode) {
            matches = cleanedKeywords.some(keyword =>
                recordString.includes(keyword)
            );
        } else {
            matches = cleanedKeywords.every(keyword =>
                recordString.includes(keyword)
            );
        }

        if (matches) {
            filtered[key] = record;
        }
        return filtered;
    }, {});

    console.log('筛选后数据：', filteredData); // 添加调试日志

    updateTableDisplay(filteredData);
    updateSearchUI(true);
    closeSearchModal();
}

// 取消搜索
function cancelSearch() {
    if (originalData) {
        updateTableDisplay(originalData);
        originalData = null;
    }
    updateSearchUI(false);
}

// 更新搜索UI
function updateSearchUI(searching) {
    isSearching = searching;
    const searchBlock = document.getElementById('搜索块');
    const searchIcon = document.getElementById('searchIcon');
    const searchText = document.getElementById('searchText');

    if (searching) {
        searchIcon.innerHTML = `
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        `;
        searchText.textContent = '取消';
    } else {
        searchIcon.innerHTML = `
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        `;
        searchText.textContent = '搜索';
    }
}

// 获取当前表格数据
async function getCurrentTableData() {
    if (!currentTable || !currentApp) return {};

    try {
        const database = firebase.database(currentApp);
        const snapshot = await database.ref(currentTable).once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('获取表格数据失败：', error);
        return {};
    }
}

/**
 * updateTableDisplay - 更新表格显示内容
 * 功能说明:
 * 1. 根据传入的数据更新表格内容
 * 2. 保存并恢复表格中处于编辑状态的行
 * 3. 为每行添加序号、数据、操作和复选框列
 * 4. 支持编辑模式和普通模式的切换
 * 5. 在表格末尾添加新增记录行
 * 
 * @param {Object} data - 要显示的数据对象
 * @param {Array} savedKeys - 已保存记录的key数组,默认为空数组
 */
function updateTableDisplay(data, savedKeys = []) {
    const tbody = document.getElementById('tableBody');
    
    // 保存当前编辑状态的行以及新增未保存的行
    const editingState = Array.from(document.querySelectorAll('#tableBody tr'))
        .filter(row => {
            // 过滤出编辑状态的行和新增未保存的行
            if (row.classList.contains('新增行')) return false;
            const key = row.querySelector('input[type="checkbox"]')?.value;
            if (!key) return false;
            return row.classList.contains('editing') || row.classList.contains('was-new-record');
        })
        .filter(row => {
            const key = row.querySelector('input[type="checkbox"]').value;
            return !savedKeys.includes(key);
        })
        .map(row => ({
            key: row.querySelector('input[type="checkbox"]').value,
            inputs: Array.from(row.querySelectorAll('.数据列 input')).map(input => input?.value || ''),
            isNewRecord: row.classList.contains('was-new-record')
        }));

    tbody.innerHTML = '';

    // 保存所有未保存的新增记录的数据
    const newRecords = editingState
        .filter(state => state.isNewRecord)
        .reduce((records, state) => {
            records[state.key] = state.inputs.reduce((record, value, index) => {
                record[selectedFields[index]] = value;
                return record;
            }, {});
            return records;
        }, {});

    // 合并现有数据和新增记录
    data = { ...data, ...newRecords };

    Object.entries(data).forEach(([key, row], index) => {
        const tr = document.createElement('tr');
        const wasEditing = editingState.find(state => state.key === key);
        
        if (wasEditing) {
            tr.classList.add('editing');
            // 恢复新增记录标记
            if (wasEditing.isNewRecord) {
                tr.classList.add('was-new-record');
            }
        }

        // 序号列
        const indexTd = document.createElement('td');
        indexTd.textContent = index + 1;
        tr.appendChild(indexTd);

        // 数据列
        selectedFields.forEach((field, fieldIndex) => {
            const td = document.createElement('td');
            td.className = `数据列 field-${field}`;
            td.dataset.key = key;
            
            if (wasEditing) {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = wasEditing.inputs[fieldIndex] || '';
                td.appendChild(input);
            } else {
                td.textContent = row[field] || '';
            }
            
            tr.appendChild(td);
        });

        // 操作列
        const operationTd = document.createElement('td');
        operationTd.className = '操作列';
        if (wasEditing) {
            operationTd.innerHTML = `
                <button class="按钮 save-icon" onclick="saveRecord('${key}')">
                    ${SVG_ICONS.SAVE}
                </button>`;
        } else {
            operationTd.innerHTML = `
                <div class="dropdown">
                    <button class="按钮" onclick="toggleDropdown(this)">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="3" r="1.5"/>
                            <circle cx="8" cy="8" r="1.5"/>
                            <circle cx="8" cy="13" r="1.5"/>
                        </svg>
                    </button>
                    <div class="dropdown-content">
                        <a href="#" onclick="visitRecord('${key}')">访问</a>
                        <a href="#" onclick="editRecord('${key}')">编辑</a>
                        <a href="#" onclick="reviewRecord('${key}')">审核</a>
                        <a href="#" onclick="toggleState('${key}')">状态</a>
                        <a href="#" onclick="deleteRecord('${key}')">删除</a>
                    </div>
                </div>`;
        }
        tr.appendChild(operationTd);

        // 复选框列
        const checkboxTd = document.createElement('td');
        checkboxTd.className = '复选框列';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = key;
        checkboxTd.appendChild(checkbox);
        tr.appendChild(checkboxTd);

        tbody.appendChild(tr);
    });

    // 检查表格编辑状态并更新底部操作块
    const editingRows = document.querySelectorAll('#tableBody tr.editing');
    const allRows = document.querySelectorAll('#tableBody tr:not(.新增行)');
    const operationsBlock = document.getElementById('操作项块');

    // 如果没有编辑状态的记录，恢复为操作图标
    if (editingRows.length === 0) {
        operationsBlock.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M3 21H21" />
                <path d="M5 21V7L13 3V21" />
                <path d="M19 21V11L13 7" />
                <path d="M9 9V9.01" />
                <path d="M9 13V13.01" />
                <path d="M9 17V17.01" />
            </svg>
            <span>操作</span>
        `;
        operationsBlock.className = '功能块';
        operationsBlock.onclick = showOperationsModal;
    }
    // 如果所有记录都是编辑状态，显示为保存图标
    else if (editingRows.length === allRows.length) {
        operationsBlock.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            <span>保存</span>
        `;
        operationsBlock.className = '保存块';
        operationsBlock.onclick = batchSave;
    }

    // 添加新增行
    addNewRecordRow();
}

// 页面初始化和事件监听
document.addEventListener('DOMContentLoaded', () => {
    function updateContentHeight() {
        const basicBlock = document.querySelector('.基本块');
        const topBlock = document.querySelector('.顶部块');
        const bottomBlock = document.querySelector('.底部块');
        const contentBlock = document.querySelector('.内容块');

        const basicHeight = basicBlock.offsetHeight;
        const topHeight = topBlock.offsetHeight;
        const bottomHeight = bottomBlock.offsetHeight;

        contentBlock.style.height = `${basicHeight - topHeight - bottomHeight - 20}px`;
    }

    updateContentHeight();
    window.addEventListener('resize', updateContentHeight);
});


// 添加新增行相关函数
function addNewRecordRow() {
    const tbody = document.getElementById('tableBody');
    const tr = document.createElement('tr');
    tr.className = '新增行';

    // 添加序号列（包含加号按钮）
    const indexTd = document.createElement('td');
    indexTd.innerHTML = '<div class="新增按钮" onclick="startNewRecord(this)">+</div>';
    tr.appendChild(indexTd);

    // 添加数据列占位符
    selectedFields.forEach(() => {
        const td = document.createElement('td');
        td.className = '数据列';
        tr.appendChild(td);
    });

    // 添加操作列占位符
    const operationTd = document.createElement('td');
    operationTd.className = '操作列';
    tr.appendChild(operationTd);

    // 添加复选框列占位符
    const checkboxTd = document.createElement('td');
    checkboxTd.className = '复选框列';
    tr.appendChild(checkboxTd);

    tbody.appendChild(tr);
}


// 开始新记录的创建
function startNewRecord(button) {
    if (!currentApp || !currentTable) return;
    
    const database = firebase.database(currentApp);
    const newKey = database.ref(currentTable).push().key;
    
    const row = button.closest('tr');
    row.classList.remove('新增行');
    row.classList.add('editing');
    row.classList.add('was-new-record'); // 添加新记录标记

    const indexTd = row.firstElementChild;
    indexTd.innerHTML = (document.querySelectorAll('#tableBody tr').length).toString();

    const dataCells = row.querySelectorAll('.数据列');
    dataCells.forEach((cell, index) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = selectedFields[index];
        cell.appendChild(input);
    });

    const operationCell = row.querySelector('.操作列');
    operationCell.innerHTML = `
        <button class="按钮 save-icon" onclick="saveNewRecord(this)">
            ${SVG_ICONS.SAVE}
        </button>
    `;

    const checkboxTd = row.querySelector('.复选框列');
    checkboxTd.innerHTML = `
        <div class="dropdown">
            <input type="checkbox" value="${newKey}">
        </div>
    `;

    addNewRecordRow();
    checkAndUpdateOperationsBlock();
}

// 保存新记录
async function saveNewRecord(button) {
    if (!currentApp || !currentTable) return;

    const row = button.closest('tr');
    const newRecord = {};
    const key = row.querySelector('.复选框列 input[type="checkbox"]').value;

    // 收集所有输入的数据
    row.querySelectorAll('.数据列').forEach((cell, index) => {
        const input = cell.querySelector('input');
        const fieldName = selectedFields[index];
        newRecord[fieldName] = input.value;
    });

    try {
        const database = firebase.database(currentApp);
        await database.ref(`${currentTable}/${key}`).set(newRecord);

        // 更新 UI
        row.classList.remove('editing');
        row.querySelectorAll('.数据列').forEach((cell, index) => {
            const input = cell.querySelector('input');
            cell.textContent = input.value;
        });

        // 更新操作列
        restoreOperationButton(row, key);

        // 如果在搜索状态，更新 originalData
        if (isSearching && originalData) {
            originalData[key] = newRecord;
        }

    } catch (error) {
        console.error('保存新记录失败：', error);
        showToast('保存失败，请重试！', 'error');
    }
}



//工具函数和常量（被调用）

// SVG 图标常量
const SVG_ICONS = {
    SAVE: `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
    `,
    OPERATION: `
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M3 21H21" />
            <path d="M5 21V7L13 3V21" />
            <path d="M19 21V11L13 7" />
            <path d="M9 9V9.01" />
            <path d="M9 13V13.01" />
            <path d="M9 17V17.01" />
        </svg>
    `,
    MENU_DOTS: `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5"/>
            <circle cx="8" cy="8" r="1.5"/>
            <circle cx="8" cy="13" r="1.5"/>
        </svg>
    `
};

// 工具函数 - 恢复编辑状态
function restoreEditingState(editingState) {
    editingState.forEach(state => {
        const row = document.querySelector(`input[value="${state.key}"]`)?.closest('tr');
        if (row) {
            row.classList.add('editing');
            row.querySelectorAll('.数据列').forEach((cell, index) => {
                cell.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = state.inputs[index] || '';
                cell.appendChild(input);
            });

            const operationCell = row.querySelector('.操作列');
            operationCell.innerHTML = `
                <button class="按钮 save-icon" onclick="saveRecord('${state.key}')">
                    ${SVG_ICONS.SAVE}
                </button>
            `;
        }
    });
}

// 工具函数 - 更新操作块状态
function updateOperationsBlockStatus(isEdit = false) {
    const operationsBlock = document.getElementById('操作项块');
    if (isEdit) {
        operationsBlock.innerHTML = `${SVG_ICONS.SAVE}<span>保存</span>`;
        operationsBlock.className = '保存块';
        operationsBlock.onclick = batchSave;
    } else {
        operationsBlock.innerHTML = `${SVG_ICONS.OPERATION}<span>操作</span>`;
        operationsBlock.className = '功能块';
        operationsBlock.onclick = showOperationsModal;
    }
}

// 工具函数 - 创建操作按钮菜单
function createOperationMenu(key) {
    return `
        <div class="dropdown">
            <button class="按钮" onclick="toggleDropdown(this)">
                ${SVG_ICONS.MENU_DOTS}
            </button>
            <div class="dropdown-content">
                <a href="#" onclick="visitRecord('${key}')">访问</a>
                <a href="#" onclick="editRecord('${key}')">编辑</a>
                <a href="#" onclick="reviewRecord('${key}')">审核</a>
                <a href="#" onclick="toggleState('${key}')">状态</a>
                <a href="#" onclick="deleteRecord('${key}')">删除</a>
            </div>
        </div>
    `;
}