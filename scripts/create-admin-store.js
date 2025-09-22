#!/usr/bin/env node

/**
 * One-time script to create the first admin store
 * Run this script once to create an admin store that can then create other stores
 * 
 * Usage: node scripts/create-admin-store.js
 */

// Load environment variables from .env files
require('dotenv').config()

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// Store schema (simplified for script)
const storeSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cashiers: [{
    type: String,
    trim: true,
    maxlength: 100
  }]
}, {
  timestamps: true
})

const Store = mongoose.model('Store', storeSchema)

async function createAdminStore() {
  try {
    // Check environment variables
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.log('❌ MONGODB_URI environment variable is not set!')
      console.log('   Please create a .env.local file with:')
      console.log('   MONGODB_URI=mongodb://localhost:27017/my-pos')
      console.log('   or')
      console.log('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pos_db')
      process.exit(1)
    }

    console.log('🔗 Connecting to MongoDB...')
    console.log('   URI:', mongoUri.replace(/\/\/.*@/, '//***:***@')) // Hide credentials in output
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB successfully')

    // Check if admin store already exists
    const existingAdmin = await Store.findOne({ isAdmin: true })
    if (existingAdmin) {
      console.log('❌ Admin store already exists:', existingAdmin.storeName)
      console.log('   If you need to create another admin, use the API with existing admin credentials')
      process.exit(1)
    }

    // Get admin details from environment or use defaults
    const adminData = {
      storeName: process.env.ADMIN_STORE_NAME, 
      password: process.env.ADMIN_PASSWORD 
    }

    // Validate password
    if (adminData.password.length < 6) {
      console.log('❌ Password must be at least 6 characters long')
      process.exit(1)
    }

    // Check if store name already exists
    const existingStore = await Store.findOne({ storeName: adminData.storeName })
    if (existingStore) {
      console.log('❌ Store name already exists:', adminData.storeName)
      process.exit(1)
    }

    // Hash password
    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(adminData.password, salt)

    // Create admin store
    const adminStore = new Store({
      storeName: adminData.storeName,
      password: hashedPassword,
      isAdmin: true,
      isActive: true,
      cashiers: []
    })

    const savedStore = await adminStore.save()

    console.log('✅ Admin store created successfully!')
    console.log('   Store ID:', savedStore._id)
    console.log('   Store Name:', savedStore.storeName)
    console.log('   Admin Status:', savedStore.isAdmin)
    console.log('')
    console.log('🔐 Admin Credentials:')
    console.log('   Store Name:', adminData.storeName)
    console.log('   Password:', adminData.password)
    console.log('')
    console.log('⚡ You can now use these credentials to:')
    console.log('   - Log in to the POS system')
    console.log('   - Create new stores via /api/stores/setup')
    console.log('   - Manage the system as an administrator')

  } catch (error) {
    console.error('❌ Error creating admin store:', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

// Run the script
createAdminStore()
