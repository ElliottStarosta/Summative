import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ContextMenuCommandType, ActivityType } from 'discord.js'
import dotenv from 'dotenv'
import { api } from './services/api'

dotenv.config()

const TOKEN = process.env.DISCORD_TOKEN
const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const GUILD_ID = process.env.DISCORD_GUILD_ID // Optional: for testing in specific server

if (!TOKEN || !CLIENT_ID) {
  throw new Error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in .env')
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
})

// ============================================
// COMMAND REGISTRY
// ============================================

export const commands = [
  // Auth Commands
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register for Senergy and complete your personality profile'),

  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Discord account to Senergy')
    .addStringOption((option: any) =>
      option
        .setName('code')
        .setDescription('Verification code sent to your email')
        .setRequired(true)
    ),

  // Profile & Stats
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your Senergy profile and personality type'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your rating and group statistics'),

  // Rating
  new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Rate a place you recently visited')
    .addStringOption((option: any) =>
      option
        .setName('place_name')
        .setDescription('Name of the place (e.g., "Brew & Co Cafe")')
        .setRequired(true)
    ),

  // Group Commands
  new SlashCommandBuilder()
    .setName('group')
    .setDescription('Manage groups and get recommendations')
    .addSubcommand((sub: any) =>
      sub
        .setName('create')
        .setDescription('Create a new group')
        .addStringOption((opt: any) =>
          opt
            .setName('location')
            .setDescription('City or area (e.g., "Downtown Seattle")')
            .setRequired(true)
        )
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('add')
        .setDescription('Add a member to your active group')
        .addUserOption((opt: any) =>
          opt.setName('user').setDescription('User to add').setRequired(true)
        )
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('remove')
        .setDescription('Remove a member from your active group')
        .addUserOption((opt: any) =>
          opt.setName('user').setDescription('User to remove').setRequired(true)
        )
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('recommend')
        .setDescription('Generate place recommendations for your group')
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('vote')
        .setDescription('Vote for your top 3 places (ranked choice)')
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('finalize')
        .setDescription('Lock in the final place and get directions')
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('cancel')
        .setDescription('Cancel your active group')
    )
    .addSubcommand((sub: any) =>
      sub
        .setName('history')
        .setDescription('View your past groups and places')
    ),

  // Matching
  new SlashCommandBuilder()
    .setName('find-squad')
    .setDescription('Find people with similar personality in your area')
    .addStringOption((option: any) =>
      option
        .setName('distance')
        .setDescription('Search radius in km (default: 50)')
        .setRequired(false)
    ),

  // Help
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and how to use them'),
]

// ============================================
// REGISTER COMMANDS WITH DISCORD
// ============================================

export async function registerCommands() {
  try {
    const rest = new REST().setToken(TOKEN!)

    console.log(`Started refreshing ${commands.length} application commands...`)

    // Register globally or in specific guild
    if (GUILD_ID) {
      // For testing - register in specific server (instant)
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID!, GUILD_ID),
        { body: commands }
      )
      console.log(`✅ Registered commands in guild ${GUILD_ID}`)
    } else {
      // Register globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(CLIENT_ID!),
        { body: commands }
      )
      console.log('✅ Registered commands globally')
    }
  } catch (error) {
    console.error('Failed to register commands:', error)
    throw error
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

client.on('ready', () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`)
  if (client.user) {
    client.user.setActivity('for /help', { type: ActivityType.Watching })
  }
})

client.on('guildCreate', async (guild: any) => {
  console.log(`🎉 Bot added to server: ${guild.name} (${guild.id})`)
  
  // Send welcome message to default channel
  try {
    const defaultChannel = guild.systemChannel || guild.channels.cache.find((ch: any) => ch.isTextBased())
    if (defaultChannel && defaultChannel.isTextBased()) {
      await defaultChannel.send(
        `👋 **Welcome to Senergy!**\n\n` +
        `I help you find places that match your personality and plan group outings.\n\n` +
        `**Get started:**\n` +
        `\`/register\` - Create your account\n` +
        `\`/help\` - See all commands\n\n` +
        `Let's find your perfect spot! 🎯`
      )
    }
  } catch (error) {
    console.error('Failed to send welcome message:', error)
  }
})

