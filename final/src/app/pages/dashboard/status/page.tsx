"use client"
import React, { useEffect, useCallback, useState, ReactElement } from "react"
import Sidebar from "@/app/components/Sidebar"
import axios from "axios"
import { Network, Wifi, Globe, Server, Layers, RefreshCw } from "lucide-react"

interface AdapterData {
  ipv4?: string;
  ipv6?: string;
  subnetMask?: string;
  defaultGateway?: string;
  [key: string]: string | undefined;
}

interface NetworkData {
  adapters: {
    [key: string]: AdapterData;
  };
}

export default function NetworkStatus(): ReactElement {
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const fetchData = useCallback(async (): Promise<void> => {
        try {
            setLoading(true);
            const res = await axios.get<NetworkData>('http://localhost:3000/api/ipconfig');
            setNetworkData(res.data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch network data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleRefresh = (): void => {
        setRefreshing(true);
        fetchData();
    };

    const openIPLocation = (ip: string): void => {
        if (ip) {
            window.open(`https://whatismyipaddress.com/ip/${ip}`, '_blank');
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const renderAdapterCard = (adapterName: string, adapterData: AdapterData): ReactElement => {
        const isEthernet = adapterName.toLowerCase().includes('ethernet');
        const isWifi = adapterName.toLowerCase().includes('wifi');
        
        const AdapterIcon = isWifi ? Wifi : isEthernet ? Network : Server;
        const connected = adapterData.ipv4 || adapterData.ipv6;

        return (
            <div key={adapterName} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4 transition-all hover:shadow-lg">
                <div className="flex items-center mb-4">
                    <div className={`p-3 rounded-full mr-4 ${connected ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <AdapterIcon className={`h-6 w-6 ${connected ? 'text-green-500 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{adapterName}</h3>
                        <p className={`text-sm ${connected ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {connected ? 'Connected' : 'Disconnected'}
                        </p>
                    </div>
                </div>

                {adapterData.ipv4 && (
                    <div className="mb-3 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IPv4 Address</p>
                            <p className="text-md font-mono">{adapterData.ipv4}</p>
                        </div>
                        <button 
                            onClick={() => openIPLocation(adapterData.ipv4 as string)}
                            className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-sm flex items-center transition-colors"
                            type="button"
                            aria-label="Locate IP"
                        >
                            <Globe className="h-4 w-4 mr-1" />
                            Locate
                        </button>
                    </div>
                )}

                {adapterData.subnetMask && (
                    <div className="mb-3">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Subnet Mask</p>
                        <p className="text-md font-mono">{adapterData.subnetMask}</p>
                    </div>
                )}

                {adapterData.defaultGateway && (
                    <div className="mb-3">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Default Gateway</p>
                        <p className="text-md font-mono">{adapterData.defaultGateway}</p>
                    </div>
                )}

                {adapterData.ipv6 && (
                    <div className="mb-3">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">IPv6 Address</p>
                        <p className="text-md font-mono break-all">{adapterData.ipv6}</p>
                    </div>
                )}

                {!connected && (
                    <div className="text-center py-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No connection information available</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                            <Layers className="mr-2 h-6 w-6" /> 
                            Network Status
                        </h1>
                        <button 
                            onClick={handleRefresh} 
                            disabled={loading || refreshing}
                            className={`flex items-center px-4 py-2 rounded-md text-white transition-colors ${
                                loading || refreshing 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            type="button"
                            aria-label="Refresh network data"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {loading && !refreshing ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading network information...</p>
                        </div>
                    ) : (
                        networkData && networkData.adapters && (
                            <div>
                                {Object.entries(networkData.adapters).map(([name, data]) => 
                                    renderAdapterCard(name, data)
                                )}
                            </div>
                        )
                    )}

                    {!loading && (!networkData || !networkData.adapters || Object.keys(networkData.adapters).length === 0) && (
                        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                            <Server className="h-12 w-12 mx-auto text-gray-400" />
                            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">No network adapters found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}