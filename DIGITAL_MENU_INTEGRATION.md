# Digital Menu Integration with POS System

## Overview

The POS system now automatically syncs orders from your Digital Menu application. Both systems share the same MongoDB database (`restaurant_pos`), allowing seamless order flow from customer devices to the POS system.

## How It Works

### 1. **Automatic Background Sync**
- The sync service starts automatically when the POS server starts
- Polls the `digital_menu_customer_orders` collection every 5 seconds
- Detects new orders (status: 'pending' or 'confirmed') that haven't been synced
- Converts them to POS orders automatically
- Links orders to the correct table using both tableNumber AND floorNumber
- Marks orders as synced in MongoDB (adds `syncedToPOS: true` flag)
- Validates order totals and logs warnings if mismatches detected

### 2. **Order Flow**
```
Digital Menu (Customer Orders) 
    ↓
MongoDB Collection: digital_menu_customer_orders
    ↓
Sync Service (Automatic Detection)
    ↓
POS Orders & Order Items
    ↓
Visible in POS System (Tables, Kitchen Display, etc.)
```

### 3. **Data Mapping**
The sync service converts digital menu orders to POS format:

| Digital Menu Field | POS System Field | Notes |
|-------------------|------------------|-------|
| customerName | Order.customerName | Exact copy |
| customerPhone | Order.customerPhone | Exact copy |
| tableNumber + floorNumber | Table.id (via lookup) | Matches both table number and floor |
| items[].menuItemName | OrderItem.name | Exact copy |
| items[].quantity | OrderItem.quantity | Exact copy |
| items[].price | OrderItem.price | Per-item price |
| items[].spiceLevel | OrderItem.notes | Combined with notes |
| items[].notes | OrderItem.notes | Combined with spice level |
| total | Order.total | Validated against calculated total |
| subtotal | Used for validation | Not stored separately |
| tax | Used for validation | Not stored separately |
| paymentStatus | Order.status | 'paid' → 'billed', else 'active' |
| paymentMethod | Order.paymentMode | Exact copy |

## API Endpoints

### Check Sync Status
```bash
GET /api/digital-menu/status
```
Returns: `{ "isRunning": true, "processedOrders": 5 }`

### Manual Sync Trigger
```bash
POST /api/digital-menu/sync-now
```
Manually triggers an immediate sync check.

### View Digital Menu Orders
```bash
GET /api/digital-menu/orders
```
Returns all orders from the digital menu collection.

### View Digital Menu Customers
```bash
GET /api/digital-menu/customers
```
Returns all logged-in customers from the digital menu.

### Start/Stop Sync Service
```bash
POST /api/digital-menu/sync-start
POST /api/digital-menu/sync-stop
```

## How to Use

### For Manual Orders (Handler/Staff)
1. Continue using the POS as normal
2. Click tables, add items, send to kitchen - nothing changes
3. Your manual orders work exactly as before

### For Digital Menu Orders (Customers)
1. Customer logs into digital menu on their device
2. Customer selects table and floor
3. Customer adds items to cart and places order
4. **Within 5 seconds**, the order automatically appears in POS
5. Order shows up in:
   - Tables page (table status updates to occupied/preparing)
   - Kitchen Display (order items appear for cooking)
   - Billing page (if you navigate to that table)

## MongoDB Collection Structure

The system expects digital menu orders in this exact format (as per documentation):

```javascript
// Collection: digital_menu_customer_orders
{
  "_id": ObjectId,
  "customerId": ObjectId,              // Reference to customers collection
  "customerName": String,
  "customerPhone": String,             // 10 digits
  "items": [
    {
      "menuItemId": String,
      "menuItemName": String,
      "quantity": Number,
      "price": Number,
      "total": Number,
      "spiceLevel": String,            // 'no-spicy' | 'less-spicy' | 'regular' | 'more-spicy'
      "notes": String                  // Optional - special instructions
    }
  ],
  "subtotal": Number,
  "tax": Number,
  "total": Number,
  "status": String,                    // 'pending' | 'confirmed' | 'preparing' | 'completed' | 'cancelled'
  "paymentStatus": String,             // 'pending' | 'paid' | 'failed'
  "paymentMethod": String,             // Optional
  "tableNumber": String,               // Optional - Table number where customer is seated
  "floorNumber": String,               // Optional - Floor name/number
  "orderDate": Date,                   // IST timezone - when order was placed
  "createdAt": Date,                   // IST timezone - when record was created
  "updatedAt": Date                    // IST timezone - when record was last updated
}
```

**Note:** Each document represents a complete order. When a customer places an order through the digital menu, it creates a new document with all these fields populated.

## Troubleshooting

### Orders Not Syncing?
1. Check sync status: `GET /api/digital-menu/status`
2. Verify orders exist: `GET /api/digital-menu/orders`
3. Check server logs for error messages
4. Manually trigger sync: `POST /api/digital-menu/sync-now`

### Table Not Found?
- Ensure the table exists in POS with the same table number
- Table numbers must match exactly (case-sensitive)

### Menu Items Not Found?
- Sync service will create order items even if menu item not found
- Item will be marked as "Unknown Item" with the name from digital menu
- Consider syncing menu items to MongoDB first

## Notes

- **Sync is automatic** - No manual action needed for most cases
- **Duplicate prevention** - Same order won't be synced twice
- **Real-time updates** - POS updates via WebSocket when new orders arrive
- **No interference** - Manual POS orders work completely independently

## Testing

To test the integration:

1. Add an order to digital menu customer card in MongoDB
2. Wait up to 5 seconds
3. Check POS Tables page - table should update
4. Check Kitchen Display - order should appear
5. Check Billing - order details should be visible

---

**Integration Status**: ✅ Active and Running

Last Updated: November 14, 2025
