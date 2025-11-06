import type { Order, OrderItem, Invoice } from "@shared/schema";

interface PrintableInvoiceProps {
  invoice: Invoice | null;
  order: Order | null;
  orderItems: OrderItem[];
  onPrintComplete: () => void;
}

export default function PrintableInvoice({ invoice, order, orderItems, onPrintComplete }: PrintableInvoiceProps) {
  if (!invoice || !order || orderItems.length === 0) {
    return null;
  }

  const subtotal = parseFloat(invoice.subtotal);
  const tax = parseFloat(invoice.tax);
  const total = parseFloat(invoice.total);

  return (
    <div className="print-invoice">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-invoice, .print-invoice * {
            visibility: visible;
          }
          .print-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
        .print-invoice {
          position: fixed;
          left: -9999px;
          top: 0;
          background: white;
          width: 80mm;
          max-width: 100%;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
        }
        .print-invoice.printing {
          left: 0;
          z-index: 9999;
        }
      `}</style>
      
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold' }}>Restaurant POS</h2>
        <p style={{ margin: '2px 0', fontSize: '10px' }}>123 Main Street, City, State 12345</p>
        <p style={{ margin: '2px 0', fontSize: '10px' }}>Phone: +1 (555) 123-4567</p>
        <p style={{ margin: '2px 0', fontSize: '10px' }}>GSTIN: GSTIN1234567890</p>
      </div>

      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <h3 style={{ margin: '5px 0', fontSize: '16px', fontWeight: 'bold' }}>
          {order.orderType === "delivery" ? "DELIVERY INVOICE" : 
           order.orderType === "pickup" ? "PICKUP INVOICE" : "DINE-IN INVOICE"}
        </h3>
      </div>

      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Invoice No: {invoice.invoiceNumber}</span>
          <span>{new Date(invoice.createdAt!).toLocaleString()}</span>
        </div>
        
        {order.orderType === "dine-in" && invoice.tableNumber && (
          <div style={{ marginTop: '5px' }}>
            <span>Table: {invoice.tableNumber}</span>
            {invoice.floorName && <span> | Floor: {invoice.floorName}</span>}
          </div>
        )}
        
        {(order.orderType === "delivery" || order.orderType === "pickup") && invoice.customerName && (
          <>
            <div style={{ marginTop: '5px' }}>
              <span>Customer: {invoice.customerName}</span>
            </div>
            {invoice.customerPhone && (
              <div style={{ marginTop: '2px' }}>
                <span>Phone: {invoice.customerPhone}</span>
              </div>
            )}
            {order.orderType === "delivery" && order.customerAddress && (
              <div style={{ marginTop: '2px' }}>
                <span>Address: {order.customerAddress}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '3px 0' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '3px 0', width: '40px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '3px 0', width: '60px' }}>Price</th>
              <th style={{ textAlign: 'right', padding: '3px 0', width: '60px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item, index) => (
              <tr key={index} style={{ borderTop: index > 0 ? '1px dotted #ccc' : 'none' }}>
                <td style={{ padding: '3px 0' }}>
                  {item.name} {item.isVeg ? "🌱" : ""}
                </td>
                <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{parseFloat(item.price).toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '3px 0' }}>
                  ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Subtotal:</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Tax (5%):</span>
          <span>₹{tax.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #000', marginTop: '5px' }}>
          <span>Grand Total:</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Mode: {invoice.paymentMode?.toUpperCase() || "CASH"}</span>
          <span style={{ fontWeight: 'bold' }}>PAID</span>
        </div>
      </div>

      {order.orderType === "delivery" && (
        <div style={{ marginTop: '15px', fontSize: '9px', fontStyle: 'italic', textAlign: 'center' }}>
          This is a delivery order. Please ensure items are delivered to the customer address.
        </div>
      )}
      
      {order.orderType === "pickup" && (
        <div style={{ marginTop: '15px', fontSize: '9px', fontStyle: 'italic', textAlign: 'center' }}>
          This is a pickup order. Customer will collect the items from the restaurant.
        </div>
      )}

      <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '10px' }}>
        <p style={{ margin: '3px 0', fontSize: '10px' }}>Thank you for your business!</p>
        <p style={{ margin: '3px 0', fontSize: '9px' }}>
          This is a computer-generated invoice and does not require a signature.
        </p>
      </div>
    </div>
  );
}
