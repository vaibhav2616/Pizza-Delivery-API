/**
 * Vesuvio Hearth Kitchen Command & Dispatch Center (KDS)
 * Dedicated Kitchen Display System for Kitchen Staff, Chefs, and Pizzaiolos.
 * Real-time order queue, 500°C stone oven staging, dispatch transitions, and financial KPIs in ₹ INR.
 */

class KitchenKDS {
  constructor() {
    this.tokenKey = 'vesuvio_kitchen_token';
    this.userKey = 'vesuvio_kitchen_user';
    this.soundKey = 'vesuvio_kitchen_sound';

    this.token = localStorage.getItem(this.tokenKey) || localStorage.getItem('vesuvio_access_token');
    this.currentUser = null;
    this.orders = [];
    this.stats = null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.autoRefresh = true;
    this.refreshTimer = null;
    this.soundEnabled = localStorage.getItem(this.soundKey) !== 'false';
    this.audioCtx = null;
    this.previousPendingCount = 0;
  }

  init() {
    this.startClock();
    this.checkAuth();
    this.updateSoundButton();
  }

  // ==========================================================================
  // Authentication & RBAC Guard
  // ==========================================================================
  async checkAuth() {
    if (!this.token) {
      this.showLoginModal();
      return;
    }

    try {
      const res = await fetch('/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (!res.ok) throw new Error('Session expired');
      const user = await res.json();

      if (!user.is_staff) {
        this.showToast('Access denied: Staff privileges required.', 'error');
        this.logout();
        return;
      }

      this.currentUser = user;
      localStorage.setItem(this.userKey, JSON.stringify(user));
      this.hideLoginModal();
      this.updateStaffUI();
      this.fetchData();
      this.startAutoRefresh();
    } catch (err) {
      this.showLoginModal();
    }
  }

  showLoginModal() {
    const modal = document.getElementById('kitchen-auth-modal');
    if (modal) modal.style.display = 'flex';
  }

  hideLoginModal() {
    const modal = document.getElementById('kitchen-auth-modal');
    if (modal) modal.style.display = 'none';
  }

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('k-submit-btn');
    const u = document.getElementById('k-username').value.trim();
    const p = document.getElementById('k-password').value;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Authenticating...';
    }

    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');

      if (!data.user || !data.user.is_staff) {
        throw new Error('Access Denied: Account does not possess Kitchen Staff privileges.');
      }

      this.token = data.access || data.access_token;
      this.currentUser = data.user;
      localStorage.setItem(this.tokenKey, this.token);
      localStorage.setItem(this.userKey, JSON.stringify(data.user));

