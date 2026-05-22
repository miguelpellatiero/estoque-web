// ===== GERENCIAMENTO DE TELAS =====
let currentScreen = 'dashboard';
let currentProductId = null;
let cameraStream = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const currentUser = db.getCurrentUser();
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = link.dataset.screen;
            navigateTo(screen);
        });
    });
    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('mobile-counting-btn').addEventListener('click', () => navigateTo('counting'));
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('warehouse-config-form')?.addEventListener('submit', handleWarehouseConfig);
    document.getElementById('product-search')?.addEventListener('input', filterProducts);
    document.getElementById('category-filter')?.addEventListener('change', filterProducts);
    document.getElementById('counting-search')?.addEventListener('input', filterCountingProducts);
}

// ===== AUTENTICAÇÃO =====
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const result = db.login(email, password);
    if (result.success) {
        showApp();
    } else {
        alert('Email ou senha inválidos! Use: admin@teste.com / 123456');
    }
}

function handleLogout() {
    db.logout();
    showLogin();
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    navigateTo('dashboard');
}

function showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

// ===== NAVEGAÇÃO =====
function navigateTo(screen) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.screen === screen);
    });
    document.querySelectorAll('.screen-content').forEach(s => s.classList.remove('active'));
    document.getElementById(`${screen}-screen`).classList.add('active');
    currentScreen = screen;
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
    switch(screen) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProducts();
            break;
        case 'counting':
            loadCounting();
            break;
        case 'warehouse':
            loadWarehouse();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ===== DASHBOARD =====
