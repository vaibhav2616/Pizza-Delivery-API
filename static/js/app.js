/**
 * SliceCraft Artisanal Pizza Delivery - Front-End Application Controller
 * Single Page Application (SPA) with reactive state management, animations, and real-time dispatch.
 */

class SliceCraftApp {
  constructor() {
    this.apiBase = '';
    this.tokenKey = 'slicecraft_access_token';
    this.refreshKey = 'slicecraft_refresh_token';
    this.userKey = 'slicecraft_user';
    this.cartKey = 'slicecraft_cart';

    // Reactive State
    this.currentUser = null;
    this.menu = [];
    this.cart = [];
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.activeOrder = null;
    this.userOrders = [];
    this.adminOrders = [];
    this.adminStats = null;
    this.currentView = 'menu';

    // Customizer Modal State
    this.customizerState = {
      basePizza: null,
      crust: 'Hand-Tossed Classic',
      crustExtra: 0,
      size: 'SMALL',
      sizeMultiplier: 0.85,
      extraToppings: {},
      notes: ''
    };

    // Audio Context for UI Feedback
    this.audioCtx = null;
  }

  init() {
    this.loadPersistedAuth();
    this.loadPersistedCart();
    this.fetchMenu();
    this.updateAuthHeaderUI();
    this.updateCartCountUI();

    // Auto-poll tracker and admin board if visible
    setInterval(() => {
      if (this.currentView === 'tracker' && this.currentUser) {
        this.refreshOrderHistory(false);
      } else if (this.currentView === 'admin' && this.currentUser?.is_staff) {
        this.fetchStaffData(false);
      }
    }, 12000);
  }

