'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Make sure this path matches your folder structure

export default function AdminDashboard() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // TAB STATE
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'inventory'

    // INVENTORY STATE
    const [products, setProducts] = useState<any[]>([]);
    const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '', image: '' });

    // NEW: Track which product is being edited and the new price
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState('');

    // SECURITY STATE
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [loginError, setLoginError] = useState(false);

    // CHECK EXISTING SESSION ON LOAD
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem('shopkeeperAuth');
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    // LOGIN FUNCTION
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // We are using the last 4 digits of the shop phone number as the default PIN
        const ADMIN_PIN = "2990";

        if (passcode === ADMIN_PIN) {
            setIsAuthenticated(true);
            sessionStorage.setItem('shopkeeperAuth', 'true');
            setLoginError(false);
        } else {
            setLoginError(true);
            setPasscode('');
        }
    };

    // 1. FETCH INVENTORY
    async function fetchInventory() {
        const { data, error } = await supabase.from('products').select('*');
        if (error) console.error("Error fetching inventory:", error);
        else setProducts(data || []);
    }

    // 2. ADD PRODUCT
    async function handleAddProduct(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.from('products').insert([
            {
                name: newProduct.name,
                price: parseInt(newProduct.price),
                category: newProduct.category,
                image: newProduct.image || '/placeholder.png' // Fallback image
            }
        ]);

        if (error) {
            alert("Failed to add product");
        } else {
            setNewProduct({ name: '', price: '', category: '', image: '' }); // Clear form
            fetchInventory(); // Refresh the list
            alert("Product added successfully!");
        }
    }

    // 3. DELETE PRODUCT
    async function handleDeleteProduct(id: number) {
        const isConfirmed = window.confirm("Are you sure you want to delete this item?");
        if (!isConfirmed) return;

        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) alert("Failed to delete product");
        else fetchInventory(); // Refresh list
    }

    // 4. UPDATE PRODUCT PRICE
  async function handleUpdatePrice(id: number) {
    const { error } = await supabase
      .from('products')
      .update({ price: parseInt(editPrice) })
      .eq('id', id);

    if (error) {
      alert("Failed to update price");
    } else {
      setEditingId(null); // Exit edit mode
      fetchInventory(); // Refresh the list
    }
  }

    // Fetch inventory when the component loads
    useEffect(() => {
        fetchOrders();
        fetchInventory(); // Add this to your existing useEffect
        // ... your existing real-time subscription code
    }, []);

    // 1. FETCH ORDERS FUNCTION
    async function fetchOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false }); // Newest orders first

        if (error) console.error("Error:", error);
        else setOrders(data || []);
        setLoading(false);
    }

    // 2. REAL-TIME UPDATES (The "Magic" part)
    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('schema-db-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => fetchOrders() // Refresh list whenever anything changes
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // 3. UPGRADED STATUS UPDATE FUNCTION
    async function updateStatus(order: any, newStatus: string) {

        // 1. OPTIMISTIC UI UPDATE (Instant visual feedback)
        setOrders(orders.map(o =>
            o.id === order.id ? { ...o, status: newStatus } : o
        ));

        // 2. DATABASE UPDATE
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
        if (error) {
            console.error("Failed to update DB:", error);
            alert("Database error, please refresh.");
            return;
        }

        // 3. DIRECT WHATSAPP CHAT (Opens customer's chat)
        if (newStatus === 'Accepted') {
            const replyMessage = `✅ *ORDER ACCEPTED!*\n\nYour order *#ORD-${order.id}* has been confirmed by Jai Jinendra Kirana Store.\n\nWe are packing your items now and will notify you when it is ready. Thank you!`;

            // Clean up the phone number (remove spaces/dashes) and ensure it has +91
            let phone = order.customer_phone || "";
            phone = phone.replace(/\D/g, ''); // Keep only numbers
            if (phone.length === 10) phone = '91' + phone; // Add India country code if they just typed 10 digits

            if (phone.length >= 10) {
                // This opens a direct chat with the CUSTOMER
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(replyMessage)}`, '_blank');
            } else {
                alert("This order was placed without a valid phone number. Marked as accepted in database.");
            }
        }
    }

    // 4. UPGRADED CLEAN UP FUNCTION
    async function clearCompletedOrders() {
        // 1. Safety check
        const isConfirmed = window.confirm("Are you sure you want to delete ALL 'Completed' orders? This cannot be undone.");
        if (!isConfirmed) return;

        // 2. OPTIMISTIC UI UPDATE (Instantly wipes them from the screen)
        setOrders(orders.filter(order => order.status !== 'Completed'));

        // 3. DATABASE UPDATE (Runs in the background)
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('status', 'Completed');

        if (error) {
            console.error("Failed to delete:", error);
            alert("Error clearing orders. Please refresh.");
            fetchOrders(); // Reverts the screen back if the database fails
        } else {
            console.log("Database successfully cleared of completed orders.");
        }
    }
    // THE LOGIN SCREEN INTERCEPTOR
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-200">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Shopkeeper Login</h1>
                        <p className="text-gray-500">Enter your PIN to access the dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <input
                                type="password"
                                placeholder="••••"
                                value={passcode}
                                onChange={(e) => setPasscode(e.target.value)}
                                className="w-full p-4 border-2 border-gray-200 rounded-xl text-center text-3xl tracking-[1em] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-gray-900"
                                autoFocus
                            />
                            {loginError && (
                                <p className="text-red-500 text-sm mt-3 text-center font-medium">
                                    Incorrect PIN. Please try again.
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-lg shadow-md hover:shadow-lg"
                        >
                            Unlock Panel
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-10 text-center">Loading Orders...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-10">

            {/* HEADER & TABS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-extrabold text-gray-800">Shopkeeper Panel</h1>

                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}
                    >
                        Live Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border'}`}
                    >
                        Manage Inventory
                    </button>
                </div>
            </div>

            {/* --- ORDERS VIEW --- */}
            {activeTab === 'orders' && (
                <>
                    <div className="flex justify-end mb-4">
                        <button onClick={clearCompletedOrders} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 hover:bg-red-100 transition-all text-sm">
                            Clear Completed
                        </button>
                    </div>
                    {/* THE ORDERS GRID */}
                    <div className="grid gap-6">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-blue-600">ORD-{order.id}</h2>
                                        <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-4 py-1 rounded-full text-sm font-bold ${order.status === 'Pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        {order.status}
                                    </span>
                                </div>

                                <div className="border-t border-b py-4 my-4">
                                    {order.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-gray-700">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span>₹{item.price * item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-gray-900">Total: ₹{order.total_price}</span>
                                    <div className="flex space-x-2">
                                        {order.status === 'Pending' && (
                                            <button
                                                onClick={() => updateStatus(order, 'Accepted')}
                                                className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-all"
                                            >
                                                Accept Order
                                            </button>
                                        )}
                                        {order.status !== 'Completed' && (
                                            <button
                                                onClick={() => updateStatus(order, 'Completed')}
                                                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-black transition-all"
                                            >
                                                Mark Done
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* ... your orders.map(...) code ... */}
                </>
            )}

            {/* --- INVENTORY VIEW --- */}
            {activeTab === 'inventory' && (
                <div className="grid md:grid-cols-3 gap-8 text-gray-900">

                    {/* Add New Product Form */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit md:col-span-1">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Add New Item</h2>
                        <form onSubmit={handleAddProduct} className="space-y-4">
                            <input type="text" placeholder="Product Name (e.g., Maggi)" required
                                value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                className="w-full p-3 border rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />

                            <input type="number" placeholder="Price (₹)" required
                                value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                className="w-full p-3 border rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />

                            <input type="text" placeholder="Category (e.g., Snacks)" required
                                value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                                className="w-full p-3 border rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />

                            <input type="text" placeholder="Image URL (e.g., /maggi.png)"
                                value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })}
                                className="w-full p-3 border rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />

                            <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-all">
                                Save to Store
                            </button>
                        </form>
                    </div>

                    {/* Current Inventory List */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2 overflow-x-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Current Stock</h2>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-gray-200 text-gray-800">
                                    <th className="p-2">Name</th>
                                    <th className="p-2">Category</th>
                                    <th className="p-2">Price</th>
                                    <th className="p-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                 {products.map(item => (
                   <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                     <td className="p-2 font-medium text-gray-900">{item.name}</td>
                     <td className="p-2 text-gray-600">{item.category}</td>
                     
                     <td className="p-2">
                       {editingId === item.id ? (
                         <div className="flex items-center gap-2">
                           <span className="text-gray-900">₹</span>
                           <input 
                             type="number" 
                             value={editPrice} 
                             onChange={(e) => setEditPrice(e.target.value)}
                             className="w-20 p-1 border rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                             autoFocus
                           />
                         </div>
                       ) : (
                         <span className="text-gray-900 font-semibold">₹{item.price}</span>
                       )}
                     </td>

                     <td className="p-2">
                       <div className="flex gap-3">
                         {editingId === item.id ? (
                           <>
                             <button 
                               onClick={() => handleUpdatePrice(item.id)}
                               className="text-green-600 font-bold hover:text-green-800"
                             >
                               Save
                             </button>
                             <button 
                               onClick={() => setEditingId(null)}
                               className="text-gray-400 font-bold hover:text-gray-600"
                             >
                               Cancel
                             </button>
                           </>
                         ) : (
                           <>
                             <button 
                               onClick={() => {
                                 setEditingId(item.id);
                                 setEditPrice(item.price.toString());
                               }}
                               className="text-blue-600 font-bold hover:text-blue-800"
                             >
                               Edit
                             </button>
                             <button 
                               onClick={() => handleDeleteProduct(item.id)} 
                               className="text-red-500 hover:text-red-700"
                             >
                               Delete
                             </button>
                           </>
                         )}
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
                        </table>
                    </div>

                </div>
            )}

        </div>
    );
}