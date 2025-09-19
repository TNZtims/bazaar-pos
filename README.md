# POS System - Pure Next.js SSR

A complete Point of Sale (POS) system built with **pure Next.js** using Server-Side Rendering, API Routes, and MongoDB.

## 🚀 **Tech Stack**

- **Framework**: Next.js 14 with App Router
- **Backend**: Next.js API Routes (no separate Express server)
- **Database**: MongoDB with Mongoose ODM
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Deployment**: Fully self-contained Next.js app

## ✨ **Features**

### 📦 **Product Management**
- ✅ Complete CRUD operations (Create, Read, Update, Delete)
- ✅ Product search and filtering
- ✅ Stock management with low-stock alerts
- ✅ Categories and SKU support
- ✅ Responsive product grid/table view

### 💰 **Sales & Checkout**
- ✅ Interactive shopping cart
- ✅ Real-time stock validation
- ✅ Multiple payment methods (Cash, Card, Digital)
- ✅ Tax and discount calculations
- ✅ Customer information capture
- ✅ Automatic inventory updates

### 📊 **Reports & Analytics**
- ✅ Daily sales summaries
- ✅ Top-selling products (last 30 days)
- ✅ Recent sales history
- ✅ Revenue tracking
- ✅ Average order value

### 📱 **Responsive Design**
- ✅ Mobile-first approach
- ✅ Collapsible sidebar navigation
- ✅ Adaptive layouts for all screen sizes
- ✅ Touch-friendly interface

## 🏗️ **Project Structure**

```
my-pos/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes (Backend)
│   │   │   ├── products/      # Product CRUD endpoints
│   │   │   ├── sales/         # Sales management
│   │   │   ├── reports/       # Analytics endpoints
│   │   │   └── seed/          # Database seeding
│   │   ├── products/          # Product management page
│   │   ├── sales/             # Sales & checkout page
│   │   ├── reports/           # Reports dashboard
│   │   └── page.tsx           # Dashboard homepage
│   ├── components/            # Reusable UI components
│   │   └── Layout.tsx         # Main app layout
│   ├── lib/                   # Utilities
│   │   └── mongodb.ts         # Database connection
│   ├── models/                # MongoDB schemas
│   │   ├── Product.ts         # Product model
│   │   └── Sale.ts            # Sale model
│   └── scripts/               # Utility scripts
│       └── seed.ts            # Sample data seeder
├── package.json
├── tailwind.config.ts
└── README.md
```

## 🛠️ **Setup Instructions**

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (local installation or MongoDB Atlas)

### Installation

1. **Clone & install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/pos_db
   ```
   
   For MongoDB Atlas, use your connection string:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pos_db
   ```

3. **Start MongoDB**:
   - **Local**: Ensure MongoDB service is running
   - **Atlas**: Connection string should be configured in `.env.local`

4. **Run the application**:
   ```bash
   npm run dev
   ```
   
   The app will be available at: http://localhost:3000

### 🌱 **Initial Setup**

1. **Open the dashboard** at http://localhost:3000
2. **Click "Add Sample Products"** to populate the database with sample data
3. **Start using the POS system!**

## 📋 **API Endpoints**

### Products
- `GET /api/products` - List products (with search & pagination)
- `POST /api/products` - Create product
- `GET /api/products/[id]` - Get single product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

### Sales
- `GET /api/sales` - List sales (with date filtering)
- `POST /api/sales` - Create sale (auto-updates inventory)

### Reports
- `GET /api/reports/daily?date=YYYY-MM-DD` - Daily sales report
- `GET /api/reports/top-products` - Top selling products
- `GET /api/reports/profit?period=30&startDate=&endDate=` - Profit analytics

### Utilities
- `POST /api/seed` - Seed database with sample products

## 🎯 **Usage Guide**

### **Dashboard**
- View key metrics and quick stats
- Access quick actions for common tasks
- First-time setup with sample data

### **Products Page**
- ➕ Add new products with full details
- ✏️ Edit existing products
- 🗑️ Delete products
- 🔍 Search and filter products
- 📊 Visual stock level indicators

### **Sales Page**
- 🛒 Browse products and add to cart
- 🔢 Adjust quantities in cart
- 💳 Choose payment method
- 🧾 Add customer information and notes
- ✅ Complete sale with automatic stock updates

### **Reports Page**
- 📅 Select date for daily reports
- 📈 View sales performance metrics
- 🏆 See top-selling products
- 📋 Browse recent sales history

