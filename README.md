# Online-Store-React-Laravel

A full-stack e-commerce application built with **Laravel** (backend API) and **React** (frontend) featuring product catalog, shopping cart, customer authentication, and order management.

## 🚀 Features

### Backend (Laravel API)
- **Product Management**: Product catalog with categories, images, and detailed information
- **Customer Authentication**: Registration, login, and profile management using Laravel Sanctum
- **Order Processing**: Complete order management with multiple payment and delivery methods
- **API Endpoints**: RESTful API for all frontend operations
- **Data Seeding**: Custom Artisan command to populate products from external API

### Frontend (React)
- **Modern React**: Built with React 18 and React Router for navigation
- **Product Browsing**: Category filtering, product details, and image galleries
- **Shopping Cart**: Add/remove items with quantity management
- **Checkout Process**: Multi-step checkout with customer information and payment
- **Order History**: View past orders and order details
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## 📋 Prerequisites

- **PHP** >= 8.2
- **Node.js** >= 14
- **Composer**
- **MySQL** or **SQLite**
- **Git**

## 🛠️ Installation

### Backend Setup (Laravel)

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install PHP dependencies**
   ```bash
   composer install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Configure database** in `.env` file:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=your_database_name
   DB_USERNAME=your_username
   DB_PASSWORD=your_password
   ```

5. **Run migrations**
   ```bash
   php artisan migrate
   ```

6. **Seed product data**
   ```bash
   php artisan shop:seed
   ```

7. **Create storage link**
   ```bash
   php artisan storage:link
   ```

8. **Start Laravel development server**
   ```bash
   php artisan serve
   ```

### Frontend Setup (React)

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
├── backend/                    # Laravel API
│   ├── app/
│   │   ├── Console/Commands/   # Custom Artisan commands
│   │   ├── Http/Controllers/   # API controllers
│   │   └── Models/            # Eloquent models
│   ├── database/
│   │   └── migrations/        # Database migrations
│   ├── routes/
│   │   └── api.php           # API routes
│   └── storage/
│       └── app/public/       # Product images
│
└── frontend/                  # React application
    ├── src/
    │   ├── components/        # React components
    │   ├── pages/            # Page components
    │   └── App.jsx           # Main application
    ├── package.json          # Dependencies
    └── vite.config.js        # Vite configuration
```

## 🔌 API Endpoints

### Public Endpoints
- `GET /api/products` - Get all products
- `GET /api/products/{id}` - Get single product
- `GET /api/products/category/{category}` - Get products by category
- `GET /api/categories` - Get all categories
- `POST /api/customer/login` - Customer login
- `POST /api/orders` - Create new order

### Authenticated Endpoints (requires Sanctum token)
- `POST /api/customer/logout` - Customer logout
- `GET /api/customer/me` - Get customer profile
- `GET /api/orders` - Get customer orders
- `GET /api/orders/{id}` - Get single order

## 🗄️ Database Schema

### Core Tables
- **products** - Product information (name, category, price, description, rating)
- **product_images** - Product image associations
- **customers** - Customer accounts and profiles
- **orders** - Order information and status
- **order_items** - Individual items within orders

### Key Features
- **Multi-auth system** with separate guards for users and customers
- **JSON fields** for flexible product attributes (colors, sizes)
- **Comprehensive order tracking** with billing/shipping addresses
- **Image management** with file storage integration

## 💳 Payment & Delivery Methods

### Payment Options
- **Card Payment** - Credit/debit card processing
- **Bank Transfer** - Traditional bank transfer
- **Cash Payment** - Pay in-store pickup

### Delivery Options
- **Courier** - Home delivery service
- **Pickup Point** - Collection from parcel lockers
- **Store Pickup** - Collect from physical store

## 🎨 Frontend Technologies

- **React 18** - Modern React with hooks
- **React Router DOM** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server
- **PropTypes** - Runtime type checking

## 🛡️ Security Features

- **Laravel Sanctum** for API authentication
- **CSRF Protection** for form submissions
- **Input Validation** on all API endpoints
- **SQL Injection Protection** via Eloquent ORM
- **Password Hashing** using Laravel's built-in hashing

## 📝 Environment Variables

### Backend (.env)
```env
APP_NAME="E-commerce Shop"
APP_ENV=local
APP_KEY=base64:your_key_here
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=shop_db
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=localhost:3000,localhost:5173
```

## 🆘 Troubleshooting

### Common Issues

**CORS Issues**
- Ensure `SANCTUM_STATEFUL_DOMAINS` includes your frontend URL
- Check Laravel CORS configuration

**Database Connection**
- Verify database credentials in `.env`
- Ensure database server is running

**Missing Product Images**
- Run `php artisan storage:link`
- Add actual images to `storage/app/public/products/`
- Images should be named: `zdj1.jpg`, `zdj2.jpg`, etc.

**Authentication Issues**
- Clear browser cookies and localStorage
- Restart both servers
- Check API token expiration
