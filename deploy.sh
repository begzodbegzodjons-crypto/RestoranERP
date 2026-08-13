#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════╗"
echo "║   Restoran POS V2 — Deployment Script               ║"
echo "╚══════════════════════════════════════════════════════╝"

# 1. GITHUB PUSH
echo ""
echo "=== Step 1: GitHub Push ==="
echo "Enter your GitHub username:"
read GH_USER
echo "Enter your GitHub Personal Access Token (PAT):"
read -s GH_TOKEN
echo "Enter repository name (default: restoran-pos-v2):"
read REPO_NAME
REPO_NAME=${REPO_NAME:-restoran-pos-v2}

# Create repo via GitHub API
echo "Creating repository on GitHub..."
curl -s -H "Authorization: token $GH_TOKEN" \
  -X POST https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"Restaurant POS V2 — Production Ready\",\"private\":true}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Repo created:', d.get('html_url', d.get('message','error')))"

# Add remote and push
cd /home/z/my-project
git remote remove origin 2>/dev/null || true
git remote add origin "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO_NAME.git"
git push -u origin main

echo ""
echo "=== GitHub Push Complete ==="
echo "Repo: https://github.com/$GH_USER/$REPO_NAME"

# 2. RENDER DEPLOY (Backend)
echo ""
echo "=== Step 2: Backend Deploy ==="
echo "Backend will be deployed to Render.com"
echo "1. Go to: https://render.com → New → Web Service"
echo "2. Connect repo: $GH_USER/$REPO_NAME"
echo "3. Root Directory: backend"
echo "4. Build Command: npm install && npm run build"
echo "5. Start Command: node dist/index.js"
echo "6. Environment Variables:"
echo "   DB_HOST=gateway01.eu-central-1.prod.aws.tidbcloud.com"
echo "   DB_PORT=4000"
echo "   DB_USER=3YTK6Em4WhtFiqF.root"
echo "   DB_PASSWORD=ovAH3n3bu2YabeK0"
echo "   DB_DATABASE=oshxona_erp_v2"
echo "   JWT_SECRET=Zm9vYmFyLWp3dC1zZWNyZXQta2V5LWZvci1yZXN0b3Jhbi1wb3MtdjItMjAyNi1sb25nLXN0cmluZw"
echo "   NODE_ENV=production"
echo "   CORS_ORIGIN=https://restoran-pos.pages.dev"

# 3. CLOUDFLARE PAGES (Frontend)
echo ""
echo "=== Step 3: Frontend Deploy ==="
echo "Frontend will be deployed to Cloudflare Pages"
echo "1. Go to: https://pages.cloudflare.com"
echo "2. Create project → Connect Git"
echo "3. Repository: $GH_USER/$REPO_NAME"
echo "4. Build Command: npm run build"
echo "5. Output Directory: .next"
echo "6. Environment Variables:"
echo "   NEXT_PUBLIC_API_URL=https://restoran-pos-backend.onrender.com"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   DEPLOYMENT INSTRUCTIONS READY                       ║"
echo "║   Follow the steps above to deploy.                   ║"
echo "╚══════════════════════════════════════════════════════╝"
