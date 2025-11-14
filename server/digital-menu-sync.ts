import { mongodb } from './mongodb';
import { type DigitalMenuOrder, type DigitalMenuCustomer } from '@shared/schema';
import { type IStorage } from './storage';

export class DigitalMenuSyncService {
  private storage: IStorage;
  private syncInterval: NodeJS.Timeout | null = null;
  private processedOrderIds: Set<string> = new Set();
  private isRunning = false;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async start(intervalMs: number = 5000): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Digital menu sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting digital menu sync service...');
    
    await this.syncOrders();
    
    this.syncInterval = setInterval(async () => {
      await this.syncOrders();
    }, intervalMs);

    console.log(`✅ Digital menu sync service started (polling every ${intervalMs / 1000}s)`);
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
          synced++;
          console.log(`✅ Synced digital menu order ${orderId} for ${digitalOrder.customerName}`);
        } catch (error) {
          console.error(`❌ Failed to sync order ${orderId}:`, error);
        }
      }

      if (synced > 0) {
        console.log(`📊 Synced ${synced} new digital menu order(s)`);
      }

      return synced;
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

    for (const item of digitalOrder.items) {
      const menuItem = await this.findMenuItemByName(item.menuItemName);
      
      const notes = [
        item.notes,
        item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      ].filter(Boolean).join(' | ') || null;

      const itemPrice = item.price.toFixed(2);
      calculatedSubtotal += item.price * item.quantity;

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

    const orderTotal = digitalOrder.total.toFixed(2);
    const calculatedTotal = (calculatedSubtotal + digitalOrder.tax).toFixed(2);
    
    if (Math.abs(parseFloat(orderTotal) - parseFloat(calculatedTotal)) > 0.01) {
      console.warn(`⚠️  Order total mismatch for ${digitalOrder.customerName}: Digital Menu=${orderTotal}, Calculated=${calculatedTotal}`);
    }

    await this.storage.updateOrderTotal(posOrder.id, orderTotal);

    await this.markOrderAsSynced(digitalOrder._id);
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

  private async markOrderAsSynced(orderId: string): Promise<void> {
    try {
      await mongodb.connect();
      const collection = mongodb.getCollection('digital_menu_customer_orders');
      
      await collection.updateOne(
        { _id: orderId as any },
        { 
          $set: { 
            syncedToPOS: true,
            syncedAt: new Date()
          } 
        }
      );
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
