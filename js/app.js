let currentUser = null;
let currentScreen = 'dashboard';
let currentCountingProduct = null;
let currentCountingQuantity = 0;
let productsSubscription = null;
let addressesSubscription = null;

document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    setupEventListeners();
});

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function checkLogin() {
    const savedUser = localStorage.getItem('moveis_user');

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
        return;
    }

    document.getElementById('login-screen').classList.add('active');
}

function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('quick-demo-login')?.addEventListener('click', handleQuickDemoLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            navigateTo(link.dataset.screen);
        });
    });

    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('quick-count-btn').addEventListener('click', () => navigateTo('counting'));
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
    document.getElementById('product-search')?.addEventListener('input', filterProducts);
    document.getElementById('category-filter')?.addEventListener('change', filterProducts);
    document.getElementById('counting-search')?.addEventListener('input', filterCounting);
}

async function handleLogin(event) {
    event.preventDefault();

    const btn = event.target.querySelector('button[type="submit"]');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    btn.disabled = true;

    try {
        await waitForSupabase();
        const user = await db.login(email, password);
        currentUser = user;

        if (document.getElementById('remember').checked || db.demoMode) {
            localStorage.setItem('moveis_user', JSON.stringify(user));
        }

        showApp();
    } catch (error) {
        if (email === 'admin@moveis.com' && password === '123456' && !db.demoMode) {
            db.enableDemoMode();
            const user = await db.login(email, password);
            currentUser = user;
            localStorage.setItem('moveis_user', JSON.stringify(user));
            showApp();
            return;
        }

        alert('Erro ao fazer login: ' + error.message);
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btn.disabled = false;
    }
}

async function handleQuickDemoLogin() {
    db.enableDemoMode();
    document.getElementById('email').value = 'admin@moveis.com';
    document.getElementById('password').value = '123456';
    document.getElementById('remember').checked = true;
    document.getElementById('login-form').requestSubmit();
}

function waitForSupabase() {
    return db.waitUntilReady();
}

function handleLogout() {
    localStorage.removeItem('moveis_user');
    currentUser = null;

    if (productsSubscription) productsSubscription.unsubscribe();
    if (addressesSubscription) addressesSubscription.unsubscribe();

    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

function togglePassword() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    document.getElementById('sidebar-username').textContent = currentUser?.name || 'Usuário';
    subscribeToRealtime();
    navigateTo('dashboard');
}

async function subscribeToRealtime() {
    await waitForSupabase();

    if (db.demoMode) return;

    if (productsSubscription) productsSubscription.unsubscribe();
    if (addressesSubscription) addressesSubscription.unsubscribe();

    productsSubscription = db.subscribeToProducts(refreshCurrentScreen);
    addressesSubscription = db.subscribeToAddresses(() => {
        if (currentScreen === 'warehouse') loadAddresses();
    });
}

function refreshCurrentScreen() {
    switch (currentScreen) {
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
            loadAddresses();
            break;
        default:
            break;
    }
}

