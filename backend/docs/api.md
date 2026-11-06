# API

Base path `/api`. Requests and responses are JSON, except file uploads (multipart) and invoices (PDF). Send `Accept: application/json`. User-facing messages are Polish.

## Conventions

**Auth.** Send `Authorization: Bearer <token>`. Tokens come from register, login and guest checkout and expire after 7 days; after that every route answers 401, so clear the token and go to login. Routes marked 🔒 need a token, routes marked 🛡 need a token of an admin (`customer.is_admin`).

**Errors.** The body always has `message`.

| Status | Meaning | Body |
|---|---|---|
| 401 | Missing or dead token | `{"message":"Nie zalogowano"}` |
| 402 | Card declined (`/pay` only) | `{"message":"...","order":{...}}` |
| 403 | Not your record, or not an admin | `{"message":"Brak dostępu"}` |
| 404 | Not found | `{"message":"Nie znaleziono"}` |
| 409 | The record's state forbids this: already paid, cancelled, no invoice yet | `{"message":"..."}` |
| 413 | Request over the server's size limit | `{"message":"..."}` |
| 422 | Validation | `{"message":"...","errors":{"field":["..."]}}` |
| 429 | Rate limit, with a `Retry-After` header | `{"message":"Zbyt wiele prób. Spróbuj ponownie za chwilę."}` |
| 500 | Server error, always generic | `{"message":"..."}` |

Nested field errors use dots: `cart_items.0.selected_size`, `shipping.city`.

**Money comes in two forms.** Fields of stored records are strings with two decimals: `cena`, `sale_price`, `effective_price`, `ocena` (one decimal), `total_amount`, `price`, `value`. Everything from a quote or from stats is a JSON number: `unit_price`, `subtotal`, `total`, `revenue`. Prices are gross PLN.

**Sale prices.** `cena` is the regular price. `effective_price` is what a buyer pays: `sale_price` when there is one, otherwise `cena`. Show `effective_price`, and strike through `cena` when `is_on_sale` is true. Price filters, price sorts, quotes and orders all use the effective price.

**Pagination.** Lists marked *paged* return Laravel's paginator and take `page`:

```json
{"data":[], "current_page":1, "last_page":7, "per_page":12, "total":80, "from":1, "to":12,
 "next_page_url":"...", "prev_page_url":null, "first_page_url":"...", "last_page_url":"...", "path":"...", "links":[]}
```

**Images.** `image_path` is a bare file name. The file is at `/storage/products/<image_path>` and its thumbnail, 640 px wide, at `/storage/products/thumbs/<image_path>`. A thumbnail can be missing, so fall back to the original on error. Use `/storage/products/default-product.jpg` for a product with no images.

**Rate limits**, per minute.

| Route | Limit | Counted by |
|---|---|---|
| `POST /customer/login` | 5, shared with password checks in `POST /orders` | email and IP |
| Any password check of one account | 5 failures | account and IP |
| `POST /customer/register` | 5 | IP |
| `POST /customer/forgot-password` | 5 | IP |
| `POST /customer/reset-password` | 10 | IP |
| `POST /orders` | 20 | IP |
| `POST /cart/quote` with a coupon | 30 | IP |
| `POST /cart/quote` without a coupon | 120 | IP |
| `POST /products/{product}/reviews` | 10 | customer |
| `POST /contact` | 3 | IP |
| `POST /newsletter/subscribe` | 5 | IP |
| `POST /newsletter/confirm` and `/unsubscribe` | 10 together | IP |

## Shared shapes

**Product card**, used by every list:

```json
{"id":13, "nazwa":"T-shirt", "kategoria":"Odzież męska", "cena":"49.99", "sale_price":"39.99",
 "effective_price":"39.99", "is_on_sale":true, "discount_percent":20, "is_new":false,
 "ocena":"4.0", "reviews_count":1, "rozmiar":["S","M"], "kolor":["Biały"], "stock_total":115,
 "images":[{"id":13, "product_id":13, "image_path":"zdj13.jpg", "order":0}]}
```

`sale_price` is `null` and `discount_percent` is `0` for a product not on sale.

**Quote**, returned by `POST /cart/quote`, `GET /cart` and `PUT /cart`:

