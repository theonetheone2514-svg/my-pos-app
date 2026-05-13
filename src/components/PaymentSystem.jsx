import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function PaymentSystem({ cart, onClose, onComplete, settings }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashAmount, setCashAmount] = useState('');
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleProcessPayment = async () => {
    try {
      // First, create the sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          total_amount: totalAmount,
          payment_method: paymentMethod,
          status: 'completed'
        })
        .select()
        .single();

      if (saleError) {
        console.error('Error creating sale:', saleError);
        return;
      }

      // Then create sale items
      for (const item of cart) {
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: saleData.id,
            product_id: item.id,
            quantity: item.qty,
            price_per_unit: item.price,
            subtotal: item.price * item.qty
          });

        if (itemError) {
          console.error('Error creating sale item:', itemError);
        }
      }

      // Update inventory for all items in cart
      for (const item of cart) {
        const newStock = (item.inventory?.[0]?.current_stock || 0) - item.qty;
        const { error } = await supabase
          .from('inventory')
          .update({ current_stock: newStock })
          .eq('product_id', item.id);

        if (error) {
          console.error('Inventory update error:', error);
        }
      }

      // Call the onComplete callback with the sale data
      onComplete(saleData);
    } catch (error) {
      console.error('Payment processing error:', error);
    }
  };

  const calculateChange = () => {
    if (!cashAmount) return 0;
    return parseFloat(cashAmount) - totalAmount;
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#1e1e1e',
      padding: '20px',
      borderRadius: '10px',
      border: '1px solid #333',
      zIndex: 1000,
      color: 'white',
      minWidth: '300px'
    }}>
      <h3>ชำระเงิน</h3>
      <div style={{ marginTop: '15px' }}>
        <p>จำนวนเงินที่ต้องชำระ: ฿{totalAmount.toLocaleString()}</p>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={() => setPaymentMethod('cash')}
            style={{
              backgroundColor: paymentMethod === 'cash' ? '#4CAF50' : '#333',
              color: paymentMethod === 'cash' ? 'white' : '#aaa'
            }}
          >
            💵 ชำระเงินสด
          </button>
          <button 
            onClick={() => setPaymentMethod('qr')}
            style={{
              backgroundColor: paymentMethod === 'qr' ? '#2196F3' : '#333',
              color: paymentMethod === 'qr' ? 'white' : '#aaa'
            }}
          >
            📱 สแกนจ่าย
          </button>
        </div>
        
        {paymentMethod === 'cash' && (
          <div style={{ marginTop: '15px' }}>
            <input 
              type="number" 
              placeholder="จำนวนเงินที่ลูกค้าจ่าย" 
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              style={{ 
                backgroundColor: '#121212', 
                color: 'white', 
                border: '1px solid #444', 
                padding: '10px',
                borderRadius: '5px',
                width: '100%'
              }}
            />
            {cashAmount && (
              <p style={{ marginTop: '10px' }}>
                เงินทอน: ฿{calculateChange().toFixed(2)}
              </p>
            )}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button 
            onClick={handleProcessPayment}
            style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '10px', borderRadius: '5px' }}
          >
            ยืนยัน
          </button>
          <button 
            onClick={onClose}
            style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '10px', borderRadius: '5px' }}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentSystem;