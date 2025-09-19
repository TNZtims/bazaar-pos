#!/usr/bin/env tsx

/**
 * Environment Setup Script for POS System
 * 
 * This script helps set up the environment for the POS system.
 * Run with: npm run setup
 */

import * as fs from 'fs'
import * as path from 'path'

const ENV_TEMPLATE = `# MongoDB Configuration
# For local MongoDB installation:
MONGODB_URI=mongodb://localhost:27017/pos_db

# For MongoDB Atlas (replace with your connection string):
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pos_db

# Environment
NODE_ENV=development

# Optional: JWT Secret for future authentication features
# JWT_SECRET=your-super-secret-jwt-key-here

# Optional: API Rate Limiting (requests per minute)
# API_RATE_LIMIT=100
`

function setupEnvironment(): void {
  const envPath = path.join(process.cwd(), '.env.local')
  
  if (fs.existsSync(envPath)) {
    console.log('✅ .env.local already exists')
    return
  }
  
  try {
    fs.writeFileSync(envPath, ENV_TEMPLATE)
    console.log('✅ Created .env.local file')
    console.log('📝 Please edit .env.local with your MongoDB connection string')
  } catch (error) {
    console.error('❌ Error creating .env.local:', (error as Error).message)
  }
}

function checkDependencies(): boolean {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json not found. Are you in the correct directory?')
    return false
  }
  
  const nodeModulesPath = path.join(process.cwd(), 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies...')
    console.log('Run: npm install')
    return false
  }
  
  console.log('✅ Dependencies are installed')
  return true
}

function displayNextSteps(): void {
  console.log('\n🚀 Next Steps:')
  console.log('1. Make sure MongoDB is running locally OR')
  console.log('   Update MONGODB_URI in .env.local with your MongoDB Atlas connection string')
  console.log('2. Run: npm run dev')
  console.log('3. Open: http://localhost:3000')
  console.log('4. Click "Add Sample Products" to populate the database')
  console.log('\n💡 New Features Added:')
  console.log('- Fixed theme system (now supports light/dark toggle)')
  console.log('- Added transaction support for data consistency')
  console.log('- Added profit analytics API at /api/reports/profit')
  console.log('- Enhanced product creation with cost tracking')
}

console.log('🏪 POS System Setup\n')

if (checkDependencies()) {
  setupEnvironment()
  displayNextSteps()
}
