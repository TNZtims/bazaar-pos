# Production Deployment Guide

## Environment Variables

Create a `.env` file in your project root with these variables:

```bash
# Database Configuration
MONGODB_URI=mongodb://your-mongodb-host:27017/pos_db

# Server Configuration
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production

# CORS Configuration (for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# AWS S3 Configuration (if using S3 for file uploads)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# JWT Secret (for authentication)
JWT_SECRET=your-super-secret-jwt-key

# Next.js Configuration
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-nextauth-secret
```

## Deployment Platforms

### 1. **Vercel (Recommended)**
- Automatic HTTPS
- Global CDN
- Easy environment variable setup
- Built-in Next.js optimization

### 2. **Railway**
- Simple deployment
- Built-in MongoDB
- Automatic HTTPS
- Environment variable management

### 3. **DigitalOcean App Platform**
- Container-based deployment
- Managed databases
- Load balancing
- Auto-scaling

### 4. **AWS EC2/ECS**
- Full control
- Custom configurations
- Load balancers
- Auto-scaling groups

## WebSocket Configuration

The application now automatically detects the environment:

- **Development**: Uses `localhost` for hostname
- **Production**: Uses `0.0.0.0` to bind to all interfaces
- **Client**: Uses `window.location.origin` for dynamic URL detection

## CORS Security

- **Development**: Allows all origins (`*`)
- **Production**: Only allows specified origins from `ALLOWED_ORIGINS`

## Database Considerations

- Use managed MongoDB (MongoDB Atlas, Railway MongoDB, etc.)
- Ensure database is accessible from your deployment platform
- Use connection pooling for production

## File Upload Considerations

- Configure S3 bucket for production
- Set up proper CORS policies on S3
- Use CDN for image delivery

## Security Checklist

- [ ] Set strong JWT secrets
- [ ] Configure CORS origins
- [ ] Use HTTPS in production
- [ ] Set up proper database access controls
- [ ] Configure S3 bucket permissions
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