```json
{"lines":[{"key":"20:L:Czarny", "variant_id":155,
           "product":{"...":"product card fields without stock_total", "is_active":true},
           "size":"L", "color":"Czarny", "quantity":1, "unit_price":159.99, "line_total":159.99,
           "stock":15, "available":true, "error":null}],
 "subtotal":159.99, "discount":16, "coupon":{"code":"WITAJ10", "label":"Rabat 10%"}, "coupon_error":null,
 "delivery_options":[{"value":"courier", "label":"Kurier", "price":15.99}],
 "delivery_price":15.99, "free_delivery_from":300, "free_delivery_missing":156.01, "total":159.98}
```

- `unit_price` is the effective price.
- A line with a problem has `available: false` and a Polish `error`, and stays out of `subtotal`. `stock` is what that variant has, so a selector can offer it.
- `product` is `null` when the product no longer exists.
- `delivery_price` is `null` until a method is chosen, and `total` then has no delivery.
- `delivery_options` already include free delivery, which applies when subtotal minus discount reaches `free_delivery_from`.
- Equal size and color pairs of one product are merged into one line.
- Size and color are `""` for a product without that option.

**Order**, returned by every order route except the admin list:

```json
{"id":1, "order_number":"ORD-6AEDC05621367", "customer_id":8,
 "subtotal_amount":"319.98", "discount_amount":"32.00", "coupon_code":"WITAJ10",
 "delivery_price":"12.99", "total_amount":"300.97",
 "status":"pending", "status_label":"Oczekuje na realizację", "next_statuses":["processing","cancelled"],
 "payment_status":"unpaid", "payment_status_label":"Nieopłacone", "paid_at":null,
 "payment_method":"card", "payment_method_label":"Płatność kartą",
 "delivery_method":"pickup_point", "delivery_method_label":"Paczkomat",
 "billing_address":{"first_name":"...", "last_name":"...", "company_name":null, "nip":null,
                    "address":"...", "city":"...", "postal_code":"...", "country":"..."},
 "shipping_address":{"first_name":"...", "last_name":"...", "company_name":null, "address":"...", "city":"...",
                     "postal_code":"...", "country":"...",
                     "pickup_point":{"code":"WAW01M", "address":"ul. Lipowa 12, 00-101 Warszawa"}},
 "payment_details":{"method":"card", "card_last_four":"4242"},
 "invoice_number":null, "order_date":"2026-11-06T11:56:06.000000Z", "created_at":"...", "updated_at":"...",
 "items":[{"id":1, "order_id":1, "product_id":20, "quantity":2, "price":"159.99",
           "selected_size":"L", "selected_color":"Czarny",
           "product":{"id":20, "nazwa":"...", "kategoria":"...", "cena":"159.99", "images":[]}}],
 "status_events":[{"id":1, "order_id":1, "status":"pending", "status_label":"Oczekuje na realizację",
                   "note":null, "created_at":"...", "updated_at":"..."}]}
```

- `status`: `pending`, `processing`, `shipped`, `delivered`, `cancelled`. Allowed moves: `pending` to `processing` or `cancelled`, `processing` to `shipped` or `cancelled`, `shipped` to `delivered`.
- `payment_status`: `unpaid`, `paid`, `failed`, `refunded`.
- `pickup_point` is present only for `pickup_point` delivery. `card_last_four` appears after a card payment. `payment_details.instructions` is there for transfer and cash.
- `selected_size` and `selected_color` are `null` for a product without that option.
- `items.*.price` is the unit price actually paid and never changes. `items.*.product` is the product today, with only the fields shown here, so use `price` for anything about the order.

**Customer**, returned by the account routes. The password is never included:

```json
{"id":8, "email":"a@example.com", "first_name":"Ola", "last_name":"Nowak", "phone":null, "company_name":null, "nip":null,
 "address":null, "city":null, "postal_code":null, "country":"Polska", "customer_type":"individual",
 "is_admin":false, "created_at":"...", "updated_at":"..."}
```

## Catalog

### GET /products

Active products. *Paged*, `data` holds product cards. Query, all optional:

