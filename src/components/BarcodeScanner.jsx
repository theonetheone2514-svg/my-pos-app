// BarcodeScanner.js - React component for barcode scanning with mode selection
import React, { useState, useEffect, useRef } from 'react';

const BarcodeScanner = ({ onScan, mode, setMode }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [latestCode, setLatestCode] = useState('');
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const videoStream = useRef(null);

  // Initialize scanner when component mounts or mode changes
  useEffect(() => {
    if (mode === 'sell' || mode === 'stock') {
      // Reset state when mode changes
      setIsScanning(false);
      setLatestCode('');
      setError('');
    }
  }, [mode]);

  const startScanning = async () => {
    try {
      // Initialize scanner if not already created
      if (!qrRef.current) {
        qrRef.current = new Html5Qrcode("reader");
      }

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      await qrRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          setLatestCode(decodedText);
          handleScanResult(decodedText);
        },
        (error) => {
          // Error handling for scan failures
          console.warn('QR scanning warning:', error);
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start scanner:', err);
      alert('ไม่สามารถเปิดกล้องได้: ' + err.message);
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    
    // Stop video stream
    if (videoStream.current) {
      videoStream.current.getTracks().forEach(track => track.stop());
      videoStream.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setLatestCode('');
    setError('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  if (mode !== 'sell' && mode !== 'stock') {
    return null;
  }

  return (
     <div 
       style={{
         backgroundColor: '#1e1e1e',
         padding: '15px',
         borderRadius: '12px',
         border: '1px solid #333',
         textAlign: 'center',
         width: '100%',
         maxWidth: '300px'
       }}
     >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0 }}>📷 สแกนบาร์โค้ด</h3>
        <button 
          onClick={() => setMode(mode === 'sell' ? 'stock' : 'sell')}
          style={{
            padding: '4px 8px',
            fontSize: '0.9rem',
            borderRadius: '4px',
            backgroundColor: mode === 'sell' ? '#10b981' : '#3b82f6',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {mode === 'sell' ? 'โหมด: ขาย' : 'โหมด: รับสินค้า'}
        </button>
      </div>
      
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.9rem', marginBottom: '10px' }}>
          {error}
        </p>
      )}
      
      {isScanning ? (
        <>
          <p style={{ color: '#10b981', fontSize: '0.9rem', marginBottom: '8px' }}>
            กำลังสแกน… ชี้กล้องไปที่บาร์โค้ด
          </p>
          <div 
            id="reader" 
            style={{ 
              marginBottom: '10px', 
              width: '100%', 
              height: '250px',
              backgroundColor: '#000'
            }}
          />
          {latestCode && (
            <p 
              style={{ 
                marginBottom: '8px', 
                fontSize: '0.9rem', 
                wordBreak: 'break-all', 
                color: '#60a5fa' 
              }}
            >
              สแกนได้: {latestCode}
            </p>
          )}
          <button 
            onClick={stopScanning}
            style={{
              marginTop: '8px',
              backgroundColor: '#450a0a',
              color: '#f87171',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            หยุดสแกน
          </button>
        </>
      ) : (
        <button 
          onClick={startScanning}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📷 สแกนด้วยกล้อง
        </button>
      )}
    </div>
  );
};

export default BarcodeScanner;