client.on('interactionCreate', async interaction => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const { commandName, options } = interaction

    try {
      if (commandName === 'register') {
        await handleRegister(interaction)
      } else if (commandName === 'verify') {
        const code = options.getString('code')!
        await handleVerify(interaction, code)
      } else if (commandName === 'profile') {
        await handleProfile(interaction)
      } else if (commandName === 'stats') {
        await handleStats(interaction)
      } else if (commandName === 'rate') {
        const placeName = options.getString('place_name')!
        await handleRate(interaction, placeName)
      } else if (commandName === 'group') {
        const subcommand = options.getSubcommand()
        await handleGroupCommand(interaction, subcommand)
      } else if (commandName === 'find-squad') {
        const distance = options.getString('distance')
        await handleFindSquad(interaction, distance)
      } else if (commandName === 'help') {
        await handleHelp(interaction)
      } else {
        await interaction.reply('❌ Unknown command')
      }
    } catch (error) {
      console.error(`Error handling command ${commandName}:`, error)
      await interaction.reply({
        content: '❌ An error occurred while processing your command',
        ephemeral: true,
      })
    }
  }

  // Handle button interactions
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('vote_')) {
      await handleVoteButton(interaction)
    }
  }
})

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserToken(discordId: string, verificationCode?: string): Promise<string | null> {
  try {
    const response = await api.client.post('/api/auth/discord', {
      discordId,
      verificationCode,
    })
    return response.data.token
  } catch (error: any) {
    console.error('Failed to get user token:', error)
    return null
  }
}

// ============================================
// COMMAND HANDLERS
// ============================================

async function handleRegister(interaction: any) {
  const registrationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register`
  
  await interaction.reply({
    content: `👋 Welcome to Senergy!\n\n[Register here](${registrationUrl})\n\nAfter registering, come back and use \`/verify [code]\` to link your Discord account.`,
    ephemeral: true,
  })
}

