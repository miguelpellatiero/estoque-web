// Cliente Supabase com modo demo local para testes rápidos.
class SupabaseClient {
    constructor() {
        this.client = null;
        this.demoMode = this.isConfigMissing();
        this.ready = this.demoMode ? Promise.resolve(null) : this.initSupabase();
        this.seedDemoData();
    }

    isConfigMissing() {
        return !SUPABASE_CONFIG?.url ||
            !SUPABASE_CONFIG?.anonKey ||
            SUPABASE_CONFIG.url.includes('SEU_PROJECT_ID') ||
            SUPABASE_CONFIG.anonKey.includes('SEU_ANON_KEY');
    }

    initSupabase() {
        return new Promise((resolve, reject) => {
            if (window.supabase) {
                this.createClient();
                resolve(this.client);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                this.createClient();
                resolve(this.client);
            };
            script.onerror = () => reject(new Error('Não foi possível carregar o Supabase.'));
            document.head.appendChild(script);
        });
    }

    createClient() {
        this.client = window.supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        console.log('Supabase conectado!');
    }

    async waitUntilReady() {
        if (this.demoMode) return null;
        if (this.client) return this.client;
        return this.ready;
    }

    enableDemoMode() {
        this.demoMode = true;
        this.client = null;
        this.ready = Promise.resolve(null);
        localStorage.removeItem('moveis_demo_seeded');
        this.seedDemoData();
    }

    seedDemoData() {
        if (!this.demoMode || localStorage.getItem('moveis_demo_seeded')) return;

        this.saveLocal('users', [
            {
                id: 'demo-user',
                email: 'admin@moveis.com',
                password: '123456',
                name: 'Administrador'
            }
        ]);

        this.saveLocal('categories', [
            'Sofás e Estofados',
            'Mesas e Cadeiras',
            'Armários e Guarda-Roupas',
            'Camas e Colchões',
            'Estantes e Prateleiras',
            'Móveis de Escritório',
            'Móveis de Cozinha',
            'Decoração e Acessórios',
            'Móveis Infantis',
            'Móveis para Área Externa'
        ].map((name, index) => ({
            id: `demo-category-${index + 1}`,
            name,
            created_at: new Date().toISOString()
        })));

        this.saveLocal('products', []);
        this.saveLocal('addresses', []);
        localStorage.setItem('moveis_demo_seeded', 'true');
    }

    localKey(table) {
        return `moveis_demo_${table}`;
    }

    getLocal(table) {
        return JSON.parse(localStorage.getItem(this.localKey(table)) || '[]');
    }

    saveLocal(table, data) {
        localStorage.setItem(this.localKey(table), JSON.stringify(data));
    }

    newId() {
        if (crypto?.randomUUID) return crypto.randomUUID();
        return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    async getProducts() {
        if (this.demoMode) {
            return this.getLocal('products')
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async addProduct(product) {
        if (this.demoMode) {
            const products = this.getLocal('products');
            if (products.some(item => item.sku === product.sku)) {
                throw new Error('Já existe um móvel com este SKU');
            }

            const record = {
                id: this.newId(),
                ...product,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            products.unshift(record);
            this.saveLocal('products', products);
            return record;
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('products')
            .insert([product])
            .select();

        if (error) throw error;
        return data?.[0];
    }

    async updateProduct(id, updates) {
        if (this.demoMode) {
            const products = this.getLocal('products');
            const index = products.findIndex(item => item.id === id);
            if (index === -1) throw new Error('Produto não encontrado');

            products[index] = {
                ...products[index],
                ...updates,
                updated_at: new Date().toISOString()
            };

            this.saveLocal('products', products);
            return products[index];
        }

        await this.waitUntilReady();
        const payload = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await this.client
            .from('products')
            .update(payload)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data?.[0];
    }

    async deleteProduct(id) {
        if (this.demoMode) {
            this.saveLocal('products', this.getLocal('products').filter(item => item.id !== id));
            return;
        }

        await this.waitUntilReady();
        const { error } = await this.client
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async getCategories() {
        if (this.demoMode) {
            return this.getLocal('categories').sort((a, b) => a.name.localeCompare(b.name));
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
    }

    async getAddresses() {
        if (this.demoMode) {
            return this.getLocal('addresses').sort((a, b) => a.full_address.localeCompare(b.full_address));
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('addresses')
            .select('*')
            .order('full_address');

        if (error) throw error;
        return data || [];
    }

    async addAddress(address) {
        if (this.demoMode) {
            const addresses = this.getLocal('addresses');
            if (addresses.some(item => item.full_address === address.full_address)) {
                throw new Error(`Endereço ${address.full_address} já existe`);
            }

            const record = {
                id: this.newId(),
                ...address,
                created_at: new Date().toISOString()
            };

            addresses.push(record);
            this.saveLocal('addresses', addresses);
            return record;
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('addresses')
            .insert([address])
            .select();

        if (error) throw error;
        return data?.[0];
    }

    async updateAddressStatus(id, status) {
        if (this.demoMode) {
            const addresses = this.getLocal('addresses');
            const index = addresses.findIndex(item => item.id === id);
            if (index !== -1) {
                addresses[index].status = status;
                this.saveLocal('addresses', addresses);
            }
            return;
        }

        await this.waitUntilReady();
        const { error } = await this.client
            .from('addresses')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
    }

    async login(email, password) {
        if (this.demoMode) {
            const user = this.getLocal('users').find(item =>
                item.email === email && item.password === password
            );

            if (!user) {
                throw new Error('Email ou senha inválidos. Use admin@moveis.com / 123456');
            }

            return user;
        }

        await this.waitUntilReady();
        const { data, error } = await this.client
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Email ou senha inválidos');
        }

        return data;
    }

    subscribeToProducts(callback) {
        if (this.demoMode) return { unsubscribe() {} };

        return this.client
            .channel('products-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                callback
            )
            .subscribe();
    }

    subscribeToAddresses(callback) {
        if (this.demoMode) return { unsubscribe() {} };

        return this.client
            .channel('addresses-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'addresses' },
                callback
            )
            .subscribe();
    }
}

const db = new SupabaseClient();