  // ==========================================================================
  // Audio Feedback (Web Audio API Chime)
  // ==========================================================================
  playChime(type = 'success') {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.35);
      } else if (type === 'pop') {
        osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      // Audio not supported or blocked, ignore gracefully
    }
  }

  // ==========================================================================
  // Persistent Auth & LocalStorage
  // ==========================================================================
  loadPersistedAuth() {
    try {
      const storedUser = localStorage.getItem(this.userKey);
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }
    } catch (e) {
      this.currentUser = null;
    }
  }

  loadPersistedCart() {
    try {
      const stored = localStorage.getItem(this.cartKey);
      this.cart = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.cart = [];
    }
  }

  saveCart() {
    localStorage.setItem(this.cartKey, JSON.stringify(this.cart));
    this.updateCartCountUI();
    this.renderCart();
  }

  getAccessToken() {
    return localStorage.getItem(this.tokenKey);
  }

  async fetchWithAuth(url, options = {}) {
    const token = this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle token expiration
    if (response.status === 401 && localStorage.getItem(this.refreshKey)) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    return response;
  }

  async tryRefreshToken() {
    const refresh = localStorage.getItem(this.refreshKey);
    if (!refresh) return false;
    try {
      const res = await fetch('/auth/refresh', {
        headers: { 'Authorization': `Bearer ${refresh}` }
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(this.tokenKey, data.access);
        return true;
      }
    } catch (e) {}
    this.logout();
    return false;
  }

  // ==========================================================================
  // Authentication Actions
  // ==========================================================================
  async login(username, password) {
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid username or password');
      }

      localStorage.setItem(this.tokenKey, data.access);
      localStorage.setItem(this.refreshKey, data.refresh);
      localStorage.setItem(this.userKey, JSON.stringify(data.user));
      this.currentUser = data.user;

      this.updateAuthHeaderUI();
      this.closeModal('auth-modal');
      this.playChime('success');
      this.showToast(`Welcome back, ${data.user.username}!`, 'success');

      if (data.user.is_staff) {
        this.showSection('admin');
      }
      return true;
    } catch (err) {
      this.showToast(err.message, 'error');
      return false;
    }
  }

  async signup(username, email, password) {
    try {
      const res = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, is_staff: false })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Sign up failed');
      }

      this.showToast('Account created successfully! Signing you in...', 'success');
      return await this.login(username, password);
    } catch (err) {
      this.showToast(err.message, 'error');
      return false;
    }
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshKey);
    localStorage.removeItem(this.userKey);
    this.currentUser = null;
    this.updateAuthHeaderUI();
    this.showToast('Logged out to guest mode.', 'info');
    if (this.currentView === 'admin' || this.currentView === 'tracker') {
      this.showSection('menu');
    }
  }

  async quickLogin(username, password) {
    await this.login(username, password);
  }

  updateAuthHeaderUI() {
    const container = document.getElementById('auth-header-container');
    if (!container) return;

    if (this.currentUser) {
      container.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${this.currentUser.username[0].toUpperCase()}</div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 700; font-size: 0.85rem; line-height: 1.1;">${this.currentUser.username}</span>
            <span style="font-size: 0.7rem; color: ${this.currentUser.is_staff ? 'var(--gold-500)' : 'var(--basil-500)'}; font-weight: 600;">
              ${this.currentUser.is_staff ? '👨‍🍳 Staff' : '🍕 Foodie'}
            </span>
          </div>
          <button style="background: none; border: none; color: var(--text-subtle); cursor: pointer; margin-left: 0.4rem;" onclick="app.logout()" title="Log Out">✕</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn-secondary" onclick="app.openAuthModal('login')">Sign In</button>
      `;
    }
  }

  // ==========================================================================
  // Section Navigation & Views
  // ==========================================================================
  showSection(sectionId) {
    this.currentView = sectionId;

    const sections = ['menu', 'tracker', 'admin'];
    sections.forEach(s => {
      const el = document.getElementById(`${s}-section`);
      const navBtn = document.getElementById(`nav-${s}`);
      if (el) el.style.display = (s === sectionId) ? 'block' : 'none';
      if (navBtn) {
        if (s === sectionId) navBtn.classList.add('active');
        else navBtn.classList.remove('active');
      }
    });

    const hero = document.getElementById('hero-banner');
    if (hero) {
      hero.style.display = (sectionId === 'menu') ? 'grid' : 'none';
    }

    if (sectionId === 'tracker') {
      this.refreshOrderHistory();
    } else if (sectionId === 'admin') {
      if (!this.currentUser || !this.currentUser.is_staff) {
        this.showToast('Kitchen Portal requires Staff permissions. Please log in as admin.', 'info');
        this.openAuthModal('login');
      } else {
        this.fetchStaffData();
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToMenu() {
    this.showSection('menu');
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  // ==========================================================================
  // Menu Fetching & Rendering
  // ==========================================================================
  async fetchMenu() {
    const grid = document.getElementById('pizza-grid-container');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; animation: floatSpin 2s linear infinite; display: inline-block;">🍕</div>
          <p style="margin-top: 1rem; font-weight: 600;">Stoking the wood-fired ovens & loading artisanal pizzas...</p>
        </div>
      `;
    }

    try {
      const res = await fetch('/orders/menu');
      if (!res.ok) throw new Error('Failed to load menu catalog');
      this.menu = await res.json();
      this.renderMenu();
    } catch (err) {
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--danger-500);">
            <p>⚠️ Unable to load menu catalog. Please verify the API connection.</p>
            <button class="btn-secondary" style="margin-top: 1rem;" onclick="app.fetchMenu()">Retry</button>
          </div>
        `;
      }
    }
  }

  filterCategory(category) {
    this.selectedCategory = category;
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => {
      if (p.textContent.toLowerCase().includes(category.toLowerCase()) || 
         (category === 'all' && p.textContent.includes('All'))) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
    this.renderMenu();
  }

  handleSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderMenu();
  }

  renderMenu() {
    const grid = document.getElementById('pizza-grid-container');
    if (!grid) return;

    let filtered = this.menu;

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category.toLowerCase() === this.selectedCategory.toLowerCase());
    }

    if (this.searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(this.searchQuery) ||
        (p.description && p.description.toLowerCase().includes(this.searchQuery)) ||
        (p.ingredients && p.ingredients.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
          <div style="font-size: 2rem;">🔍</div>
          <p style="margin-top: 0.5rem; font-size: 1.1rem; font-weight: 600;">No artisanal pizzas matched "${this.searchQuery}".</p>
          <button class="btn-secondary" style="margin-top: 1rem;" onclick="app.handleSearch(''); document.getElementById('menu-search-input').value='';">Clear Filter</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(pizza => {
      const smallPrice = (pizza.base_price * 0.85).toFixed(2);
      const ingredientsList = (pizza.ingredients || '')
        .split(',')
        .slice(0, 4)
        .map(i => `<span class="ingredient-chip">${i.trim()}</span>`)
        .join('');

      return `
        <div class="pizza-card" data-id="${pizza.id}">
          <div class="card-image-box">
            <img src="${pizza.image_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}" alt="${pizza.name}" class="card-image" loading="lazy">
            ${pizza.badge ? `<div class="card-badge">${pizza.badge}</div>` : ''}
            <div class="card-category-tag">${pizza.category}</div>
          </div>

          <div class="card-content">
            <h3 class="card-title">${pizza.name}</h3>
            <p class="card-description">${pizza.description}</p>
            
            <div class="card-ingredients-row">
              ${ingredientsList}
            </div>

            <!-- Size Selector Pills -->
            <div class="card-size-selector" data-pizza="${pizza.name}" data-base="${pizza.base_price}">
              <button class="size-btn active" onclick="app.onCardSizeChange(this, 'SMALL', 0.85)">S (10")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'MEDIUM', 1.0)">M (12")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'LARGE', 1.25)">L (14")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'EXTRA-LARGE', 1.5)">XL (16")</button>
            </div>

            <div class="card-footer">
              <div class="card-price-box">
                <span class="price-subtext">Price</span>
                <span class="card-price price-display">$${smallPrice}</span>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; border-radius: 10px;" onclick="app.openCustomizerForPizza('${pizza.name}')" title="Customize Crust & Toppings">
                  🛠️ Customize
                </button>
                <button class="card-add-btn" onclick="app.addCardPizzaToCart(this, '${pizza.name}')" title="Quick Add">
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  onCardSizeChange(btn, size, multiplier) {
    const parent = btn.closest('.card-size-selector');
    const basePrice = parseFloat(parent.getAttribute('data-base')) || 14.99;
    parent.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const card = btn.closest('.pizza-card');
    const priceDisplay = card.querySelector('.price-display');
    if (priceDisplay) {
      priceDisplay.textContent = `$${(basePrice * multiplier).toFixed(2)}`;
    }
  }

  addCardPizzaToCart(btn, pizzaName) {
    const card = btn.closest('.pizza-card');
    const selector = card.querySelector('.card-size-selector');
    const activeSizeBtn = selector.querySelector('.size-btn.active');
    const sizeText = activeSizeBtn ? activeSizeBtn.textContent : 'S';
    
    let size = 'SMALL';
    let multiplier = 0.85;
    if (sizeText.startsWith('M')) { size = 'MEDIUM'; multiplier = 1.0; }
    else if (sizeText.startsWith('L')) { size = 'LARGE'; multiplier = 1.25; }
    else if (sizeText.startsWith('XL')) { size = 'EXTRA-LARGE'; multiplier = 1.5; }

    const pizza = this.menu.find(p => p.name === pizzaName);
    const base = pizza ? pizza.base_price : 14.99;
    const unitPrice = parseFloat((base * multiplier).toFixed(2));

    this.addToCart({
      pizza_name: pizzaName,
      pizza_size: size,
      unit_price: unitPrice,
      quantity: 1,
      crust: 'Hand-Tossed Classic',
      extra_toppings: [],
      notes: ''
    });

    this.playChime('pop');
    this.showToast(`Added 1x ${pizzaName} (${size}) to cart!`, 'success');
  }

  // ==========================================================================
  // Customizer Modal Logic ("The Artisan Oven")
  // ==========================================================================
  openCustomizerModal() {
    const defaultPizza = this.menu.length > 0 ? this.menu[0] : { name: 'Margherita Speciale', base_price: 13.99 };
    this.openCustomizerForPizza(defaultPizza.name);
  }

  openCustomizerForPizza(pizzaName) {
    const pizza = this.menu.find(p => p.name === pizzaName) || { name: pizzaName, base_price: 13.99 };
    this.customizerState = {
      basePizza: pizza,
      crust: 'Hand-Tossed Classic',
      crustExtra: 0,
      size: 'SMALL',
      sizeMultiplier: 0.85,
      extraToppings: {},
      notes: ''
    };

    const titleEl = document.getElementById('customizer-pizza-title');
    if (titleEl) titleEl.textContent = `Craft: ${pizza.name}`;

    // Reset Crust cards
    document.querySelectorAll('.crust-card').forEach((c, idx) => {
      c.classList.toggle('selected', idx === 0);
    });

    // Reset Size buttons
    document.querySelectorAll('#customizer-modal .size-btn').forEach((b, idx) => {
      b.classList.toggle('active', idx === 0);
    });

    // Reset Checkboxes
    document.querySelectorAll('#customizer-modal input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    const notesEl = document.getElementById('custom-notes');
    if (notesEl) notesEl.value = '';

    this.recalculateCustomizerPrice();
    this.openModal('customizer-modal');
  }

  selectCrust(card, crustName, extraPrice) {
    document.querySelectorAll('.crust-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this.customizerState.crust = crustName;
    this.customizerState.crustExtra = extraPrice;
    this.recalculateCustomizerPrice();
  }

  selectCustomSize(size, btn) {
    const multipliers = {
      'SMALL': 0.85,
      'MEDIUM': 1.0,
      'LARGE': 1.25,
      'EXTRA-LARGE': 1.5
    };
    document.querySelectorAll('#customizer-modal .size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.customizerState.size = size;
    this.customizerState.sizeMultiplier = multipliers[size] || 1.0;
    this.recalculateCustomizerPrice();
  }

  toggleTopping(name, price, checkbox) {
    if (checkbox.checked) {
      this.customizerState.extraToppings[name] = price;
    } else {
      delete this.customizerState.extraToppings[name];
    }
    this.recalculateCustomizerPrice();
  }

  recalculateCustomizerPrice() {
    const base = this.customizerState.basePizza?.base_price || 13.99;
    const scaledBase = base * this.customizerState.sizeMultiplier;
    const crustAddon = this.customizerState.crustExtra;
    const toppingsAddon = Object.values(this.customizerState.extraToppings).reduce((a, b) => a + b, 0);

    const unitPrice = (scaledBase + crustAddon + toppingsAddon).toFixed(2);
    const display = document.getElementById('customizer-calculated-price');
    if (display) display.textContent = `$${unitPrice}`;
    return parseFloat(unitPrice);
  }

  addCustomizedPizzaToCart() {
    const unitPrice = this.recalculateCustomizerPrice();
    const notesInput = document.getElementById('custom-notes')?.value || '';
    const toppingKeys = Object.keys(this.customizerState.extraToppings);
    
    let combinedNotes = `Crust: ${this.customizerState.crust}`;
    if (toppingKeys.length > 0) {
      combinedNotes += ` | Extras: ${toppingKeys.join(', ')}`;
    }
    if (notesInput.trim()) {
      combinedNotes += ` | Note: ${notesInput.trim()}`;
    }

    this.addToCart({
      pizza_name: this.customizerState.basePizza.name,
      pizza_size: this.customizerState.size,
      unit_price: unitPrice,
      quantity: 1,
      crust: this.customizerState.crust,
      extra_toppings: toppingKeys,
      notes: combinedNotes
    });

    this.closeModal('customizer-modal');
    this.playChime('success');
    this.showToast(`Custom ${this.customizerState.basePizza.name} added to cart!`, 'success');
  }

  // ==========================================================================
  // Shopping Cart & Drawer Management
  // ==========================================================================
  addToCart(item) {
    const existing = this.cart.find(c => 
      c.pizza_name === item.pizza_name && 
      c.pizza_size === item.pizza_size &&
      c.notes === item.notes
    );

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      this.cart.push({ ...item, id: Date.now() + Math.random() });
    }

    this.saveCart();
  }

  updateCartQty(itemId, delta) {
    const item = this.cart.find(c => c.id === itemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(c => c.id !== itemId);
    }
    this.saveCart();
  }

  toggleCartDrawer() {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (!backdrop) return;
    const isOpen = backdrop.classList.contains('open');
    if (isOpen) {
      backdrop.classList.remove('open');
    } else {
      this.renderCart();
      backdrop.classList.add('open');
    }
  }

  closeCartDrawer(event) {
    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  updateCartCountUI() {
    const totalCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    const countEl = document.getElementById('header-cart-count');
    const totalEl = document.getElementById('header-cart-total');

    if (countEl) countEl.textContent = totalCount;
    if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)}`;
  }

  renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div style="font-size: 3rem;">🛒</div>
          <p style="font-weight: 700; font-size: 1.15rem;">Your cart is hungry!</p>
          <p style="font-size: 0.85rem;">Explore our stone-oven menu and craft your perfect pie.</p>
          <button class="btn-primary" style="margin-top: 0.5rem;" onclick="app.toggleCartDrawer(); app.scrollToMenu();">
            Browse Menu
          </button>
        </div>
      `;
      this.updateCartTotals(0);
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item-row">
        <div class="item-info">
          <div class="item-name">${item.pizza_name}</div>
          <div class="item-meta">${item.pizza_size} • $${item.unit_price.toFixed(2)} each</div>
          ${item.notes ? `<div style="font-size: 0.72rem; color: var(--gold-500); margin-top: 0.2rem;">${item.notes}</div>` : ''}
          <div class="item-price">$${(item.unit_price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="app.updateCartQty(${item.id}, -1)">−</button>
          <span style="font-weight: 700; font-size: 0.85rem; min-width: 16px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="app.updateCartQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `).join('');

    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    this.updateCartTotals(subtotal);
  }

  updateCartTotals(subtotal) {
    const subtotalEl = document.getElementById('cart-subtotal');
    const deliveryEl = document.getElementById('cart-delivery-fee');
    const taxEl = document.getElementById('cart-tax');
    const grandTotalEl = document.getElementById('cart-grand-total');

    const deliveryFee = (subtotal === 0 || subtotal >= 25.0) ? 0.0 : 3.99;
    const tax = subtotal * 0.08;
    const grandTotal = subtotal + deliveryFee + tax;

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (deliveryEl) deliveryEl.textContent = deliveryFee === 0 ? 'FREE ($0.00)' : `$${deliveryFee.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
  }

  // ==========================================================================
  // Checkout & Order Placement
  // ==========================================================================
  openCheckoutModal() {
    if (this.cart.length === 0) {
      this.showToast('Your cart is empty. Add a delicious pizza first!', 'info');
      return;
    }

    if (!this.currentUser) {
      this.showToast('Please sign in or register to place your order.', 'info');
      this.openAuthModal('login');
      return;
    }

    // Prefill user details if available
    const addrInput = document.getElementById('checkout-address');
    const phoneInput = document.getElementById('checkout-phone');
    if (addrInput && this.currentUser.default_address) {
      addrInput.value = this.currentUser.default_address;
    }
    if (phoneInput && this.currentUser.phone) {
      phoneInput.value = this.currentUser.phone;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const deliveryFee = (subtotal >= 25.0) ? 0.0 : 3.99;
    const grandTotal = subtotal + deliveryFee + (subtotal * 0.08);

    const totalDisplay = document.getElementById('checkout-modal-total');
    if (totalDisplay) totalDisplay.textContent = `$${grandTotal.toFixed(2)}`;

    this.toggleCartDrawer();
    this.openModal('checkout-modal');
  }

  async handleCheckoutSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('checkout-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span> Dispatching to Kitchen Oven...`;
    }

    const address = document.getElementById('checkout-address')?.value || 'Pickup';
    const phone = document.getElementById('checkout-phone')?.value || 'N/A';
    const notes = document.getElementById('checkout-notes')?.value || '';

    try {
      // Place each unique item or aggregate into an order
      for (const item of this.cart) {
        const fullNotes = item.notes ? `${item.notes} | ${notes}` : notes;
        const payload = {
          pizza_name: item.pizza_name,
          pizza_size: item.pizza_size,
          quantity: item.quantity,
          customer_address: address,
          customer_phone: phone,
          notes: fullNotes
        };

        const res = await this.fetchWithAuth('/orders/order', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to place order');
        }

        const data = await res.json();
        this.activeOrder = data.order;
      }

      this.cart = [];
      this.saveCart();
      this.closeModal('checkout-modal');
      this.playChime('success');
      this.showToast('🍕 Order placed! The wood-fire oven is preheating.', 'success');

      // Navigate to Tracker
      this.showSection('tracker');
      this.refreshOrderHistory();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>🔥</span> Fire Up the Oven & Place Order`;
      }
    }
  }

  // ==========================================================================
  // Live Order Tracker
  // ==========================================================================
  async refreshOrderHistory(notify = true) {
    if (!this.currentUser) return;
    try {
      const res = await this.fetchWithAuth('/orders/user/orders');
      if (res.ok) {
        this.userOrders = await res.json();
        if (this.userOrders.length > 0 && !this.activeOrder) {
          this.activeOrder = this.userOrders[0];
        } else if (this.activeOrder) {
          // Update active order state from fresh data
          const updated = this.userOrders.find(o => o.id === this.activeOrder.id);
          if (updated) this.activeOrder = updated;
        }
        this.renderTracker();
        this.renderUserOrdersList();
        if (notify) this.showToast('Live tracker updated.', 'info');
      }
    } catch (e) {}
  }

  renderTracker() {
    const titleEl = document.getElementById('tracker-order-title');
    const metaEl = document.getElementById('tracker-order-meta');
    const badgeEl = document.getElementById('tracker-order-status-badge');

    if (!this.activeOrder) {
      if (titleEl) titleEl.textContent = 'No Active Order Selected';
      if (metaEl) metaEl.textContent = 'Place an order or click any receipt below to monitor live.';
      if (badgeEl) badgeEl.innerHTML = `<span class="status-badge pending">Awaiting Order</span>`;
      this.updateStepperProgress('NONE');
      return;
    }

    const order = this.activeOrder;
    if (titleEl) titleEl.textContent = `Order #${order.id} — ${order.pizza_name}`;
    if (metaEl) {
      metaEl.textContent = `Size: ${order.pizza_size} • Qty: ${order.quantity} • Total: $${order.total_price.toFixed(2)} • Destination: ${order.customer_address}`;
    }

    const status = order.order_status;
    const statusClasses = {
      'PENDING': 'pending',
      'IN-TRANSIT': 'in-transit',
      'DELIVERED': 'delivered',
      'CANCELLED': 'cancelled'
    };

    if (badgeEl) {
      badgeEl.innerHTML = `<span class="status-badge ${statusClasses[status] || 'pending'}">${status}</span>`;
    }

    this.updateStepperProgress(status);
  }

  updateStepperProgress(status) {
    const stepPending = document.getElementById('step-pending');
    const stepBaking = document.getElementById('step-baking');
    const stepTransit = document.getElementById('step-in-transit');
    const stepDelivered = document.getElementById('step-delivered');

    [stepPending, stepBaking, stepTransit, stepDelivered].forEach(s => {
      if (s) {
        s.classList.remove('active', 'completed');
      }
    });

    if (status === 'PENDING') {
      stepPending?.classList.add('completed');
      stepBaking?.classList.add('active');
    } else if (status === 'IN-TRANSIT') {
      stepPending?.classList.add('completed');
      stepBaking?.classList.add('completed');
      stepTransit?.classList.add('active');
    } else if (status === 'DELIVERED') {
      stepPending?.classList.add('completed');
      stepBaking?.classList.add('completed');
      stepTransit?.classList.add('completed');
      stepDelivered?.classList.add('completed');
    }
  }

  renderUserOrdersList() {
    const container = document.getElementById('user-orders-list');
    if (!container) return;

    if (this.userOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: var(--bg-card); border-radius: 16px;">
          No previous orders found for this account.
        </div>
      `;
      return;
    }

    container.innerHTML = this.userOrders.map(o => `
      <div class="cart-item-row" style="cursor: pointer; ${this.activeOrder?.id === o.id ? 'border-color: var(--flame-500);' : ''}" onclick="app.selectActiveOrder(${o.id})">
        <div>
          <div style="font-weight: 700; font-size: 1rem;">Order #${o.id} — ${o.pizza_name} (${o.pizza_size})</div>
          <div style="font-size: 0.8rem; color: var(--text-subtle);">
            Placed on ${new Date(o.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Qty: ${o.quantity} • $${o.total_price.toFixed(2)}
          </div>
          ${o.notes ? `<div style="font-size: 0.75rem; color: var(--gold-500); margin-top: 0.2rem;">${o.notes}</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="status-badge ${o.order_status.toLowerCase()}">${o.order_status}</span>
          ${o.order_status === 'PENDING' ? `
            <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: var(--danger-500);" onclick="event.stopPropagation(); app.cancelOrder(${o.id})">
              Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  selectActiveOrder(orderId) {
    const found = this.userOrders.find(o => o.id === orderId);
    if (found) {
      this.activeOrder = found;
      this.renderTracker();
      this.renderUserOrdersList();
    }
  }

  async cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel Order #${orderId}?`)) return;
    try {
      const res = await this.fetchWithAuth(`/orders/order/delete/${orderId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Cancellation failed');
      }
      this.showToast(`Order #${orderId} was cancelled.`, 'info');
      this.activeOrder = null;
      this.refreshOrderHistory();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // ==========================================================================
  // Kitchen Staff Admin Portal
  // ==========================================================================
  async fetchStaffData(notify = true) {
    if (!this.currentUser || !this.currentUser.is_staff) return;

    try {
      const [ordersRes, statsRes] = await Promise.all([
        this.fetchWithAuth('/orders/orders'),
        this.fetchWithAuth('/orders/stats')
      ]);

      if (ordersRes.ok && statsRes.ok) {
        this.adminOrders = await ordersRes.json();
        this.adminStats = await statsRes.json();
        this.renderAdminBoard();
        if (notify) this.showToast('Kitchen Dispatch Board refreshed.', 'info');
      }
    } catch (e) {
      this.showToast('Failed to load kitchen dispatch telemetry.', 'error');
    }
  }

  renderAdminBoard() {
    if (this.adminStats) {
      document.getElementById('kpi-revenue').textContent = `$${this.adminStats.total_revenue.toFixed(2)}`;
      document.getElementById('kpi-total-orders').textContent = this.adminStats.total_orders;
      document.getElementById('kpi-pending').textContent = this.adminStats.pending_count;
      document.getElementById('kpi-transit').textContent = this.adminStats.transit_count;
      document.getElementById('kpi-delivered').textContent = this.adminStats.delivered_count;
    }

    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (this.adminOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No orders registered in the system.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.adminOrders.map(o => {
      const statusClasses = {
        'PENDING': 'pending',
        'IN-TRANSIT': 'in-transit',
        'DELIVERED': 'delivered',
        'CANCELLED': 'cancelled'
      };

      return `
        <tr>
          <td><strong style="color: var(--flame-500);">#${o.id}</strong></td>
          <td>
            <div style="font-weight: 600;">${o.user_username || 'Guest Customer'}</div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${o.customer_phone || 'N/A'} • ${o.customer_address}</div>
          </td>
          <td>
            <div style="font-weight: 600;">${o.pizza_name}</div>
            <div style="font-size: 0.75rem; color: var(--gold-500);">${o.pizza_size} ${o.notes ? `• ${o.notes}` : ''}</div>
          </td>
          <td>${o.quantity}</td>
          <td><strong style="color: var(--gold-500);">$${o.total_price.toFixed(2)}</strong></td>
          <td><span class="status-badge ${statusClasses[o.order_status] || 'pending'}">${o.order_status}</span></td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${o.order_status === 'PENDING' ? `
                <button class="btn-primary" style="padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="app.adminUpdateStatus(${o.id}, 'IN-TRANSIT')">
                  Dispatch 🛵
                </button>
              ` : ''}
              ${o.order_status === 'IN-TRANSIT' ? `
                <button class="btn-primary" style="background: var(--basil-500); padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="app.adminUpdateStatus(${o.id}, 'DELIVERED')">
                  Mark Delivered ✅
                </button>
              ` : ''}
              <button class="btn-secondary" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; color: var(--danger-500);" onclick="app.adminDeleteOrder(${o.id})">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async adminUpdateStatus(orderId, newStatus) {
    try {
      const res = await this.fetchWithAuth(`/orders/order/status/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ order_status: newStatus })
      });
      if (!res.ok) throw new Error('Status update failed');
      this.playChime('pop');
      this.showToast(`Order #${orderId} marked as ${newStatus}`, 'success');
      this.fetchStaffData(false);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async adminDeleteOrder(orderId) {
    if (!confirm(`Staff Action: Delete order #${orderId}?`)) return;
    try {
      const res = await this.fetchWithAuth(`/orders/order/delete/${orderId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Delete failed');
      this.showToast(`Order #${orderId} deleted from database.`, 'info');
      this.fetchStaffData(false);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // ==========================================================================
  // Modal Utilities
  // ==========================================================================
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('open');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('open');
  }

  closeModalOnBackdrop(e, modalId) {
    if (e.target.id === modalId) {
      this.closeModal(modalId);
    }
  }

  openAuthModal(tab = 'login') {
    this.switchAuthTab(tab);
    this.openModal('auth-modal');
  }

  switchAuthTab(tab) {
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const emailGroup = document.getElementById('auth-email-group');
    const tabLogin = document.getElementById('auth-tab-login');
    const tabSignup = document.getElementById('auth-tab-signup');

    if (tab === 'login') {
      if (title) title.textContent = 'Sign In to SliceCraft';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (emailGroup) emailGroup.style.display = 'none';
      tabLogin?.classList.add('active');
      tabSignup?.classList.remove('active');
      document.getElementById('auth-form').dataset.mode = 'login';
    } else {
      if (title) title.textContent = 'Create Foodie Account';
      if (submitBtn) submitBtn.textContent = 'Register Account';
      if (emailGroup) emailGroup.style.display = 'block';
      tabSignup?.classList.add('active');
      tabLogin?.classList.remove('active');
      document.getElementById('auth-form').dataset.mode = 'signup';
    }
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('auth-form').dataset.mode || 'login';
    const username = document.getElementById('auth-username')?.value || '';
    const password = document.getElementById('auth-password')?.value || '';
    const email = document.getElementById('auth-email')?.value || '';

    if (mode === 'login') {
      await this.login(username, password);
    } else {
      await this.signup(username, email, password);
    }
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global Application Instance
const app = new SliceCraftApp();
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

