import React, { createContext, useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SyncContextType {
  isSyncing: boolean;
  startSync: () => void;
  stopSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const startSync = () => setIsSyncing(true);
  const stopSync = () => setIsSyncing(false);

  return (
    <SyncContext.Provider value={{ isSyncing, startSync, stopSync }}>
      {children}
      {isSyncing && (
        <div className="fixed bottom-6 left-6 z-[9999] flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm border border-indigo-100 rounded-full shadow-lg animate-in slide-in-from-bottom-4 duration-300">
          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          <span className="text-xs font-medium text-gray-700">Đang đồng bộ...</span>
        </div>
      )}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
