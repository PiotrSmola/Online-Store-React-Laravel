# Online-Store-React-Laravel

A full-stack e-commerce application built with **Laravel** (backend API) and **React** (frontend) featuring a searchable catalog with stock per variant, saved carts, coupons, simulated card payments, PDF invoices, email notifications and an admin API.

## 🚀 Features

### Backend (Laravel API)
- **Catalog**: Search, filters, sorting and pagination, with stock kept per size and color variant
- **Cart and pricing**: Saved carts, coupons, free delivery threshold; the server is the only source of prices
- **Orders**: Locked stock handling, a status flow with history, cancellation that returns stock
- **Simulated payment**: Card flow with test cards, no card data on the server
- **Customer accounts**: Registration, login, password reset, profile, wishlist and verified buyer reviews, using Laravel Sanctum
- **Admin API**: Dashboard numbers, products with variants and photos, orders, customers, coupons, review moderation
- **Email**: Queued order confirmations, status updates and password reset messages
- **Invoices**: PDF invoices with net, VAT and gross amounts
- **Images**: Thumbnails 640 px wide, created on upload and by `php artisan shop:thumbnails`
- **Data seeding**: Products, variants, coupons, demo customers and reviews from one Artisan command

### Frontend (React)
- **Modern React**: Built with React 19 and React Router for navigation
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
3. generates a root `.env` file (Laravel `APP_KEY`, database passwords, admin password) on the first run and reuses it later,
4. builds the images, starts the containers, runs migrations, seeds the shop, creates the admin account and waits until the shop responds,
5. prints the URLs and the admin login.

| Service | Default port | URL |
|---------|--------------|-----|
| Shop (React + nginx) | `8080` | http://localhost:8080 |
| API (Laravel + Apache, localhost only) | `8000` | http://127.0.0.1:8000/api/products |
| MySQL (localhost only) | `3306` | `127.0.0.1:3306` |
| Mailpit, the mail inbox (localhost only) | `8025` | http://127.0.0.1:8025 |

The actual ports are printed at the end of the script and saved in `.env`. Preferred ports can be changed, e.g. `.\setup.ps1 -AppPort 3000` or `./setup.sh --app-port 3000`.

The API and MySQL ports are published on `127.0.0.1` only, so other machines reach the API through the shop on port `8080`.

The stack runs on a fixed subnet (`10.213.47.0/24`) with nginx at `10.213.47.10`, the only proxy Laravel trusts for the client IP. If the subnet clashes with another network, change `DOCKER_SUBNET` and `FRONTEND_IP` together in `.env`. A stack started before this was added needs `docker compose down` first (the setup scripts do that for you).

Detailed error pages are off by default. To turn them on while debugging, set `APP_DEBUG=true` in `.env` and re-run the setup script.

### Admin login

The setup script generates `ADMIN_PASSWORD` on the first run, keeps it in `.env` and prints it with `ADMIN_EMAIL` at the end of every run. There is no default password: `php artisan shop:admin` refuses to run without one. It reads both variables and is safe to repeat, so to change the password edit `.env` and re-run the setup script, which also signs the admin out of existing sessions.

An admin is a normal customer account with the `is_admin` flag, so the login is the same as for customers. The flag can only be set by `shop:admin`, never through the API.

### Email and Mailpit

All mail goes to Mailpit, a local inbox that sends nothing to the outside world. Open it at the address printed by the setup script to read order confirmations, status updates and password reset links. Mail is queued and sent by the `queue` service, so a stopped worker delays messages but does not lose them.

### Simulated payment

There is no payment provider. The checkout page checks the card number itself and sends only the last four digits to `POST /api/orders/{order}/pay`. No card number, expiry date or CVV reaches the server.

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Accepted: the order is paid and moves to processing |
| `4000 0000 0000 0002` | Declined (any card ending in `0002`): the payment fails and can be retried |

Any future expiry date and any 3 digit CVV work. Bank transfers and cash are confirmed by an admin in the panel. Cash is available only with store pickup.

### Architecture

```
browser ──► frontend (nginx :80) ──► /            React build (SPA)
                                 ├─► /api/*       ─┐
                                 └─► /storage/*   ─┴─► backend (PHP 8.3 + Apache) ──► db (MySQL 8.4)

queue (php artisan queue:work) ──► db, mailpit
```

