function exportToExcel() {
    const products = db.getProducts();
    
    if (products.length === 0) {
        alert('Nenhum produto disponível para exportação.');
        return;
    }
    
    const data = products.map(p => ({
        'Produto': p.name,
        'SKU': p.sku,
        'Categoria': p.category?.name || 'Sem categoria',
        'Quantidade': p.quantity,
        'Endereço': p.address?.fullAddress || 'Não endereçado',
        'Última Contagem': p.countLogs[0]?.countedAt
            ? new Date(p.countLogs[0].countedAt).toLocaleDateString()
            : 'Nunca contado'
    }));

    const ws_data = [Object.keys(data[0]), ...data.map(obj => Object.values(obj))];
    
    let csv = '';
    ws_data.forEach(row => {
        csv += row.join(';') + '\n';
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
