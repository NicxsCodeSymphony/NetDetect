"use client"

import React, { useState, useEffect, useCallback } from "react"
import { fetchBandwidth, fetchTotalBandwidth } from "@/app/lib/bandwidthServer"
import { Bandwidths } from "@/app/lib/bandwidth"
import Sidebar from "@/app/components/Sidebar"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Zap, Clock, ChevronUp, ChevronDown } from 'lucide-react'

type GroupedBandwidth = {
    time: string
    timestamp: Date
    download: number
    upload: number
    bandwidth: number
    count: number
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

const formatBandwidth = (bitsPerSecond: number, decimals = 2) => {
    if (bitsPerSecond === 0) return '0 bps';
    
    const k = 1000; 
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
    
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export default function Bandwidth() {
    const [bandwidths, setBandwidths] = useState<Bandwidths[]>([])
    const [totalUploads, setTotalUpload] = useState<number>(0)
    const [totalDownloads, setTotalDownload] = useState<number>(0)
    const [totalUsage, setTotalUsage] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [activeSection, setActiveSection] = useState('all')
    const [hoveredCard, setHoveredCard] = useState<number | null>(null)
    const [intervalTime, setIntervalTime] = useState(30000) 

    const fetchData = useCallback(async (): Promise<void> => {
        setLoading(true)
        try {
            const bandwidthRes = await fetchBandwidth()
            const totalBandRes = await fetchTotalBandwidth()
    
            // Convert the object to an array (if needed, e.g., using Object.values)
            const totalBandResArray = Array.isArray(totalBandRes) ? totalBandRes : [totalBandRes]
    
            // Log the response to inspect it
            console.log("totalBandResArray:", totalBandResArray)
    
            // Assuming totalBandRes is now an array, you can access the first item
            if (totalBandResArray.length > 0) {
                const total = totalBandResArray[0]
                setTotalDownload(total.total_download)
                setTotalUpload(total.total_upload)
                setTotalUsage(total.total_usage)
            }
    
            setBandwidths(bandwidthRes)
            setLastUpdated(new Date())
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [])
    
    
    
    

    useEffect(() => {
        fetchData() // Initial fetch
        const interval = setInterval(fetchData, intervalTime)
        return () => clearInterval(interval)
    }, [fetchData, intervalTime])

    const groupDataByMinute = (data: Bandwidths[]) => {
        const groupedData: { [key: string]: GroupedBandwidth } = {}
        
        data.forEach(item => {
            const date = new Date(item.created_at)
            const minuteKey = date.toISOString().substring(0, 16)
            
            if (!groupedData[minuteKey]) {
                groupedData[minuteKey] = {
                    time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
                    timestamp: date,
                    download: item.download,
                    upload: item.upload,
                    bandwidth: item.bandwidth,
                    count: 1
                }
            } else {
                groupedData[minuteKey].download += item.download
                groupedData[minuteKey].upload += item.upload
                groupedData[minuteKey].bandwidth = (groupedData[minuteKey].bandwidth * groupedData[minuteKey].count + item.bandwidth) / (groupedData[minuteKey].count + 1)
                groupedData[minuteKey].count += 1
            }
        })
        
        return Object.values(groupedData).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }
    const chartData = groupDataByMinute(bandwidths)
    
    const totalBandwidthPieData = [
        { name: 'Download', value: totalDownloads, color: '#3b82f6', formattedValue: formatBytes(totalDownloads) },
        { name: 'Upload', value: totalUploads, color: '#10b981', formattedValue: formatBytes(totalUploads) }
    ]

    const changeInterval = (minutes: number) => {
        setIntervalTime(minutes * 1000)
    }

    interface TooltipProps {
        active?: boolean;
        payload?: Array<{
            name: string;
            value: number;
            dataKey: string;
            color: string;
        }>;
        label?: string;
    }

    const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-4 border border-gray-200 rounded-md shadow-md">
                    <p className="font-semibold">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.dataKey.includes('bandwidth') 
                                ? formatBandwidth(entry.value) 
                                : formatBytes(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex h-screen bg-white">
            <Sidebar />
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Bandwidth Monitor</h1>
                        <p className="text-gray-500 mt-1">Real-time network performance tracking</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                            <button 
                                onClick={() => changeInterval(0.05)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 5000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                5s
                            </button>
                            <button 
                                onClick={() => changeInterval(.1)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 10000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                10
                            </button>
                            <button 
                                onClick={() => changeInterval(.3)} 
                                className={`px-3 py-2 text-sm ${intervalTime === 30000 ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                            >
                                30s
                            </button>
                        </div>
                        
                        <button 
                            onClick={fetchData}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105 shadow-md"
                        >
                            <RefreshCw size={16} className="animate-spin-slow" />
                            Refresh
                        </button>
                    </div>
                </div>
                
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-600">Loading</div>
                        </div>
                    </div>
                ) : (
                    <>
                     
                        {/* Session Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div 
                                className={`bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300 ${hoveredCard === 0 ? 'transform scale-105' : ''}`}
                                onMouseEnter={() => setHoveredCard(0)}
                                onMouseLeave={() => setHoveredCard(null)}
                            >
                                <div className="p-6 relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="bg-blue-100 p-3 rounded-lg">
                                            <ArrowDownCircle size={28} className="text-blue-600" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs text-gray-500">vs last hour</p>
                                            <div className="flex items-center text-green-600">
                                                <ChevronUp size={16} />
                                                <span className="text-xs">12%</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-gray-500 mb-1">Total Download</p>
                                        <h2 className="text-4xl font-bold text-gray-800">{formatBytes(totalDownloads)}</h2>
                                    </div>
                                    
                                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-100 rounded-full opacity-50"></div>
                                </div>
                            </div>
                            
                            <div 
                                className={`bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300 ${hoveredCard === 1 ? 'transform scale-105' : ''}`}
                                onMouseEnter={() => setHoveredCard(1)}
                                onMouseLeave={() => setHoveredCard(null)}
                            >
                                <div className="p-6 relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="bg-emerald-100 p-3 rounded-lg">
                                            <ArrowUpCircle size={28} className="text-emerald-600" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs text-gray-500">vs last hour</p>
                                            <div className="flex items-center text-red-600">
                                                <ChevronDown size={16} />
                                                <span className="text-xs">5%</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-gray-500 mb-1">Total Upload</p>
                                        <h2 className="text-4xl font-bold text-gray-800">{formatBytes(totalUploads)}</h2>
                                    </div>
                                    
                                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-emerald-100 rounded-full opacity-50"></div>
                                </div>
                            </div>
                            
                            <div 
                                className={`bg-white rounded-xl shadow-lg border border-gray-100 transition-all duration-300 ${hoveredCard === 2 ? 'transform scale-105' : ''}`}
                                onMouseEnter={() => setHoveredCard(2)}
                                onMouseLeave={() => setHoveredCard(null)}
                            >
                                <div className="p-6 relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="bg-purple-100 p-3 rounded-lg">
                                            <Zap size={28} className="text-purple-600" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs text-gray-500">avg speed</p>
                                            <div className="flex items-center text-gray-800">
                                                <span className="text-xs">Stable</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-gray-500 mb-1">Total Bandwidth</p>
                                        <h2 className="text-4xl font-bold text-gray-800">{formatBandwidth(totalUsage)}</h2>
                                    </div>
                                    
                                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-purple-100 rounded-full opacity-50"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            {/* Line Chart */}
                            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-gray-800">Bandwidth Trends</h2>
                                    <div className="flex bg-gray-100 rounded-lg overflow-hidden">
                                        <button 
                                            onClick={() => setActiveSection('speed')} 
                                            className={`px-3 py-1 text-xs ${activeSection === 'speed' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                                        >
                                            Speed
                                        </button>
                                        <button 
                                            onClick={() => setActiveSection('traffic')} 
                                            className={`px-3 py-1 text-xs ${activeSection === 'traffic' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                                        >
                                            Traffic
                                        </button>
                                        <button 
                                            onClick={() => setActiveSection('all')} 
                                            className={`px-3 py-1 text-xs ${activeSection === 'all' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
                                        >
                                            All
                                        </button>
                                    </div>
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorBandwidth" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="time" stroke="#6b7280" />
                                            <YAxis stroke="#6b7280" />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            {(activeSection === 'speed' || activeSection === 'all') && (
                                                <Area type="monotone" dataKey="bandwidth" stroke="#8884d8" fillOpacity={1} fill="url(#colorBandwidth)" name="Bandwidth" />
                                            )}
                                            {(activeSection === 'traffic' || activeSection === 'all') && (
                                                <>
                                                    <Area type="monotone" dataKey="upload" stroke="#10b981" fillOpacity={1} fill="url(#colorUpload)" name="Upload" />
                                                    <Area type="monotone" dataKey="download" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDownload)" name="Download" />
                                                </>
                                            )}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            {/* Pie Chart */}
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-6">Total Bandwidth Distribution</h2>
                                <div className="h-80 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={totalBandwidthPieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, formattedValue, percent }) => 
                                                    `${name}: ${formattedValue} (${(percent * 100).toFixed(0)}%)`
                                                }
                                                labelLine={false}
                                            >
                                                {totalBandwidthPieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value: number, name: string) => [formatBytes(value), name]}
                                                contentStyle={{ backgroundColor: 'white', borderColor: '#e5e7eb' }} 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="text-center text-lg font-semibold mt-4">
                                    Total Usage: {formatBandwidth(totalUsage)}
                                </div>
                            </div>
                        </div>
                        
                        {/* Last updated timestamp */}
                        <div className="flex items-center justify-end text-sm text-gray-500 gap-2">
                            <Clock size={14} />
                            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'} | Refresh interval: {intervalTime/1000}s
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}