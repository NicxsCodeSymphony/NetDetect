"use client"

import React, { useState, createContext, useContext, ReactNode } from 'react'

// Types
type TabsContextType = {
  activeTab: string
  setActiveTab: (id: string) => void
}

type TabsProps = {
  defaultTab: string
  children: ReactNode
  className?: string
}

type TabProps = {
  id: string
  children: ReactNode
  className?: string
  activeClassName?: string
}

type TabContentProps = {
  tabId: string
  children: ReactNode
  className?: string
}

// Create context
const TabsContext = createContext<TabsContextType | undefined>(undefined)

// Hook to use tabs context
const useTabsContext = () => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a TabsProvider')
  }
  return context
}

// Main Tabs container component
export const Tabs = ({ defaultTab, children, className = '' }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

// TabList component to contain the tab buttons
export const TabList = ({ children, className = '' }: { children: ReactNode, className?: string }) => {
  return (
    <div className={`flex ${className}`} role="tablist">
      {children}
    </div>
  )
}

// Individual Tab button
export const Tab = ({ id, children, className = '', activeClassName = '' }: TabProps) => {
  const { activeTab, setActiveTab } = useTabsContext()
  const isActive = activeTab === id
  
  // Base styles that apply to all tabs
  const baseStyles = "focus:outline-none transition-all duration-200"
  
  // Combine provided classes with conditional active classes
  const tabClasses = `${baseStyles} ${className} ${isActive ? activeClassName : ''}`
  
  return (
    <button
      role="tab"
      aria-selected={isActive}
      id={`tab-${id}`}
      aria-controls={`panel-${id}`}
      className={tabClasses}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  )
}

// TabContent component to display content for the active tab
export const TabContent = ({ tabId, children, className = '' }: TabContentProps) => {
  const { activeTab } = useTabsContext()
  
  if (activeTab !== tabId) {
    return null
  }
  
  return (
    <div 
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={className}
    >
      {children}
    </div>
  )
}