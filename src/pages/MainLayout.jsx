import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSolarStore } from '../stores/solarStore';
import { useAuth } from '../context/AuthContext';
import {
    LayoutGrid,
    Battery,
    Settings,
    Users,
    BarChart3,
    Search,
    Bell,
    Menu,
    ChevronDown,
    LogOut
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, path, isActive, collapsed, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
      ${isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }
    `}
    >
        <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
        {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap">{label}</span>
        )}
        {isActive && !collapsed && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
        )}
    </button>
);

export default function MainLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [showCustomerMenu, setShowCustomerMenu] = useState(false);

    // Store Hooks
    const customers = useSolarStore((state) => state.customers);
    const fetchCustomers = useSolarStore((state) => state.fetchCustomers);
    const activeCustomer = useSolarStore((state) => state.activeCustomer);
    const setActiveCustomer = useSolarStore((state) => state.setActiveCustomer);
    const loadCustomerProject = useSolarStore((state) => state.loadCustomerProject);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleCustomerSwitch = (customer) => {
        setActiveCustomer(customer);
        setShowCustomerMenu(false);
        loadCustomerProject(customer.id);
        // Navigate to dashboard if not already there to refresh view context
        if (location.pathname !== '/') navigate('/');
    };

    const menuItems = [
        { label: "Planning - Canvas", icon: LayoutGrid, path: "/" },
        { label: "Planning - Battery Analysis", icon: Battery, path: "/battery-analysis" },
        { label: "Operations", icon: BarChart3, path: "/operations" },
        { label: "Customer Management", icon: Users, path: "/customers" },
        { label: "Admin", icon: Settings, path: "/admin" },
    ];

    return (
        <div className="flex h-screen w-full bg-slate-900 overflow-hidden font-sans">

            {/* SIDEBAR NAVIGATION */}
            <div
                className={`flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0
          ${collapsed ? 'w-16' : 'w-64'}
        `}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center px-4 border-b border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-1.5 rounded-lg shrink-0">
                            <ZapIcon size={20} className="text-white" />
                        </div>
                        {!collapsed && (
                            <div>
                                <h1 className="font-bold text-white leading-none tracking-tight">SolarArchitect</h1>
                                <span className="text-[10px] text-slate-500 font-mono">PRO SUITE</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="ml-auto text-slate-500 hover:text-white lg:hidden"
                    >
                        <Menu size={20} />
                    </button>
                </div>

                {/* Customer Context Switcher */}
                {!collapsed && (
                    <div className="p-4 border-b border-slate-800 relative">
                        <div className="text-[10px] uppercase text-slate-500 font-bold mb-2 px-1">Active Context</div>
                        <button
                            onClick={() => setShowCustomerMenu(!showCustomerMenu)}
                            className="w-full bg-slate-800 hover:bg-slate-700 p-2 rounded-lg flex items-center justify-between border border-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                    {activeCustomer ? activeCustomer.name.charAt(0) : '?'}
                                </div>
                                <div className="flex flex-col items-start overflow-hidden">
                                    <span className="text-sm text-slate-200 truncate font-medium w-full text-left">
                                        {activeCustomer ? activeCustomer.name : 'Select Customer'}
                                    </span>
                                    {activeCustomer && <span className="text-[10px] text-slate-500 truncate">{activeCustomer.address ? activeCustomer.address.substring(0, 20) : 'No Address'}</span>}
                                </div>
                            </div>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {/* Dropdown Menu */}
                        {showCustomerMenu && (
                            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                                <div className="p-2 space-y-1">
                                    {customers.length === 0 && (
                                        <div className="text-xs text-slate-500 p-2 text-center">No customers found</div>
                                    )}
                                    {customers.map(cust => (
                                        <button
                                            key={cust.id}
                                            onClick={() => handleCustomerSwitch(cust)}
                                            className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors ${activeCustomer?.id === cust.id ? 'bg-slate-700 text-white' : 'text-slate-300'}`}
                                        >
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            {cust.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    {menuItems.map((item) => (
                        <SidebarItem
                            key={item.path}
                            {...item}
                            isActive={location.pathname === item.path}
                            collapsed={collapsed}
                            onClick={() => navigate(item.path)}
                        />
                    ))}
                </div>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-slate-800 mt-auto">
                    {!collapsed ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 border border-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                                    {user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-medium text-white truncate">{profile?.full_name || 'User'}</span>
                                    <span className="text-xs text-slate-500 truncate">{user?.email}</span>
                                </div>
                            </div>
                            <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Logout">
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="mx-auto w-8 h-8 rounded-full bg-indigo-600 border border-indigo-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer" title={user?.email}>
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
                <div className="flex-1 overflow-hidden relative">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

// Simple Icon component
const ZapIcon = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);
