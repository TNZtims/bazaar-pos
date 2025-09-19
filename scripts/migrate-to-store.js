const { MongoClient } = require('mongodb')
const bcrypt = require('bcryptjs')

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pos-system'
const DEFAULT_STORE_NAME = 'My Store'
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = 'password123'

async function migrateToStore() {
  console.log('🚀 Starting migration to multi-store system...')
  
  const client = new MongoClient(MONGODB_URI)
  
  try {
    await client.connect()
    console.log('✅ Connected to MongoDB')
    
    const db = client.db()
    
    // Check if stores collection exists and has data
    const storesCount = await db.collection('stores').countDocuments()
    
    let defaultStoreId
    
    if (storesCount === 0) {
      console.log('📦 Creating default store...')
      
      // Hash the default password
      const salt = await bcrypt.genSalt(12)
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, salt)
      
      // Create default store
      const defaultStore = {
        name: DEFAULT_STORE_NAME,
        credentials: {
          username: DEFAULT_USERNAME,
          password: hashedPassword
        },
        settings: {
          currency: 'PHP',
          taxRate: 0,
          timezone: 'Asia/Manila',
          businessHours: {
            open: '09:00',
            close: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          }
        },
        subscription: {
          plan: 'basic',
          status: 'active'
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const storeResult = await db.collection('stores').insertOne(defaultStore)
      defaultStoreId = storeResult.insertedId
      
      console.log(`✅ Created default store with ID: ${defaultStoreId}`)
      console.log(`   Username: ${DEFAULT_USERNAME}`)
      console.log(`   Password: ${DEFAULT_PASSWORD}`)
    } else {
      // Get the first store as default
      const firstStore = await db.collection('stores').findOne({})
      defaultStoreId = firstStore._id
      console.log(`📌 Using existing store: ${firstStore.name} (${defaultStoreId})`)
    }
    
    // Migrate products
    const productsCount = await db.collection('products').countDocuments({ storeId: { $exists: false } })
    if (productsCount > 0) {
      console.log(`🔄 Migrating ${productsCount} products...`)
      
      const productsResult = await db.collection('products').updateMany(
        { storeId: { $exists: false } },
        { 
          $set: { 
            storeId: defaultStoreId,
            updatedAt: new Date()
          } 
        }
      )
      
      console.log(`✅ Migrated ${productsResult.modifiedCount} products`)
    } else {
      console.log('ℹ️  No products to migrate')
    }
    
    // Migrate sales
    const salesCount = await db.collection('sales').countDocuments({ storeId: { $exists: false } })
    if (salesCount > 0) {
      console.log(`🔄 Migrating ${salesCount} sales...`)
      
      const salesResult = await db.collection('sales').updateMany(
        { storeId: { $exists: false } },
        { 
          $set: { 
            storeId: defaultStoreId,
            updatedAt: new Date()
          } 
        }
      )
      
      console.log(`✅ Migrated ${salesResult.modifiedCount} sales`)
    } else {
      console.log('ℹ️  No sales to migrate')
    }
    
    console.log('\n🎉 Migration completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Go to http://localhost:3000/login')
    console.log(`2. Login with username: ${DEFAULT_USERNAME}`)
    console.log(`3. Login with password: ${DEFAULT_PASSWORD}`)
    console.log('4. Change the store credentials in the store settings')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('🔌 Database connection closed')
  }
}

// Run the migration
if (require.main === module) {
  migrateToStore()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    })
}

module.exports = { migrateToStore }
