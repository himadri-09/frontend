# Backend Migration Guide for Direct Supabase Auth

## Overview

**Before:** Your backend had auth endpoints that acted as a proxy to Supabase
**After:** Frontend calls Supabase directly, backend only needs to verify tokens

---

## 🔴 Endpoints to REMOVE (Frontend No Longer Calls These)

### 1. `/auth/login` - POST
```python
# ❌ DELETE THIS ENDPOINT
@app.post("/auth/login")
async def login(request: LoginRequest):
    # Frontend now calls supabase.auth.signInWithPassword() directly
    pass
```

### 2. `/auth/signup` - POST
```python
# ❌ DELETE THIS ENDPOINT
@app.post("/auth/signup")
async def signup(request: SignupRequest):
    # Frontend now calls supabase.auth.signUp() directly
    pass
```

### 3. `/auth/refresh` - POST
```python
# ❌ DELETE THIS ENDPOINT
@app.post("/auth/refresh")
async def refresh_token(request: RefreshRequest):
    # Supabase SDK automatically handles token refresh
    pass
```

### 4. `/auth/me` - GET
```python
# ❌ DELETE THIS ENDPOINT (or make optional)
@app.get("/auth/me")
async def get_current_user(token: str):
    # Frontend gets user from Supabase session
    pass
```

### 5. `/auth/logout` - POST
```python
# ❌ DELETE THIS ENDPOINT
@app.post("/auth/logout")
async def logout():
    # Frontend now calls supabase.auth.signOut() directly
    pass
```

---

## ✅ What Your Backend STILL NEEDS

### 1. Token Verification Middleware

Your backend needs to **verify** Supabase JWT tokens for protected endpoints.

#### Option A: Using Supabase Python Library (Recommended)

```python
from fastapi import Depends, HTTPException, Header
from supabase import create_client, Client
import os

# Initialize Supabase client with SERVICE ROLE KEY
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # NOT anon key!

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def get_current_user(authorization: str = Header(...)):
    """
    Verify Supabase JWT token and extract user
    """
    try:
        # Extract token from "Bearer <token>"
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")

        token = authorization.replace("Bearer ", "")

        # Verify token with Supabase
        user = supabase.auth.get_user(token)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user

    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
```

#### Option B: Manual JWT Verification (No Supabase Library)

```python
import jwt
from fastapi import Depends, HTTPException, Header
import os

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

async def verify_token(authorization: str = Header(...)):
    """
    Manually verify Supabase JWT token
    """
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")

        token = authorization.replace("Bearer ", "")

        # Decode and verify JWT
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )

        # Extract user ID from payload
        user_id = payload.get("sub")
        email = payload.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        return {"id": user_id, "email": email}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 🔄 Updated Protected Endpoints

### Example: Upload Endpoint

**Before:**
```python
@app.post("/upload")
async def upload_document(
    file: UploadFile,
    authorization: str = Header(...)
):
    # You probably extracted user_id from your custom JWT
    token = authorization.replace("Bearer ", "")
    user_id = your_custom_jwt_decode(token)  # Custom logic

    # Process upload
    ...
```

**After:**
```python
@app.post("/upload")
async def upload_document(
    file: UploadFile,
    current_user = Depends(get_current_user)  # Use new auth dependency
):
    # Now you get Supabase user directly
    user_id = current_user.id
    email = current_user.email

    # Process upload with verified user
    ...
