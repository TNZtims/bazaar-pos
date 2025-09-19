import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'

// POST /api/seed - Seed the database with sample data
export async function POST() {
  try {
    await connectToDatabase()
    
    // Clear existing products
    await Product.deleteMany({})
    console.log('Cleared existing products')
    
    // ✨ SAMPLE PRODUCTS DATA ✨
    // 🔄 Auto-updated to match current Product schema
    // 
    // Current schema includes:
    // - name: string (required)
    // - cost: number (optional - for profit tracking) 
    // - price: number (required)
    // - quantity: number (required)
    // - category: string (optional)
    // - description: string (optional)
    // - sku: string (optional)
    // - imageUrl: string (optional - S3 ready)
    //
    // 💡 Cost field enables profit margin calculations
    // 🖼️ Image field ready for S3 integration
    // 🍽️ Food & Beverage focused products for restaurants/cafés
    const sampleProducts = [
      // Hot Beverages
      {
        name: 'Espresso Shot',
        cost: 8.00,
        price: 15.00,
        quantity: 200,
        category: 'Hot Beverages',
        description: 'Single shot of rich espresso coffee',
        sku: 'ESP-SHOT'
      },
      {
        name: 'Cappuccino',
        cost: 12.00,
        price: 25.00,
        quantity: 100,
        category: 'Hot Beverages',
        description: 'Classic cappuccino with steamed milk foam',
        sku: 'CAP-REG'
      },
      {
        name: 'Hot Chocolate',
        cost: 15.00,
        price: 30.00,
        quantity: 80,
        category: 'Hot Beverages',
        description: 'Rich hot chocolate with whipped cream',
        sku: 'HOT-CHOC'
      },
      {
        name: 'Green Tea Latte',
        cost: 18.00,
        price: 35.00,
        quantity: 60,
        category: 'Hot Beverages',
        description: 'Matcha green tea with steamed milk',
        sku: 'GT-LATTE'
      },
      
      // Cold Beverages
      {
        name: 'Iced Coffee',
        cost: 10.00,
        price: 20.00,
        quantity: 120,
        category: 'Cold Beverages',
        description: 'Refreshing iced coffee with milk',
        sku: 'ICE-COF'
      },
      {
        name: 'Fresh Orange Juice',
        cost: 20.00,
        price: 40.00,
        quantity: 50,
        category: 'Cold Beverages',
        description: 'Freshly squeezed orange juice',
        sku: 'OJ-FRESH'
      },
      {
        name: 'Mango Smoothie',
        cost: 25.00,
        price: 50.00,
        quantity: 40,
        category: 'Cold Beverages',
        description: 'Creamy mango smoothie with yogurt',
        sku: 'MANGO-SM'
      },
      {
        name: 'Lemonade',
        cost: 12.00,
        price: 25.00,
        quantity: 70,
        category: 'Cold Beverages',
        description: 'Fresh lemonade with mint',
        sku: 'LEMON-ADE'
      },
      
      // Main Dishes
      {
        name: 'Chicken Adobo',
        cost: 45.00,
        price: 85.00,
        quantity: 30,
        category: 'Main Dishes',
        description: 'Filipino chicken adobo with rice',
        sku: 'CHIC-ADO'
      },
      {
        name: 'Beef Burger',
        cost: 60.00,
        price: 120.00,
        quantity: 25,
        category: 'Main Dishes',
        description: 'Juicy beef burger with fries',
        sku: 'BEEF-BURG'
      },
      {
        name: 'Pork Sisig',
        cost: 50.00,
        price: 95.00,
        quantity: 35,
        category: 'Main Dishes',
        description: 'Sizzling pork sisig with egg',
        sku: 'PORK-SIS'
      },
      {
        name: 'Fish & Chips',
        cost: 55.00,
        price: 110.00,
        quantity: 20,
        category: 'Main Dishes',
        description: 'Crispy fish fillet with potato chips',
        sku: 'FISH-CHIP'
      },
      
      // Appetizers & Snacks
      {
        name: 'Spring Rolls (5pcs)',
        cost: 20.00,
        price: 40.00,
        quantity: 50,
        category: 'Appetizers',
        description: 'Crispy spring rolls with sweet chili sauce',
        sku: 'SPR-ROLL5'
      },
      {
        name: 'Chicken Wings (6pcs)',
        cost: 35.00,
        price: 65.00,
        quantity: 40,
        category: 'Appetizers',
        description: 'Buffalo chicken wings with ranch dip',
        sku: 'CHIC-WING6'
      },
      {
        name: 'Nachos with Cheese',
        cost: 25.00,
        price: 50.00,
        quantity: 30,
        category: 'Appetizers',
        description: 'Tortilla chips with melted cheese dip',
        sku: 'NACHO-CHE'
      },
      
      // Desserts
      {
        name: 'Chocolate Cake Slice',
        cost: 18.00,
        price: 40.00,
        quantity: 25,
        category: 'Desserts',
        description: 'Rich chocolate cake with cream frosting',
        sku: 'CHOC-CAKE'
      },
      {
        name: 'Halo-Halo',
        cost: 30.00,
        price: 65.00,
        quantity: 20,
        category: 'Desserts',
        description: 'Traditional Filipino mixed dessert',
        sku: 'HALO-HALO'
      },
      {
        name: 'Ice Cream Sundae',
        cost: 22.00,
        price: 45.00,
        quantity: 35,
        category: 'Desserts',
        description: 'Vanilla ice cream with chocolate sauce',
        sku: 'ICE-SUN'
      },
      
      // Breakfast Items
      {
        name: 'Pancakes (3pcs)',
        cost: 25.00,
        price: 55.00,
        quantity: 40,
        category: 'Breakfast',
        description: 'Fluffy pancakes with maple syrup',
        sku: 'PANC-3PC'
      },
      {
        name: 'Tapsilog',
        cost: 40.00,
        price: 75.00,
        quantity: 30,
        category: 'Breakfast',
        description: 'Beef tapa, fried rice, and egg',
        sku: 'TAPSILOG'
      }
    ]
    
    // Insert sample products
    const insertedProducts = await Product.insertMany(sampleProducts)
    console.log(`Inserted ${insertedProducts.length} sample products`)
    
    console.log('Database seeded successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      productsCreated: insertedProducts.length,
      schemaVersion: 'v2.2 - Food & Beverage Focus',
      features: [
        'Cost field for profit calculations',
        'Image support with S3-ready URLs',
        'Food & beverage focused inventory',
        'Restaurant/café product selection',
        'Realistic profit margins (50-100%)',
        'Comprehensive F&B categories'
      ],
      sampleCategories: [...new Set(sampleProducts.map(p => p.category))].sort()
    }, { status: 200 })
    
  } catch (error: any) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { success: false, message: 'Error seeding database', error: error.message },
      { status: 500 }
    )
  }
}
