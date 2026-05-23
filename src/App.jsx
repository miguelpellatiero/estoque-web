import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const LOGIN = {
  email: 'miguel@mg.com',
  password: '1234',
  name: 'Miguel',
};

const emptyProduct = {
  id: '',
  name: '',
  sku: '',
  category: '',
  quantity: 0,
  address: '',
  photos: [],
  photo_type: '',
};

const EMPTY_ADDRESS = 'EMPTY';
const OCCUPIED_ADDRESS = 'OCCUPIED';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getPhotos(product) {
  if (!product) return [];
  if (Array.isArray(product.photos)) return product.photos.filter(Boolean);
  if (typeof product.photos === 'string' && product.photos.trim()) {
    try {
      const parsed = JSON.parse(product.photos);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return product.photo_url ? [product.photo_url] : [];
    }
  }
  return product.photo_url ? [product.photo_url] : [];
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel ler a foto.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Nao foi possivel abrir a foto.'));
      image.onload = () => {
        const maxSize = 1280;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function csvLine(values) {
  return values.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';') + '\n';
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('moveis_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem('moveis_user');
      return null;
    }
  });
  const [login, setLogin] = useState(LOGIN);
  const [remember, setRemember] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [screen, setScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [countingSearch, setCountingSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [photoViewer, setPhotoViewer] = useState('');
  const [countingProduct, setCountingProduct] = useState(null);
  const [countingQuantity, setCountingQuantity] = useState(0);
  const [warehouseName, setWarehouseName] = useState('');
  const [addressTemplate, setAddressTemplate] = useState('RUA-PREDIO-NIVEL');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!user) return undefined;

    loadAll();

    const productsChannel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .subscribe();

    const addressesChannel = supabase
      .channel('addresses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'addresses' }, loadAddresses)
      .subscribe();

    const categoriesChannel = supabase
      .channel('categories-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, loadCategories)
      .subscribe();

    return () => {
      productsChannel.unsubscribe();
      addressesChannel.unsubscribe();
      categoriesChannel.unsubscribe();
    };
  }, [user]);

  async function loadAll() {
    setIsLoading(true);
    try {
      await Promise.all([loadProducts(), loadCategories(), loadAddresses()]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setNotice('Erro ao carregar produtos: ' + error.message);
      return;
    }
    setProducts(data || []);
  }

  async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) {
      setNotice('Erro ao carregar categorias: ' + error.message);
      return;
    }
    setCategories(data || []);
  }

  async function loadAddresses() {
    const { data, error } = await supabase.from('addresses').select('*').order('full_address');
    if (error) {
      setNotice('Erro ao carregar enderecos: ' + error.message);
      return;
    }
    setAddresses(data || []);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginLoading(true);
    const normalizedEmail = login.email.trim().toLowerCase();
    const isDefaultLogin = normalizedEmail === LOGIN.email && login.password === LOGIN.password;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('password', login.password)
      .single();

    setLoginLoading(false);

    if (error || !data) {
      if (isDefaultLogin) {
        const defaultUser = {
          id: 'default-miguel',
          email: LOGIN.email,
          name: LOGIN.name,
        };
        setUser(defaultUser);
        if (remember) localStorage.setItem('moveis_user', JSON.stringify(defaultUser));
        if (!remember) localStorage.removeItem('moveis_user');
        setNotice('');
        return;
      }

      setNotice('Email ou senha invalidos. Use miguel@mg.com / 1234.');
      return;
    }

    setUser(data);
    if (remember) localStorage.setItem('moveis_user', JSON.stringify(data));
    if (!remember) localStorage.removeItem('moveis_user');
    setNotice('');
  }

  function logout() {
    localStorage.removeItem('moveis_user');
    setUser(null);
    setScreen('dashboard');
  }

  const stats = useMemo(() => {
    const totalQuantity = products.reduce((sum, product) => sum + (product.quantity || 0), 0);
    return {
      totalQuantity,
      registeredProducts: products.length,
      withAddress: products.filter((product) => product.address).length,
      withPhoto: products.filter((product) => getPhotos(product).length > 0).length,
      withoutAddress: products.filter((product) => !product.address).length,
    };
  }, [products]);

  const groupedProducts = useMemo(() => {
    return products.reduce((groups, product) => {
      const category = product.category || 'Sem Categoria';
      groups[category] = groups[category] || [];
      groups[category].push(product);
      return groups;
    }, {});
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const term = normalizeText(search);
      const matchesSearch =
        !term ||
        normalizeText(product.name).includes(term) ||
        normalizeText(product.sku).includes(term) ||
        normalizeText(product.address).includes(term);
      const matchesCategory = !categoryFilter || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const countingProducts = useMemo(() => {
    const term = normalizeText(countingSearch);
    return products.filter((product) => {
      return (
        !term ||
        normalizeText(product.name).includes(term) ||
        normalizeText(product.sku).includes(term) ||
        normalizeText(product.address).includes(term)
      );
    });
  }, [products, countingSearch]);

  function openProductModal(product = null) {
    const form = product
      ? {
          ...emptyProduct,
          ...product,
          address: product.address || '',
          photos: getPhotos(product),
        }
      : emptyProduct;
    setProductForm(form);
    setModalOpen(true);
  }

  async function saveProduct(event) {
    event.preventDefault();
    const previousAddress = productForm.id
      ? products.find((product) => product.id === productForm.id)?.address || null
      : null;
    const nextAddress = productForm.address || null;

    const photos = productForm.photos || [];
    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim(),
      category: productForm.category,
      quantity: Number(productForm.quantity) || 0,
      address: productForm.address || null,
      photos,
      photo_url: photos[0] || null,
      photo_type: productForm.photo_type || null,
      updated_at: new Date().toISOString(),
    };

    const request = productForm.id
      ? supabase.from('products').update(payload).eq('id', productForm.id)
      : supabase.from('products').insert([payload]);

    const { error } = await request;

    if (error) {
      setNotice('Erro ao salvar produto: ' + error.message);
      return;
    }

    await syncAddressStatus(previousAddress, nextAddress);
    setModalOpen(false);
    setNotice('Produto salvo com sucesso.');
    await loadProducts();
    await loadAddresses();
  }

  async function deleteProduct(id) {
    if (!confirm('Tem certeza que deseja excluir este movel?')) return;
    const product = products.find((item) => item.id === id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setNotice('Erro ao excluir produto: ' + error.message);
      return;
    }
    if (product?.address) await setAddressStatus(product.address, EMPTY_ADDRESS);
    setNotice('Produto excluido com sucesso.');
    await loadProducts();
    await loadAddresses();
  }

  async function setAddressStatus(fullAddress, status) {
    if (!fullAddress) return;
    const { error } = await supabase.from('addresses').update({ status }).eq('full_address', fullAddress);
    if (error) setNotice('Produto salvo, mas nao foi possivel atualizar o endereco: ' + error.message);
  }

  async function syncAddressStatus(previousAddress, nextAddress) {
    if (previousAddress && previousAddress !== nextAddress) {
      await setAddressStatus(previousAddress, EMPTY_ADDRESS);
    }
    if (nextAddress) {
      await setAddressStatus(nextAddress, OCCUPIED_ADDRESS);
    }
  }

  async function addPhotos(files, type, target = 'form') {
    const list = Array.from(files || []);
    if (list.length === 0) return;

    const compressed = [];
    for (const file of list) {
      compressed.push(await compressImage(file));
    }

    if (target === 'counting' && countingProduct) {
      const photos = [...getPhotos(countingProduct), ...compressed];
      const { error } = await supabase
        .from('products')
        .update({
          photos,
          photo_url: photos[0] || null,
          photo_type: type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', countingProduct.id);

      if (error) {
        setNotice('Erro ao salvar foto: ' + error.message);
        return;
      }

      setCountingProduct({ ...countingProduct, photos, photo_url: photos[0] || null });
      await loadProducts();
      return;
    }

    setProductForm((form) => ({
      ...form,
      photos: [...(form.photos || []), ...compressed],
      photo_type: type,
    }));
  }

  function removePhoto(index) {
    setProductForm((form) => ({
      ...form,
      photos: form.photos.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function startCounting(product) {
    setCountingProduct(product);
    setCountingQuantity(product.quantity || 0);
  }

  async function confirmCounting() {
    if (!countingProduct) return;
    const { error } = await supabase
      .from('products')
      .update({ quantity: countingQuantity, updated_at: new Date().toISOString() })
      .eq('id', countingProduct.id);

    if (error) {
      setNotice('Erro ao confirmar contagem: ' + error.message);
      return;
    }

    setCountingProduct(null);
    setNotice('Contagem confirmada.');
    await loadProducts();
  }

  async function generateAddresses() {
    const count = Number(prompt('Quantos enderecos deseja gerar?', '30'));
    if (!count || count <= 0) return;

    const parts = addressTemplate.split('-');
    const rows = Array.from({ length: count }, (_, index) => ({
      full_address: parts
        .map((part, partIndex) => `${part.charAt(0)}${String(Math.floor(index / Math.pow(10, partIndex)) + 1).padStart(2, '0')}`)
        .join('-'),
      status: EMPTY_ADDRESS,
      warehouse_config: JSON.stringify({ name: warehouseName || 'Deposito Principal', template: addressTemplate }),
    }));

    const { error } = await supabase.from('addresses').insert(rows);
    if (error) {
      setNotice('Erro ao gerar enderecos: ' + error.message);
      return;
    }
    setNotice(`${count} enderecos gerados.`);
    await loadAddresses();
  }

  function exportReport(type) {
    let csv = '\uFEFF';
    const rows = [...products];

    if (type === 'by_category') {
      csv += 'Categoria;Produto;SKU;Quantidade;Endereco;Fotos\n';
      rows
        .sort((a, b) => (a.category || '').localeCompare(b.category || ''))
        .forEach((product) => {
          csv += csvLine([product.category || 'Sem categoria', product.name, product.sku, product.quantity || 0, product.address || 'Nao localizado', `${getPhotos(product).length} foto(s)`]);
        });
    } else if (type === 'by_address') {
      csv += 'Endereco;Produto;SKU;Categoria;Quantidade;Fotos\n';
      rows
        .sort((a, b) => (a.address || 'ZZZ').localeCompare(b.address || 'ZZZ'))
        .forEach((product) => {
          csv += csvLine([product.address || 'Nao localizado', product.name, product.sku, product.category || 'Sem categoria', product.quantity || 0, `${getPhotos(product).length} foto(s)`]);
        });
    } else {
      csv += 'Produto;SKU;Categoria;Quantidade;Endereco;Fotos\n';
      rows.forEach((product) => {
        csv += csvLine([product.name, product.sku, product.category || 'Sem categoria', product.quantity || 0, product.address || 'Nao localizado', `${getPhotos(product).length} foto(s)`]);
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `moveis_estoque_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!user) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-icon">ME</div>
          <h1>MoveisEstoque</h1>
          <p>Sistema de controle de estoque para moveis</p>
          {notice && <div className="notice error">{notice}</div>}

          <label>Email</label>
          <input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} type="email" required />

          <label>Senha</label>
          <input value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} type="password" required />

          <label className="remember">
            <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
            Lembrar acesso
          </label>

          <button className="primary full" disabled={loginLoading}>
            {loginLoading ? 'Conectando...' : 'Entrar no Sistema'}
          </button>
          <small>Login: miguel@mg.com / 1234</small>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <strong>MoveisEstoque</strong>
          <span>{user.name || 'Usuario'}</span>
        </div>

        {[
          ['dashboard', 'Dashboard'],
          ['products', 'Produtos'],
          ['counting', 'Contagem Rapida'],
          ['warehouse', 'Enderecamento'],
          ['reports', 'Relatorios'],
        ].map(([key, label]) => (
          <button key={key} className={screen === key ? 'active' : ''} onClick={() => { setScreen(key); setSidebarOpen(false); }}>
            {label}
          </button>
        ))}

        <button className="logout" onClick={logout}>Sair</button>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">Menu</button>
          <h1>MoveisEstoque</h1>
          <button className="icon-button" onClick={() => setScreen('counting')} aria-label="Iniciar contagem">+</button>
        </header>

        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Fechar aviso">x</button>
          </div>
        )}

        {isLoading && <div className="loading-bar" aria-label="Carregando dados" />}

        {screen === 'dashboard' && (
          <section className="page">
            <div className="welcome">
              <div>
                <h2>Bem-vindo ao MoveisEstoque</h2>
                <p>Controle completo do estoque em tempo real.</p>
              </div>
              <button className="secondary" onClick={() => setScreen('counting')}>Iniciar contagem</button>
            </div>

            <div className="stats-grid">
              <Stat label="Total de Moveis" value={stats.totalQuantity} />
              <Stat label="Produtos Cadastrados" value={stats.registeredProducts} />
              <Stat label="Localizados" value={stats.withAddress} />
              <Stat label="Com Foto" value={stats.withPhoto} />
              <Stat label="Sem Localizacao" value={stats.withoutAddress} />
            </div>

            <div className="panel">
              <h2>Produtos por Categoria</h2>
              {Object.entries(groupedProducts).length === 0 && <p className="empty">Nenhum produto cadastrado.</p>}
              {Object.entries(groupedProducts).map(([category, items]) => (
                <div className="category-group" key={category}>
                  <div className="category-header">
                    <strong>{category}</strong>
                    <span>{items.reduce((sum, item) => sum + (item.quantity || 0), 0)} moveis</span>
                  </div>
                  {items.map((product) => <ProductRow key={product.id} product={product} onClick={() => openProductModal(product)} />)}
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'products' && (
          <section className="page">
            <div className="page-header">
              <h2>Catalogo de Moveis</h2>
              <button className="primary" onClick={() => openProductModal()}>Novo Movel</button>
            </div>

            <div className="filters">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por movel, SKU ou endereco..." />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">Todas Categorias</option>
                {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </div>

            <div className="products-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onEdit={() => openProductModal(product)} onDelete={() => deleteProduct(product.id)} onPhoto={setPhotoViewer} />
              ))}
              {filteredProducts.length === 0 && <p className="empty">Nenhum produto encontrado.</p>}
            </div>
          </section>
        )}

        {screen === 'counting' && (
          <section className="page">
            <h2>Contagem de Estoque</h2>
            {!countingProduct ? (
              <>
                <input className="wide-search" value={countingSearch} onChange={(event) => setCountingSearch(event.target.value)} placeholder="Buscar movel, SKU ou endereco para contagem..." />
                <div className="counting-list">
                  {countingProducts.map((product) => <ProductRow key={product.id} product={product} onClick={() => startCounting(product)} />)}
                  {countingProducts.length === 0 && <p className="empty">Nenhum produto encontrado para contagem.</p>}
                </div>
              </>
            ) : (
              <div className="counting-panel">
                <button className="text-button" onClick={() => setCountingProduct(null)}>Voltar</button>
                <ProductCover product={countingProduct} large />
                <h2>{countingProduct.name}</h2>
                <p>SKU: {countingProduct.sku}</p>
                <p>{countingProduct.address || 'Nao localizado'}</p>
                <div className="counter">
                  <button onClick={() => setCountingQuantity(Math.max(0, countingQuantity - 1))}>-</button>
                  <strong>{countingQuantity}</strong>
                  <button onClick={() => setCountingQuantity(countingQuantity + 1)}>+</button>
                </div>
                <input type="number" value={countingQuantity} onChange={(event) => setCountingQuantity(Math.max(0, Number(event.target.value) || 0))} />
                <div className="photo-actions">
                  <FileButton label="Tirar foto" capture onFiles={(files) => addPhotos(files, 'camera', 'counting')} />
                  <FileButton label="Selecionar varias" multiple onFiles={(files) => addPhotos(files, 'gallery', 'counting')} />
                </div>
                <button className="primary full" onClick={confirmCounting}>Confirmar contagem</button>
              </div>
            )}
          </section>
        )}

        {screen === 'warehouse' && (
          <section className="page">
            <h2>Enderecamento do Deposito</h2>
            <div className="panel">
              <div className="form-grid">
                <label>
                  Nome do Deposito
                  <input value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Ex: Deposito Central" />
                </label>
                <label>
                  Modelo de Enderecamento
                  <select value={addressTemplate} onChange={(event) => setAddressTemplate(event.target.value)}>
                    <option value="RUA-PREDIO-NIVEL">Rua &gt; Predio &gt; Nivel</option>
                    <option value="CORREDOR-ESTANTE-PRATELEIRA">Corredor &gt; Estante &gt; Prateleira</option>
                    <option value="SETOR-BLOCO-MODULO">Setor &gt; Bloco &gt; Modulo</option>
                    <option value="AREA-FILEIRA-POSICAO">Area &gt; Fileira &gt; Posicao</option>
                  </select>
                </label>
              </div>
              <button className="primary" onClick={generateAddresses}>Gerar enderecos</button>
            </div>
            <div className="addresses-grid">
              {addresses.map((address) => (
                <div key={address.id} className={`address-card ${address.status === EMPTY_ADDRESS ? 'empty' : 'occupied'}`}>
                  <strong>{address.full_address}</strong>
                  <span>{address.status === EMPTY_ADDRESS ? 'Livre' : 'Ocupado'}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === 'reports' && (
          <section className="page">
            <h2>Relatorios</h2>
            <div className="report-grid">
              <ReportCard title="Inventario Completo" onClick={() => exportReport('complete')} />
              <ReportCard title="Por Endereco" onClick={() => exportReport('by_address')} />
              <ReportCard title="Por Categoria" onClick={() => exportReport('by_category')} />
            </div>
          </section>
        )}
      </main>

      {sidebarOpen && <button className="overlay" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />}

      {modalOpen && (
        <ProductModal
          product={productForm}
          categories={categories}
          addresses={addresses}
          onChange={setProductForm}
          onClose={() => setModalOpen(false)}
          onSave={saveProduct}
          onAddPhotos={addPhotos}
          onRemovePhoto={removePhoto}
        />
      )}

      {photoViewer && (
        <div className="modal">
          <button className="modal-bg" onClick={() => setPhotoViewer('')} />
          <div className="photo-viewer">
            <button className="close" onClick={() => setPhotoViewer('')}>x</button>
            <img src={photoViewer} alt="Foto do movel" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductCover({ product, large = false }) {
  const photo = getPhotos(product)[0];
  if (photo) return <img className={large ? 'cover large' : 'cover'} src={photo} alt={product.name} />;
  return <div className={large ? 'cover placeholder large' : 'cover placeholder'}>ME</div>;
}

function ProductRow({ product, onClick }) {
  return (
    <button className="product-row" onClick={onClick}>
      <ProductCover product={product} />
      <div>
        <strong>{product.name}</strong>
        <span>SKU: {product.sku}</span>
        <span>{product.address || 'Nao localizado'}</span>
      </div>
      <b>{product.quantity || 0}</b>
    </button>
  );
}

function ProductCard({ product, onEdit, onDelete, onPhoto }) {
  const photos = getPhotos(product);
  return (
    <article className="product-card">
      <ProductCover product={product} large />
      <h3>{product.name}</h3>
      <p>SKU: {product.sku}</p>
      <p>{product.category || 'Sem categoria'}</p>
      <p>{product.address || 'Nao localizado'}</p>
      <div className="card-footer">
        <strong>{product.quantity || 0} un</strong>
        <div>
          <button disabled={!photos[0]} onClick={() => onPhoto(photos[0])}>Ver</button>
          <button onClick={onEdit}>Editar</button>
          <button className="danger" onClick={onDelete}>Excluir</button>
        </div>
      </div>
    </article>
  );
}

function ProductModal({ product, categories, addresses, onChange, onClose, onSave, onAddPhotos, onRemovePhoto }) {
  const photos = product.photos || [];

  function update(field, value) {
    onChange({ ...product, [field]: value });
  }

  return (
    <div className="modal">
      <button className="modal-bg" onClick={onClose} />
      <form className="modal-card" onSubmit={onSave}>
        <div className="modal-title">
          <h2>{product.id ? 'Editar Movel' : 'Cadastrar Movel'}</h2>
          <button type="button" className="close" onClick={onClose}>x</button>
        </div>

        <label>Nome do Movel<input value={product.name} onChange={(event) => update('name', event.target.value)} required /></label>
        <label>Codigo SKU<input value={product.sku} onChange={(event) => update('sku', event.target.value)} required /></label>
        <label>
          Categoria
          <select value={product.category} onChange={(event) => update('category', event.target.value)} required>
            <option value="">Selecione</option>
            {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
        </label>
        <label>Quantidade<input type="number" min="0" value={product.quantity} onChange={(event) => update('quantity', event.target.value)} /></label>
        <label>
          Localizacao
          <select value={product.address} onChange={(event) => update('address', event.target.value)}>
            <option value="">Automatica</option>
            {product.address && <option value={product.address}>{product.address}</option>}
            {addresses
              .filter((address) => address.status === EMPTY_ADDRESS && address.full_address !== product.address)
              .map((address) => <option key={address.id} value={address.full_address}>{address.full_address}</option>)}
          </select>
        </label>

        <div className="photo-actions">
          <FileButton label="Tirar foto" capture onFiles={(files) => onAddPhotos(files, 'camera')} />
          <FileButton label="Selecionar varias" multiple onFiles={(files) => onAddPhotos(files, 'gallery')} />
        </div>

        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <div key={`${photo.slice(0, 20)}-${index}`}>
                <img src={photo} alt={`Foto ${index + 1}`} />
                <button type="button" onClick={() => onRemovePhoto(index)}>x</button>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button className="primary">Salvar Movel</button>
        </div>
      </form>
    </div>
  );
}

function FileButton({ label, capture = false, multiple = false, onFiles }) {
  return (
    <label className="file-button">
      {label}
      <input
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        multiple={multiple}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </label>
  );
}

function ReportCard({ title, onClick }) {
  return (
    <div className="report-card">
      <h3>{title}</h3>
      <p>Baixe um CSV com os dados atualizados.</p>
      <button className="primary" onClick={onClick}>Baixar CSV</button>
    </div>
  );
}
