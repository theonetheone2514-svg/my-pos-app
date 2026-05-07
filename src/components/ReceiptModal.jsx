import React from 'react';

// คอมโพเนนต์แสดงใบเสร็จ (รับค่าผ่าน props)
function ReceiptModal({ isOpen, onClose, sale, saleItems, settings }) {
  if (!isOpen) return null;

  const total = saleItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#fff',
        color: '#222',
        padding: '20px',
        borderRadius: '12px',
        width: '320px',
        fontFamily: '"Itim", cursive',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* หัวใบเสร็จ */}
        {settings.logo_url && (
          <img src={settings.logo_url} alt="โลโก้ร้าน" style={{ width: '80px', display: 'block', margin: '0 auto 10px' }} />
        )}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <strong style={{ fontSize: '1.4rem' }}>{settings.shop_name}</strong>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>{settings.shop_address}</div>
          <div style={{ fontSize: '0.9rem', color: '#555' }}>{settings.shop_phone}</div>
        </div>
        <hr style={{ border: '0', borderTop: '1px solid #ddd', margin: '12px 0' }} />

        {/* รายการสินค้า */}
        <div style={{ fontSize: '0.9rem' }}>
          {saleItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>{item.product_name}</span>
              <span>฿{(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #ddd', margin: '12px 0' }} />

        {/* ยอดรวม */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '8px' }}>
          <span>ยอดรวม:</span>
          <span>฿{total.toFixed(2)}</span>
        </div>

        {/* ข้อความท้ายใบเสร็จ */}
        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666' }}>
          {settings.footer_text}
        </div>

        {/* ปุ่มปิดและพิมพ์ */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#eee',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>ปิด</button>
          <button onClick={() => window.print()} style={{
            flex: 1,
            padding: '8px',
            backgroundColor: '#2c3e50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>พิมพ์</button>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;