      this.hideLoginModal();
      this.updateStaffUI();
      this.showToast(`Welcome, Chef ${this.currentUser.username}! Stone hearth connected. 🔥`, 'success');
      this.fetchData();
      this.startAutoRefresh();
      this.playChime('oven');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔥</span> Enter Dispatch Center';
      }
    }
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.token = null;
    this.currentUser = null;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.showLoginModal();
    this.showToast('Kitchen terminal signed out securely.', 'info');
  }

  updateStaffUI() {
    const nameEl = document.getElementById('kds-staff-name');
    if (nameEl && this.currentUser) {
      nameEl.textContent = `Chef ${this.currentUser.username}`;
    }
  }

  // ==========================================================================
  // Clock & Real-Time Sync
  // ==========================================================================
  startClock() {
    const updateTime = () => {
      const clockEl = document.getElementById('kds-live-clock');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  startAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      if (this.autoRefresh && this.token) {
        this.fetchData(true);
      }
    }, 10000);
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    const btn = document.getElementById('kds-autorefresh-btn');
    if (btn) {
      btn.textContent = this.autoRefresh ? '🔄 Auto (10s)' : '⏸️ Paused';
      btn.style.color = this.autoRefresh ? '#fef6ea' : '#f87171';
    }
    this.showToast(this.autoRefresh ? 'Auto-refresh active (10s)' : 'Auto-refresh paused', 'info');
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem(this.soundKey, this.soundEnabled);
    this.updateSoundButton();
    this.showToast(this.soundEnabled ? 'Kitchen order chimes active 🔔' : 'Kitchen sound muted 🔕', 'info');
    if (this.soundEnabled) this.playChime('bell');
  }

  updateSoundButton() {
    const btn = document.getElementById('kds-sound-btn');
    if (btn) {
      btn.textContent = this.soundEnabled ? '🔔 Sound ON' : '🔕 Sound OFF';
    }
  }

  playChime(type = 'bell') {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'bell') {
        // High attention kitchen bell
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'oven') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.2);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {}
  }

  // ==========================================================================
  // Data Fetching & KPIs
  // ==========================================================================
  async fetchData(silent = false) {
    if (!this.token) return;

    try {
      const [statsRes, ordersRes] = await Promise.all([
        fetch('/orders/stats', { headers: { 'Authorization': `Bearer ${this.token}` } }),
        fetch('/orders/orders', { headers: { 'Authorization': `Bearer ${this.token}` } })
      ]);

      if (statsRes.status === 401 || ordersRes.status === 401) {
        this.logout();
        return;
      }

      if (statsRes.ok) {
        this.stats = await statsRes.json();
        this.renderStats();
      }

      if (ordersRes.ok) {
        const rawOrders = await ordersRes.json();
        this.orders = rawOrders;
        
        // Check for new incoming pending orders to chime
        const pendingCount = this.orders.filter(o => o.order_status === 'PENDING').length;
        if (pendingCount > this.previousPendingCount && !silent) {
          this.playChime('bell');
          this.showToast(`🔥 New Order Received in Queue!`, 'info');
        }
        this.previousPendingCount = pendingCount;

        this.updateBadgeCounts();
        this.renderOrders();
      }
    } catch (err) {
      if (!silent) this.showToast('Failed to sync kitchen telemetry', 'error');
    }
  }

  renderStats() {
    if (!this.stats) return;
    const revEl = document.getElementById('k-revenue');
    const pendEl = document.getElementById('k-pending');
    const bakEl = document.getElementById('k-baking');
    const delEl = document.getElementById('k-delivered');
    const totEl = document.getElementById('k-total');

    if (revEl) revEl.textContent = `₹${(this.stats.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (pendEl) pendEl.textContent = this.stats.pending_orders || 0;
    if (bakEl) bakEl.textContent = this.stats.in_transit_orders || 0;
    if (delEl) delEl.textContent = this.stats.delivered_orders || 0;
    if (totEl) totEl.textContent = this.stats.total_orders || 0;
  }

  updateBadgeCounts() {
    const allCount = this.orders.length;
    const pendCount = this.orders.filter(o => o.order_status === 'PENDING').length;
    const transCount = this.orders.filter(o => o.order_status === 'IN-TRANSIT').length;
    const delCount = this.orders.filter(o => o.order_status === 'DELIVERED').length;
    const cancCount = this.orders.filter(o => o.order_status === 'CANCELLED').length;

    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };

    setBadge('tab-badge-all', allCount);
    setBadge('tab-badge-pending', pendCount);
    setBadge('tab-badge-transit', transCount);
    setBadge('tab-badge-delivered', delCount);
    setBadge('tab-badge-cancelled', cancCount);
  }

  // ==========================================================================
  // Filter & Search Controls
  // ==========================================================================
  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.kds-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-filter') === filter) {
        btn.classList.add('active');
      } else if (btn.getAttribute('data-filter')) {
        btn.classList.remove('active');
      }
    });
    this.renderOrders();
  }

  handleSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.renderOrders();
  }

  // ==========================================================================
  // Rendering Orders Board
  // ==========================================================================
  renderOrders() {
    const container = document.getElementById('kds-orders-container');
    if (!container) return;

    let list = this.orders;

    if (this.currentFilter !== 'all') {
      list = list.filter(o => o.order_status === this.currentFilter);
    }

    if (this.searchQuery) {
      list = list.filter(o => {
        const idStr = String(o.id);
        const userStr = (o.user?.username || '').toLowerCase();
        const phoneStr = (o.customer_phone || '').toLowerCase();
        const itemsStr = (o.items || []).map(i => i.pizza_name).join(' ').toLowerCase();
        return idStr.includes(this.searchQuery) ||
               userStr.includes(this.searchQuery) ||
               phoneStr.includes(this.searchQuery) ||
               itemsStr.includes(this.searchQuery);
      });
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: var(--kds-panel); border-radius: 14px; border: 1px dashed var(--kds-panel-border);">
          <div style="font-size: 3rem;">🍕</div>
          <h3 style="font-family: var(--font-display); font-size: 1.3rem; margin-top: 0.5rem;">No Active Orders in this Station</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.25rem;">Stone hearth ready for new incoming tickets.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(order => {
      const isPending = order.order_status === 'PENDING';
      const isInTransit = order.order_status === 'IN-TRANSIT';
      const isDelivered = order.order_status === 'DELIVERED';
      const isCancelled = order.order_status === 'CANCELLED';

      const statusClass = isPending ? 'status-pending' :
                          isInTransit ? 'status-in-transit' :
                          isDelivered ? 'status-delivered' : 'status-cancelled';

      const statusTag = isPending ? '⏳ QUEUE' :
                        isInTransit ? '🔥 IN OVEN / DISPATCH' :
                        isDelivered ? '✅ DELIVERED' : '❌ CANCELLED';

      const modeClass = order.order_mode === 'TAKEAWAY' ? 'mode-takeaway' : 'mode-delivery';
      const modeLabel = order.order_mode === 'TAKEAWAY' ? '🛍️ Takeaway Pickup' : '🛵 Doorstep Delivery';

      const placedTime = order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }) : 'Just now';

      const itemsHtml = (order.items || []).map(item => `
        <div class="ticket-item">
          <div>
            <span class="ticket-item-qty">${item.quantity}x</span>
            <strong style="color: #fff;">${item.pizza_name}</strong>
            <div class="ticket-item-details">
              <span>Size: ${item.size}</span> • <span>Crust: ${item.crust || 'Hand-Tossed Classic'}</span>
            </div>
            ${item.notes ? `<div style="font-size: 0.74rem; color: #f59e0b; margin-top: 0.2rem;">📝 ${item.notes}</div>` : ''}
          </div>
          <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff;">
            ₹${(item.subtotal || 0).toFixed(2)}
          </div>
        </div>
      `).join('');

      return `
        <div class="kds-ticket ${statusClass}">
          <div class="ticket-header">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="ticket-id">#ORD-${order.id}</span>
              <span class="ticket-mode-badge ${modeClass}">${modeLabel}</span>
            </div>
            <div style="font-size: 0.78rem; font-weight: 800; color: var(--kds-amber);">${statusTag}</div>
          </div>

          <div class="ticket-body">
            <div class="customer-info-row">
              <div>
                <span class="customer-name">${order.user?.username || 'Guest Foodie'}</span>
                <span style="font-size: 0.8rem; color: var(--text-subtle); margin-left: 0.35rem;">(${order.customer_phone || 'No phone'})</span>
              </div>
              <span class="ticket-time">⏰ ${placedTime}</span>
            </div>

            <div class="ticket-address">
              📍 <strong>Destination:</strong> ${order.delivery_address || 'Pizzeria Counter Pick-up'}
            </div>

            <div class="ticket-items-list">
              ${itemsHtml}
            </div>

            ${order.special_instructions ? `
              <div class="ticket-special-note">
                <strong>Chef Note:</strong> "${order.special_instructions}"
              </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted);">
              <span>Payment: <strong>${order.payment_method || 'COD'}</strong></span>
              ${order.coupon_code ? `<span style="color: #86efac;">🏷️ Code: <strong>${order.coupon_code}</strong> (-₹${order.discount_amount})</span>` : ''}
            </div>
          </div>

          <div class="ticket-footer">
            <div>
              <div style="font-size: 0.72rem; color: var(--text-subtle); text-transform: uppercase;">Total Bill</div>
              <div class="ticket-total">₹${(order.total_amount || 0).toFixed(2)}</div>
            </div>

            <div class="ticket-actions">
              ${isPending ? `
                <button class="btn-action-bake" onclick="kitchen.updateOrderStatus(${order.id}, 'IN-TRANSIT')">
                  🔥 Start Baking
                </button>
                <button class="btn-action-cancel" onclick="kitchen.cancelOrder(${order.id})" title="Cancel Order">
                  ✕
                </button>
              ` : ''}

              ${isInTransit ? `
                <button class="btn-action-deliver" onclick="kitchen.updateOrderStatus(${order.id}, 'DELIVERED')">
                  ✅ Mark Delivered
                </button>
              ` : ''}

              <button class="btn-action-invoice" onclick="kitchen.openKotTicket(${order.id})" title="View / Print KOT Receipt">
                🧾 KOT
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================================================
  // Order Transitions (RBAC Protected APIs)
  // ==========================================================================
  async updateOrderStatus(orderId, newStatus) {
    if (!this.token) return;

    try {
      const res = await fetch(`/orders/order/status/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ order_status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update order status');

      this.showToast(`Order #${orderId} stage updated to ${newStatus}!`, 'success');
      this.playChime('oven');
      this.fetchData(true);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel and void Order #${orderId}?`)) return;

    try {
      const res = await fetch(`/orders/order/delete/${orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to cancel order');

      this.showToast(`Order #${orderId} has been cancelled & refunded.`, 'info');
      this.fetchData(true);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================================================
  // Kitchen Order Ticket (KOT) & Tax Bill Modal
  // ==========================================================================
  openKotTicket(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('kot-modal');
    const container = document.getElementById('kot-printable-content');
    if (!modal || !container) return;

    const placedDate = order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    container.innerHTML = `
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; line-height: 1.5;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
          <div>
            <div><strong>ORDER #${order.id}</strong></div>
            <div style="font-size: 0.78rem; color: #64748b;">${placedDate}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; color: #ea580c;">${order.order_mode || 'DELIVERY'}</div>
            <div style="font-size: 0.78rem; color: #64748b;">Status: ${order.order_status}</div>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem;">
          <div><strong>Customer:</strong> ${order.user?.username || 'Guest'} (${order.customer_phone || 'N/A'})</div>
          <div><strong>Address:</strong> ${order.delivery_address || 'Counter Pickup'}</div>
          ${order.special_instructions ? `<div style="color: #ea580c; font-weight: 700; margin-top: 0.25rem;">Special Note: "${order.special_instructions}"</div>` : ''}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
          <thead>
            <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; font-size: 0.8rem; color: #475569;">
              <th style="padding: 0.5rem 0;">ITEM</th>
              <th style="padding: 0.5rem; text-align: center;">QTY</th>
              <th style="padding: 0.5rem; text-align: right;">PRICE</th>
              <th style="padding: 0.5rem 0; text-align: right;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map(it => `
              <tr style="border-bottom: 1px dashed #e2e8f0;">
                <td style="padding: 0.5rem 0;">
                  <strong style="color: #0f172a;">${it.pizza_name}</strong>
                  <div style="font-size: 0.76rem; color: #64748b;">${it.size} | ${it.crust || 'Classic'}</div>
                </td>
                <td style="padding: 0.5rem; text-align: center;">${it.quantity}</td>
                <td style="padding: 0.5rem; text-align: right;">₹${(it.unit_price || 0).toFixed(2)}</td>
                <td style="padding: 0.5rem 0; text-align: right;">₹${(it.subtotal || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>₹${(order.items_subtotal || order.total_amount).toFixed(2)}</span>
          </div>
          ${order.discount_amount ? `
            <div style="display: flex; justify-content: space-between; color: #16a34a;">
              <span>Coupon Discount (${order.coupon_code}):</span>
              <span>−₹${(order.discount_amount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span>Delivery Fee:</span>
            <span>₹${(order.delivery_fee || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>GST (5%):</span>
            <span>₹${(order.tax_amount || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 0.5rem; margin-top: 0.25rem;">
            <span>Net Paid (${order.payment_method || 'COD'}):</span>
            <span style="color: #ea580c;">₹${(order.total_amount || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-top: 1.25rem; text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem;">
          🍕 Vesuvio Hearth Neapolitan Pizzeria • 500°C Volcanic Stone Hearth
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  closeKotModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('kot-modal');
    if (modal) modal.style.display = 'none';
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('kds-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }
}

// Global Kitchen Instance
const kitchen = new KitchenKDS();
document.addEventListener('DOMContentLoaded', () => kitchen.init());