| Field | Rule |
|---|---|
| `q` | Text in the name or category, up to 100 characters |
| `category` | Exact category name |
| `min_price`, `max_price` | Numbers, compared with the effective price |
| `size`, `color` | Exact values. Together they must match one variant |
| `on_sale` | `1` for products with a sale price |
| `is_new` | `1` for products marked new |
| `sort` | `newest` (default), `price_asc`, `price_desc`, `name`, `rating`. Price sorts use the effective price. Anything else is a 422 |
| `per_page` | 1 to 48, default 12. Over 48 is a 422 |
| `page` | From 1 |

### GET /products/{product}

404 when the product is inactive. A token is optional and only affects `can_review`.

```json
{"id":13, "nazwa":"...", "kategoria":"...", "cena":"49.99", "sale_price":null, "effective_price":"49.99",
 "is_on_sale":false, "discount_percent":0, "is_new":false, "opis":"...", "ocena":"4.0", "reviews_count":1,
 "rozmiar":["S"], "kolor":["Biały"], "is_active":true, "stock_total":115, "created_at":"...", "updated_at":"...",
 "images":[{"id":13, "product_id":13, "image_path":"zdj13.jpg", "order":0}],
 "variants":[{"id":90, "product_id":13, "size":"L", "color":"Biały", "stock":14}],
 "reviews":[{"id":25, "author":"Anna K.", "rating":4, "comment":"...", "created_at":"..."}],
 "related":[{"...":"product card, up to 4"}],
 "can_review":false}
```

`reviews` holds the latest 20. A combination missing from `variants`, or with `stock` 0, cannot be bought.

### GET /catalog/filters

Query: `category` (optional). `categories` always covers the whole shop; the rest narrows to the category. Cached briefly.

```json
{"categories":[{"name":"Akcesoria", "count":6}], "sizes":["36","S","M"], "colors":["Beżowy"],
 "price":{"min":49.99, "max":1299}, "counts":{"new":4, "on_sale":5}}
```

`price` is the range of effective prices, with `null` values when nothing matches.

### GET /categories

`["Akcesoria", "Kurtki"]`, active products only.

### GET /config

```json
{"pickup_points":[{"code":"WAW01M", "address":"ul. Lipowa 12, 00-101 Warszawa"}],
 "bank_account":"12 3456 7890 1234 5678 9012 3456", "free_delivery_from":300,
 "contact":{"email":"kontakt@sklep.example", "phone":"+48 000 000 000",
            "address":"ul. Przykładowa 1, 00-001 Warszawa", "opening_hours":"pon.-pt. 9:00-17:00"}}
```

## Cart

### POST /cart/quote

No login. Prices anything; send it whenever the cart, coupon or delivery changes.

| Field | Rule |
|---|---|
| `items` | Required, may be empty, up to 100 |
| `items.*.product_id` | Required integer. An unknown id gives a flagged line, not an error |
| `items.*.quantity` | Required, 1 to 99 |
| `items.*.size`, `items.*.color` | Optional strings |
| `coupon` | Optional. A bad code does not fail the request: see `coupon_error` |
| `delivery_method` | Optional: `courier`, `pickup_point`, `store_pickup` |

Returns a quote.

### GET /cart 🔒

Returns a quote of the saved cart, without coupon or delivery.

### PUT /cart 🔒

Replaces the saved cart. Body: `items` as above; `[]` empties it. Lines of deleted products are dropped, equal variants are summed up to 99. Returns a quote. Placing an order empties the saved cart.

## Customer account

### POST /customer/register

| Field | Rule |
|---|---|
| `email` | Required, unique |
| `password`, `password_confirmation` | Required, at least 8 characters, must match |
| `first_name`, `last_name` | Required |
| `phone`, `address`, `city`, `postal_code`, `country` | Optional |
| `customer_type` | Optional: `individual` (default) or `company` |
| `company_name`, `nip` | Required when `customer_type` is `company` |

201: `{"customer":{...}, "token":"1|..."}`

### POST /customer/login

Body: `email`, `password`. 200: `{"customer":{...}, "token":"1|..."}`. Wrong details give a 422 with `errors.email`.

### POST /customer/logout 🔒

Ends the current token. `{"message":"Wylogowano pomyślnie."}`

### GET /customer/me 🔒

