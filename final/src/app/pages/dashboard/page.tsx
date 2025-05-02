"use client"
import React, {useState, useEffect} from "react";
import Sidebar from "@/app/components/Sidebar";
import { fetchNetworks } from "@/app/lib/networkServer";
import { Networks } from "@/app/lib/network";
import { fetchBandwidth, fetchTotalBandwidth } from "@/app/lib/bandwidthServer";
import { Bandwidths } from "@/app/lib/bandwidth";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Shield, ShieldOff, ShieldAlert, Wifi, Database, DownloadCloud, UploadCloud, RefreshCw, Clock } from 'lucide-react';

export default function Dashboard() {
  const [networks, setNetworks] = useState([]);
  const [totalBandwidth, setTotalBandwidth] = useState({
    total_upload: 0,
    total_download: 0,
    total_usage: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const networksData = await fetchNetworks();
        const bandwidthData = await fetchTotalBandwidth();
        
        setNetworks(networksData);
        setTotalBandwidth(bandwidthData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const networksData = await fetchNetworks();
      const bandwidthData = await fetchTotalBandwidth();
      
      setNetworks(networksData);
      setTotalBandwidth(bandwidthData);
    } catch (error) {
      console.error('Failed to refresh dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Network status statistics
  const getNetworkStats = () => {
    const stats = {
      online: 0,
      offline: 0,
      blocked: 0,
      total: networks.length
    };

    networks.forEach(device => {
      if (device.status in stats) {
        stats[device.status]++;
      }
    });

    return stats;
  };

  const networkStats = getNetworkStats();

  // Format bandwidth for display
  const formatBandwidth = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // Status color mapping
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#10B981';
      case 'offline': return '#6B7280';
      case 'blocked': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Prepare data for status pie chart
  const statusData = [
    { name: 'Online', value: networkStats.online, color: '#10B981' },
    { name: 'Offline', value: networkStats.offline, color: '#6B7280' },
    { name: 'Blocked', value: networkStats.blocked, color: '#EF4444' }
  ];

  // Prepare data for bandwidth chart
  const bandwidthData = [
    { name: 'Upload', value: totalBandwidth.total_upload, color: '#3B82F6' },
    { name: 'Download', value: totalBandwidth.total_download, color: '#8B5CF6' }
  ];

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get most recently updated devices
  const getRecentDevices = () => {
    return [...networks].sort((a, b) => 
      new Date(b.updated_at) - new Date(a.updated_at)
    ).slice(0, 5);
  };

  // Filter devices based on search and status filter
  const filteredDevices = networks.filter(device => {
    const matchesSearch = searchTerm === '' || 
      device.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ip_address.includes(searchTerm) ||
      device.mac_address.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Status indicator component
  const StatusIndicator = ({ status }) => {
    if (status === 'online') {
      return (
        <div className="flex items-center">
          <Shield className="text-green-500 w-5 h-5 mr-1" />
          <span className="text-green-500">Online</span>
        </div>
      );
    } else if (status === 'offline') {
      return (
        <div className="flex items-center">
          <ShieldOff className="text-gray-500 w-5 h-5 mr-1" />
          <span className="text-gray-500">Offline</span>
        </div>
      );
    } else if (status === 'blocked') {
      return (
        <div className="flex items-center">
          <ShieldAlert className="text-red-500 w-5 h-5 mr-1" />
          <span className="text-red-500">Blocked</span>
        </div>
      );
    }
    return <span>{status}</span>;
  };

  // Loading spinner
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-grow flex flex-col items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-lg text-gray-700">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-grow p-6">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Network Dashboard</h1>
            <p className="text-gray-600">Monitor your network devices and bandwidth usage</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center">
            <button 
              onClick={handleRefresh}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              disabled={refreshing}
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            {networks.length > 0 && (
              <div className="ml-4 flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                Last updated: {formatDate(networks[0]?.updated_at || new Date())}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                selectedTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setSelectedTab('devices')}
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                selectedTab === 'devices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Network Devices
            </button>
            <button
              onClick={() => setSelectedTab('bandwidth')}
              className={`py-4 px-1 font-medium text-sm border-b-2 ${
                selectedTab === 'bandwidth'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Bandwidth Usage
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {selectedTab === 'overview' && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-blue-50 p-3 rounded-full">
                      <Wifi className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Total Devices</h3>
                      <p className="text-3xl font-bold text-gray-700">{networkStats.total}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-green-50 p-3 rounded-full">
                      <Shield className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Online</h3>
                      <p className="text-3xl font-bold text-green-600">{networkStats.online}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-gray-50 p-3 rounded-full">
                      <ShieldOff className="w-8 h-8 text-gray-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Offline</h3>
                      <p className="text-3xl font-bold text-gray-600">{networkStats.offline}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-red-50 p-3 rounded-full">
                      <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Blocked</h3>
                      <p className="text-3xl font-bold text-red-600">{networkStats.blocked}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Device Status Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Devices']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Bandwidth Usage</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        width={500}
                        height={300}
                        data={bandwidthData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => formatBandwidth(value).split(' ')[0]} />
                        <Tooltip formatter={(value) => formatBandwidth(value)} />
                        <Legend />
                        <Bar dataKey="value" name="Bandwidth">
                          {bandwidthData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recently Updated Devices</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostname</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getRecentDevices().map((device) => (
                        <tr key={device.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{device.hostname}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.ip_address}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <StatusIndicator status={device.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(device.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Devices Tab */}
          {selectedTab === 'devices' && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-lg font-medium text-gray-900">Network Devices</h3>
                <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search devices..."
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select 
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hostname</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC Address</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDevices.map((device) => (
                      <tr key={device.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{device.hostname}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.ip_address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.mac_address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{device.device_type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <StatusIndicator status={device.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button className="text-blue-500 hover:text-blue-700">
                              View
                            </button>
                            <button className={`${device.status === 'blocked' ? 'text-green-500 hover:text-green-700' : 'text-red-500 hover:text-red-700'}`}>
                              {device.status === 'blocked' ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Showing <span className="font-medium">{filteredDevices.length}</span> of <span className="font-medium">{networks.length}</span> devices
                </div>
              </div>
            </div>
          )}

          {/* Bandwidth Tab */}
          {selectedTab === 'bandwidth' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-blue-50 p-3 rounded-full">
                      <UploadCloud className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Total Upload</h3>
                      <p className="text-3xl font-bold text-blue-600">{formatBandwidth(totalBandwidth.total_upload)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-purple-50 p-3 rounded-full">
                      <DownloadCloud className="w-8 h-8 text-purple-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Total Download</h3>
                      <p className="text-3xl font-bold text-purple-600">{formatBandwidth(totalBandwidth.total_download)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex items-center">
                    <div className="bg-green-50 p-3 rounded-full">
                      <Database className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">Total Usage</h3>
                      <p className="text-3xl font-bold text-green-600">{formatBandwidth(totalBandwidth.total_usage)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bandwidth Distribution</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bandwidthData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatBandwidth(value).split(' ')[0]} />
                      <Tooltip formatter={(value) => formatBandwidth(value)} />
                      <Legend />
                      <Bar dataKey="value" name="Bandwidth">
                        {bandwidthData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Insights</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Download vs Upload Ratio</h4>
                    <p className="text-gray-600">
                      Your network has a {(totalBandwidth.total_download / totalBandwidth.total_upload).toFixed(1)}:1 download to upload ratio.
                      {totalBandwidth.total_download > totalBandwidth.total_upload * 5 ? 
                        " This is significantly higher than the typical household ratio, indicating heavy content consumption." : 
                        " This is within the normal range for typical network usage."}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Online Device Summary</h4>
                    <p className="text-gray-600">
                      Currently {networkStats.online} out of {networkStats.total} devices ({((networkStats.online / networkStats.total) * 100).toFixed(0)}%) are online.
                      {networkStats.blocked > 0 ? ` ${networkStats.blocked} devices are blocked from accessing the network.` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}