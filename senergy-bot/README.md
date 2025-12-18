# Senergy Discord Bot

Discord bot for Senergy that helps users find places matching their personality and plan group outings.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id (optional, for testing)
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

3. Build the project:
```bash
npm run build
```

4. Run the bot:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Commands

- `/register` - Register for Senergy
- `/verify [code]` - Link Discord account
- `/profile` - View your profile
- `/stats` - View your statistics
- `/rate [place]` - Rate a place
- `/group create [location]` - Create a group
- `/group recommend` - Get recommendations
- `/find-squad [distance]` - Find similar users
- `/help` - Show all commands

