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

## 🐳 Quick Start with Docker (recommended)

The only requirement is **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (or Docker Engine + Compose v2 on Linux). PHP, Composer, Node.js and MySQL run inside containers.

```bash
git clone https://github.com/PiotrSmola/Online-Store-React-Laravel.git
cd Online-Store-React-Laravel
```

Then run the setup script:

| System | Command |
|--------|---------|
| Windows | double-click `setup.cmd` or run `powershell -ExecutionPolicy Bypass -File .\setup.ps1` |
| Linux / macOS / Git Bash | `./setup.sh` |

The script:
1. checks that Docker is installed and running,
2. finds free ports — if a default port is already taken, it **uses the next free one** (it never stops anything that is already running),
3. generates a root `.env` file (Laravel `APP_KEY`, database passwords) on the first run and reuses it later,
4. builds the images, starts the containers, runs migrations, seeds the products and waits until the shop responds,
5. prints the URLs.

| Service | Default port | URL |
|---------|--------------|-----|
| Shop (React + nginx) | `8080` | http://localhost:8080 |
| API (Laravel + Apache, localhost only) | `8000` | http://127.0.0.1:8000/api/products |
| MySQL (localhost only) | `3306` | `127.0.0.1:3306` |

The actual ports are printed at the end of the script and saved in `.env`. Preferred ports can be changed, e.g. `.\setup.ps1 -AppPort 3000` or `./setup.sh --app-port 3000`.

The API and MySQL ports are published on `127.0.0.1` only, so other machines reach the API through the shop on port `8080`.

The stack runs on a fixed subnet (`10.213.47.0/24`) with nginx at `10.213.47.10`, the only proxy Laravel trusts for the client IP. If the subnet clashes with another network, change `DOCKER_SUBNET` and `FRONTEND_IP` together in `.env`. A stack started before this was added needs `docker compose down` first (the setup scripts do that for you).

Detailed error pages are off by default. To turn them on while debugging, set `APP_DEBUG=true` in `.env` and re-run the setup script.

### Architecture

```
browser ──► frontend (nginx :80) ──► /            React build (SPA)
                                 ├─► /api/*       ─┐
                                 └─► /storage/*   ─┴─► backend (PHP 8.3 + Apache) ──► db (MySQL 8.4)
```

The frontend is built with `VITE_API_URL=/`, so the browser talks only to one origin and nginx proxies API calls and product images to Laravel — no CORS configuration needed.

### Useful commands

```bash
docker compose ps              # container status
docker compose logs -f backend # follow Laravel logs
docker compose down            # stop the stack
docker compose down -v         # stop and delete the database volume
./setup.sh                     # (or setup.ps1) rebuild & redeploy after code changes
docker compose exec backend php artisan migrate:fresh --force && docker compose exec backend php artisan shop:seed
```

> **Product data:** `php artisan shop:seed` first tries the original mock API and, if it is unavailable, falls back to the bundled `backend/database/data/products.json`. Use `--local` to skip the API and `--if-empty` to seed only an empty database.

## 📋 Prerequisites (manual setup without Docker)

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
