// js/supabase-client.js — Dynamic Supabase Client / Local Mock Fallback

// === BigInt Serialization Fix (prevents JSON.stringify crash) ===
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function() { return this.toString(); };
}

// === Supabase Config ===
const supabaseUrl = 'https://hefijdydpibqbubjrnli.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZmlqZHlkcGlicWJ1YmpybmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTQ3NDcsImV4cCI6MjA4OTkzMDc0N30.ogYSnS7w-b5XW9i3TqS6vh7tnuy2ICisJ6D7ExvPdBw';

// Determine if we should run in Mock Mode (if cached, forced by URL, or remote fails)
const mockForced = window.location.search.includes('mock=true');
const mockCached = localStorage.getItem('supabase_fallback_mock') === 'true';
const useMockMode = mockForced || mockCached;

if (useMockMode) {
  console.log('[SupabaseClient] Initializing in MOCK mode...');
  initMockSupabase();
} else {
  // Initialize real client
  try {
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,   // Critical: lets Supabase pick up ?code= from OAuth callback
        flowType: 'pkce'            // Use PKCE flow (Supabase v2 default for browser)
      }
    });
    console.log('[SupabaseClient] Initialized real Supabase client.');
    
    // Check connectivity asynchronously to activate fallback if remote is offline
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    fetch(`${supabaseUrl}/rest/v1/`, { 
      method: 'GET', 
      headers: { apikey: supabaseKey },
      signal: controller.signal
    })
    .then(res => {
      clearTimeout(timeoutId);
      if (res.ok) {
        console.log('[SupabaseClient] Connectivity check passed. Online.');
        if (mockCached) {
          localStorage.removeItem('supabase_fallback_mock');
        }
      } else {
        console.warn('[SupabaseClient] API returned non-OK status:', res.status);
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      console.warn('[SupabaseClient] Connection check failed. Activating mock fallback:', err.message);
      localStorage.setItem('supabase_fallback_mock', 'true');
      // Reload to let mock mode initialize cleanly for all files
      console.log('[SupabaseClient] Reloading page to apply mock fallback...');
      window.location.reload();
    });
  } catch (err) {
    console.error('[SupabaseClient] Error initializing real client, falling back to mock:', err);
    initMockSupabase();
  }
}

// ============================================================================
// === MOCK SUPABASE CLIENT IMPLEMENTATION ===
// ============================================================================

