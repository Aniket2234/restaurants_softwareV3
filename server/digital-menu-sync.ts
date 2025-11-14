import { mongodb } from './mongodb';
import { type DigitalMenuOrder, type DigitalMenuCustomer } from '@shared/schema';
import { type IStorage } from './storage';
import { ObjectId } from 'mongodb';

export class DigitalMenuSyncService {
  private storage: IStorage;
  private syncInterval: NodeJS.Timeout | null = null;
  private processedOrderIds: Set<string> = new Set();
  private orderStatusMap: Map<string, string> = new Map();
  private isRunning = false;
  private broadcastFn: ((type: string, data: any) => void) | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  setBroadcastFunction(fn: (type: string, data: any) => void) {
    this.broadcastFn = fn;
  }

  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Digital menu sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting digital menu sync service...');
    
    // Load existing sync state from MongoDB
    await this.loadSyncState();
    
    await this.syncOrders();
    
    this.syncInterval = setInterval(async () => {
      await this.syncOrders();
    }, intervalMs);

    console.log(`✅ Digital menu sync service started (polling every ${intervalMs / 1000}s)`);
  }

  private async loadSyncState(): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuOrder>('digital_menu_customer_orders');
      
      const syncedOrders = await collection.find({ syncedToPOS: true }).toArray();
      
      for (const order of syncedOrders) {
        const orderId = order._id.toString();
        this.processedOrderIds.add(orderId);
        this.orderStatusMap.set(orderId, order.status);
      }
      
      console.log(`📊 Loaded ${syncedOrders.length} synced orders from MongoDB`);
    } catch (error) {
      console.error('❌ Error loading sync state:', error);
    }
  }

  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.isRunning = false;
      console.log('🛑 Digital menu sync service stopped');
    }
  }

  async syncOrders(): Promise<number> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuOrder>('digital_menu_customer_orders');
      
      // Sync new orders
      const unprocessedOrders = await collection.find({
        status: { $in: ['pending', 'confirmed'] },
        syncedToPOS: { $ne: true }
      }).toArray();

      let synced = 0;
      for (const digitalOrder of unprocessedOrders) {
        const orderId = digitalOrder._id.toString();
        
        if (this.processedOrderIds.has(orderId)) continue;
        
        try {
          await this.convertAndCreatePOSOrder(digitalOrder);
          this.processedOrderIds.add(orderId);
          this.orderStatusMap.set(orderId, digitalOrder.status);
          synced++;
          console.log(`✅ Synced digital menu order ${orderId} for ${digitalOrder.customerName}`);
          
          if (this.broadcastFn) {
            this.broadcastFn('digital_menu_order_synced', { 
              orderId, 
              customerName: digitalOrder.customerName,
              status: digitalOrder.status 
            });
          }
        } catch (error) {
          console.error(`❌ Failed to sync order ${orderId}:`, error);
        }
      }

      // Check for status updates in existing orders
      const syncedOrders = await collection.find({
        syncedToPOS: true
      }).toArray();

      let updated = 0;
      for (const digitalOrder of syncedOrders) {
        const orderId = digitalOrder._id.toString();
        const previousStatus = this.orderStatusMap.get(orderId);
        
        if (previousStatus && previousStatus !== digitalOrder.status) {
          try {
            await this.updatePOSOrderStatus(digitalOrder);
            this.orderStatusMap.set(orderId, digitalOrder.status);
            updated++;
            console.log(`🔄 Updated digital menu order ${orderId} status: ${previousStatus} → ${digitalOrder.status}`);
            
            if (this.broadcastFn) {
              this.broadcastFn('digital_menu_order_updated', { 
                orderId, 
                customerName: digitalOrder.customerName,
                previousStatus,
                newStatus: digitalOrder.status 
              });
            }
          } catch (error) {
            console.error(`❌ Failed to update order ${orderId} status:`, error);
          }
        } else if (!previousStatus) {
          this.orderStatusMap.set(orderId, digitalOrder.status);
        }
      }

      if (synced > 0 || updated > 0) {
        console.log(`📊 Digital menu sync: ${synced} new, ${updated} updated`);
        if (this.broadcastFn) {
          this.broadcastFn('digital_menu_synced', { newOrders: synced, updatedOrders: updated });
        }
      }

      return synced + updated;
    } catch (error) {
      console.error('❌ Error during digital menu sync:', error);
      return 0;
    }
  }

  private async convertAndCreatePOSOrder(digitalOrder: DigitalMenuOrder): Promise<void> {
    let tableId: string | null = null;

    if (digitalOrder.tableNumber) {
      const table = await this.findTableByNumberAndFloor(
        digitalOrder.tableNumber,
        digitalOrder.floorNumber
      );
      
      if (table) {
        tableId = table.id;
        
        if (table.status === 'free') {
          await this.storage.updateTableStatus(table.id, 'occupied');
        }
      } else {
        const locationInfo = digitalOrder.floorNumber 
          ? `${digitalOrder.tableNumber} on floor ${digitalOrder.floorNumber}`
          : digitalOrder.tableNumber;
        console.warn(`⚠️  Table ${locationInfo} not found in POS system`);
      }
    }

    const orderStatus = digitalOrder.paymentStatus === 'paid' ? 'billed' : 'active';

    const posOrder = await this.storage.createOrder({
      tableId: tableId,
      orderType: 'dine-in',
      status: orderStatus,
      total: '0',
      customerName: digitalOrder.customerName,
      customerPhone: digitalOrder.customerPhone,
      customerAddress: null,
      paymentMode: digitalOrder.paymentMethod || null,
      waiterId: null,
      deliveryPersonId: null,
      expectedPickupTime: null,
    });

    if (tableId) {
      await this.storage.updateTableOrder(tableId, posOrder.id);
    }

    let calculatedSubtotal = 0;

    for (const item of digitalOrder.items || []) {
      const menuItem = await this.findMenuItemByName(item.menuItemName);
      
      const notes = [
        item.notes,
        item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      ].filter(Boolean).join(' | ') || null;

      const itemPrice = (item.price || 0).toFixed(2);
      calculatedSubtotal += (item.price || 0) * (item.quantity || 0);

      await this.storage.createOrderItem({
        orderId: posOrder.id,
        menuItemId: menuItem?.id || 'unknown',
        name: item.menuItemName,
        quantity: item.quantity,
        price: itemPrice,
        notes: notes,
        status: 'new',
        isVeg: menuItem?.isVeg ?? true,
      });
    }

    const orderTotal = (digitalOrder.total || 0).toFixed(2);
    const calculatedTotal = (calculatedSubtotal + (digitalOrder.tax || 0)).toFixed(2);
    
    if (Math.abs(parseFloat(orderTotal) - parseFloat(calculatedTotal)) > 0.01) {
      console.warn(`⚠️  Order total mismatch for ${digitalOrder.customerName}: Digital Menu=${orderTotal}, Calculated=${calculatedTotal}`);
    }

    await this.storage.updateOrderTotal(posOrder.id, orderTotal);

    await this.markOrderAsSynced(digitalOrder._id, posOrder.id);
  }

  private async findTableByNumberAndFloor(tableNumber: string, floorNumber?: string): Promise<any | undefined> {
    const tables = await this.storage.getTables();
    
    if (floorNumber) {
      const floors = await this.storage.getFloors();
      const floor = floors.find(f => 
        f.name.toLowerCase() === floorNumber.toLowerCase()
      );
      
      if (floor) {
        const matchingTable = tables.find(t => 
          t.tableNumber === tableNumber && t.floorId === floor.id
        );
        
        if (matchingTable) {
          return matchingTable;
        }
      }
      
      console.warn(`⚠️  Floor "${floorNumber}" not found, searching all floors for table ${tableNumber}`);
    }
    
    const matchingTables = tables.filter(t => t.tableNumber === tableNumber);
    
    if (matchingTables.length > 1) {
      console.warn(`⚠️  Multiple tables with number "${tableNumber}" found on different floors. Using first match.`);
    }
    
    return matchingTables[0];
  }

  private async updatePOSOrderStatus(digitalOrder: any): Promise<void> {
    try {
      // Get the stored POS order ID from the digital menu order
      if (!digitalOrder.posOrderId) {
        console.warn(`⚠️  No POS order ID linked to digital menu order ${digitalOrder._id}`);
        return;
      }

      // Fetch the POS order
      const posOrder = await this.storage.getOrder(digitalOrder.posOrderId);
      if (!posOrder) {
        console.warn(`⚠️  POS order ${digitalOrder.posOrderId} not found`);
        return;
      }

      // Map digital menu status to POS order item status
      const statusMapping: Record<string, string> = {
        'pending': 'new',
        'confirmed': 'new',
        'preparing': 'preparing',
        'completed': 'served',
        'cancelled': 'served' // Mark as served to remove from active
      };

      const newItemStatus = statusMapping[digitalOrder.status] || 'new';

      // Update all order items for this order
      const orderItems = await this.storage.getOrderItems(posOrder.id);
      for (const item of orderItems) {
        if (item.status !== newItemStatus) {
          await this.storage.updateOrderItemStatus(item.id, newItemStatus as any);
        }
      }

      console.log(`✅ Updated POS order ${posOrder.id} items to status: ${newItemStatus} (from digital menu status: ${digitalOrder.status})`);
    } catch (error) {
      console.error(`❌ Failed to update POS order status:`, error);
    }
  }

  private async markOrderAsSynced(orderId: string, posOrderId: string): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection('digital_menu_customer_orders');
      
      // Convert string ID to ObjectId for proper MongoDB matching
      const result = await collection.updateOne(
        { _id: new ObjectId(orderId) },
        { 
          $set: { 
            syncedToPOS: true,
            syncedAt: new Date(),
            posOrderId: posOrderId
          } 
        }
      );

      if (result.modifiedCount === 0) {
        console.warn(`⚠️  Failed to mark order ${orderId} as synced - no document matched`);
      }
    } catch (error) {
      console.error(`❌ Failed to mark order ${orderId} as synced:`, error);
    }
  }

  private async findMenuItemByName(name: string): Promise<any | undefined> {
    const menuItems = await this.storage.getMenuItems();
    return menuItems.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    );
  }

  async getDigitalMenuOrders(): Promise<DigitalMenuOrder[]> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuOrder>('digital_menu_customer_orders');
      const orders = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return orders.map(order => ({
        ...order,
        _id: order._id.toString()
      }));
    } catch (error) {
      console.error('❌ Error fetching digital menu orders:', error);
      return [];
    }
  }

  async getDigitalMenuCustomers(): Promise<DigitalMenuCustomer[]> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection<DigitalMenuCustomer>('customers');
      const customers = await collection.find({ loginStatus: 'loggedin' }).toArray();
      return customers.map(customer => ({
        ...customer,
        _id: customer._id.toString()
      }));
    } catch (error) {
      console.error('❌ Error fetching digital menu customers:', error);
      return [];
    }
  }

  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      processedOrders: this.processedOrderIds.size,
    };
  }
}
