import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService, equipmentService } from '../lib/supabase';

export default function AdminPage() {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('products');

    // Data States
    const [products, setProducts] = useState([]);
    const [taxSlabs, setTaxSlabs] = useState([]);
    const [additionalItems, setAdditionalItems] = useState([]);
    const [plans, setPlans] = useState([]);

    // Edit States
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingTaxSlab, setEditingTaxSlab] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [editingPlan, setEditingPlan] = useState(null);

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        try {
            const admin = await adminService.checkIsAdmin();
            if (!admin) {
                navigate('/');
                return;
            }
            setIsAdmin(true);
            loadData();
        } catch (error) {
            console.error('Auth check failed', error);
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const loadData = async () => {
        try {
            const [prods, taxes, items, plns] = await Promise.all([
                adminService.getAllProducts(),
                adminService.getTaxSlabs(),
                adminService.getAdditionalItems(),
                adminService.getPlans()
            ]);
            setProducts(prods);
            setTaxSlabs(taxes);
            setAdditionalItems(items);
            setPlans(plns);
        } catch (error) {
            console.error('Failed to load admin data', error);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading Admin Panel...</div>;
    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-blue-400">Admin Dashboard</h1>
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
                        Exit Admin
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-4 mb-6 border-b border-gray-700">
                    {['products', 'tax_slabs', 'additional_items', 'plans'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-2 px-4 capitalize font-medium transition ${activeTab === tab
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
                    {activeTab === 'products' && (
                        <ProductsTab
                            products={products}
                            taxSlabs={taxSlabs}
                            onUpdate={loadData}
                        />
                    )}
                    {activeTab === 'tax_slabs' && (
                        <TaxSlabsTab
                            taxSlabs={taxSlabs}
                            onUpdate={loadData}
                        />
                    )}
                    {activeTab === 'additional_items' && (
                        <AdditionalItemsTab
                            items={additionalItems}
                            taxSlabs={taxSlabs}
                            onUpdate={loadData}
                        />
                    )}
                    {activeTab === 'plans' && (
                        <PlansTab
                            plans={plans}
                            products={products}
                            additionalItems={additionalItems}
                            onUpdate={loadData}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub Components ---

function ProductsTab({ products, taxSlabs, onUpdate }) {
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const startEdit = (product) => {
        setEditingId(product.id);
        setEditForm({
            cost: product.cost,
            margin: product.margin || 0,
            tax_slab_id: product.tax_slab_id || ''
        });
    };

    const saveEdit = async () => {
        try {
            await equipmentService.updateEquipment(editingId, editForm);
            setEditingId(null);
            onUpdate();
        } catch (error) {
            alert('Failed to update product');
        }
    };

    const handleExport = () => {
        const headers = ['id', 'name', 'type', 'cost', 'margin'];
        const csvContent = [
            headers.join(','),
            ...products.map(p => [
                p.id,
                `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
                `"${p.equipment_types?.name || ''}"`,
                p.cost,
                p.margin || 0
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'products_pricing.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());

            // Basic validation
            if (!headers.includes('id') || !headers.includes('cost') || !headers.includes('margin')) {
                alert('Invalid CSV format. Must include id, cost, and margin columns.');
                return;
            }

            const updates = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                // Simple CSV parsing (handling quotes is tricky without a library, assuming simple format for now)
                // For robustness, we should ideally use a library, but for this specific "export -> edit -> import" flow, 
                // simple splitting might suffice if users don't add commas in numbers.
                // A better regex split:
                const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!row) continue;

                const rowData = {};
                headers.forEach((h, index) => {
                    let val = row[index] ? row[index].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
                    rowData[h] = val;
                });

                if (rowData.id && rowData.cost) {
                    updates.push(equipmentService.updateEquipment(rowData.id, {
                        cost: parseFloat(rowData.cost),
                        margin: parseFloat(rowData.margin || 0)
                    }));
                }
            }

            try {
                await Promise.all(updates);
                alert(`Successfully updated ${updates.length} products.`);
                onUpdate();
            } catch (error) {
                console.error("Bulk update failed", error);
                alert('Failed to update some products. Check console for details.');
            }

            // Reset input
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Product Management</h2>
                <div className="flex gap-2">
                    <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                        <i className="fas fa-download"></i> Export CSV
                    </button>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-2 cursor-pointer">
                        <i className="fas fa-upload"></i> Import CSV
                        <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                    </label>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-700 text-gray-300 uppercase">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Base Cost (₹)</th>
                            <th className="p-3">Margin (%)</th>
                            <th className="p-3">Final Price (₹)</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {products.map(product => {
                            const isEditing = editingId === product.id;
                            const cost = isEditing ? parseFloat(editForm.cost) : product.cost;
                            const margin = isEditing ? parseFloat(editForm.margin) : (product.margin || 0);

                            const priceWithMargin = cost * (1 + margin / 100);

                            return (
                                <tr key={product.id} className="hover:bg-gray-750">
                                    <td className="p-3 font-medium">{product.name}</td>
                                    <td className="p-3 text-gray-400">{product.equipment_types?.name}</td>
                                    <td className="p-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editForm.cost}
                                                onChange={e => setEditForm({ ...editForm, cost: e.target.value })}
                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-24"
                                            />
                                        ) : (
                                            `₹${product.cost}`
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={editForm.margin}
                                                onChange={e => setEditForm({ ...editForm, margin: e.target.value })}
                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 w-20"
                                            />
                                        ) : (
                                            `${product.margin || 0}%`
                                        )}
                                    </td>
                                    <td className="p-3 font-bold text-green-400">
                                        ₹{priceWithMargin.toFixed(2)}
                                    </td>
                                    <td className="p-3">
                                        {isEditing ? (
                                            <div className="flex gap-2">
                                                <button onClick={saveEdit} className="text-green-400 hover:text-green-300"><i className="fas fa-check"></i></button>
                                                <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-300"><i className="fas fa-times"></i></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startEdit(product)} className="text-blue-400 hover:text-blue-300">
                                                <i className="fas fa-edit"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TaxSlabsTab({ taxSlabs, onUpdate }) {
    const [newSlab, setNewSlab] = useState({ name: '', percentage: 0, description: '' });

    const handleAdd = async () => {
        if (!newSlab.name) return;
        await adminService.createTaxSlab(newSlab);
        setNewSlab({ name: '', percentage: 0, description: '' });
        onUpdate();
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this tax slab?')) {
            await adminService.deleteTaxSlab(id);
            onUpdate();
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Tax Slabs</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                    placeholder="Slab Name (e.g. GST 18%)"
                    value={newSlab.name}
                    onChange={e => setNewSlab({ ...newSlab, name: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded p-2"
                />
                <input
                    type="number"
                    placeholder="Percentage (%)"
                    value={newSlab.percentage}
                    onChange={e => setNewSlab({ ...newSlab, percentage: e.target.value })}
                    className="bg-gray-700 border border-gray-600 rounded p-2"
                />
                <button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 rounded p-2 font-bold">
                    Add Slab
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {taxSlabs.map(slab => (
                    <div key={slab.id} className="bg-gray-700 p-4 rounded flex justify-between items-center">
                        <div>
                            <div className="font-bold text-lg">{slab.name}</div>
                            <div className="text-2xl text-blue-400 font-bold">{slab.percentage}%</div>
                        </div>
                        <button onClick={() => handleDelete(slab.id)} className="text-red-400 hover:text-red-300">
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AdditionalItemsTab({ items, onUpdate }) {
    const [newItem, setNewItem] = useState({ name: '', cost: 0, margin: 0 });

    const handleAdd = async () => {
        if (!newItem.name) return;
        await adminService.createAdditionalItem(newItem);
        setNewItem({ name: '', cost: 0, margin: 0 });
        onUpdate();
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this item?')) {
            await adminService.deleteAdditionalItem(id);
            onUpdate();
        }
    };

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Additional Items (Services/Fees)</h2>
            <div className="bg-gray-700 p-4 rounded mb-6">
                <h3 className="font-bold mb-2 text-sm text-gray-400 uppercase">Add New Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        placeholder="Item Name"
                        value={newItem.name}
                        onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                        className="bg-gray-900 border border-gray-600 rounded p-2"
                    />
                    <input
                        type="number"
                        placeholder="Cost (₹)"
                        value={newItem.cost}
                        onChange={e => setNewItem({ ...newItem, cost: e.target.value })}
                        className="bg-gray-900 border border-gray-600 rounded p-2"
                    />
                    <input
                        type="number"
                        placeholder="Margin (%)"
                        value={newItem.margin}
                        onChange={e => setNewItem({ ...newItem, margin: e.target.value })}
                        className="bg-gray-900 border border-gray-600 rounded p-2"
                    />
                    <button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 rounded p-2 font-bold">
                        Add Item
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {items.map(item => (
                    <div key={item.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                        <div className="flex-1">
                            <div className="font-bold">{item.name}</div>
                            <div className="text-xs text-gray-400">
                                Base: ₹{item.cost} | Margin: {item.margin}%
                            </div>
                        </div>
                        <div className="font-bold text-green-400 mr-4">
                            ₹{(item.cost * (1 + (item.margin || 0) / 100)).toFixed(2)}
                        </div>
                        <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300">
                            <i className="fas fa-trash"></i>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlansTab({ plans, products, additionalItems, onUpdate }) {
    const [newPlan, setNewPlan] = useState({ name: '', description: '' });
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [planItems, setPlanItems] = useState([]);

    const handleAddPlan = async () => {
        if (!newPlan.name) return;
        await adminService.createPlan(newPlan);
        setNewPlan({ name: '', description: '' });
        onUpdate();
    };

    const handleSelectPlan = async (plan) => {
        setSelectedPlan(plan);
        const items = await adminService.getPlanItems(plan.id);
        setPlanItems(items);
    };

    const handleAddItemToPlan = async (type, id) => {
        if (!selectedPlan) return;
        await adminService.addPlanItem({
            plan_id: selectedPlan.id,
            item_type: type,
            item_id: id,
            quantity: 1
        });
        const items = await adminService.getPlanItems(selectedPlan.id);
        setPlanItems(items);
    };

    const handleRemoveItem = async (itemId) => {
        await adminService.removePlanItem(itemId);
        const items = await adminService.getPlanItems(selectedPlan.id);
        setPlanItems(items);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plans List */}
            <div className="lg:col-span-1 border-r border-gray-700 pr-6">
                <h2 className="text-xl font-bold mb-4">Plans</h2>
                <div className="mb-4 flex gap-2">
                    <input
                        placeholder="New Plan Name"
                        value={newPlan.name}
                        onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                        className="bg-gray-700 border border-gray-600 rounded p-2 flex-1"
                    />
                    <button onClick={handleAddPlan} className="bg-blue-600 hover:bg-blue-700 rounded px-3">
                        <i className="fas fa-plus"></i>
                    </button>
                </div>
                <div className="space-y-2">
                    {plans.map(plan => (
                        <div
                            key={plan.id}
                            onClick={() => handleSelectPlan(plan)}
                            className={`p-3 rounded cursor-pointer transition ${selectedPlan?.id === plan.id ? 'bg-blue-900 border border-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            <div className="font-bold">{plan.name}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Plan Details */}
            <div className="lg:col-span-2">
                {selectedPlan ? (
                    <div>
                        <h2 className="text-xl font-bold mb-4">Editing: {selectedPlan.name}</h2>

                        {/* Current Items */}
                        <div className="bg-gray-800 border border-gray-700 rounded p-4 mb-6">
                            <h3 className="font-bold mb-2 text-gray-400 uppercase text-xs">Plan Contents</h3>
                            {planItems.length === 0 ? (
                                <p className="text-gray-500 italic">No items in this plan yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {planItems.map(pItem => {
                                        // Resolve name
                                        let name = 'Unknown Item';
                                        if (pItem.item_type === 'equipment') {
                                            const prod = products.find(p => p.id === pItem.item_id);
                                            if (prod) name = prod.name;
                                        } else {
                                            const item = additionalItems.find(i => i.id === pItem.item_id);
                                            if (item) name = item.name;
                                        }

                                        return (
                                            <div key={pItem.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                                                <span>{name} ({pItem.item_type})</span>
                                                <button onClick={() => handleRemoveItem(pItem.id)} className="text-red-400 hover:text-red-300">
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Add Items */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-bold mb-2 text-sm">Add Product</h4>
                                <div className="h-48 overflow-y-auto bg-gray-700 rounded p-2 space-y-1">
                                    {products.map(prod => (
                                        <div key={prod.id} className="flex justify-between items-center text-xs p-1 hover:bg-gray-600 rounded cursor-pointer" onClick={() => handleAddItemToPlan('equipment', prod.id)}>
                                            <span>{prod.name}</span>
                                            <i className="fas fa-plus text-green-400"></i>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold mb-2 text-sm">Add Service/Fee</h4>
                                <div className="h-48 overflow-y-auto bg-gray-700 rounded p-2 space-y-1">
                                    {additionalItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-xs p-1 hover:bg-gray-600 rounded cursor-pointer" onClick={() => handleAddItemToPlan('additional', item.id)}>
                                            <span>{item.name}</span>
                                            <i className="fas fa-plus text-green-400"></i>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Select a plan to edit details
                    </div>
                )}
            </div>
        </div>
    );
}
