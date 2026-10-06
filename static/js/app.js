/**
 * SliceCraft Artisanal Pizza Delivery - Front-End Application Controller
 * High-performance Single Page Application (SPA) with reactive state, stone-oven preloader,
 * Rupee pricing, SliceWallet, Promo Coupons, Address Book, and GST-compliant Tax Invoices.
 */

class SliceCraftApp {
  constructor() {
    this.tokenKey = 'slicecraft_access_token';
    this.refreshKey = 'slicecraft_refresh_token';
    this.userKey = 'slicecraft_user';
    this.cartKey = 'slicecraft_cart';
    this.soundKey = 'slicecraft_sound_enabled';

    // Reactive Application State
    this.currentUser = null;
    this.menu = [];
    this.cart = [];
    this.savedAddresses = [];
    this.coupons = [];
    this.walletData = { balance: 0.0, transactions: [] };
    this.selectedAddressId = null;
    this.appliedCoupon = null; // { code, discount, discount_type }
    this.orderMode = 'DELIVERY'; // 'DELIVERY' or 'TAKEAWAY'
    this.paymentMethod = 'COD'; // 'COD' or 'WALLET'
    this.isVegOnly = false;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    
    // Live Tracker & Staff State
    this.activeOrder = null;
    this.userOrders = [];
    this.adminOrders = [];
    this.adminStats = null;
    this.currentView = 'menu';
    this.selectedRelicIndex = 0;

    // Pizza Crafter Modal State
    this.customizerState = {
      basePizza: null,
      crust: 'Hand-Tossed Classic',
      crustExtra: 0,
      size: 'SMALL',
      sizeMultiplier: 0.85,
      extraToppings: {},
      notes: ''
    };

    // Web Audio Synthesizer State
    this.audioCtx = null;
    this.soundEnabled = localStorage.getItem(this.soundKey) !== 'false';
  }

  // ==========================================================================
  // Initialization & Preloader Flow
  // ==========================================================================
  init() {
    this.initPreloader();
    this.loadPersistedAuth();
    this.loadPersistedCart();
    this.updateSoundButtonUI();
    this.fetchMenu();
    this.fetchCoupons();

    if (this.currentUser) {
      this.fetchAddresses();
      this.fetchWallet();
      this.refreshOrderHistory(false);
    }

    this.updateAuthHeaderUI();
    this.updateCartCountUI();

    // Auto-polling for real-time dispatch updates
    setInterval(() => {
      if (this.currentView === 'tracker' && this.currentUser) {
        this.refreshOrderHistory(false);
      } else if (this.currentView === 'admin' && this.currentUser?.is_staff) {
        this.fetchStaffData(false);
      }
    }, 10000);
  }

