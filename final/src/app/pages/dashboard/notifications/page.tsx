"use client"
import React, { useState, useCallback, useEffect } from "react"
import type { Notification } from "@/app/lib/notification"
import { getNotification } from "@/app/lib/notificationServer"
import Sidebar from "@/app/components/Sidebar"
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  X, 
  DownloadCloud, 
  UploadCloud, 
  Zap, 
  Server, 
  ArrowRight, 
  RefreshCcw,
  Filter,
  Calendar,
  ChevronDown,
  Check,
  Search
} from "lucide-react"

type HistoryPoint = {
    time: string;
    download: number;
    upload: number;
};

const severityConfig = {
  0: {
    color: "bg-yellow-500",
    text: "text-yellow-700",
    label: "Medium",
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
  },
  1: {
    color: "bg-red-500",
    text: "text-red-700",
    label: "High",
    icon: <AlertCircle className="h-5 w-5 text-red-500" />
  },
  2: {
    color: "bg-green-500",
    text: "text-green-700",
    label: "Low",
    icon: <Info className="h-5 w-5 text-green-500" />
  }
}

const notificationTypeIcons = {
  "download_spike": <DownloadCloud className="h-5 w-5" />,
  "upload_spike": <UploadCloud className="h-5 w-5" />,
  "bandwidth_issue": <Zap className="h-5 w-5" />,
  "server_error": <Server className="h-5 w-5" />,
  "default": <Bell className="h-5 w-5" />
}

const getBandwidthData = (notification: Notification) => {
  const baseDownload = notification.types === "download_spike" ? 1.36 : 0.2;
  const baseUpload = notification.types === "upload_spike" ? 1.2 : 0.1;
  
  return {
    current: {
      download: baseDownload,
      upload: baseUpload,
    },
    average: {
      download: 0.2,
      upload: 0.1,
    },
    threshold: {
      download: 1.0,
      upload: 0.8,
    },
    history: [
      { time: "10:00", download: 0.18, upload: 0.09 },
      { time: "10:05", download: 0.22, upload: 0.11 },
      { time: "10:10", download: 0.20, upload: 0.10 },
      { time: "10:15", download: baseDownload * 0.5, upload: baseUpload * 0.5 },
      { time: "10:20", download: baseDownload, upload: baseUpload }
    ]
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);
};

const extractDeviceDetails = (remarks: string) => {
  const deviceMatch = remarks.match(/for\s+([^\s]+)\s+\(([^)]+)\)/);
  return deviceMatch ? {
    name: deviceMatch[1],
    ip: deviceMatch[2]
  } : {
    name: "Unknown Device",
    ip: "Unknown IP"
  };
};

