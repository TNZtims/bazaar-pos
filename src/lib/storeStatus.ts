import { IStore } from '@/models/Store'

export interface StoreStatus {
  isOpen: boolean
  isOnline: boolean
  message: string
}

export function checkStoreStatus(store: IStore): StoreStatus {
  // Check if store is active and online
  if (!store.isActive) {
    return {
      isOpen: false,
      isOnline: false,
      message: 'Store is temporarily inactive'
    }
  }

  if (!store.isOnline) {
    return {
      isOpen: false,
      isOnline: false,
      message: 'Store is currently offline. You can still browse and preorder items.'
    }
  }

  // Store is online and active
  return {
    isOpen: true,
    isOnline: true,
    message: 'Store is online and ready for orders'
  }
}