  initPreloader() {
    const preloader = document.getElementById('app-preloader');
    const bar = document.getElementById('preloader-bar');
    const status = document.getElementById('preloader-status');
    if (!preloader) return;

    const stages = [
      { pct: 25, msg: 'Preheating stone deck to 500°C...' },
      { pct: 55, msg: 'Rolling 72-hour fermented sourdough...' },
      { pct: 85, msg: 'Stoking imported beechwood embers...' },
      { pct: 100, msg: 'Artisanal Pizzeria Ready!' }
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < stages.length) {
        const stage = stages[current];
        if (bar) bar.style.width = `${stage.pct}%`;
        if (status) status.textContent = stage.msg;
        current++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          preloader.classList.add('fade-out');
          setTimeout(() => preloader.remove(), 600);
        }, 350);
      }
    }, 280);
  }

  // ==========================================================================
  // Synthesized Web Audio Feedback (Zero External Dependencies)
  // ==========================================================================
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem(this.soundKey, this.soundEnabled);
    this.updateSoundButtonUI();
    this.showToast(this.soundEnabled ? 'Audio feedback enabled 🔊' : 'Audio feedback muted 🔇', 'info');
    if (this.soundEnabled) this.playChime('pop');
  }

  updateSoundButtonUI() {
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) btn.textContent = this.soundEnabled ? '🔊' : '🔇';
  }

  playChime(type = 'success') {
    if (!this.soundEnabled) return;
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

      const now = this.audioCtx.currentTime;
      if (type === 'success') {
        // Melodic ascending two-tone chime
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start();
        osc.stop(now + 0.35);
      } else if (type === 'pop') {
        // Subtle crisp UI pop
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start();
        osc.stop(now + 0.09);
      } else if (type === 'coins') {
        // Coin top-up jingle
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start();
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Audio autoplay policy or unsupported - ignore safely
    }
  }

  playLuteArpeggio() {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const now = this.audioCtx.currentTime;
      // Renaissance Lute / Ancient Harp Harmonic Cadence: A3, C4, E4, A4, B4, C5
      const notes = [220, 261.63, 329.63, 440, 493.88, 523.25];
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle'; // Warm acoustic plucked string timbre
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.09, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.6);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.65);
      });
    } catch (e) {}
  }

  // ==========================================================================
  // Persistent Auth & LocalStorage
  // ==========================================================================
  loadPersistedAuth() {
    try {
      const stored = localStorage.getItem(this.userKey);
      if (stored) this.currentUser = JSON.parse(stored);
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

    // Handle token refresh on 401
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

      // Fetch user specific datasets
      this.fetchAddresses();
      this.fetchWallet();
      this.refreshOrderHistory(false);

      if (data.user.is_staff) {
        this.showSection('admin');
      } else {
        this.showSection('menu');
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

      this.showToast('Account created! Credited ₹500 SliceWallet welcome bonus! 🎉', 'success');
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
    this.walletData = { balance: 0.0, transactions: [] };
    this.savedAddresses = [];
    this.updateAuthHeaderUI();
    this.showToast('Logged out to Guest Mode.', 'info');
    if (this.currentView === 'admin' || this.currentView === 'wallet' || this.currentView === 'addresses') {
      this.showSection('menu');
    }
  }

  async quickLogin(username, password) {
    await this.login(username, password);
  }

  updateAuthHeaderUI() {
    const container = document.getElementById('auth-header-container');
    const walletPill = document.getElementById('header-wallet-pill');
    const adminNavBtn = document.getElementById('nav-admin');

    if (!container) return;

    if (this.currentUser) {
      container.innerHTML = `
        <div class="user-badge" onclick="app.showSection('wallet')">
          <div class="user-avatar">${this.currentUser.username[0].toUpperCase()}</div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 700; font-size: 0.85rem; line-height: 1.1;">${this.currentUser.username}</span>
            <span style="font-size: 0.7rem; color: ${this.currentUser.is_staff ? 'var(--crust-gold)' : 'var(--basil-leaf)'}; font-weight: 700;">
              ${this.currentUser.is_staff ? '👨‍🍳 Staff Admin' : '🍕 Foodie'}
            </span>
          </div>
          <button style="background: none; border: none; color: var(--text-subtle); cursor: pointer; margin-left: 0.35rem;" onclick="event.stopPropagation(); app.logout()" title="Log Out">✕</button>
        </div>
      `;

      if (walletPill) {
        walletPill.style.display = 'block';
        const amtEl = document.getElementById('header-wallet-amount');
        if (amtEl) amtEl.textContent = `₹${(this.currentUser.wallet_balance || 0).toFixed(2)}`;
      }

      if (adminNavBtn) {
        adminNavBtn.style.display = this.currentUser.is_staff ? 'flex' : 'none';
      }
    } else {
      container.innerHTML = `
        <button class="btn-secondary" onclick="app.openAuthModal('login')">Sign In</button>
      `;
      if (walletPill) walletPill.style.display = 'none';
      if (adminNavBtn) adminNavBtn.style.display = 'none';
    }
  }

  // ==========================================================================
  // Section Navigation & RBAC Guard
  // ==========================================================================
  showSection(sectionId) {
    // RBAC Security Check
    if (sectionId === 'admin') {
      if (!this.currentUser || !this.currentUser.is_staff) {
        this.showToast('Kitchen Portal is restricted to Kitchen Staff only. Please sign in as admin.', 'error');
        this.openAuthModal('login');
        return;
      }
    } else if (sectionId === 'wallet' || sectionId === 'addresses') {
      if (!this.currentUser) {
        this.showToast('Please sign in to access your SliceWallet & Saved Addresses.', 'info');
        this.openAuthModal('login');
        return;
      }
    }

    this.currentView = sectionId;

    const sections = ['menu', 'gallery', 'deals', 'wallet', 'addresses', 'tracker', 'admin'];
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

    // Refresh Section Data
    if (sectionId === 'gallery') {
      this.renderGallery();
      this.playLuteArpeggio();
    } else if (sectionId === 'tracker') {
      this.refreshOrderHistory();
    } else if (sectionId === 'admin') {
      this.fetchStaffData();
    } else if (sectionId === 'wallet') {
      this.fetchWallet();
    } else if (sectionId === 'addresses') {
      this.fetchAddresses();
    } else if (sectionId === 'deals') {
      this.fetchCoupons();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToMenu() {
    this.showSection('menu');
    const el = document.getElementById('menu-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  // ==========================================================================
  // Order Mode (Delivery vs Takeaway)
  // ==========================================================================
  setOrderMode(mode) {
    this.orderMode = mode;
    const delBtn = document.getElementById('mode-delivery-btn');
    const takeBtn = document.getElementById('mode-takeaway-btn');

    if (mode === 'DELIVERY') {
      delBtn?.classList.add('active');
      takeBtn?.classList.remove('active');
      this.showToast('🛵 Delivery selected (Free above ₹399, hot in 25m)', 'info');
    } else {
      takeBtn?.classList.add('active');
      delBtn?.classList.remove('active');
      this.showToast('🛍️ Takeaway selected (₹0 Delivery Fee, ready in 15m)', 'info');
    }

    this.renderCart();
  }

  // ==========================================================================
  // Mythical & Historical Pizza Art Gallery ("The Hall of Legends")
  // ==========================================================================
  getGalleryRelics() {
    if (!this.menu || this.menu.length === 0) return [];
    const relics = this.menu.filter(p => p.origin_year || p.mythical_lore);
    return relics.length > 0 ? relics : this.menu;
  }

  renderGallery() {
    const relics = this.getGalleryRelics();
    if (relics.length === 0) return;

    if (this.selectedRelicIndex >= relics.length) {
      this.selectedRelicIndex = 0;
    }
    const relic = relics[this.selectedRelicIndex];

    // Update Grand 3D Exhibition Stage
    const imgEl = document.getElementById('stage-relic-image');
    const eraEl = document.getElementById('stage-relic-era');
    const sealEl = document.getElementById('stage-wax-seal');
    const titleEl = document.getElementById('stage-relic-title');
    const metaEl = document.getElementById('stage-relic-meta');
    const storyEl = document.getElementById('stage-relic-story');
    const notesEl = document.getElementById('stage-relic-notes');
    const priceEl = document.getElementById('stage-relic-price');

    if (imgEl) imgEl.src = relic.image_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80';
    if (eraEl) eraEl.innerHTML = `<span>📜</span> ${relic.era || 'Antiquity Relic'}`;
    
    // Choose wax seal icon
    const seals = { 1889: '👑', 1734: '⚓', 1905: '🌋', 1533: '⚜️', 1950: '🇮🇳', 1920: '⚔️', 1981: '✨' };
    if (sealEl) sealEl.textContent = seals[relic.origin_year] || '📜';

    if (titleEl) titleEl.textContent = relic.name;
    if (metaEl) {
      metaEl.innerHTML = `
        <span>${relic.legend_badge || 'Historical Relic'}</span> • 
        <span>Anno ${relic.origin_year || 1889}</span> • 
        <span style="color: ${relic.is_veg ? 'var(--basil-leaf)' : 'var(--tomato-red)'}; font-weight: 700;">
          ${relic.is_veg ? '🟢 Pure Veg' : '🔴 Non-Veg'}
        </span>
      `;
    }

    const lore = relic.mythical_lore || relic.description || 'Crafted in the sacred Neapolitan wood-fired ovens of antiquity.';
    if (storyEl) {
      storyEl.innerHTML = `<span class="drop-cap">${lore[0]}</span>${lore.slice(1)}`;
    }

    if (notesEl) {
      notesEl.textContent = relic.flavor_notes || 'Volcanic char, 72-hour sourdough, sweet plum marinara, melted dairy';
    }

    if (priceEl) {
      priceEl.textContent = `₹${relic.base_price.toFixed(2)}`;
    }

    // Render Relics Selector Grid
    const selectorGrid = document.getElementById('relics-selector-grid');
    if (selectorGrid) {
      selectorGrid.innerHTML = relics.map((r, idx) => `
        <div class="relic-pill-card ${idx === this.selectedRelicIndex ? 'active' : ''}" onclick="app.selectRelic(${idx})">
          <div>
            <div class="relic-year-tag">Anno ${r.origin_year || 1889}</div>
            <div style="font-weight: 800; font-size: 1rem; color: #fff;">${r.name}</div>
            <div style="font-size: 0.78rem; color: var(--crust-gold); margin-top: 0.2rem;">${r.legend_badge || r.era || 'Artisanal Relic'}</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 1rem; border-top: 1px dashed rgba(245, 158, 11, 0.2); padding-top: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-subtle);">${r.category}</span>
            <span style="font-weight: 900; color: var(--crust-gold); font-size: 1.1rem;">₹${r.base_price.toFixed(2)}</span>
          </div>
        </div>
      `).join('');
    }
  }

  selectRelic(idx) {
    this.selectedRelicIndex = idx;
    this.renderGallery();
    this.playLuteArpeggio();
    const stage = document.getElementById('gallery-exhibition-stage');
    if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  summonRelicToCart() {
    const relics = this.getGalleryRelics();
    const relic = relics[this.selectedRelicIndex] || relics[0];
    if (!relic) return;

    this.addToCart({
      pizza_name: relic.name,
      pizza_size: 'MEDIUM',
      unit_price: relic.base_price,
      quantity: 1,
      crust: 'Hand-Tossed Classic',
      extra_toppings: [],
      notes: `Mythical Relic: Anno ${relic.origin_year || 1889} | ${relic.legend_badge || ''}`
    });

    this.playChime('success');
    this.showToast(`⚔️ Summoned ${relic.name} from antiquity to your cart!`, 'success');
    this.toggleCartDrawer();
  }

  customizeSelectedRelic() {
    const relics = this.getGalleryRelics();
    const relic = relics[this.selectedRelicIndex] || relics[0];
    if (!relic) return;
    this.openCustomizerForPizza(relic.name);
  }

  // ==========================================================================
  // Menu Fetching, Filtering & Search
  // ==========================================================================
  async fetchMenu() {
    const grid = document.getElementById('pizza-grid-container');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; animation: preloaderSpin 2s linear infinite; display: inline-block;">🍕</div>
          <p style="margin-top: 1rem; font-weight: 600;">Stoking the wood-fired ovens & fetching fresh menu...</p>
        </div>
      `;
    }

    try {
      const res = await fetch('/orders/menu');
      if (!res.ok) throw new Error('Failed to load menu');
      this.menu = await res.json();
      this.renderMenu();
      this.renderGallery();
    } catch (err) {
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--tomato-red);">
            <p>⚠️ Unable to load menu catalog. Please check backend connection.</p>
            <button class="btn-secondary" style="margin-top: 1rem;" onclick="app.fetchMenu()">Retry</button>
          </div>
        `;
      }
    }
  }

  toggleVegFilter() {
    this.isVegOnly = !this.isVegOnly;
    const sw = document.getElementById('veg-only-switch');
    if (sw) sw.classList.toggle('active', this.isVegOnly);
    this.playChime('pop');
    this.renderMenu();
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
    this.playChime('pop');
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

    // Filter by pure veg
    if (this.isVegOnly) {
      filtered = filtered.filter(p => p.is_veg === true);
    }

    // Filter by Category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }

    // Filter by Search Query
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
          <div style="font-size: 2.5rem;">🔍</div>
          <p style="margin-top: 0.5rem; font-size: 1.15rem; font-weight: 700;">No culinary items match your filter.</p>
          <button class="btn-secondary" style="margin-top: 1rem;" onclick="app.isVegOnly=false; app.selectedCategory='all'; app.searchQuery=''; app.renderMenu();">Reset All Filters</button>
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

      const vegDotClass = pizza.is_veg ? 'veg-icon-dot' : 'non-veg-icon-dot';

      return `
        <div class="pizza-card" data-id="${pizza.id}">
          <div class="card-image-box">
            <img src="${pizza.image_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80'}" alt="${pizza.name}" class="card-image" loading="lazy">
            ${pizza.badge ? `<div class="card-badge">${pizza.badge}</div>` : ''}
            <div class="veg-indicator-badge">
              <div class="${vegDotClass}"></div>
            </div>
          </div>

          <div class="card-content">
            <div class="card-title-row">
              <h3 class="card-title">${pizza.name}</h3>
              <div class="card-rating">★ ${(pizza.rating || 4.8).toFixed(1)}</div>
            </div>
            
            ${pizza.origin_year ? `<div style="font-size: 0.72rem; color: var(--crust-gold); font-weight: 800; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.35rem;"><span>📜</span> Anno ${pizza.origin_year} • ${pizza.legend_badge || pizza.era || 'Artisanal Recipe'}</div>` : ''}

            <p class="card-description">${pizza.description || ''}</p>
            
            <div class="card-ingredients-row">
              ${ingredientsList}
            </div>

            <!-- Size Selector Buttons -->
            <div class="card-size-selector" data-pizza="${pizza.name}" data-base="${pizza.base_price}">
              <button class="size-btn active" onclick="app.onCardSizeChange(this, 'SMALL', 0.85)">S (10")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'MEDIUM', 1.0)">M (12")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'LARGE', 1.35)">L (14")</button>
              <button class="size-btn" onclick="app.onCardSizeChange(this, 'EXTRA-LARGE', 1.65)">XL (16")</button>
            </div>

            <div class="card-footer">
              <div class="card-price-box">
                <span class="price-subtext">Starting Price</span>
                <span class="card-price price-display">₹${smallPrice}</span>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-secondary" style="padding: 0.45rem 0.75rem; font-size: 0.82rem; border-radius: 10px;" onclick="app.openCustomizerForPizza('${pizza.name}')" title="Customize Crust & Toppings">
                  🛠️ Customize
                </button>
                <button class="card-add-btn" onclick="app.addCardPizzaToCart(this, '${pizza.name}')" title="Quick Add to Order">
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
    const basePrice = parseFloat(parent.getAttribute('data-base')) || 349.0;
    parent.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const card = btn.closest('.pizza-card');
    const priceDisplay = card.querySelector('.price-display');
    if (priceDisplay) {
      priceDisplay.textContent = `₹${(basePrice * multiplier).toFixed(2)}`;
    }
  }

  addCardPizzaToCart(btn, pizzaName) {
    const card = btn.closest('.pizza-card');
    const selector = card.querySelector('.card-size-selector');
    const activeSizeBtn = selector?.querySelector('.size-btn.active');
    const sizeText = activeSizeBtn ? activeSizeBtn.textContent : 'S';
    
    let size = 'SMALL';
    let multiplier = 0.85;
    if (sizeText.startsWith('M')) { size = 'MEDIUM'; multiplier = 1.0; }
    else if (sizeText.startsWith('L')) { size = 'LARGE'; multiplier = 1.35; }
    else if (sizeText.startsWith('XL')) { size = 'EXTRA-LARGE'; multiplier = 1.65; }

    const pizza = this.menu.find(p => p.name === pizzaName);
    const base = pizza ? pizza.base_price : 349.0;
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
    const defaultPizza = this.menu.length > 0 ? this.menu[0] : { name: 'Margherita Speciale D.O.P.', base_price: 299.0 };
    this.openCustomizerForPizza(defaultPizza.name);
  }

  openCustomizerForPizza(pizzaName) {
    const pizza = this.menu.find(p => p.name === pizzaName) || { name: pizzaName, base_price: 349.0 };
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
      'LARGE': 1.35,
      'EXTRA-LARGE': 1.65
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
    const base = this.customizerState.basePizza?.base_price || 349.0;
    const scaledBase = base * this.customizerState.sizeMultiplier;
    const crustAddon = this.customizerState.crustExtra;
    const toppingsAddon = Object.values(this.customizerState.extraToppings).reduce((a, b) => a + b, 0);

    const unitPrice = (scaledBase + crustAddon + toppingsAddon).toFixed(2);
    const display = document.getElementById('customizer-calculated-price');
    if (display) display.textContent = `₹${unitPrice}`;
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
    if (totalEl) totalEl.textContent = `₹${subtotal.toFixed(2)}`;
  }

  renderCart() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3rem;">🛒</div>
          <p style="font-weight: 800; font-size: 1.15rem; color: var(--text-main); margin-top: 0.5rem;">Your cart is hungry!</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Explore our stone-oven menu and craft your perfect pie.</p>
          <button class="btn-primary" style="margin-top: 1rem;" onclick="app.toggleCartDrawer(); app.scrollToMenu();">
            Browse Artisanal Menu
          </button>
        </div>
      `;
      this.updateCartTotals(0);
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item-row">
        <div class="item-info">
          <div class="item-name" style="font-weight: 700; font-size: 0.95rem;">${item.pizza_name}</div>
          <div class="item-meta" style="font-size: 0.78rem; color: var(--text-subtle);">${item.pizza_size} • ₹${item.unit_price.toFixed(2)} each</div>
          ${item.notes ? `<div style="font-size: 0.72rem; color: var(--crust-gold); margin-top: 0.2rem;">${item.notes}</div>` : ''}
          <div class="item-price" style="font-weight: 800; color: var(--cheese-melt); margin-top: 0.35rem;">₹${(item.unit_price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="app.updateCartQty(${item.id}, -1)">−</button>
          <span style="font-weight: 800; font-size: 0.85rem; min-width: 18px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="app.updateCartQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `).join('');

    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    this.updateCartTotals(subtotal);
  }

  updateCartTotals(subtotal) {
    const subtotalEl = document.getElementById('cart-subtotal');
    const discountRow = document.getElementById('cart-discount-row');
    const discountEl = document.getElementById('cart-discount');
    const deliveryEl = document.getElementById('cart-delivery-fee');
    const deliveryLabel = document.getElementById('cart-delivery-label');
    const taxEl = document.getElementById('cart-tax');
    const grandTotalEl = document.getElementById('cart-grand-total');

    // Free delivery progress meter
    const freeThreshold = 399.0;
    const meter = document.getElementById('cart-delivery-meter');
    const meterText = document.getElementById('free-delivery-text');
    const meterPct = document.getElementById('free-delivery-percent');
    const meterBar = document.getElementById('free-delivery-bar');

    if (this.orderMode === 'TAKEAWAY') {
      if (meter) meter.style.display = 'none';
    } else {
      if (meter) meter.style.display = 'block';
      if (subtotal >= freeThreshold) {
        if (meterText) meterText.textContent = '🎉 You unlocked FREE Delivery!';
        if (meterPct) meterPct.textContent = '100%';
        if (meterBar) meterBar.style.width = '100%';
      } else {
        const remaining = (freeThreshold - subtotal).toFixed(2);
        const pct = Math.min(100, Math.round((subtotal / freeThreshold) * 100));
        if (meterText) meterText.textContent = `Add ₹${remaining} for FREE Delivery`;
        if (meterPct) meterPct.textContent = `${pct}%`;
        if (meterBar) meterBar.style.width = `${pct}%`;
      }
    }

    // Delivery fee calculation
    let deliveryFee = 0.0;
    if (this.orderMode === 'DELIVERY') {
      deliveryFee = (subtotal === 0 || subtotal >= freeThreshold) ? 0.0 : 49.0;
      if (deliveryLabel) deliveryLabel.textContent = 'Free over ₹399';
    } else {
      deliveryFee = 0.0;
      if (deliveryLabel) deliveryLabel.textContent = 'Takeaway Free';
    }

    // Coupon discount calculation
    let discount = 0.0;
    if (this.appliedCoupon && subtotal >= (this.appliedCoupon.min_order_amount || 0)) {
      if (this.appliedCoupon.discount_type === 'PERCENTAGE') {
        discount = (subtotal * this.appliedCoupon.discount_value) / 100.0;
        if (this.appliedCoupon.max_discount && discount > this.appliedCoupon.max_discount) {
          discount = this.appliedCoupon.max_discount;
        }
      } else {
        discount = this.appliedCoupon.discount_value;
      }
    } else if (this.appliedCoupon && subtotal < (this.appliedCoupon.min_order_amount || 0)) {
      this.appliedCoupon = null;
      this.updateAppliedCouponUI();
    }

    discount = Math.min(discount, subtotal);
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = discountedSubtotal * 0.05; // 5% GST
    const grandTotal = discountedSubtotal + deliveryFee + tax;

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    if (discountRow) {
      discountRow.style.display = discount > 0 ? 'flex' : 'none';
      if (discountEl) discountEl.textContent = `−₹${discount.toFixed(2)}`;
    }
    if (deliveryEl) deliveryEl.textContent = deliveryFee === 0 ? 'FREE (₹0.00)' : `₹${deliveryFee.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `₹${tax.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toFixed(2)}`;
  }

  // ==========================================================================
  // Promo Coupon Engine
  // ==========================================================================
  async fetchCoupons() {
    try {
      const res = await fetch('/orders/coupons');
      if (res.ok) {
        this.coupons = await res.json();
        this.renderCouponsHub();
      }
    } catch (e) {}
  }

  renderCouponsHub() {
    const container = document.getElementById('deals-grid-container');
    if (!container) return;

    if (this.coupons.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1;">No active promo coupons right now.</p>`;
      return;
    }

    container.innerHTML = this.coupons.map(c => `
      <div class="coupon-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="coupon-code-badge">${c.code}</div>
            <span style="font-size: 0.75rem; background: rgba(34, 197, 94, 0.15); color: #86efac; padding: 0.2rem 0.5rem; border-radius: 6px; font-weight: 700;">ACTIVE</span>
          </div>
          <div style="font-size: 0.95rem; font-weight: 700; margin: 0.6rem 0 0.25rem;">${c.description}</div>
          <div style="font-size: 0.78rem; color: var(--text-subtle);">
            ${c.min_order_amount > 0 ? `Min. Order: ₹${c.min_order_amount.toFixed(2)}` : 'No minimum order'}
            ${c.max_discount ? ` • Max Discount: ₹${c.max_discount.toFixed(2)}` : ''}
          </div>
        </div>
        <button class="btn-primary" style="padding: 0.55rem; font-size: 0.85rem;" onclick="app.applyCouponDirect('${c.code}')">
          🎟️ Apply Code
        </button>
      </div>
    `).join('');
  }

  applyCouponDirect(code) {
    const input = document.getElementById('cart-coupon-input');
    if (input) input.value = code;
    this.applyCoupon(code);
    this.toggleCartDrawer();
  }

  async applyCouponFromCart() {
    const code = document.getElementById('cart-coupon-input')?.value?.trim().toUpperCase();
    if (!code) {
      this.showToast('Please enter a coupon code', 'info');
      return;
    }
    await this.applyCoupon(code);
  }

  async applyCoupon(code) {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    if (subtotal === 0) {
      this.showToast('Please add items to your cart before applying a coupon.', 'info');
      return;
    }

    try {
      const res = await fetch('/orders/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, order_amount: subtotal })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid or expired coupon');
      }

      this.appliedCoupon = data;
      this.updateAppliedCouponUI();
      this.renderCart();
      this.playChime('success');
      this.showToast(`🎉 Coupon ${code} applied! You save ₹${data.discount.toFixed(2)}!`, 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  removeCoupon() {
    this.appliedCoupon = null;
    const input = document.getElementById('cart-coupon-input');
    if (input) input.value = '';
    this.updateAppliedCouponUI();
    this.renderCart();
    this.showToast('Coupon removed.', 'info');
  }

  updateAppliedCouponUI() {
    const pill = document.getElementById('applied-coupon-pill');
    const name = document.getElementById('applied-coupon-name');
    if (this.appliedCoupon && pill && name) {
      name.textContent = this.appliedCoupon.code;
      pill.style.display = 'flex';
    } else if (pill) {
      pill.style.display = 'none';
    }
  }

  // ==========================================================================
  // SliceWallet & Loyalty Points
  // ==========================================================================
  async fetchWallet() {
    if (!this.currentUser) return;
    try {
      const res = await this.fetchWithAuth('/auth/wallet');
      if (res.ok) {
        this.walletData = await res.json();
        this.currentUser.wallet_balance = this.walletData.balance;
        localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
        
        const balEl = document.getElementById('wallet-display-balance');
        const headerAmt = document.getElementById('header-wallet-amount');
        const chkAmt = document.getElementById('checkout-wallet-bal-text');

        if (balEl) balEl.textContent = `₹${this.walletData.balance.toFixed(2)}`;
        if (headerAmt) headerAmt.textContent = `₹${this.walletData.balance.toFixed(2)}`;
        if (chkAmt) chkAmt.textContent = `Balance: ₹${this.walletData.balance.toFixed(2)}`;

        this.renderWalletTransactions();
      }
    } catch (e) {}
  }

  renderWalletTransactions() {
    const tbody = document.getElementById('wallet-tx-tbody');
    if (!tbody) return;

    if (!this.walletData.transactions || this.walletData.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No wallet transactions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.walletData.transactions.map(tx => {
      const isCredit = tx.transaction_type === 'CREDIT';
      const formattedDate = new Date(tx.created_at || Date.now()).toLocaleString();
      return `
        <tr>
          <td><strong style="color: var(--text-subtle);">#${tx.id}</strong></td>
          <td>${formattedDate}</td>
          <td><span class="status-badge ${isCredit ? 'delivered' : 'cancelled'}">${tx.transaction_type}</span></td>
          <td>${tx.description || 'Wallet Transaction'}</td>
          <td class="${isCredit ? 'tx-credit' : 'tx-debit'}">
            ${isCredit ? '+' : '−'}₹${tx.amount.toFixed(2)}
          </td>
          <td><strong>₹${tx.balance_after.toFixed(2)}</strong></td>
        </tr>
      `;
    }).join('');
  }

  openWalletTopupModal() {
    if (!this.currentUser) {
      this.openAuthModal('login');
      return;
    }
    this.openModal('wallet-modal');
  }

  setTopupAmount(amt, chipEl) {
    document.querySelectorAll('.topup-chip').forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');
    const input = document.getElementById('wallet-topup-input');
    if (input) input.value = amt;
  }

  async submitWalletTopup() {
    const input = document.getElementById('wallet-topup-input');
    const amount = parseFloat(input?.value) || 0;
    if (amount <= 0) {
      this.showToast('Please enter a valid top-up amount', 'info');
      return;
    }

    try {
      const res = await this.fetchWithAuth('/auth/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Top-up failed');

      this.closeModal('wallet-modal');
      this.playChime('coins');
      this.showToast(`₹${amount.toFixed(2)} added to your SliceWallet!`, 'success');
      this.fetchWallet();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // ==========================================================================
  // Saved Address Book
  // ==========================================================================
  async fetchAddresses() {
    if (!this.currentUser) return;
    try {
      const res = await this.fetchWithAuth('/auth/addresses');
      if (res.ok) {
        this.savedAddresses = await res.json();
        this.renderAddressBook();
        this.renderCheckoutAddressPicker();
      }
    } catch (e) {}
  }

  renderAddressBook() {
    const container = document.getElementById('addresses-grid-container');
    if (!container) return;

    if (this.savedAddresses.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--card-bg); border-radius: 16px;">
          <p style="color: var(--text-muted); font-size: 1rem;">No saved addresses found. Add an address for instant 1-tap checkout!</p>
          <button class="btn-primary" style="margin-top: 1rem;" onclick="app.openAddressModal()">Add Address</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.savedAddresses.map(a => `
      <div class="address-card ${a.is_default ? 'is-default' : ''}">
        <div class="address-tag">${a.tag || 'Home'}</div>
        ${a.is_default ? `<span style="font-size: 0.75rem; color: var(--crust-gold); font-weight: 800; float: right;">★ DEFAULT</span>` : ''}
        <div style="font-weight: 700; font-size: 1.05rem; margin-top: 0.35rem;">${a.line1}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">${a.landmark}</div>
        <div style="font-size: 0.85rem; color: var(--text-subtle);">${a.city}, ${a.state} — ${a.pincode}</div>
        
        <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
          ${!a.is_default ? `
            <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="app.setDefaultAddress(${a.id})">
              Make Default
            </button>
          ` : ''}
          <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; color: var(--tomato-red);" onclick="app.deleteAddress(${a.id})">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  }

  renderCheckoutAddressPicker() {
    const picker = document.getElementById('checkout-address-picker');
    const input = document.getElementById('checkout-address');
    if (!picker) return;

    if (this.savedAddresses.length === 0) {
      picker.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-subtle);">No saved addresses. Enter address below:</p>`;
      return;
    }

    picker.innerHTML = this.savedAddresses.map(a => {
      const isSel = (this.selectedAddressId === a.id) || (!this.selectedAddressId && a.is_default);
      if (isSel && input) {
        input.value = `${a.line1}, ${a.landmark}, ${a.city} - ${a.pincode}`;
      }
      return `
        <div class="checkout-address-card ${isSel ? 'selected' : ''}" onclick="app.selectCheckoutAddress(${a.id})">
          <div>
            <div style="font-weight: 800; font-size: 0.88rem;">${a.tag}: ${a.line1}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${a.landmark}, ${a.city} - ${a.pincode}</div>
          </div>
          <span style="font-size: 0.85rem; color: var(--crust-gold); font-weight: 800;">${isSel ? '✓' : ''}</span>
        </div>
      `;
    }).join('');
  }

  selectCheckoutAddress(id) {
    this.selectedAddressId = id;
    const a = this.savedAddresses.find(addr => addr.id === id);
    if (a) {
      const input = document.getElementById('checkout-address');
      if (input) input.value = `${a.line1}, ${a.landmark}, ${a.city} - ${a.pincode}`;
    }
    this.renderCheckoutAddressPicker();
  }

  openAddressModal() {
    if (!this.currentUser) {
      this.openAuthModal('login');
      return;
    }
    this.openModal('address-modal');
  }

  async handleSaveAddress(e) {
    e.preventDefault();
    const tag = document.getElementById('addr-tag')?.value || 'Home';
    const line1 = document.getElementById('addr-line1')?.value || '';
    const landmark = document.getElementById('addr-landmark')?.value || '';
    const city = document.getElementById('addr-city')?.value || 'Bengaluru';
    const pincode = document.getElementById('addr-pincode')?.value || '560038';
    const is_default = document.getElementById('addr-is-default')?.checked || false;

    try {
      const res = await this.fetchWithAuth('/auth/addresses', {
        method: 'POST',
        body: JSON.stringify({ tag, line1, landmark, city, pincode, state: 'Karnataka', is_default })
      });
      if (!res.ok) throw new Error('Failed to save address');

      this.closeModal('address-modal');
      this.playChime('success');
      this.showToast('Delivery address saved to address book!', 'success');
      this.fetchAddresses();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async setDefaultAddress(id) {
    try {
      const res = await this.fetchWithAuth(`/auth/addresses/${id}/default`, { method: 'PUT' });
      if (res.ok) {
        this.showToast('Default address updated.', 'info');
        this.fetchAddresses();
      }
    } catch (e) {}
  }

  async deleteAddress(id) {
    if (!confirm('Are you sure you want to remove this address?')) return;
    try {
      const res = await this.fetchWithAuth(`/auth/addresses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.showToast('Address removed.', 'info');
        this.fetchAddresses();
      }
    } catch (e) {}
  }

  // ==========================================================================
  // Checkout & Order Placement
  // ==========================================================================
  selectPaymentMethod(method) {
    this.paymentMethod = method;
    const codRadio = document.querySelector('input[name="payment_method"][value="COD"]');
    const walRadio = document.querySelector('input[name="payment_method"][value="WALLET"]');
    const hint = document.getElementById('checkout-payment-hint');

    if (method === 'COD') {
      if (codRadio) codRadio.checked = true;
      if (hint) hint.textContent = '⚡ Payment: Cash on Delivery / Counter Tap';
    } else {
      if (walRadio) walRadio.checked = true;
      if (hint) hint.textContent = '⚡ Payment: Instant deduction from SliceWallet';
    }
  }

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
    const phoneInput = document.getElementById('checkout-phone');
    if (phoneInput && this.currentUser.phone) {
      phoneInput.value = this.currentUser.phone;
    }

    this.renderCheckoutAddressPicker();

    // Recalculate totals
    const subtotal = this.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const freeThreshold = 399.0;
    const deliveryFee = (this.orderMode === 'TAKEAWAY' || subtotal >= freeThreshold) ? 0.0 : 49.0;
    
    let discount = 0.0;
    if (this.appliedCoupon) {
      if (this.appliedCoupon.discount_type === 'PERCENTAGE') {
        discount = (subtotal * this.appliedCoupon.discount_value) / 100.0;
        if (this.appliedCoupon.max_discount && discount > this.appliedCoupon.max_discount) {
          discount = this.appliedCoupon.max_discount;
        }
      } else {
        discount = this.appliedCoupon.discount_value;
      }
    }
    const discounted = Math.max(0, subtotal - discount);
    const grandTotal = discounted + deliveryFee + (discounted * 0.05);

    const totalDisplay = document.getElementById('checkout-modal-total');
    if (totalDisplay) totalDisplay.textContent = `₹${grandTotal.toFixed(2)}`;

    this.toggleCartDrawer();
    this.openModal('checkout-modal');
  }

  async handleCheckoutSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('checkout-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span> Preheating Oven & Booking Order...`;
    }

    const address = document.getElementById('checkout-address')?.value || 'Takeaway Counter';
    const phone = document.getElementById('checkout-phone')?.value || '9876543210';
    const notes = document.getElementById('checkout-notes')?.value || '';

    // Validate phone number
    if (!/^[6-9]\d{9}$/.test(phone)) {
      this.showToast('Please enter a valid 10-digit Indian phone number (starting 6-9).', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>🔥</span> Fire Up the Stone Oven & Place Order`;
      }
      return;
    }

    try {
      for (const item of this.cart) {
        const fullNotes = item.notes ? `${item.notes} | ${notes}` : notes;
        const payload = {
          pizza_name: item.pizza_name,
          pizza_size: item.pizza_size,
          quantity: item.quantity,
          customer_address: address,
          customer_phone: phone,
          notes: fullNotes,
          order_type: this.orderMode,
          payment_method: this.paymentMethod,
          coupon_code: this.appliedCoupon ? this.appliedCoupon.code : null
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
      this.appliedCoupon = null;
      this.saveCart();
      this.closeModal('checkout-modal');
      this.playChime('success');
      this.showToast('🍕 Stone-oven order fired up successfully!', 'success');

      // Refresh wallet & navigate to tracker
      this.fetchWallet();
      this.showSection('tracker');
      this.refreshOrderHistory();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>🔥</span> Fire Up the Stone Oven & Place Order`;
      }
    }
  }

  // ==========================================================================
  // Live Order Tracker & Dispatch Telemetry
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
    const courierInfo = document.getElementById('tracker-courier-info');
    const invoiceBtn = document.getElementById('tracker-invoice-btn');

    if (!this.activeOrder) {
      if (titleEl) titleEl.textContent = 'No Active Order Selected';
      if (metaEl) metaEl.textContent = 'Place an order or select any past receipt below to view live telemetry.';
      if (badgeEl) badgeEl.innerHTML = `<span class="status-badge pending">Awaiting Selection</span>`;
      if (courierInfo) courierInfo.style.display = 'none';
      if (invoiceBtn) invoiceBtn.style.display = 'none';
      this.updateStepperProgress('NONE');
      return;
    }

    const order = this.activeOrder;
    if (titleEl) titleEl.textContent = `Order #${order.id} — ${order.pizza_name}`;
    if (metaEl) {
      metaEl.textContent = `Size: ${order.pizza_size} • Qty: ${order.quantity} • Total: ₹${order.total_price.toFixed(2)} • Destination: ${order.customer_address}`;
    }

    if (courierInfo) {
      courierInfo.style.display = 'block';
      courierInfo.textContent = `🛵 Dispatch Courier: ${order.delivery_partner_name || 'Ramesh Kumar'} (${order.delivery_partner_phone || '9876543210'}) • Payment: ${order.payment_method}`;
    }

    if (invoiceBtn) {
      invoiceBtn.style.display = 'inline-flex';
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
      if (s) s.classList.remove('active', 'completed');
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
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: var(--card-bg); border-radius: 16px;">
          No previous orders found for this account.
        </div>
      `;
      return;
    }

    container.innerHTML = this.userOrders.map(o => `
      <div class="cart-item-row" style="cursor: pointer; ${this.activeOrder?.id === o.id ? 'border-color: var(--crust-gold);' : ''}" onclick="app.selectActiveOrder(${o.id})">
        <div>
          <div style="font-weight: 800; font-size: 1rem;">Order #${o.id} — ${o.pizza_name} (${o.pizza_size})</div>
          <div style="font-size: 0.8rem; color: var(--text-subtle);">
            ${new Date(o.created_at || Date.now()).toLocaleString()} • Qty: ${o.quantity} • <strong>₹${o.total_price.toFixed(2)}</strong> • Paid via ${o.payment_method}
          </div>
          ${o.coupon_code ? `<span style="font-size: 0.72rem; color: #86efac; font-weight: 700;">Coupon: ${o.coupon_code}</span>` : ''}
          ${o.notes ? `<div style="font-size: 0.75rem; color: var(--crust-gold); margin-top: 0.2rem;">${o.notes}</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="status-badge ${o.order_status.toLowerCase()}">${o.order_status}</span>
          <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="event.stopPropagation(); app.openInvoiceModal(${o.id})">
            🧾 Invoice
          </button>
          ${o.order_status === 'PENDING' ? `
            <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; color: var(--tomato-red);" onclick="event.stopPropagation(); app.cancelOrder(${o.id})">
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
    if (!confirm(`Are you sure you want to cancel Order #${orderId}? If paid with SliceWallet, the amount will be immediately refunded.`)) return;
    try {
      const res = await this.fetchWithAuth(`/orders/order/delete/${orderId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Cancellation failed');
      }
      this.showToast(`Order #${orderId} cancelled. Wallet refund processed if applicable.`, 'info');
      this.activeOrder = null;
      this.fetchWallet();
      this.refreshOrderHistory();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  // ==========================================================================
  // Itemized Tax Invoice Generator Modal
  // ==========================================================================
  openInvoiceModal(orderId) {
    const order = this.userOrders.find(o => o.id === orderId) || this.adminOrders.find(o => o.id === orderId) || this.activeOrder;
    if (!order) {
      this.showToast('Invoice details unavailable', 'error');
      return;
    }

    const container = document.getElementById('invoice-printable');
    if (!container) return;

    const subtotal = order.subtotal || order.total_price;
    const discount = order.discount_amount || 0.0;
    const deliveryFee = order.delivery_fee || 0.0;
    const tax = order.tax_amount || (subtotal * 0.05);
    const grandTotal = order.total_price;
    const cgst = (tax / 2).toFixed(2);
    const sgst = (tax / 2).toFixed(2);

    container.innerHTML = `
      <div class="invoice-card">
        <div class="invoice-header">
          <div>
            <div class="invoice-brand">
              <span>🍕</span> SliceCraft Pizzeria
            </div>
            <div class="invoice-tax-meta">
              Stone-Deck Wood-Fired Kitchen Dispatch<br>
              <strong>GSTIN:</strong> 29AABCU9603R1ZM | <strong>FSSAI Lic:</strong> 11224333000554<br>
              100-Ft Road, Indiranagar, Bengaluru, Karnataka 560038
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 1.15rem; color: #0f172a;">TAX INVOICE</div>
            <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">Invoice #: INV-${order.id.toString().padStart(6, '0')}</div>
            <div style="font-size: 0.82rem; color: #64748b;">Date: ${new Date(order.created_at || Date.now()).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem;">
          <div>
            <strong style="color: #475569;">Billed To:</strong>
            <div style="font-weight: 700; color: #0f172a;">${order.user_username || this.currentUser?.username || 'Customer'}</div>
            <div>Phone: ${order.customer_phone || 'N/A'}</div>
            <div>Address: ${order.customer_address}</div>
          </div>
          <div style="text-align: right;">
            <strong style="color: #475569;">Order Details:</strong>
            <div>Order ID: #${order.id}</div>
            <div>Order Mode: <strong>${order.order_type || 'DELIVERY'}</strong></div>
            <div>Payment: <strong>${order.payment_method} (${order.payment_status || 'PAID'})</strong></div>
            <div>Courier: ${order.delivery_partner_name || 'Ramesh Kumar'}</div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Rate (₹)</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${order.pizza_name}</strong>
                ${order.notes ? `<div style="font-size: 0.72rem; color: #64748b;">${order.notes}</div>` : ''}
              </td>
              <td>${order.pizza_size}</td>
              <td>${order.quantity}</td>
              <td>₹${(subtotal / order.quantity).toFixed(2)}</td>
              <td style="text-align: right;">₹${subtotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <table class="invoice-summary-table">
          <tr>
            <td>Item Subtotal:</td>
            <td style="text-align: right; font-weight: 600;">₹${subtotal.toFixed(2)}</td>
          </tr>
          ${discount > 0 ? `
            <tr style="color: #16a34a;">
              <td>Discount (${order.coupon_code || 'Promo'}):</td>
              <td style="text-align: right; font-weight: 600;">−₹${discount.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td>Delivery Fee:</td>
            <td style="text-align: right; font-weight: 600;">₹${deliveryFee.toFixed(2)}</td>
          </tr>
          <tr>
            <td>CGST (2.5%):</td>
            <td style="text-align: right;">₹${cgst}</td>
          </tr>
          <tr>
            <td>SGST (2.5%):</td>
            <td style="text-align: right;">₹${sgst}</td>
          </tr>
          <tr class="invoice-total-row">
            <td>Grand Total (INR):</td>
            <td style="text-align: right;">₹${grandTotal.toFixed(2)}</td>
          </tr>
        </table>

        <div style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 1.5rem; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem;">
          Thank you for choosing SliceCraft Wood-Fired Pizzeria! This is a computer generated tax invoice.
        </div>
      </div>
    `;

    this.openModal('invoice-modal');
  }

  // ==========================================================================
  // Kitchen Staff Admin Portal (Strict RBAC Guarded)
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
      const revEl = document.getElementById('kpi-revenue');
      const totEl = document.getElementById('kpi-total-orders');
      const pendEl = document.getElementById('kpi-pending');
      const tranEl = document.getElementById('kpi-transit');
      const delEl = document.getElementById('kpi-delivered');

      if (revEl) revEl.textContent = `₹${this.adminStats.total_revenue.toFixed(2)}`;
      if (totEl) totEl.textContent = this.adminStats.total_orders;
      if (pendEl) pendEl.textContent = this.adminStats.pending_count;
      if (tranEl) tranEl.textContent = this.adminStats.transit_count;
      if (delEl) delEl.textContent = this.adminStats.delivered_count;
    }

    const tbody = document.getElementById('admin-orders-tbody');
    if (!tbody) return;

    if (this.adminOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem;">No orders registered in the system.</td></tr>`;
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
          <td><strong style="color: var(--crust-gold);">#${o.id}</strong></td>
          <td>
            <div style="font-weight: 700;">${o.user_username || 'Guest Customer'}</div>
            <div style="font-size: 0.75rem; color: var(--text-subtle);">${o.customer_phone || 'N/A'} • ${o.customer_address}</div>
          </td>
          <td><span style="font-size: 0.75rem; font-weight: 700;">${o.order_type || 'DELIVERY'}</span></td>
          <td>
            <div style="font-weight: 700;">${o.pizza_name}</div>
            <div style="font-size: 0.75rem; color: var(--crust-gold);">${o.pizza_size} ${o.notes ? `• ${o.notes}` : ''}</div>
          </td>
          <td><strong>${o.quantity}</strong></td>
          <td><strong style="color: var(--crust-gold);">₹${o.total_price.toFixed(2)}</strong></td>
          <td><span style="font-size: 0.75rem;">${o.payment_method}</span></td>
          <td><span class="status-badge ${statusClasses[o.order_status] || 'pending'}">${o.order_status}</span></td>
          <td>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${o.order_status === 'PENDING' ? `
                <button class="btn-primary" style="padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="app.adminUpdateStatus(${o.id}, 'IN-TRANSIT')">
                  Dispatch 🛵
                </button>
              ` : ''}
              ${o.order_status === 'IN-TRANSIT' ? `
                <button class="btn-primary" style="background: var(--basil-green); padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="app.adminUpdateStatus(${o.id}, 'DELIVERED')">
                  Mark Delivered ✅
                </button>
              ` : ''}
              <button class="btn-secondary" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;" onclick="app.openInvoiceModal(${o.id})" title="Print Invoice">
                🧾
              </button>
              <button class="btn-secondary" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; color: var(--tomato-red);" onclick="app.adminDeleteOrder(${o.id})" title="Delete Order">
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
      this.showToast(`Order #${orderId} updated to ${newStatus}`, 'success');
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
      const form = document.getElementById('auth-form');
      if (form) form.dataset.mode = 'login';
    } else {
      if (title) title.textContent = 'Create Foodie Account';
      if (submitBtn) submitBtn.textContent = 'Register (Get ₹500 SliceWallet Bonus)';
      if (emailGroup) emailGroup.style.display = 'block';
      tabSignup?.classList.add('active');
      tabLogin?.classList.remove('active');
      const form = document.getElementById('auth-form');
      if (form) form.dataset.mode = 'signup';
    }
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('auth-form')?.dataset.mode || 'login';
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