function navigateTo(screen) {
    currentScreen = screen;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.screen === screen);
    });

    document.querySelectorAll('.screen-content').forEach(item => item.classList.remove('active'));
    document.getElementById(`${screen}-screen`)?.classList.add('active');

    closeSidebar();

    switch (screen) {
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
            loadAddresses();
            break;
        default:
            break;
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

async function loadDashboard() {
    try {
        await waitForSupabase();
        const [products] = await Promise.all([
            db.getProducts(),
            db.getCategories()
        ]);

        const totalProducts = products.length;
        const totalQuantity = products.reduce((sum, product) => sum + (product.quantity || 0), 0);
        const withAddress = products.filter(product => product.address).length;
        const withPhoto = products.filter(product => product.photo_url).length;
        const withoutAddress = totalProducts - withAddress;

        document.getElementById('stats-grid').innerHTML = `
            <div class="stat-card"><div class="stat-icon" style="background: #FFF0E0">🛋️</div><div class="stat-label">Total de Móveis</div><div class="stat-value">${totalProducts}</div></div>
            <div class="stat-card"><div class="stat-icon" style="background: #E0FFE0">📦</div><div class="stat-label">Em Estoque</div><div class="stat-value">${totalQuantity}</div></div>
            <div class="stat-card"><div class="stat-icon" style="background: #E0F0FF">📍</div><div class="stat-label">Localizados</div><div class="stat-value">${withAddress}</div></div>
            <div class="stat-card"><div class="stat-icon" style="background: #FFE0FF">📸</div><div class="stat-label">Com Foto</div><div class="stat-value">${withPhoto}</div></div>
            <div class="stat-card"><div class="stat-icon" style="background: #FFFFE0">⚠️</div><div class="stat-label">Sem Localização</div><div class="stat-value">${withoutAddress}</div></div>
        `;

        const grouped = {};
        products.forEach(product => {
            const category = product.category || 'Sem Categoria';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(product);
        });

        const html = Object.entries(grouped).map(([category, items]) => `
            <div class="category-group">
                <div class="category-header">
                    <span>🏷️ ${escapeHtml(category)}</span>
                    <span class="category-count">${items.length} móveis</span>
                </div>
                ${items.map(product => productListCard(product)).join('')}
            </div>
        `).join('');

        document.getElementById('products-by-category').innerHTML = html || '<p class="empty-state">Nenhum móvel cadastrado ainda.</p>';
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showConnectionError('products-by-category');
    }
}

function productListCard(product) {
    const photo = product.photo_url
        ? `<img src="${escapeHtml(product.photo_url)}" class="product-thumbnail" alt="${escapeHtml(product.name)}">`
        : '<div class="product-thumbnail-placeholder">🪑</div>';

    return `
        <div class="product-card" onclick="viewProduct('${product.id}')">
            <div class="product-card-left">
                ${photo}
                <div class="product-info">
                    <div class="product-name">${escapeHtml(product.name)}</div>
                    <div class="product-sku">SKU: ${escapeHtml(product.sku)}</div>
                    ${product.address ? `<div class="product-address">📍 ${escapeHtml(product.address)}</div>` : ''}
                </div>
            </div>
            <div class="product-card-right">
                <div class="quantity-badge">${product.quantity || 0}</div>
                <div class="quantity-label">unidades</div>
            </div>
        </div>
    `;
}

async function loadProducts() {
    try {
        await waitForSupabase();
        const [products, categories] = await Promise.all([
            db.getProducts(),
            db.getCategories()
        ]);

        document.getElementById('category-filter').innerHTML = '<option value="">Todas Categorias</option>' +
            categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');

        renderProducts(products);
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showConnectionError('products-grid');
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');

    if (products.length === 0) {
        grid.innerHTML = '<p class="empty-state">Nenhum móvel encontrado.</p>';
        return;
    }

    grid.innerHTML = products.map(product => {
        const photo = product.photo_url
            ? `<img src="${escapeHtml(product.photo_url)}" class="product-thumbnail" style="width: 100%; height: 150px;" alt="${escapeHtml(product.name)}">`
            : '<div class="product-thumbnail-placeholder" style="width: 100%; height: 150px; font-size: 48px;">🪑</div>';

        return `
            <div class="product-card" style="flex-direction: column; align-items: flex-start;">
                <div class="product-card-left" style="width: 100%; flex-direction: column; align-items: flex-start;">
                    ${photo}
                    <div class="product-info" style="margin-top: 12px; width: 100%;">
                        <div class="product-name">${escapeHtml(product.name)}</div>
                        <div class="product-sku">SKU: ${escapeHtml(product.sku)}</div>
                        <div class="product-address">📍 ${escapeHtml(product.address || 'Não localizado')}</div>
                        <div style="font-size: 12px; color: var(--accent);">🏷️ ${escapeHtml(product.category || 'Sem categoria')}</div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 12px;">
                    <div class="quantity-badge">${product.quantity || 0} un</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="photo-btn" onclick="event.stopPropagation(); viewPhoto('${escapeHtml(product.photo_url || '')}')" ${!product.photo_url ? 'disabled' : ''}>🔍</button>
                        <button class="photo-btn" onclick="event.stopPropagation(); editProduct('${product.id}')">✏️</button>
                        <button class="photo-btn" onclick="event.stopPropagation(); deleteProduct('${product.id}')" style="color: var(--danger);">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function filterProducts() {
    const search = document.getElementById('product-search').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    let products = await db.getProducts();

    if (search) {
        products = products.filter(product =>
            product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search)
        );
    }

    if (category) {
        products = products.filter(product => product.category === category);
    }

    renderProducts(products);
}

async function openProductModal(productId = null) {
    await waitForSupabase();

    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('photo-preview-container').classList.add('hidden');
    document.getElementById('product-photo-url').value = '';
    document.getElementById('product-photo-type').value = '';

    const [categories, addresses] = await Promise.all([
        db.getCategories(),
        db.getAddresses()
    ]);

    document.getElementById('product-category').innerHTML = '<option value="">Selecione a categoria</option>' +
        categories.map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join('');

    document.getElementById('product-address').innerHTML = '<option value="">Automática</option>' +
        addresses
            .filter(address => address.status === 'EMPTY')
            .map(address => `<option value="${escapeHtml(address.full_address)}">${escapeHtml(address.full_address)}</option>`)
            .join('');

    if (productId) {
        document.getElementById('modal-title').textContent = 'Editar Móvel';
        const products = await db.getProducts();
        const product = products.find(item => item.id === productId);

        if (product) {
            if (product.address) {
                document.getElementById('product-address').insertAdjacentHTML(
                    'beforeend',
                    `<option value="${escapeHtml(product.address)}">${escapeHtml(product.address)}</option>`
                );
            }

            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-sku').value = product.sku || '';
            document.getElementById('product-category').value = product.category || '';
            document.getElementById('product-quantity').value = product.quantity || 0;
            document.getElementById('product-address').value = product.address || '';

            if (product.photo_url) {
                document.getElementById('product-photo-url').value = product.photo_url;
                document.getElementById('product-photo-type').value = product.photo_type || '';
                document.getElementById('photo-preview-img').src = product.photo_url;
                document.getElementById('photo-preview-container').classList.remove('hidden');
            }
        }
    } else {
        document.getElementById('modal-title').textContent = 'Cadastrar Móvel';
    }

    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

async function handleProductSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('product-id').value;
    const productData = {
        name: document.getElementById('product-name').value.trim(),
        sku: document.getElementById('product-sku').value.trim(),
        category: document.getElementById('product-category').value,
        quantity: parseInt(document.getElementById('product-quantity').value, 10) || 0,
        address: document.getElementById('product-address').value || null,
        photo_url: document.getElementById('product-photo-url').value || null,
        photo_type: document.getElementById('product-photo-type').value || null
    };

    try {
        await waitForSupabase();

        if (id) {
            await db.updateProduct(id, productData);
        } else {
            await db.addProduct(productData);
        }

        closeProductModal();
        refreshCurrentScreen();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        alert('Erro ao salvar: ' + error.message);
    }
}

function editProduct(id) {
    openProductModal(id);
}

async function deleteProduct(id) {
    if (!confirm('Tem certeza que deseja excluir este móvel?')) return;

    try {
        await db.deleteProduct(id);
        refreshCurrentScreen();
    } catch (error) {
        alert('Erro ao excluir: ' + error.message);
    }
}

function viewProduct(id) {
    editProduct(id);
}

function viewPhoto(url) {
    if (!url) return;
    document.getElementById('photo-viewer-img').src = url;
    document.getElementById('photo-viewer-modal').classList.remove('hidden');
}

function closePhotoViewer() {
    document.getElementById('photo-viewer-modal').classList.add('hidden');
}

function takePhoto(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (type === 'camera') input.capture = 'environment';

    input.onchange = event => {
        const file = event.target.files[0];
        if (file) processPhotoFile(file, type);
    };

    input.click();
}

function processPhotoFile(file, type) {
    const reader = new FileReader();
    reader.onload = event => {
        const url = event.target.result;
        document.getElementById('photo-preview-img').src = url;
        document.getElementById('photo-preview-container').classList.remove('hidden');
        document.getElementById('product-photo-url').value = url;
        document.getElementById('product-photo-type').value = type;
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    document.getElementById('photo-preview-container').classList.add('hidden');
    document.getElementById('product-photo-url').value = '';
    document.getElementById('product-photo-type').value = '';
}

async function loadCounting() {
    try {
        await waitForSupabase();
        const products = await db.getProducts();
        document.getElementById('counting-active-view').classList.add('hidden');
        document.getElementById('counting-list-view').classList.remove('hidden');
        renderCountingList(products);
    } catch (error) {
        console.error('Erro ao carregar contagem:', error);
        showConnectionError('counting-product-list');
    }
}

function renderCountingList(products) {
    const list = document.getElementById('counting-product-list');

    if (products.length === 0) {
        list.innerHTML = '<p class="empty-state">Nenhum móvel cadastrado.</p>';
        return;
    }

    list.innerHTML = products.map(product => {
        const photo = product.photo_url
            ? `<img src="${escapeHtml(product.photo_url)}" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" alt="${escapeHtml(product.name)}">`
            : '<div style="width: 56px; height: 56px; border-radius: 12px; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 28px;">🪑</div>';

        return `
            <div class="counting-card" onclick="startCounting('${product.id}')">
                <div style="display: flex; align-items: center; gap: 16px;">
                    ${photo}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(product.name)}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">SKU: ${escapeHtml(product.sku)}</div>
                        <div style="font-size: 12px; color: var(--accent);">📍 ${escapeHtml(product.address || 'Não localizado')}</div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                        <div style="font-size: 28px; font-weight: 700; color: var(--primary);">${product.quantity || 0}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">unidades</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function filterCounting() {
    const search = document.getElementById('counting-search').value.toLowerCase();
    let products = await db.getProducts();

    if (search) {
        products = products.filter(product =>
            product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search)
        );
    }

    renderCountingList(products);
}

async function startCounting(productId) {
    const products = await db.getProducts();
    const product = products.find(item => item.id === productId);
    if (!product) return;

    currentCountingProduct = product;
    currentCountingQuantity = product.quantity || 0;
    document.getElementById('counting-list-view').classList.add('hidden');

    const view = document.getElementById('counting-active-view');
    const photo = product.photo_url
        ? `<img src="${escapeHtml(product.photo_url)}" style="width: 100px; height: 100px; border-radius: 16px; object-fit: cover; margin-bottom: 16px;" alt="${escapeHtml(product.name)}">`
        : '<div style="font-size: 64px; margin-bottom: 16px;">🪑</div>';

    view.innerHTML = `
        <button onclick="backToCountingList()" style="background: none; border: none; color: var(--primary); cursor: pointer; font-size: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; font-family: 'Poppins', sans-serif;">← Voltar para lista</button>
        <div class="counting-header">
            ${photo}
            <h2>${escapeHtml(product.name)}</h2>
            <p>SKU: ${escapeHtml(product.sku)}</p>
            <p>📍 ${escapeHtml(product.address || 'Não localizado')}</p>
            <p style="margin-top: 8px;">Quantidade anterior: <strong>${product.quantity || 0}</strong></p>
        </div>
        <div class="counter-container">
            <button class="counter-btn minus" onclick="adjustCountingQuantity(-1)">−</button>
            <div class="counter-display">
                <div class="counter-number" id="counting-display">${currentCountingQuantity}</div>
                <div class="counter-label">unidades</div>
            </div>
            <button class="counter-btn plus" onclick="adjustCountingQuantity(1)">+</button>
        </div>
        <div style="margin: 20px 0;">
            <input type="number" id="manual-count-input" placeholder="Ou digite o valor manualmente" style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 12px; text-align: center; font-size: 20px; font-family: 'Poppins', sans-serif;" onchange="setManualQuantity(this.value)">
        </div>
        <div class="counting-actions">
            <button onclick="takeCountingPhoto('camera')" class="photo-btn">📸 Foto Câmera</button>
            <button onclick="takeCountingPhoto('gallery')" class="photo-btn">🖼️ Galeria</button>
            <button onclick="confirmCounting()" class="btn-primary">✅ Confirmar: <span id="confirm-count-value">${currentCountingQuantity}</span> un</button>
        </div>
    `;

    view.classList.remove('hidden');
}

function backToCountingList() {
    document.getElementById('counting-active-view').classList.add('hidden');
    document.getElementById('counting-list-view').classList.remove('hidden');
    currentCountingProduct = null;
}

function adjustCountingQuantity(delta) {
    currentCountingQuantity = Math.max(0, currentCountingQuantity + delta);
    document.getElementById('counting-display').textContent = currentCountingQuantity;
    document.getElementById('confirm-count-value').textContent = currentCountingQuantity;
}

function setManualQuantity(value) {
    const quantity = parseInt(value, 10);
    if (!Number.isNaN(quantity) && quantity >= 0) {
        currentCountingQuantity = quantity;
        document.getElementById('counting-display').textContent = currentCountingQuantity;
        document.getElementById('confirm-count-value').textContent = currentCountingQuantity;
    }
}

function takeCountingPhoto(type) {
    if (!currentCountingProduct) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (type === 'camera') input.capture = 'environment';

    input.onchange = event => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async loadEvent => {
            await db.updateProduct(currentCountingProduct.id, {
                photo_url: loadEvent.target.result,
                photo_type: type
            });
            alert('Foto do móvel atualizada!');
        };
        reader.readAsDataURL(file);
    };

    input.click();
}

async function confirmCounting() {
    if (!currentCountingProduct) return;

    try {
        await db.updateProduct(currentCountingProduct.id, {
            quantity: currentCountingQuantity
        });

        alert(`Contagem confirmada: ${currentCountingQuantity} unidades`);
        backToCountingList();
        loadCounting();
    } catch (error) {
        alert('Erro ao registrar contagem: ' + error.message);
    }
}

async function loadAddresses() {
    try {
        await waitForSupabase();
        const addresses = await db.getAddresses();
        const grid = document.getElementById('addresses-grid');

        if (addresses.length === 0) {
            grid.innerHTML = '<p class="empty-state">Nenhum endereço configurado. Gere endereços automaticamente.</p>';
            return;
        }

        grid.innerHTML = addresses.map(address => {
            const isEmpty = address.status === 'EMPTY';
            return `
                <div class="address-card ${isEmpty ? 'empty' : 'occupied'}">
                    <div class="address-full">📍 ${escapeHtml(address.full_address)}</div>
                    <span class="address-status ${isEmpty ? 'status-empty' : 'status-occupied'}">${isEmpty ? '✅ Livre' : '📦 Ocupado'}</span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar endereços:', error);
        showConnectionError('addresses-grid');
    }
}

async function generateAddresses() {
    const template = document.getElementById('address-template').value;
    const warehouseName = document.getElementById('warehouse-name').value || 'Depósito Principal';
    const count = prompt('Quantos endereços deseja gerar?', '30');

    if (!count) return;

    const total = parseInt(count, 10);
    if (Number.isNaN(total) || total <= 0) {
        alert('Informe uma quantidade válida.');
        return;
    }

    try {
        await waitForSupabase();
        const parts = template.split('-');

        for (let index = 0; index < total; index += 1) {
            const addressParts = parts.map((part, partIndex) => {
                const base = Math.floor(index / Math.pow(10, partIndex)) + 1;
                return `${part.charAt(0)}${String(base).padStart(2, '0')}`;
            });

            await db.addAddress({
                full_address: addressParts.join('-'),
                status: 'EMPTY',
                warehouse_config: JSON.stringify({ name: warehouseName, template })
            });
        }

        loadAddresses();
        alert(`${total} endereços gerados com sucesso!`);
    } catch (error) {
        alert('Erro ao gerar endereços: ' + error.message);
    }
}

async function exportToExcel(type = 'complete') {
    try {
        await waitForSupabase();
        const products = await db.getProducts();
        let csv = '\uFEFF';

        if (type === 'by_category') {
            csv += 'Categoria;Produto;SKU;Quantidade;Endereço;Foto\n';
            [...products]
                .sort((a, b) => (a.category || '').localeCompare(b.category || ''))
                .forEach(product => {
                    csv += csvLine([
                        product.category || 'Sem categoria',
                        product.name,
                        product.sku,
                        product.quantity || 0,
                        product.address || 'Não localizado',
                        product.photo_url || 'Sem foto'
                    ]);
                });
        } else if (type === 'by_address') {
            csv += 'Endereço;Produto;SKU;Categoria;Quantidade;Foto\n';
            [...products]
                .sort((a, b) => (a.address || 'ZZZ').localeCompare(b.address || 'ZZZ'))
                .forEach(product => {
                    csv += csvLine([
                        product.address || 'Não localizado',
                        product.name,
                        product.sku,
                        product.category || 'Sem categoria',
                        product.quantity || 0,
                        product.photo_url || 'Sem foto'
                    ]);
                });
        } else {
            csv += 'Produto;SKU;Categoria;Quantidade;Endereço;Foto\n';
            products.forEach(product => {
                csv += csvLine([
                    product.name,
                    product.sku,
                    product.category || 'Sem categoria',
                    product.quantity || 0,
                    product.address || 'Não localizado',
                    product.photo_url || 'Sem foto'
                ]);
            });
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `moveis_estoque_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        alert('Erro ao exportar: ' + error.message);
    }
}

function csvLine(values) {
    return values
        .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(';') + '\n';
}

function showConnectionError(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
        <p class="empty-state">
            Não foi possível carregar os dados. Verifique as credenciais em js/config.js e a conexão com o Supabase.
        </p>
    `;
}
