import {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    CommandInteraction,
    ChatInputCommandInteraction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    TextChannel,
    CategoryChannel,
    Client
  } from 'discord.js'
  import { api } from '../services/api'
  
  export const command = new SlashCommandBuilder()
    .setName('group')
    .setDescription('Create a group to plan an outing')
    .addStringOption(option =>
      option
        .setName('location')
        .setDescription('City or area (e.g., "Seattle", "Downtown")')
        .setRequired(true)
    )
  
  interface GroupSession {
    creatorId: string
    location: string
    members: Set<string>
    channelId: string
    groupId?: string
    recommendations?: any[]
    votes: Map<string, string[]> // userId -> ranked placeIds
  }
  
  // Store active group sessions
  const activeSessions = new Map<string, GroupSession>()
  
  export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true })
  
    try {
        const location = interaction.options.getString('location', true)
        const creator = interaction.user
  
      // Verify user is registered
      const userRecord = await api.getUserProfileByDiscordId(creator.id)
      if (!userRecord || !userRecord.id) {
        return interaction.editReply({
          content: '❌ You must register first! Use `/register`',
        })
      }
  
      // Check if user has completed personality quiz
      if (!userRecord.personalityType) {
        return interaction.editReply({
          content: '❌ Complete your personality quiz first! Use `/profile`',
        })
      }
  
      // Create the group planning channel
      const guild = interaction.guild
      if (!guild) {
        return interaction.editReply({
          content: '❌ This command must be used in a server',
        })
      }
  
      // Find or create "SENERGY GROUPS" category
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === 'SENERGY GROUPS'
      ) as CategoryChannel
  
      if (!category) {
        category = await guild.channels.create({
          name: 'SENERGY GROUPS',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
          ],
        })
      }
  
      // Create private channel
      const channelName = `group-${location.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: creator.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
        ],
      })
  
      // Initialize session
      const session: GroupSession = {
        creatorId: creator.id,
        location,
        members: new Set([creator.id]),
        channelId: channel.id,
        votes: new Map(),
      }
      activeSessions.set(channel.id, session)
  
      // Send welcome message in the channel
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('🎯 Group Planning Session')
        .setDescription(
          `Planning an outing in **${location}**!\n\n` +
          `👤 **Creator:** ${creator}\n` +
          `📍 **Location:** ${location}\n\n` +
          `Use the buttons below to add members to your group.`
        )
        .setFooter({ text: 'Senergy Group Planner' })
        .setTimestamp()
  
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('group_add_members')
          .setLabel('Add Members')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId('group_generate_recs')
          .setLabel('Get Recommendations')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('group_cancel')
          .setLabel('Cancel Group')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      )
  
      await channel.send({ embeds: [welcomeEmbed], components: [row] })
  
      // Reply to user
      await interaction.editReply({
        content: `✅ Group channel created! Check out ${channel}`,
      })
    } catch (error: any) {
      console.error('Group creation error:', error)
      await interaction.editReply({
        content: '❌ Failed to create group: ' + error.message,
      })
    }
  }
  
  // Button handler for adding members
  export async function handleAddMembers(interaction: ButtonInteraction) {
    const session = activeSessions.get(interaction.channelId!)
    if (!session) {
      return interaction.reply({ content: '❌ Session not found', ephemeral: true })
    }
  
    if (interaction.user.id !== session.creatorId) {
      return interaction.reply({ content: '❌ Only the creator can add members', ephemeral: true })
    }
  
    await interaction.reply({
      content: '👥 **Mention users to add them to the group** (e.g., @user1 @user2)\n\nType your message below:',
      ephemeral: true,
    })
  
    // Set up message collector
    const filter = (m: any) => m.author.id === interaction.user.id
    const collector = interaction.channel?.createMessageCollector({ filter, time: 60000, max: 1 })
  
    collector?.on('collect', async (message) => {
      const mentionedUsers = message.mentions.users
  
      if (mentionedUsers.size === 0) {
        await message.reply('❌ No users mentioned. Please mention at least one user.')
        return
      }
  
      // Add permissions for mentioned users
      const channel = interaction.channel as TextChannel
      for (const [userId, user] of mentionedUsers) {
        if (userId === interaction.user.id) continue // Skip creator
  
        // Check if user is registered
        try {
          const userProfile = await api.getUserProfileByDiscordId(userId)
          if (!userProfile || !userProfile.id) {
            await message.reply(`⚠️ ${user} is not registered with Senergy. They need to use \`/register\` first.`)
            continue
          }
  
          if (!userProfile.personalityType) {
            await message.reply(`⚠️ ${user} hasn't completed their personality quiz yet.`)
            continue
          }
  
          // Add channel permission
          await channel.permissionOverwrites.create(userId, {
            ViewChannel: true,
            SendMessages: true,
          })
  
          session.members.add(userId)
  
          // Send notification
          try {
            await user.send(
              `🎯 You've been added to a group planning session in **${interaction.guild?.name}**!\n` +
              `📍 Location: **${session.location}**\n` +
              `Check out ${channel} to participate.`
            )
          } catch (err) {
            console.log(`Could not DM ${user.tag}`)
          }
        } catch (error) {
          console.error(`Error adding ${user.tag}:`, error)
        }
      }
  
      // Update channel message
      const embed = new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle('✅ Members Added!')
        .setDescription(
          `**Group Members (${session.members.size}):**\n` +
          Array.from(session.members)
            .map(id => `• <@${id}>`)
            .join('\n')
        )
  
      await channel.send({ embeds: [embed] })
      await message.delete()
    })
  
    collector?.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.followUp({ content: '⏰ Time expired. Use the button again to add members.', ephemeral: true })
      }
    })
  }
  
  // Button handler for generating recommendations
  export async function handleGenerateRecommendations(interaction: ButtonInteraction) {
    await interaction.deferReply()
  
    const session = activeSessions.get(interaction.channelId!)
    if (!session) {
      return interaction.editReply('❌ Session not found')
    }
  
    if (session.members.size < 2) {
      return interaction.editReply('❌ You need at least 2 members (including yourself) to generate recommendations.')
    }
  
    try {
      // Get all member profiles
      const memberProfiles = []
      for (const memberId of session.members) {
        const profile = await api.getUserProfileByDiscordId(memberId)
        if (profile) {
          memberProfiles.push(profile)
        }
      }
  
      // Calculate group centroid location (average of last rated places)
      const locationsWithRatings = memberProfiles
        .filter(p => p.lastRatedPlaceLocation)
        .map(p => p.lastRatedPlaceLocation!)
  
      if (locationsWithRatings.length === 0) {
        return interaction.editReply(
          '❌ No location data available. Members need to rate places first to establish their location.'
        )
      }
  
      const avgLat = locationsWithRatings.reduce((sum, loc) => sum + loc.lat, 0) / locationsWithRatings.length
      const avgLng = locationsWithRatings.reduce((sum, loc) => sum + loc.lng, 0) / locationsWithRatings.length
  
      // Get auth token for first user (any user in the group)
      const firstMemberId = Array.from(session.members)[0]
      const token = await api.getUserToken(firstMemberId)
  
      if (!token) {
        return interaction.editReply('❌ Failed to authenticate. Please try again.')
      }
  
      // Create group in backend
      const groupData = await api.createGroup(
        token,
        Array.from(session.members),
        { lat: avgLat, lng: avgLng },
        session.location
      )
  
      session.groupId = groupData.id
  
      // Generate recommendations
      const recommendations = await api.generateRecommendations(token, groupData.id)
      session.recommendations = recommendations
  
      // Display recommendations
      const recEmbed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle('🎯 Top Recommendations for Your Group')
        .setDescription(
          `Based on your group's personality profiles and location preferences, here are the best matches:`
        )
        .setFooter({ text: 'Vote for your favorites!' })
  
      recommendations.slice(0, 3).forEach((rec: any, index: number) => {
        const medal = ['🥇', '🥈', '🥉'][index]
        recEmbed.addFields({
          name: `${medal} ${rec.placeName}`,
          value:
            `**Score:** ${rec.predictedScore}/10 | **Confidence:** ${Math.round(rec.confidenceScore * 100)}%\n` +
            `**Reasoning:** ${rec.reasoning}\n` +
            `**Address:** ${rec.address || 'N/A'}`,
          inline: false,
        })
      })
  
      // Create voting buttons
      const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('group_vote')
          .setLabel('Cast Your Vote')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗳️'),
        new ButtonBuilder()
          .setCustomId('group_view_results')
          .setLabel('View Results')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      )
  
      await interaction.editReply({ embeds: [recEmbed], components: [voteRow] })
    } catch (error: any) {
      console.error('Generate recommendations error:', error)
      await interaction.editReply('❌ Failed to generate recommendations: ' + error.message)
    }
  }
  
  // Button handler for voting
  export async function handleVote(interaction: ButtonInteraction) {
    const session = activeSessions.get(interaction.channelId!)
    if (!session || !session.recommendations) {
      return interaction.reply({ content: '❌ No recommendations found', ephemeral: true })
    }
  
    if (!session.members.has(interaction.user.id)) {
      return interaction.reply({ content: '❌ You are not a member of this group', ephemeral: true })
    }
  
    // Create select menu for ranked choice voting
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('group_vote_select_1')
      .setPlaceholder('Select your 1st choice')
      .addOptions(
        session.recommendations.slice(0, 3).map((rec: any, index: number) => ({
          label: rec.placeName,
          value: rec.placeId,
          description: `Score: ${rec.predictedScore}/10 - ${rec.reasoning.substring(0, 50)}...`,
          emoji: ['🥇', '🥈', '🥉'][index],
        }))
      )
  
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
  
    await interaction.reply({
      content: '🗳️ **Ranked Choice Voting**\n\nSelect your top 3 choices in order of preference:',
      components: [row],
      ephemeral: true,
    })
  }
  
  // Handle vote selection
  export async function handleVoteSelect(interaction: StringSelectMenuInteraction) {
    const session = activeSessions.get(interaction.channelId!)
    if (!session) return
  
    const placeId = interaction.values[0]
    const currentStep = parseInt(interaction.customId.split('_').pop()!)
  
    // Initialize user's votes if not exists
    if (!session.votes.has(interaction.user.id)) {
      session.votes.set(interaction.user.id, [])
    }
  
    const userVotes = session.votes.get(interaction.user.id)!
    userVotes.push(placeId)
  
    if (currentStep < 3) {
      // Ask for next choice
      const nextStep = currentStep + 1
      const usedPlaces = new Set(userVotes)
  
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`group_vote_select_${nextStep}`)
        .setPlaceholder(`Select your ${['', '1st', '2nd', '3rd'][nextStep]} choice`)
        .addOptions(
          session.recommendations!
            .slice(0, 3)
            .filter((rec: any) => !usedPlaces.has(rec.placeId))
            .map((rec: any, index: number) => ({
              label: rec.placeName,
              value: rec.placeId,
              description: `Score: ${rec.predictedScore}/10`,
              emoji: ['🥇', '🥈', '🥉'][index],
            }))
        )
  
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
  
      await interaction.update({
        content: `✅ Choice ${currentStep} recorded!\n\n🗳️ Now select your ${['', '1st', '2nd', '3rd'][nextStep]} choice:`,
        components: [row],
      })
    } else {
      // Voting complete
      await interaction.update({
        content: '✅ Your votes have been recorded! Thank you for participating.',
        components: [],
      })
  
      // Check if all members have voted
      if (session.votes.size === session.members.size) {
        await finalizeVoting(interaction.client, interaction.channelId!, session)
      }
    }
  }
  
  // Finalize voting and determine winner
  async function finalizeVoting(
    client: Client,
    channelId: string,
    session: GroupSession
  ) {
    const channel = await client.channels.fetch(channelId) as TextChannel
  
    // Calculate ranked choice results
    const scores = new Map<string, number>()
    
    for (const [userId, rankedPlaces] of session.votes) {
      rankedPlaces.forEach((placeId, index) => {
        const points = [3, 2, 1][index] || 0
        scores.set(placeId, (scores.get(placeId) || 0) + points)
      })
    }
  
    // Sort by score
    const sortedResults = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([placeId, score]) => {
        const place = session.recommendations!.find((r: any) => r.placeId === placeId)
        return { place, score }
      })
  
    const winner = sortedResults[0]
  
    // Create results embed
    const resultsEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('🎉 Voting Complete!')
      .setDescription(
        `**Winner:** ${winner.place.placeName}\n\n` +
        `**Total Points:** ${winner.score}\n` +
        `**Address:** ${winner.place.address}\n\n` +
        `**All Results:**\n` +
        sortedResults
          .map((r, i) => `${i + 1}. **${r.place.placeName}** - ${r.score} points`)
          .join('\n')
      )
      .setFooter({ text: 'Have a great time!' })
  
    // Get Google Maps link
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      winner.place.placeName + ' ' + winner.place.address
    )}`
  
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Open in Google Maps')
        .setStyle(ButtonStyle.Link)
        .setURL(mapsUrl)
        .setEmoji('🗺️'),
      new ButtonBuilder()
        .setCustomId('group_rate_after')
        .setLabel('Rate This Place Later')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⭐')
    )
  
    await channel.send({ embeds: [resultsEmbed], components: [actionRow] })
  
    // Mark group as completed in backend
    if (session.groupId) {
      const token = await api.getUserToken(session.creatorId)
      if (token) {
        await api.finalizeSelection(token, session.groupId, winner.place.placeId, winner.place.placeName)
      }
    }
  }
  
  // Button handler for viewing results
  export async function handleViewResults(interaction: ButtonInteraction) {
    const session = activeSessions.get(interaction.channelId!)
    if (!session) {
      return interaction.reply({ content: '❌ Session not found', ephemeral: true })
    }
  
    const totalMembers = session.members.size
    const votedCount = session.votes.size
  
    const embed = new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle('📊 Voting Status')
      .setDescription(
        `**Progress:** ${votedCount}/${totalMembers} members have voted\n\n` +
        `**Voted:**\n` +
        Array.from(session.votes.keys())
          .map(id => `✅ <@${id}>`)
          .join('\n') +
        `\n\n**Pending:**\n` +
        Array.from(session.members)
          .filter(id => !session.votes.has(id))
          .map(id => `⏳ <@${id}>`)
          .join('\n')
      )
  
    await interaction.reply({ embeds: [embed], ephemeral: true })
  }
  
  // Button handler for canceling group
  export async function handleCancel(interaction: ButtonInteraction) {
    const session = activeSessions.get(interaction.channelId!)
    if (!session) {
      return interaction.reply({ content: '❌ Session not found', ephemeral: true })
    }
  
    if (interaction.user.id !== session.creatorId) {
      return interaction.reply({ content: '❌ Only the creator can cancel the group', ephemeral: true })
    }
  
    await interaction.reply('⏰ This channel will be deleted in 10 seconds...')
  
    setTimeout(async () => {
      const channel = interaction.channel as TextChannel
      activeSessions.delete(interaction.channelId!)
      await channel.delete()
    }, 10000)
  }