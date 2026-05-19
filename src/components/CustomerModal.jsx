import React, { useState } from 'react';

function CustomerModal({ isOpen, onClose, onSave, initial }) {
  const [name, setName] = useState(initial?.name || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('กรุณากรอกชื่อลูกค้า');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone: phone.trim(), address: address.trim() });
      setName('');
      setPhone('');
      setAddress('');
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
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          {initial ? '✏️ แก้ไขลูกค้า' : '👤 เพิ่มลูกค้าใหม่'}
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text" placeholder="ชื่อลูกค้า *" value={name}
            onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus
          />
          <input
            type="text" placeholder="เบอร์โทรศัพท์" value={phone}
            onChange={(e) => setPhone(e.target.value)} style={inputStyle}
          />
          <input
            type="text" placeholder="ที่อยู่" value={address}
            onChange={(e) => setAddress(e.target.value)} style={inputStyle}
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button type="submit" disabled={saving} style={btnPrimary}>
              {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
            <button type="button" onClick={onClose} style={btnCancel}>ยกเลิก</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerModal;
