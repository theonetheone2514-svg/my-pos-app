import React, { useState } from 'react';

function CreditPaymentModal({ isOpen, onClose, onPay, customer, totalDebt }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const remaining = totalDebt - (parseFloat(amount) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) return alert('กรุณากรอกจำนวนเงินที่ถูกต้อง');
    if (payAmount > totalDebt) return alert('จำนวนเงินเกินยอดหนี้คงค้าง');
    setSaving(true);
    try {
      await onPay({ customerId: customer.id, amount: payAmount, note: note.trim() });
      setAmount('');
      setNote('');
      onClose();
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1100
  };
  const modalStyle = {
    backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '16px',
    minWidth: '380px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
  };
  const inputStyle = {
    width: '100%', padding: '12px', backgroundColor: '#121212', color: 'white',
    border: '1px solid #444', borderRadius: '8px', marginBottom: '12px',
    boxSizing: 'border-box'
  };
  const btnPrimary = {
    flex: 1, backgroundColor: '#10b981', color: 'white', border: 'none',
    padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
  };
  const btnCancel = {
    flex: 1, backgroundColor: '#666', color: 'white', border: 'none',
    padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>💰 บันทึกการชำระหนี้</h3>
        <div style={{ marginBottom: '15px', color: '#aaa' }}>
          <div><strong style={{ color: '#e0e0e0' }}>ลูกค้า:</strong> {customer?.name}</div>
          <div><strong style={{ color: '#e0e0e0' }}>ยอดหนี้คงค้าง:</strong> <span style={{ color: '#f44336', fontWeight: 'bold' }}>฿{totalDebt.toLocaleString()}</span></div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="number" step="0.01" placeholder="จำนวนเงินที่ชำระ *" value={amount}
            onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus
          />
          {amount > 0 && (
            <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: remaining > 0 ? '#f59e0b' : '#10b981' }}>
              คงเหลือ: ฿{remaining.toLocaleString()}
            </div>
          )}
          <input
            type="text" placeholder="หมายเหตุ (เช่น จ่ายวันที่ ...)" value={note}
            onChange={(e) => setNote(e.target.value)} style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" disabled={saving} style={btnPrimary}>
              {saving ? 'กำลังบันทึก...' : '💾 บันทึกการชำระ'}
            </button>
            <button type="button" onClick={onClose} style={btnCancel}>ยกเลิก</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreditPaymentModal;