Returns a customer.

### PUT /customer/profile 🔒

Any of: `first_name`, `last_name`, `phone`, `address`, `city`, `postal_code`, `country`, `customer_type`, `company_name`, `nip`. The email cannot be changed. Returns a customer.

### PUT /customer/password 🔒

Body: `current_password`, `password`, `password_confirmation`. Signs out every other device and keeps the current token. `{"message":"..."}`. A wrong `current_password` is a 422 and counts against the password limit.

### POST /customer/forgot-password

Body: `email`. Always the same 200 reply, whether or not the account exists. The mail links to `{APP_URL}/reset-password?token=...&email=...`.

### POST /customer/reset-password

Body: `token`, `email`, `password`, `password_confirmation`. The token works once, for 60 minutes. Signs out every device. `{"message":"..."}`. A bad or used token gives a 422 with `errors.email`.

## Wishlist 🔒

### GET /wishlist

*Paged*, 48 per page, `data` holds product cards. Inactive products are left out.

### POST /wishlist/{product}

`{"in_wishlist":true}`. Adding twice is harmless. 404 for an inactive product.

### DELETE /wishlist/{product}

`{"in_wishlist":false}`. Removing something absent is harmless.

## Reviews

### POST /products/{product}/reviews 🔒

Only for customers with a non-cancelled order of this product; others get a 403. Check `can_review` first. A customer has one review per product, so posting again replaces it.

| Field | Rule |
|---|---|
| `rating` | Required integer, 1 to 5 |
| `comment` | Optional, up to 2000 characters. Render it as plain text |

`{"id":40, "author":"Żaneta Ł.", "rating":4, "comment":"...", "created_at":"..."}`

## Orders

### POST /orders

Works with or without a token. Client-sent prices are ignored.

| Field | Rule |
|---|---|
| `customer_type` | Required: `individual` or `company` |
| `email` | Required without a token, ignored with one |
| `password` | Without a token: the password of an existing account, or a new one of at least 8 characters |
| `first_name`, `last_name`, `phone`, `address`, `city`, `postal_code`, `country` | Required, the billing address |
| `company_name`, `nip` | Required when `customer_type` is `company` |
| `delivery_method` | Required: `courier`, `pickup_point`, `store_pickup` |
| `pickup_point` | Required for `pickup_point` delivery: a `code` from `/config` |
| `payment_method` | Required: `card`, `transfer`, or `cash`, which needs `store_pickup` |
| `shipping` | Optional separate address: `first_name`, `last_name`, `address`, `city`, `postal_code`, `country` (all required inside it), `company_name`. Otherwise billing is copied |
| `coupon_code` | Optional |
| `cart_items` | Required, 1 to 100 |
| `cart_items.*.product_id` | Required, an existing product |
| `cart_items.*.quantity` | Required, 1 to 99 |
| `cart_items.*.selected_size`, `cart_items.*.selected_color` | Required when the product offers that option |

Note the names differ from the cart: `selected_size` here, `size` there.

200:

```json
{"order":{"...":"order"}, "customer":{"...":"customer"}, "message":"Zamówienie zostało złożone pomyślnie!", "token":"1|..."}
```

`token` appears only when the request had none. The order is `pending` and `unpaid`; a card order goes on to `/pay`.

422 errors worth handling:

| Key | Cause |
|---|---|
| `errors.cart` | List of messages: out of stock, sold out, unavailable |
| `errors.coupon_code` | The coupon stopped applying |
| `errors.email` | The address has an account and the password is wrong or missing: ask the person to log in |
| `errors["cart_items.0.selected_size"]` | Option missing or not offered |

The final check of stock and coupon limits happens here, so a line that was fine in the quote can still fail.

### GET /orders 🔒

*Paged*, 20 per page, newest first, `data` holds orders.

### GET /orders/{order} 🔒

Returns an order. 403 for someone else's.

### POST /orders/{order}/cancel 🔒

Owner only, `pending` orders only, otherwise a 422 with `errors.status`. Returns stock and the coupon use. Returns the order.

### POST /orders/{order}/pay 🔒

Simulated card payment. Owner only, card orders only.

| Field | Rule |
|---|---|
| `card_last_four` | Required string of 4 digits. Never send anything else from the card form |

