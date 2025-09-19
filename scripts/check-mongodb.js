#!/usr/bin/env node

/**
 * MongoDB Connection Checker for POS System
 * 
 * This script verifies MongoDB connectivity and provides setup guidance.
 * Run with: node scripts/check-mongodb.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_db';

async function checkMongoDB() {
  console.log('🔍 Checking MongoDB Connection...\n');
  console.log(`📍 Connection URI: ${MONGODB_URI}`);
  
  try {
    console.log('⏳ Attempting to connect...');
    
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test database operations
    const db = client.db('pos_db');
    const collections = await db.listCollections().toArray();
    console.log(`📊 Database: pos_db (${collections.length} collections)`);
    
    if (collections.length > 0) {
      console.log('📋 Existing collections:');
      collections.forEach(col => console.log(`   - ${col.name}`));
    } else {
      console.log('📋 No collections found (this is normal for new installations)');
    }
    
    await client.close();
    console.log('\n🎉 MongoDB is ready for the POS system!');
    
  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!');
    console.error(`Error: ${error.message}\n`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('🛠️  MongoDB Setup Guide:');
      console.log('');
      console.log('1. Install MongoDB:');
      console.log('   - Windows: Download from https://www.mongodb.com/try/download/community');
      console.log('   - macOS: brew install mongodb/brew/mongodb-community');
      console.log('   - Linux: sudo apt-get install mongodb');
      console.log('');
      console.log('2. Start MongoDB service:');
      console.log('   - Windows: net start MongoDB (or start MongoDB Compass)');
      console.log('   - macOS/Linux: sudo systemctl start mongod');
      console.log('');
      console.log('3. Alternative: Use MongoDB Atlas (cloud):');
      console.log('   - Sign up at https://www.mongodb.com/atlas');
      console.log('   - Create cluster and get connection string');
      console.log('   - Update MONGODB_URI in .env.local');
      console.log('');
    } else if (error.message.includes('authentication')) {
      console.log('🔐 Authentication required. Update your MONGODB_URI with credentials:');
      console.log('   mongodb://username:password@localhost:27017/pos_db');
    } else {
      console.log('🔧 Check your MongoDB configuration and try again.');
    }
    
    process.exit(1);
  }
}

checkMongoDB().catch(console.error);
