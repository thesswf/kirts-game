# Deploying to Render

This guide explains how to deploy the Kirt's Favorite Game application to Render.

## Prerequisites

- A GitHub account with your repository pushed
- A Render account (sign up at https://render.com)

## Deployment Steps

### 1. Create a Web Service on Render

1. Log in to your Render account
2. Click on "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: kirts-favorite-game (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server.js`
   - **Plan**: Free (or select a paid plan if needed)

### 2. Environment Variables

Add the following environment variables:
- `NODE_ENV`: production
- `PORT`: 10000 (Render will automatically set the PORT, but this is a fallback)

### 3. Auto-Deploy Settings

- Enable automatic deployments from the main branch

### 4. Advanced Settings

- Set the Node.js version to match your local environment (e.g., 18.x)

## Accessing Your Deployed Application

Once deployed, your application will be available at:
`https://kirts-favorite-game.onrender.com` (or your custom subdomain)

## Troubleshooting

If you encounter issues:
1. Check the Render logs for error messages
2. Verify that your server.js file correctly uses the PORT environment variable
3. Ensure your client-side code connects to the correct server URL in production

## Important Notes

- The free tier of Render may have some limitations and your service might spin down after periods of inactivity
- The first deployment might take several minutes to complete

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