| Result | Response |
|---|---|
| Accepted | 200 with the order: `paid`, `processing`, `paid_at` set |
| Card ending in `0002` | 402: `{"message":"...", "order":{...}}`, `payment_status` is `failed`, retry allowed |
| Already paid, cancelled or refunded | 409 |
| Not a card order | 422 with `errors.payment` |

### GET /orders/{order}/invoice 🔒

PDF download for the owner, `application/pdf` with a `Content-Disposition` file name. Fetch it with the bearer header and save the blob. 409 until the order is paid.

## Contact

### POST /contact

No login.

| Field | Rule |
|---|---|
| `name` | Required, up to 100 characters, one line |
| `email` | Required |
| `subject` | Required, up to 150 characters, one line |
| `message` | Required, up to 5000 characters |
| `website` | Honeypot. Render it hidden from people, with `tabindex="-1"` and `autocomplete="off"`, and leave it empty |

200: `{"message":"..."}`. The message is stored and emailed to the shop address. A filled `website` gets the same reply and nothing is saved.

## Newsletter

Double opt-in: an address receives nothing until its owner follows the link in the confirmation email.

### POST /newsletter/subscribe

Body: `email`. The same 200 reply for every valid address, whether new, waiting or already confirmed, so the reply never reveals who is subscribed. A confirmation is sent at most once in 10 minutes.

The email links to `{APP_URL}/newsletter/confirm?token=...` and `{APP_URL}/newsletter/unsubscribe?token=...`. These are frontend pages, which send the token to the two routes below.

### POST /newsletter/confirm

Body: `token`. 200: `{"message":"..."}`. A wrong or used token gives a 422 with `errors.token`.

### POST /newsletter/unsubscribe

Body: `token`. Deletes the address. 200: `{"message":"..."}`. A wrong or used token gives a 422 with `errors.token`.

## Admin 🛡

All routes answer 401 to guests and 403 to normal customers, whether or not the id exists.

### GET /admin/stats

`revenue` sums paid orders. `low_stock` lists up to 50 variants below 3, lowest first, and `low_stock_count` counts them all. `unread_messages` counts contact messages not yet read and `confirmed_subscribers` counts confirmed newsletter addresses.

```json
{"revenue":300.97, "orders_count":2,
 "orders_by_status":{"pending":0, "processing":1, "shipped":0, "delivered":0, "cancelled":1},
 "unread_messages":2, "confirmed_subscribers":17, "low_stock_count":46,
 "low_stock":[{"id":3, "product_id":1, "size":"M", "color":"Czarny", "stock":0, "product":{"id":1, "nazwa":"..."}}]}
```

### GET /admin/products

Query: `q`, `page`. *Paged*, 20 per page, product cards with `is_active`, inactive ones included.

### POST /admin/products

| Field | Rule |
|---|---|
| `nazwa`, `kategoria` | Required, up to 255 characters |
| `cena` | Required number, 0 or more |
| `sale_price` | Optional number, must be lower than `cena`. `null` ends the sale |
| `opis` | Required, up to 20000 characters |
| `is_active` | Optional boolean, default true |
| `is_new` | Optional boolean, default false |
| `variants` | Required, 1 to 500 |
| `variants.*.size`, `variants.*.color` | Optional strings. Must be unique together, ignoring case |
| `variants.*.stock` | Required integer, 0 or more |

`rozmiar` and `kolor` are derived from `variants`. 201 with the product: card fields plus `opis`, `is_active`, `images`, `variants`.

### GET /admin/products/{product}

The same shape, also for inactive products.

### PUT /admin/products/{product}

Same fields, all optional. `variants`, when sent, is the full list: matching rows are updated, new ones added, missing ones deleted. `sale_price` is checked against the resulting `cena`, so lowering `cena` under an existing sale is a 422 with `errors.sale_price` unless the same request changes or clears the sale.

### DELETE /admin/products/{product}

`{"deleted":true, "message":"..."}`, or `"deleted":false` when the product has orders: it is then deactivated instead.

### POST /admin/products/{product}/images