## 🎨 **Design Features**

- **Mobile-First**: Optimized for mobile and tablet usage
- **Responsive Grid**: Products display in grid on desktop, list on mobile
- **Collapsible Sidebar**: Navigation adapts to screen size
- **Touch-Friendly**: Large buttons and intuitive gestures
- **Visual Feedback**: Loading states, success messages, error handling

## 🔧 **Development**

### **Adding New Features**
1. **API Routes**: Add new endpoints in `src/app/api/`
2. **Database Models**: Extend models in `src/models/`
3. **UI Pages**: Create new pages in `src/app/`
4. **Components**: Add reusable components in `src/components/`

### **Database Schema**

#### Product Model
```typescript
{
  name: string (required)
  price: number (required)
  quantity: number (required)
  description?: string
  category?: string
  sku?: string (unique)
  timestamps: true
}
```

#### Sale Model
```typescript
{
  items: [
    {
      product: ObjectId (ref: Product)
      productName: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }
  ]
  totalAmount: number
  tax: number
  discount: number
  finalAmount: number
  paymentMethod: 'cash' | 'card' | 'digital'
  customerName?: string
  notes?: string
  timestamps: true
}
```

## 🚀 **Production Deployment**

### **Vercel (Recommended)**
1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically

### **Other Platforms**
1. Build the application: `npm run build`
2. Start production server: `npm start`
3. Ensure MongoDB connection is available

## 📱 **Mobile Experience**

The POS system is fully optimized for mobile devices:
- **Touch-friendly interface**
- **Responsive layouts** that adapt to screen size
- **Optimized performance** for mobile networks
- **Offline-ready** (with service worker - can be added)

## 🆘 **Troubleshooting**

### Common Issues:
1. **MongoDB Connection**: Ensure MongoDB is running and connection string is correct
2. **Environment Variables**: Check `.env.local` file exists and has correct values
3. **Build Errors**: Clear `.next` folder and run `npm run build` again

### Reset Database:
- Use the "Add Sample Products" button to reset with fresh data
- Or manually clear: Connect to MongoDB and drop the `pos_db` database

## 🎉 **What's Great About This Approach**

✅ **Single Codebase**: Everything in one Next.js app  
✅ **Easy Deployment**: Deploy anywhere Next.js runs  
✅ **Better Performance**: Server-side rendering + client interactions  
✅ **Simplified Development**: No separate backend to manage  
✅ **Modern Stack**: Latest Next.js 15 with App Router  
✅ **Production Ready**: Built with TypeScript and best practices  
✅ **Data Consistency**: MongoDB transactions for reliable operations  
✅ **Profit Analytics**: Built-in cost tracking and profit margin analysis  
✅ **Enhanced Theme System**: Proper light/dark mode with persistence  

This pure Next.js approach gives you all the benefits of a full-stack application while maintaining the simplicity of a single deployment!

## 🔥 **Recent Enhancements (v2.0)**

### **Data Integrity & Performance**
- ✅ **MongoDB Transactions**: All sales operations now use atomic transactions
- ✅ **Enhanced Connection Pooling**: Optimized database connections with proper error handling
- ✅ **Type Safety**: Resolved all TypeScript compilation errors

### **Business Intelligence**
- ✅ **Profit Analytics API**: New `/api/reports/profit` endpoint
- ✅ **Cost Tracking**: Full integration of product cost in profit calculations
- ✅ **Margin Analysis**: Identify most and least profitable products
- ✅ **Revenue Insights**: Comprehensive financial reporting

### **Developer Experience**
- ✅ **Environment Setup**: Automated environment configuration with `npm run setup`
- ✅ **API Helpers**: Centralized error handling and response utilities
- ✅ **Enhanced Validation**: Better input validation and error messages
- ✅ **Type Checking**: Added `npm run type-check` script

### **UI/UX Improvements**
- ✅ **Fixed Theme System**: Proper light/dark mode toggle with localStorage persistence
- ✅ **Removed Debug Code**: Cleaned up production console logs

## 🚀 **Quick Start (Enhanced)**

1. **Setup Environment**:
   ```bash
   npm install
   npm run setup
   ```

2. **Start Development**:
   ```bash
   npm run dev
   ```

3. **Open & Initialize**:
   - Visit: http://localhost:3000
   - Click "Add Sample Products"
   - Start using the enhanced POS system!