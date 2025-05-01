"use client"
import React, { useState, useCallback, useEffect, useMemo } from "react"
import type { NetworkWithBandwidth } from "@/app/lib/network"
import { fetchNetworksWithBandwidth } from "@/app/lib/networkServer"
import type { Bandwidths } from "@/app/lib/bandwidth"
import { fetchBandwidthById } from "@/app/lib/bandwidthServer"
import Sidebar from "@/app/components/Sidebar"
import { 
  ArrowUpDown, 
  Download, 
  Upload, 
  Eye, 
  X, 
  Search, 
  Filter, 
  BarChart4,
  RefreshCw 
} from "lucide-react"
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Logs() {
    const [networks, setNetworks] = useState<NetworkWithBandwidth[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDevice, setSelectedDevice] = useState<NetworkWithBandwidth | null>(null)
    const [bandwidthData, setBandwidthData] = useState<Bandwidths[]>([])
    const [showModal, setShowModal] = useState(false)
    const [modalLoading, setModalLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [sortConfig, setSortConfig] = useState<{key: string, direction: 'ascending' | 'descending'} | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    // Animation states for modal
    const [modalVisible, setModalVisible] = useState(false)

    const fetchData = useCallback(async (showRefreshing = false): Promise<void> => {
        if (showRefreshing) setRefreshing(true)
        setLoading(true)
        try {
            const res = await fetchNetworksWithBandwidth()
            setNetworks(res)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
            if (showRefreshing) setRefreshing(false)
        }
    }, [])

    const fetchDataById = useCallback(async (id: number): Promise<void> => {
        setModalLoading(true)
        try {
            const res = await fetchBandwidthById(id)
            setBandwidthData(res)
        } catch (err) {
            console.error(err)
        } finally {
            setModalLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const openDeviceDetails = (device: NetworkWithBandwidth) => {
        setSelectedDevice(device)
        setShowModal(true)
        
        // Add animation sequence
        setTimeout(() => {
            setModalVisible(true)
        }, 10)
        
        fetchDataById(device.id)
    }

    const closeModal = () => {
        // Start animation out
        setModalVisible(false)
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            setShowModal(false)
            setSelectedDevice(null)
            setBandwidthData([])
        }, 300)
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss')
    }

    const getBandwidthStatus = (download: number | null, upload: number | null) => {
        if (download === null && upload === null) {
            return (
                <span className="flex items-center text-gray-400">
                    <ArrowUpDown className="mr-1 h-4 w-4" />
                    No Data
                </span>
            )
        }

        return (
            <div className="flex flex-col">
                <span className="flex items-center">
                    <Download className="mr-1 h-4 w-4 text-blue-500" />
                    {download !== null ? `${download} KB/s` : 'N/A'}
                </span>
                <span className="flex items-center">
                    <Upload className="mr-1 h-4 w-4 text-green-500" />
                    {upload !== null ? `${upload} KB/s` : 'N/A'}
                </span>
            </div>
        )
    }

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'online':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Online</span>
            case 'offline':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Offline</span>
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>
        }
    }

    // Sorting function
    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // Filtered and sorted data
    const filteredNetworks = useMemo(() => {
        let filtered = [...networks];
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(device => 
                (device.hostname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (device.ip_address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (device.mac_address?.toLowerCase() || '').includes(searchTerm.toLowerCase())
            );
        }
        
        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(device => 
                (device.status?.toLowerCase() || '') === statusFilter.toLowerCase()
            );
        }
        
        // Apply sorting
        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof NetworkWithBandwidth];
                const bValue = b[sortConfig.key as keyof NetworkWithBandwidth];
                
                // Handle null values
                if (aValue === null && bValue === null) return 0;
                if (aValue === null) return 1;
                if (bValue === null) return -1;
                
                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        
        return filtered;
    }, [networks, searchTerm, statusFilter, sortConfig]);

    // Prepare chart data
    const chartData = useMemo(() => {
        if (!bandwidthData || bandwidthData.length === 0) return [];
        
        // Take last 10 records for the chart
        return bandwidthData.slice(-10).map(record => ({
            name: format(new Date(record.created_at), 'HH:mm:ss'),
            download: record.download,
            upload: record.upload
        }));
    }, [bandwidthData]);

    // Network stats summary
    const networkStats = useMemo(() => {
        const totalDevices = networks.length;
        const onlineDevices = networks.filter(device => 
            (device.status?.toLowerCase() || '') === 'online'
        ).length;
        const offlineDevices = networks.filter(device => 
            (device.status?.toLowerCase() || '') === 'offline'
        ).length;
        
        // Calculate average bandwidth if available
        let avgDownload = 0;
        let avgUpload = 0;
        let deviceWithData = 0;
        
        networks.forEach(device => {
            if (device.download !== null) {
                avgDownload += device.download;
                deviceWithData++;
            }
            if (device.upload !== null) {
                avgUpload += device.upload;
            }
        });
        
        avgDownload = deviceWithData ? Math.round(avgDownload / deviceWithData) : 0;
        avgUpload = deviceWithData ? Math.round(avgUpload / deviceWithData) : 0;
        
        return {
            totalDevices,
            onlineDevices,
            offlineDevices,
            avgDownload,
            avgUpload
        };
    }, [networks]);

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="h-4 w-4 opacity-30" />;
        }
        return sortConfig.direction === 'ascending' 
            ? <ArrowUpDown className="h-4 w-4 text-blue-500" /> 
            : <ArrowUpDown className="h-4 w-4 text-blue-500 rotate-180" />;
    };

    return (
        <div className="flex min-h-screen max-h-[95vh] bg-gray-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Network Audit</h1>
                        <p className="text-gray-600">Monitor network devices and bandwidth usage</p>
                    </div>
                    <button 
                        onClick={() => fetchData(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        disabled={refreshing}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh Data'}
                    </button>
                </div>

                {/* Network Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-sm font-medium text-gray-500">Total Devices</h3>
                        <p className="text-2xl font-bold text-gray-900">{networkStats.totalDevices}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-sm font-medium text-gray-500">Online Devices</h3>
                        <p className="text-2xl font-bold text-green-600">{networkStats.onlineDevices}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-sm font-medium text-gray-500">Offline Devices</h3>
                        <p className="text-2xl font-bold text-red-600">{networkStats.offlineDevices}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <h3 className="text-sm font-medium text-gray-500">Avg. Bandwidth</h3>
                        <div className="flex items-center mt-1">
                            <Download className="h-4 w-4 text-blue-500 mr-1" />
                            <span className="text-sm font-medium">{networkStats.avgDownload} KB/s</span>
                            <Upload className="h-4 w-4 text-green-500 ml-3 mr-1" />
                            <span className="text-sm font-medium">{networkStats.avgUpload} KB/s</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                                Search
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    id="search"
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Search hostname, IP..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                                <select
                                    id="status"
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="online">Online</option>
                                    <option value="offline">Offline</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setSearchTerm("");
                                    setStatusFilter("all");
                                    setSortConfig(null);
                                }}
                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-medium text-gray-900">Connected Devices</h2>
                        <span className="text-sm text-gray-500">
                            Showing {filteredNetworks.length} of {networks.length} devices
                        </span>
                    </div>
                    
                    {loading ? (
                        <div className="p-6 text-center">
                            <p className="text-gray-500">Loading network data...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button 
                                                className="flex items-center space-x-1 focus:outline-none"
                                                onClick={() => requestSort('hostname')}
                                            >
                                                <span>Hostname</span>
                                                {getSortIcon('hostname')}
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button 
                                                className="flex items-center space-x-1 focus:outline-none"
                                                onClick={() => requestSort('ip_address')}
                                            >
                                                <span>IP Address</span>
                                                {getSortIcon('ip_address')}
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button 
                                                className="flex items-center space-x-1 focus:outline-none"
                                                onClick={() => requestSort('download')}
                                            >
                                                <span>Bandwidth (Down/Up)</span>
                                                {getSortIcon('download')}
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <button 
                                                className="flex items-center space-x-1 focus:outline-none"
                                                onClick={() => requestSort('status')}
                                            >
                                                <span>Status</span>
                                                {getSortIcon('status')}
                                            </button>
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredNetworks.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                                No devices found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredNetworks.map((device) => (
                                            <tr key={device.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {device.hostname || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {device.ip_address || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {getBandwidthStatus(device.download, device.upload)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {getStatusBadge(device.status || 'Unknown')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <button
                                                        onClick={() => openDeviceDetails(device)}
                                                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    >
                                                        <Eye className="mr-1 h-4 w-4" />
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Side Modal for device details */}
                {showModal && (
                    <div className="fixed inset-0 overflow-hidden z-50">
                        <div className="absolute inset-0 overflow-hidden">
                            {/* Backdrop */}
                            <div 
                                className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
                                onClick={closeModal}
                                style={{ opacity: modalVisible ? 1 : 0, transition: 'opacity 300ms ease-in-out' }}
                            ></div>
                            
                            <div className="fixed inset-y-0 right-0 max-w-full flex">
                                {/* Slide-in panel */}
                                <div 
                                    className="w-screen max-w-2xl"
                                    style={{ 
                                        transform: modalVisible ? 'translateX(0)' : 'translateX(100%)',
                                        transition: 'transform 300ms ease-in-out'
                                    }}
                                >
                                    <div className="h-full flex flex-col bg-white shadow-xl overflow-y-auto">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                Device Details: {selectedDevice?.hostname || 'Unknown Device'}
                                            </h3>
                                            <button
                                                onClick={closeModal}
                                                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                        
                                        <div className="p-6 overflow-y-auto flex-grow">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Device Information</h4>
                                                    <div className="space-y-2">
                                                        <p className="text-sm"><span className="font-medium">Hostname:</span> {selectedDevice?.hostname || 'N/A'}</p>
                                                        <p className="text-sm"><span className="font-medium">IP Address:</span> {selectedDevice?.ip_address || 'N/A'}</p>
                                                        <p className="text-sm"><span className="font-medium">MAC Address:</span> {selectedDevice?.mac_address || 'N/A'}</p>
                                                        <p className="text-sm"><span className="font-medium">Status:</span> {selectedDevice?.status || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Additional Information</h4>
                                                    <div className="space-y-2">
                                                        <p className="text-sm"><span className="font-medium">Manufacturer:</span> {selectedDevice?.manufacturer || 'N/A'}</p>
                                                        <p className="text-sm"><span className="font-medium">Created:</span> {formatDate(selectedDevice?.created_at || '')}</p>
                                                        <p className="text-sm"><span className="font-medium">Last Updated:</span> {formatDate(selectedDevice?.updated_at || '')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Bandwidth Visualization */}
                                            {!modalLoading && bandwidthData.length > 0 && (
                                                <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
                                                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                                                        <div className="flex items-center">
                                                            <BarChart4 className="h-5 w-5 text-indigo-500 mr-2" />
                                                            <h4 className="text-md font-medium text-gray-900">Bandwidth Trends</h4>
                                                        </div>
                                                    </div>
                                                    <div className="p-4" style={{ height: '300px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart
                                                                data={chartData}
                                                                margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis 
                                                                    dataKey="name" 
                                                                    angle={-45} 
                                                                    textAnchor="end" 
                                                                    height={60}
                                                                />
                                                                <YAxis label={{ value: 'KB/s', angle: -90, position: 'insideLeft' }} />
                                                                <Tooltip />
                                                                <Legend />
                                                                <Bar dataKey="download" name="Download" fill="#3b82f6" />
                                                                <Bar dataKey="upload" name="Upload" fill="#10b981" />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                                    <h4 className="text-md font-medium text-gray-900">Bandwidth History</h4>
                                                    <span className="text-xs text-gray-500">{bandwidthData.length} records</span>
                                                </div>
                                                
                                                {modalLoading ? (
                                                    <div className="p-6 text-center">
                                                        <p className="text-gray-500">Loading bandwidth data...</p>
                                                    </div>
                                                ) : bandwidthData.length === 0 ? (
                                                    <div className="p-6 text-center">
                                                        <p className="text-gray-500">No bandwidth data available for this device.</p>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        ID
                                                                    </th>
                                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        Download
                                                                    </th>
                                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        Upload
                                                                    </th>
                                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                        Timestamp
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {bandwidthData.map((record) => (
                                                                    <tr key={record.bandwidth} className="hover:bg-gray-50">
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                            {record.bandwidth}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            <span className="flex items-center">
                                                                                <Download className="mr-1 h-4 w-4 text-blue-500" />
                                                                                {record.download} KB/s
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            <span className="flex items-center">
                                                                                <Upload className="mr-1 h-4 w-4 text-green-500" />
                                                                                {record.upload} KB/s
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                            {formatDate(record.created_at)}
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
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}