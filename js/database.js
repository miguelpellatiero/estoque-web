// Simulação de banco de dados usando localStorage
class Database {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem('estoque_db')) {
            const initialData = {
                users: [
                    {
                        id: 'user_1',
                        name: 'Admin',
                        email: 'admin@teste.com',
                        password: '123456',
                        role: 'ADMIN',
                        companyId: 'comp_1'
                    }
                ],
                companies: [
                    {
                        id: 'comp_1',
                        name: 'Empresa Demo'
                    }
                ],
                warehouses: [],
                addresses: [],
                categories: [
                    { id: 'cat_1', name: 'Bebidas', companyId: 'comp_1' },
                    { id: 'cat_2', name: 'Alimentos', companyId: 'comp_1' },
                    { id: 'cat_3', name: 'Limpeza', companyId: 'comp_1' },
                    { id: 'cat_4', name: 'Escritório', companyId: 'comp_1' }
                ],
                products: [],
                photos: [],
                countLogs: []
            };
            localStorage.setItem('estoque_db', JSON.stringify(initialData));
        }
    }

    getDB() {
        return JSON.parse(localStorage.getItem('estoque_db'));
    }

    saveDB(data) {
        localStorage.setItem('estoque_db', JSON.stringify(data));
    }

    // Autenticação
    login(email, password) {
        const db = this.getDB();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, error: 'Email ou senha inválidos' };
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('currentUser'));
    }

    logout() {
        localStorage.removeItem('currentUser');
    }

    // Produtos
    getProducts() {
        const db = this.getDB();
        return db.products.map(p => ({
            ...p,
            category: db.categories.find(c => c.id === p.categoryId),
            address: db.addresses.find(a => a.id === p.addressId),
            photos: db.photos.filter(ph => ph.productId === p.id),
            countLogs: db.countLogs.filter(cl => cl.productId === p.id)
        }));
    }

    getProduct(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    }

    addProduct(product) {
        const db = this.getDB();
        const newProduct = {
            id: 'prod_' + Date.now(),
            ...product,
            companyId: 'comp_1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Endereçamento automático
        if (!product.addressId) {
            const availableAddress = db.addresses.find(a => a.status === 'EMPTY');
            if (availableAddress) {
                newProduct.addressId = availableAddress.id;
                availableAddress.status = 'OCCUPIED';
            }
        }
        
        db.products.push(newProduct);
        this.saveDB(db);
        return newProduct;
    }

    updateProduct(id, updates) {
        const db = this.getDB();
        const index = db.products.findIndex(p => p.id === id);
        if (index !== -1) {
            db.products[index] = {
                ...db.products[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveDB(db);
            return db.products[index];
        }
        return null;
    }

    deleteProduct(id) {
        const db = this.getDB();
        db.products = db.products.filter(p => p.id !== id);
        db.photos = db.photos.filter(p => p.productId !== id);
        db.countLogs = db.countLogs.filter(l => l.productId !== id);
        this.saveDB(db);
    }

    // Contagem
    countProduct(productId, newQuantity) {
        const db = this.getDB();
        const product = db.products.find(p => p.id === productId);
        if (product) {
            const log = {
                id: 'log_' + Date.now(),
                productId,
                userId: this.getCurrentUser().id,
                previousQty: product.quantity,
                newQty: newQuantity,
                countedAt: new Date().toISOString()
            };
            
            product.quantity = newQuantity;
            product.updatedAt = new Date().toISOString();
            db.countLogs.push(log);
            this.saveDB(db);
            return { product, log };
        }
        return null;
    }

    // Categorias
    getCategories() {
        const db = this.getDB();
        return db.categories;
    }

    addCategory(name) {
        const db = this.getDB();
        const category = {
            id: 'cat_' + Date.now(),
            name,
            companyId: 'comp_1'
        };
        db.categories.push(category);
        this.saveDB(db);
        return category;
    }

    // Endereços
    getAddresses() {
        const db = this.getDB();
        return db.addresses;
    }

    getWarehouse() {
        const db = this.getDB();
        return db.warehouses[0] || null;
    }

    saveWarehouse(warehouse) {
        const db = this.getDB();
        if (db.warehouses.length > 0) {
            db.warehouses[0] = { ...db.warehouses[0], ...warehouse };
        } else {
            db.warehouses.push({
                id: 'wh_' + Date.now(),
                ...warehouse,
                companyId: 'comp_1'
            });
        }
        this.saveDB(db);
    }

    generateAddresses(template, count) {
        const db = this.getDB();
        const newAddresses = [];
        const parts = JSON.parse(template);
        
        for (let i = 0; i < count; i++) {
            const addressParts = {};
            const addressValues = [];
            
            parts.forEach(part => {
                const value = `${part.charAt(0)}${String(Math.floor(i / parts.length) + 1).padStart(2, '0')}`;
                addressParts[part] = value;
                addressValues.push(value);
            });
            
            const fullAddress = addressValues.join('-');
            
            if (!db.addresses.find(a => a.fullAddress === fullAddress)) {
                const address = {
                    id: 'addr_' + Date.now() + '_' + i,
                    warehouseId: db.warehouses[0]?.id,
                    fullAddress,
                    addressParts,
                    status: 'EMPTY'
                };
                newAddresses.push(address);
            }
        }
        
        db.addresses.push(...newAddresses);
        this.saveDB(db);
        return newAddresses;
    }

    // Fotos
    addPhoto(productId, url) {
        const db = this.getDB();
        const photo = {
            id: 'photo_' + Date.now(),
            productId,
            url,
            takenAt: new Date().toISOString()
        };
        db.photos.push(photo);
        this.saveDB(db);
        return photo;
    }
}

// Instância global
const db = new Database();
