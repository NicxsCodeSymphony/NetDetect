"use client"

import React, { useState, useEffect } from "react";
import Sidebar from "@/app/components/Sidebar";
import { 
  AlertCircle, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Filter, 
  Shield, 
  Server, 
  BarChart4, 
  Laptop, 
  Smartphone, 
  Clock, 
  X
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Anomaly() {
  // State variables
  const [anomalies, setAnomalies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [hoursBack, setHoursBack] = useState(24);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [topAnomalies, setTopAnomalies] = useState([]);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  
  // Fetch anomaly data
  const fetchAnomalies = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`http://127.0.0.1:8006/anomaly/detect?hours_back=${hoursBack}`);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      setAnomalies(data.anomalies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch stats data
  const fetchStats = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8006/anomaly/stats');
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  // Fetch top anomalies
  const fetchTopAnomalies = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8006/anomaly/top-anomalies?limit=5');
      if (!response.ok) throw new Error("Failed to fetch top anomalies");
      const data = await response.json();
      setTopAnomalies(data.anomalies || []);
    } catch (err) {
      console.error("Error fetching top anomalies:", err);
    }
  };

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchAnomalies(),
          fetchStats(),
          fetchTopAnomalies()
        ]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Set up refresh interval (every 5 minutes)
    const intervalId = setInterval(() => {
      fetchAnomalies();
      fetchStats();
      fetchTopAnomalies();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Refresh when hours back changes
  useEffect(() => {
    fetchAnomalies();
  }, [hoursBack]);

  // Filter anomalies based on selected filters
  const filteredAnomalies = anomalies.filter(anomaly => {
    if (selectedFilter !== "all" && anomaly.status.toLowerCase() !== selectedFilter) {
      return false;
    }
    
    if (deviceTypeFilter !== "all" && anomaly.device_type !== deviceTypeFilter) {
      return false;
    }
    
    return true;
  });

  // Handle refresh button click
  const handleRefresh = () => {
    fetchAnomalies();
    fetchStats();
    fetchTopAnomalies();
  };

  // Prepare data for charts
  const prepareDeviceTypeData = () => {
    if (!stats) return [];
    
    return Object.entries(stats.device_type_counts || {}).map(([type, count]) => ({
      name: type,
      value: count,
      anomalies: stats.anomalies_by_type?.[type] || 0
    }));
  };

  const prepareAnomaliesByStatusData = () => {
    if (!stats) return [];
    
    return Object.entries(stats.status_counts || {}).map(([status, count]) => ({
      name: status,
      total: count,
      anomalies: stats.anomalies_by_status?.[status] || 0
    }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="animate-spin h-10 w-10 mx-auto text-blue-500 mb-4" />
            <p className="text-gray-700">Loading anomaly data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-8 bg-gray-50 flex items-center justify-center">
          <div className="text-center text-red-500">
            <AlertCircle className="h-10 w-10 mx-auto mb-4" />
            <p>Error loading data: {error}</p>
            <button 
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Network Anomaly Detection</h1>
            <p className="text-gray-600">Monitoring {stats?.total_devices || 0} devices, detected {anomalies.length} anomalies</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Time range:</label>
              <select 
                value={hoursBack} 
                onChange={(e) => setHoursBack(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={6}>Last 6 hours</option>
                <option value={12}>Last 12 hours</option>
                <option value={24}>Last 24 hours</option>
                <option value={48}>Last 48 hours</option>
                <option value={72}>Last 3 days</option>
                <option value={168}>Last week</option>
              </select>
            </div>
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Anomalies</p>
                <p className="text-xl font-semibold">{anomalies.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Wifi className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Online Devices</p>
                <p className="text-xl font-semibold">{stats?.status_counts?.online || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <WifiOff className="h-6 w-6 text-red-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Offline Devices</p>
                <p className="text-xl font-semibold">{stats?.status_counts?.offline || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Whitelisted</p>
                <p className="text-xl font-semibold">{stats?.whitelist_count || 0}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Device Types</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareDeviceTypeData()}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {prepareDeviceTypeData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Anomalies by Status</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prepareAnomaliesByStatusData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#8884d8" name="Total Devices" />
                  <Bar dataKey="anomalies" fill="#82ca9d" name="Anomalies" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Top Anomalies */}
        <div className="mb-6 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Top Anomalies</h2>
          </div>
          <div className="p-4">
            {topAnomalies.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No top anomalies found</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topAnomalies.map((anomaly) => (
                  <div key={anomaly.device_id} className="border border-gray-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-center mb-2">
                      {anomaly.device_type === 'Desktop PC' && <Laptop className="h-5 w-5 text-gray-700 mr-2" />}
                      {anomaly.device_type === 'Laptop' && <Laptop className="h-5 w-5 text-gray-700 mr-2" />}
                      {anomaly.device_type === 'Phone' && <Smartphone className="h-5 w-5 text-gray-700 mr-2" />}
                      <h3 className="font-semibold">{anomaly.hostname}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">IP: {anomaly.ip_address}</p>
                    <p className="text-sm text-gray-600 mb-3">Status: {anomaly.status}</p>
                    <div className="bg-red-100 p-2 rounded text-sm text-red-800">
                      <p className="font-medium">Reason:</p>
                      <p>{anomaly.anomaly_reason}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Upload</p>
                        <p>{anomaly.recent_upload.toFixed(2)} MB</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Download</p>
                        <p>{anomaly.recent_download.toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Anomalies Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Detected Anomalies</h2>
            <div className="flex gap-2">
              <div>
                <select 
                  value={selectedFilter} 
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <select 
                  value={deviceTypeFilter} 
                  onChange={(e) => setDeviceTypeFilter(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="Desktop PC">Desktop PC</option>
                  <option value="Laptop">Laptop</option>
                  <option value="Phone">Phone</option>
                </select>
              </div>
            </div>
          </div>
          
          {filteredAnomalies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Server className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No anomalies found with the current filters</p>
              {(selectedFilter !== "all" || deviceTypeFilter !== "all") && (
                <button 
                  onClick={() => { setSelectedFilter("all"); setDeviceTypeFilter("all"); }}
                  className="text-blue-500 hover:underline mt-2 flex items-center gap-1 mx-auto"
                >
                  <X className="h-4 w-4" /> Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Traffic (Up/Down)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deviation</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAnomalies.map((anomaly) => (
                    <tr key={anomaly.device_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{anomaly.hostname}</div>
                            <div className="text-sm text-gray-500">ID: {anomaly.device_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{anomaly.ip_address}</div>
                        <div className="text-sm text-gray-500">{anomaly.mac_address}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {anomaly.device_type === 'Desktop PC' && <Desktop className="h-4 w-4 text-gray-500 mr-1" />}
                          {anomaly.device_type === 'Laptop' && <Laptop className="h-4 w-4 text-gray-500 mr-1" />}
                          {anomaly.device_type === 'Phone' && <Smartphone className="h-4 w-4 text-gray-500 mr-1" />}
                          <span className="text-sm text-gray-900">{anomaly.device_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          anomaly.status.toLowerCase() === 'online' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {anomaly.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{anomaly.anomaly_reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          ↑ {anomaly.recent_upload.toFixed(2)} MB / ↓ {anomaly.recent_download.toFixed(2)} MB
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <span className={anomaly.upload_deviation_pct > 0 ? "text-red-500" : "text-blue-500"}>
                            Upload: {anomaly.upload_deviation_pct > 0 ? '+' : ''}{anomaly.upload_deviation_pct.toFixed(0)}%
                          </span>
                          <span className={anomaly.download_deviation_pct > 0 ? "text-red-500" : "text-blue-500"}>
                            Download: {anomaly.download_deviation_pct > 0 ? '+' : ''}{anomaly.download_deviation_pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}