```

### Example: Get Documents

**Before:**
```python
@app.get("/documents")
async def get_documents(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = your_custom_jwt_decode(token)

    # Fetch user's documents
    ...
```

**After:**
```python
@app.get("/documents")
async def get_documents(current_user = Depends(get_current_user)):
    user_id = current_user.id

    # Fetch user's documents
    ...
```

### Example: Query Document

**Before:**
```python
@app.post("/query")
async def query_document(request: QueryRequest, authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    user_id = your_custom_jwt_decode(token)

    # Process query
    ...
```

**After:**
```python
@app.post("/query")
async def query_document(
    request: QueryRequest,
    current_user = Depends(get_current_user)
):
    user_id = current_user.id

    # Process query
    ...
```

---

## 📋 Complete Backend Example (FastAPI)

```python
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile
from supabase import create_client, Client
import os

app = FastAPI()

# Initialize Supabase with SERVICE ROLE KEY
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ===== AUTH DEPENDENCY =====
async def get_current_user(authorization: str = Header(...)):
    """Verify Supabase JWT token"""
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")

        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)

        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# ===== PROTECTED ENDPOINTS =====

@app.post("/upload")
async def upload_document(
    file: UploadFile,
    current_user = Depends(get_current_user)
):
    """Upload a document for the authenticated user"""
    user_id = current_user.id

    # Your upload logic here
    # Save file, process PDF, store in database with user_id

    return {"message": "Upload successful", "user_id": user_id}

@app.get("/documents")
async def get_documents(current_user = Depends(get_current_user)):
    """Get all documents for the authenticated user"""
    user_id = current_user.id

    # Fetch documents from database where user_id matches
    documents = fetch_user_documents(user_id)

    return {"documents": documents}

@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a document (ensure it belongs to user)"""
    user_id = current_user.id

    # Verify document belongs to user before deleting
    document = get_document_by_id(document_id)
    if document.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    delete_document_from_db(document_id)
    return {"message": "Document deleted"}

@app.post("/query")
async def query_document(
    query: str,
    pdf_name: str = None,
    current_user = Depends(get_current_user)
):
    """Query documents for the authenticated user"""
    user_id = current_user.id

    # Perform RAG query on user's documents
    result = perform_rag_query(query, user_id, pdf_name)

    return result

@app.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user = Depends(get_current_user)
):
    """Get processing job status"""
    # Check job status (ensure it belongs to user)
    status = get_job_status_from_db(job_id, current_user.id)
    return status

# ===== PUBLIC ENDPOINTS (No auth required) =====

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
```

---

## 🔑 Environment Variables Needed

Update your backend `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # SERVICE ROLE KEY
SUPABASE_JWT_SECRET=your-jwt-secret  # Only if manually verifying JWTs

# Optional: Keep your other vars
DATABASE_URL=...
AZURE_STORAGE_CONNECTION_STRING=...
```

**⚠️ IMPORTANT:** Use `SUPABASE_SERVICE_KEY`, NOT `SUPABASE_ANON_KEY`!
- **Anon Key**: For frontend (public, limited permissions)
- **Service Role Key**: For backend (bypasses RLS, full access)

Get keys from: https://app.supabase.com/project/_/settings/api

---

## 📝 Step-by-Step Migration

### Step 1: Install Supabase Library (if using Option A)

```bash
# Python
pip install supabase

# Requirements.txt
supabase==2.0.0
```

Or for manual JWT verification:

```bash
pip install PyJWT
```

### Step 2: Update Environment Variables

```bash
# Add to .env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Step 3: Create Auth Dependency

Add the `get_current_user` function (see examples above)

### Step 4: Update All Protected Endpoints

Replace custom JWT logic with `Depends(get_current_user)`

### Step 5: Remove Old Auth Endpoints

Delete `/auth/login`, `/auth/signup`, `/auth/refresh`, etc.

### Step 6: Test

```bash
# Start backend
python main.py

# Frontend should now:
# 1. Login via Supabase directly
# 2. Send Supabase token to your backend
# 3. Your backend verifies token
# 4. Backend processes request with verified user_id
```

---

## 🧪 Testing Your Backend

### Test Token Verification

```python
# test_auth.py
import requests

# 1. Login via frontend or direct Supabase call
# You'll get a token

# 2. Test your backend endpoint
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

response = requests.get(
    "http://localhost:8000/documents",
    headers={"Authorization": f"Bearer {token}"}
)

print(response.json())
# Should return user's documents if token is valid
# Should return 401 if token is invalid
```

---

## 🔄 Token Flow Diagram

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ 1. Login (email/password)
       ▼
┌─────────────────┐
│  Supabase Auth  │
└──────┬──────────┘
       │ 2. Returns JWT token
       ▼
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ 3. Store token in localStorage
       │ 4. Make API call with token
       ▼
┌─────────────────┐        5. Verify token
│  Your Backend   │◄──────────────────────┐
└──────┬──────────┘                       │
       │ 6. Extract user_id               │
       │ 7. Process request          ┌────┴────────┐
       │ 8. Return data              │  Supabase   │
       ▼                             │  (verify)   │
┌─────────────┐                     └─────────────┘
│  Frontend   │
└─────────────┘
```

---

## ❓ Common Questions

### Q: Do I still need a backend?
**A:** YES! For:
- Document processing (RAG)
- File uploads
- Business logic
- Database operations
- API integrations

You just don't need backend auth endpoints anymore.

### Q: Is my backend less secure now?
**A:** NO! More secure actually:
- Supabase handles auth (battle-tested)
- Your backend verifies JWT tokens
- Less custom auth code = fewer bugs

### Q: What if I need custom user fields?
**A:** Store them in your database, linked by `user_id`:

```python
# In your database
users_table:
  - user_id (from Supabase)
  - custom_field_1
  - custom_field_2

# Link them:
@app.get("/profile")
async def get_profile(current_user = Depends(get_current_user)):
    user_id = current_user.id
    profile = db.query(users_table).filter(user_id=user_id).first()
    return profile
```

### Q: Can users still have the same permissions?
**A:** YES! Use Row Level Security (RLS) in Supabase:

```sql
-- Example RLS policy
CREATE POLICY "Users can only see their own documents"
ON documents
FOR SELECT
USING (auth.uid() = user_id);
```

---

## 🎯 Summary

| Task | Action |
|------|--------|
| Auth endpoints | ❌ **DELETE** `/auth/login`, `/auth/signup`, etc. |
| Token verification | ✅ **ADD** `get_current_user` dependency |
| Protected endpoints | ✅ **UPDATE** to use `Depends(get_current_user)` |
| Environment vars | ✅ **ADD** `SUPABASE_SERVICE_KEY` |
| RAG/Document endpoints | ✅ **KEEP** (no changes needed, just update auth) |

---

## 📚 Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [FastAPI Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [JWT Verification](https://pyjwt.readthedocs.io/)
- [Supabase Python Client](https://github.com/supabase-community/supabase-py)

---

**Need help with backend migration? Let me know!** I can provide specific code examples for your backend framework.
