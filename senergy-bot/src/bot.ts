import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js'
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
    GatewayIntentBits.GuildMembers,
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
  console.log(`🎉 Bot added to server: ${guild.name}`)
  
  try {
    const channel = guild.systemChannel || guild.channels.cache.find((ch: any) => ch.isTextBased())
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('🎯 Senergy is here!')
        .setDescription(
          'Thanks for adding me! I help you find places that match your personality.\n\n' +
          '**Quick Start:**\n' +
          '• Use `/register` to create your account\n' +
          '• Take the personality quiz\n' +
          '• Use `/verify` with your code\n' +
          '• Start finding your perfect spots!'
        )
        .setFooter({ text: 'Use /help to see all commands' })
        .setTimestamp()

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Get Started')
            .setStyle(ButtonStyle.Link)
            .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/register`)
        )

      await channel.send({ embeds: [embed], components: [button] })
    }
  } catch (error) {
    console.error('Failed to send welcome message:', error)
  }
})

client.on('guildMemberAdd', async (member) => {
  console.log(`👋 New member: ${member.user.tag}`)

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('🎯 Welcome to Senergy!')
      .setDescription(
        `Hey ${member.user.username}! 👋\n\n` +
        `We help you find places that match your vibe using personality-based recommendations.\n\n` +
        `**Getting started is easy:**`
      )
      .addFields(
        {
          name: '1️⃣ Create Account',
          value: 'Sign up and complete the quick personality quiz',
          inline: false,
        },
        {
          name: '2️⃣ Get Your Code',
          value: 'You\'ll receive a verification code after the quiz',
          inline: false,
        },
        {
          name: '3️⃣ Verify Discord',
          value: 'Use `/verify [code]` to link your account',
          inline: false,
        }
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ 
        text: 'Senergy • Find your perfect spot',
        iconURL: member.guild.iconURL() || undefined
      })
      .setTimestamp()

    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('🚀 Register Now')
          .setStyle(ButtonStyle.Link)
          .setURL(`${frontendUrl}/register?discordId=${member.user.id}`),
        
        new ButtonBuilder()
          .setLabel('🔑 Login')
          .setStyle(ButtonStyle.Link)
          .setURL(`${frontendUrl}/login?discordId=${member.user.id}`)
      )

    const helpButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('📚 Commands')
          .setStyle(ButtonStyle.Link)
          .setURL(`${frontendUrl}/discord-bot-docs`)
      )

    await member.send({
      embeds: [welcomeEmbed],
      components: [buttons, helpButtons],
    })

    console.log(`✅ Sent welcome DM to ${member.user.tag}`)

    setTimeout(async () => {
      const tipsEmbed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('💡 What makes Senergy special?')
        .setDescription(
          '🎭 **Personality-Based** - Recommendations that match YOUR vibe\n' +
          '👥 **Group Planning** - Plan with friends using ranked voting\n' +
          '⭐ **Smart Ratings** - Rate atmosphere, crowd, noise & more\n' +
          '🤝 **Find Your Squad** - Connect with similar people nearby\n\n' +
          '_Ready to find your perfect spot?_ 🎯'
        )
        .setFooter({ text: 'Click the buttons above to get started ☝️' })

      try {
        await member.send({ embeds: [tipsEmbed] })
      } catch (err) {
        console.log('Could not send follow-up')
      }
    }, 5000)

  } catch (error) {
    console.error(`Failed to DM ${member.user.tag}:`, error)
    
    try {
      if (member.guild.systemChannel) {
        const fallbackEmbed = new EmbedBuilder()
          .setColor(0xef4444)
          .setDescription(
            `👋 Welcome ${member}! I couldn't DM you. ` +
            `Check your privacy settings, then click below to register:`
          )

        const button = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Register Now')
              .setStyle(ButtonStyle.Link)
              .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?discordId=${member.user.id}`)
          )
        
        await member.guild.systemChannel.send({ embeds: [fallbackEmbed], components: [button] })
      }
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError)
    }
  }
})

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options } = interaction

    try {
      if (commandName === 'register') {
        await handleRegister(interaction)
      } else if (commandName === 'verify') {
        await handleVerify(interaction, options.getString('code')!)
      } else if (commandName === 'profile') {
        await handleProfile(interaction)
      } else if (commandName === 'stats') {
        await handleStats(interaction)
      } else if (commandName === 'rate') {
        await handleRate(interaction, options.getString('place_name')!)
      } else if (commandName === 'group') {
        await handleGroupCommand(interaction, options.getSubcommand())
      } else if (commandName === 'find-squad') {
        await handleFindSquad(interaction, options.getInteger('distance'))
      } else if (commandName === 'help') {
        await handleHelp(interaction)
      }
    } catch (error) {
      console.error(`Error: ${commandName}:`, error)
      const errorEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('❌ Oops!')
        .setDescription('Something went wrong. Please try again.')
      
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
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
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('🚀 Get Started with Senergy')
    .setDescription(
      'Create your account and discover your personality type!\n\n' +
      '**What you\'ll do:**\n' +
      '• Quick registration (1 minute)\n' +
      '• Take personality quiz (2 minutes)\n' +
      '• Get your verification code\n' +
      '• Link your Discord with `/verify`'
    )
    .setFooter({ text: 'Click the button below to begin' })

  const button = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Register Now')
        .setStyle(ButtonStyle.Link)
        .setURL(`${frontendUrl}/register?discordId=${interaction.user.id}`)
    )
  
  await interaction.reply({ embeds: [embed], components: [button], ephemeral: true })
}

async function handleVerify(interaction: any, code: string) {
  await interaction.deferReply({ ephemeral: true })

  const token = await getUserToken(interaction.user.id, code)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Verification Failed')
      .setDescription(
        '**This could mean:**\n' +
        '• Invalid or expired code\n' +
        '• You haven\'t completed the quiz yet\n' +
        '• Code was already used\n\n' +
        'Get a new code by completing the personality quiz.'
      )

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Take Quiz')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/quiz`)
      )

    await interaction.editReply({ embeds: [embed], components: [button] })
    return
  }

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('✅ Discord Linked!')
    .setDescription(
      `Welcome to Senergy, ${interaction.user.username}!\n\n` +
      '**You can now:**\n' +
      '• View your profile with `/profile`\n' +
      '• Rate places with `/rate`\n' +
      '• Create groups with `/group create`\n' +
      '• Find your squad with `/find-squad`'
    )
    .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: 'Use /help to see all commands' })

  await interaction.editReply({ embeds: [embed] })
}

