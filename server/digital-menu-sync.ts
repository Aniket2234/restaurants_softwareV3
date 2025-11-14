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
        _id: { $nin: Array.from(this.processedOrderIds) }
      }).toArray();

      let synced = 0;
      for (const digitalOrder of unprocessedOrders) {
        try {
          await this.convertAndCreatePOSOrder(digitalOrder);
          this.processedOrderIds.add(digitalOrder._id.toString());
          synced++;
          console.log(`✅ Synced digital menu order ${digitalOrder._id} for ${digitalOrder.customerName}`);
        } catch (error) {
          console.error(`❌ Failed to sync order ${digitalOrder._id}:`, error);
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

    if (digitalOrder.tableNumber && digitalOrder.floorNumber) {
      const table = await this.storage.getTableByNumber(digitalOrder.tableNumber);
      if (table) {
        tableId = table.id;
        
        if (table.status === 'free') {
          await this.storage.updateTableStatus(table.id, 'occupied');
        }
      } else {
        console.warn(`⚠️  Table ${digitalOrder.tableNumber} not found in POS system`);
      }
    }

    const posOrder = await this.storage.createOrder({
      tableId: tableId,
      orderType: 'dine-in',
      status: 'active',
      total: digitalOrder.total.toFixed(2),
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

    for (const item of digitalOrder.items) {
      const menuItem = await this.findMenuItemByName(item.menuItemName);
      
      const notes = [
        item.notes,
        item.spiceLevel ? `Spice: ${item.spiceLevel}` : null
      ].filter(Boolean).join(' | ') || null;

      await this.storage.createOrderItem({
        orderId: posOrder.id,
        menuItemId: menuItem?.id || 'unknown',
        name: item.menuItemName,
        quantity: item.quantity,
        price: item.price.toFixed(2),
        notes: notes,
        status: 'new',
        isVeg: menuItem?.isVeg ?? true,
      });
    }

    await this.storage.updateOrderTotal(posOrder.id, digitalOrder.total.toFixed(2));
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