function initMockSupabase() {
  seedMockData();

  // Mock QueryBuilder for chainable DB calls (select, insert, update, upsert, delete)
  class MockQueryBuilder {
    constructor(table, method, data = null) {
      this.table = table;
      this.method = method; // 'select', 'insert', 'update', 'upsert', 'delete'
      this.filters = [];
      this.orderConfig = null;
      this.isSingle = false;
      this.insertRows = data;
      this.updateData = data;
    }

    select(cols) {
      return this;
    }

    eq(col, val) {
      this.filters.push({ type: 'eq', col, val });
      return this;
    }

    neq(col, val) {
      this.filters.push({ type: 'neq', col, val });
      return this;
    }

    in(col, vals) {
      this.filters.push({ type: 'in', col, vals });
      return this;
    }

    order(col, opts) {
      this.orderConfig = { col, ascending: opts ? opts.ascending : true };
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    async execute() {
      // Fetch table list from localStorage
      let list = JSON.parse(localStorage.getItem(`tah_mock_${this.table}`) || '[]');
      if (list && !Array.isArray(list)) {
        list = [list];
      }

      // JIT Seed products if empty
      if (this.table === 'products' && (!list || list.length === 0)) {
        try {
          console.log('[SupabaseMock] JIT seeding products in execute()...');
          const res = await fetch('/data/products.json');
          const data = await res.json();
          const mapped = data.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            original_price: p.originalPrice || null,
            collection: p.collection || '',
            category: p.category || '',
            material: p.material || '',
            badge: p.badge || null,
            image: p.image || '',
            images: p.images || [p.image],
            description: p.description || '',
            features: p.features || [],
            stock: p.stock !== undefined ? p.stock : 25,
            reorder_level: p.reorderLevel !== undefined ? p.reorderLevel : 5,
            in_stock: p.inStock !== undefined ? p.inStock : true
          }));
          localStorage.setItem('tah_mock_products', JSON.stringify(mapped));
          list = mapped;
        } catch (e) {
          console.error('[SupabaseMock] JIT products seeding failed:', e);
        }
      }

      if (this.method === 'insert') {
        const rows = Array.isArray(this.insertRows) ? this.insertRows : [this.insertRows];
        const maxId = list.length ? Math.max(...list.map(r => r.id || 0)) : 0;
        const newRows = rows.map((r, i) => ({
          id: r.id || (maxId + i + 1),
          created_at: new Date().toISOString(),
          ...r
        }));
        list.push(...newRows);
        localStorage.setItem(`tah_mock_${this.table}`, JSON.stringify(list));
        return { data: newRows, error: null };
      }

      if (this.method === 'update') {
        let updatedCount = 0;
        list = list.map(item => {
          let matches = true;
          for (const filter of this.filters) {
            if (filter.type === 'eq' && item[filter.col] != filter.val) matches = false;
            if (filter.type === 'neq' && item[filter.col] == filter.val) matches = false;
            if (filter.type === 'in' && !filter.vals.map(v => String(v)).includes(String(item[filter.col]))) matches = false;
          }
          if (matches) {
            updatedCount++;
            return { ...item, ...this.updateData };
          }
          return item;
        });
        localStorage.setItem(`tah_mock_${this.table}`, JSON.stringify(list));
        return { data: this.updateData, error: null };
      }

      if (this.method === 'upsert') {
        const rows = Array.isArray(this.updateData) ? this.updateData : [this.updateData];
        for (const row of rows) {
          const idx = list.findIndex(r => r.id == row.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...row };
          } else {
            list.push({ id: row.id || Date.now(), created_at: new Date().toISOString(), ...row });
          }
        }
        localStorage.setItem(`tah_mock_${this.table}`, JSON.stringify(list));
        return { data: rows, error: null };
      }

      if (this.method === 'delete') {
        const remaining = list.filter(item => {
          let matches = true;
          for (const filter of this.filters) {
            if (filter.type === 'eq' && item[filter.col] == filter.val) matches = false;
            if (filter.type === 'neq' && item[filter.col] != filter.val) matches = false;
            if (filter.type === 'in' && filter.vals.map(v => String(v)).includes(String(item[filter.col]))) matches = false;
          }
          return !matches;
        });
        localStorage.setItem(`tah_mock_${this.table}`, JSON.stringify(remaining));
        return { data: null, error: null };
      }

      // Default select
      let result = [...list];
      for (const filter of this.filters) {
        if (filter.type === 'eq') {
          result = result.filter(item => item[filter.col] == filter.val);
        } else if (filter.type === 'neq') {
          result = result.filter(item => item[filter.col] != filter.val);
        } else if (filter.type === 'in') {
          result = result.filter(item => filter.vals.map(v => String(v)).includes(String(item[filter.col])));
        }
      }

      if (this.orderConfig) {
        const { col, ascending } = this.orderConfig;
        result.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) return 0;
          if (valA == null) return 1;
          if (valB == null) return -1;
          const comp = valA < valB ? -1 : 1;
          return ascending ? comp : -comp;
        });
      }

      if (this.isSingle) {
        return { data: result.length ? result[0] : null, error: result.length ? null : { message: 'Row not found' } };
      }

      return { data: result, error: null };
    }

    then(onfulfilled, onrejected) {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  // Mock Authentication Client
  const mockAuth = {
    callbacks: [],

    onAuthStateChange(callback) {
      this.callbacks.push(callback);
      const session = this.getCurrentSession();
      // Trigger callback asynchronously with current session state
      setTimeout(() => {
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.callbacks = this.callbacks.filter(cb => cb !== callback);
            }
          }
        }
      };
    },

    getCurrentSession() {
      const sessionStr = localStorage.getItem('tah_mock_session');
      return sessionStr ? JSON.parse(sessionStr) : null;
    },

    async getSession() {
      return { data: { session: this.getCurrentSession() }, error: null };
    },

    async signInWithPassword({ email, password }) {
      const emailLower = email.toLowerCase();
      const mockUser = {
        id: 'mock-uid-' + emailLower.replace(/[^a-zA-Z0-9]/g, '-'),
        email: emailLower,
        user_metadata: {
          full_name: emailLower.split('@')[0],
          avatar_url: ''
        }
      };
      
      const mockSession = {
        access_token: 'mock-access-token-' + Date.now(),
        user: mockUser,
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      localStorage.setItem('tah_mock_session', JSON.stringify(mockSession));
      
      // Ensure profile exists in local DB
      let profiles = JSON.parse(localStorage.getItem('tah_mock_profiles') || '[]');
      let profile = profiles.find(p => p.id === mockUser.id);
      if (!profile) {
        const isAdmin = emailLower === 'theaccessorieshub2530@gmail.com';
        profile = {
          id: mockUser.id,
          email: emailLower,
          role: isAdmin ? 'admin' : 'user',
          created_at: new Date().toISOString()
        };
        profiles.push(profile);
        localStorage.setItem('tah_mock_profiles', JSON.stringify(profiles));
      }

      this.triggerAuthStateChange('SIGNED_IN', mockSession);
      return { data: { session: mockSession, user: mockUser }, error: null };
    },

    async signUp({ email, password }) {
      return this.signInWithPassword({ email, password });
    },

    async signInWithOAuth({ provider, options }) {
      if (provider === 'google') {
        console.log('[MockAuth] Simulating Google OAuth login...');
        
        // Custom popup or prompt to ask user role
        const defaultEmail = 'theaccessorieshub2530@gmail.com';
        const email = prompt(
          "=== MOCK GOOGLE LOGIN ===\nEnter an email address to log in.\n\nUse: theaccessorieshub2530@gmail.com to test with Administrator privileges.", 
          defaultEmail
        );

        if (!email) {
          return { data: {}, error: { message: 'Authentication cancelled by user' } };
        }

        const emailLower = email.toLowerCase();
        const mockUser = {
          id: 'mock-uid-' + emailLower.replace(/[^a-zA-Z0-9]/g, '-'),
          email: emailLower,
          user_metadata: {
            full_name: emailLower.split('@')[0].toUpperCase(),
            picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
            avatar_url: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
          }
        };

        const mockSession = {
          access_token: 'mock-access-token-' + Date.now(),
          user: mockUser,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        };

        localStorage.setItem('tah_mock_session', JSON.stringify(mockSession));

        // Create profile role
        let profiles = JSON.parse(localStorage.getItem('tah_mock_profiles') || '[]');
        let profile = profiles.find(p => p.id === mockUser.id);
        if (!profile) {
          const isAdmin = emailLower === 'theaccessorieshub2530@gmail.com';
          profile = {
            id: mockUser.id,
            email: emailLower,
            role: isAdmin ? 'admin' : 'user',
            created_at: new Date().toISOString()
          };
          profiles.push(profile);
          localStorage.setItem('tah_mock_profiles', JSON.stringify(profiles));
        }

        this.triggerAuthStateChange('SIGNED_IN', mockSession);

        // Redirect back to options.redirectTo
        const redirectTo = options?.redirectTo || (window.location.origin + '/login');
        const redirectUrl = new URL(redirectTo);
        redirectUrl.searchParams.set('code', 'mock-oauth-code');
        
        console.log('[MockAuth] OAuth success! Redirecting to:', redirectUrl.toString());
        window.location.href = redirectUrl.toString();
        
        return { data: {}, error: null };
      }
      return { data: {}, error: { message: 'Provider not supported in Mock Mode' } };
    },

    async signOut() {
      localStorage.removeItem('tah_mock_session');
      this.triggerAuthStateChange('SIGNED_OUT', null);
      return { error: null };
    },

    triggerAuthStateChange(event, session) {
      this.callbacks.forEach(cb => {
        try { cb(event, session); } catch (e) { console.error(e); }
      });
    }
  };

  // Mock Client Interface
  window.supabase = {
    auth: mockAuth,
    from(table) {
      return {
        select(cols) { return new MockQueryBuilder(table, 'select'); },
        insert(rows) { return new MockQueryBuilder(table, 'insert', rows); },
        update(row) { return new MockQueryBuilder(table, 'update', row); },
        upsert(row) { return new MockQueryBuilder(table, 'upsert', row); },
        delete() { return new MockQueryBuilder(table, 'delete'); }
      };
    },
    channel(name) {
      return {
        on(event, filter, callback) { return this; },
        subscribe() { return this; }
      };
    }
  };
}

