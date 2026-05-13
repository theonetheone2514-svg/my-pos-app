import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5Qrcode } from 'html5-qrcode';
import ReactApexChart from 'react-apexcharts';

import ReceiptModal from './components/ReceiptModal';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true } }
);

// Debug: ตรวจสอบค่า environment variables
console.log('Supabase Config:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 10) + '...' + import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(import.meta.env.VITE_SUPABASE_ANON_KEY.length - 10)
});

function App() {
  const [view, setView] = useState('pos');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');

  // สแกนบาร์โค้ด
  const [scanMode, setScanMode] = useState('sell'); // 'sell' = ขาย, 'stock' = รับสต็อก, 'scanner' = HID scanner
  const [isScanning, setIsScanning] = useState(false);
  const [latestCode, setLatestCode] = useState('');
  const qrRef = useRef(null);
  const scannerInputRef = useRef(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scannerConnected, setScannerConnected] = useState(true); // ตรวจสอบว่า scanner เปิดอยู่หรือไม่
  const [scanSource, setScanSource] = useState('camera'); // 'camera', 'scanner'

  // Receipt
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [settings, setSettings] = useState({});

  // Profit dashboard state
  const [filterStartDate, setFilterStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [topProducts, setTopProducts] = useState([]);
  const [dateRangeData, setDateRangeData] = useState([]); // For ApexCharts

  // Load initial data
  useEffect(() => {
    fetchProducts();
    fetchSalesHistory();
    fetchSettings();
    // Fetch all sales for profit analysis
    fetchAllSalesForProfit();
  }, []);

  // Update profit data when date range changes
  useEffect(() => {
    if (filterStartDate && filterEndDate) {
      calculateProfitFromSales();
    }
  }, [filterStartDate, filterEndDate, salesHistory]);

  // ==================== HID Barcode Scanner Support ====================
  useEffect(() => {
    // ตั้งค่าให้ scanner input อัตโนมัติโฟกัสเมื่อเปิด POS
    if (view === 'pos' && scanSource === 'scanner') {
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    }

    // Function สำหรับจัดการ barcode from scanner
    const handleScannerInput = (e) => {
      // ถ้าไม่ใช่ scanner input หรือไม่ได้เปิด scanner mode → ข้ามไป
      if (scanSource !== 'scanner') return;

      // ถ้าเป็น Enter key → ส่ง barcode
      if (e.key === 'Enter') {
        const code = barcodeBuffer.trim();
        if (code.length > 0) {
          setLatestCode(code);
          handleScanResult(code);
          setBarcodeBuffer('');
          setLastScanTime(Date.now());
        }
        e.preventDefault();
      }
      // ถ้าเป็น backspace → ลบตัวอักษร
      else if (e.key === 'Backspace') {
        setBarcodeBuffer(prev => prev.slice(0, -1));
      }
      // ถ้าเป็นตัวอักษรหรือตัวเลข → เก็บไว้
      else if (/^[a-zA-Z0-9\u0E00-\u0E7F]$/.test(e.key)) {
        // ถ้าเวลานี้น้อยกว่า 200ms 从严ก่อนหน้า → ให้ถือว่าเป็น barcode เดียวกัน
        if (Date.now() - lastScanTime < 200) {
          setBarcodeBuffer(prev => prev + e.key);
        } else {
          setBarcodeBuffer(e.key);
          setLastScanTime(Date.now());
        }
      }
    };

    // เพิ่ม event listener
    window.addEventListener('keydown', handleScannerInput);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleScannerInput);
    };
  }, [view, scanSource, barcodeBuffer, lastScanTime]);

  // ==================== Sales & Profit Functions ====================

  // Fetch all sales for profit calculation
  async function fetchAllSalesForProfit() {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sales:', error);
        return;
      }
      setSalesHistory(data || []);

      // โหลด sale_items ทั้งหมด
      const { data: items } = await supabase.from('sale_items').select('*');
      
      // โหลดสินค้าพร้อม cost_price
      const { data: productsWithCost } = await supabase
        .from('products')
        .select('id, name, price, cost_price');

      // Join และคำนวณกำไร
      processSalesData(data || [], items || [], productsWithCost || []);
    } catch (err) {
      console.error('Error:', err);
    }
  }