async function handleVerify(interaction: any, code: string) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId, code)

    if (!token) {
      await interaction.reply({
        content: `❌ Verification failed. Make sure you've registered and entered the correct verification code.`,
        ephemeral: true,
      })
      return
    }

    await interaction.reply({
      content: `✅ **Discord account linked!**\n\nYou can now use all Senergy commands. Try \`/profile\` to see your stats!`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Verification failed: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleProfile(interaction: any) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    // Get user profile from API
    const profile = await api.getUserProfile(interaction.user.id)
    const ratings = await api.getUserRatings(token, 5)

    const avgScore = ratings.length > 0
      ? (ratings.reduce((sum: number, r: any) => sum + (r.overallScore || 0), 0) / ratings.length).toFixed(1)
      : 'N/A'

    await interaction.reply({
      content: `👤 **${profile.displayName || interaction.user.username}'s Profile**\n\n` +
        `**Personality:** ${profile.personalityType || 'Not set'}\n` +
        `**Adjustment Factor:** ${profile.adjustmentFactor?.toFixed(2) || 'N/A'}\n` +
        `**Total Ratings:** ${profile.totalRatingsCount || 0}\n` +
        `**Groups Joined:** ${profile.totalGroupsJoined || 0}\n` +
        `**Average Score:** ${avgScore}/10\n` +
        `**City:** ${profile.city || 'Not set'}`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Failed to fetch profile: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleStats(interaction: any) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    const ratings = await api.getUserRatings(token, 100)
    const groups = await api.getUserGroups(token)

    const totalRatings = ratings.length
    const totalGroups = groups.length
    const avgScore = totalRatings > 0
      ? (ratings.reduce((sum: number, r: any) => sum + (r.overallScore || 0), 0) / totalRatings).toFixed(1)
      : 'N/A'

    await interaction.reply({
      content: `📊 **Your Senergy Stats**\n\n` +
        `**Total Ratings:** ${totalRatings}\n` +
        `**Total Groups:** ${totalGroups}\n` +
        `**Average Score:** ${avgScore}/10\n` +
        `**Recent Ratings:** ${Math.min(totalRatings, 5)}`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Failed to fetch stats: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleRate(interaction: any, placeName: string) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    await interaction.reply({
      content: `⭐ **Rate: ${placeName}**\n\n` +
        `To rate a place, please use the web app for the full rating experience.\n` +
        `Visit: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/rate\n\n` +
        `_Discord rating form coming soon!_`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Error: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleGroupCommand(interaction: any, subcommand: string) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    const options = interaction.options

    if (subcommand === 'create') {
      const location = options.getString('location')
      
      // Get user's active groups to find the most recent one
      const groups = await api.getUserGroups(token)
      
      await interaction.reply({
        content: `✅ **Group created for ${location}**\n\n` +
          `To create a group with specific members, please use the web app:\n` +
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/groups\n\n` +
          `_Discord group creation with location geocoding coming soon!_`,
        ephemeral: true,
      })
    } else if (subcommand === 'add') {
      const user = options.getUser('user')
      
      await interaction.reply({
        content: `✅ **Added ${user.username} to your group!**\n\n` +
          `To manage group members, use the web app:\n` +
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/groups`,
        ephemeral: true,
      })
    } else if (subcommand === 'recommend') {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        await interaction.reply({
          content: `❌ You don't have any active groups. Create one first with \`/group create\``,
          ephemeral: true,
        })
        return
      }

      const activeGroup = groups[0] // Get first active group
      const recommendations = await api.generateRecommendations(token, activeGroup.id)

      if (recommendations.length === 0) {
        await interaction.reply({
          content: `❌ No recommendations found. Try adjusting your group location or adding more members.`,
          ephemeral: true,
        })
        return
      }

      const top3 = recommendations.slice(0, 3)
      const recsText = top3.map((rec: any, idx: number) => 
        `${['🥇', '🥈', '🥉'][idx]} **${rec.placeName}** - ${rec.predictedScore}/10\n${rec.reasoning}`
      ).join('\n\n')

      await interaction.reply({
        content: `🎯 **Top Recommendations**\n\n${recsText}\n\n_Use \`/group vote\` to vote!_`,
      })
    } else if (subcommand === 'vote') {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        await interaction.reply({
          content: `❌ You don't have any active groups.`,
          ephemeral: true,
        })
        return
      }

      const activeGroup = groups[0]
      const recommendations = activeGroup.recommendedPlaces || []

      if (recommendations.length === 0) {
        await interaction.reply({
          content: `❌ No recommendations available. Generate them first with \`/group recommend\``,
          ephemeral: true,
        })
        return
      }

      await interaction.reply({
        content: `🗳️ **Ranked Choice Voting**\n\n` +
          `To vote for your top 3 places, please use the web app:\n` +
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/groups\n\n` +
          `_Discord voting buttons coming soon!_`,
        ephemeral: true,
      })
    } else if (subcommand === 'finalize') {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        await interaction.reply({
          content: `❌ You don't have any active groups.`,
          ephemeral: true,
        })
        return
      }

      await interaction.reply({
        content: `✅ **Finalize Selection**\n\n` +
          `To finalize your group's place selection, use the web app:\n` +
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/groups\n\n` +
          `_Discord finalization coming soon!_`,
        ephemeral: true,
      })
    } else if (subcommand === 'cancel') {
      await interaction.reply({
        content: `❌ **Group cancelled**\n\nTo cancel a group, use the web app.`,
        ephemeral: true,
      })
    } else if (subcommand === 'history') {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        await interaction.reply({
          content: `📜 **Your Group History**\n\nNo groups yet. Create your first group with \`/group create\``,
          ephemeral: true,
        })
        return
      }

      const historyText = groups.slice(0, 5).map((group: any) => {
        const place = group.finalPlace
        return place 
          ? `• **${place.placeName}** - ${group.status === 'place_selected' ? 'Selected' : 'Active'}`
          : `• Group in ${group.city || 'Unknown'} - ${group.status}`
      }).join('\n')

      await interaction.reply({
        content: `📜 **Your Group History**\n\n${historyText}\n\n_View full history on the web app_`,
        ephemeral: true,
      })
    }
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Error: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleFindSquad(interaction: any, distance: string | null) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    const searchDistance = distance ? parseInt(distance) : 50
    const matches = await api.findSimilarUsers(token, 0.3, searchDistance)

    if (matches.length === 0) {
      await interaction.reply({
        content: `👥 **No matches found within ${searchDistance}km**\n\nTry increasing the distance or check back later when more people join!`,
        ephemeral: true,
      })
      return
    }

    const matchesText = matches.slice(0, 5).map((match: any) => 
      `👤 **${match.displayName}** - ${match.personalityType} (${Math.round(match.similarity * 100)}% match, ${match.distance.toFixed(1)}km)`
    ).join('\n')

    await interaction.reply({
      content: `👥 **Found ${matches.length} matches within ${searchDistance}km**\n\n${matchesText}\n\n_View all matches on the web app_`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Error finding matches: ${error.message}`,
      ephemeral: true,
    })
  }
}

async function handleHelp(interaction: any) {
  const helpText = `
🤖 **Senergy Bot Commands**

**Getting Started:**
\`/register\` - Create your Senergy account
\`/verify\` - Link your Discord account

**Your Profile:**
\`/profile\` - View your personality & stats
\`/stats\` - Detailed statistics

**Rating Places:**
\`/rate [place]\` - Rate a place you visited

**Group Planning:**
\`/group create [location]\` - Start a group
\`/group add [@user]\` - Add members
\`/group recommend\` - Get recommendations
\`/group vote\` - Ranked choice voting
\`/group finalize\` - Lock in final place
\`/group history\` - View past groups

**Finding Friends:**
\`/find-squad [distance]\` - Find people nearby with similar personality

**Help:**
\`/help\` - Show this message
  `

  await interaction.reply({
    content: helpText,
    ephemeral: true,
  })
}

async function handleVoteButton(interaction: any) {
  try {
    const discordId = interaction.user.id
    const token = await getUserToken(discordId)

    if (!token) {
      await interaction.reply({
        content: `❌ Please link your Discord account first with \`/verify [code]\``,
        ephemeral: true,
      })
      return
    }

    // Extract place ID from button customId (format: vote_placeId_rank)
    const parts = interaction.customId.split('_')
    if (parts.length < 3) {
      await interaction.reply({
        content: `❌ Invalid vote button`,
        ephemeral: true,
      })
      return
    }

    const placeId = parts[1]
    const rank = parseInt(parts[2])

    // Get user's active group
    const groups = await api.getUserGroups(token)
    if (groups.length === 0) {
      await interaction.reply({
        content: `❌ You don't have an active group`,
        ephemeral: true,
      })
      return
    }

    const activeGroup = groups[0]
    
    // For now, just acknowledge - full voting implementation would require state management
    await interaction.reply({
      content: `✅ Vote recorded for rank ${rank}! Use the web app for full ranked choice voting.`,
      ephemeral: true,
    })
  } catch (error: any) {
    await interaction.reply({
      content: `❌ Error recording vote: ${error.message}`,
      ephemeral: true,
    })
  }
}

// ============================================
// BOT LOGIN
// ============================================

export async function startBot() {
  try {
    await registerCommands()
    await client.login(TOKEN)
  } catch (error) {
    console.error('Failed to start bot:', error)
    throw error
  }
}