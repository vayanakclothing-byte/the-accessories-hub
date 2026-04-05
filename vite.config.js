import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        checkout: resolve(__dirname, 'checkout.html'),
        login: resolve(__dirname, 'login.html'),
        productDetail: resolve(__dirname, 'product-detail.html'),
        products: resolve(__dirname, 'products.html'),
        requestAccess: resolve(__dirname, 'request-access.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        adminProducts: resolve(__dirname, 'admin/products.html'),
        adminInventory: resolve(__dirname, 'admin/inventory.html'),
        adminOrders: resolve(__dirname, 'admin/orders.html'),
        adminCustomers: resolve(__dirname, 'admin/customers.html'),
        adminInvoices: resolve(__dirname, 'admin/invoices.html'),
        adminSettings: resolve(__dirname, 'admin/settings.html')
      }
    }
  }
});
