"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FaTachometerAlt, FaNetworkWired, FaMobileAlt, FaChartLine, 
    FaFilter, FaBell, FaClipboardList, FaSignOutAlt, FaBars, FaTimes,
    FaChevronRight, FaUserCircle
} from 'react-icons/fa';
import { auth } from '@/auth/firebase';
import { signOut } from 'firebase/auth';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface MenuItem {
    name: string;
    route: string;
    icon: React.ReactNode;
    hasBadge?: boolean;
    badgeCount?: number;
}

interface Notification {
    id: string;
    message: string;
    created_at: string;
    read: boolean;
}

const Sidebar: React.FC = () => {
    const router = useRouter();
    const [active, setActive] = useState<string>('Dashboard');
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
    const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState<string>(() => {
        // Initialize from localStorage if available
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('lastCheckedNotifications');
            return saved ? new Date(saved).toISOString() : new Date().toISOString();
        }
        return new Date().toISOString();
    });

    // Toggle sidebar for mobile
    const toggleSidebar = (): void => {
        setIsOpen(!isOpen);
    };

    // Toggle sidebar expansion for desktop
    const toggleExpansion = (): void => {
        setIsExpanded(!isExpanded);
    };

    // Close sidebar on outside click (for mobile)
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent): void => {
            if (isOpen && !(e.target as Element).closest('.sidebar')) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen]);

    // Close sidebar on window resize if it becomes desktop view
    useEffect(() => {
        const handleResize = (): void => {
            if (window.innerWidth > 768 && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen]);

    const menuItems: MenuItem[] = useMemo(() => [
        { name: "Dashboard", route: "pages/dashboard", icon: <FaTachometerAlt /> },
        { name: "Network Status", route: "pages/dashboard/network-status", icon: <FaNetworkWired /> },
        { name: "Connected Devices", route: "pages/dashboard/connected-devices", icon: <FaMobileAlt /> },
        { name: "Bandwidth Usage", route: "pages/dashboard/bandwidth-usage", icon: <FaChartLine /> },
        { name: "Mac Filtering", route: "pages/dashboard/mac-filtering", icon: <FaFilter /> },
        { 
            name: "Notifications", 
            route: "pages/dashboard/notifications", 
            icon: <FaBell />,
            hasBadge: unreadNotifications > 0,
            badgeCount: unreadNotifications
        },
        { name: "Logs", route: "pages/dashboard/logs", icon: <FaClipboardList /> }
    ], [unreadNotifications]);
    

    const handleLogout = async (): Promise<void> => {
        try {
            setIsLoggingOut(true);
            await signOut(auth);
            console.log("User logged out successfully");
            router.push('/');
        } catch (error) {
            console.error("Error logging out:", error);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const onComponentChange = (route: string): void => {
        // If navigating to notifications, update the last checked timestamp
        if (route === "notifications") {
            const now = new Date().toISOString();
            setLastCheckedTimestamp(now);
            if (typeof window !== 'undefined') {
                localStorage.setItem('lastCheckedNotifications', now);
            }
            setUnreadNotifications(0);
        }
        
        router.push(`/${route}`);
        
        // Close sidebar on mobile after navigation
        if (window.innerWidth <= 768) {
            setIsOpen(false);
        }
    };

    const checkForNewNotifications = useCallback(async (): Promise<void> => {
        try {
            const response = await axios.get<Notification[]>('http://localhost:8005/api/notifications');
            const newNotifications = response.data.filter(
                notification => new Date(notification.created_at) > new Date(lastCheckedTimestamp)
            );
            setUnreadNotifications(newNotifications.length);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }, [lastCheckedTimestamp]);
    

    // Setup polling for new notifications
    useEffect(() => {
        // Initial check
        checkForNewNotifications();
        
        // Poll for new notifications every 30 seconds
        const intervalId = setInterval(checkForNewNotifications, 30000);
        
        // Clean up on unmount
        return () => clearInterval(intervalId);
    }, [lastCheckedTimestamp, checkForNewNotifications]);

    // Update active item based on current route
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentRoute = window.location.pathname.replace('/', '');
            const activeItem = menuItems.find(item => item.route === currentRoute);
            if (activeItem) {
                setActive(activeItem.name);
                
                // If on notifications page, reset the unread count and update last checked time
                if (currentRoute === "notifications") {
                    const now = new Date().toISOString();
                    setLastCheckedTimestamp(now);
                    localStorage.setItem('lastCheckedNotifications', now);
                    setUnreadNotifications(0);
                }
            }
        }
    }, [menuItems]);

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" />
            )}

            {/* Mobile toggle button */}
            <button 
                className="fixed top-4 left-4 z-30 p-2 rounded-md bg-gray-200 text-gray-700 md:hidden shadow-md"
                onClick={toggleSidebar}
                aria-label="Toggle Menu"
            >
                {isOpen ? <FaTimes /> : <FaBars />}
            </button>

            {/* Sidebar container */}
            <aside 
                className={`fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isExpanded ? 'w-64' : 'w-20'}
                    bg-white shadow-xl flex flex-col`}
            >
                {/* Desktop toggle expand/collapse button */}
                <button 
                    className="absolute -right-3 top-20 hidden md:flex items-center justify-center w-6 h-6 
                        rounded-full bg-gray-300 text-gray-700 text-xs shadow-md transition-transform"
                    onClick={toggleExpansion}
                    style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(180deg)' }}
                    aria-label="Expand/Collapse Sidebar"
                >
                    <FaChevronRight />
                </button>

                <div className="flex-1 overflow-y-auto p-4">
                    {/* Logo/Header */}
                    <div className={`flex items-center justify-center mb-8 ${isExpanded ? '' : 'flex-col'}`}>
                        <h2 className={`text-2xl font-bold tracking-wide text-gray-700 transition-all
                            ${isExpanded ? 'text-center' : 'text-xs mt-2 transform rotate-90'}`}>
                            NetDetect
                        </h2>
                    </div>

                    {/* Navigation Menu */}
                    <nav>
                        <ul className="space-y-2">
                            {menuItems.map((item) => (
                                <li 
                                    key={item.name} 
                                    onClick={() => {
                                        setActive(item.name);
                                        onComponentChange(item.route);
                                    }}
                                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-300
                                        ${active === item.name 
                                            ? "bg-gray-300 text-gray-900 font-medium shadow-sm"
                                            : "hover:bg-gray-50 text-gray-600"
                                        }
                                        ${!isExpanded ? 'justify-center' : ''}`}
                                >
                                    <span className="text-lg text-gray-500 relative">
                                        {item.icon}
                                        {/* Notification badge */}
                                        {item.hasBadge && item.badgeCount && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                                                {item.badgeCount > 9 ? '9+' : item.badgeCount}
                                            </span>
                                        )}
                                    </span> 
                                    {isExpanded && <span className="ml-3">{item.name}</span>}
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                {/* User Profile & Logout Section */}
                <div className={`p-4 border-t border-gray-200 ${isExpanded ? '' : 'text-center'}`}>
                    <div className={`flex ${isExpanded ? 'items-center' : 'flex-col items-center justify-center'}`}>
                        <div className="relative w-10 h-10 rounded-full overflow-hidden">
                            {isExpanded ? (
                                <Image 
                                    src="/images/robot.gif"
                                    alt="Profile" 
                                    width={40}
                                    height={40}
                                    className="rounded-full border border-gray-300 shadow-sm"
                                />
                            ) : (
                                <FaUserCircle className="w-10 h-10 text-gray-500" />
                            )}
                        </div>
                        
                        {isExpanded && (
                            <div className="ml-3">
                                <p className="text-sm font-semibold text-gray-700">Joel</p>
                                <button 
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="flex items-center text-sm text-red-500 hover:text-red-600 mt-1 transition-all duration-300"
                                >
                                    <FaSignOutAlt className="mr-1" /> 
                                    {isLoggingOut ? "Logging out..." : "Log Out"}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {!isExpanded && (
                        <button 
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="mt-3 text-red-500 hover:text-red-600"
                            title="Log Out"
                        >
                            <FaSignOutAlt className="mx-auto" />
                        </button>
                    )}
                </div>
            </aside>

            {/* Page content wrapper - pushes content away from sidebar */}
            <div 
                className={`transition-all duration-300 ease-in-out
                    ${isExpanded ? 'md:ml-64' : 'md:ml-20'}
                    pt-16 md:pt-0`}
            >
                {/* This is where your page content would go */}
            </div>
        </>
    );
};

export default Sidebar;