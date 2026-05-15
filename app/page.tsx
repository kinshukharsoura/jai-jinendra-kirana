'use client';

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
// 1. THE MOCK DATABASE: 
// Instead of hardcoding 20 UI cards, we define our data once here.
// Think of this like an array of structs in C/C++.
// const products = [
//   { id: 1, name: 'Atta (5kg)', price: 250, image: 'atta.png',category: 'Essentials' },
//   { id: 2, name: 'Chana Daal', price: 65, image: '/chana_daal.png',category: 'Pulses' },
//   { id: 3, name: 'Paani Patashe (50g)', price: 54, image: '/paanip.png',category: 'Snacks' },
//   { id: 4, name: 'Tata Salt (1kg)', price: 25, image: '/salt.png',category: 'Essentials' },
//   { id: 5, name: 'Daal(Sabut) (1kg)', price : 60,image: '/tuar_daal.jpg',category: 'Pulses'},
//   { id: 6, name: 'Urad Daal(1kg)', price: 120, image: '/urad_daal.png',category: "Pulses"}
// ];

export default function Home() {
  // We are keeping our cart state from yesterday!
  const [cart, setCart] = useState<any[]>([]);
  const [isCheckout, setIsCheckout] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState('All');
  const [toastMessage, setToastMessage] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  // PAYMENT STATES
  const [paymentMethod, setPaymentMethod] = useState('COD'); // 'COD' or 'ONLINE'
  const [paymentDetails, setPaymentDetails] = useState<{show: boolean, amount: number, orderId: string | null}>({ show: false, amount: 0, orderId: null });

  useEffect(() => {
    async function getProducts() {
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error("Error fetching:", error);
      } else {
        setProducts(data);
      }
    }
    getProducts();
  }, []);

  // THE TOAST TIMER: Automatically hides the message after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 3000);
      return () => clearTimeout(timer); // Cleans up the timer so it doesn't glitch
    }
  }, [toastMessage]);
  // 1. THE LOAD FUNCTION (Reads from the hard drive)
  // The empty bracket [] means: "Only run this once, exactly when the app first opens"
  useEffect(() => {
    const savedCart = localStorage.getItem('localmart-cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart)); // Converts the text string back into a real array
    }
  }, []);

  // 2. THE SAVE FUNCTION (Writes to the hard drive)
  // The [cart] bracket means: "Run this every single time the 'cart' variable changes"
  useEffect(() => {
    // We only want to save if the cart actually has something in it, 
    // or if we intentionally emptied it.
    if (cart.length > 0) {
      localStorage.setItem('localmart-cart', JSON.stringify(cart)); // Converts array to a text string
    } else {
      localStorage.removeItem('localmart-cart'); // Cleans up if cart is empty
    }
  }, [cart]);


  const addToCart = (product: any) => {
    // 1. Check if the product is already in the cart
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      // 2. If it is, map through the cart and increase the quantity of that specific item
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      // 3. If it's brand new, copy the existing cart (...cart) and add the new product with a quantity of 1
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setToastMessage(`Added ${product.name} to cart!`);
  };

  // Increases quantity by 1
  const increaseQuantity = (productId: any) => {
    setCart(cart.map(item =>
      item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
    ));
  };

  // Decreases quantity by 1, and removes the item if it hits 0
  const decreaseQuantity = (productId: any) => {
    setCart(cart.map(item =>
      item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
    ).filter(item => item.quantity > 0)); // .filter() automatically deletes items with 0 quantity!
  };

  // Completely removes the item regardless of quantity
  const removeItem = (productId: any) => {
    setCart(cart.filter(item => item.id !== productId));
  };
  // UPDATED WHATSAPP & DATABASE LOGIC
  const processCheckout = async () => {
    // Basic Validation: Don't let them order without a name or phone number
    if (!customerName || customerPhone.length < 10) {
      alert("Please enter a valid Name and 10-digit Phone Number.");
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // 1. SAVE ALL DETAILS TO SUPABASE
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          items: cart,
          total_price: total,
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: address || "Store Pickup", // Defaults to pickup if empty
          status: 'Pending'
        }
      ])
      .select();

    if (error) {
      console.error("Database Error:", error);
      alert("Failed to save order.");
      return;
    }

   // NEW LOGIC: Calculate total and check payment method
    const orderTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const generatedOrderId = data[0].id; 

    if (paymentMethod === 'ONLINE') {
      // Show the UPI Screen, keep the checkout view open
      setPaymentDetails({ show: true, amount: orderTotal, orderId: generatedOrderId });
      setCart([]); 
    } else {
      // --- CASH ON DELIVERY LOGIC ---
      
      // 1. Prepare WhatsApp Message for Seller
      let message = `🚨 *NEW COD ORDER: #ORD-${generatedOrderId}*\n\n`;
      message += `*Customer:* ${customerName}\n`;
      message += `*Phone:* ${customerPhone}\n`;
      message += `*Address:* ${address || "Store Pickup"}\n\n`;
      
      cart.forEach((item) => {
        message += `- ${item.quantity}x ${item.name} (₹${item.price * item.quantity})\n`;
      });
      message += `\n*Total to Collect: ₹${orderTotal}*`;

      const shopPhone = "918209192990";
      
      // 2. Open WhatsApp to send to Shopkeeper
      window.open(`https://wa.me/${shopPhone}?text=${encodeURIComponent(message)}`, '_blank');

      // 3. Clear form and close screen
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setAddress("");
      setIsCheckout(false); 
      setPaymentMethod('COD'); // Reset for next time
      setToastMessage(`Order #ORD-${generatedOrderId} placed successfully!`);
    }
  };
  // This creates a unique list of categories found in your database
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-amber-50 to-orange-100 text-gray-900 selection:bg-orange-200">

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md p-4 shadow-sm flex justify-between items-center border-b border-orange-200/50">
        <h1
          className="text-3xl font-extrabold bg-linear-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent cursor-pointer tracking-tight drop-shadow-sm"
          onClick={() => setIsCheckout(false)} // Clicking logo takes you back to store
        >
          Jai Jinendra Kirana Store
        </h1>
        <button
          onClick={() => setIsCheckout(!isCheckout)} // Toggles the checkout screen
          className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition-colors"
        >
          Cart: {cart.reduce((total, item) => total + item.quantity, 0)} Items
        </button>
      </nav>

      {/* THE MAGIC SWITCH: Storefront OR Checkout View */}
      {!isCheckout ? (

        /* --- STOREFRONT VIEW --- */
        <main className="p-4 pb-24 max-w-4xl mx-auto mt-6">
          <h2 className="text-xl font-bold mb-4">Available Today</h2>
          {/* THE SEARCH BAR */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search for groceries (e.g., Daal, Salt)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg"
            />
          </div>
          {/* CATEGORY BUTTONS */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-colors ${activeCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products
              .filter(product => activeCategory === 'All' || product.category === activeCategory)
              .filter(product => product.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((product) => (
                <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-between">
                  <img src={product.image} alt={product.name} className="w-full h-40 object-cover rounded-md mb-3" />
                  <h3 className="font-semibold text-center mb-1">{product.name}</h3>
                  <p className="text-gray-600 mb-4 font-medium">₹{product.price}</p>
                  <button
                    onClick={() => addToCart(product)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-alls"
                  >
                    Add
                  </button>
                </div>
              ))}
          </div>
        </main>

      ) : (

        /* --- CHECKOUT VIEW --- */
        <main className="p-4 pb-24 max-w-2xl mx-auto mt-6">
          {/* --- NEW: UPI PAYMENT SCREEN --- */}
            {paymentDetails.show ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-4 font-bold">
                  ✓
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Order #ORD-{paymentDetails.orderId} Placed!</h2>
                <p className="text-gray-500 mb-8">Please complete your payment to confirm the delivery.</p>

                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 w-full mb-6">
                  <p className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-1">Amount to Pay</p>
                  <p className="text-4xl font-extrabold text-gray-900 mb-6">₹{paymentDetails.amount}</p>
                  
                  {/* Auto-Generated QR Code */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 inline-block mb-4">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=9256810663@fam&pn=Jai%20Jinendra%20Store&am=${paymentDetails.amount}&cu=INR`)}`} 
                      alt="UPI QR Code" 
                      className="w-40 h-40 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Scan with GPay, PhonePe, or Paytm</p>
                </div>

                <a 
                  href={`upi://pay?pa=9256810663@fam&pn=Jai%20Jinendra%20Store&am=${paymentDetails.amount}&cu=INR`}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-lg mb-4 block"
                >
                  Pay via UPI App (Mobile)
                </a>

                <button 
                  onClick={() => {
                    // 1. Prepare WhatsApp Message for Seller
                    const message = `✅ *ONLINE PAYMENT COMPLETED*\n\nOrder: *#ORD-${paymentDetails.orderId}*\nAmount: *₹${paymentDetails.amount}*\nCustomer: *${customerName}*\nPhone: *${customerPhone}*\nAddress: *${address || 'Store Pickup'}*\n\nI have transferred the amount via UPI. Please check and confirm my order!`;
                    const shopPhone = "918209192990"; 
                    
                    // 2. Open WhatsApp to send to Shopkeeper
                    window.open(`https://wa.me/${shopPhone}?text=${encodeURIComponent(message)}`, '_blank');

                    // 3. Clear form and close screen
                    setPaymentDetails({ show: false, amount: 0, orderId: null });
                    setCustomerName("");
                    setCustomerPhone("");
                    setAddress("");
                    setIsCheckout(false);
                    setToastMessage("Payment confirmed and order placed!");
                  }}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-all text-lg"
                >
                  I have completed the payment
                </button>
              </div>
            ) : (
              /* --- YOUR EXISTING NORMAL CART UI GOES HERE --- */
              <>
                <h2 className="text-2xl font-bold mb-6">Your Cart</h2>

          {cart.length === 0 ? (
            <p className="text-gray-500">Your cart is empty. Go add some items!</p>
          ) : (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              {/* Loop through cart items to show receipt */}
              {/* Loop through cart items to show receipt AND edit buttons */}
              {cart.map((item, index) => (
                <div key={index} className="flex justify-between items-center mb-4 pb-4 border-b">

                  {/* Item Name and Price */}
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    <p className="font-bold text-gray-800">₹{item.price * item.quantity}</p>
                  </div>

                  {/* The Control Center (+ / - / Remove) */}
                  <div className="flex items-center gap-3">

                    {/* Minus Button */}
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full font-bold hover:bg-gray-300"
                    >
                      -
                    </button>

                    {/* Current Quantity */}
                    <span className="font-bold w-4 text-center">{item.quantity}</span>

                    {/* Plus Button */}
                    <button
                      onClick={() => increaseQuantity(item.id)}
                      className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold hover:bg-blue-200"
                    >
                      +
                    </button>

                    {/* Trash / Remove Button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-2 text-red-500 text-sm font-semibold hover:underline"
                    >
                      Remove
                    </button>

                  </div>
                </div>
              ))}
              {/* THE CUSTOMER DETAILS FORM */}
              <div className="mt-8 mb-6 border-t pt-6">
                <h3 className="text-lg font-bold mb-4">Delivery Details</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your Name *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number (e.g., 9876543210) *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <textarea
                    placeholder="Delivery Address (Leave blank for pickup)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>


              {/* PAYMENT METHOD SELECTOR */}
              <div className="mb-6 border-t pt-6">
                <p className="text-sm font-bold text-gray-700 mb-3">Payment Method</p>
                <div className="flex gap-4">
                  <button
                    type="button" 
                    onClick={() => setPaymentMethod('COD')}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${paymentMethod === 'COD' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    Cash on Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ONLINE')}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${paymentMethod === 'ONLINE' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    Pay via UPI
                  </button>
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between text-xl font-bold mt-4 mb-8">
                <span>Total:</span>
                <span>₹{cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
              </div>

              {/* Checkout Button (Now calls processCheckout) */}
              <button
                onClick={processCheckout}
                className="w-full bg-green-500 text-white font-bold py-4 rounded-xl hover:bg-green-600 active:scale-95 transition-all text-lg"
              >
                Place Order
              </button>

            </div>
          )}
          </>
            )}
        </main>

      )}
      {/* THE TOAST NOTIFICATION UI */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 font-medium transition-all">
          <span className="text-green-400 text-xl">✓</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}