# Kopi Malay Route Market

You are an expert frontend developer and UI/UX designer. Create a modern, mobile-first e-commerce marketplace web application for "Kopi Malay - Route 1 Official Merchandise". 

Target Audience: Coffee lovers, foodies, long-distance riders/bikers, and adventure tourists.

### Visual Style & Aesthetic (Inspired by Route 1 Merch)

- Clean, high-contrast, adventure-ready aesthetic. Dark/neutral styling combined with crisp typography, subtle card borders, and vibrant accents (yellow/black and blue/red badge elements).

- Fully responsive layout optimized for mobile browsing and seamless desktop purchasing.

- Sticky navigation bar with category links (Shop All, Shirts, Sweaters & Jackets, Stickers, Tumblers, Other Merch), search toggle, user login/signup, and a slide-over shopping cart drawer.

### Core Features & Architecture

1. **Catalog & Filtering:** 

   - Grid layout for products with high-res image placeholders, title, sale/regular pricing, and quick "Add to Cart" actions.

   - Category filter tabs to instantly switch between T-Shirts, Jackets, Stickers, and Tumblers.

2. **Product Detail View:** 

   - Image gallery view, size/variant selector (for apparel), quantity counter, and description accordion.

3. **Shopping Cart & Checkout Flow:** 

   - Persistent cart state using local storage / Supabase.

   - Drawer cart showing subtotal, item removal, and a clean checkout mock screen.

4. **Supabase Integration Setup:** 

   - Structure database hooks/tables for `products`, `categories`, `cart_items`, and `orders` so it's fully ready to connect to a Supabase backend.

Please build the complete foundational layout with rich mock data representing Kopi Malay and Route 1 merchandise (e.g., Mae Hong Son Loop stickers, curve badges, riding jackets, and coffee tumblers). 

Ask me any questions you need before building.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kopi-malay-route-market.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3ecab03c-4e47-4af8-b49d-82e12f21162f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
