# Deployment Guide for High-Low Card Game

This guide provides step-by-step instructions for deploying your High-Low Card Game to either Render.com or Heroku.

## Preparing for Deployment

Before deploying, make sure your application is ready:

1. Test your application locally using `npm run dev`
2. Make sure all dependencies are listed in package.json
3. Ensure your server.js file is properly configured to serve static files from the build directory

## Option 1: Deploying to Render.com (Recommended)

Render.com offers a free tier that's perfect for this application.

### Step 1: Create a Render Account

1. Go to [Render.com](https://render.com/) and sign up for a free account
2. Verify your email address

### Step 2: Connect Your GitHub Repository

1. Push your code to a GitHub repository
2. In Render dashboard, click "New" and select "Web Service"
3. Connect your GitHub account and select your repository

### Step 3: Configure Your Web Service

1. Fill in the following details:
   - **Name**: high-low-card-game (or any name you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
   - **Plan**: Free

2. Add the following environment variable:
   - `NODE_ENV`: `production`

3. Click "Create Web Service"

### Step 4: Access Your Deployed Application

Once the deployment is complete (it may take a few minutes), you can access your application at the URL provided by Render.

## Option 2: Deploying to Heroku

### Step 1: Install Heroku CLI

```bash
npm install -g heroku
```

### Step 2: Login to Heroku

```bash
heroku login
```

### Step 3: Create a Heroku App

```bash
cd card-game
heroku create your-card-game-name
```

### Step 4: Configure for Deployment

Ensure you have a Procfile in your project root (already created):

```
web: node server.js
```

### Step 5: Deploy to Heroku

```bash
git add .
git commit -m "Ready for deployment"
git push heroku main
```

### Step 6: Open Your App

```bash
heroku open
```

## Sharing Your Game

Once deployed, you can share your game with friends by:

1. Opening the deployed URL in your browser
2. Creating a new game
3. Sharing the game code with friends
4. Having friends join using the game code

## Troubleshooting

If you encounter issues during deployment:

- Check the deployment logs for errors
- Ensure all dependencies are properly listed in package.json
- Verify that your server.js file is correctly configured
- Make sure your environment variables are set correctly

For Render.com issues, refer to their [documentation](https://render.com/docs).
For Heroku issues, refer to their [documentation](https://devcenter.heroku.com/). 