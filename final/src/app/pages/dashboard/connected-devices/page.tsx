"use client"

import React, { useState, useEffect, useCallback } from "react";
import { fetchNetworks } from "@/app/lib/networkServer";
import { Networks } from "@/app/lib/network";
import Sidebar from "@/app/components/Sidebar";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, Search, Wifi, Clock, Monitor, Smartphone, Server, Database, Filter, X } from 'lucide-react';


interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  deviceTypes: Record<string, number>;
  whitelist: {
    true: number;
    false: number;
  };
}

interface SortConfig {
  key: keyof Networks;
  direction: 'asc' | 'desc';
}

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

export default function ConnectedDevices() {
  const [networks, setNetworks] = useState<Networks[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>("all");
  const [whitelistFilter, setWhitelistFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'updated_at', direction: 'desc' });
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [intervalTime, setIntervalTime] = useState<number>(60000); // 60 seconds default

  const [stats, setStats] = useState<DeviceStats>({
    total: 0,
    online: 0,
    offline: 0,
    deviceTypes: {},
    whitelist: { true: 0, false: 0 },
  });

  const fetchData = useCallback(async (showLoading = true): Promise<void> => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      const res = await fetchNetworks();
      
      const transformedData: Networks[] = res.map(device => ({
        ...device,
        manufacturer: device.manufacturer || determineDeviceType(device.hostname)
      }));
      
      setNetworks(transformedData);
      calculateStats(transformedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load network data");
    } finally {
      if (showLoading) {
        setLoading(false);
      } 
      // Slight delay to hide the refreshing indicator for a smoother experience
      setTimeout(() => {
        setRefreshing(false);
      }, 300);
    }
  }, []); 

  // Determine device type from hostname
  const determineDeviceType = (hostname: string): string => {
    const lower = hostname.toLowerCase();
    if (lower.includes('server') || lower.includes('srv')) return 'Server';
    if (lower.includes('laptop') || lower.includes('notebook')) return 'Laptop';
    if (lower.includes('phone') || lower.includes('mobile')) return 'Mobile';
    if (lower.includes('pc') || lower.includes('desktop') || lower.includes('computer')) return 'Desktop';
    if (lower.includes('tablet') || lower.includes('ipad')) return 'Tablet';
    if (lower.includes('printer')) return 'Printer';
    if (lower.includes('camera')) return 'Camera';
    if (lower.includes('router') || lower.includes('switch') || lower.includes('ap')) return 'Network Device';
    return 'Unknown';
  };

  // Calculate statistics
  const calculateStats = (data: Networks[]): void => {
    if (!data || !data.length) return;

    const onlineCount = data.filter(device => device.status === "online").length;
    const offlineCount = data.filter(device => device.status === "offline").length;
    
    // Calculate device types
    const deviceTypes = data.reduce<Record<string, number>>((acc, device) => {
      const type = device.manufacturer || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Calculate whitelist stats
    const whitelistCount = data.filter(device => device.whitelist).length;
    const nonWhitelistCount = data.length - whitelistCount;

    setStats({
      total: data.length,
      online: onlineCount,
      offline: offlineCount,
      deviceTypes,
      whitelist: { true: whitelistCount, false: nonWhitelistCount }
    });
  };

  // Sorting function
  const requestSort = (key: keyof Networks): void => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting, filtering and searching
  const getFilteredData = (): Networks[] => {
    return networks
      .filter(device => {
        const matchesSearch = 
          searchTerm === "" || 
          device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          device.ip_address.includes(searchTerm) ||
          device.mac_address.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = 
          statusFilter === "all" || 
          device.status === statusFilter;
        
        const matchesDeviceType = 
          deviceTypeFilter === "all" || 
          device.manufacturer === deviceTypeFilter;
        
        const matchesWhitelist = 
          whitelistFilter === "all" || 
          (whitelistFilter === "true" && device.whitelist) || 
          (whitelistFilter === "false" && !device.whitelist);
        
        return matchesSearch && matchesStatus && matchesDeviceType && matchesWhitelist;
      })
      .sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        // Handle null or undefined values
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        
        // Handle string comparison
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        // Handle boolean comparison
        if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
          return sortConfig.direction === 'asc'
            ? (aValue === bValue ? 0 : aValue ? 1 : -1)
            : (aValue === bValue ? 0 : aValue ? -1 : 1);
        }
        
        // Generic comparison for other types
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        
        return 0;
      });
  };

  // Generate unique device types for filter dropdown
  const getUniqueDeviceTypes = (): string[] => {
    const types = new Set<string>();
    networks.forEach(device => {
      if (device.manufacturer) types.add(device.manufacturer);
    });
    return Array.from(types);
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Prepare chart data
  const prepareStatusChartData = (): ChartDataItem[] => {
    return [
      { name: "Online", value: stats.online, color: "#10b981" },
      { name: "Offline", value: stats.offline, color: "#ef4444" },
    ];
  };

  const prepareDeviceTypeChartData = (): ChartDataItem[] => {
    return Object.entries(stats.deviceTypes).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  };

  const prepareBlockedChartData = (): ChartDataItem[] => {
    return [
      { name: "Allowed", value: stats.whitelist.true, color: "#3b82f6" },
      { name: "Blocked", value: stats.whitelist.false, color: "#ef4444" },
    ];
  };

  // Function to change interval
  const changeInterval = (seconds: number): void => {
    setIntervalTime(seconds * 1000);
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), intervalTime);
    return () => clearInterval(interval);
  }, [fetchData, intervalTime]);

  // Color palette for charts
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1", "#64748b"];

  // Calculate time since last activity for each device
  const getTimeSinceUpdate = (dateString: string): string => {
    const updateTime = new Date(dateString).getTime();
    const currentTime = new Date().getTime();
    const diffInMinutes = Math.floor((currentTime - updateTime) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hrs ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  // Function to get appropriate icon based on device type
  const getDeviceIcon = (deviceType: string | null): React.ReactNode => {
    const type = (deviceType || "").toLowerCase();
    
    if (type.includes('server')) return <Server className="h-5 w-5" />;
    if (type.includes('laptop') || type.includes('desktop') || type.includes('pc') || type.includes('computer')) 
      return <Monitor className="h-5 w-5" />;
    if (type.includes('phone') || type.includes('mobile') || type.includes('tablet')) 
      return <Smartphone className="h-5 w-5" />;
    if (type.includes('network') || type.includes('router') || type.includes('switch')) 
      return <Wifi className="h-5 w-5" />;
    
    return <Database className="h-5 w-5" />;
};

  const filteredData = getFilteredData();
  const uniqueDeviceTypes = getUniqueDeviceTypes();

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <div className="flex-1 p-6 overflow-y-auto max-h-[95vh]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Connected Devices
            </h1>
            <p className="text-gray-500 mt-1">Monitor and manage devices on your network</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
              <button 
                onClick={() => changeInterval(30)} 
                className={`px-3 py-2 text-sm ${intervalTime === 30000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
              >
                30s
              </button>
              <button 
                onClick={() => changeInterval(60)} 
                className={`px-3 py-2 text-sm ${intervalTime === 60000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
              >
                1m
              </button>
              <button 
                onClick={() => changeInterval(300)} 
                className={`px-3 py-2 text-sm ${intervalTime === 300000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
              >
                5m
              </button>
            </div>
            
            <button 
              onClick={() => fetchData(false)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md"
              disabled={refreshing || loading}
            >
              <RefreshCw size={16} className={refreshing || loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by hostname, IP address, or MAC address..."
            className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Wifi size={28} className="text-blue-600" />
              </div>
            </div>
            
            <div>
              <p className="text-gray-500 mb-1">Total Devices</p>
              <h2 className="text-4xl font-bold text-gray-800">
                <span className="transition-all duration-300">{stats.total}</span>
              </h2>
            </div>
            
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-100 rounded-full opacity-50"></div>
          </div>
          
          <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Monitor size={28} className="text-green-600" />
              </div>
            </div>
            
            <div>
              <p className="text-gray-500 mb-1">Online Devices</p>
              <h2 className="text-4xl font-bold text-gray-800">
                <span className="transition-all duration-300">{stats.online}</span>
              </h2>
            </div>
            
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-green-100 rounded-full opacity-50"></div>
          </div>
          
          <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <X size={28} className="text-red-600" />
              </div>
            </div>
            
            <div>
              <p className="text-gray-500 mb-1">Offline Devices</p>
              <h2 className="text-4xl font-bold text-gray-800">
                <span className="transition-all duration-300">{stats.offline}</span>
              </h2>
            </div>
            
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-red-100 rounded-full opacity-50"></div>
          </div>
          
          <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Filter size={28} className="text-purple-600" />
              </div>
            </div>
            
            <div>
              <p className="text-gray-500 mb-1">Blocked Devices</p>
              <h2 className="text-4xl font-bold text-gray-800">
                <span className="transition-all duration-300">{stats.whitelist.false}</span>
              </h2>
            </div>
            
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-purple-100 rounded-full opacity-50"></div>
          </div>
        </div>
        
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Status Distribution Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareStatusChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareStatusChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Device Type Distribution Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Device Type Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareDeviceTypeChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={{ backgroundColor: 'white', borderColor: '#e5e7eb' }} />
                  <Bar dataKey="value" fill="#8884d8">
                    {prepareDeviceTypeChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Blocked Devices Chart (replaced Whitelist) */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Blocked vs Allowed Devices</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareBlockedChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }: { name: string, percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareBlockedChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'white', borderColor: '#e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="statusFilter"
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="deviceTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Device Type
              </label>
              <select
                id="deviceTypeFilter"
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={deviceTypeFilter}
                onChange={(e) => setDeviceTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {uniqueDeviceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="whitelistFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Access Status
              </label>
              <select
                id="whitelistFilter"
                className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={whitelistFilter}
                onChange={(e) => setWhitelistFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="true">Allowed</option>
                <option value="false">Blocked</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDeviceTypeFilter("all");
                  setWhitelistFilter("all");
                }}
                className="w-full p-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 focus:outline-none transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        
        {/* Data Table */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-600">Loading</div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 text-center">
            <p className="text-lg text-red-600">{error}</p>
          </div>
        ) : (
          <div className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-90' : 'opacity-100'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('status')}>
                      Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('hostname')}>
                      Hostname {sortConfig.key === 'hostname' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('ip_address')}>
                      IP Address {sortConfig.key === 'ip_address' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('mac_address')}>
                      MAC Address {sortConfig.key === 'mac_address' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('manufacturer')}>
                      Device Type {sortConfig.key === 'manufacturer' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('whitelist')}>
                      Access {sortConfig.key === 'whitelist' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('updated_at')}>
                      Last Seen {sortConfig.key === 'updated_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        No devices match your filters
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((device) => (
                      <tr key={device.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {device.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`mr-3 ${device.status === 'online' ? 'bg-green-100' : 'bg-red-100'} p-2 rounded-full`}>
                              {getDeviceIcon(device.manufacturer)}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{device.hostname}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{device.ip_address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500 font-mono">{device.mac_address}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{device.manufacturer || "Unknown"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs rounded-full ${
                            device.whitelist ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {device.whitelist ? "Allowed" : "Blocked"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="text-sm text-gray-500">
                            {getTimeSinceUpdate(device.updated_at)}
                            <div className="text-xs text-gray-400">
                              {formatDate(device.updated_at)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500">
              Showing {filteredData.length} of {networks.length} devices
            </div>
          </div>
        )}
        
        {/* Last updated timestamp with refreshing indicator */}
        <div className="flex items-center justify-end text-sm text-gray-500 gap-2 mt-4">
          <Clock size={14} />
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'} | Refresh interval: {intervalTime/1000}s
          {refreshing && (
            <span className="ml-2 inline-block">
              <RefreshCw size={12} className="animate-spin text-blue-500" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}