// === Seed Mock Database Tables in localStorage ===
function seedMockData() {
  // 1. Seed profiles table
  if (!localStorage.getItem('tah_mock_profiles')) {
    localStorage.setItem('tah_mock_profiles', JSON.stringify([
      { id: 'mock-uid-theaccessorieshub2530-gmail-com', email: 'theaccessorieshub2530@gmail.com', role: 'admin', created_at: new Date().toISOString() }
    ]));
  }

  // 2. Seed products table (Fetch from products.json asynchronously if empty)
  if (!localStorage.getItem('tah_mock_products')) {
    console.log('[SupabaseMock] Seeding products from products.json...');
    fetch('/data/products.json')
      .then(r => r.json())
      .then(data => {
        const mapped = data.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          original_price: p.originalPrice || null,
          collection: p.collection || '',
          category: p.category || '',
          material: p.material || '',
          badge: p.badge || null,
          image: p.image || '',
          images: p.images || [p.image],
          description: p.description || '',
          features: p.features || [],
          stock: p.stock !== undefined ? p.stock : 25,
          reorder_level: p.reorderLevel !== undefined ? p.reorderLevel : 5,
          in_stock: p.inStock !== undefined ? p.inStock : true
        }));
        localStorage.setItem('tah_mock_products', JSON.stringify(mapped));
        console.log('[SupabaseMock] Successfully seeded products!');
        // Refresh products list in localStorage cache used by app.js
        localStorage.removeItem('tah_products_all');
        localStorage.removeItem('tah_products_all_time');
      })
      .catch(err => {
        console.error('[SupabaseMock] Failed to fetch seeds:', err);
      });
  }

  // 3. Seed customers table
  if (!localStorage.getItem('tah_mock_customers')) {
    localStorage.setItem('tah_mock_customers', JSON.stringify([
      { id: 1, name: "Prerna Shah", email: "prerna@gmail.com", phone: "9801234567", address: "Kathmandu", total_orders: 3, total_spent: 12000, join_date: "2026-01-15T10:00:00Z" },
      { id: 2, name: "Aarav Mehta", email: "aarav@hotmail.com", phone: "9851023456", address: "Lalitpur", total_orders: 1, total_spent: 1800, join_date: "2026-02-20T11:30:00Z" },
      { id: 3, name: "Sita Devkota", email: "sita@yahoo.com", phone: "9841567890", address: "Birgunj", total_orders: 5, total_spent: 24500, join_date: "2026-03-05T08:15:00Z" }
    ]));
  }

  // 4. Seed orders table
  if (!localStorage.getItem('tah_mock_orders')) {
    localStorage.setItem('tah_mock_orders', JSON.stringify([
      { id: 1001, customer_name: "Prerna Shah", phone: "9801234567", shipping_address: "Kathmandu", total: 4500, status: "delivered", payment_method: "cod", created_at: "2026-05-10T14:22:00Z", tracking_id: "NP1001" },
      { id: 1002, customer_name: "Sita Devkota", phone: "9841567890", shipping_address: "Birgunj", total: 7600, status: "shipped", payment_method: "esewa", created_at: "2026-05-18T09:11:00Z", tracking_id: "PT2003" },
      { id: 1003, customer_name: "Aarav Mehta", phone: "9851023456", shipping_address: "Lalitpur", total: 1800, status: "pending", payment_method: "cod", created_at: "2026-05-20T17:45:00Z" }
    ]));
  }

  // 5. Seed order items table
  if (!localStorage.getItem('tah_mock_order_items')) {
    localStorage.setItem('tah_mock_order_items', JSON.stringify([
      { id: 1, order_id: 1001, product_id: 1, name: "Royal Temple Necklace Set", price: 4500, qty: 1, image: "images/temple-necklace.webp" },
      { id: 2, order_id: 1002, product_id: 6, name: "Tribal Oxidized Necklace", price: 1650, qty: 2, image: "images/oxidized-necklace.webp" },
      { id: 3, order_id: 1002, product_id: 4, name: "Korean Layered Pendant", price: 1800, qty: 1, image: "images/korean-pendant.webp" },
      { id: 4, order_id: 1003, product_id: 4, name: "Korean Layered Pendant", price: 1800, qty: 1, image: "images/korean-pendant.webp" }
    ]));
  }

  // 6. Seed invoices table
  if (!localStorage.getItem('tah_mock_invoices')) {
    localStorage.setItem('tah_mock_invoices', JSON.stringify([
      { id: 201, order_id: 1001, customer_name: "Prerna Shah", amount: 4500, status: "paid", date: "2026-05-10T14:30:00Z" },
      { id: 202, order_id: 1002, customer_name: "Sita Devkota", amount: 7600, status: "paid", date: "2026-05-18T09:20:00Z" },
      { id: 203, order_id: 1003, customer_name: "Aarav Mehta", amount: 1800, status: "unpaid", date: "2026-05-20T17:45:00Z" }
    ]));
  }

  // 7. Seed stock history table
  if (!localStorage.getItem('tah_mock_stock_history')) {
    localStorage.setItem('tah_mock_stock_history', JSON.stringify([
      { id: 1, product_id: 1, product_name: "Royal Temple Necklace Set", new_stock: 24, change_amount: -1, type: "sale", created_at: "2026-05-10T14:22:00Z" },
      { id: 2, product_id: 6, product_name: "Tribal Oxidized Necklace", new_stock: 18, change_amount: -2, type: "sale", created_at: "2026-05-18T09:11:00Z" },
      { id: 3, product_id: 4, product_name: "Korean Layered Pendant", new_stock: 12, change_amount: -1, type: "sale", created_at: "2026-05-18T09:11:00Z" },
      { id: 4, product_id: 4, product_name: "Korean Layered Pendant", new_stock: 11, change_amount: -1, type: "sale", created_at: "2026-05-20T17:45:00Z" }
    ]));
  }

  // 8. Seed settings table (as an array of one settings object)
  if (!localStorage.getItem('tah_mock_settings')) {
    localStorage.setItem('tah_mock_settings', JSON.stringify([{
      id: 1,
      business_name: "The Accessories Hub",
      business_address: "Birgunj, Nepal",
      business_phone: "+977 9805659501",
      business_email: "theaccessorieshub2530@gmail.com",
      whatsapp_number: "9805659501",
      whatsapp_templates: {
        orderConfirm: "Hello {name}! 🎉 Your order #{orderId} has been confirmed. Total: Rs. {total}. Thank you for shopping with The Accessories Hub! 💎",
        shipped: "Hi {name}! 📦 Great news! Your order #{orderId} has been shipped. Tracking: {tracking}. Expected delivery: 3-5 days.",
        delivered: "Hello {name}! ✅ Your order #{orderId} has been delivered! We hope you love your purchase. Leave us a review! 💛"
      },
      shipping_providers: [
        { name: "Nepal Post", type: "standard", rate: 150, freeAbove: 2000 },
        { name: "Pathao Courier", type: "express", rate: 250, freeAbove: 3000 }
      ]
    }]));
  }
}
