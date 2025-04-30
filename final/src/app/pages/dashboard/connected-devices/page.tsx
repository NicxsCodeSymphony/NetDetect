"use client"
import React, { useState, useEffect } from "react";
import { fetchNetworks } from "@/app/lib/networkServer";
import Sidebar from "@/app/components/Sidebar";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ConnectedDevices() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [whitelistFilter, setWhitelistFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    deviceTypes: {},
    whitelist: { true: 0, false: 0 },
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchNetworks();
      setNetworks(res);
      calculateStats(res);
    } catch (err) {
      console.error(err);
      setError("Failed to load network data");
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (data) => {
    if (!data || !data.length) return;

    const onlineCount = data.filter(device => device.status === "online").length;
    const offlineCount = data.filter(device => device.status === "offline").length;
    
    // Calculate device types
    const deviceTypes = data.reduce((acc, device) => {
      const type = device.device_type || "Unknown";
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
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting, filtering and searching
  const getFilteredData = () => {
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
          device.device_type === deviceTypeFilter;
        
        const matchesWhitelist = 
          whitelistFilter === "all" || 
          (whitelistFilter === "true" && device.whitelist) || 
          (whitelistFilter === "false" && !device.whitelist);
        
        return matchesSearch && matchesStatus && matchesDeviceType && matchesWhitelist;
      })
      .sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
  };

  // Generate unique device types for filter dropdown
  const getUniqueDeviceTypes = () => {
    const types = new Set();
    networks.forEach(device => {
      if (device.device_type) types.add(device.device_type);
    });
    return Array.from(types);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Prepare chart data
  const prepareStatusChartData = () => {
    return [
      { name: "Online", value: stats.online, color: "#4CAF50" },
      { name: "Offline", value: stats.offline, color: "#F44336" },
    ];
  };

  const prepareDeviceTypeChartData = () => {
    return Object.entries(stats.deviceTypes).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  };

  const prepareWhitelistChartData = () => {
    return [
      { name: "Whitelisted", value: stats.whitelist.true, color: "#8884d8" },
      { name: "Not Whitelisted", value: stats.whitelist.false, color: "#82ca9d" },
    ];
  };

  useEffect(() => {
    fetchData();
    // Set up a refresh interval (every 60 seconds)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Color palette for charts
  const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  // Calculate last updated time
  const getLastUpdatedTime = () => {
    if (networks.length === 0) return "N/A";
    
    const dates = networks.map(d => new Date(d.updated_at).getTime());
    const mostRecent = new Date(Math.max(...dates));
    
    return mostRecent.toLocaleString();
  };

  const filteredData = getFilteredData();
  const uniqueDeviceTypes = getUniqueDeviceTypes();

  // Calculate time since last activity for each device
  const getTimeSinceUpdate = (dateString) => {
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <div className="flex flex-1">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Network Monitoring Dashboard</h1>
            <p className="text-gray-600">
              Total Devices: {stats.total} | Last Updated: {getLastUpdatedTime()}
              <button 
                onClick={fetchData} 
                className="ml-4 px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Refresh Data
              </button>
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Devices</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Online Devices</h3>
              <p className="text-3xl font-bold text-green-600">{stats.online}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Offline Devices</h3>
              <p className="text-3xl font-bold text-red-600">{stats.offline}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Whitelisted Devices</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.whitelist.true}</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Status Distribution Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={prepareStatusChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Device Type Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepareDeviceTypeChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8">
                      {prepareDeviceTypeChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Whitelist Distribution Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Whitelist Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={prepareWhitelistChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareWhitelistChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Hostname, IP, MAC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="statusFilter"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={deviceTypeFilter}
                  onChange={(e) => setDeviceTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  {uniqueDeviceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="whitelistFilter" className="block text-sm font-medium text-gray-700 mb-1">
                  Whitelist Status
                </label>
                <select
                  id="whitelistFilter"
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={whitelistFilter}
                  onChange={(e) => setWhitelistFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="true">Whitelisted</option>
                  <option value="false">Not Whitelisted</option>
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
                  className="w-full p-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Data Table */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-lg text-gray-600">Loading network data...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-lg text-red-600">{error}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('device_type')}>
                        Device Type {sortConfig.key === 'device_type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('whitelist')}>
                        Whitelist {sortConfig.key === 'whitelist' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('updated_at')}>
                        Last Seen {sortConfig.key === 'updated_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                          No devices match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((device) => (
                        <tr key={device.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {device.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{device.hostname}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{device.ip_address}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{device.mac_address}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{device.device_type || "Unknown"}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              device.whitelist ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {device.whitelist ? "Yes" : "No"}
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
        </main>
      </div>
    </div>
  );
}