async function handleProfile(interaction: any) {
  await interaction.deferReply({ ephemeral: true })

  const token = await getUserToken(interaction.user.id)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔒 Account Not Linked')
      .setDescription('Link your Discord account to view your profile.')

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Get Started')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?discordId=${interaction.user.id}`)
      )

    await interaction.editReply({ embeds: [embed], components: [button] })
    return
  }

  try {
    const profile = await api.getUserProfile(interaction.user.id)
    const ratings = await api.getUserRatings(token, 5)

    const avgScore = ratings.length > 0
      ? (ratings.reduce((sum: number, r: any) => sum + (r.overallScore || 0), 0) / ratings.length).toFixed(1)
      : 'N/A'

    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`${profile.displayName || interaction.user.username}'s Profile`)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🎭 Personality', value: profile.personalityType || 'Not set', inline: true },
        { name: '⚡ Energy Factor', value: profile.adjustmentFactor?.toFixed(2) || 'N/A', inline: true },
        { name: '📍 Location', value: profile.city || 'Not set', inline: true },
        { name: '⭐ Total Ratings', value: `${profile.totalRatingsCount || 0}`, inline: true },
        { name: '👥 Groups Joined', value: `${profile.totalGroupsJoined || 0}`, inline: true },
        { name: '📊 Avg Score', value: `${avgScore}/10`, inline: true }
      )
      .setFooter({ text: 'Keep rating to get better recommendations!' })
      .setTimestamp()

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('View Full Profile')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`)
      )

    await interaction.editReply({ embeds: [embed], components: [button] })
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Error')
      .setDescription('Could not fetch profile. Try again later.')
    
    await interaction.editReply({ embeds: [embed] })
  }
}

async function handleStats(interaction: any) {
  await interaction.deferReply({ ephemeral: true })

  const token = await getUserToken(interaction.user.id)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔒 Account Not Linked')
      .setDescription('Link your account first with `/verify`')

    await interaction.editReply({ embeds: [embed] })
    return
  }

  try {
    const [ratings, groups] = await Promise.all([
      api.getUserRatings(token, 100),
      api.getUserGroups(token)
    ])

    const avgScore = ratings.length > 0
      ? (ratings.reduce((sum: number, r: any) => sum + r.overallScore, 0) / ratings.length).toFixed(1)
      : '0.0'

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('📊 Your Senergy Stats')
      .setDescription('Here\'s your activity summary')
      .addFields(
        { name: '⭐ Total Ratings', value: `${ratings.length}`, inline: true },
        { name: '👥 Total Groups', value: `${groups.length}`, inline: true },
        { name: '📈 Average Score', value: `${avgScore}/10`, inline: true }
      )
      .setFooter({ text: 'Keep exploring to unlock more insights!' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error: any) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Error')
      .setDescription('Could not fetch stats.')
    
    await interaction.editReply({ embeds: [embed] })
  }
}

async function handleRate(interaction: any, placeName: string) {
  const token = await getUserToken(interaction.user.id)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔒 Account Not Linked')
      .setDescription('Link your account to rate places.')

    await interaction.reply({ embeds: [embed], ephemeral: true })
    return
  }

  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle(`⭐ Rate: ${placeName}`)
    .setDescription(
      'Use our web app for the full rating experience!\n\n' +
      '**Rate on:**\n' +
      '• Atmosphere & vibe\n' +
      '• Crowd size\n' +
      '• Noise level\n' +
      '• Social energy\n' +
      '• Service quality'
    )
    .setFooter({ text: 'Click below to rate this place' })

  const button = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Rate Now')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/rate`)
    )

  await interaction.reply({ embeds: [embed], components: [button], ephemeral: true })
}

