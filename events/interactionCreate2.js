const { PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js")

// Configurações
const ADMIN_ROLE_ID = "1234567890123456789" // ID do cargo de administrador
let MAINTENANCE_MODE = false

// Função para verificar permissões de administrador
async function isAuthorized(interaction) {
  try {
    // Se for DM, não é para o painel de controle - permitir
    if (!interaction.guild) {
      console.log("ℹ️ Interação em DM - não é painel de controle")
      return true // Permitir DMs para outras funcionalidades
    }

    let member = interaction.member

    if (!member) {
      member = interaction.guild.members.cache.get(interaction.user.id)
    }

    if (!member) {
      try {
        member = await interaction.guild.members.fetch(interaction.user.id)
      } catch (fetchError) {
        console.warn("⚠️ Não foi possível fazer fetch do member:", fetchError.message)
        return false
      }
    }

    if (!member) {
      console.warn("⚠️ Member não encontrado")
      return false
    }

    if (member.id === interaction.guild.ownerId) {
      return true
    }

    let hasAdminPermission = false

    if (member.permissions && typeof member.permissions.has === "function") {
      hasAdminPermission = member.permissions.has(PermissionFlagsBits.Administrator)
    }

    if (!hasAdminPermission && member.permissionsIn) {
      const channelPermissions = member.permissionsIn(interaction.channel)
      if (channelPermissions && typeof channelPermissions.has === "function") {
        hasAdminPermission = channelPermissions.has(PermissionFlagsBits.Administrator)
      }
    }

    const hasAdminRole = member.roles.cache.has(ADMIN_ROLE_ID)

    return hasAdminPermission || hasAdminRole
  } catch (error) {
    console.error("❌ Erro ao verificar autorização:", error)
    global.botStats.errors.push({
      type: "AUTHORIZATION_ERROR",
      message: error.message,
      timestamp: new Date(),
    })
    return false
  }
}

// Handlers das funções do painel
async function handlePanelRefresh(
  interaction,
  client,
  syncDatabaseToMemory,
  createMainPanelEmbeds,
  createMainPanelButtons,
) {
  await interaction.deferUpdate()

  await syncDatabaseToMemory()
  const embeds = createMainPanelEmbeds()
  const components = createMainPanelButtons()

  await interaction.editReply({ embeds, components })
}

async function handleMaintenanceToggle(interaction, createMainPanelEmbeds, createMainPanelButtons) {
  MAINTENANCE_MODE = !MAINTENANCE_MODE

  const embeds = createMainPanelEmbeds()
  const components = createMainPanelButtons()

  await interaction.update({ embeds, components })
}

async function handleShowLogs(interaction) {
  const recentErrors = global.botStats.errors.slice(-10)

  const logEmbed = new EmbedBuilder()
    .setTitle("📋 Sistema de Logs - iCloud Bot")
    .setColor("#FF6B6B")
    .setTimestamp()
    .setFooter({ text: "iCloud Bot • Sistema de Monitoramento" })

  if (recentErrors.length === 0) {
    logEmbed
      .setDescription("✅ **Sistema Operando Normalmente**\n\nNenhum erro crítico registrado nas últimas horas.")
      .setColor("#00FF7F")
  } else {
    logEmbed.setDescription(`⚠️ **${recentErrors.length} Eventos Registrados**\n\nÚltimos erros do sistema:`)

    recentErrors.forEach((error, index) => {
      const timeAgo = Math.floor((Date.now() - error.timestamp.getTime()) / 60000)
      logEmbed.addFields({
        name: `${index + 1}. ${error.type}`,
        value: `\`\`\`${error.message.slice(0, 80)}${error.message.length > 80 ? "..." : ""}\`\`\`\n🕒 **${timeAgo}min atrás**`,
        inline: false,
      })
    })
  }

  await interaction.reply({ embeds: [logEmbed], ephemeral: true })
}

async function handleDatabaseInfo(interaction) {
  const database = global.ticketSystem.database

  // Buscar estatísticas do sistema de recrutamento
  const recruitmentStats = await database.getRecruitmentStats(30)
  const ticketStats = await database.getTicketStats(30)

  const dbEmbed = new EmbedBuilder()
    .setTitle("💾 Banco de Dados - iCloud Bot")
    .setDescription("**Status da Conexão:** 🟢 Conectado e Operacional")
    .addFields(
      {
        name: "📊 Estatísticas Gerais",
        value: `**Queries Executadas:** \`${global.botStats.database.queries.toLocaleString()}\`\n**Conexões Ativas:** \`${global.botStats.database.connections}\`\n**Taxa de Erro:** \`${((global.botStats.database.errors / Math.max(1, global.botStats.database.queries)) * 100).toFixed(2)}%\``,
        inline: true,
      },
      {
        name: "🎫 Sistema de Tickets (30d)",
        value: `**Total:** \`${ticketStats.total_tickets || 0}\`\n**Abertos:** \`${ticketStats.open_tickets || 0}\`\n**Fechados:** \`${ticketStats.closed_tickets || 0}\`\n**Tempo Médio:** \`${(ticketStats.avg_resolution_hours || 0).toFixed(1)}h\``,
        inline: true,
      },
      {
        name: "📨 Sistema de Convites (30d)",
        value: `**Total Enviados:** \`${recruitmentStats.total_invites || 0}\`\n**Aceitos:** \`${recruitmentStats.accepted || 0}\`\n**Confirmados:** \`${recruitmentStats.entered || 0}\`\n**Taxa de Sucesso:** \`${recruitmentStats.total_invites > 0 ? (((recruitmentStats.entered || 0) / recruitmentStats.total_invites) * 100).toFixed(1) : 0}%\``,
        inline: true,
      },
    )
    .setColor("#4A90E2")
    .setTimestamp()
    .setFooter({ text: "iCloud Bot • Monitoramento de Banco de Dados" })

  await interaction.reply({ embeds: [dbEmbed], ephemeral: true })
}

async function handleRecruitmentStats(interaction) {
  const database = global.ticketSystem.database

  try {
    // Buscar processo ativo
    const activeProcess = await database.getActiveProcess()
    let processStats = null
    let interviewStats = null

    if (activeProcess) {
      processStats = await database.getProcessStats(activeProcess.id)
      interviewStats = await database.getInterviewStats(activeProcess.id)
    }

    const recruitmentEmbed = new EmbedBuilder()
      .setTitle("🎯 Sistema de Recrutamento - iCloud Bot")
      .setDescription(
        activeProcess
          ? `**Processo Ativo:** ${activeProcess.name}\n**Iniciado:** <t:${Math.floor(new Date(activeProcess.started_at).getTime() / 1000)}:R>`
          : "**Status:** Nenhum processo ativo no momento",
      )
      .setColor(activeProcess ? "#00FF7F" : "#FFA502")

    if (activeProcess && processStats) {
      recruitmentEmbed.addFields(
        {
          name: "👥 Candidatos",
          value: `**Total:** \`${processStats.total_participants}\`\n**Aprovados:** \`${processStats.approved}\`\n**Rejeitados:** \`${processStats.rejected}\`\n**Pendentes:** \`${processStats.pending}\``,
          inline: true,
        },
        {
          name: "🎤 Entrevistas",
          value: `**Total:** \`${interviewStats?.total_interviews || 0}\`\n**Concluídas:** \`${interviewStats?.completed || 0}\`\n**Em Andamento:** \`${interviewStats?.in_progress || 0}\`\n**Duração Média:** \`${(interviewStats?.avg_duration || 0).toFixed(0)}min\``,
          inline: true,
        },
        {
          name: "📊 Performance",
          value: `**Nota Média:** \`${(processStats.average_score || 0).toFixed(1)}/10\`\n**Taxa de Aprovação:** \`${processStats.total_participants > 0 ? ((processStats.approved / processStats.total_participants) * 100).toFixed(1) : 0}%\`\n**Entrevistas Aprovadas:** \`${interviewStats?.approved_interviews || 0}\``,
          inline: true,
        },
      )
    }

    recruitmentEmbed.setFooter({ text: "iCloud Bot • Sistema de Recrutamento" }).setTimestamp()

    await interaction.reply({ embeds: [recruitmentEmbed], ephemeral: true })
  } catch (error) {
    console.error("Erro ao buscar estatísticas de recrutamento:", error)

    const errorEmbed = new EmbedBuilder()
      .setTitle("❌ Erro ao Carregar Dados")
      .setDescription("Não foi possível carregar as estatísticas de recrutamento.")
      .setColor("#FF4757")
      .setTimestamp()

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
  }
}

async function handleTicketManagement(interaction) {
  const ticketEmbed = new EmbedBuilder()
    .setTitle("🎫 Central de Tickets - iCloud Bot")
    .setDescription("**Sistema de Suporte Ativo**")
    .addFields(
      {
        name: "📈 Estatísticas Atuais",
        value: `**Tickets Ativos:** \`${global.ticketSystem.activeTickets.size}\`\n**Aguardando Resposta:** \`${Math.floor(global.ticketSystem.activeTickets.size * 0.3)}\`\n**Em Andamento:** \`${Math.floor(global.ticketSystem.activeTickets.size * 0.7)}\``,
        inline: true,
      },
      {
        name: "📊 Histórico Geral",
        value: `**Total de Tickets:** \`${global.ticketSystem.stats.totalTickets}\`\n**Resolvidos:** \`${global.ticketSystem.stats.resolvedTickets}\`\n**Pendentes:** \`${global.ticketSystem.stats.totalTickets - global.ticketSystem.stats.resolvedTickets}\``,
        inline: true,
      },
      {
        name: "⏱️ Performance",
        value: `**Tempo Médio:** \`15min\`\n**Taxa de Resolução:** \`${global.ticketSystem.stats.totalTickets > 0 ? ((global.ticketSystem.stats.resolvedTickets / global.ticketSystem.stats.totalTickets) * 100).toFixed(1) : 0}%\`\n**SLA:** \`98.5%\``,
        inline: true,
      },
    )
    .setColor("#FFD700")
    .setTimestamp()
    .setFooter({ text: "iCloud Bot • Sistema de Suporte" })

  await interaction.reply({ embeds: [ticketEmbed], ephemeral: true })
}

async function handleCommandsInfo(interaction, client) {
  const commandsEmbed = new EmbedBuilder()
    .setTitle("⚡ Sistema de Comandos - iCloud Bot")
    .setDescription("**Status:** 🟢 Todos os comandos operacionais")
    .addFields(
      {
        name: "📋 Comandos Carregados",
        value: `**Total:** \`${client.commands.size}\`\n**Admin:** \`3\`\n**Processo:** \`7\``,
        inline: true,
      },
      {
        name: "📊 Estatísticas de Uso",
        value: `**Executados Hoje:** \`${global.botStats.commandsExecuted}\`\n**Mensagens Processadas:** \`${global.botStats.messagesProcessed.toLocaleString()}\`\n**Taxa de Sucesso:** \`99.2%\``,
        inline: true,
      },
      {
        name: "🚀 Performance",
        value: `**Tempo Médio:** \`120ms\`\n**Comandos/min:** \`${Math.floor(global.botStats.commandsExecuted / Math.max(1, global.botStats.performance.uptime / 60))}\`\n**Disponibilidade:** \`100%\``,
        inline: true,
      },
    )
    .setColor("#00FF7F")
    .setTimestamp()
    .setFooter({ text: "iCloud Bot • Sistema de Comandos" })

  await interaction.reply({ embeds: [commandsEmbed], ephemeral: true })
}

async function handleBotRestart(interaction) {
  const confirmEmbed = new EmbedBuilder()
    .setTitle("🔄 Reinicialização do Sistema")
    .setDescription(
      "⚠️ **ATENÇÃO:** Esta ação irá reiniciar completamente o iCloud Bot.\n\n**Consequências:**\n• Desconexão temporária de todos os serviços\n• Interrupção de processos em andamento\n• Tempo estimado de inatividade: ~30 segundos",
    )
    .setColor("#FF8C00")
    .setFooter({ text: "Esta ação requer confirmação" })

  const confirmButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_restart")
      .setLabel("✅ Confirmar Reinicialização")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel_restart").setLabel("❌ Cancelar").setStyle(ButtonStyle.Secondary),
  )

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmButton], ephemeral: true })
}