// Process sales data with profit calculation
  function processSalesData(sales, items, products) {
    // สร้าง Map ของสินค้าเพื่อดึง cost_price
    const productsMap = new Map(products.map(p => [p.id, p]));
    
    // แปลง items ให้ใช้ column ที่ถูกต้อง
    const normalizedItems = items.map(item => ({
      ...item,
      qty: item.quantity || item.qty || 1,
      price: item.price_per_unit || item.price || 0
    }));

    const salesWithProfit = sales.map(sale => {
      // ค้นหา sale items ที่เกี่ยวข้องกับ sale นี้
      const saleItems = normalizedItems.filter(i => i.sale_id === sale.id);
      let totalCost = 0;
      let totalRevenue = 0;

      // คำนวณต้นทุนและรายได้
      saleItems.forEach(item => {
        const product = productsMap.get(item.product_id);
        const costPrice = product?.cost_price || 0;
        const revenue = item.price * item.qty;
        const cost = costPrice * item.qty;
        totalRevenue += revenue;
        totalCost += cost;
      });

      const profit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        ...sale,
        total_cost: totalCost,
        total_revenue: totalRevenue,
        total_profit: profit,
        profit_margin: profitMargin,
        items: saleItems
      };
    });

    setProfitData(salesWithProfit);
    calculateProfitFromSales();
  }

  // Calculate profit statistics from date range
  function calculateProfitFromSales() {
    try {
      const start = new Date(filterStartDate);
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);

      const filtered = profitData.filter(sale => {
        if (!sale.created_at) return false;
        const saleDate = new Date(sale.created_at);
        return saleDate >= start && saleDate <= end;
      });

      const totalRevenue = filtered.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
      const totalCost = filtered.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const totalProfit = filtered.reduce((sum, s) => sum + (s.total_profit || 0), 0);
      const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

      // Daily profit data for chart
      const dailyData = {};
      filtered.forEach(sale => {
        const date = sale.created_at ? sale.created_at.split('T')[0] : '';
        if (date) {
          if (!dailyData[date]) dailyData[date] = 0;
          dailyData[date] += sale.total_profit || 0;
        }
      });

      // Convert to chart format
      const sortedDates = Object.keys(dailyData).sort();
      const chartSeries = sortedDates.map(date => ({
        x: date,
        y: Math.round(dailyData[date] * 100) / 100
      }));

      setDateRangeData(chartSeries);

      // Top products by profit
      const productProfits = {};
      filtered.forEach(sale => {
        sale.items?.forEach(item => {
          const productId = item.product_id;
          if (!productProfits[productId]) {
            productProfits[productId] = { total: 0, name: '', count: 0 };
          }
          const product = products.find(p => p.id === productId);
          const costPrice = product?.cost_price || 0;
          const profit = (item.price - costPrice) * item.qty;
          productProfits[productId].total += profit;
          productProfits[productId].name = product?.name || 'Unknown';
          productProfits[productId].count += item.qty;
        });
      });

      const sortedProducts = Object.entries(productProfits)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setTopProducts(sortedProducts);

    } catch (err) {
      console.error('Error calculating profit:', err);
    }
  }

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*').single();
      if (error || !data) {
        setSettings({
          shop_name: 'เอาหยังบ่',
          shop_address: '',
          shop_phone: '',
          logo_url: '',
          footer_text: 'ขอบคุณที่อุดหนุนร้านค้าท้องถิ่นของเรา นะจ๊ะ'
        });
        return;
      }
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSettings({
        shop_name: 'เอาหยังบ่',
        shop_address: '',
        shop_phone: '',
        logo_url: '',
        footer_text: 'ขอบคุณที่อุดหนุนร้านค้าท้องถิ่นของเรา นะจ๊ะ'
      });
    }
  };

  // Fetch Products
  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        inventory(id, current_stock),
        low_threshold,
        barcode,
        cost_price
      `)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      alert('ไม่สามารถโหลดสินค้าได้: ' + error.message);
      setProducts([]);
      return;
    }
    setProducts(data || []);
    checkLowStock(data || []);
  }

  // Fetch Sales History
  async function fetchSalesHistory() {
    const { data } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });
    setSalesHistory(data || []);
  }

  // ==================== View Sale Details ====================
  const viewSaleDetails = async (sale) => {
    setLoading(true);
    try {
      const { data: saleData } = await supabase
        .from('sales')
        .select('*')
        .eq('id', sale.id)
        .single();

      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('*, products(name, price)') // เปลี่ยนเป็น cost_price ด้วย
        .eq('sale_id', sale.id);

      setReceiptSale(saleData);
      setReceiptItems(itemsData || []);
      setShowReceipt(true);
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Stock Management ====================
  const updateStock = async (inventoryId, currentStock) => {
    const addAmount = window.prompt(`สต็อกปัจจุบัน: ${currentStock}\nต้องการเติมเพิ่มกี่ชิ้น?`);
    if (!addAmount) return;
    const numToAdd = parseInt(addAmount);
    if (isNaN(numToAdd) || numToAdd < 0) return alert('กรุณากรอกตัวเลขที่ถูกต้อง');
    setLoading(true);
    try {
      await supabase.from('inventory').update({ current_stock: currentStock + numToAdd }).eq('id', inventoryId);
      await recordMovement(inventoryId, numToAdd, 'restock');
      fetchProducts();
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const increaseStock = async (inventoryId, currentStock, amount) => {
    if (amount <= 0) return alert('จำนวนต้องมากกว่าศูนย์');
    setLoading(true);
    try {
      await supabase.from('inventory').update({ current_stock: currentStock + amount }).eq('id', inventoryId);
      await recordMovement(inventoryId, amount, 'restock');
      fetchProducts();
      alert(`เพิ่มสต็อก ${amount} ชิ้นเรียบร้อยแล้ว`);
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  // ==================== Add Product ====================
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice) return alert('กรอกข้อมูลให้ครบ');

    const costPrice = newProductCost ? parseFloat(newProductCost) : 0;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{ name: newProductName, price: parseFloat(newProductPrice), cost_price: costPrice }])
        .select();

      if (error) throw error;

      await supabase.from('inventory').insert([{ product_id: data[0].id, current_stock: 0 }]);

      setNewProductName('');
      setNewProductPrice('');
      setNewProductCost('');
      fetchProducts();
      alert('เพิ่มสินค้าเรียบร้อยแล้ว');
    } catch (err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleEditProduct = (p) => {
    setEditingProduct(p.id);
    setEditName(p.name);
    setEditPrice(p.price);
    setEditCost(p.cost_price || '');
  };

  const handleSaveEdit = async () => {
    if (!editName || !editPrice) return alert('กรอกข้อมูลให้ครบ');
    setLoading(true);
    try {
      await supabase.from('products').update({ name: editName, price: parseFloat(editPrice), cost_price: parseFloat(editCost) || 0 }).eq('id', editingProduct);
      setEditingProduct(null);
      fetchProducts();
      alert('แก้ไขสินค้าเรียบร้อยแล้ว');
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const handleDeleteProduct = async (productId, inventoryId) => {
    if (!confirm('⚠️ ต้องการลบสินค้านี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    setLoading(true);
    try {
      await supabase.from('inventory').delete().eq('id', inventoryId);
      await supabase.from('products').delete().eq('id', productId);
      fetchProducts();
      alert('ลบสินค้าเรียบร้อยแล้ว');
    } catch (err) { alert(err.message); }
    setLoading(false);
  };

  const recordMovement = async (productId, change, reason, referenceId = null) => {
    try {
      await supabase.from('stock_movements').insert({
        product_id: productId,
        change,
        reason,
        reference_id: referenceId,
      });
    } catch (err) {
      console.error('Failed to record stock movement:', err);
    }
  };

  const checkLowStock = (productsList) => {
    const lowStockItems = productsList.filter(
      p => (p.inventory?.[0]?.current_stock || 0) <= (p.low_threshold || 0)
    );
    if (lowStockItems.length > 0) {
      const names = lowStockItems.map(p => p.name).join(', ');
      alert(`⚠️ สินค้าต่อไปนี้มีสต็อกต่ำ: ${names}`);
    }
  };

  // ==================== Barcode Scanner ====================
  const startScanning = () => {
    if (qrRef.current) return;
    setIsScanning(true);

    const html5QrCode = new Html5Qrcode("reader");
    qrRef.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        setLatestCode(decodedText);
        handleScanResult(decodedText);
      },
      () => {}
    ).catch(err => {
      alert("ไม่สามารถเปิดกล้องได้: " + err);
      setIsScanning(false);
      qrRef.current = null;
    });
  };

  const stopScanning = () => {
    if (qrRef.current) {
      qrRef.current.stop().catch(console.error);
      qrRef.current = null;
    }
    setIsScanning(false);
    setLatestCode('');
  };

  const handleScanResult = (code) => {
    const product = products.find(p => p.barcode === code);
    if (!product) {
      alert(`ไม่พบสินค้าที่มีบาร์โค้ด: ${code}`);
      return;
    }

    if (scanMode === 'sell') {
      addToCart(product);
    } else if (scanMode === 'stock') {
      const amountInput = window.prompt(
        `สินค้า: ${product.name}\nสต็อกปัจจุบัน: ${product.inventory?.[0]?.current_stock || 0}\nต้องการเพิ่มสต็อกกี่ชิ้น?`
      );
      if (amountInput === null) return;
      const amount = parseInt(amountInput, 10);
      if (isNaN(amount) || amount <= 0) return alert("กรุณากรอกจำนวนเป็นจำนวนเต็มบวก");

      increaseStock(product.inventory[0].id, product.inventory[0].current_stock || 0, amount);
    }
  };

  // ==================== POS Logic ====================
  const addToCart = (product) => {
    const stock = product.inventory?.[0]?.current_stock || 0;
    const existing = cart.find(item => item.id === product.id);

    if (existing && existing.qty >= stock) return alert('สินค้าในสต็อกไม่พอ');
    if (!existing && stock <= 0) return alert('สินค้าหมด');

    setCart(prev =>
      existing
        ? prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...prev, { ...product, qty: 1 }]
    );
  };

  const updateCartQty = (id, amount) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const product = products.find(p => p.id === id);
          const stock = product?.inventory?.[0]?.current_stock || 0;
          const newQty = item.qty + amount;

          if (newQty > stock) {
            alert('ขออภัย สต็อกสินค้าไม่พอ');
            return item;
          }
          return newQty > 0 ? { ...item, qty: newQty } : item;
        }
        return item;
      })
    );
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    try {
      const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

      const { data, error } = await supabase.rpc('handle_checkout', {
        cart_items: cart,
        total_amount: totalAmount,
      });

      if (error) throw error;

      const saleId = data?.id;
      if (saleId) {
        for (const item of cart) {
          await recordMovement(item.id, -item.qty, 'sale', saleId);
        }

        const { data: saleData } = await supabase.from('sales').select('*').eq('id', saleId).single();
        const { data: itemsData } = await supabase
          .from('sale_items')
          .select('*, products(name, price)')
          .eq('sale_id', saleId);

        setReceiptSale(saleData);
        setReceiptItems(itemsData || []);
        setShowReceipt(true);
      }

      setCart([]);
      await fetchProducts();
      await fetchSalesHistory();
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการชำระเงิน: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Profit Dashboard Functions ====================
  const exportProfitCSV = () => {
    const headers = ['วันที่', 'รายได้', 'ต้นทุน', 'กำไร', 'อัตราส่วนกำไร(%)'];
    const rows = dateRangeData.map(d => {
      const daySales = profitData.filter(sale => {
        const saleDate = sale.created_at ? sale.created_at.split('T')[0] : '';
        return saleDate === d.x;
      });
      
      const total = daySales.reduce((acc, s) => ({
        revenue: acc.revenue + (s.total_revenue || 0),
        cost: acc.cost + (s.total_cost || 0),
        profit: acc.profit + (s.total_profit || 0)
      }), { revenue: 0, cost: 0, profit: 0 });
      
      const margin = total.revenue > 0 ? ((total.profit / total.revenue) * 100).toFixed(2) : 0;
      return [d.x, total.revenue.toFixed(2), total.cost.toFixed(2), total.profit.toFixed(2), margin];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `profit_report_${filterStartDate}_to_${filterEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== Apex Chart Configuration ====================
  const profitChartOptions = {
    chart: {
      height: 350,
      type: 'line',
      toolbar: {
        show: true
      },
      background: 'transparent'
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    xaxis: {
      type: 'category',
      categories: dateRangeData.map(d => d.x),
      title: {
        text: 'วันที่'
      }
    },
    yaxis: {
      title: {
        text: 'กำไร (บาท)'
      },
      labels: {
        formatter: (val) => val.toFixed(2)
      }
    },
    grid: {
      borderColor: '#333',
      strokeDashArray: 5
    },
    colors: ['#10b981', '#3b82f6'],
    tooltip: {
      y: {
        formatter: (val) => `฿${val.toFixed(2)}`
      }
    }
  };

  const profitChartSeries = [{
    name: 'กำไรสุทธิ',
    data: dateRangeData
  }];

  // ==================== Render View ====================
  // Filtered sales for dashboard (old view)
  const filteredSales = salesHistory.filter(sale => {
    if (!sale.created_at) return false;
    return new Date(sale.created_at).toISOString().split('T')[0] === filterDate;
  });

  const dailyTotal = filteredSales.reduce((sum, sale) => 
    sum + Number(sale.total_amount || sale.total_price || 0), 0
  );

  // Profit dashboard stats
  const profitStats = dateRangeData.reduce((acc, d) => {
    const dayData = profitData.filter(sale => sale.created_at?.split('T')[0] === d.x);
    return {
      revenue: acc.revenue + dayData.reduce((sum, s) => sum + (s.total_revenue || 0), 0),
      cost: acc.cost + dayData.reduce((sum, s) => sum + (s.total_cost || 0), 0),
      profit: acc.profit + dayData.reduce((sum, s) => sum + (s.total_profit || 0), 0),
      count: acc.count + dayData.length
    };
  }, { revenue: 0, cost: 0, profit: 0, count: 0 });

  const profitMargin = profitStats.revenue > 0 
    ? ((profitStats.profit / profitStats.revenue) * 100).toFixed(2) 
    : 0;

  // ==================== Styles ====================
  const navStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333' };
  const logoContainerStyle = { display: 'flex', alignItems: 'center', gap: '15px' };
  const cartIconStyle = { fontSize: '2.4rem' };
  const logoTextStyle = { margin: 0, fontSize: '1.9rem', fontWeight: '900', background: 'linear-gradient(45deg, #10b981, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  const logoStyle = { fontSize: '0.75rem', color: '#666' };

  const navBtnStyle = (active) => ({ padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: active ? '#10b981' : 'transparent', color: active ? 'white' : '#aaa', fontWeight: 'bold' });

  const cardStyle = { backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333', textAlign: 'center' };
  const lowStockStyle = { backgroundColor: '#2a1a1a', border: '2px solid #f44336', padding: '15px', borderRadius: '12px', textAlign: 'center' };

  const scannerContainerStyle = { backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333', width: '280px', textAlign: 'center' };
  const cartContainerStyle = { flex: 1, minWidth: '340px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', height: 'fit-content' };
  const cartItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #333' };

  const qtyBtnStyle = { width: '32px', height: '32px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' };
  const removeBtnStyle = { width: '32px', height: '32px', backgroundColor: '#450a0a', color: '#f87171', border: 'none', borderRadius: '6px', cursor: 'pointer' };
  const checkoutBtnStyle = { marginTop: '20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '10px', width: '100%', cursor: 'pointer' };
  const stopBtnStyle = { marginTop: '10px', backgroundColor: '#450a0a', color: '#f87171', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', width: '100%' };
  const addBtnStyle = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', width: '100%', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' };

  const statCardStyle = { flex: 1, backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '12px', border: '1px solid #333', textAlign: 'center' };
  const dateInputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#121212', color: 'white', margin: '0 10px' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#1e1e1e', borderRadius: '10px', overflow: 'hidden' };
  const rowStyle = { borderBottom: '1px solid #333', cursor: 'pointer' };

  const adminFormStyle = { display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' };
  const adminInputStyle = { flex: 1, padding: '12px', backgroundColor: '#121212', color: 'white', border: '1px solid #444', borderRadius: '8px', minWidth: '150px' };
  const adminAddBtnStyle = { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
  const stockBtnStyle = { backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' };

  const profitCardStyle = { backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333' };
  const exportBtnStyle = { marginTop: '20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', float: 'right' };

  return (
    <div style={{ backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={navStyle}>
        <div style={logoContainerStyle}>
          <span style={cartIconStyle}>🛒</span>
          <div>
            <h2 style={logoTextStyle}>เอาหยังบ่</h2>
            <div style={logoStyle}>SMART POS SYSTEM</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('pos')} style={navBtnStyle(view === 'pos')}>🛒 ขายสินค้า</button>
          <button onClick={() => setView('dashboard')} style={navBtnStyle(view === 'dashboard')}>📊 ยอดขาย</button>
          <button onClick={() => setView('profit')} style={navBtnStyle(view === 'profit')}>💰 กำไร</button>
          <button onClick={() => setView('admin')} style={navBtnStyle(view === 'admin')}>
            ⚙️ จัดการสินค้า
            {products.filter(p => (p.inventory?.[0]?.current_stock || 0) <= (p.inventory?.[0]?.min_stock_level || 0)).length > 0 && (
              <span style={{ backgroundColor: '#f44336', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', marginLeft: '6px' }}>
                ⚠️ {products.filter(p => (p.inventory?.[0]?.current_stock || 0) <= (p.inventory?.[0]?.min_stock_level || 0)).length}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div style={{ padding: '20px' }}>
        {/* ==================== POS VIEW ==================== */}
        {view === 'pos' && (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Product Grid */}
            <div style={{ flex: 2 }}>
              <input
                type="text"
                placeholder="🔍 พิมพ์ชื่อ/บาร์โค้ดสินค้า แล้วกด Enter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    const p = products.find(x =>
                      x.name.includes(searchTerm) || (x.barcode && x.barcode.includes(searchTerm))
                    );
                    if (p) addToCart(p);
                    setSearchTerm('');
                  }
                }}
                style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1e1e1e', color: 'white', width: '100%', marginBottom: '15px', fontSize: '1rem' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
              {products.map(p => {
                const currentStock = p.inventory?.[0]?.current_stock || 0;
                const isLowStock = currentStock <= (p.inventory?.[0]?.min_stock_level || 0);
                return (
                  <div key={p.id} style={isLowStock ? lowStockStyle : cardStyle}>
                    <h3>{p.name}</h3>
                    <p style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>฿{p.price}</p>
                    <p style={{ fontSize: '0.8rem', color: '#888' }}>
                      สต็อก: {currentStock} (ต่ำสุด: {p.inventory?.[0]?.min_stock_level})
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                      ต้นทุน: ฿{p.cost_price?.toFixed(2) || 0}
                    </p>
                    <button onClick={() => addToCart(p)} style={addBtnStyle}>+ เพิ่มลงตะกร้า</button>
                  </div>
                );
              })}
              </div>
            </div>

            {/* Scanner */}
            <div style={scannerContainerStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>📷 สแกนบาร์โค้ด</h3>
                <button onClick={() => setScanMode(scanMode === 'sell' ? 'stock' : 'sell')} style={{ fontSize: '0.8rem', padding: '5px 10px', backgroundColor: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', color: 'white' }}>
                  {scanMode === 'sell' ? 'โหมด: ขาย' : 'โหมด: รับสต็อก'}
                </button>
              </div>
              {isScanning ? (
                <>
                  <p style={{ color: '#10b981' }}>กำลังสแกน...</p>
                  <div id="reader" style={{ width: '100%', height: '250px' }}></div>
                  <button onClick={stopScanning} style={stopBtnStyle}>หยุดสแกน</button>
                </>
              ) : (
                <button onClick={startScanning} style={addBtnStyle}>📷 เปิดกล้องสแกน</button>
              )}
            </div>

            {/* Cart */}
            <div style={cartContainerStyle}>
              <h3>🛒 รายการในตะกร้า ({cart.length})</h3>
              {cart.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>ตะกร้าว่างเปล่า</p>}
              {cart.map(item => (
                <div key={item.id} style={cartItemStyle}>
                  <div style={{ flex: 1 }}>
                    <div>{item.name}</div>
                    <div style={{ color: '#10b981' }}>฿{(item.price * item.qty).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => updateCartQty(item.id, -1)} style={qtyBtnStyle}>-</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateCartQty(item.id, 1)} style={qtyBtnStyle}>+</button>
                    <button onClick={() => removeFromCart(item.id)} style={removeBtnStyle}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '20px', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'right' }}>
                รวมทั้งสิ้น: ฿{cart.reduce((sum, item) => sum + item.price * item.qty, 0).toLocaleString()}
              </div>
              <button onClick={handleCheckout} disabled={loading || cart.length === 0} style={checkoutBtnStyle}>
                {loading ? 'กำลังบันทึก...' : 'ชำระเงิน • ยืนยันออเดอร์'}
              </button>
            </div>
          </div>
        )}

        {/* ==================== DASHBOARD (Sales) ==================== */}
        {view === 'dashboard' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>📊 รายละเอียดการขาย</h2>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={dateInputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
              <div style={statCardStyle}>
                <p>ยอดขายวันนี้</p>
                <h1 style={{ color: '#10b981' }}>฿{dailyTotal.toLocaleString()}</h1>
              </div>
              <div style={statCardStyle}>
                <p>จำนวนบิล</p>
                <h1>{filteredSales.length}</h1>
              </div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ padding: '15px' }}>เวลา</th>
                  <th style={{ padding: '15px' }}>ยอดรวม</th>
                  <th style={{ padding: '15px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => (
                  <tr key={sale.id} onClick={() => viewSaleDetails(sale)} style={rowStyle}>
                    <td>{new Date(sale.created_at).toLocaleString('th-TH')}</td>
                    <td style={{ color: '#10b981', fontWeight: 'bold' }}>
                      ฿{Number(sale.total_amount || 0).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', color: '#3b82f6' }}>ดูรายละเอียด →</td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '50px' }}>ยังไม่มีข้อมูลการขายในวันนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== PROFIT DASHBOARD ==================== */}
        {view === 'profit' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
              <h2>💰 รายงานผลกำไร</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="date" 
                  value={filterStartDate} 
                  onChange={(e) => setFilterStartDate(e.target.value)} 
                  style={dateInputStyle} 
                />
                <span style={{ color: '#aaa' }}>-</span>
                <input 
                  type="date" 
                  value={filterEndDate} 
                  onChange={(e) => setFilterEndDate(e.target.value)} 
                  style={dateInputStyle} 
                />
              </div>
              <button onClick={exportProfitCSV} style={exportBtnStyle}>
                📤 ดาวน์โหลด CSV
              </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div style={{ ...statCardStyle, flex: '1', minWidth: '200px' }}>
                <p style={{ color: '#aaa' }}>ยอดขายรวม</p>
                <h1 style={{ color: '#10b981' }}>฿{profitStats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
              </div>
              <div style={{ ...statCardStyle, flex: '1', minWidth: '200px' }}>
                <p style={{ color: '#aaa' }}>ต้นทุนรวม</p>
                <h1 style={{ color: '#f44336' }}>฿{profitStats.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
              </div>
              <div style={{ ...statCardStyle, flex: '1', minWidth: '200px' }}>
                <p style={{ color: '#aaa' }}>กำไรสุทธิ</p>
                <h1 style={{ color: '#3b82f6' }}>฿{profitStats.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
              </div>
              <div style={{ ...statCardStyle, flex: '1', minWidth: '200px' }}>
                <p style={{ color: '#aaa' }}>อัตราส่วนกำไร</p>
                <h1 style={{ color: '#f59e0b' }}>{profitMargin}%</h1>
              </div>
            </div>

            {/* Profit Chart */}
            <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', marginBottom: '30px' }}>
              <h3 style={{ marginBottom: '15px' }}>📈 แนวโน้มกำไรรายวัน</h3>
              {dateRangeData.length > 0 ? (
                <ReactApexChart 
                  options={profitChartOptions} 
                  series={profitChartSeries} 
                  type="line" 
                  height={350} 
                  width="100%"
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>
                  ยังไม่มีข้อมูลกำไรในช่วงเวลานี้
                </div>
              )}
            </div>

            {/* Top Products by Profit */}
            <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
              <h3 style={{ marginBottom: '15px' }}>🏆 10 อันดับสินค้าที่ทำกำไรสูงสุด</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#aaa' }}>อันดับ</th>
                    <th style={{ padding: '10px', textAlign: 'left', color: '#aaa' }}>สินค้า</th>
                    <th style={{ padding: '10px', textAlign: 'right', color: '#aaa' }}>ยอดขาย</th>
                    <th style={{ padding: '10px', textAlign: 'right', color: '#aaa' }}>ต้นทุน</th>
                    <th style={{ padding: '10px', textAlign: 'right', color: '#aaa' }}>กำไร</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length > 0 ? topProducts.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #333' }}>
                      <td style={{ padding: '10px', textAlign: 'left', color: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#aaa' }}>
                        {idx + 1} {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'left' }}>{p.name}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{p.count} ชิ้น</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>฿{(p.total * 0.7).toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>฿{p.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>ยังไม่มีข้อมูล</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== ADMIN ==================== */}
        {view === 'admin' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2>⚙️ จัดการสินค้า</h2>
            <form onSubmit={handleAddProduct} style={adminFormStyle}>
              <input 
                type="text" 
                placeholder="ชื่อสินค้า" 
                value={newProductName} 
                onChange={(e) => setNewProductName(e.target.value)} 
                style={adminInputStyle} 
              />
              <input 
                type="number" 
                placeholder="ราคาขาย" 
                value={newProductPrice} 
                onChange={(e) => setNewProductPrice(e.target.value)} 
                style={adminInputStyle} 
              />
              <input 
                type="number" 
                placeholder="ต้นทุน (ถ้ามี)" 
                value={newProductCost} 
                onChange={(e) => setNewProductCost(e.target.value)} 
                style={adminInputStyle} 
              />
              <button type="submit" style={adminAddBtnStyle}>+ เพิ่มสินค้าใหม่</button>
            </form>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ padding: '15px' }}>สินค้า</th>
                  <th style={{ padding: '15px' }}>ราคาขาย</th>
                  <th style={{ padding: '15px' }}>ต้นทุน</th>
                  <th style={{ padding: '15px' }}>สต็อก</th>
                  <th style={{ padding: '15px' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '15px' }}>{p.name}</td>
                    <td style={{ padding: '15px', color: '#10b981' }}>฿{p.price}</td>
                    <td style={{ padding: '15px', color: '#f59e0b' }}>฿{p.cost_price?.toFixed(2) || 0}</td>
                    <td style={{ padding: '15px' }}>{p.inventory?.[0]?.current_stock || 0}</td>
                    <td style={{ padding: '15px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => updateStock(p.inventory[0].id, p.inventory[0].current_stock || 0)} style={stockBtnStyle}>
                          เติมสต็อก
                        </button>
                        <button onClick={() => handleEditProduct(p)} style={{ ...stockBtnStyle, backgroundColor: '#6366f1' }}>
                          แก้ไข
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id, p.inventory[0].id)} style={{ ...stockBtnStyle, backgroundColor: '#f44336' }}>
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Edit Product Modal */}
            {editingProduct && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
                justifyContent: 'center', alignItems: 'center', zIndex: 1000
              }}>
                <div style={{ backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '16px', minWidth: '350px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px' }}>✏️ แก้ไขสินค้า</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input type="text" placeholder="ชื่อสินค้า" value={editName} onChange={(e) => setEditName(e.target.value)} style={adminInputStyle} />
                    <input type="number" placeholder="ราคาขาย" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={adminInputStyle} />
                    <input type="number" placeholder="ต้นทุน" value={editCost} onChange={(e) => setEditCost(e.target.value)} style={adminInputStyle} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button onClick={handleSaveEdit} style={{ ...adminAddBtnStyle, flex: 1 }}>💾 บันทึก</button>
                      <button onClick={() => setEditingProduct(null)} style={{ ...adminAddBtnStyle, backgroundColor: '#666', flex: 1 }}>ยกเลิก</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showReceipt && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          sale={receiptSale}
          saleItems={receiptItems}
          settings={settings}
        />
      )}
    </div>
  );
}

export default App;
