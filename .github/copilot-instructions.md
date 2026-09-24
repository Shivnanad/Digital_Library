# Digital Library - AI Agent Instructions

## Project Architecture

**MERN Stack**: MongoDB (Atlas) + Express.js + React 19 + Node.js  
**Key constraint**: Books are copyrighted - only cover images + sample previews allowed (no full PDF viewers).

### Backend (`/backend`)
- **Structure**: Controllers → Routes → Models → DB
- **API Base**: `http://localhost:5000/api/`
- **Endpoints**: Books, Auth, Cart, Categories, Orders, Payments, Playlists
- **Auth**: JWT tokens stored in localStorage as `token` + `email`
- **Pattern**: Error middleware catches all exceptions; responses always include status + message/data

### Frontend (`/frontend/react-app`)
- **Framework**: React Router v7 + Axios/Fetch
- **State**: Context API (AuthContext) for auth, local state for page data
- **Styling**: CSS files (no CSS-in-JS libraries; no Bootstrap/MUI)
- **Build**: Vite dev server (`npm run dev` on port 5173)

## Critical Patterns & Conventions

### Data Flow
1. **API Calls**: Use service functions in `/services/` (bookService.js, authService.js, cartService.js)
2. **Responses**: Backend returns `{ data: [...], message, pagination: { page, limit, total } }` or single object
3. **Error Handling**: Catch errors in try-catch, display user-friendly messages

### React Component Patterns
- **Functional components** with hooks (`useState`, `useEffect`, `useContext`)
- **Auth check**: Import `useAuth()` from `context/AuthContext` → redirect to `/login` if not authenticated
- **Routing**: Use `useParams()` for URL params, `useNavigate()` for programmatic navigation
- **Cleanup**: Return unmount functions in `useEffect` to prevent memory leaks

### Styling Conventions
- **Dark theme**: Base gradient `linear-gradient(135deg, #0f172a 0%, #1a1f3a 50%, #16213e 100%)`
- **Accent color**: Golden orange `#f59e0b` (hover: `#fbbf24`)
- **Cards**: Semi-transparent `rgba(20, 25, 50, 0.8)` with backdrop blur, soft shadows
- **Animations**: Fade-in, slide-in on component mount; smooth transitions on hover

## Key Files & Their Purpose

| File | Purpose |
|------|---------|
| `backend/server.js` | Express app setup, middleware, route mounting |
| `backend/models/Book.js` | MongoDB schema: title, author, category, price, description, pdfUrl |
| `backend/controllers/bookController.js` | Business logic: getAllBooks (with pagination), getBookById, searchBooks |
| `backend/routes/bookRoutes.js` | Route definitions; `/search` must come BEFORE `/:id` |
| `frontend/src/services/bookService.js` | Fetch API calls; normalizes responses to `{ books: [...] }` |
| `frontend/src/context/AuthContext.jsx` | Auth provider; exposes `useAuth()` hook |
| `frontend/src/components/BookCard.jsx` | Reusable book card component with image, title, author |
| `frontend/src/styles/bookDetails.css` | Styling for book details page (two-column layout, premium buttons) |

## Common Tasks

### Adding a New API Endpoint
1. Create controller function in `backend/controllers/`
2. Add route in `backend/routes/` (order matters: `/search` → `/category/:id` → `/:id`)
3. Add service function in `frontend/src/services/` that normalizes response
4. Call service from component; handle errors gracefully

### Fetching Book Data
```javascript
import { fetchBookById } from "../services/bookService";

useEffect(() => {
  fetchBookById(bookId)
    .then(book => setBook(book))
    .catch(err => console.error(err));
}, [bookId]);
```

### Auth-Protected Components
```javascript
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function MyComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  if (!user) navigate("/login");
  // ... render component
}
```

### Adding to Cart (Example)
```javascript
import { addToCart } from "../services/cartService";

const handleAddCart = async () => {
  try {
    await addToCart(bookId, quantity);
    // Show success toast
  } catch (err) {
    console.error(err);
  }
};
```

## Development Workflow

### Setup
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend/react-app && npm install && npm run dev
```

### Testing Changes
- Backend changes: Restart server (nodemon auto-restarts)
- Frontend changes: Hot reload (Vite auto-refreshes)
- API debugging: Use browser DevTools Network tab or Postman

### Building for Production
```bash
# Frontend build
cd frontend/react-app && npm run build
# Output: dist/ folder (deploy to static host)
```

## Key Technical Details

- **MongoDB ObjectId**: Referenced as `_id` in responses (use `book._id` for links, not `book.id`)
- **PDF Handling**: Backend serves PDFs from `/public/pdfs/` via `/pdfs/*` route; frontend should NOT embed full readers
- **Category Population**: Backend populates category refs → `book.category.name` is available
- **Pagination**: Default limit=10; API returns `{ books, total, page, limit }`
- **Error Messages**: User-friendly strings in response `message` field

## What NOT to Do

❌ Don't modify authentication flow without updating AuthContext  
❌ Don't break existing routes when adding new ones  
❌ Don't use inline styles when CSS file already exists  
❌ Don't show full PDFs; only sample previews (cover + first 2-3 pages)  
❌ Don't require external UI libraries (Bootstrap, MUI, etc.)  
❌ Don't create circular dependencies between services