async function handleGroupCommand(interaction: any, subcommand: string) {
  const token = await getUserToken(interaction.user.id)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔒 Account Not Linked')
      .setDescription('Link your account to use group features.')

    await interaction.reply({ embeds: [embed], ephemeral: true })
    return
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  if (subcommand === 'create') {
    const location = interaction.options.getString('location')
    
    const embed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('👥 Create Your Group')
      .setDescription(
        `Planning for **${location}**\n\n` +
        '**On the web app, you can:**\n' +
        '• Add friends to your group\n' +
        '• Get AI recommendations\n' +
        '• Vote with ranked choice\n' +
        '• Finalize your plans'
      )
      .setFooter({ text: 'Click below to set up your group' })

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Create Group')
          .setStyle(ButtonStyle.Link)
          .setURL(`${frontendUrl}/groups`)
      )

    await interaction.reply({ embeds: [embed], components: [button], ephemeral: true })
  } else if (subcommand === 'recommend') {
    await interaction.deferReply()

    try {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('📭 No Active Groups')
          .setDescription('Create a group first with `/group create`')

        await interaction.editReply({ embeds: [embed] })
        return
      }

      const activeGroup = groups[0]
      const recommendations = await api.generateRecommendations(token, activeGroup.id)

      if (recommendations.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('🤷 No Recommendations')
          .setDescription('Try adjusting your location or adding more members.')

        await interaction.editReply({ embeds: [embed] })
        return
      }

      const top3 = recommendations.slice(0, 3)
      
      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('🎯 Top Recommendations')
        .setDescription('Based on your group\'s personality profile')
        .addFields(
          top3.map((rec: any, idx: number) => ({
            name: `${['🥇', '🥈', '🥉'][idx]} ${rec.placeName}`,
            value: `**${rec.predictedScore}/10** • ${rec.reasoning}`,
            inline: false
          }))
        )
        .setFooter({ text: 'Use /group vote to cast your votes!' })

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('❌ Error')
        .setDescription('Could not generate recommendations.')
      
      await interaction.editReply({ embeds: [embed] })
    }
  } else if (subcommand === 'vote') {
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('🗳️ Ranked Choice Voting')
      .setDescription(
        'Vote for your top 3 places in order of preference.\n\n' +
        'Use the web app for the full voting experience!'
      )

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Vote Now')
          .setStyle(ButtonStyle.Link)
          .setURL(`${frontendUrl}/groups`)
      )

    await interaction.reply({ embeds: [embed], components: [button], ephemeral: true })
  } else if (subcommand === 'history') {
    await interaction.deferReply({ ephemeral: true })

    try {
      const groups = await api.getUserGroups(token)
      
      if (groups.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('📜 No Group History')
          .setDescription('Create your first group with `/group create`')

        await interaction.editReply({ embeds: [embed] })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('📜 Your Group History')
        .setDescription(
          groups.slice(0, 5).map((group: any) => {
            const place = group.finalPlace
            const status = group.status === 'place_selected' ? '✅' : '⏳'
            return place 
              ? `${status} **${place.placeName}**`
              : `${status} Group in ${group.city || 'Unknown'}`
          }).join('\n')
        )
        .setFooter({ text: `Showing ${Math.min(groups.length, 5)} of ${groups.length} groups` })

      const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Full History')
            .setStyle(ButtonStyle.Link)
            .setURL(`${frontendUrl}/groups`)
        )

      await interaction.editReply({ embeds: [embed], components: [button] })
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('❌ Error')
        .setDescription('Could not fetch history.')
      
      await interaction.editReply({ embeds: [embed] })
    }
  }
}

