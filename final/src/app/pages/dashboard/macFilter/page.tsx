"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Networks } from "@/app/lib/network"
import { blockedNetworks, fetchNetworks, unblockNetwork } from "@/app/lib/networkServer"
import Sidebar from "@/app/components/Sidebar"
import { Shield, ShieldOff, Wifi, RefreshCw, Clock, Search, Laptop, Server, Smartphone } from "lucide-react"
import { Tabs, TabList, Tab, TabContent } from "@/app/components/ui/tabs"

export default function MacFilter() {
    const [networks, setNetworks] = useState<Networks[]>([])
    const [blockedNetworkss, setBlockedNetworkss] = useState<Networks[]>([])
    const [loading, setLoading] = useState(false)
    const [initialLoad, setInitialLoad] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [intervalTime, setIntervalTime] = useState(10000) // 10 seconds in milliseconds
    const [expandedDevice, setExpandedDevice] = useState<number | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const prevNetworksRef = useRef<Networks[]>([])
    const prevBlockedNetworksRef = useRef<Networks[]>([])
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const fetchData = useCallback(async (showLoading = false): Promise<void> => {
        if (showLoading) {
            setLoading(true)
        } else {
            setRefreshing(true)
        }
        
        try {
            // Store previous data for smooth transitions
            prevNetworksRef.current = [...networks]
            prevBlockedNetworksRef.current = [...blockedNetworkss]
            
            // Fetch new data
            const [blockedRes, networksRes] = await Promise.all([
                blockedNetworks(),
                fetchNetworks()
            ])
            setBlockedNetworkss(() => {
                return [...blockedRes]
            })
            
            setNetworks(() => {
                return [...networksRes]
            })
            
            setLastUpdated(new Date())
            setInitialLoad(false)
        }
        catch (err) {
            console.error(err)
        } finally {
            if (showLoading) {
                setLoading(false)
            } else {
                // Slight delay to hide the refreshing indicator
                // to make the transition smoother
                if (updateTimeoutRef.current) {
                    clearTimeout(updateTimeoutRef.current)
                }
                
                updateTimeoutRef.current = setTimeout(() => {
                    setRefreshing(false)
                }, 300)
            }
        }
    }, [networks, blockedNetworkss])

    useEffect(() => {
        fetchData(true) // Initial fetch with loading indicator
        
        const interval = setInterval(() => {
            fetchData(false) // Subsequent fetches without full loading indicator
        }, intervalTime)
        
        return () => {
            clearInterval(interval)
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }
        }
    }, [fetchData, intervalTime])

    // Function to change interval
    const changeInterval = (seconds: number) => {
        setIntervalTime(seconds * 1000)
    }

    // Handle unblock network with optimistic updates
    const handleUnblock = async (id: number) => {
        try {
            // Optimistically update UI
            const deviceToUnblock = blockedNetworkss.find(network => network.id === id)
            
            if (deviceToUnblock) {
                // Optimistically remove from blocked list
                setBlockedNetworkss(prev => prev.filter(network => network.id !== id))
                
                // Optimistically add to networks list
                setNetworks(prev => [...prev, deviceToUnblock])
            }
            
            // Collapse expanded device view
            setExpandedDevice(null)
            
            // Make the actual API call
            await unblockNetwork(id)
            
            // Refresh data quietly in the background
            setTimeout(() => {
                fetchData(false)
            }, 500)
        } catch (err) {
            console.error("Failed to unblock device:", err)
            // If error, revert the optimistic update by refreshing
            fetchData(false)
        }
    }

    // Function to determine device icon
    const getDeviceIcon = (hostname: string) => {
        const hostnameLC = hostname.toLowerCase()
        if (hostnameLC.includes('desktop') || hostnameLC.includes('pc')) {
            return <Laptop className="h-5 w-5" />
        } else if (hostnameLC.includes('server') || hostnameLC.includes('win-')) {
            return <Server className="h-5 w-5" />
        } else if (hostnameLC.includes('phone') || hostnameLC.includes('mobile')) {
            return <Smartphone className="h-5 w-5" />
        } else {
            return <Wifi className="h-5 w-5" />
        }
    }

    // Filter networks based on search term
    const filteredNetworks = networks.filter(network => 
        network.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        network.mac_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        network.ip_address.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredBlockedNetworks = blockedNetworkss.filter(network => 
        network.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        network.mac_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        network.ip_address.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex h-screen bg-white">
            <Sidebar />
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">MAC Address Filtering</h1>
                        <p className="text-gray-500 mt-1">Control which devices can access your network</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                            <button 
                                onClick={() => changeInterval(5)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 5000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                5s
                            </button>
                            <button 
                                onClick={() => changeInterval(10)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 10000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                10s
                            </button>
                            <button 
                                onClick={() => changeInterval(30)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 30000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                30s
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
                        placeholder="Search by hostname, MAC address, or IP address..."
                        className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-blue-100 p-3 rounded-lg">
                                <Wifi size={28} className="text-blue-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-gray-500">Status</p>
                                <div className="flex items-center text-green-600">
                                    <span className="text-xs">Active</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <p className="text-gray-500 mb-1">Total Devices</p>
                            <h2 className="text-4xl font-bold text-gray-800">
                                <span className="transition-all duration-300">{networks.length}</span>
                                <span className="text-lg font-normal text-gray-400"> devices</span>
                            </h2>
                        </div>
                        
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-100 rounded-full opacity-50"></div>
                    </div>
                    
                    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 p-6 relative overflow-hidden transition-all duration-300 hover:shadow-xl ${refreshing ? 'opacity-90' : ''}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-red-100 p-3 rounded-lg">
                                <ShieldOff size={28} className="text-red-600" />
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-gray-500">Status</p>
                                <div className="flex items-center text-red-600">
                                    <span className="text-xs">Blocked</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <p className="text-gray-500 mb-1">Blocked Devices</p>
                            <h2 className="text-4xl font-bold text-gray-800">
                                <span className="transition-all duration-300">{blockedNetworkss.length}</span>
                                <span className="text-lg font-normal text-gray-400"> devices</span>
                            </h2>
                        </div>
                        
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-red-100 rounded-full opacity-50"></div>
                    </div>
                </div>
                
                {initialLoad && loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-600">Loading</div>
                        </div>
                    </div>
                ) : (
                    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-90' : 'opacity-100'}`}>
                        {/* Using Tabs component */}
                        <Tabs defaultTab="all" className="w-full">
                            <TabList className="border-b border-gray-100">
                                <Tab 
                                    id="all"
                                    className="flex items-center gap-2 px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                                    activeClassName="text-blue-600 border-b-2 border-blue-600"
                                >
                                    <Wifi size={16} />
                                    All Devices ({filteredNetworks.length})
                                </Tab>
                                <Tab 
                                    id="blocked"
                                    className="flex items-center gap-2 px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                                    activeClassName="text-red-600 border-b-2 border-red-600"
                                >
                                    <ShieldOff size={16} />
                                    Blocked Devices ({filteredBlockedNetworks.length})
                                </Tab>
                            </TabList>
                            
                            <TabContent tabId="all" className="p-6">
                                {filteredNetworks.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {searchTerm ? 'No devices match your search' : 'No devices found'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredNetworks.map((network) => (
                                            <div 
                                                key={network.id}
                                                className="bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                                            >
                                                <div 
                                                    className="p-4 cursor-pointer flex items-center justify-between"
                                                    onClick={() => setExpandedDevice(expandedDevice === network.id ? null : network.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-blue-100 p-2 rounded-full">
                                                            {getDeviceIcon(network.hostname)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-gray-800">{network.hostname}</h3>
                                                            <p className="text-sm text-gray-500">{network.ip_address}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                                            Active
                                                        </span>
                                                        <button className="ml-4 text-gray-400 hover:text-gray-600">
                                                            {expandedDevice === network.id ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {expandedDevice === network.id && (
                                                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 animate-fadeIn">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">MAC Address</p>
                                                                <p className="text-sm font-mono">{network.mac_address}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">IP Address</p>
                                                                <p className="text-sm font-mono">{network.ip_address}</p>
                                                            </div>
                                                            {network.manufacturer && (
                                                                <div>
                                                                    <p className="text-xs text-gray-500 mb-1">Manufacturer</p>
                                                                    <p className="text-sm">{network.manufacturer}</p>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">Status</p>
                                                                <p className="text-sm">Active</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabContent>
                            
                            <TabContent tabId="blocked" className="p-6">
                                {filteredBlockedNetworks.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {searchTerm ? 'No blocked devices match your search' : 'No devices are currently blocked'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredBlockedNetworks.map((network) => (
                                            <div 
                                                key={network.id}
                                                className="bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                                            >
                                                <div 
                                                    className="p-4 cursor-pointer flex items-center justify-between"
                                                    onClick={() => setExpandedDevice(expandedDevice === network.id ? null : network.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-red-100 p-2 rounded-full">
                                                            {getDeviceIcon(network.hostname)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-gray-800">{network.hostname}</h3>
                                                            <p className="text-sm text-gray-500">{network.ip_address}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                                            Blocked
                                                        </span>
                                                        <button 
                                                            className="ml-4 text-gray-400 hover:text-gray-600"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedDevice(expandedDevice === network.id ? null : network.id)
                                                            }}
                                                        >
                                                            {expandedDevice === network.id ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                </svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {expandedDevice === network.id && (
                                                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 animate-fadeIn">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">MAC Address</p>
                                                                <p className="text-sm font-mono">{network.mac_address}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">IP Address</p>
                                                                <p className="text-sm font-mono">{network.ip_address}</p>
                                                            </div>
                                                            {network.manufacturer && (
                                                                <div>
                                                                    <p className="text-xs text-gray-500 mb-1">Manufacturer</p>
                                                                    <p className="text-sm">{network.manufacturer}</p>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">Status</p>
                                                                <p className="text-sm">Blocked</p>
                                                            </div>
                                                        </div>
                                                        
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleUnblock(network.id);
                                                            }}
                                                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                                                        >
                                                            <Shield size={16} />
                                                            Unblock Device
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabContent>
                        </Tabs>
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
    )
}