Multipart, field `image`: JPG, PNG or WEBP, up to 5 MB. The real content is checked, so SVG and anything else is a 422. The name is generated by the server. 201: `{"id":22, "product_id":21, "image_path":"<random>.png", "order":2}`

### DELETE /admin/products/{product}/images/{image}

`{"message":"..."}`. 404 when the image belongs to another product.

### GET /admin/orders

Query: `status`, `q` (order number, customer email or name), `page`. *Paged*, 20 per page, a light row:

```json
{"id":1, "order_number":"ORD-...", "customer_id":8, "status":"processing", "status_label":"W realizacji", "next_statuses":["shipped","cancelled"],
 "payment_status":"paid", "payment_status_label":"Opłacone", "payment_method":"card", "payment_method_label":"...",
 "delivery_method":"courier", "delivery_method_label":"Kurier", "total_amount":"300.97", "order_date":"...", "items_count":1,
 "customer":{"id":8, "email":"...", "first_name":"...", "last_name":"..."}}
```

### GET /admin/orders/{order}

An order plus `customer`.

### PATCH /admin/orders/{order}/status

Body: `status` (required), `note` (optional, up to 255 characters, shown to the customer). A move outside `next_statuses` is a 422 with `errors.status`. Cancelling returns stock and the coupon use, and turns a paid order into `refunded`. The customer gets an email. Returns the order plus `customer`.

### PATCH /admin/orders/{order}/payment

No body. Marks a transfer or cash order paid; a `pending` order moves to `processing`. A card order is a 422 with `errors.payment`. Already paid or cancelled is a 409. Returns the order plus `customer`.

### GET /admin/orders/{order}/invoice

PDF, as for the customer route.

### GET /admin/customers

Query: `q` (email or name), `page`. *Paged*, 20 per page:

```json
{"id":8, "email":"...", "first_name":"...", "last_name":"...", "phone":null, "city":null, "customer_type":"individual",
 "company_name":null, "is_admin":false, "created_at":"...", "orders_count":3}
```

### GET /admin/coupons

*Paged*, 20 per page, newest first.

```json
{"id":3, "code":"SMOKE5", "type":"fixed", "value":"5.00", "min_order":"0.00", "max_uses":null, "used_count":0,
 "expires_at":null, "is_active":true, "created_at":"...", "updated_at":"..."}
```

### POST /admin/coupons

| Field | Rule |
|---|---|
| `code` | Required, unique. Stored in capitals. Letters, digits, `-` and `_` |
| `type` | Required: `percent` or `fixed` |
| `value` | Required: percent up to 100, fixed in PLN |
| `min_order` | Optional, default 0 |
| `max_uses` | Optional, 1 or more. `null` means no limit |
| `expires_at` | Optional date |
| `is_active` | Optional boolean, default true |

201 with the coupon.

### GET /admin/coupons/{coupon}

Returns the coupon.

### PUT /admin/coupons/{coupon}

Same fields, all optional. `used_count` cannot be set. Returns the coupon.

### DELETE /admin/coupons/{coupon}

`{"message":"..."}`

### DELETE /admin/reviews/{review}

Recalculates the product's rating. `{"message":"..."}`

### GET /admin/messages

Query: `unread` (`1` for unread only), `page`. *Paged*, 20 per page, newest first.

```json
{"id":1, "name":"Ewa Nowak", "email":"ewa@example.com", "subject":"...", "message":"...", "read_at":null, "created_at":"...", "updated_at":"..."}
```

Render `name`, `subject` and `message` as plain text.

### PATCH /admin/messages/{message}/read

No body. Sets `read_at`, keeping the first moment if repeated. Returns the message.

### DELETE /admin/messages/{message}

`{"message":"..."}`

### GET /admin/newsletter

Query: `q` (email), `page`. *Paged*, 20 per page. `confirmed_at` is `null` for an address still waiting. Tokens are never returned.

```json
{"id":1, "email":"a@example.com", "confirmed_at":"2026-11-06T12:00:00.000000Z", "created_at":"..."}
```

### GET /admin/newsletter/export

CSV download of confirmed addresses only, `text/csv` with a `Content-Disposition` file name and the columns `email,confirmed_at`. Fetch it with the bearer header and save the blob. A cell that could run as a spreadsheet formula starts with an apostrophe.
