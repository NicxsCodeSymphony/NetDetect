"use client"

import { useState, useEffect } from "react";
import Sidebar from "@/app/components/Sidebar";
import { getNotification } from "@/app/lib/notificationServer";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertCircle, Download, Upload, RefreshCw } from "lucide-react";

export default function Traffic() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    downloadSpike: 0,
    uploadSpike: 0,
    otherTypes: 0
  });

  useEffect(() => {
    async function fetchNotifications() {
      try {
        setIsLoading(true);
        const data = await getNotification();
        setNotifications(data);
        
        // Calculate statistics
        const downloadCount = data.filter(n => n.types === "download_spike").length;
        const uploadCount = data.filter(n => n.types === "upload_spike").length;
        const otherCount = data.filter(n => n.types !== "download_spike" && n.types !== "upload_spike").length;
        
        setStats({
          total: data.length,
          downloadSpike: downloadCount,
          uploadSpike: uploadCount,
          otherTypes: otherCount
        });
        
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch notification data");
        setIsLoading(false);
        console.error(err);
      }
    }
    
    fetchNotifications();
  }, []);

  // Group data by device for chart
  const getChartData = () => {
    const deviceMap = {};
    
    notifications.forEach(notification => {
      const deviceName = notification.remarks.match(/for ([^(]+)/)?.[1]?.trim() || "Unknown Device";
      
      if (!deviceMap[deviceName]) {
        deviceMap[deviceName] = {
          device: deviceName,
          downloadSpikes: 0,
          uploadSpikes: 0,
          other: 0
        };
      }
      
      if (notification.types === "download_spike") {
        deviceMap[deviceName].downloadSpikes++;
      } else if (notification.types === "upload_spike") {
        deviceMap[deviceName].uploadSpikes++;
      } else {
        deviceMap[deviceName].other++;
      }
    });
    
    return Object.values(deviceMap);
  };

  const chartData = getChartData();

  // Get date range for displaying
  const getDateRange = () => {
    if (notifications.length === 0) return "No data available";
    
    const dates = notifications.map(n => new Date(n.created_at));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    return `${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`;
  };

  // Function to extract cause from remarks
  const extractCause = (remarks) => {
    // Extract the cause after "Probable cause:" if it exists
    const causeMatch = remarks.match(/Probable cause: ([^)]+)(?:\))?$/);
    if (causeMatch && causeMatch[1]) {
      return causeMatch[1].trim();
    }
    
    // For older format without explicit "Probable cause:" label
    if (remarks.includes("Streaming")) {
      return "Streaming activity";
    }
    
    return "Unknown";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Network Traffic Monitoring</h1>
          <p className="text-gray-600">Analysis of network traffic spikes and anomalies</p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mr-2" />
            <span>Loading traffic data...</span>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-full mr-4">
                    <Download className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-gray-500">Download Spikes</p>
                    <h3 className="text-2xl font-bold">{stats.downloadSpike}</h3>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-full mr-4">
                    <Upload className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-gray-500">Upload Spikes</p>
                    <h3 className="text-2xl font-bold">{stats.uploadSpike}</h3>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-full mr-4">
                    <AlertCircle className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-gray-500">Total Notifications</p>
                    <h3 className="text-2xl font-bold">{stats.total}</h3>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold mb-4">Traffic Spike Distribution by Device</h2>
              <p className="text-gray-600 mb-4">Period: {getDateRange()}</p>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="device" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="downloadSpikes" name="Download Spikes" fill="#3b82f6" />
                    <Bar dataKey="uploadSpikes" name="Upload Spikes" fill="#10b981" />
                    <Bar dataKey="other" name="Other Notifications" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Recent Network Notifications</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cause</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {notifications.slice(0, 10).map((notification) => {
                      // Extract device name from remarks
                      const deviceMatch = notification.remarks.match(/for ([^(]+)/);
                      const deviceName = deviceMatch ? deviceMatch[1].trim() : "Unknown";
                      
                      // Extract IP from remarks
                      const ipMatch = notification.remarks.match(/\(([^)]+)\)/);
                      const deviceIp = ipMatch ? ipMatch[1] : "Unknown";
                      
                      // Extract speed from remarks
                      const speedMatch = notification.remarks.match(/\d+\.\d+ KB\/s/);
                      const speed = speedMatch ? speedMatch[0] : "Unknown";
                      
                      // Extract cause of spike
                      const cause = extractCause(notification.remarks);
                      
                      return (
                        <tr key={notification.noti_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {notification.noti_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{deviceName}</div>
                            <div className="text-sm text-gray-500">{deviceIp}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              notification.types === "download_spike" 
                                ? "bg-blue-100 text-blue-800" 
                                : notification.types === "upload_spike" 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-gray-100 text-gray-800"
                            }`}>
                              {notification.types.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {speed}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded bg-yellow-100 text-yellow-800">
                              {cause}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(notification.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {notifications.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 text-right">
                  <p className="text-sm text-gray-700">
                    Showing 10 of {notifications.length} notifications
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}