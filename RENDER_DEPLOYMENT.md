# Deploying Your Card Game to Render.com

This guide provides step-by-step instructions for deploying your High-Low Card Game to Render.com, which offers a free tier perfect for this application.

## Prerequisites

1. A GitHub account
2. Your card game code pushed to a GitHub repository
3. A Render.com account (free)

## Step 1: Prepare Your Application

Before deploying, make sure your application is ready:

1. Test your application locally using `npm run dev`
2. Make sure all dependencies are listed in package.json
3. Ensure your server.js file is properly configured to serve static files from the build directory
4. Make sure you have a Procfile with the content: `web: node server.js`

## Step 2: Create a Render Account

1. Go to [Render.com](https://render.com/) and sign up for a free account
2. Verify your email address

## Step 3: Connect Your GitHub Repository

1. In the Render dashboard, click "New" and select "Web Service"
2. Connect your GitHub account if you haven't already
3. Select the repository containing your card game

## Step 4: Configure Your Web Service

1. Fill in the following details:
   - **Name**: high-low-card-game (or any name you prefer)
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
   - **Plan**: Free

2. Add the following environment variable:
   - `NODE_ENV`: `production`

3. Click "Create Web Service"

## Step 5: Monitor the Deployment

1. Render will automatically build and deploy your application
2. You can monitor the progress in the "Logs" tab
3. Once the deployment is complete, you'll see a success message

## Step 6: Access Your Deployed Application

1. Render will provide you with a URL for your application (e.g., https://high-low-card-game.onrender.com)
2. Open this URL in your browser to access your deployed card game
3. Share this URL with your friends so they can join your game

## Troubleshooting

If you encounter issues during deployment:

- Check the deployment logs for errors
- Ensure all dependencies are properly listed in package.json
- Verify that your server.js file is correctly configured to serve static files
- Make sure your environment variables are set correctly

## Playing the Game

1. Open the deployed URL in your browser
2. Create a new game by entering your name
3. Share the game code with your friends
4. Have your friends join using the game code
5. Start the game when everyone is ready
6. Take turns making predictions and enjoy!

## Updating Your Deployment

If you make changes to your code:

1. Push the changes to your GitHub repository
2. Render will automatically detect the changes and redeploy your application
3. Monitor the deployment in the "Logs" tab

Enjoy playing your High-Low Card Game with friends! 