const extractProbableCause = (remarks: string) => {
  const causeMatch = remarks.match(/Probable cause:\s+(.+)$/);
  return causeMatch ? causeMatch[1] : "Unknown cause";
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bandwidthData, setBandwidthData] = useState<{
    current: { download: number; upload: number };
    average: { download: number; upload: number };
    threshold: { download: number; upload: number };
    history: Array<{ time: string; download: number; upload: number }>;
  } | null>(null);
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const notificationTypes = ["low_medium_download", "low_medium_upload"];

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await getNotification();
      setNotifications(res);
      setFilteredNotifications(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Function to apply filters moved outside and called in useEffect
  const applyFilters = useCallback(() => {
    let result = [...notifications];
    
    if (selectedTypes.length > 0) {
      result = result.filter(notification => selectedTypes.includes(notification.types));
    }
    
    if (startDate) {
      const startDateTime = new Date(startDate).getTime();
      result = result.filter(notification => 
        new Date(notification.created_at).getTime() >= startDateTime
      );
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate).getTime() + 86400000;
      result = result.filter(notification => 
        new Date(notification.created_at).getTime() <= endDateTime
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(notification => 
        notification.remarks.toLowerCase().includes(query) || 
        notification.types.toLowerCase().includes(query) ||
        notification.device_id.toString().includes(query)
      );
    }
    
    setFilteredNotifications(result);
  }, [notifications, selectedTypes, startDate, endDate, searchQuery]);

  // Separate useEffect to run applyFilters when filter criteria change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const toggleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };
  
  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedTypes([]);
    setSearchQuery("");
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setBandwidthData(getBandwidthData(notification));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedNotification(null);
  };
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600">Monitor and manage all system alerts</p>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                <ChevronDown className={`h-4 w-4 ml-1 transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>
              <button 
                onClick={fetchData}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Filter Panel */}
          {isFilterOpen && (
            <div className="bg-white rounded-lg shadow mb-6 p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Filter Notifications</h3>
                <button 
                  onClick={resetFilters}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Reset All
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Start"
                      />
                    </div>
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="End"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Notification Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notification Type</label>
                  <div className="flex flex-wrap gap-2">
                    {notificationTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => toggleTypeFilter(type)}
                        className={`
                          flex items-center px-3 py-1 rounded-full text-xs font-medium 
                          ${selectedTypes.includes(type) 
                            ? 'bg-blue-100 text-blue-800 border-blue-300' 
                            : 'bg-gray-100 text-gray-700 border-gray-300'} 
                          border hover:bg-opacity-80 transition-colors
                        `}
                      >
                        {type === "download_spike" && <DownloadCloud className="h-3 w-3 mr-1" />}
                        {type === "upload_spike" && <UploadCloud className="h-3 w-3 mr-1" />}
                        {type === "bandwidth_issue" && <Zap className="h-3 w-3 mr-1" />}
                        {type === "server_error" && <Server className="h-3 w-3 mr-1" />}
                        {type.replace('_', ' ')}
                        {selectedTypes.includes(type) && <Check className="h-3 w-3 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-3 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search by device, type, or remarks..."
                        />

                  </div>
                </div>
              </div>
              
              {/* Filter Summary */}
              {(selectedTypes.length > 0 || startDate || endDate || searchQuery) && (
                <div className="mt-3 border-t pt-3">
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="mr-2">Active Filters:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedTypes.map(type => (
                        <span key={type} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                          Type: {type.replace('_', ' ')}
                        </span>
                      ))}
                      {startDate && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                          From: {new Date(startDate).toLocaleDateString()}
                        </span>
                      )}
                      {endDate && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                          To: {new Date(endDate).toLocaleDateString()}
                        </span>
                      )}
                      {searchQuery && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">
                          Search: &quot;{searchQuery}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center">
              {notifications.length === 0 ? (
                <>
                  <Bell className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No notifications</h3>
                  <p className="text-gray-500 mt-2">All systems are running normally.</p>
                </>
              ) : (
                <>
                  <Filter className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No matching notifications</h3>
                  <p className="text-gray-500 mt-2">Try adjusting your filter criteria.</p>
                  <button 
                    onClick={resetFilters}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reset Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <p className="text-sm text-gray-500">
                  Showing {filteredNotifications.length} of {notifications.length} notifications
                </p>
                <div className="text-sm text-gray-500">
                  {selectedTypes.length > 0 || startDate || endDate || searchQuery ? (
                    <span className="text-blue-600 font-medium">Filtered results</span>
                  ) : 'All notifications'}
                </div>
              </div>
            
              {filteredNotifications.map((notification) => {
                const severity = severityConfig[notification.severity as keyof typeof severityConfig];
                const typeIcon = notificationTypeIcons[notification.types as keyof typeof notificationTypeIcons] || notificationTypeIcons.default;
                const deviceDetails = extractDeviceDetails(notification.remarks);
                
                return (
                  <div 
                    key={notification.noti_id} 
                    className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="p-4 flex items-start">
                      <div className="mr-4 mt-1">
                        {typeIcon}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severity.text} bg-opacity-10 ${severity.color.replace('bg-', 'bg-opacity-10 bg-')}`}>
                              {severity.icon}
                              <span className="ml-1">{severity.label}</span>
                            </span>
                            <span className="ml-2 text-xs text-gray-500">
                              {formatDate(notification.created_at)}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-blue-600">
                            View Details <ArrowRight className="inline h-3 w-3" />
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-medium text-gray-900">
                          {notification.types.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - Device ID: {notification.device_id}
                        </h3>
                        <div className="mt-1">
                          <p className="text-sm text-gray-600 line-clamp-2">{notification.remarks}</p>
                        </div>
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <span className="font-medium">{deviceDetails.name}</span>
                          <span className="mx-1">•</span>
                          <span>{deviceDetails.ip}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal for notification details */}
      {isModalOpen && selectedNotification && bandwidthData && (
        <div className="fixed inset-0 bg-transparent flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full overflow-auto animate-slide-in-right shadow-lg">
            <div className="sticky top-0 bg-white z-10 border-b">
              <div className="flex justify-between items-center p-4">
                <h2 className="text-lg font-bold">Notification Details</h2>
                <button 
                  onClick={closeModal}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  {notificationTypeIcons[selectedNotification.types as keyof typeof notificationTypeIcons] || notificationTypeIcons.default}
                  <h3 className="ml-2 text-lg font-medium">
                    {selectedNotification.types.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h3>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-blue-800 mb-2">Alert Information</h4>
                  <ul className="space-y-2">
                    <li className="flex justify-between">
                      <span className="text-sm text-gray-600">Notification ID:</span>
                      <span className="text-sm font-medium">{selectedNotification.noti_id}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-sm text-gray-600">Device ID:</span>
                      <span className="text-sm font-medium">{selectedNotification.device_id}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-sm text-gray-600">Severity:</span>
                      <span className={`text-sm font-medium ${severityConfig[selectedNotification.severity as keyof typeof severityConfig].text}`}>
                        {severityConfig[selectedNotification.severity as keyof typeof severityConfig].label}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-sm text-gray-600">Time Detected:</span>
                      <span className="text-sm font-medium">{formatDate(selectedNotification.created_at)}</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-gray-700">{selectedNotification.remarks}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2">Device Information</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-500">Name</span>
                      <p className="text-sm font-medium">{extractDeviceDetails(selectedNotification.remarks).name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">IP Address</span>
                      <p className="text-sm font-medium">{extractDeviceDetails(selectedNotification.remarks).ip}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-medium mb-2">Probable Cause</h4>
                  <p className="text-sm text-gray-700">{extractProbableCause(selectedNotification.remarks)}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-4">Bandwidth Analysis</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center mb-1">
                      <DownloadCloud className="h-4 w-4 text-blue-500 mr-1" />
                      <span className="text-xs font-medium text-blue-800">Download</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-lg font-bold">{bandwidthData.current.download}</span>
                      <span className="text-xs ml-1">KB/s</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">Avg: {bandwidthData.average.download} KB/s</span>
                      <span className={bandwidthData.current.download > bandwidthData.threshold.download ? "text-red-500" : "text-green-500"}>
                        {bandwidthData.current.download > bandwidthData.average.download 
                          ? `${Math.round((bandwidthData.current.download / bandwidthData.average.download - 1) * 100)}% ↑` 
                          : `${Math.round((1 - bandwidthData.current.download / bandwidthData.average.download) * 100)}% ↓`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="flex items-center mb-1">
                      <UploadCloud className="h-4 w-4 text-purple-500 mr-1" />
                      <span className="text-xs font-medium text-purple-800">Upload</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-lg font-bold">{bandwidthData.current.upload}</span>
                      <span className="text-xs ml-1">KB/s</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">Avg: {bandwidthData.average.upload} KB/s</span>
                      <span className={bandwidthData.current.upload > bandwidthData.threshold.upload ? "text-red-500" : "text-green-500"}>
                        {bandwidthData.current.upload > bandwidthData.average.upload 
                          ? `${Math.round((bandwidthData.current.upload / bandwidthData.average.upload - 1) * 100)}% ↑` 
                          : `${Math.round((1 - bandwidthData.current.upload / bandwidthData.average.upload) * 100)}% ↓`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">Bandwidth Threshold</h4>
                  
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Download Threshold</span>
                      <span>{bandwidthData.threshold.download} KB/s</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${bandwidthData.current.download > bandwidthData.threshold.download ? 'bg-red-500' : 'bg-blue-500'} h-2 rounded-full`} 
                        style={{ width: `${Math.min(100, (bandwidthData.current.download / bandwidthData.threshold.download) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Upload Threshold</span>
                      <span>{bandwidthData.threshold.upload} KB/s</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`${bandwidthData.current.upload > bandwidthData.threshold.upload ? 'bg-red-500' : 'bg-purple-500'} h-2 rounded-full`} 
                        style={{ width: `${Math.min(100, (bandwidthData.current.upload / bandwidthData.threshold.upload) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3">Usage Timeline</h3>
                <div className="bg-white border rounded-lg p-4">
                  <div className="h-32 relative">
                    {/* Simple timeline chart */}
                    <div className="absolute inset-0">
                      <div className="border-b border-gray-200 absolute bottom-0 w-full"></div>
                      <div className="border-b border-dashed border-gray-200 absolute bottom-1/3 w-full"></div>
                      <div className="border-b border-dashed border-gray-200 absolute bottom-2/3 w-full"></div>
                    </div>
                    
                    <div className="absolute inset-0 flex items-end justify-between">
                      {bandwidthData.history.map((point, index) => (
                        <div key={index} className="flex flex-col items-center" style={{ 
                            bottom: `${(bandwidthData.threshold.download / Math.max(...bandwidthData.history.map((p: HistoryPoint) => Math.max(p.download, p.upload)))) * 100}%` 
                          }}>
                          <div className="relative h-24 w-full flex flex-col items-center justify-end">
                            {/* Download bar */}
                            <div 
                              className="w-4 bg-blue-500 rounded-t-sm"
                              style={{ 
                                height: `${(point.download / Math.max(...bandwidthData.history.map((p: HistoryPoint) => Math.max(p.download, p.upload)))) * 100}%`,
                                opacity: index === bandwidthData.history.length - 1 ? 1 : 0.7
                              }}
                            ></div>
                            
                            {/* Upload bar */}
                            <div 
                              className="w-4 bg-purple-500 rounded-t-sm mt-1"
                              style={{ 
                                height: `${(point.upload / Math.max(...bandwidthData.history.map((p: HistoryPoint) => Math.max(p.download, p.upload)))) * 100}%`,
                                opacity: index === bandwidthData.history.length - 1 ? 1 : 0.7
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">{point.time}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Threshold line */}
                    <div 
                      className="absolute border-t border-red-400 border-dashed w-full"
                      style={{ 
                        bottom: `${(bandwidthData.threshold.download / Math.max(...bandwidthData.history.map((p: HistoryPoint) => Math.max(p.download, p.upload)))) * 100}%` 
                      }}
                    >
                      <span className="absolute right-0 -top-3 text-xs text-red-500">Threshold</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mt-2">
                    <div className="flex items-center mr-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-sm mr-1"></div>
                      <span className="text-xs text-gray-600">Download</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-sm mr-1"></div>
                      <span className="text-xs text-gray-600">Upload</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg mr-2 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                {/* <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Mark as Resolved
                </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}