function loadDashboard() {
    const products = db.getProducts();
    const categories = db.getCategories();
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const addressedProducts = products.filter(p => p.addressId).length;
    const unaddressedProducts = totalProducts - addressedProducts;
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-icon" style="background: #DBEAFE">📦</div>
            <div class="stat-label">Total de Produtos</div>
            <div class="stat-value">${totalProducts}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #D1FAE5">📊</div>
            <div class="stat-label">Quantidade Total</div>
            <div class="stat-value">${totalQuantity}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #EDE9FE">📍</div>
            <div class="stat-label">Endereçados</div>
            <div class="stat-value">${addressedProducts}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #FEF3C7">⚠️</div>
            <div class="stat-label">Sem Endereço</div>
            <div class="stat-value">${unaddressedProducts}</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #FCE7F3">🏷️</div>
            <div class="stat-label">Categorias</div>
            <div class="stat-value">${categories.length}</div>
        </div>
    `;
    document.getElementById('stats-grid').innerHTML = statsHTML;
    const grouped = {};
    products.forEach(p => {
        const catName = p.category?.name || 'Sem Categoria';
        if (!grouped[catName]) grouped[catName] = [];
        grouped[catName].push(p);
    });
    let categoriesHTML = '';
    for (const [catName, items] of Object.entries(grouped)) {
        categoriesHTML += `
            <div class="category-section">
                <div class="category-header">
                    <span>📁 ${catName}</span>
                    <span>${items.length} produtos</span>
                </div>
                ${items.map(p => `
                    <div class="product-item" onclick="viewProductDetails('${p.id}')">
                        <div class="product-info">
                            <div class="product-name">${p.name}</div>
                            <div class="product-meta">
                                SKU: ${p.sku} | 📍 ${p.address?.fullAddress || 'Não definido'}
                            </div>
                        </div>
                        <div class="product-quantity">
                            <div class="quantity-value">${p.quantity}</div>
                            <div class="quantity-label">unidades</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    document.getElementById('products-by-category').innerHTML = categoriesHTML;
}

// ===== PRODUTOS =====
function loadProducts() {
    const products = db.getProducts();
    const categories = db.getCategories();
    const categoryFilter = document.getElementById('category-filter');
    categoryFilter.innerHTML = '<option value="">Todas Categorias</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    renderProductsTable(products);
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = products.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.sku}</td>
            <td>${p.category?.name || '-'}</td>
            <td><strong>${p.quantity}</strong></td>
            <td>${p.address?.fullAddress || 'Não endereçado'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn-sm btn-photo" onclick="takeProductPhoto('${p.id}')">📸</button>
                    <button class="btn-sm btn-delete" onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterProducts() {
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    const categoryId = document.getElementById('category-filter').value;
    let products = db.getProducts();
    if (searchTerm) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm)
        );
    }
    if (categoryId) {
        products = products.filter(p => p.categoryId === categoryId);
    }
    renderProductsTable(products);
}

function openProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('modal-title');
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    const categorySelect = document.getElementById('product-category');
    categorySelect.innerHTML = '<option value="">Selecione...</option>' +
        db.getCategories().map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const addressSelect = document.getElementById('product-address');
    const addresses = db.getAddresses();
    addressSelect.innerHTML = '<option value="">Automático</option>' +
        addresses.filter(a => a.status === 'EMPTY').map(a => 
            `<option value="${a.id}">${a.fullAddress}</option>`
        ).join('');
    if (productId) {
        title.textContent = 'Editar Produto';
        const product = db.getProduct(productId);
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-sku').value = product.sku;
        document.getElementById('product-category').value = product.categoryId;
        document.getElementById('product-quantity').value = product.quantity;
        if (product.addressId) {
            document.getElementById('product-address').value = product.addressId;
        }
    } else {
        title.textContent = 'Novo Produto';
    }
    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function handleProductSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('product-name').value,
        sku: document.getElementById('product-sku').value,
        categoryId: document.getElementById('product-category').value,
        quantity: parseInt(document.getElementById('product-quantity').value) || 0,
        addressId: document.getElementById('product-address').value || null
    };
    if (id) {
        db.updateProduct(id, productData);
    } else {
        db.addProduct(productData);
    }
    closeProductModal();
    loadProducts();
    if (currentScreen === 'dashboard') loadDashboard();
}

function editProduct(id) {
    openProductModal(id);
}

function deleteProduct(id) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        db.deleteProduct(id);
        loadProducts();
        if (currentScreen === 'dashboard') loadDashboard();
    }
}

function viewProductDetails(id) {
    const product = db.getProduct(id);
    if (product) {
        alert(`\nProduto: ${product.name}\nSKU: ${product.sku}\nCategoria: ${product.category?.name || 'N/A'}\nQuantidade: ${product.quantity}\nEndereço: ${product.address?.fullAddress || 'Não definido'}`.trim());
    }
}

// ===== CONTAGEM =====
function loadCounting() {
    const products = db.getProducts();
    document.getElementById('counting-screen-active').classList.add('hidden');
    document.getElementById('counting-product-list').classList.remove('hidden');
    renderCountingList(products);
}

function renderCountingList(products) {
    const list = document.getElementById('counting-product-list');
    list.innerHTML = products.map(p => `
        <div class="counting-item" onclick="startCounting('${p.id}')">
            <div class="product-info">
                <div class="product-name">${p.name}</div>
                <div class="product-meta">
                    SKU: ${p.sku} | 📍 ${p.address?.fullAddress || 'Sem endereço'}
                </div>
            </div>
            <div class="product-quantity">
                <div class="quantity-value">${p.quantity}</div>
                <div class="quantity-label">unidades</div>
            </div>
        </div>
    `).join('');
}

function filterCountingProducts() {
    const searchTerm = document.getElementById('counting-search').value.toLowerCase();
    let products = db.getProducts();
    if (searchTerm) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm)
        );
    }
    renderCountingList(products);
}

function startCounting(productId) {
    const product = db.getProduct(productId);
    if (!product) return;
    currentProductId = productId;
    let quantity = product.quantity;
    const screen = document.getElementById('counting-screen-active');
    screen.innerHTML = `
        <button class="btn-secondary" onclick="stopCounting()" style="margin-bottom: 20px;">
            ← Voltar para lista
        </button>
        
        <div class="counting-header">
            <h2>${product.name}</h2>
            <p style="color: var(--text-secondary);">SKU: ${product.sku}</p>
            <p style="color: var(--text-secondary);">📍 ${product.address?.fullAddress || 'Sem endereço'}</p>
            <p style="color: var(--text-secondary); margin-top: 10px;">
                Quantidade anterior: <strong>${product.quantity}</strong>
            </p>
        </div>
        
        <div class="counter-container">
            <button class="counter-btn minus" onclick="adjustCount(-1)">-</button>
            <div class="counter-display">
                <div class="counter-number" id="counter-value">${quantity}</div>
                <div class="counter-label">unidades</div>
            </div>
            <button class="counter-btn plus" onclick="adjustCount(1)">+</button>
        </div>
        
        <div class="counting-actions">
            <button class="btn-secondary" onclick="takeProductPhoto('${productId}')">
                📸 Foto da Etiqueta
            </button>
            <button class="btn-primary" onclick="confirmCount()">
                ✅ Confirmar Contagem
            </button>
        </div>
    `;
    document.getElementById('counting-product-list').classList.add('hidden');
    screen.classList.remove('hidden');
    screen.dataset.quantity = quantity;
}

function adjustCount(delta) {
    const screen = document.getElementById('counting-screen-active');
    let quantity = parseInt(screen.dataset.quantity) + delta;
    if (quantity < 0) quantity = 0;
    screen.dataset.quantity = quantity;
    document.getElementById('counter-value').textContent = quantity;
}

function confirmCount() {
    const screen = document.getElementById('counting-screen-active');
    const quantity = parseInt(screen.dataset.quantity);
    db.countProduct(currentProductId, quantity);
    alert('Contagem registrada com sucesso!');
    stopCounting();
    loadCounting();
    if (currentScreen === 'dashboard') loadDashboard();
}

function stopCounting() {
    document.getElementById('counting-screen-active').classList.add('hidden');
    document.getElementById('counting-product-list').classList.remove('hidden');
    currentProductId = null;
}

// ===== CÂMERA =====
async function takeProductPhoto(productId) {
    currentProductId = productId;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        const video = document.getElementById('camera-video');
        video.srcObject = stream;
        cameraStream = stream;
        document.getElementById('camera-modal').classList.remove('hidden');
    } catch (error) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const photoUrl = event.target.result;
                    db.addPhoto(productId, photoUrl);
                    alert('Foto salva com sucesso!');
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }
}

function takePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
    db.addPhoto(currentProductId, photoUrl);
    closeCamera();
    alert('Foto salva com sucesso!');
}

function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    document.getElementById('camera-modal').classList.add('hidden');
}

// ===== ENDEREÇAMENTO =====
function loadWarehouse() {
    const warehouse = db.getWarehouse();
    if (warehouse) {
        document.getElementById('warehouse-name').value = warehouse.name;
        document.getElementById('address-template').value = JSON.stringify(warehouse.addressTemplate);
    }
    renderAddresses();
}

function renderAddresses() {
    const addresses = db.getAddresses();
    const list = document.getElementById('addresses-list');
    if (addresses.length === 0) {
        list.innerHTML = '<p style="color: var(--text-secondary);">Nenhum endereço configurado. Configure o galpão e gere endereços.</p>';
        return;
    }
    list.innerHTML = addresses.map(a => `
        <div class="address-card ${a.status.toLowerCase()}">
            <div>
                <strong>${a.fullAddress}</strong>
                <div style="color: var(--text-secondary); font-size: 14px;">
                    ${Object.entries(a.addressParts).map(([k,v]) => `${k}: ${v}`).join(' | ')}
                </div>
            </div>
            <span class="address-badge badge-${a.status.toLowerCase()}">${a.status}</span>
        </div>
    `).join('');
}

function handleWarehouseConfig(e) {
    e.preventDefault();
    const warehouse = {
        name: document.getElementById('warehouse-name').value,
        addressTemplate: JSON.parse(document.getElementById('address-template').value)
    };
    db.saveWarehouse(warehouse);
    alert('Configuração salva com sucesso!');
}

function generateAddresses() {
    const warehouse = db.getWarehouse();
    if (!warehouse) {
        alert('Configure o galpão primeiro!');
        return;
    }
    const count = prompt('Quantos endereços deseja gerar?', '50');
    if (count) {
        db.generateAddresses(JSON.stringify(warehouse.addressTemplate), parseInt(count));
        renderAddresses();
        alert('Endereços gerados com sucesso!');
    }
}

// ===== RELATÓRIOS =====
function loadReports() {
    // Tela de relatórios estática para exportação
}

// ===== UTILITÁRIOS =====
function viewPhoto(url) {
    document.getElementById('photo-preview').src = url;
    document.getElementById('photo-modal').classList.remove('hidden');
}

function closePhotoModal() {
    document.getElementById('photo-modal').classList.add('hidden');
}