async function handleFindSquad(interaction: any, distance: number | null) {
  await interaction.deferReply({ ephemeral: true })

  const token = await getUserToken(interaction.user.id)

  if (!token) {
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🔒 Account Not Linked')
      .setDescription('Link your account to find your squad.')

    await interaction.editReply({ embeds: [embed] })
    return
  }

  const searchDistance = distance || 50

  try {
    const matches = await api.findSimilarUsers(token, 0.3, searchDistance)

    if (matches.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('👥 No Matches Found')
        .setDescription(
          `No one found within ${searchDistance}km.\n\n` +
          '**Tips:**\n' +
          '• Try a larger radius\n' +
          '• Check back later as more people join'
        )

      await interaction.editReply({ embeds: [embed] })
      return
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899)
      .setTitle('👥 Your Squad')
      .setDescription(`Found ${matches.length} matches within ${searchDistance}km`)
      .addFields(
        matches.slice(0, 5).map((match: any) => ({
          name: match.displayName,
          value: `${match.personalityType} • ${Math.round(match.similarity * 100)}% match • ${match.distance.toFixed(1)}km away`,
          inline: false
        }))
      )
      .setFooter({ text: matches.length > 5 ? `Showing 5 of ${matches.length} matches` : 'All matches shown' })

    const button = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('View All Matches')
          .setStyle(ButtonStyle.Link)
          .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/matching`)
      )

    await interaction.editReply({ embeds: [embed], components: [button] })
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('❌ Error')
      .setDescription('Could not find matches.')
    
    await interaction.editReply({ embeds: [embed] })
  }
}

async function handleHelp(interaction: any) {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('🤖 Senergy Bot Commands')
    .setDescription('Here\'s everything I can help you with!')
    .addFields(
      {
        name: '🚀 Getting Started',
        value: '`/register` - Create your account\n`/verify` - Link your Discord',
        inline: false
      },
      {
        name: '👤 Your Profile',
        value: '`/profile` - View your personality & stats\n`/stats` - Detailed statistics',
        inline: false
      },
      {
        name: '⭐ Rating Places',
        value: '`/rate [place]` - Rate a place you visited',
        inline: false
      },
      {
        name: '👥 Group Planning',
        value: '`/group create` - Start a group\n`/group recommend` - Get AI recommendations\n`/group vote` - Vote on places\n`/group history` - View past groups',
        inline: false
      },
      {
        name: '🤝 Find Your Squad',
        value: '`/find-squad [distance]` - Find people with similar personality nearby',
        inline: false
      }
    )
    .setFooter({ text: 'Use any command to get started!' })
    .setTimestamp()

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('📖 Full Documentation')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/discord-bot-docs`),
      
      new ButtonBuilder()
        .setLabel('🌐 Web App')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`)
    )

  await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true })
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