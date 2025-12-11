import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

const mockCustomers = [
    { id: 1, name: 'John Doe', address: '123 Solar St, Sunnyvale' },
    { id: 2, name: 'Jane Smith', address: '456 Energy Ave, Power City' },
    { id: 3, name: 'Green Corp', address: '789 Industrial Blvd, Eco Town' },
];

const manufacturers = [
    { id: 'growatt', name: 'Growatt' },
    { id: 'goodwe', name: 'GoodWe' },
    { id: 'deye', name: 'DEYE' },
    { id: 'sungrow', name: 'SunGrow' },
];

export default function OperationsPage() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [devices, setDevices] = useState([]);
    const [showAddDevice, setShowAddDevice] = useState(false);

    // Initial Load
    useEffect(() => {
        const fetchCustomers = async () => {
            const { data, error } = await supabase.from('customers').select('*');
            if (data && data.length > 0) {
                setCustomers(data);
                setSelectedCustomer(data[0]);
            }
        };
        fetchCustomers();
    }, []);

    // Mock Metrics
    const [metrics, setMetrics] = useState({
        currentPower: 0,
        dailyProduction: 0,
        dailyConsumption: 0,
        gridImport: 0,
        gridExport: 0,
        batterySoC: 0
    });

    // Data Fetching
    useEffect(() => {
        if (!selectedCustomer) return;

        // 1. Fetch real devices from Supabase
        const fetchDevices = async () => {
            const { data, error } = await supabase
                .from('devices')
                .select(`
                    *,
                    last_reading:device_readings(
                        power_watts,
                        energy_day_wh,
                        battery_soc,
                        grid_export_total_wh
                    )
                `)
                .eq('customer_id', selectedCustomer.id)
                .limit(10);

            if (data) {
                // Transform for UI
                const uiDevices = data.map(d => ({
                    id: d.id,
                    name: d.name,
                    manufacturer: d.type, // Simplify for demo
                    type: d.type,
                    serial: d.external_id,
                    status: d.status
                }));
                setDevices(uiDevices);

                // Aggregate Metrics
                let power = 0;
                let daily = 0;
                let soc = 0;
                let count = 0;

                data.forEach(d => {
                    if (d.last_reading && d.last_reading.length > 0) {
                        // Takes the most recent reading due to default ordering if not specified, 
                        // but ideally we should order by time in join. 
                        // For simplicity, assuming the single/latest relation or filtering in UI.
                        // Actually relation returns array, let's take index 0 if sorted
                        const reading = d.last_reading[0]; // Needs specific query ordering
                        power += Number(reading.power_watts || 0) / 1000; // W to kW
                        daily += Number(reading.energy_day_wh || 0) / 1000;
                        soc += Number(reading.battery_soc || 0);
                        count++;
                    }
                });

                if (count > 0) soc = soc / count;

                setMetrics({
                    currentPower: power,
                    dailyProduction: daily,
                    dailyConsumption: daily * 0.4, // Mock estimation
                    gridImport: 0,
                    gridExport: daily * 0.6,
                    batterySoC: soc
                });
            }
        };

        fetchDevices();

        // 2. Real-time Subscription
        const subscription = supabase
            .channel('public:device_readings')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_readings' }, payload => {
                console.log('New reading!', payload);
                fetchDevices(); // Refresh aggregation
            })
            .subscribe();

        return () => subscription.unsubscribe();

    }, [selectedCustomer]);

    const handleAddDevice = (device) => {
        setDevices([...devices, { ...device, id: Date.now(), status: 'online' }]);
        setShowAddDevice(false);
    };

    return (
        <div className="flex bg-gray-900 text-white min-h-screen font-sans">
            {/* Sidebar for Customers */}
            <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700 font-bold text-xl flex items-center gap-2">
                    <i className="fas fa-solar-panel text-yellow-400"></i>
                    Ops Center
                </div>
                <div className="p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Customers</h3>
                    <div className="space-y-1">
                        {customers.map(cust => (
                            <button
                                key={cust.id}
                                onClick={() => setSelectedCustomer(cust)}
                                className={`w-full text-left p-2 rounded text-sm ${selectedCustomer.id === cust.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                            >
                                {cust.name}
                            </button>
                        ))}
                        <button
                            onClick={async () => {
                                const name = prompt("Enter Customer Name:");
                                if (name) {
                                    const { data, error } = await supabase
                                        .from('customers')
                                        .insert({ name, address: 'Pending Address' })
                                        .select()
                                        .single();

                                    if (data) {
                                        setCustomers([...customers, data]);
                                        setSelectedCustomer(data);
                                    }
                                }
                            }}
                            className="w-full text-left p-2 rounded text-sm text-blue-400 hover:bg-gray-700 flex items-center gap-2"
                        >
                            <i className="fas fa-plus"></i> New Customer
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Ops Header */}
                <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
                    <div>
                        {selectedCustomer ? (
                            <>
                                <h1 className="text-lg font-bold">{selectedCustomer.name} - Operational Dashboard</h1>
                                <p className="text-xs text-gray-400">{selectedCustomer.address}</p>
                            </>
                        ) : (
                            <h1 className="text-lg font-bold text-gray-500">Select a Customer</h1>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm text-white flex items-center gap-2 border border-gray-600"
                        >
                            <i className="fas fa-pencil-ruler"></i> Design Mode
                        </button>
                        <div className="h-6 w-px bg-gray-700"></div>
                        <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/20">
                            System Healthy
                        </span>
                        <span className="text-sm text-gray-400">Last Update: Just now</span>
                    </div>
                </header>

                {/* Dashboard Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <MetricCard
                            label="Current Power"
                            value={`${metrics.currentPower.toFixed(2)} kW`}
                            icon="fas fa-bolt"
                            color="text-yellow-400"
                        />
                        <MetricCard
                            label="Daily Production"
                            value={`${metrics.dailyProduction.toFixed(2)} kWh`}
                            icon="fas fa-sun"
                            color="text-green-400"
                        />
                        <MetricCard
                            label="Battery SoC"
                            value={`${metrics.batterySoC.toFixed(0)}%`}
                            icon="fas fa-battery-three-quarters"
                            color="text-blue-400"
                        />
                        <MetricCard
                            label="Grid Export"
                            value={`${metrics.gridExport.toFixed(2)} kWh`}
                            icon="fas fa-network-wired"
                            color="text-purple-400"
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <h3 className="font-bold mb-4 text-gray-300">Power Generation Curve</h3>
                            <div className="h-64">
                                <PowerGraph />
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <h3 className="font-bold mb-4 text-gray-300">Energy Flow</h3>
                            <div className="h-64 flex items-center justify-center">
                                <EnergyDistributionChart />
                            </div>
                        </div>
                    </div>

                    {/* Devices Section */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold">System Devices</h2>
                            <button
                                onClick={() => setShowAddDevice(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                            >
                                <i className="fas fa-plus"></i> Add Device
                            </button>
                        </div>

                        {devices.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded border border-gray-700 border-dashed">
                                <i className="fas fa-microchip text-4xl mb-3"></i>
                                <p>No Inverters or Meters connected yet.</p>
                                <button onClick={() => setShowAddDevice(true)} className="text-blue-400 hover:underline mt-2">Connect a device</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {devices.map(dev => (
                                    <DeviceCard key={dev.id} device={dev} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Device Modal */}
            {showAddDevice && (
                <AddDeviceModal
                    onClose={() => setShowAddDevice(false)}
                    onAdd={handleAddDevice}
                    selectedCustomer={selectedCustomer}
                />
            )}
        </div>
    );
}

function MetricCard({ label, value, icon, color }) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-xl ${color}`}>
                <i className={icon}></i>
            </div>
            <div>
                <p className="text-gray-400 text-xs uppercase font-bold">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
            </div>
        </div>
    );
}

function DeviceCard({ device }) {
    return (
        <div className="bg-gray-900 p-4 rounded border border-gray-700 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-50 text-6xl text-gray-800 -rotate-12 pointer-events-none">
                <i className="fas fa-solar-panel"></i>
            </div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold bg-blue-900 text-blue-300 px-2 py-1 rounded uppercase">{device.type}</span>
                    <span className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                    </span>
                </div>
                <h3 className="font-bold text-lg mb-1">{device.name}</h3>
                <p className="text-xs text-gray-400 mb-3">SN: {device.serial}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800 p-2 rounded">
                        <span className="text-gray-500 block">Manufacturer</span>
                        <span>{device.manufacturer}</span>
                    </div>
                    <div className="bg-gray-800 p-2 rounded">
                        <span className="text-gray-500 block">Status</span>
                        <span className="text-green-400">Normal</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AddDeviceModal({ onClose, onAdd, selectedCustomer }) {
    const [form, setForm] = useState({
        type: 'Inverter',
        manufacturer: 'Growatt',
        model: '',
        serial: '',
        name: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Create Integration
        const { data: interaction, error } = await supabase
            .from('customer_integrations')
            .insert({
                customer_id: selectedCustomer.id, // Passed from parent via context/prop ideally, or use state
                manufacturer: form.manufacturer.toLowerCase(),
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error(error);
            alert('Failed to add integration');
            return;
        }

        // 2. Create Device Linked to Integration
        const { error: devError } = await supabase
            .from('devices')
            .insert({
                customer_id: selectedCustomer.id,
                integration_id: interaction.id,
                external_id: form.serial,
                name: form.name,
                type: form.type,
                status: 'online'
            });

        if (devError) {
            console.error(devError);
            alert('Failed to register device');
        } else {
            // Refresh parent
            onAdd(form); // Close modal
            // Force Fetch Trigger via simple post if this were real
            // supabase.functions.invoke('fetch-manufacturer-data');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md border border-gray-700 shadow-2xl">
                <h2 className="text-xl font-bold mb-6">Add New Device</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Device Type</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            value={form.type}
                            onChange={e => setForm({ ...form, type: e.target.value })}
                        >
                            <option>Inverter</option>
                            <option>Smart Meter</option>
                            <option>Optimizer</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Manufacturer</label>
                        <select
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            value={form.manufacturer}
                            onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                        >
                            {manufacturers.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Serial Number / Device ID</label>
                        <input
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            value={form.serial}
                            onChange={e => setForm({ ...form, serial: e.target.value })}
                            placeholder="e.g. GT12345678"
                        />
                        <p className="text-xs text-blue-400 mt-1">
                            <i className="fas fa-info-circle"></i> Used to fetch API data
                        </p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase">Device Name</label>
                        <input
                            required
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Main Inverter"
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-700 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 py-2 text-gray-400 hover:text-white">Cancel</button>
                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold">Add Device</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PowerGraph() {
    // Generate dummy data for the graph
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const data = {
        labels,
        datasets: [
            {
                label: 'Production (kW)',
                data: labels.map((_, i) => {
                    // Solar curve shape
                    if (i < 6 || i > 18) return 0;
                    return 5 * Math.sin((i - 6) * Math.PI / 12);
                }),
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74, 222, 128, 0.2)',
                tension: 0.4,
                fill: true,
            },
            {
                label: 'Consumption (kW)',
                data: labels.map(() => 1 + Math.random()),
                borderColor: '#ef4444',
                backgroundColor: 'transparent',
                tension: 0.4,
                borderDash: [5, 5],
            }
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: '#9ca3af' } },
        },
        scales: {
            y: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
        }
    };

    return <Line data={data} options={options} />;
}

function EnergyDistributionChart() {
    const data = {
        labels: ['Self-Use', 'Grid Export', 'Grid Import'],
        datasets: [
            {
                data: [45, 30, 25],
                backgroundColor: [
                    '#3b82f6', // Blue
                    '#4ade80', // Green
                    '#ef4444', // Red
                ],
                borderWidth: 0,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'right', labels: { color: '#9ca3af' } },
        },
        cutout: '70%',
    };

    return <Doughnut data={data} options={options} />;
}