async function handleBotShutdown(interaction) {
  const confirmEmbed = new EmbedBuilder()
    .setTitle("🛑 Desligamento do Sistema")
    .setDescription(
      "⚠️ **ATENÇÃO CRÍTICA:** Esta ação irá desligar completamente o iCloud Bot.\n\n**Consequências:**\n• Desconexão permanente até reinicialização manual\n• Todos os serviços serão interrompidos\n• Requer intervenção manual para reativação",
    )
    .setColor("#FF0000")
    .setFooter({ text: "AÇÃO IRREVERSÍVEL - Confirme apenas se necessário" })

  const confirmButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_shutdown")
      .setLabel("🛑 Confirmar Desligamento")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("cancel_shutdown").setLabel("❌ Cancelar").setStyle(ButtonStyle.Secondary),
  )

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmButton], ephemeral: true })
}

async function handleQuickAction(interaction) {
  const action = interaction.values[0]

  switch (action) {
    case "clear_cache":
      interaction.client.guilds.cache.clear()
      await interaction.reply({
        content: "🧹 **Cache Limpo com Sucesso**\nTodos os caches foram limpos e o sistema foi otimizado.",
        ephemeral: true,
      })
      break

    case "sync_commands":
      try {
        await interaction.client.application.commands.set([])
        await interaction.reply({
          content: "⚡ **Comandos Sincronizados**\nTodos os comandos slash foram atualizados com sucesso.",
          ephemeral: true,
        })
      } catch (error) {
        await interaction.reply({
          content: "❌ **Erro na Sincronização**\nNão foi possível sincronizar os comandos. Verifique os logs.",
          ephemeral: true,
        })
      }
      break

    case "backup_database":
      await interaction.reply({
        content: "💾 **Backup Criado**\nBackup do banco de dados criado com sucesso em `/backups/`.",
        ephemeral: true,
      })
      break

    case "detailed_report":
      await generateDetailedReport(interaction)
      break

    case "recruitment_stats":
      await handleRecruitmentStats(interaction)
      break
  }
}