Uploaded photos and thumbnails live in the `product_images` volume, so they survive rebuilding the images. A new volume starts with the photos baked into the image.

The frontend is built with `VITE_API_URL=/`, so the browser talks only to one origin and nginx proxies API calls and product images to Laravel — no CORS configuration needed.

### Useful commands

```bash
docker compose ps              # container status
docker compose logs -f backend # follow Laravel logs
docker compose logs -f queue   # follow the mail worker
docker compose down            # stop the stack
docker compose down -v         # stop and delete the database and uploaded photos
./setup.sh                     # (or setup.ps1) rebuild & redeploy after code changes
docker compose exec backend php artisan migrate:fresh --force && docker compose exec backend php artisan shop:seed
docker compose exec backend php artisan shop:thumbnails   # create missing thumbnails
```

> **Product data:** `php artisan shop:seed` first tries the original mock API and, if it is unavailable, falls back to the bundled `backend/database/data/products.json`. Use `--local` to skip the API and `--if-empty` to seed only an empty database. It also creates variants, the coupons `WITAJ10` (10%) and `MINUS20` (20 zł from 150 zł), six demo customers and reviews.
>
> **Upgrading an existing database:** the migrations add variants with a stock of 10 for every existing product, but `--if-empty` skips an existing shop, so coupons, demo customers and reviews appear only after `migrate:fresh` and a seed.

## 📋 Prerequisites (manual setup without Docker)

- **PHP** >= 8.3
- **Node.js** >= 22.22
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

Every endpoint, with its request fields and response shape, is described in [backend/docs/api.md](backend/docs/api.md).

## 🗄️ Database Schema

### Core Tables
- **products** - Product information (name, category, price, description, rating)
- **product_variants** - Stock per size and color
- **product_images** - Product image associations
- **customers** - Customer accounts and profiles
- **orders** - Order information, status and payment state
- **order_items** - Individual items within orders
- **order_status_events** - History of each order
- **cart_items**, **wishlist_items**, **reviews** - Saved per customer
- **coupons** - Discount codes and their limits

### Key Features
- **Multi-auth system** with separate guards for users and customers
- **JSON fields** for flexible product attributes (colors, sizes)
- **Comprehensive order tracking** with billing/shipping addresses
- **Image management** with file storage integration

## 💳 Payment & Delivery Methods

### Payment Options
- **Card Payment** - Simulated, see [Simulated payment](#simulated-payment)
- **Bank Transfer** - Confirmed by an admin
- **Cash Payment** - Paid at store pickup, confirmed by an admin

### Delivery Options
- **Courier** - 15.99 zł
- **Pickup Point** - 12.99 zł, parcel locker chosen at checkout
- **Store Pickup** - Free

Delivery is free from 300 zł after the discount. Prices, lockers and the seller details for invoices are in `backend/config/shop.php`.

## 🎨 Frontend Technologies

- **React 19** - Modern React with hooks
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server
- **PropTypes** - Runtime type checking

## 🛡️ Security Features

- **Laravel Sanctum** for API authentication, with tokens that expire after 7 days
- **Ownership checks** on every order, invoice, cart, wishlist and review route
- **Admin routes** behind one middleware group
- **Rate limits** on login, registration, password reset, reviews, orders and coupon checks
- **Input Validation** on all API endpoints, with whitelists for sorting and filtering
- **SQL Injection Protection** via Eloquent ORM and bound parameters
- **Locked transactions** for stock, coupon limits and payments
- **Upload checks** on the real file content, with random server-side names
- **No card data** on the server, and no sensitive data in logs
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
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-long-password
```

## 🆘 Troubleshooting

### Common Issues

**CORS Issues**
- Add your frontend URL to `CORS_ALLOWED_ORIGINS` (a `*` is ignored on purpose)
- Ensure `SANCTUM_STATEFUL_DOMAINS` includes your frontend URL

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
- Tokens expire after 7 days, so a 401 after that means signing in again

**Emails Do Not Arrive**
- Check that the `queue` service is running: `docker compose logs queue`
- Look for the message in Mailpit, not in a real mailbox
