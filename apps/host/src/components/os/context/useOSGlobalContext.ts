'use client';

import { useContext } from 'react';
import { OSGlobalContext, type OSGlobalContextValue } from './OSGlobalContext';

export function useOSGlobalContext(): OSGlobalContextValue {
  const ctx = useContext(OSGlobalContext);
  if (!ctx) {
    throw new Error('useOSGlobalContext debe usarse dentro de <OSGlobalProvider> (shell del OS)');
  }
  return ctx;
}