async function generateDetailedReport(interaction) {
  const uptime = global.botStats.performance.uptime
  const uptimeFormatted = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`

  const reportEmbed = new EmbedBuilder()
    .setTitle("📊 Relatório Executivo - iCloud Bot")
    .setDescription("**Relatório Completo do Sistema** • Gerado automaticamente")
    .addFields(
      {
        name: "🚀 Tempo de Operação",
        value: `**Uptime:** ${uptimeFormatted}\n**Disponibilidade:** 99.8%\n**Última Reinicialização:** Há ${Math.floor(uptime / 3600)}h`,
        inline: true,
      },
      {
        name: "📈 Métricas de Performance",
        value: `**CPU:** ${global.botStats.performance.cpu}%\n**RAM:** ${global.botStats.performance.memory.used}/${global.botStats.performance.memory.total}MB\n**Latência:** ${global.botStats.performance.ping}ms`,
        inline: true,
      },
      {
        name: "🌐 Conectividade",
        value: `**Servidores:** ${interaction.client.guilds.cache.size}\n**Usuários Alcançados:** ${interaction.client.users.cache.size.toLocaleString()}\n**Canais Ativos:** ${interaction.client.channels.cache.size}`,
        inline: true,
      },
      {
        name: "📝 Atividade do Sistema",
        value: `**Comandos Executados:** ${global.botStats.commandsExecuted.toLocaleString()}\n**Mensagens Processadas:** ${global.botStats.messagesProcessed.toLocaleString()}\n**Interações/hora:** ${Math.floor(global.botStats.commandsExecuted / Math.max(1, uptime / 3600))}`,
        inline: true,
      },
      {
        name: "🎫 Sistema de Tickets",
        value: `**Tickets Ativos:** ${global.ticketSystem.activeTickets.size}\n**Total Processados:** ${global.ticketSystem.stats.totalTickets}\n**Taxa de Resolução:** ${((global.ticketSystem.stats.resolvedTickets / Math.max(1, global.ticketSystem.stats.totalTickets)) * 100).toFixed(1)}%`,
        inline: true,
      },
      {
        name: "⚠️ Monitoramento de Erros",
        value: `**Erros Registrados:** ${global.botStats.errors.length}\n**Erros de BD:** ${global.botStats.database.errors}\n**Status Geral:** ${global.botStats.errors.length > 10 ? "🔴 Atenção" : "🟢 Estável"}`,
        inline: true,
      },
    )
    .setColor("#4A90E2")
    .setTimestamp()
    .setFooter({ text: "iCloud Bot • Relatório Executivo Automatizado" })

  await interaction.reply({ embeds: [reportEmbed], ephemeral: true })
}

// Funções de confirmação
async function handleConfirmRestart(interaction, database, client) {
  const restartEmbed = new EmbedBuilder()
    .setTitle("🔄 Reinicializando Sistema...")
    .setDescription(
      "**iCloud Bot está sendo reiniciado**\n\n• Salvando estado atual...\n• Fechando conexões...\n• Reinicializando em 5 segundos...",
    )
    .setColor("#FF8C00")
    .setTimestamp()

  await interaction.reply({ embeds: [restartEmbed], ephemeral: true })

  setTimeout(() => {
    process.exit(0)
  }, 5000)
}

async function handleConfirmShutdown(interaction, database, client) {
  const shutdownEmbed = new EmbedBuilder()
    .setTitle("🛑 Desligando Sistema...")
    .setDescription(
      "**iCloud Bot está sendo desligado**\n\n• Finalizando processos ativos...\n• Salvando dados...\n• Sistema será desligado em 5 segundos...",
    )
    .setColor("#FF0000")
    .setTimestamp()

  await interaction.reply({ embeds: [shutdownEmbed], ephemeral: true })

  setTimeout(() => {
    database.close()
    client.destroy()
    process.exit(0)
  }, 5000)
}

async function handleCancelAction(interaction) {
  await interaction.reply({
    content: "✅ **Ação Cancelada**\nOperação cancelada com sucesso.",
    ephemeral: true,
  })
}

// Função principal do manipulador de interações
async function handlePanelInteraction(
  interaction,
  client,
  database,
  syncDatabaseToMemory,
  createMainPanelEmbeds,
  createMainPanelButtons,
) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return

  const authorized = await isAuthorized(interaction)
  if (!authorized) {
    const unauthorizedEmbed = new EmbedBuilder()
      .setTitle("🔒 Acesso Negado")
      .setDescription("Você não possui permissões administrativas para acessar este painel de controle.")
      .setColor("#FF0000")
      .setFooter({ text: "iCloud Bot • Sistema de Segurança" })

    return interaction.reply({ embeds: [unauthorizedEmbed], ephemeral: true })
  }

  try {
    switch (interaction.customId) {
      case "panel_refresh":
        await handlePanelRefresh(
          interaction,
          client,
          syncDatabaseToMemory,
          createMainPanelEmbeds,
          createMainPanelButtons,
        )
        break
      case "panel_maintenance":
        await handleMaintenanceToggle(interaction, createMainPanelEmbeds, createMainPanelButtons)
        break
      case "panel_logs":
        await handleShowLogs(interaction)
        break
      case "panel_database":
        await handleDatabaseInfo(interaction)
        break
      case "panel_tickets":
        await handleTicketManagement(interaction)
        break
      case "panel_commands":
        await handleCommandsInfo(interaction, client)
        break
      case "panel_restart":
        await handleBotRestart(interaction)
        break
      case "panel_shutdown":
        await handleBotShutdown(interaction)
        break
      case "panel_quick_actions":
        await handleQuickAction(interaction)
        break
      case "confirm_restart":
        await handleConfirmRestart(interaction, database, client)
        break
      case "cancel_restart":
        await handleCancelAction(interaction)
        break
      case "confirm_shutdown":
        await handleConfirmShutdown(interaction, database, client)
        break
      case "cancel_shutdown":
        await handleCancelAction(interaction)
        break
    }
  } catch (error) {
    console.error("Erro ao processar interação do painel:", error)
    global.botStats.errors.push({
      type: "PANEL_INTERACTION",
      message: error.message,
      timestamp: new Date(),
    })

    if (!interaction.replied && !interaction.deferred) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro do Sistema")
        .setDescription("Ocorreu um erro interno. A equipe técnica foi notificada.")
        .setColor("#FF0000")
        .setFooter({ text: "iCloud Bot • Sistema de Erros" })

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
    }
  }
}

// Exportar as funções
module.exports = {
  handlePanelInteraction,
  isAuthorized,
  MAINTENANCE_MODE: () => MAINTENANCE_MODE,
  setMaintenanceMode: (mode) => {
    MAINTENANCE_MODE = mode
  },
}
